package backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * 관리자 액션 감사 로그.
 *
 * V5__expand_audit_log.sql 마이그레이션으로 컬럼 확장:
 *   - category, event_type: String → ENUM 격상
 *   - target_type, ip_address, user_agent, result, duration_ms: 신규
 *
 * 저장은 @AdminAction 어노테이션 + AuditLogAspect + AuditLogEventListener 경로.
 * 직접 save() 호출하지 말고 어노테이션 사용 권장.
 */
@Entity
@Table(name = "audit_logs", indexes = {
        @Index(name = "idx_audit_admin_created", columnList = "admin_id, created_at"),
        @Index(name = "idx_audit_category_created", columnList = "category, created_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "admin_id")
    private User admin;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "ENUM('PRODUCT','USER','ORDER','CRAWLER','CHATBOT')")
    private AuditCategory category;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false,
            columnDefinition = "ENUM('CREATE','UPDATE','DELETE','BLOCK','UNBLOCK','EXECUTE','VIEW')")
    private AuditEventType eventType;

    @Column(name = "target_type", length = 50)
    private String targetType;

    @Column(name = "target_id")
    private String targetId;

    @Column(columnDefinition = "TEXT")
    private String detail;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "user_agent", length = 500)
    private String userAgent;

    @Column(nullable = false, length = 20)
    private String result;  // SUCCESS / FAILURE

    @Column(name = "duration_ms")
    private Long durationMs;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
        if (this.result == null) this.result = "SUCCESS";
    }
}
