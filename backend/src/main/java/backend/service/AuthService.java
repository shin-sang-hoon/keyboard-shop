package backend.service;

import backend.dto.AuthRequest;
import backend.dto.AuthResponse;
import backend.dto.KakaoOAuthDto;
import backend.entity.Cart;
import backend.entity.User;
import backend.exception.BusinessException;
import backend.jwt.JwtUtil;
import backend.repository.CartRepository;
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
 *    method.
 *
 * Phase 8 5-D (2026-05-18):
 *  - Auto-create Cart on signup + Kakao auto-signup.
 *  - Invariant: user always has exactly 1 cart (UNIQUE user_id on carts table).
 *  - Existing users backfilled by V13 SQL.
 *  - Both signup paths atomic with @Transactional - user + cart save together.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final KakaoOAuthClient kakaoOAuthClient;
    private final CartRepository cartRepository; // Phase 8 5-D

    /**
     * Sign up a new LOCAL user and immediately issue tokens.
     * 409 Conflict if email already taken.
     *
     * Phase 8 5-D: also create Cart in same transaction.
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

        // Phase 8 5-D: auto-create Cart (atomic with user creation)
        Cart cart = Cart.builder().user(user).build();
        cartRepository.save(cart);

        log.info("Signup success (with cart): email={}, cartId={}", user.getEmail(), cart.getId());

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
     */
    @Transactional
    public AuthResponse loginByKakao(String code) {
        KakaoOAuthDto.TokenResponse tokenResponse =
                kakaoOAuthClient.exchangeCodeForToken(code);

        KakaoOAuthDto.UserResponse kakaoUser =
                kakaoOAuthClient.fetchUser(tokenResponse.accessToken());

        String providerId = String.valueOf(kakaoUser.id());
        String email = kakaoUser.email();
        String nickname = kakaoUser.nickname() != null ? kakaoUser.nickname() : "Kakao User";

        User user = userRepository
                .findByProviderAndProviderId(User.Provider.KAKAO, providerId)
                .orElseGet(() -> registerKakaoUser(email, nickname, providerId));

        log.info("Kakao login success: email={}, providerId={}", user.getEmail(), providerId);
        return buildAuthResponse(user);
    }

    /**
     * Auto-signup helper for first-time Kakao login.
     * Throws if the email is already registered as LOCAL.
     *
     * Phase 8 5-D: also create Cart in same transaction.
     */
    private User registerKakaoUser(String email, String nickname, String providerId) {
        userRepository.findByEmail(email).ifPresent(existing -> {
            throw BusinessException.conflict(
                    "This email is already registered. Please sign in with email/password.");
        });

        User newUser = User.builder()
                .email(email)
                .password(null)
                .name(nickname)
                .role(User.Role.USER)
                .provider(User.Provider.KAKAO)
                .providerId(providerId)
                .build();

        userRepository.save(newUser);

        // Phase 8 5-D: auto-create Cart (atomic with user creation)
        Cart cart = Cart.builder().user(newUser).build();
        cartRepository.save(cart);

        log.info("Kakao auto-signup (with cart): email={}, providerId={}, cartId={}",
                email, providerId, cart.getId());
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
