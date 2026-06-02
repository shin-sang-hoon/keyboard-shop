package backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 챗봇 Q&A 항목 (RAG 지식 베이스).
 *
 * keyboard_qa.json (200개) 을 기동 시 ChatbotQaImporter 가 적재한다.
 * 사용자 질문 → keywords 매칭으로 후보 Q&A 를 찾고, 그 question/answer 를
 * 컨텍스트로 Gemini 가 자연어 답변을 생성한다(RAG).
 *
 * 스키마(JSON): { id, category, question, answer, keywords[] }
 *   - id        : "switch_001" 형식 (카테고리 접두사 + 일련번호) → 그대로 PK 로 사용
 *   - category  : switch / layout / brand / price / builder / general
 *   - keywords  : 문자열 배열 → DB 에는 콤마 조인 1컬럼으로 저장(200개 규모, 정규화 대신 단순화).
 *                 getKeywordList()/setKeywordList() 로 List<String> 변환을 캡슐화.
 */
@Entity
@Table(name = "chatbot_qa", indexes = {
        @Index(name = "idx_chatbot_qa_category", columnList = "category")
})
@Getter @Setter
@NoArgsConstructor
public class ChatbotQa {

    /** JSON 의 "switch_001" 같은 문자열 ID 를 그대로 PK 로 사용(자동 생성 아님). */
    @Id
    @Column(length = 40)
    private String id;

    @Column(nullable = false, length = 20)
    private String category;

    @Column(nullable = false, length = 500)
    private String question;

    @Lob
    @Column(nullable = false, columnDefinition = "TEXT")
    private String answer;

    /** 콤마로 조인된 키워드 문자열. 예: "청축,클릭,딸깍,blue,기계식". */
    @Column(name = "keywords", length = 1000)
    private String keywords;

    // ── List<String> ↔ 콤마조인 변환 캡슐화 ──────────────────────────────
    @Transient
    public List<String> getKeywordList() {
        if (keywords == null || keywords.isBlank()) return List.of();
        return Arrays.stream(keywords.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toList());
    }

    public void setKeywordList(List<String> list) {
        if (list == null || list.isEmpty()) {
            this.keywords = "";
        } else {
            this.keywords = list.stream()
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .collect(Collectors.joining(","));
        }
    }
}
