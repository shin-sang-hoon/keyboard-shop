package backend.config;

import backend.exception.GlobalExceptionHandler.ErrorResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * 5-B added.
 *
 * Spring Security's default behavior returns 403 when an unauthenticated
 * request hits a protected endpoint, which violates HTTP semantics:
 *   - 401 Unauthorized = "no/invalid credentials"
 *   - 403 Forbidden    = "authenticated but lacks permission"
 *
 * This entry point overrides the default to return 401 with the same
 * ErrorResponse JSON shape used by GlobalExceptionHandler.
 *
 * IMPORTANT: We inject Spring's managed ObjectMapper rather than instantiating
 * one here, so LocalDateTime is serialized identically across all error
 * responses (frontend doesn't need to handle two date formats).
 */
@Component
@RequiredArgsConstructor
public class RestAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper objectMapper;

    @Override
    public void commence(HttpServletRequest request,
                         HttpServletResponse response,
                         AuthenticationException authException) throws IOException {

        ErrorResponse body = new ErrorResponse(
                HttpStatus.UNAUTHORIZED.value(),
                HttpStatus.UNAUTHORIZED.getReasonPhrase(),
                "Authentication is required to access this resource"
        );

        response.setStatus(HttpStatus.UNAUTHORIZED.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write(objectMapper.writeValueAsString(body));
    }
}
