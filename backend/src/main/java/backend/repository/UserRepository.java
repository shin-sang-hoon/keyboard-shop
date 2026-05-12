package backend.repository;

import backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * User 도메인 Repository.
 *
 * 5-B Day 2 (2026-05-09):
 *  - findByProviderAndProviderId 추가 (카카오 OAuth 로그인용).
 *
 * 인덱스 매칭:
 *  User 엔티티의 idx_user_provider (provider, provider_id) 인덱스가
 *  findByProviderAndProviderId 의 WHERE 절 컬럼 순서와 정확히 매칭되어
 *  카카오 로그인 시 풀스캔 없이 인덱스 lookup 으로 동작.
 */
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    /**
     * 소셜 로그인 식별자 페어로 유저 조회.
     * 카카오 OAuth 콜백에서 (KAKAO, "카카오회원번호") 로 호출.
     */
    Optional<User> findByProviderAndProviderId(User.Provider provider, String providerId);
}
