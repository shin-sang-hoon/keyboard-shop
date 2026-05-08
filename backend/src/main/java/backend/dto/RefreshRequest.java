package backend.dto;

import lombok.Getter;
import lombok.Setter;

/**
 * Body for POST /api/auth/refresh.
 * Refresh token is sent in body (not Authorization header) because
 * the access token in the header is what just expired.
 */
@Getter
@Setter
public class RefreshRequest {
    private String refreshToken;
}
