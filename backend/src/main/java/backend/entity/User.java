package backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "users",
    indexes = {
        // 카카오 로그인 시 (provider, providerId) 로 빠른 조회
        @Index(name = "idx_user_provider", columnList = "provider,provider_id"),
        // 회원 탈퇴(soft delete) — status 필터 (로그인 가드 / 관리자 회원목록)
        @Index(name = "idx_user_status", columnList = "status")
    }
)
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    /**
     * BCrypt 해시. 카카오/소셜 로그인 유저는 NULL.
     * 기존 LOCAL 유저는 NOT NULL이었으나 5-B 마이그레이션으로 nullable 변경.
     */
    @Column(nullable = true)
    private String password;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    /**
     * 인증 제공자. 5-B 카카오 OAuth 대비.
     * - LOCAL: 이메일/비밀번호 (기본값, 기존 row 모두 LOCAL로 백필)
     * - KAKAO: 카카오 로그인
     * 향후 GOOGLE, NAVER 등 확장 가능.
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Provider provider = Provider.LOCAL;

    /**
     * 소셜 로그인 식별자. LOCAL 유저는 NULL.
     * 카카오는 "카카오 회원번호"가 들어감 (Long → String 변환).
     */
    @Column(name = "provider_id", length = 100)
    private String providerId;

    /**
     * 회원 상태 (회원 탈퇴 soft delete, V20).
     * - ACTIVE: 정상 (기본값, 기존 row 모두 ACTIVE 로 백필)
     * - WITHDRAWN: 탈퇴 처리됨. row 는 보존(이메일 재가입 차단 + 제재 연계),
     *   로그인/refresh 는 status 가드로 차단.
     * DB 는 VARCHAR(20) → @Enumerated(STRING) 으로 매핑 (role/provider 와 동일 패턴).
     * 향후 BANNED(제재) 등 확장 가능 — 7-H 회원 관리 강화.
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Status status = Status.ACTIVE;

    /**
     * 탈퇴 시각. ACTIVE 면 NULL. WITHDRAWN 전이 시 기록.
     */
    @Column(name = "withdrawn_at")
    private LocalDateTime withdrawnAt;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
        if (this.provider == null) {
            this.provider = Provider.LOCAL;
        }
        if (this.status == null) {
            this.status = Status.ACTIVE;
        }
    }

    // ------------------------------------------------------------------------
    // 상태 전이 (도메인 응집 — 상태 변경을 엔티티 안에 모음)
    // ------------------------------------------------------------------------

    /** 정상 회원 여부 (로그인/refresh 가드에서 사용). */
    public boolean isActive() {
        return this.status == Status.ACTIVE;
    }

    /**
     * 회원 탈퇴 (soft delete).
     * status → WITHDRAWN + 탈퇴 시각 기록. 이메일/연관 데이터는 보존.
     * 멱등: 이미 WITHDRAWN 이면 시각만 유지하고 변화 없음.
     */
    public void withdraw() {
        if (this.status == Status.WITHDRAWN) {
            return;
        }
        this.status = Status.WITHDRAWN;
        this.withdrawnAt = LocalDateTime.now();
    }

    public enum Role {
        USER, ADMIN
    }

    public enum Provider {
        LOCAL, KAKAO
        // 향후 GOOGLE, NAVER 추가 가능
    }

    public enum Status {
        ACTIVE, WITHDRAWN
        // 향후 BANNED(제재) 등 확장 가능 — 7-H 회원 관리 강화
    }
}
