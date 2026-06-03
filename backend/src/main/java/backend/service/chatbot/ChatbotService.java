package backend.service.chatbot;

import backend.dto.chatbot.ChatbotResponse;
import backend.entity.ChatbotQa;
import backend.entity.Product;
import backend.entity.UnknownQueryLog;
import backend.repository.ChatbotQaRepository;
import backend.repository.ProductRepository;
import backend.repository.UnknownQueryLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.regex.Pattern;

/**
 * 챗봇 서비스 본체 — RAG(키워드 검색 + Gemini 답변 생성) 파이프라인.
 *
 * 처리 흐름(answer):
 *   1) IntentClassifier 분기 (캐시보다 먼저)
 *        - ANGRY    → 상담원 연결 안내(LLM 미호출) + 미답변 로깅(reason=ANGRY)
 *        - VAGUE    → 되묻기(LLM 미호출)
 *        - GREETING → 고정 인사(LLM 미호출)
 *        - RECOMMEND→ 상품 추천 카드(productRepository 조회, 캐시 미사용)
 *        - FAQ      → 2)로
 *   2) Redis 캐시 조회(FAQ 한정, 질문 정규화 키, 24h) — 있으면 즉시 반환(LLM 호출 절약)
 *   3) 키워드 스코어링으로 후보 Q&A top-N 선별
 *        - 매칭 0건 → 폴백(고객센터) + 미답변 로깅(reason=NO_MATCH)
 *   4) 후보 Q&A 를 컨텍스트(systemInstruction)로 Gemini 답변 생성
 *        - LLM 실패(null) → 최상위 Q&A 의 원문 answer 로 폴백(graceful degradation)
 *   5) 생성 답변을 Redis 에 24h 캐시 후 반환
 *
 * 설계 메모:
 *   - 캐시 값은 단순 문자열(answer) → RedisConfig 의 activateDefaultTyping 영향 없이 안전.
 *     (PageImpl 같은 복합 객체 역직렬화 이슈가 발생할 여지 없음)
 *   - Q&A 200개 규모라 findAll() 후 메모리 스코어링(LIKE N회보다 단순/빠름).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ChatbotService {

    private final ChatbotQaRepository qaRepository;
    private final UnknownQueryLogRepository unknownLogRepository;
    private final ChatbotLlmClient llmClient;
    private final RedisTemplate<String, Object> redisTemplate;
    private final IntentClassifier intentClassifier;
    private final ProductRepository productRepository;

    @Value("${chatbot.cache.ttl-hours:24}")
    private long cacheTtlHours;

    /** 컨텍스트로 넘길 후보 Q&A 최대 개수. */
    private static final int TOP_N = 4;
    /** 추천 카드로 보여줄 상품 최대 개수. */
    private static final int RECOMMEND_LIMIT = 6;

    /** 특성 추천 매핑 — (질문에서 찾을 표현, 사용자에게 보일 라벨, 상품명 LIKE 키워드). */
    private record RecKeyword(Pattern pattern, String label, String nameKeyword) {}

    /**
     * 추천 특성 사전. 상품명에 실제로 존재하는 토큰만 키워드로 사용(DB 분포 기반).
     *  - 존재 충분: 저소음(15)·무선(16)·적축(4)·75(23)·65(15)
     *  - 청축/갈축/은축은 상품명에 0건 → 매칭돼도 결과 0 → recommendProducts 가 인기 키보드로 폴백.
     * 첫 매칭이 우선(단일 특성 질의가 대부분).
     */
    private static final List<RecKeyword> RECOMMEND_KEYWORDS = List.of(
            new RecKeyword(Pattern.compile("저소음|무소음|조용|사무|도서관|소음"), "저소음", "저소음"),
            new RecKeyword(Pattern.compile("무선|블루투스|블투|wireless"),        "무선", "무선"),
            new RecKeyword(Pattern.compile("게임|게이밍|적축|빠른|속도"),         "적축(게이밍)", "적축"),
            new RecKeyword(Pattern.compile("75"),                               "75% 배열", "75"),
            new RecKeyword(Pattern.compile("65|미니|컴팩트"),                    "65% 배열", "65"),
            new RecKeyword(Pattern.compile("청축|클릭|타건감"),                  "청축", "청축"),
            new RecKeyword(Pattern.compile("갈축|텍타일"),                       "갈축", "갈축"),
            new RecKeyword(Pattern.compile("은축|스피드축"),                     "은축", "은축")
    );
    /** 캐시 키 접두사. */
    private static final String CACHE_PREFIX = "chatbot:answer:";

    private static final String FALLBACK_REPLY =
            "죄송해요, 그 질문은 제가 정확히 답변드리기 어렵네요. " +
            "스위치·배열·키캡·브랜드·가격·3D 빌더 관련해서 다시 질문해 주시거나, " +
            "자세한 상담은 고객센터(010-6824-7715)로 문의해 주세요.";

    private static final String AGENT_REPLY =
            "상담원 연결을 도와드릴게요! 아래 전화번호로 연락 주시면 빠르게 안내해 드립니다. ☎️";
    private static final String AUCTION_REPLY =
            "진행 중인 핫딜 경매는 상단 메뉴의 'Auctions(경매)'에서 확인하실 수 있어요! " +
            "실시간 입찰가와 남은 시간을 함께 보실 수 있습니다. 🔥";

    /** 상품 카테고리 선택 패널 — 클릭 시 종류별 추천 카드로 이어짐(핫딜경매는 안내). */
    private static final List<ChatbotResponse.QuickButton> PRODUCT_CATEGORY_BUTTONS = List.of(
            new ChatbotResponse.QuickButton("⌨️ 키보드", "키보드 추천"),
            new ChatbotResponse.QuickButton("🔠 키캡", "키캡 추천"),
            new ChatbotResponse.QuickButton("🔘 스위치", "스위치 추천"),
            new ChatbotResponse.QuickButton("🎧 악세서리", "악세서리 추천"),
            new ChatbotResponse.QuickButton("🔥 핫딜 경매", "__AUCTION__")
    );

    /** 도움(대표 문의) 패널 — 인식 불가/모호 시 노출. 각 query 는 FAQ·상품패널·상담원으로 라우팅. */
    private static final List<ChatbotResponse.QuickButton> HELP_CATEGORY_BUTTONS = List.of(
            new ChatbotResponse.QuickButton("🔨 입찰 참여", "경매(입찰)는 어떻게 참여하나요?"),
            new ChatbotResponse.QuickButton("🚚 배송", "배송은 얼마나 걸리나요?"),
            new ChatbotResponse.QuickButton("🔄 취소·교환·반품", "주문 취소나 교환은 어떻게 하나요?"),
            new ChatbotResponse.QuickButton("🛠️ 상품 A/S", "상품 A/S는 어떻게 하나요?"),
            new ChatbotResponse.QuickButton("🛍️ 상품 문의", "상품 추천해줘"),
            new ChatbotResponse.QuickButton("💳 주문·결제", "어떤 결제 수단을 쓸 수 있나요?"),
            new ChatbotResponse.QuickButton("👤 회원 정보", "회원가입은 무료인가요?"),
            new ChatbotResponse.QuickButton("📞 상담원 연결", "__AGENT__")
    );

    public ChatbotResponse answer(String rawQuestion) {
        String question = (rawQuestion == null) ? "" : rawQuestion.strip();
        if (question.isEmpty()) {
            return ChatbotResponse.direct(
                    "궁금한 점을 입력해 주세요! 스위치, 배열, 키캡, 브랜드, 가격, 3D 빌더 무엇이든 좋아요 😊",
                    "VAGUE", false);
        }

        // 0) 특수 토큰(버튼에서 전송) — 상담원 연결 / 핫딜 경매 안내
        if ("__AGENT__".equals(question)) {
            return ChatbotResponse.direct(AGENT_REPLY, "AGENT", true);
        }
        if ("__AUCTION__".equals(question)) {
            return ChatbotResponse.direct(AUCTION_REPLY, "RECOMMEND", false);
        }

        // 1) 의도 분기 (캐시보다 먼저 — RECOMMEND/ANGRY 등은 캐시를 타지 않음)
        IntentClassifier.IntentResult intent = intentClassifier.classify(question);
        switch (intent.getIntent()) {
            case ANGRY -> {
                logUnknown(question, "ANGRY", 0);
                return ChatbotResponse.direct(intent.getDirectReply(), "ANGRY", true);
            }
            case VAGUE -> {
                return helpPanel("어떤 것이 궁금하신가요? 아래에서 골라 주세요 😊");
            }
            case GREETING -> {
                return ChatbotResponse.direct(intent.getDirectReply(), "GREETING", false);
            }
            case RECOMMEND -> {
                return recommendProducts(question);
            }
            default -> { /* FAQ → 아래 캐시 + RAG 진행 */ }
        }

        // 2) 캐시 조회 (FAQ 한정 — 반복 FAQ 를 빠르게)
        String cacheKey = CACHE_PREFIX + normalize(question);
        try {
            Object cached = redisTemplate.opsForValue().get(cacheKey);
            if (cached instanceof String s && !s.isBlank()) {
                return ChatbotResponse.builder()
                        .answer(s).intent("FAQ").showAgent(false)
                        .sources(List.of()).cached(true).build();
            }
        } catch (Exception e) {
            log.warn("[Chatbot] 캐시 조회 실패(무시하고 진행): {}", e.getMessage());
        }

        // 3) 키워드 스코어링으로 후보 Q&A 선별
        List<ScoredQa> ranked = rankByKeyword(question);
        if (ranked.isEmpty()) {
            logUnknown(question, "NO_MATCH", 0);
            return helpPanel("음, 정확히 이해하지 못했어요 😅 아래에서 골라 주시면 빠르게 도와드릴게요!");
        }

        List<ScoredQa> top = ranked.subList(0, Math.min(TOP_N, ranked.size()));
        List<String> sourceIds = new ArrayList<>();
        for (ScoredQa sq : top) sourceIds.add(sq.qa.getId());

        // 4) RAG: 후보 Q&A 를 컨텍스트로 Gemini 답변 생성
        String systemInstruction = buildSystemInstruction(top);
        String generated = llmClient.generate(systemInstruction, question);

        // 4-폴백) LLM 실패 → 최상위 Q&A 원문으로 graceful degradation
        if (generated == null || generated.isBlank()) {
            logUnknown(question, "LLM_FALLBACK", top.get(0).score);
            String fallbackAnswer = top.get(0).qa.getAnswer();
            return ChatbotResponse.builder()
                    .answer(fallbackAnswer).intent("FAQ").showAgent(false)
                    .sources(sourceIds).cached(false).build();
        }

        // 5) 캐시 저장 후 반환
        try {
            redisTemplate.opsForValue().set(cacheKey, generated, Duration.ofHours(cacheTtlHours));
        } catch (Exception e) {
            log.warn("[Chatbot] 캐시 저장 실패(무시): {}", e.getMessage());
        }

        return ChatbotResponse.builder()
                .answer(generated).intent("FAQ").showAgent(false)
                .sources(sourceIds).cached(false).build();
    }

    /**
     * 챗봇 LLM(Gemini) 가용 여부 — Controller 의 /health 가 호출해 프론트 온라인/오프라인 점에 사용.
     * GeminiChatbotClient 면 실제 상태(키 설정 + 직전 호출 성공), 그 외 구현이면 가용(true)으로 간주.
     */
    public boolean isLlmHealthy() {
        return !(llmClient instanceof GeminiChatbotClient gemini) || gemini.isHealthy();
    }

    // ── 상품 추천 ────────────────────────────────────────────────────────
    /**
     * 추천 의도 처리(캐시 안 탐 — 상품은 가변).
     *   - 종류 미지정 + 특성 없음(="상품 추천"/"상품 문의") → 상품 카테고리 선택 패널(버튼).
     *   - 종류 지정(키보드/키캡/스위치/악세서리) → 해당 종류 카드. 키보드는 특성(저소음/무선/75…) 추가 필터.
     *   - 특성만 있고 종류 미지정 → 키보드로 간주. 특성 0건 → 인기 상품 폴백.
     * 상품명 LIKE 가 메인 신호(구조 컬럼 대부분 NULL).
     */
    private ChatbotResponse recommendProducts(String question) {
        String q = question.toLowerCase();

        // 1) 상품 종류 감지(키보드/키캡/스위치/악세서리)
        Product.ProductType type = detectProductType(q);

        // 2) 특성 감지(키보드 한정). 종류 미지정인데 특성만 있으면 키보드로 간주.
        String matchedLabel = null;
        String keyword = null;
        if (type == null || type == Product.ProductType.KEYBOARD) {
            for (RecKeyword rk : RECOMMEND_KEYWORDS) {
                if (rk.pattern().matcher(q).find()) {
                    matchedLabel = rk.label();
                    keyword = rk.nameKeyword();
                    break;
                }
            }
            if (type == null && keyword != null) {
                type = Product.ProductType.KEYBOARD;
            }
        }

        // 3) 종류·특성 모두 없음(="상품 추천"/"상품 문의") → 상품 카테고리 선택 패널
        if (type == null) {
            return ChatbotResponse.builder()
                    .answer("어떤 상품을 찾으시나요? 아래에서 골라 주세요 😊")
                    .intent("RECOMMEND").showAgent(false)
                    .sources(List.of()).cached(false)
                    .quickButtons(PRODUCT_CATEGORY_BUTTONS)
                    .build();
        }

        // 4) 종류 카드 조회 (특성 키워드 + 0건 폴백)
        List<Product> found = productRepository.findRecommendations(
                type, keyword, PageRequest.of(0, RECOMMEND_LIMIT));
        boolean fellBack = false;
        if (found.isEmpty() && keyword != null) {
            found = productRepository.findRecommendations(
                    type, null, PageRequest.of(0, RECOMMEND_LIMIT));
            fellBack = true;
        }
        if (found.isEmpty()) {
            return ChatbotResponse.builder()
                    .answer("지금 추천드릴 상품을 찾지 못했어요. 상품 목록에서 직접 둘러봐 주세요!")
                    .intent("RECOMMEND").showAgent(false)
                    .sources(List.of()).cached(false).build();
        }

        // 5) 상황별 인트로 + 카드
        String label = typeLabel(type);
        String intro;
        if (matchedLabel != null && !fellBack) {
            intro = "'" + matchedLabel + "' " + label + " 위주로 골라봤어요! 카드의 '상품 보기'로 자세히 확인하실 수 있어요 😊";
        } else if (matchedLabel != null) {
            intro = "'" + matchedLabel + "' " + label + "는 지금 딱 맞는 게 없어서, 대신 인기 " + label + "를 보여드릴게요!";
        } else {
            intro = "추천 " + label + "를 보여드릴게요! 카드의 '상품 보기'를 누르면 자세히 확인하실 수 있어요 😊";
        }

        return ChatbotResponse.builder()
                .answer(intro).intent("RECOMMEND").showAgent(false)
                .sources(List.of()).cached(false)
                .products(toCards(found))
                .build();
    }

    /** 질문에서 상품 종류 추출(키보드 우선). 못 찾으면 null. */
    private Product.ProductType detectProductType(String q) {
        if (q.contains("키보드")) return Product.ProductType.KEYBOARD;
        if (q.contains("키캡")) return Product.ProductType.KEYCAP;
        if (q.contains("스위치")) return Product.ProductType.SWITCH_PART;
        if (q.contains("악세서리") || q.contains("악세사리")
                || q.contains("액세서리") || q.contains("엑세서리")) return Product.ProductType.ACCESSORY;
        return null;
    }

    /** 종류 → 사용자 표기. */
    private String typeLabel(Product.ProductType type) {
        return switch (type) {
            case KEYCAP -> "키캡";
            case SWITCH_PART -> "스위치";
            case ACCESSORY -> "악세서리";
            default -> "키보드";
        };
    }

    /** Product 리스트 → 프론트 카드 리스트. */
    private List<ChatbotResponse.ProductCard> toCards(List<Product> products) {
        List<ChatbotResponse.ProductCard> cards = new ArrayList<>();
        for (Product p : products) {
            cards.add(ChatbotResponse.ProductCard.builder()
                    .id(p.getId())
                    .name(p.getName())
                    .price(p.getPrice())
                    .imageUrl(p.getImageUrl())
                    .brand(p.getBrand() != null ? p.getBrand().getName() : null)
                    .build());
        }
        return cards;
    }

    /** 인식 불가/모호 시 대표 문의 버튼 패널. */
    private ChatbotResponse helpPanel(String message) {
        return ChatbotResponse.builder()
                .answer(message).intent("HELP").showAgent(false)
                .sources(List.of()).cached(false)
                .quickButtons(HELP_CATEGORY_BUTTONS)
                .build();
    }

    // ── 키워드 스코어링 ──────────────────────────────────────────────────
    /** question 토큰 가산에서 제외할 흔한 불용어(변별력 없음 → 노이즈 유발). */
    private static final java.util.Set<String> STOPWORDS = java.util.Set.of(
            "키보드", "추천", "뭐야", "뭔가요", "뭔지", "어때", "어떤", "어떻게", "알려줘", "있어", "있나요",
            "해줘", "해주세요", "좋은", "좋아", "차이", "중에", "뭐가", "이거", "그거", "대해", "관련",
            "주세요", "건가요", "인가요", "건데", "는데", "나아", "나은", "될까", "될까요", "수도", "게"
    );

    /**
     * 각 Q&A 의 keywords/question 에 사용자 질문이 얼마나 겹치는지 점수화.
     *  - keyword 가 질문에 완전 포함되면 +2 (핵심 신호) — 매칭 키워드 수도 카운트
     *  - Q&A question 의 토큰(불용어·1글자 제외)이 질문에 포함되면 +1 (보조)
     * 채택 조건: score >= 2 AND 완전 매칭 키워드 >= 1
     *   → "키보드/추천" 같은 흔한 토큰만 1점씩 쌓인 노이즈 Q&A 를 후보에서 배제.
     * RAG 특성상 1순위를 완벽히 맞히기보다 정답을 top-N 안에 넣는 것이 목표
     * (최종 선택은 Gemini 가 컨텍스트에서 수행).
     */
    private List<ScoredQa> rankByKeyword(String question) {
        String q = question.toLowerCase();
        List<ChatbotQa> all = qaRepository.findAll();
        List<ScoredQa> scored = new ArrayList<>();

        for (ChatbotQa qa : all) {
            int score = 0;
            int matchedKeywords = 0;
            for (String kw : qa.getKeywordList()) {
                if (kw.isBlank()) continue;
                String k = kw.toLowerCase();
                if (q.contains(k)) {
                    score += 2;
                    matchedKeywords++;
                }
            }
            // 질문 자체 토큰 일부가 겹치면 가산(불용어·1글자 제외)
            for (String token : qa.getQuestion().toLowerCase().split("[\\s?!.,]+")) {
                if (token.length() >= 2 && !STOPWORDS.contains(token) && q.contains(token)) {
                    score += 1;
                }
            }
            // 채택: 최소 점수 2 + 키워드 완전 매칭 1개 이상(흔한 토큰만 쌓인 노이즈 제거)
            if (score >= 2 && matchedKeywords >= 1) {
                scored.add(new ScoredQa(qa, score));
            }
        }
        scored.sort(Comparator.comparingInt((ScoredQa s) -> s.score).reversed());
        return scored;
    }

    // ── Gemini 시스템 지시문 구성 (RAG 컨텍스트 주입) ─────────────────────
    private String buildSystemInstruction(List<ScoredQa> top) {
        StringBuilder ctx = new StringBuilder();
        ctx.append("당신은 기계식 키보드 쇼핑몰 '스웨크론(SWACHRON)'의 친절한 상담 도우미 '크론이'입니다.\n");
        ctx.append("답변 첫 문장은 \"안녕하세요! 스웨크론 상담 도우미 크론이입니다.\"로 시작한 뒤 본론을 이어가세요.\n");
        ctx.append("아래 [참고 자료]를 근거로 사용자 질문에 한국어로 답하세요.\n");
        ctx.append("규칙:\n");
        ctx.append("- 참고 자료에 있는 내용을 바탕으로 자연스럽고 간결하게(2~4문장) 답합니다.\n");
        ctx.append("- 참고 자료로 답할 수 없는 질문이면 모른다고 솔직히 말하고 고객센터(010-6824-7715)를 안내합니다.\n");
        ctx.append("- 가격/재고/주문 같은 실시간 정보는 단정하지 말고 '쇼핑몰에서 확인'하도록 안내합니다.\n");
        ctx.append("- 친근하되 과한 이모지는 피하고, 키보드 입문자도 이해할 수 있게 설명합니다.\n\n");
        ctx.append("[참고 자료]\n");
        int idx = 1;
        for (ScoredQa sq : top) {
            ctx.append(idx++).append(") Q: ").append(sq.qa.getQuestion()).append("\n");
            ctx.append("   A: ").append(sq.qa.getAnswer()).append("\n");
        }
        return ctx.toString();
    }

    // ── 미답변 로깅 ──────────────────────────────────────────────────────
    private void logUnknown(String question, String reason, int topScore) {
        try {
            unknownLogRepository.save(UnknownQueryLog.of(question, reason, topScore));
        } catch (Exception e) {
            log.warn("[Chatbot] 미답변 로그 저장 실패(무시): {}", e.getMessage());
        }
    }

    /** 캐시 키 정규화: 공백 압축 + 소문자 + 끝 구두점 제거. */
    private String normalize(String s) {
        return s.toLowerCase().replaceAll("\\s+", " ").replaceAll("[?!.~]+$", "").trim();
    }

    // ── 내부 점수 보관 ───────────────────────────────────────────────────
    private static class ScoredQa {
        final ChatbotQa qa;
        final int score;
        ScoredQa(ChatbotQa qa, int score) { this.qa = qa; this.score = score; }
    }
}
