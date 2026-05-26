package backend.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 리뷰 신고 엔티티 (7-G R8).
 *
 * 도메인:
 *  - 사용자가 부적절한 리뷰를 신고 → 관리자가 신고 큐에서 처리(숨김) / 기각
 *  - 1 사용자 = 1 리뷰당 1 신고 (UNIQUE(review_id, reporter_id)) — 중복 신고 방지
 *  - 본인 리뷰는 신고 불가 (Service 에서 검증)
 *
 * 설계 결정:
 *  - reason / status: @Enumerated(STRING) — DB 에 enum 이름 그대로 저장 (가독성 + 순서 변경 안전)
 *  - 단방향 ManyToOne (Review/User 엔티티 수정 없음) — 기존 A2/A4 패턴 일관
 *  - fk_report_review ON DELETE CASCADE — 리뷰가 hard delete 되면 신고도 함께 정리
 *  - handledBy / handledAt nullable — PENDING 상태에서는 미처리
 *  - 중첩 enum (ReportReason/ReportStatus) — Order.OrderStatus / User.Role 과 동일 패턴
 *
 * 상태 전이:
 *  PENDING ──resolve()──▶ RESOLVED  (+ 대상 리뷰 hidden=true)
 *  PENDING ──dismiss()──▶ DISMISSED (리뷰는 그대로 노출)
 *  (RESOLVED / DISMISSED 에서 재처리 불가 — Service 가 검증)
 *
 * V16__add_review_hidden_and_reports.sql 로 review_reports 테이블 생성.
 */
@Entity
@Table(
    name = "review_reports",
    uniqueConstraints = {
        @UniqueConstraint(name = "uk_review_report", columnNames = {"review_id", "reporter_id"})
    },
    indexes = {
        @Index(name = "idx_report_status", columnList = "status"),
        @Index(name = "idx_report_review", columnList = "review_id")
    }
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class ReviewReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 신고 대상 리뷰 */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "review_id", nullable = false)
    private Review review;

    /** 신고자 */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reporter_id", nullable = false)
    private User reporter;

    /** 신고 사유 분류 */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ReportReason reason;

    /** 신고자 추가 설명 (선택) */
    @Column(length = 500)
    private String detail;

    /** 처리 상태 — 신규 신고는 PENDING */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private ReportStatus status = ReportStatus.PENDING;

    /** 처리한 관리자 — PENDING 상태면 null */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "handled_by")
    private User handledBy;

    /** 처리 시각 — PENDING 상태면 null */
    @Column(name = "handled_at")
    private LocalDateTime handledAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        if (this.status == null) {
            this.status = ReportStatus.PENDING;
        }
    }

    // ─────────────────────────────────────────────────────
    // 도메인 메서드 — 상태 전이 (dirty checking 으로 UPDATE 자동 발행)
    // ─────────────────────────────────────────────────────

    /** 신고 인용 — RESOLVED 처리. 대상 리뷰 숨김은 Service 가 별도 수행 */
    public void resolve(User admin) {
        this.status = ReportStatus.RESOLVED;
        this.handledBy = admin;
        this.handledAt = LocalDateTime.now();
    }

    /** 신고 기각 — DISMISSED 처리. 리뷰는 그대로 노출 */
    public void dismiss(User admin) {
        this.status = ReportStatus.DISMISSED;
        this.handledBy = admin;
        this.handledAt = LocalDateTime.now();
    }

    public boolean isPending() {
        return this.status == ReportStatus.PENDING;
    }

    // ─────────────────────────────────────────────────────
    // 중첩 enum
    // ─────────────────────────────────────────────────────

    /** 신고 사유 — 한국 쇼핑몰 표준 분류 */
    public enum ReportReason {
        SPAM,        // 스팸/광고
        ABUSE,       // 욕설/비방
        ADULT,       // 음란성
        FALSE_INFO,  // 허위정보
        ETC          // 기타
    }

    /** 신고 처리 상태 */
    public enum ReportStatus {
        PENDING,     // 처리 대기
        RESOLVED,    // 인용 (리뷰 숨김 처리)
        DISMISSED    // 기각
    }
}
