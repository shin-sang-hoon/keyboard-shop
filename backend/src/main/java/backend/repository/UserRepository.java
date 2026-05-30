package backend.repository;

import backend.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
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
 * 아이디 찾기 (2026-05-29):
 *  - findByNameAndStatus 추가 — 이름으로 ACTIVE 계정 조회 -> 이메일 마스킹 표시.
 *    동명이인 가능성으로 List 반환.
 *
 * 7-H 회원 관리 강화 (2026-05-30):
 *  - findByStatus(Status, Pageable) 추가 — 관리자 회원목록 status 필터
 *    (정상/정지/탈퇴). idx_user_status 인덱스 활용.
 *
 * 회원정보 수정 V23 (2026-05-30):
 *  - searchByKeyword(keyword, Pageable) 추가 — 관리자 회원 검색(이름 OR 이메일).
 *    LOWER(...) LIKE 로 대소문자 무시 부분일치. 검색은 status/provider 와 독립
 *    (가장 구체적 필터이므로 AdminUserService 에서 최우선 분기).
 *    주의: LIKE '%kw%' 선행 와일드카드라 인덱스 미활용(풀스캔). 회원 규모가
 *    작아 실무상 문제없으나, 대규모 시 풀텍스트 인덱스(ngram) 전환 여지 — 면접 포인트.
 *
 * 인덱스 매칭:
 *  User 엔티티의 idx_user_provider (provider, provider_id) 인덱스가
 *  findByProviderAndProviderId 의 WHERE 절 컬럼 순서와 정확히 매칭되어
 *  카카오 로그인 시 풀스캔 없이 인덱스 lookup 으로 동작.
 *  findByProvider 도 동일 인덱스의 선행 컬럼(provider)만 사용 -> 인덱스 활용.
 *  findByStatus 는 idx_user_status (status) 인덱스를 직접 활용.
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
     * Status 별 회원 목록 (페이징). 7-H 관리자 회원 관리 강화.
     * status 필터가 '전체' 가 아닐 때만 호출 (AdminUserService 분기).
     * idx_user_status 인덱스 활용.
     */
    Page<User> findByStatus(User.Status status, Pageable pageable);

    /**
     * 키워드로 회원 검색 (이름 OR 이메일, 대소문자 무시). 회원정보 수정 V23.
     * 관리자 회원 목록 상단 검색창에서 호출. status/provider 필터와 독립적으로 동작
     * (검색은 전체 회원 대상). 부분 일치(LIKE %kw%).
     *
     * 파라미터 바인딩 + LOWER 로 대소문자 무시. ESCAPE 미지정(검색어에 %_ 직접 입력은
     * 드문 관리 용도라 허용) — 운영 노출 시 sanitize 고려.
     */
    @Query("SELECT u FROM User u "
         + "WHERE LOWER(u.name) LIKE LOWER(CONCAT('%', :kw, '%')) "
         + "   OR LOWER(u.email) LIKE LOWER(CONCAT('%', :kw, '%'))")
    Page<User> searchByKeyword(@Param("kw") String keyword, Pageable pageable);

    /**
     * role 별 회원 수. 7-G 라운드 4 "마지막 ADMIN 강등 방지" 불변식.
     * ADMIN->USER 강등 직전 countByRole(ADMIN) == 1 이면 차단.
     */
    long countByRole(User.Role role);

    /**
     * 이름 + 상태로 회원 조회 (아이디 찾기, 5/29).
     * ACTIVE 계정만 대상 (탈퇴 회원은 찾기 제외). 동명이인 가능 -> List.
     */
    List<User> findByNameAndStatus(String name, User.Status status);
}
