package backend.service;

import backend.dto.AuthRequest;
import backend.dto.AuthResponse;
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
 * Phase 2 (5-B Day 2) will add loginByKakao() for OAuth.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

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
                .accessToken(null)
                .refreshToken(null)
                .email(user.getEmail())
                .name(user.getName())
                .role(user.getRole().name())
                .build();
    }

    // ------------------------------------------------------------------------
    // helpers
    // ------------------------------------------------------------------------

    private AuthResponse buildAuthResponse(User user) {
        String accessToken = jwtUtil.generateAccessToken(
                user.getEmail(), user.getRole().name());
        String refreshToken = jwtUtil.generateRefreshToken(user.getEmail());
        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .email(user.getEmail())
                .name(user.getName())
                .role(user.getRole().name())
                .build();
    }
}
