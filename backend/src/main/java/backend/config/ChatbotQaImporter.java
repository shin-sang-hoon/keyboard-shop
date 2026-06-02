package backend.config;

import backend.entity.ChatbotQa;
import backend.repository.ChatbotQaRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.util.List;
import java.util.Map;

/**
 * 챗봇 Q&A 적재기 — 기동 시 classpath:data/keyboard_qa.json (200개) 을 chatbot_qa 테이블에 적재.
 *
 * 정책:
 *   - 이미 적재돼 있으면(count > 0) 건너뜀 — 재기동마다 중복 적재 방지.
 *   - 강제 재적재가 필요하면 DB 에서 TRUNCATE chatbot_qa 후 재기동.
 *   - ddl-auto=validate 이므로 chatbot_qa 테이블은 수동 생성(V27) 선행 필요.
 *
 * JSON 스키마: [{ id, category, question, answer, keywords:[...] }, ...]
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ChatbotQaImporter implements ApplicationRunner {

    private final ChatbotQaRepository repository;
    private final ObjectMapper objectMapper;

    private static final String JSON_PATH = "data/keyboard_qa.json";

    @Override
    public void run(ApplicationArguments args) throws Exception {
        long existing = repository.count();
        if (existing > 0) {
            log.info("[ChatbotQaImporter] 이미 적재됨 ({}개) — 건너뜀", existing);
            return;
        }

        ClassPathResource resource = new ClassPathResource(JSON_PATH);
        if (!resource.exists()) {
            log.warn("[ChatbotQaImporter] {} 없음 — 적재 생략", JSON_PATH);
            return;
        }

        try (InputStream is = resource.getInputStream()) {
            // JSON 배열 → List<Map> 으로 읽어 엔티티로 변환(keywords 배열을 콤마조인으로 저장)
            List<Map<String, Object>> rows = objectMapper.readValue(
                    is, new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() {});

            int saved = 0;
            for (Map<String, Object> row : rows) {
                String id = str(row.get("id"));
                if (id == null || id.isBlank()) continue;

                ChatbotQa qa = new ChatbotQa();
                qa.setId(id);
                qa.setCategory(str(row.get("category")));
                qa.setQuestion(str(row.get("question")));
                qa.setAnswer(str(row.get("answer")));

                Object kw = row.get("keywords");
                if (kw instanceof List<?> list) {
                    qa.setKeywordList(list.stream().map(String::valueOf).toList());
                } else {
                    qa.setKeywordList(List.of());
                }

                repository.save(qa);
                saved++;
            }
            log.info("[ChatbotQaImporter] {}개 적재 완료", saved);
        } catch (Exception e) {
            log.error("[ChatbotQaImporter] 적재 실패: {}", e.getMessage(), e);
        }
    }

    private static String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }
}
