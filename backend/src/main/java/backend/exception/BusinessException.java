package backend.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/**
 * Unified business exception (added 5-H A6, extended 5-B).
 *
 * Throw from Service when domain rules are violated.
 * GlobalExceptionHandler converts to appropriate HTTP response by status.
 *
 * Static factories cover the common cases:
 *   - notFound (404): missing resource
 *   - forbidden (403): authenticated but not authorized
 *   - unauthorized (401): not authenticated / bad credentials  [added 5-B]
 *   - badRequest (400): rule violation, validation error
 *   - conflict (409): unique constraint, duplicate state transition
 *
 * Design notes:
 *  - Extends RuntimeException so @Transactional auto-rollback applies.
 *  - Single exception type carrying HttpStatus keeps handler count to one.
 *  - Service knowing about HTTP semantics is acceptable in Spring REST apps;
 *    the alternative (custom exception per case) explodes the handler count.
 */
@Getter
public class BusinessException extends RuntimeException {

    private final HttpStatus status;

    public BusinessException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public static BusinessException notFound(String message) {
        return new BusinessException(HttpStatus.NOT_FOUND, message);
    }

    public static BusinessException forbidden(String message) {
        return new BusinessException(HttpStatus.FORBIDDEN, message);
    }

    /**
     * 5-B added. Use for "not authenticated" / "bad credentials" cases.
     * Distinct from forbidden(403) which means "authenticated but not allowed".
     */
    public static BusinessException unauthorized(String message) {
        return new BusinessException(HttpStatus.UNAUTHORIZED, message);
    }

    public static BusinessException badRequest(String message) {
        return new BusinessException(HttpStatus.BAD_REQUEST, message);
    }

    public static BusinessException conflict(String message) {
        return new BusinessException(HttpStatus.CONFLICT, message);
    }
}
