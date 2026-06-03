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
    /** 캐시 키 접두사. */
    private static final String CACHE_PREFIX = "chatbot:answer:";

    private static final String FALLBACK_REPLY =
            "죄송해요, 그 질문은 제가 정확히 답변드리기 어렵네요. " +
            "스위치·배열·키캡·브랜드·가격·3D 빌더 관련해서 다시 질문해 주시거나, " +
            "자세한 상담은 고객센터(010-6824-7715)로 문의해 주세요.";

    public ChatbotResponse answer(String rawQuestion) {
        String question = (rawQuestion == null) ? "" : rawQuestion.strip();
        if (question.isEmpty()) {
            return ChatbotResponse.direct(
                    "궁금한 점을 입력해 주세요! 스위치, 배열, 키캡, 브랜드, 가격, 3D 빌더 무엇이든 좋아요 😊",
                    "VAGUE", false);
        }

        // 1) 의도 분기 (캐시보다 먼저 — RECOMMEND/ANGRY 등은 캐시를 타지 않음)
        IntentClassifier.IntentResult intent = intentClassifier.classify(question);
        switch (intent.getIntent()) {
            case ANGRY -> {
                logUnknown(question, "ANGRY", 0);
                return ChatbotResponse.direct(intent.getDirectReply(), "ANGRY", true);
            }
            case VAGUE -> {
                return ChatbotResponse.direct(intent.getDirectReply(), "VAGUE", false);
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
            return ChatbotResponse.builder()
                    .answer(FALLBACK_REPLY).intent("FAQ").showAgent(true)
                    .sources(List.of()).cached(false).build();
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
     * 추천 의도일 때 ACTIVE 키보드 대표 상품을 카드로 반환(캐시 안 탐 — 상품은 가변이라).
     * 컬럼이 대부분 NULL이라 일단 전체 키보드에서 GLB 보유·id 순 상위 N개를 보여준다(B).
     * (C 특성 추천에서 keyword 로 name LIKE 필터를 추가할 예정.)
     */
    private ChatbotResponse recommendProducts(String question) {
        List<Product> found = productRepository.findRecommendations(
                Product.ProductType.KEYBOARD, null, PageRequest.of(0, RECOMMEND_LIMIT));

        if (found.isEmpty()) {
            return ChatbotResponse.builder()
                    .answer("지금 추천드릴 키보드를 찾지 못했어요. 상품 목록에서 직접 둘러봐 주세요!")
                    .intent("RECOMMEND").showAgent(false)
                    .sources(List.of()).cached(false).build();
        }

        List<ChatbotResponse.ProductCard> cards = new ArrayList<>();
        for (Product p : found) {
            cards.add(ChatbotResponse.ProductCard.builder()
                    .id(p.getId())
                    .name(p.getName())
                    .price(p.getPrice())
                    .imageUrl(p.getImageUrl())
                    .brand(p.getBrand() != null ? p.getBrand().getName() : null)
                    .build());
        }

        return ChatbotResponse.builder()
                .answer("마음에 드실 만한 키보드를 골라봤어요! 카드의 '상품 보기'를 누르면 자세히 확인하실 수 있어요 😊")
                .intent("RECOMMEND").showAgent(false)
                .sources(List.of()).cached(false)
                .products(cards)
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
