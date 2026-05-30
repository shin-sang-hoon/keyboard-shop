package backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * 비밀번호 재설정 토큰 (V21, 5/29).
 *
 * - 비밀번호 찾기 요청 시 1회용 토큰 발급 → 메일로 재설정 링크 전송.
 * - 1회용: usedAt 기록 시 재사용 불가.
 * - 만료: expiresAt 지나면 무효.
 * - user_id FK ON DELETE CASCADE (탈퇴는 soft delete라 실삭제 드묾, 안전망).
 */
@Entity
@Table(
    name = "password_reset_tokens",
    indexes = {
        @Index(name = "idx_prt_user", columnList = "user_id"),
        @Index(name = "idx_prt_expires", columnList = "expires_at")
    }
)
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PasswordResetToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 토큰 소유 유저. LAZY — 검증 시 user.getId()/getEmail() 정도만 사용. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_prt_user"))
    private User user;

    @Column(nullable = false, unique = true, length = 100)
    private String token;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    /** 사용 시각. NULL이면 미사용. 비워있지 않으면 재사용 차단. */
    @Column(name = "used_at")
    private LocalDateTime usedAt;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
    }

    /** 만료 여부. */
    public boolean isExpired() {
        return this.expiresAt.isBefore(LocalDateTime.now());
    }

    /** 이미 사용됨 여부. */
    public boolean isUsed() {
        return this.usedAt != null;
    }

    /** 검증 통과 가능 여부 (미사용 + 미만료). */
    public boolean isValid() {
        return !isUsed() && !isExpired();
    }

    /** 사용 처리 (1회용 소멸). */
    public void markUsed() {
        this.usedAt = LocalDateTime.now();
    }
}
