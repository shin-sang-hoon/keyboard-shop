package backend.service;

import backend.dto.AuthRequest;
import backend.dto.AuthResponse;
import backend.dto.KakaoOAuthDto;
import backend.dto.WithdrawRequest;
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
 *
 * 회원 탈퇴 (2026-05-29, soft delete):
 *  - withdraw(): status → WITHDRAWN (이메일/연관 데이터 보존, 재가입 차단).
 *  - login()/refresh()/loginByKakao() 에 status 가드 추가.
 *    중요: 가드는 자격증명 검증(password/OAuth) 통과 *후* 실행.
 *    검증 전에 status 를 보면 enumeration 누출 → 검증 후엔 "탈퇴 안내"가 누출 아님.
 *  - signup(): 기존 existsByEmail 로 자동 차단 + 탈퇴 계정이면 메시지 분기.
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
     * 회원 탈퇴: 탈퇴 처리된 이메일이면 재가입 차단 + 안내 메시지 분기
     * (soft delete 라 row 가 남아 existsByEmail=true → 자연 차단되지만,
     *  "이미 사용 중" 보다 "탈퇴 계정" 안내가 정확).
     *
     * Phase 8 5-D: also create Cart in same transaction.
     */
    @Transactional
    public AuthResponse signup(AuthRequest request) {
        userRepository.findByEmail(request.getEmail()).ifPresent(existing -> {
            if (existing.getStatus() == User.Status.WITHDRAWN) {
                throw BusinessException.conflict(
                        "This email belongs to a withdrawn account and cannot be reused.");
            }
            throw BusinessException.conflict("Email already in use");
        });

        User user = User.builder()
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .name(request.getName())
                .role(User.Role.USER)
                .provider(User.Provider.LOCAL)
                .status(User.Status.ACTIVE)
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
     *
     * 회원 탈퇴 가드: password 검증을 모두 통과한 *후* status 확인.
     * 순서가 핵심 — 검증 전에 status 를 보면 이메일 존재 여부가 새지만,
     * 검증 통과 후엔 본인(또는 자격증명 탈취자)이므로 "탈퇴 계정" 안내가 누출이 아님.
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

        // 자격증명 검증 통과 후 status 가드 (탈퇴 계정 차단)
        ensureNotWithdrawn(user);

        log.info("Login success: email={}", user.getEmail());
        return buildAuthResponse(user);
    }

    /**
     * Issue a new access token from a valid refresh token.
     *
     * 회원 탈퇴 가드: 탈퇴 직전 발급된 refresh 토큰이 만료 전이라도
     * 재발급을 막아야 함 (토큰 유효성 != 계정 활성).
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

        // 토큰은 유효해도 탈퇴 계정이면 재발급 거부
        ensureNotWithdrawn(user);

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
    // 회원 탈퇴 (soft delete)
    // ------------------------------------------------------------------------

    /**
     * 회원 탈퇴. 본인 토큰(SecurityContext email)으로만 호출.
     *
     * - LOCAL: password 재인증 필수 (탈퇴는 되돌릴 수 없으므로 본인 확인).
     * - KAKAO: 비밀번호가 없어 재인증 생략 (프론트 확인 모달로 대체).
     * - status → WITHDRAWN + withdrawnAt 기록. 이메일/리뷰/주문 등 연관 데이터 보존.
     * - 토큰은 stateless 라 서버 폐기 없음 → 프론트가 토큰 버리고 로그아웃.
     *   (Redis 블랙리스트는 Phase 8 todo)
     *
     * @param email   인증된 사용자 이메일 (컨트롤러가 SecurityContext 에서 추출)
     * @param request 비밀번호(LOCAL) + 사유(선택)
     */
    @Transactional
    public void withdraw(String email, WithdrawRequest request) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> BusinessException.notFound("User not found"));

        // 이미 탈퇴한 계정 (멱등 — 토큰 가드를 통과해 도달할 일은 드묾)
        if (user.getStatus() == User.Status.WITHDRAWN) {
            throw BusinessException.conflict("Account is already withdrawn");
        }

        // LOCAL 유저는 비밀번호 재인증 (KAKAO 는 password 없음 → 생략)
        if (user.getProvider() == User.Provider.LOCAL) {
            String pw = request == null ? null : request.password();
            if (pw == null || pw.isBlank()) {
                throw BusinessException.badRequest("Password is required to withdraw");
            }
            if (user.getPassword() == null
                    || !passwordEncoder.matches(pw, user.getPassword())) {
                throw BusinessException.unauthorized("Password does not match");
            }
        }

        user.withdraw(); // 엔티티 상태 전이 (status=WITHDRAWN + withdrawnAt)
        // dirty checking 으로 flush — 명시적 save 불필요하나 의도 명확화 위해 호출
        userRepository.save(user);

        String reason = (request == null || request.reason() == null) ? "(none)" : request.reason();
        log.info("Withdraw success: email={}, provider={}, reason={}",
                user.getEmail(), user.getProvider(), reason);
    }

    // ------------------------------------------------------------------------
    // Kakao OAuth
    // ------------------------------------------------------------------------

    /**
     * Kakao OAuth callback handler.
     *
     * 회원 탈퇴 가드: 기존 Kakao 유저를 찾은 경우, OAuth 인증은 통과했어도
     * 탈퇴 계정이면 로그인 거부. (신규 자동가입 경로는 탈퇴와 무관.)
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
                .map(existing -> {
                    // 기존 Kakao 유저 — OAuth 통과 후 status 가드
                    ensureNotWithdrawn(existing);
                    return existing;
                })
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
            // 탈퇴한 이메일이면 재가입(자동가입) 차단
            if (existing.getStatus() == User.Status.WITHDRAWN) {
                throw BusinessException.conflict(
                        "This email belongs to a withdrawn account and cannot be reused.");
            }
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
                .status(User.Status.ACTIVE)
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

    /**
     * 탈퇴 계정 가드. 자격증명 검증 통과 후에만 호출할 것.
     * 403 Forbidden — 인증은 됐으나(자격증명 맞음) 계정 상태로 인해 거부.
     */
    private void ensureNotWithdrawn(User user) {
        if (user.getStatus() == User.Status.WITHDRAWN) {
            throw BusinessException.forbidden(
                    "This account has been withdrawn.");
        }
    }

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
