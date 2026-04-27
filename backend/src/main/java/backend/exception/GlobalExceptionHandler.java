package backend.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.stream.Collectors;

/**
 * 컨트롤러 단의 공통 예외 처리. 잘못된 enum 입력 같은 클라이언트 오류를
 * 적절한 4xx 응답으로 변환해 UX 개선.
 *
 * 5-G 마무리 시점 (4/27) 추가. 추후 비즈니스 예외 (NotFound, Unauthorized 등)
 * 도 같이 다루면 됨.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * 쿼리 파라미터 타입 불일치 (잘못된 enum 값 등) 400 Bad Request.
     *
     * 예: GET /api/products?productType=INVALID_VALUE
     *   - MethodArgumentTypeMismatchException 발생
     *   - 기본 처리 시 403 Forbidden (Spring Security 라우팅 이슈)
     *   - 이 핸들러로 400 Bad Request + 어떤 값들이 가능한지 안내
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException e) {
        String paramName = e.getName();
        Object badValue = e.getValue();
        Class<?> expectedType = e.getRequiredType();

        String message;
        if (expectedType != null && expectedType.isEnum()) {
            String allowed = Arrays.stream(expectedType.getEnumConstants())
                    .map(Object::toString)
                    .collect(Collectors.joining(", "));
            message = String.format(
                    "Invalid value '%s' for parameter '%s'. Allowed: %s",
                    badValue, paramName, allowed);
        } else {
            String typeName = expectedType != null ? expectedType.getSimpleName() : "unknown";
            message = String.format(
                    "Invalid value '%s' for parameter '%s'. Expected type: %s",
                    badValue, paramName, typeName);
        }

        log.warn("Bad request: {}", message);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ErrorResponse(HttpStatus.BAD_REQUEST.value(), "Bad Request", message));
    }

    /**
     * 표준 에러 응답 형식.
     */
    @Getter
    @RequiredArgsConstructor
    public static class ErrorResponse {
        private final int status;
        private final String error;
        private final String message;
        private final LocalDateTime timestamp = LocalDateTime.now();
    }
}