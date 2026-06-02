package backend.service.chatbot;

/**
 * 챗봇 LLM 호출 추상화 — 외부 LLM 의존성을 인터페이스로 격리한다.
 *
 * 구현체를 갈아끼우면(GeminiChatbotClient → Claude/Groq 등) ChatbotService 코드는
 * 그대로 둔 채 LLM 제공자를 교체할 수 있다. 현재 구현: GeminiChatbotClient(무료 티어).
 */
public interface ChatbotLlmClient {

    /**
     * 시스템 지시 + 사용자 메시지를 받아 자연어 답변을 생성한다.
     *
     * @param systemInstruction 역할·말투·제약 + RAG 컨텍스트(매칭된 Q&A) 가 담긴 지시문
     * @param userMessage       사용자 원문 질문
     * @return LLM 이 생성한 답변 텍스트. 호출 실패 시 빈 Optional 대신 예외를 던지지 않고
     *         null 을 반환할 수 있으며, 서비스 레이어에서 폴백 처리한다.
     */
    String generate(String systemInstruction, String userMessage);
}
