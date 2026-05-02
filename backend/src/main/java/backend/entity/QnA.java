package backend.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 상품 Q&A 엔티티 (5-H A3).
 *
 * 설계 결정:
 *  - 1:1 임베드 패턴 — Question + Answer 한 row 에 (자기참조/완전분리 안 씀)
 *      · 도메인 룰 강제: 1 질문 = 최대 1 판매자 답변 (네이버쇼핑/쿠팡 패턴)
 *      · 추가 질문은 새 row (새 QnA 등록)
 *      · 답변 대기 큐 = WHERE answer_content IS NULL — 단일 쿼리로 미답변 검색
 *  - title 필드 없음 — 한국 쇼핑몰 표준, content 만
 *  - isSecret 비밀글 — DB 는 단순 boolean, 권한 체크는 Service 레이어 (B3)
 *  - 단방향 ManyToOne (user/product/answeredBy 수정 없음) — A2/A4 일관성
 *  - OrderItem FK 없음 — 비구매자도 질문 가능 (Review 와 의도적 차이)
 *  - UNIQUE 없음 — 한 사용자가 같은 상품에 질문 여러 번 가능
 *
 * Review (A2) 와의 의도적 패턴 차이 (면접 자산):
 *   - Review: row 단위 누적 + 별점 통계 → UNIQUE(orderItem) 으로 중복 방지
 *   - QnA: 1:1 매칭이 도메인 정확 → 임베드, UNIQUE 없음
 *   - 같아 보이는 두 도메인을 의미에 따라 다르게 모델링
 */
@Entity
@Table(
    name = "qna",
    indexes = {
        @Index(name = "idx_qna_product", columnList = "product_id"),
        @Index(name = "idx_qna_user", columnList = "user_id"),
        @Index(name = "idx_qna_answered_at", columnList = "answered_at")
    }
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class QnA {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 질문자 */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    /** 질문 내용 */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    /** 비밀글 여부 — true 면 작성자/관리자만 content 조회 가능 (Service 에서 마스킹) */
    @Column(name = "is_secret", nullable = false)
    @Builder.Default
    private Boolean isSecret = false;

    /** 답변자 (관리자/판매자). 미답변 상태면 null */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "answered_by")
    private User answeredBy;

    /** 답변 내용. 미답변 상태면 null. WHERE answer_content IS NULL = 답변 대기 큐 */
    @Column(name = "answer_content", columnDefinition = "TEXT")
    private String answerContent;

    /** 답변 시각. 미답변 상태면 null. answered_at 인덱스로 답변 대기 빠른 조회 */
    @Column(name = "answered_at")
    private LocalDateTime answeredAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
