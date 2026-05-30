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
        // 회원 탈퇴(soft delete) / 제재(정지) — status 필터 (로그인 가드 / 관리자 회원목록)
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
     * 회원 상태 (soft delete + 제재). V20 -> V22 확장.
     * - ACTIVE:    정상 (기본값, 기존 row 모두 ACTIVE 로 백필)
     * - SUSPENDED: 관리자 제재로 정지됨. row/연관데이터 보존, 로그인/refresh 차단(403).
     *              해제(unsuspend) 시 ACTIVE 복귀. suspendedAt/suspendReason 기록.
     * - WITHDRAWN: 본인 탈퇴 처리됨. row 보존(이메일 재가입 차단), 로그인/refresh 차단.
     * DB 는 VARCHAR(20) -> @Enumerated(STRING) 매핑 (role/provider 와 동일 패턴).
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Status status = Status.ACTIVE;

    /**
     * 탈퇴 시각. ACTIVE/SUSPENDED 면 NULL. WITHDRAWN 전이 시 기록.
     */
    @Column(name = "withdrawn_at")
    private LocalDateTime withdrawnAt;

    /**
     * 정지 시각 (V22). 정지 해제 시 NULL 복귀. withdrawnAt 과 대칭.
     */
    @Column(name = "suspended_at")
    private LocalDateTime suspendedAt;

    /**
     * 정지 사유 (V22, 제재 이력). 정지 해제 시 NULL 복귀.
     */
    @Column(name = "suspend_reason", length = 255)
    private String suspendReason;

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

    /** 정지 회원 여부. */
    public boolean isSuspended() {
        return this.status == Status.SUSPENDED;
    }

    /** 탈퇴 회원 여부. */
    public boolean isWithdrawn() {
        return this.status == Status.WITHDRAWN;
    }

    /**
     * 회원 탈퇴 (soft delete).
     * status -> WITHDRAWN + 탈퇴 시각 기록. 이메일/연관 데이터는 보존.
     * 멱등: 이미 WITHDRAWN 이면 시각만 유지하고 변화 없음.
     */
    public void withdraw() {
        if (this.status == Status.WITHDRAWN) {
            return;
        }
        this.status = Status.WITHDRAWN;
        this.withdrawnAt = LocalDateTime.now();
    }

    /**
     * 회원 정지 (관리자 제재, V22). withdraw() 와 대칭.
     * status -> SUSPENDED + 정지 시각/사유 기록.
     * 멱등: 이미 SUSPENDED 면 사유만 갱신(재정지 시 최신 사유 반영).
     *
     * @param reason 정지 사유 (관리자 입력, null 허용 — 사유 미입력 정지 가능)
     */
    public void suspend(String reason) {
        this.status = Status.SUSPENDED;
        this.suspendedAt = LocalDateTime.now();
        this.suspendReason = reason;
    }

    /**
     * 정지 해제 (V22). status -> ACTIVE 복귀 + 정지 메타데이터 청산.
     * 멱등: 이미 ACTIVE 면 메타데이터만 NULL 보장.
     * 주의: WITHDRAWN(탈퇴) 계정엔 호출 금지 — 서비스 레이어에서 가드.
     */
    public void unsuspend() {
        this.status = Status.ACTIVE;
        this.suspendedAt = null;
        this.suspendReason = null;
    }

    public enum Role {
        USER, ADMIN
    }

    public enum Provider {
        LOCAL, KAKAO
        // 향후 GOOGLE, NAVER 추가 가능
    }

    public enum Status {
        ACTIVE,     // 정상
        SUSPENDED,  // 관리자 제재로 정지 (V22)
        WITHDRAWN   // 본인 탈퇴 (V20)
    }
}
