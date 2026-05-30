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
 *   GET  /api/auth/me       - current user (tokens null)
 *
 * Note: role added in 5-B for frontend route guards (ADMIN-only pages, etc.).
 *       provider is omitted intentionally - frontend doesn't need to know
 *       whether the user is LOCAL or KAKAO; "logged in" is enough.
 *
 * V23 (회원정보 수정): added displayName — "이름(닉네임)" 또는 "이름".
 *       헤더/인사말에서 닉네임 반영 표시용. name 은 원본 이름 그대로 유지.
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
    private String displayName;   // V23 — "이름(닉네임)" 또는 "이름"
    private String role;
}
