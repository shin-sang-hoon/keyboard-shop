package backend.repository;

import backend.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * User 도메인 Repository.
 *
 * 5-B Day 2 (2026-05-09):
 *  - findByProviderAndProviderId 추가 (카카오 OAuth 로그인용).
 *
 * 7-G 라운드 4 (2026-05-24):
 *  - findAll(Pageable) 은 JpaRepository 기본 제공 (회원 목록 페이징).
 *  - findByProvider(Provider, Pageable) 추가 (Provider 필터).
 *  - countByRole(Role) 추가 — "마지막 ADMIN 강등 방지" 불변식 검증용.
 *
 * 인덱스 매칭:
 *  User 엔티티의 idx_user_provider (provider, provider_id) 인덱스가
 *  findByProviderAndProviderId 의 WHERE 절 컬럼 순서와 정확히 매칭되어
 *  카카오 로그인 시 풀스캔 없이 인덱스 lookup 으로 동작.
 *  findByProvider 도 동일 인덱스의 선행 컬럼(provider)만 사용 → 인덱스 활용.
 */
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    /**
     * 소셜 로그인 식별자 페어로 유저 조회.
     * 카카오 OAuth 콜백에서 (KAKAO, "카카오회원번호") 로 호출.
     */
    Optional<User> findByProviderAndProviderId(User.Provider provider, String providerId);

    /**
     * Provider 별 회원 목록 (페이징). 7-G 라운드 4 관리자 회원 관리.
     * Provider 필터가 '전체' 가 아닐 때만 호출 (AdminUserService 분기).
     */
    Page<User> findByProvider(User.Provider provider, Pageable pageable);

    /**
     * role 별 회원 수. 7-G 라운드 4 "마지막 ADMIN 강등 방지" 불변식.
     * ADMIN→USER 강등 직전 countByRole(ADMIN) == 1 이면 차단.
     */
    long countByRole(User.Role role);
}
