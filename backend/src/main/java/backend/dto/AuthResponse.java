package backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

/**
 * Auth API response.
 *
 * Returned by:
 *   POST /api/auth/signup   - signup + auto-issue tokens
 *   POST /api/auth/login    - email/password login
 *   POST /api/auth/refresh  - access token refresh (5-B added)
 *   POST /api/auth/kakao    - Kakao OAuth login (5-B Day 2)
 *
 * Note: role added in 5-B for frontend route guards (ADMIN-only pages, etc.).
 *       provider is omitted intentionally - frontend doesn't need to know
 *       whether the user is LOCAL or KAKAO; "logged in" is enough.
 */
@Getter
@Builder
@AllArgsConstructor
public class AuthResponse {
    private Long id;
    private String accessToken;
    private String refreshToken;
    private String email;
    private String name;
    private String role;
}
