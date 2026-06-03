package backend.controller;

import backend.dto.chatbot.ChatbotRequest;
import backend.dto.chatbot.ChatbotResponse;
import backend.service.chatbot.ChatbotService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 챗봇 API.
 *
 *  - POST /api/chatbot/chat   : 사용자 메시지 → RAG 답변(의도분기 + 키워드검색 + Gemini)
 *  - GET  /api/chatbot/health : 서버 상태 핑(프론트가 챗봇 가용성 표시에 사용, MUREAM /health 대응)
 *
 * 비로그인 공개 엔드포인트(SecurityConfig 에서 /api/chatbot/** permitAll).
 * 인증 정보가 필요 없는 FAQ 봇이므로 누구나 사용 가능.
 */
@RestController
@RequestMapping("/api/chatbot")
@RequiredArgsConstructor
public class ChatbotController {

    private final ChatbotService chatbotService;

    @PostMapping("/chat")
    public ResponseEntity<ChatbotResponse> chat(@RequestBody ChatbotRequest request) {
        ChatbotResponse response = chatbotService.answer(request.getMessage());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(Map.of(
                "status", "ok",
                "service", "chatbot",
                "gemini", chatbotService.isLlmHealthy()
        ));
    }
}
