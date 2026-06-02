package backend.dto.chatbot;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 챗봇 요청 DTO. 프론트에서 사용자 입력 메시지를 담아 전송.
 */
@Getter @Setter
@NoArgsConstructor
public class ChatbotRequest {
    private String message;
}
