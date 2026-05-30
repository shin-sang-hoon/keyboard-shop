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

    /**
     * 닉네임 (V23). NULL 허용 — 미설정 가능.
     * 로그인/헤더 표시: 닉네임 있으면 "이름(닉네임)", 없으면 "이름"만. displayName() 참고.
     */
    @Column(length = 50)
    private String nickname;

    /**
     * 휴대폰 번호 (V23). 회원가입 시 입력받았으나 그동안 컬럼 미보존이었던 것을 신설.
     * 형식 강제 없이 문자열 보관 (하이픈 유무 무관).
     */
    @Column(length = 20)
    private String phone;

    /**
     * 배송 주소 — 우편번호 (V23, Daum 우편번호 서비스 자동 입력).
     */
    @Column(length = 10)
    private String zipcode;

    /**
     * 배송 주소 — 기본 주소 (V23, Daum 자동 입력).
     */
    @Column(length = 255)
    private String address;

    /**
     * 배송 주소 — 상세 주소 (V23, 동/호수/층 등 사용자 직접 입력).
     */
    @Column(name = "address_detail", length = 255)
    private String addressDetail;

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

    /**
     * 관리자 메모 (V23). 관리자단에서만 입력/노출 — 회원 관리용 내부 메모.
     * 사용자단 응답 DTO 에는 절대 노출하지 않음 (관리자 신뢰 경계).
     */
    @Column(name = "admin_memo", length = 500)
    private String adminMemo;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    /**
     * 최종 접속 시각 (V23). 로그인 성공 시 recordLogin() 으로 갱신.
     * 관리자단 회원 상세에서 읽기전용 노출.
     */
    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;

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
    // 표시용 (닉네임 규칙)
    // ------------------------------------------------------------------------

    /**
     * 화면 표시 이름 (V23). 닉네임이 있으면 "이름(닉네임)", 없으면 "이름".
     * 헤더/로그인 인사말 등에서 사용. 공백 닉네임은 미설정으로 간주.
     */
    public String displayName() {
        if (this.nickname != null && !this.nickname.isBlank()) {
            return this.name + "(" + this.nickname + ")";
        }
        return this.name;
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

    /** 소셜(카카오 등) 계정 여부 — 비밀번호 변경 불가 분기 등에 사용. */
    public boolean isSocial() {
        return this.provider != null && this.provider != Provider.LOCAL;
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

    // ------------------------------------------------------------------------
    // 프로필 수정 (V23, 도메인 응집)
    // ------------------------------------------------------------------------

    /**
     * 공통 프로필 수정 (V23). 닉네임/휴대폰/주소 3종을 한 번에 반영.
     * 사용자단·관리자단 양쪽에서 사용. 이름/이메일/권한/상태는 변경하지 않음.
     * 빈 문자열은 NULL 로 정규화하여 "미설정" 과 일관되게 저장.
     */
    public void updateProfile(String nickname, String phone,
                              String zipcode, String address, String addressDetail) {
        this.nickname      = normalize(nickname);
        this.phone         = normalize(phone);
        this.zipcode       = normalize(zipcode);
        this.address       = normalize(address);
        this.addressDetail = normalize(addressDetail);
    }

    /**
     * 비밀번호 변경 (V23). 이미 인코딩된 해시를 받아 저장 (인코딩은 서비스 책임).
     * LOCAL 계정만 호출 — 서비스 레이어에서 provider 가드.
     */
    public void changePassword(String encodedPassword) {
        this.password = encodedPassword;
    }

    /**
     * 이름 수정 (V23, 관리자 전용). 사용자단에서는 이름 고정 — 호출 금지.
     */
    public void changeName(String name) {
        if (name != null && !name.isBlank()) {
            this.name = name;
        }
    }

    /**
     * 관리자 메모 수정 (V23, 관리자 전용). 빈 문자열은 NULL 정규화.
     */
    public void updateAdminMemo(String memo) {
        this.adminMemo = normalize(memo);
    }

    /**
     * 최종 접속 시각 갱신 (V23). 로그인 성공 시 호출.
     */
    public void recordLogin() {
        this.lastLoginAt = LocalDateTime.now();
    }

    /** 빈 문자열/공백을 NULL 로 정규화 (미설정과 일관 저장). */
    private static String normalize(String v) {
        if (v == null) return null;
        String t = v.trim();
        return t.isEmpty() ? null : t;
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
