package backend.controller;

import backend.dto.AuthRequest;
import backend.dto.AuthResponse;
import backend.dto.RefreshRequest;
import backend.exception.BusinessException;
import backend.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/signup")
    public ResponseEntity<AuthResponse> signup(@RequestBody AuthRequest request) {
        return ResponseEntity.ok(authService.signup(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody AuthRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    /**
     * 5-B added.
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
     * 5-B added.
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
}
