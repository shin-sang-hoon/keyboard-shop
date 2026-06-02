package backend.dto.chatbot;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.util.List;

/**
 * 챗봇 응답 DTO (프론트로 반환).
 *
 *  - answer     : 사용자에게 보여줄 답변 텍스트
 *  - intent     : 분류된 의도(GREETING/ANGRY/VAGUE/FAQ) — 프론트 UI 분기용
 *  - showAgent  : 상담원 연결 버튼 노출 여부(불만/폴백 시 true)
 *  - sources    : 답변 근거가 된 Q&A id 목록(투명성·디버깅용, 없으면 빈 리스트)
 *  - cached     : Redis 캐시에서 반환된 답변인지(응답속도 지표·디버깅용)
 */
@Getter
@Builder
@AllArgsConstructor
public class ChatbotResponse {

    private final String answer;
    private final String intent;
    private final boolean showAgent;
    private final List<String> sources;
    private final boolean cached;

    public static ChatbotResponse direct(String answer, String intent, boolean showAgent) {
        return ChatbotResponse.builder()
                .answer(answer)
                .intent(intent)
                .showAgent(showAgent)
                .sources(List.of())
                .cached(false)
                .build();
    }
}
