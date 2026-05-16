package backend.service;

import backend.dto.AuthRequest;
import backend.dto.AuthResponse;
import backend.dto.KakaoOAuthDto;
import backend.entity.User;
import backend.exception.BusinessException;
import backend.jwt.JwtUtil;
import backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Authentication service.
 *
 * 5-B changes:
 *  - Replaced RuntimeException with BusinessException so GlobalExceptionHandler
 *    converts to proper HTTP status (401 unauthorized / 409 conflict) instead of 500.
 *  - Translated Korean messages to English for consistency with other domains
 *    (the frontend converts these to user-facing Korean messages).
 *  - Added refresh() to support the axios interceptor's 401 retry flow.
 *  - Added loadByEmail() helper used by /me endpoint.
 *
 * 5-B Day 2 (2026-05-09):
 *  - Added loginByKakao() for Kakao OAuth.
 *  - Email collision policy: if a LOCAL user already exists with the same email,
 *    reject Kakao login (do NOT auto-merge). User must explicitly use the original
 *    method. This prevents account takeover by anyone who registers a Kakao account
 *    with someone else's email.
 *  - First-time Kakao login: auto-signup + immediate JWT issuance (no separate
 *    consent page) for UX. Provider/providerId pair is the lookup key.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final KakaoOAuthClient kakaoOAuthClient;

    /**
     * Sign up a new LOCAL user and immediately issue tokens.
     * 409 Conflict if email already taken.
     */
    @Transactional
    public AuthResponse signup(AuthRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw BusinessException.conflict("Email already in use");
        }

        User user = User.builder()
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .name(request.getName())
                .role(User.Role.USER)
                .provider(User.Provider.LOCAL)
                .build();

        userRepository.save(user);
        log.info("Signup success: email={}", user.getEmail());

        return buildAuthResponse(user);
    }

    /**
     * Email + password login.
     * 401 Unauthorized for both "no such user" and "wrong password" -
     * a deliberate choice so attackers cannot probe for valid emails.
     */
    @Transactional(readOnly = true)
    public AuthResponse login(AuthRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> BusinessException.unauthorized(
                        "Invalid email or password"));

        // Kakao users have no password - reject password login.
        if (user.getPassword() == null) {
            throw BusinessException.unauthorized(
                    "This account uses social login. Please sign in with Kakao.");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw BusinessException.unauthorized("Invalid email or password");
        }

        log.info("Login success: email={}", user.getEmail());
        return buildAuthResponse(user);
    }

    /**
     * Issue a new access token from a valid refresh token.
     * Refresh token itself is NOT rotated here for simplicity - acceptable
     * because we use a server-side secret + 7-day expiry.
     * Production-grade rotation would store refresh tokens in Redis/DB and
     * invalidate the old one on each refresh; documented as Phase 8 todo.
     */
    @Transactional(readOnly = true)
    public AuthResponse refresh(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw BusinessException.unauthorized("Refresh token is required");
        }
        if (!jwtUtil.isTokenValid(refreshToken)) {
            throw BusinessException.unauthorized("Refresh token is invalid or expired");
        }

        String email = jwtUtil.extractEmail(refreshToken);
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> BusinessException.unauthorized(
                        "User no longer exists"));

        log.info("Token refresh: email={}", user.getEmail());
        return buildAuthResponse(user);
    }

    /**
     * Used by GET /api/auth/me to return current user info from the
     * authenticated SecurityContext.
     */
    @Transactional(readOnly = true)
    public AuthResponse loadByEmail(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> BusinessException.notFound("User not found"));

        // /me does not need new tokens; return null for token fields.
        return AuthResponse.builder()
                .id(user.getId())
                .accessToken(null)
                .refreshToken(null)
                .email(user.getEmail())
                .name(user.getName())
                .role(user.getRole().name())
                .build();
    }

    // ------------------------------------------------------------------------
    // Kakao OAuth
    // ------------------------------------------------------------------------

    /**
     * Kakao OAuth callback handler.
     *
     * Flow:
     *   1. Exchange authorization code for access token via Kakao API.
     *   2. Fetch user info (id, email, nickname) with that token.
     *   3. Look up by (provider=KAKAO, providerId) - the unique social identity.
     *   4. If found: existing Kakao user → just issue JWT.
     *   5. If not found:
     *      a. If email is already used by a LOCAL user → reject (collision).
     *      b. Otherwise: auto-signup as Kakao user → issue JWT.
     *
     * Why (provider, providerId) lookup instead of email:
     *   - A Kakao user might change their email later. The Kakao "id" never changes.
     *   - Using email as the social identity key would also conflict with
     *     LOCAL accounts that happen to share the email.
     *
     * Why reject on email collision (instead of auto-merging):
     *   - Account takeover risk. If we merged blindly, anyone could sign up on
     *     Kakao with victim@example.com (assuming they control that Kakao account)
     *     and gain access to the LOCAL account's history.
     *   - User-facing message tells them to use the original method.
     */
    @Transactional
    public AuthResponse loginByKakao(String code) {
        // 1. Exchange code → access token
        KakaoOAuthDto.TokenResponse tokenResponse =
                kakaoOAuthClient.exchangeCodeForToken(code);

        // 2. Fetch Kakao user
        KakaoOAuthDto.UserResponse kakaoUser =
                kakaoOAuthClient.fetchUser(tokenResponse.accessToken());

        String providerId = String.valueOf(kakaoUser.id());
        String email = kakaoUser.email();
        String nickname = kakaoUser.nickname() != null ? kakaoUser.nickname() : "Kakao User";

        // 3. Look up existing Kakao user
        User user = userRepository
                .findByProviderAndProviderId(User.Provider.KAKAO, providerId)
                .orElseGet(() -> registerKakaoUser(email, nickname, providerId));

        log.info("Kakao login success: email={}, providerId={}", user.getEmail(), providerId);
        return buildAuthResponse(user);
    }

    /**
     * Auto-signup helper for first-time Kakao login.
     * Throws if the email is already registered as LOCAL.
     */
    private User registerKakaoUser(String email, String nickname, String providerId) {
        // 5-a. Email collision check - reject if used by LOCAL.
        userRepository.findByEmail(email).ifPresent(existing -> {
            throw BusinessException.conflict(
                    "This email is already registered. Please sign in with email/password.");
        });

        // 5-b. Auto-signup
        User newUser = User.builder()
                .email(email)
                .password(null) // Kakao users have no password
                .name(nickname)
                .role(User.Role.USER)
                .provider(User.Provider.KAKAO)
                .providerId(providerId)
                .build();

        userRepository.save(newUser);
        log.info("Kakao auto-signup: email={}, providerId={}", email, providerId);
        return newUser;
    }

    // ------------------------------------------------------------------------
    // helpers
    // ------------------------------------------------------------------------

    private AuthResponse buildAuthResponse(User user) {
        String accessToken = jwtUtil.generateAccessToken(
                user.getEmail(), user.getRole().name());
        String refreshToken = jwtUtil.generateRefreshToken(user.getEmail());
        return AuthResponse.builder()
                .id(user.getId())
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .email(user.getEmail())
                .name(user.getName())
                .role(user.getRole().name())
                .build();
    }
}
