package backend.service.chatbot;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

/**
 * Gemini(무료 티어) 기반 LLM 클라이언트.
 *
 * REST: POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 *       헤더 x-goog-api-key: ${GEMINI_API_KEY}
 *       body { systemInstruction, contents:[{role,parts:[{text}]}], generationConfig }
 *
 * 응답: candidates[0].content.parts[*].text 를 이어붙여 추출.
 *
 * RestClient 사용(Spring 6.1+/부트 3.2+, spring-boot-starter-web 에 포함 — webflux 불필요).
 * 키/모델/엔드포인트는 application.properties 로 외부화(환경변수 GEMINI_API_KEY).
 * 호출 실패(타임아웃·4xx·5xx·파싱 실패)는 예외를 삼키고 null 반환 → ChatbotService 가 폴백.
 */
@Component
@Slf4j
public class GeminiChatbotClient implements ChatbotLlmClient {

    private final RestClient restClient;
    private final String apiKey;
    private final String model;
    private final double temperature;
    private final int maxOutputTokens;

    /** 마지막 Gemini 호출 성공 여부 — 프론트 온라인/오프라인 점 판정용. 초기 true(미호출=가용 가정). */
    private volatile boolean lastCallOk = true;

    public GeminiChatbotClient(
            @Value("${chatbot.gemini.base-url:https://generativelanguage.googleapis.com}") String baseUrl,
            @Value("${chatbot.gemini.api-key:${GEMINI_API_KEY:}}") String apiKey,
            @Value("${chatbot.gemini.model:gemini-2.5-flash}") String model,
            @Value("${chatbot.gemini.temperature:0.4}") double temperature,
            @Value("${chatbot.gemini.max-output-tokens:512}") int maxOutputTokens) {
        this.restClient = RestClient.builder().baseUrl(baseUrl).build();
        this.apiKey = apiKey;
        this.model = model;
        this.temperature = temperature;
        this.maxOutputTokens = maxOutputTokens;
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("[Gemini] API 키 미설정 — GEMINI_API_KEY 환경변수를 확인하세요. (호출 시 폴백 동작)");
        }
    }

    @Override
    public String generate(String systemInstruction, String userMessage) {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("[Gemini] API 키 없음 → null 반환(폴백)");
            return null;
        }

        // 요청 바디: systemInstruction(역할/컨텍스트) + contents(사용자 메시지)
        Map<String, Object> body = Map.of(
                "systemInstruction", Map.of(
                        "parts", List.of(Map.of("text", systemInstruction))
                ),
                "contents", List.of(Map.of(
                        "role", "user",
                        "parts", List.of(Map.of("text", userMessage))
                )),
                "generationConfig", Map.of(
                        "temperature", temperature,
                        "maxOutputTokens", maxOutputTokens
                )
        );

        String path = "/v1beta/models/" + model + ":generateContent";

        try {
            JsonNode resp = restClient.post()
                    .uri(path)
                    .header("x-goog-api-key", apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(JsonNode.class);

            String text = extractText(resp);
            lastCallOk = (text != null);   // 호출+파싱 성공 여부 기록(health 점)
            return text;
        } catch (Exception e) {
            lastCallOk = false;
            log.warn("[Gemini] 호출 실패: {} → null 반환(폴백)", e.getMessage());
            return null;
        }
    }

    /**
     * 챗봇 LLM 가용 상태 — 프론트 온라인/오프라인 점 판정.
     * API 키가 설정돼 있고 마지막 호출이 실패하지 않았으면 true.
     * (키 미설정 / 직전 호출 실패·타임아웃 → false → 프론트 빨간 점)
     */
    public boolean isHealthy() {
        return apiKey != null && !apiKey.isBlank() && lastCallOk;
    }

    /** candidates[0].content.parts[*].text 를 이어붙여 반환. 없으면 null. */
    private String extractText(JsonNode resp) {
        if (resp == null) return null;
        JsonNode candidates = resp.path("candidates");
        if (!candidates.isArray() || candidates.isEmpty()) {
            log.warn("[Gemini] candidates 비어있음: {}", resp.toString());
            return null;
        }
        JsonNode parts = candidates.get(0).path("content").path("parts");
        if (!parts.isArray() || parts.isEmpty()) return null;

        StringBuilder sb = new StringBuilder();
        for (JsonNode p : parts) {
            String t = p.path("text").asText("");
            if (!t.isEmpty()) sb.append(t);
        }
        String out = sb.toString().trim();
        return out.isEmpty() ? null : out;
    }
}
