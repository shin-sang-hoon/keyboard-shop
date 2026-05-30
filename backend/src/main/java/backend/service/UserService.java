package backend.service;

import backend.dto.UserDto;
import backend.entity.User;
import backend.exception.BusinessException;
import backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 사용자단 회원정보 서비스 (V23, 회원정보 수정).
 *
 * 본인 토큰(SecurityContext email)으로만 동작 — 컨트롤러가 인증된 email 을 넘긴다.
 * 관리자단 회원 수정은 AdminUserService 가 담당 (권한/상태/메모까지).
 *
 * 책임:
 *   - getMe(email)           : 내 정보 조회 (마이페이지 회원정보 수정 화면 초기값)
 *   - updateProfile(...)     : 닉네임/휴대폰/주소 수정 (이름/이메일/권한 불변)
 *   - changePassword(...)    : 현재 비밀번호 검증 후 새 비밀번호로 교체 (LOCAL 만)
 *
 * 가드:
 *   - 탈퇴(WITHDRAWN) 계정은 어떤 수정도 거부 (토큰 가드를 통과해 도달할 일은 드묾).
 *   - 비밀번호 변경은 LOCAL 계정만 — KAKAO 는 비번이 없어 400.
 *   - 현재 비밀번호 검증은 AuthService.withdraw 와 동일 패턴(passwordEncoder.matches).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    /** 내 정보 조회 (마이페이지 회원정보 수정 화면 초기값). */
    @Transactional(readOnly = true)
    public UserDto.Me getMe(String email) {
        User user = loadActive(email);
        return UserDto.Me.from(user);
    }

    /**
     * 프로필 수정 (닉네임/휴대폰/주소). 이름/이메일/권한은 변경하지 않는다.
     * 빈 문자열은 엔티티 updateProfile 에서 NULL 로 정규화된다.
     */
    @Transactional
    public UserDto.Me updateProfile(String email, UserDto.ProfileUpdateRequest req) {
        User user = loadActive(email);

        user.updateProfile(
                req.nickname(),
                req.phone(),
                req.zipcode(),
                req.address(),
                req.addressDetail()
        );
        userRepository.save(user); // dirty checking flush (의도 명확화)

        log.info("Profile updated: email={}", email);
        return UserDto.Me.from(user);
    }

    /**
     * 비밀번호 변경 (LOCAL 전용). 현재 비밀번호 검증 후 새 비밀번호로 교체.
     *
     * - KAKAO(소셜) 계정: 비밀번호가 없어 변경 불가 -> 400.
     * - 현재 비밀번호 불일치: 401 (탈퇴 재인증과 동일 처리).
     * - 새 비밀번호 길이 가드: 4자 이상 (회원가입 정책과 일치).
     */
    @Transactional
    public void changePassword(String email, UserDto.PasswordChangeRequest req) {
        User user = loadActive(email);

        // 소셜 계정은 비밀번호가 없음
        if (user.isSocial() || user.getPassword() == null) {
            throw BusinessException.badRequest(
                    "Social accounts cannot change password.");
        }

        String current = req == null ? null : req.currentPassword();
        String next = req == null ? null : req.newPassword();

        if (current == null || current.isBlank()) {
            throw BusinessException.badRequest("Current password is required.");
        }
        if (next == null || next.length() < 4) {
            throw BusinessException.badRequest("New password must be at least 4 characters.");
        }

        // 현재 비밀번호 검증 (탈퇴 재인증과 동일 패턴)
        if (!passwordEncoder.matches(current, user.getPassword())) {
            throw BusinessException.unauthorized("Current password does not match.");
        }

        // 동일 비밀번호로의 변경 방지 (선택적 UX 가드)
        if (passwordEncoder.matches(next, user.getPassword())) {
            throw BusinessException.badRequest(
                    "New password must be different from the current one.");
        }

        user.changePassword(passwordEncoder.encode(next));
        userRepository.save(user);

        log.info("Password changed: email={}", email);
    }

    // ------------------------------------------------------------------------
    // helpers
    // ------------------------------------------------------------------------

    /**
     * 인증된 이메일로 ACTIVE 사용자 로드. 없으면 404.
     * 탈퇴/정지 계정은 토큰 가드(ensureLoginable)에서 이미 막히지만,
     * 방어적으로 한 번 더 거부 (토큰 발급 후 상태 변경 레이스 대비).
     */
    private User loadActive(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> BusinessException.notFound("User not found"));
        if (user.getStatus() == User.Status.WITHDRAWN) {
            throw BusinessException.forbidden("This account has been withdrawn.");
        }
        return user;
    }
}
