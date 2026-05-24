package backend.service;

import backend.dto.PagedResponse;
import backend.dto.UserDto;
import backend.entity.User;
import backend.exception.BusinessException;
import backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 관리자 회원 관리 서비스 (Phase 7-G 라운드 4).
 *
 * 기능:
 *   - 회원 목록 조회 (페이징 + Provider 필터)
 *   - 회원 role 변경 (USER ↔ ADMIN)
 *
 * 설계 노트:
 *   - Provider 필터: null/빈 문자열이면 전체(findAll), 아니면 findByProvider.
 *   - 정렬: 가입일 내림차순 (최근 가입자 먼저).
 *   - 예외는 BusinessException 정적 팩토리 사용 — 생성자는 (HttpStatus,String)
 *     시그니처만 public 이라 badRequest()/notFound() 로 던진다.
 *
 *   role 변경 2중 가드 (lockout 방지):
 *     (1) 본인 차단 — 관리자가 자기 자신의 ADMIN 을 박탈하면 즉시
 *         관리자 페이지 접근 불가. 식별 기준은 email — JWT principal
 *         (UserDetails)의 getUsername()이 email 을 반환하기 때문
 *         (AdminAuctionController 와 동일 패턴).
 *     (2) 마지막 ADMIN 차단 — 시스템 전체에 ADMIN 이 0명이 되면 누구도
 *         관리자 페이지에 못 들어가 영구 잠김. ADMIN→USER 강등이
 *         마지막 한 명을 내리는 경우 차단 (불변식: ADMIN 수 >= 1).
 *         (1)이 self-lockout 을, (2)가 mutual-lockout 을 막는다.
 */
@Service
@RequiredArgsConstructor
public class AdminUserService {

    private final UserRepository userRepository;

    /** 페이지 크기 상한 (DOS 가드 — AuditLog 뷰어와 동일 정책). */
    private static final int MAX_PAGE_SIZE = 100;

    /**
     * 회원 목록 (페이징 + Provider 필터).
     *
     * @param provider "LOCAL" / "KAKAO" / null·"" (전체)
     * @param page     0-indexed
     * @param size     1~100
     */
    @Transactional(readOnly = true)
    public PagedResponse<UserDto.ListItem> list(String provider, int page, int size) {
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        Pageable pageable = PageRequest.of(
                Math.max(page, 0),
                safeSize,
                Sort.by(Sort.Direction.DESC, "createdAt")
        );

        Page<User> result;
        if (provider == null || provider.isBlank()) {
            result = userRepository.findAll(pageable);
        } else {
            User.Provider providerEnum = parseProvider(provider);
            result = userRepository.findByProvider(providerEnum, pageable);
        }

        return PagedResponse.from(result.map(UserDto.ListItem::from));
    }

    /**
     * 회원 role 변경 (USER ↔ ADMIN).
     *
     * @param targetUserId      변경 대상 회원 id
     * @param newRole           "USER" / "ADMIN"
     * @param currentAdminEmail 요청을 보낸 관리자 본인 email (자기 자신 변경 차단용)
     */
    @Transactional
    public UserDto.ListItem updateRole(Long targetUserId, String newRole, String currentAdminEmail) {
        User.Role roleEnum = parseRole(newRole);

        User user = userRepository.findById(targetUserId)
                .orElseThrow(() -> BusinessException.notFound(
                        "회원을 찾을 수 없습니다. id=" + targetUserId));

        // 가드 (1): 본인 차단 — self-lockout 방지.
        if (user.getEmail().equals(currentAdminEmail)) {
            throw BusinessException.badRequest("본인의 권한은 변경할 수 없습니다.");
        }

        // 가드 (2): 마지막 ADMIN 차단 — mutual-lockout 방지.
        // ADMIN → USER 강등이면서, 대상이 시스템의 마지막 ADMIN 인 경우.
        boolean isDemotion = user.getRole() == User.Role.ADMIN && roleEnum == User.Role.USER;
        if (isDemotion && userRepository.countByRole(User.Role.ADMIN) <= 1) {
            throw BusinessException.badRequest(
                    "마지막 관리자는 강등할 수 없습니다. 관리자는 최소 1명 이상 유지되어야 합니다.");
        }

        user.setRole(roleEnum);
        // JPA dirty checking 으로 flush 시 UPDATE (명시적 save 불필요).

        return UserDto.ListItem.from(user);
    }

    // ─── 내부 파싱 헬퍼 ───────────────────────────────────────────

    private User.Provider parseProvider(String raw) {
        try {
            return User.Provider.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw BusinessException.badRequest("알 수 없는 provider 값입니다: " + raw);
        }
    }

    private User.Role parseRole(String raw) {
        if (raw == null || raw.isBlank()) {
            throw BusinessException.badRequest("role 값이 필요합니다.");
        }
        try {
            return User.Role.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw BusinessException.badRequest("알 수 없는 role 값입니다: " + raw);
        }
    }
}
