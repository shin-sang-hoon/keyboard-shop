package backend.service.chatbot;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.regex.Pattern;

/**
 * 챗봇 의도 분류기.
 *
 * 사용자 입력을 LLM 호출 전에 빠르게 분기한다(비용·지연 절감 + 안전장치).
 * MUREAM 팀 프로젝트의 의도 분기 로직(모호 지칭사·감정/불만·부정 표현 감지)을
 * 키보드 쇼핑몰 도메인으로 이식·재작성.
 *
 * 분기 우선순위(위에서부터):
 *   1) ANGRY    — 감정/불만/항의 표현 → 상담원 연결 안내(LLM 거치지 않음)
 *   2) VAGUE    — "그거/이거" 등 모호 지칭사 → 구체적 질문 유도(되묻기)
 *   3) GREETING — 단순 인사 → 정해진 인사 응답
 *   4) FAQ      — 그 외 전부 → RAG(키워드 검색 + Gemini) 파이프라인으로
 *
 * NEGATIVE(부정 표현)는 별도 enum 없이 VAGUE 와 동일하게 되묻기로 흡수.
 */
@Component
@RequiredArgsConstructor
public class IntentClassifier {

    public enum Intent {
        GREETING,   // 인사 → 고정 인사 응답
        ANGRY,      // 감정/불만 → 상담원 연결
        VAGUE,      // 모호 지칭사/부정 표현 → 되묻기
        RECOMMEND,  // 상품 추천 요청 → 추천 카드 (ChatbotService 가 상품 조회)
        FAQ         // 일반 질문 → RAG 파이프라인(기본)
    }

    @Getter
    public static class IntentResult {
        private final Intent intent;
        /** GREETING/ANGRY/VAGUE 처럼 LLM 없이 즉답할 경우의 응답 텍스트. FAQ 면 null. */
        private final String directReply;
        /** 상담원 연결 버튼을 노출할지(ANGRY 일 때 true). */
        private final boolean showAgent;

        public IntentResult(Intent intent, String directReply, boolean showAgent) {
            this.intent = intent;
            this.directReply = directReply;
            this.showAgent = showAgent;
        }

        public static IntentResult faq() {
            return new IntentResult(Intent.FAQ, null, false);
        }
    }

    // ── 감정/불만/항의 표현 (→ 상담원 연결) ──────────────────────────────
    private static final List<Pattern> ANGRY_PATTERNS = List.of(
            Pattern.compile("(내놔|내놓|돌려내|돌려줘|환불해|환불 ?해줘|배상)"),
            Pattern.compile("(사기|거짓말|속았|짜증|화나|열받|어이없|빡쳐|빡침)"),
            Pattern.compile("(왜 ?이래|왜 ?이러|뭐 ?하는|말이 ?돼|말이 ?되|장난해|장난하)"),
            Pattern.compile("(어떻게 ?이래|너무하|황당|당장|빨리 ?내놔|고소|신고할)")
    );

    // ── 모호한 지칭사 (→ 되묻기) ─────────────────────────────────────────
    private static final List<Pattern> VAGUE_PATTERNS = List.of(
            Pattern.compile("^(그거|이거|저거|그것|이것|저것)$"),
            Pattern.compile("^(그거|이거|저거|그것|이것|저것)\\s"),
            Pattern.compile("^(네|아|예|음)\\s.*(그거|이거|저거)"),
            Pattern.compile("^(그|이|저) ?거\\s")
    );

    // ── 부정 표현 (→ 되묻기) ─────────────────────────────────────────────
    private static final List<Pattern> NEGATIVE_PATTERNS = List.of(
            Pattern.compile("(안 ?하고 ?싶|하기 ?싫|안 ?할래|필요 ?없|하지 ?않을|관심 ?없)")
    );

    // ── 단순 인사 ────────────────────────────────────────────────────────
    private static final List<Pattern> GREETING_PATTERNS = List.of(
            Pattern.compile("^(안녕|하이|hi|hello|반가|좋은 ?아침|좋은아침|ㅎㅇ|헬로|할로)"),
            Pattern.compile("^(안녕하세요|안녕하십니까|반갑습니다)")
    );

    // ── 상품 추천 요청 (→ 추천 카드 / 상품 카테고리 패널) ─────────────────
    // "추천/골라줘/뭐가 좋아/뭐 사" + "상품 문의/상품 관련"(상품문의 버튼). ChatbotService 가 분기.
    private static final List<Pattern> RECOMMEND_PATTERNS = List.of(
            Pattern.compile("(추천|골라|뭐가 ?좋|뭐 ?살|뭘 ?살|뭐 ?사|뭘 ?사|사고 ?싶|찾고 ?있|어떤 ?거 ?좋|어떤 ?게 ?좋|상품 ?문의|상품 ?관련)")
    );

    private static final String GREETING_REPLY =
            "안녕하세요! 스웨크론(SWACHRON) 키보드 도우미입니다 ⌨️ " +
            "스위치, 배열, 키캡, 브랜드, 가격, 3D 빌더 등 무엇이든 물어보세요!";

    private static final String VAGUE_REPLY =
            "어떤 점이 궁금하신가요? 스위치(청축/적축 등), 키보드 배열(60/75/TKL), " +
            "키캡, 브랜드(Keychron 등), 가격, 3D 커스텀 빌더처럼 구체적으로 말씀해 주시면 도와드릴게요 😊";

    private static final String AGENT_REPLY =
            "불편을 드려 죄송합니다. 빠르게 도와드리겠습니다. " +
            "상담이 필요하시면 고객센터(010-6824-7715)로 연락 주시거나 아래 상담원 연결을 이용해 주세요.";

    /**
     * 입력을 분류해 IntentResult 반환.
     * @param userInput 사용자 원문(공백 trim 후 매칭)
     */
    public IntentResult classify(String userInput) {
        if (userInput == null) return IntentResult.faq();
        String text = userInput.strip();
        if (text.isEmpty()) return IntentResult.faq();

        // 1) 감정/불만 → 상담원 (최우선: 불만 고객을 LLM 으로 돌리지 않음)
        if (matchesAny(text, ANGRY_PATTERNS)) {
            return new IntentResult(Intent.ANGRY, AGENT_REPLY, true);
        }

        // 2) 모호 지칭사 / 부정 표현 → 되묻기
        if (matchesAny(text, VAGUE_PATTERNS) || matchesAny(text, NEGATIVE_PATTERNS)) {
            return new IntentResult(Intent.VAGUE, VAGUE_REPLY, false);
        }

        // 3) 단순 인사 → 고정 인사 (단, 인사 뒤에 실제 질문이 붙으면 FAQ 로)
        if (matchesAny(text, GREETING_PATTERNS) && isPureGreeting(text)) {
            return new IntentResult(Intent.GREETING, GREETING_REPLY, false);
        }

        // 4) 상품 추천 요청 → 추천 카드 (directReply 없음; ChatbotService 가 상품 조회해서 채움)
        if (matchesAny(text, RECOMMEND_PATTERNS)) {
            return new IntentResult(Intent.RECOMMEND, null, false);
        }

        // 5) 그 외 → RAG 파이프라인
        return IntentResult.faq();
    }

    private boolean matchesAny(String text, List<Pattern> patterns) {
        for (Pattern p : patterns) {
            if (p.matcher(text).find()) return true;
        }
        return false;
    }

    /** 인사말 토큰(공백·구두점 제거 기준). 이걸 걷어낸 뒤 남는 글자가 거의 없으면 순수 인사. */
    private static final Pattern GREETING_TOKENS = Pattern.compile(
            "(안녕하십니까|안녕하세요|반갑습니다|좋은아침|안녕|반가워요|반가워|하이|헬로|할로|hello|hi|ㅎㅇ|요|니다|세요)"
    );

    /**
     * "안녕"처럼 인사말만 있는 입력인지 판단.
     * 인사말 토큰과 구두점을 모두 제거한 뒤 남는 실질 글자가 2자 이하이면 순수 인사로 본다.
     * 예: "안녕"/"안녕하세요!" → 순수 인사(true) / "안녕 청축이 뭐야?" → 잔여="청축이뭐야"(false) → FAQ
     */
    private boolean isPureGreeting(String text) {
        String noPunct = text.replaceAll("[!?.~,\\s]", "");
        String residual = GREETING_TOKENS.matcher(noPunct).replaceAll("");
        return residual.length() <= 2;
    }
}
