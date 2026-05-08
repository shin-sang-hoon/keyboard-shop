package backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "users",
    indexes = {
        // 카카오 로그인 시 (provider, providerId) 로 빠른 조회
        @Index(name = "idx_user_provider", columnList = "provider,provider_id")
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

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
        if (this.provider == null) {
            this.provider = Provider.LOCAL;
        }
    }

    public enum Role {
        USER, ADMIN
    }

    public enum Provider {
        LOCAL, KAKAO
        // 향후 GOOGLE, NAVER 추가 가능
    }
}
