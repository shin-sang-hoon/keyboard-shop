package backend.controller;

import backend.dto.AuthRequest;
import backend.dto.AuthResponse;
import backend.dto.RefreshRequest;
import backend.dto.WithdrawRequest;
import backend.exception.BusinessException;
import backend.service.AuthService;
import backend.service.KakaoOAuthClient;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * Authentication endpoints.
 *
 * 5-B Day 1 (5/8): /signup, /login, /refresh, /me
 * 5-B Day 2 (5/9): /kakao/authorize-url, /kakao/callback
 * 회원 탈퇴 (5/29): /withdraw
 *
 * SecurityConfig:
 *   /api/auth/me        → authenticated()
 *   /api/auth/withdraw  → authenticated()
 *   /api/auth/**        → permitAll()  (kakao 2개도 자동 매칭)
 */
@Slf4j
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final KakaoOAuthClient kakaoOAuthClient;

    /** OAuth 성공/실패 시 프론트로 redirect 할 URL. application.properties 에 정의. */
    @Value("${kakao.frontend-redirect}")
    private String frontendRedirect;

    // ========================================================================
    // 5-B Day 1: LOCAL 인증
    // ========================================================================

    @PostMapping("/signup")
    public ResponseEntity<AuthResponse> signup(@RequestBody AuthRequest request) {
        return ResponseEntity.ok(authService.signup(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody AuthRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    /**
     * 5-B Day 1.
     * Frontend axios interceptor calls this on 401, sending the stored
     * refresh token to get a fresh access token. See frontend/src/api/client.js.
     *
     * Body: { "refreshToken": "..." }
     * Response: full AuthResponse (frontend updates accessToken from this).
     */
    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(@RequestBody RefreshRequest request) {
        return ResponseEntity.ok(authService.refresh(request.getRefreshToken()));
    }

    /**
     * 5-B Day 1.
     * Returns current authenticated user info. Used by frontend to:
     *  1. Verify a stored token is still valid on app load.
     *  2. Hydrate the authStore with fresh user data (e.g. role changes).
     *
     * SecurityConfig requires authentication for this endpoint specifically;
     * other /api/auth/** are permitAll.
     */
    @GetMapping("/me")
    public ResponseEntity<AuthResponse> me() {
        String email = currentEmail();
        return ResponseEntity.ok(authService.loadByEmail(email));
    }

    /**
     * 회원 탈퇴 (soft delete, 5/29).
     *
     * POST /api/auth/withdraw
     * Body: { "password": "...", "reason": "..." }  (KAKAO 는 password 생략 가능)
     *
     * 본인 토큰(SecurityContext)에서 email 추출 — 요청 바디의 email 을 신뢰하지 않음
     * (타인 계정 탈퇴 방지). SecurityConfig 에서 authenticated() 가드.
     *
     * 처리 후 200 OK. 토큰은 stateless 라 서버 폐기 없음 → 프론트가 토큰 버리고
     * 로그아웃 + 홈 이동. (Redis 블랙리스트는 Phase 8)
     */
    @PostMapping("/withdraw")
    public ResponseEntity<Void> withdraw(@RequestBody(required = false) WithdrawRequest request) {
        String email = currentEmail();
        authService.withdraw(email, request);
        log.info("Withdraw processed: email={}", email);
        return ResponseEntity.ok().build();
    }

    /**
     * SecurityContext 에서 인증된 사용자 email 추출.
     * /me 와 /withdraw 공용 — 미인증이면 401.
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

    // ========================================================================
    // 5-B Day 2: Kakao OAuth
    // ========================================================================

    /**
     * POST /api/auth/logout
     *
     * stateless JWT 의 logout 시맨틱: 서버는 토큰을 추적하지 않는다.
     * 클라이언트가 accessToken/refreshToken 을 버리면 그게 곧 logout.
     * 본 endpoint 는 200 OK + 로깅만 제공 (감사 + 운영 가시성).
     *
     * 향후 Phase 8: Redis 블랙리스트 도입 시 여기서 jti 등록 + TTL 부여.
     *
     * 면접 자산: stateless 인증의 logout 처리 (서버 액션 없이 클라이언트 책임),
     *           500 노이즈 제거 + 감사 로깅 hook 마련.
     */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout() {
        String email = org.springframework.security.core.context.SecurityContextHolder
                .getContext().getAuthentication() != null
                ? org.springframework.security.core.context.SecurityContextHolder
                        .getContext().getAuthentication().getName()
                : "anonymous";
        log.info("Logout request: email={}", email);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/kakao/authorize-url")
    public ResponseEntity<AuthorizeUrlResponse> kakaoAuthorizeUrl(
            @RequestParam(required = false) String state) {
        // state 가 없으면 빈 문자열 - 프론트에서 검증 안 하면 CSRF 노출, 가능한 늘 전달.
        String url = kakaoOAuthClient.buildAuthorizeUrl(state == null ? "" : state);
        return ResponseEntity.ok(new AuthorizeUrlResponse(url));
    }

    /**
     * GET /api/auth/kakao/callback?code={code}&state={state}
     *
     * 카카오가 redirect_uri 로 돌려보내는 콜백 엔드포인트.
     * 처리 후 프론트의 /auth/kakao/success 페이지로 토큰을 쿼리스트링에 담아 redirect.
     */
    @GetMapping("/kakao/callback")
    public void kakaoCallback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error,
            @RequestParam(name = "error_description", required = false) String errorDescription,
            HttpServletResponse response
    ) throws IOException {

        // 카카오가 에러로 돌려보낸 경우 (사용자가 동의 거절 등)
        if (error != null) {
            log.warn("Kakao callback returned error: {} - {}", error, errorDescription);
            String redirect = frontendRedirect
                    + "?error=" + enc(error)
                    + "&error_description=" + enc(errorDescription == null ? "" : errorDescription);
            response.sendRedirect(redirect);
            return;
        }

        // code 누락 (정상 흐름에서 발생할 일 없음, 방어 코드)
        if (code == null || code.isBlank()) {
            log.warn("Kakao callback missing code");
            String redirect = frontendRedirect + "?error=missing_code";
            response.sendRedirect(redirect);
            return;
        }

        try {
            AuthResponse auth = authService.loginByKakao(code);

            // 토큰을 쿼리스트링으로 붙여 프론트 페이지로 redirect.
            // state 도 그대로 돌려보내 프론트가 sessionStorage 값과 비교 (CSRF 검증).
            String redirect = frontendRedirect
                    + "?accessToken=" + enc(auth.getAccessToken())
                    + "&refreshToken=" + enc(auth.getRefreshToken())
                    + "&email=" + enc(auth.getEmail())
                    + "&name=" + enc(auth.getName())
                    + "&role=" + enc(auth.getRole())
                    + (state != null ? "&state=" + enc(state) : "");
            response.sendRedirect(redirect);
        } catch (BusinessException ex) {
            // 이메일 충돌 (이미 LOCAL 가입된 이메일) / 탈퇴 계정 등 비즈니스 에러
            log.warn("Kakao login business error: {}", ex.getMessage());
            String redirect = frontendRedirect
                    + "?error=login_failed"
                    + "&error_description=" + enc(ex.getMessage());
            response.sendRedirect(redirect);
        } catch (Exception ex) {
            // 예상 못 한 에러 - 메시지 노출 자제
            log.error("Kakao login unexpected error", ex);
            String redirect = frontendRedirect
                    + "?error=internal_error"
                    + "&error_description=" + enc("Login failed. Please try again.");
            response.sendRedirect(redirect);
        }
    }

    // URL 쿼리스트링 인코딩 헬퍼 (한글 이름 / 토큰의 = / +  등 안전 처리)
    private static String enc(String s) {
        return URLEncoder.encode(s == null ? "" : s, StandardCharsets.UTF_8);
    }

    /** kakaoAuthorizeUrl 응답 DTO. */
    public record AuthorizeUrlResponse(String url) {}
}
