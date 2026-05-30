package backend.controller;

import backend.dto.UserDto;
import backend.exception.BusinessException;
import backend.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

/**
 * 사용자단 회원정보 엔드포인트 (V23, 회원정보 수정).
 *
 * 본인 토큰(SecurityContext)으로만 동작 — 요청 바디/경로의 식별자를 신뢰하지 않음.
 * 관리자단 회원 수정은 AdminUserController(/api/admin/users) 가 담당.
 *
 *   GET   /api/users/me           : 내 정보 조회 (마이페이지 수정 화면 초기값)
 *   PATCH /api/users/me           : 프로필 수정 (닉네임/휴대폰/주소)
 *   PATCH /api/users/me/password  : 비밀번호 변경 (LOCAL, 현재 비번 검증)
 *
 * SecurityConfig: /api/users/** → authenticated() 가드 필요 (추가 예정).
 */
@Slf4j
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    /** 내 정보 조회. */
    @GetMapping("/me")
    public ResponseEntity<UserDto.Me> getMe() {
        String email = currentEmail();
        return ResponseEntity.ok(userService.getMe(email));
    }

    /**
     * 프로필 수정 (닉네임/휴대폰/주소).
     * 이름/이메일/권한은 변경 불가 — 요청에 와도 무시(DTO 에 필드 없음).
     * 수정 후 갱신된 내 정보(Me) 반환 — 프론트가 헤더 displayName 등 즉시 반영.
     */
    @PatchMapping("/me")
    public ResponseEntity<UserDto.Me> updateProfile(
            @RequestBody UserDto.ProfileUpdateRequest request) {
        String email = currentEmail();
        UserDto.Me updated = userService.updateProfile(email, request);
        log.info("Profile update processed: email={}", email);
        return ResponseEntity.ok(updated);
    }

    /**
     * 비밀번호 변경 (LOCAL 전용).
     * Body: { "currentPassword": "...", "newPassword": "..." }
     * 현재 비번 검증 후 교체. KAKAO 는 400 (소셜 계정).
     */
    @PatchMapping("/me/password")
    public ResponseEntity<Void> changePassword(
            @RequestBody UserDto.PasswordChangeRequest request) {
        String email = currentEmail();
        userService.changePassword(email, request);
        log.info("Password change processed: email={}", email);
        return ResponseEntity.ok().build();
    }

    /**
     * SecurityContext 에서 인증된 사용자 email 추출 (AuthController.currentEmail 과 동일 패턴).
     * 미인증이면 401.
     */
    private String currentEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null
                || !auth.isAuthenticated()
                || !(auth.getPrincipal() instanceof UserDetails)) {
            throw BusinessException.unauthorized("Not authenticated");
        }
        return ((UserDetails) auth.getPrincipal()).getUsername();
    }
}
