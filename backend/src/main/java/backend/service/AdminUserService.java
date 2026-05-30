package backend.service;

import backend.dto.PagedResponse;
import backend.dto.UserDto;
import backend.entity.User;
import backend.exception.BusinessException;
import backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 관리자 회원 관리 서비스 (Phase 7-G 라운드 4 -> 7-H 회원 관리 강화).
 *
 * 기능:
 *   - 회원 목록 조회 (페이징 + Provider/Status 필터)
 *   - 회원 role 변경 (USER <-> ADMIN)
 *   - 회원 정지 / 정지 해제 (7-H, 불량 유저 제재)
 *
 * 설계 노트:
 *   - 필터: provider/status 모두 null·빈 문자열이면 전체(findAll), 아니면 각 find.
 *     (둘 중 하나만 적용 — 프론트는 단일 필터 탭. 동시 적용은 비요구.)
 *   - 정렬: 가입일 내림차순 (최근 가입자 먼저).
 *   - 예외는 BusinessException 정적 팩토리 — badRequest()/notFound().
 *
 *   role 변경 2중 가드 (lockout 방지):
 *     (1) 본인 차단 — 관리자가 자기 자신의 ADMIN 을 박탈하면 즉시 관리자 페이지
 *         접근 불가. 식별 기준은 email (JWT principal getUsername()=email).
 *     (2) 마지막 ADMIN 차단 — ADMIN 0명이 되면 영구 잠김. 강등이 마지막 한 명을
 *         내리는 경우 차단 (불변식: ADMIN 수 >= 1).
 *
 *   정지(suspend) 가드 — role 변경과 동일 사상으로 lockout/오작동 방지:
 *     (1) 본인 정지 차단 — 관리자 self-lockout 방지.
 *     (2) ADMIN 정지 차단 — 관리자 계정은 제재 대상이 아님(권한 강등 후에만 가능).
 *     (3) 탈퇴(WITHDRAWN) 계정 정지 차단 — 이미 탈퇴한 계정에 정지는 무의미.
 *   해제(unsuspend) 가드:
 *     - 탈퇴 계정 해제 차단 — WITHDRAWN -> ACTIVE 부활은 별도 정책이므로 금지.
 *     - 정지 상태가 아니어도 멱등 허용(이미 ACTIVE 면 메타만 청산).
 */
@Service
@RequiredArgsConstructor
public class AdminUserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder; // V23 — 관리자 강제 비번 재설정용

    /** 페이지 크기 상한 (DOS 가드 — AuditLog 뷰어와 동일 정책). */
    private static final int MAX_PAGE_SIZE = 100;

    /**
     * 회원 목록 (페이징 + 검색/Provider/Status 필터).
     *
     * 필터 우선순위 (가장 구체적 → 일반):
     *   (1) keyword 있으면  → 이름/이메일 검색 (status·provider 무시)
     *   (2) status 있으면   → status 필터
     *   (3) provider 있으면 → provider 필터
     *   (4) 모두 없으면     → 전체
     * 검색이 최우선인 이유: "특정 회원을 찾는다"는 의도가 분류 필터보다 구체적.
     * 프론트도 검색 입력 시 필터 탭을 '전체'로 리셋해 의미 충돌을 없앰.
     *
     * @param keyword  이름/이메일 부분일치 검색어 / null·"" (검색 안 함)
     * @param provider "LOCAL" / "KAKAO" / null·"" (전체)
     * @param status   "ACTIVE" / "SUSPENDED" / "WITHDRAWN" / null·"" (전체)
     * @param page     0-indexed
     * @param size     1~100
     */
    @Transactional(readOnly = true)
    public PagedResponse<UserDto.ListItem> list(String keyword, String provider, String status, int page, int size) {
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        Pageable pageable = PageRequest.of(
                Math.max(page, 0),
                safeSize,
                Sort.by(Sort.Direction.DESC, "createdAt")
        );

        Page<User> result;
        if (keyword != null && !keyword.isBlank()) {
            result = userRepository.searchByKeyword(keyword.trim(), pageable);
        } else if (status != null && !status.isBlank()) {
            result = userRepository.findByStatus(parseStatus(status), pageable);
        } else if (provider != null && !provider.isBlank()) {
            result = userRepository.findByProvider(parseProvider(provider), pageable);
        } else {
            result = userRepository.findAll(pageable);
        }

        return PagedResponse.from(result.map(UserDto.ListItem::from));
    }

    /**
     * 회원 role 변경 (USER <-> ADMIN).
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
        boolean isDemotion = user.getRole() == User.Role.ADMIN && roleEnum == User.Role.USER;
        if (isDemotion && userRepository.countByRole(User.Role.ADMIN) <= 1) {
            throw BusinessException.badRequest(
                    "마지막 관리자는 강등할 수 없습니다. 관리자는 최소 1명 이상 유지되어야 합니다.");
        }

        user.setRole(roleEnum);
        // JPA dirty checking 으로 flush 시 UPDATE (명시적 save 불필요).

        return UserDto.ListItem.from(user);
    }

    /**
     * 회원 정지 (7-H 제재). status -> SUSPENDED + 사유/시각 기록.
     *
     * @param targetUserId      대상 회원 id
     * @param reason            정지 사유 (선택, null 허용)
     * @param currentAdminEmail 요청 관리자 본인 email (self 차단용)
     */
    @Transactional
    public UserDto.ListItem suspend(Long targetUserId, String reason, String currentAdminEmail) {
        User user = userRepository.findById(targetUserId)
                .orElseThrow(() -> BusinessException.notFound(
                        "회원을 찾을 수 없습니다. id=" + targetUserId));

        // 가드 (1): 본인 정지 차단 — self-lockout 방지.
        if (user.getEmail().equals(currentAdminEmail)) {
            throw BusinessException.badRequest("본인 계정은 정지할 수 없습니다.");
        }

        // 가드 (2): ADMIN 정지 차단 — 관리자는 제재 대상 아님 (강등 후에만 가능).
        if (user.getRole() == User.Role.ADMIN) {
            throw BusinessException.badRequest(
                    "관리자 계정은 정지할 수 없습니다. 먼저 USER 로 권한을 변경하세요.");
        }

        // 가드 (3): 탈퇴 계정 정지 차단 — 이미 탈퇴한 계정에 정지는 무의미.
        if (user.isWithdrawn()) {
            throw BusinessException.badRequest("이미 탈퇴한 회원은 정지할 수 없습니다.");
        }

        // 사유 정규화: 빈 문자열 -> null (DB 에 의미 없는 빈 값 저장 방지).
        String normalized = (reason == null || reason.isBlank()) ? null : reason.trim();
        user.suspend(normalized);

        return UserDto.ListItem.from(user);
    }

    /**
     * 정지 해제 (7-H). status -> ACTIVE 복귀 + 정지 메타데이터 청산.
     *
     * @param targetUserId 대상 회원 id
     */
    @Transactional
    public UserDto.ListItem unsuspend(Long targetUserId) {
        User user = userRepository.findById(targetUserId)
                .orElseThrow(() -> BusinessException.notFound(
                        "회원을 찾을 수 없습니다. id=" + targetUserId));

        // 가드: 탈퇴 계정 해제 차단 — WITHDRAWN -> ACTIVE 부활은 별도 정책.
        if (user.isWithdrawn()) {
            throw BusinessException.badRequest("탈퇴한 회원은 정지 해제 대상이 아닙니다.");
        }

        user.unsuspend(); // 멱등: 이미 ACTIVE 면 메타만 NULL 보장.

        return UserDto.ListItem.from(user);
    }

    // ------------------------------------------------------------------------
    // 회원 상세 / 관리자 수정 (V23, 회원정보 수정)
    // ------------------------------------------------------------------------

    /**
     * 회원 상세 조회 (V23) — 관리자 회원 수정 화면 초기값.
     * 프로필 전체 + 관리자 메모 + 가입일/최종접속 포함 (Detail DTO). 비밀번호 비노출.
     */
    @Transactional(readOnly = true)
    public UserDto.Detail getDetail(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> BusinessException.notFound(
                        "회원을 찾을 수 없습니다. id=" + userId));
        return UserDto.Detail.from(user);
    }

    /**
     * 관리자 회원 수정 (V23). 이름/닉네임/휴대폰/주소/관리자 메모 수정.
     * 선택적으로 비밀번호 강제 재설정 (현재 비번 불요, LOCAL 계정만).
     *
     * 범위 한정: 권한(role)·상태(정지/탈퇴)는 여기서 다루지 않는다.
     *   - role 변경  → updateRole()
     *   - 정지/해제   → suspend()/unsuspend()
     * 단일 책임 분리 — 이 메서드는 "프로필성" 필드만 책임진다.
     *
     * 가드:
     *   - 탈퇴(WITHDRAWN) 계정 수정 차단 — 탈퇴 계정 정보 변경은 무의미.
     *   - 비밀번호 재설정은 LOCAL 만 — KAKAO(소셜)는 비번 없음 → 400.
     *
     * @param userId 대상 회원 id
     * @param req    수정 필드 (이름/닉/휴대폰/주소/메모 + 선택적 newPassword)
     */
    @Transactional
    public UserDto.Detail updateByAdmin(Long userId, UserDto.AdminUserUpdateRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> BusinessException.notFound(
                        "회원을 찾을 수 없습니다. id=" + userId));

        // 가드: 탈퇴 계정은 정보 수정 대상이 아님.
        if (user.isWithdrawn()) {
            throw BusinessException.badRequest("탈퇴한 회원의 정보는 수정할 수 없습니다.");
        }

        // 이름 (관리자만 변경 가능 — 빈값이면 엔티티에서 무시)
        user.changeName(req.name());

        // 프로필 3종 (닉네임/휴대폰/주소) — 빈값은 엔티티에서 NULL 정규화
        user.updateProfile(
                req.nickname(),
                req.phone(),
                req.zipcode(),
                req.address(),
                req.addressDetail()
        );

        // 관리자 메모
        user.updateAdminMemo(req.adminMemo());

        // 선택적 비밀번호 강제 재설정 (LOCAL 만, 현재 비번 불요 = 관리자 권한)
        String newPw = req.newPassword();
        if (newPw != null && !newPw.isBlank()) {
            if (user.isSocial() || user.getPassword() == null) {
                throw BusinessException.badRequest(
                        "소셜(카카오) 계정은 비밀번호를 설정할 수 없습니다.");
            }
            if (newPw.length() < 4) {
                throw BusinessException.badRequest("비밀번호는 4자 이상이어야 합니다.");
            }
            user.changePassword(passwordEncoder.encode(newPw));
        }

        // dirty checking flush.
        return UserDto.Detail.from(user);
    }

    // ─── 내부 파싱 헬퍼 ───────────────────────────────────────────

    private User.Provider parseProvider(String raw) {
        try {
            return User.Provider.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw BusinessException.badRequest("알 수 없는 provider 값입니다: " + raw);
        }
    }

    private User.Status parseStatus(String raw) {
        try {
            return User.Status.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw BusinessException.badRequest("알 수 없는 status 값입니다: " + raw);
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
