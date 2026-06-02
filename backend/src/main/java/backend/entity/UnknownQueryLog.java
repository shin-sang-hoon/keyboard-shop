package backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 챗봇 미답변/저신뢰 질의 로그.
 *
 * RAG 키워드 검색에서 마땅한 Q&A 를 못 찾았거나(점수 0), LLM 이 폴백한 경우 등
 * "챗봇이 제대로 답하지 못한 질문"을 기록한다.
 *
 * 면접 포인트: 미답변 로그를 주기적으로 분석 → 자주 들어오는데 답 못한 질문을
 * keyboard_qa.json 에 새 Q&A 로 추가 → 챗봇 커버리지가 데이터로 개선되는 선순환.
 * (운영 데이터 기반 지식 베이스 확장 루프)
 */
@Entity
@Table(name = "chatbot_unknown_log", indexes = {
        @Index(name = "idx_unknown_created", columnList = "created_at"),
        @Index(name = "idx_unknown_reason", columnList = "reason")
})
@Getter @Setter
@NoArgsConstructor
public class UnknownQueryLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 사용자가 입력한 원문 질문. */
    @Column(nullable = false, length = 1000)
    private String question;

    /** 미답변으로 분류된 사유. 예: NO_MATCH(검색 0건), LLM_FALLBACK(LLM 응답 실패), LOW_SCORE. */
    @Column(nullable = false, length = 40)
    private String reason;

    /** 키워드 검색 최고 점수(디버깅·임계값 튜닝용). 매칭 0건이면 0. */
    @Column(name = "top_score")
    private int topScore;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }

    public static UnknownQueryLog of(String question, String reason, int topScore) {
        UnknownQueryLog log = new UnknownQueryLog();
        log.question = (question == null) ? "" : (question.length() > 1000 ? question.substring(0, 1000) : question);
        log.reason = reason;
        log.topScore = topScore;
        return log;
    }
}
