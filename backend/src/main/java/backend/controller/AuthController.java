package backend.controller;

import backend.dto.AuthRequest;
import backend.dto.AuthResponse;
import backend.dto.RefreshRequest;
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
 *
 * SecurityConfig:
 *   /api/auth/me        → authenticated()
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
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null
                || !auth.isAuthenticated()
                || !(auth.getPrincipal() instanceof UserDetails)) {
            throw BusinessException.unauthorized("Not authenticated");
        }
        String email = ((UserDetails) auth.getPrincipal()).getUsername();
        return ResponseEntity.ok(authService.loadByEmail(email));
    }

    // ========================================================================
    // 5-B Day 2: Kakao OAuth
    // ========================================================================

    /**
     * GET /api/auth/kakao/authorize-url?state={state}
     *
     * 프론트가 카카오 로그인 버튼 누르면 호출:
     *   1) 프론트에서 random nonce 생성 → sessionStorage 저장
     *   2) 이 엔드포인트로 state 전달, 인가 URL 받음
     *   3) window.location.href = 응답 URL
     *
     * 굳이 백엔드를 거치는 이유:
     *   - client_id / redirect_uri 같은 OAuth 설정을 프론트가 알 필요 없게.
     *   - 환경 분기 (Mac 8080 / 학원 8081) 가 백엔드 properties 만으로 가능.
     *   - 향후 multi-provider (Google/Naver) 추가 시 같은 패턴 재활용.
     */
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
     *
     * 왜 JSON 응답이 아닌 redirect 인가:
     *   - 카카오 OAuth 는 브라우저 navigation 기반. 콜백도 브라우저가 직접 받음.
     *   - JSON 으로 응답하면 브라우저에 raw JSON 노출됨.
     *   - 따라서 백엔드는 토큰을 쿼리스트링으로 붙여 프론트 페이지로 302 redirect,
     *     프론트 페이지가 useEffect 로 토큰 추출 → 저장 → 메인으로 이동.
     *
     * 보안 고려 (Phase 8 todo):
     *   - 토큰을 URL 에 노출하는 건 브라우저 history 에 남는 단점.
     *   - 운영 환경에서는 짧은 수명의 "exchange code" 발급 → 프론트가 그 코드로
     *     POST /api/auth/exchange 호출하여 토큰 교환하는 패턴 권장.
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
            // 이메일 충돌 (이미 LOCAL 가입된 이메일) 등 비즈니스 에러
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
