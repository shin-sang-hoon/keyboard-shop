package backend.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.catalina.connector.ClientAbortException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.stream.Collectors;

/**
 * 컨트롤러 단의 공통 예외 처리. 잘못된 enum 입력 같은 클라이언트 오류와
 * 비즈니스 예외를 적절한 4xx 응답으로 변환해 UX 개선.
 *
 * 5-G 마무리 시점 (4/27) 추가 — MethodArgumentTypeMismatchException.
 * 5-H A6 (5/3) 추가 — BusinessException (notFound/forbidden/badRequest/conflict).
 * 7-A (5/11) 추가 — Exception catch-all (RuntimeException → 401 잘못 반환 → 500 정정).
 * 5-B fix (5/12) 추가 — Client abort (연결 끊김) 분리 처리 (운영 로그 노이즈 분리).
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
     * 비즈니스 예외 (404/403/400/409) 통합 처리.
     * Service 레이어에서 BusinessException 던지면 자동으로 적절한 HTTP status 변환.
     *
     * 예:
     *   - 404: 리뷰/주문/상품 없음
     *   - 403: 본인 리뷰 아님, 본인 주문 아님
     *   - 400: rating 범위 위반, 배송 미완료 상태에서 리뷰 작성
     *   - 409: 이미 리뷰 작성된 OrderItem 에 중복 시도
     */
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ErrorResponse> handleBusinessException(BusinessException e) {
        log.warn("Business exception [{}]: {}", e.getStatus(), e.getMessage());
        return ResponseEntity.status(e.getStatus())
                .body(new ErrorResponse(
                        e.getStatus().value(),
                        e.getStatus().getReasonPhrase(),
                        e.getMessage()));
    }

    /**
     * 클라이언트 연결 끊김 (Tomcat ClientAbortException) — 운영 로그 노이즈 분리.
     *
     * Tomcat 이 직접 던지는 ClientAbortException 타입을 잡음.
     * 일부 케이스 (래핑되지 않은 raw IOException) 는 아래 handleIOException 에서 처리.
     */
    @ExceptionHandler(ClientAbortException.class)
    public void handleClientAbort(ClientAbortException e) {
        log.warn("Client aborted connection (ClientAbortException): {}", e.getMessage());
    }

    /**
     * IOException 중 클라이언트 연결 끊김으로 추정되는 케이스 — WARN 로 분리.
     *
     * 배경 (5-B 검증 중 발견, 5/12):
     *  - 로그인 200 OK 후 클라이언트가 응답 받기 전 연결 종료 시
     *    Tomcat 버전에 따라 ClientAbortException 으로 래핑 안 되고
     *    raw IOException 으로 던져지는 케이스 있음.
     *  - 메시지에 "failed to flush" / "Connection reset" 등 패턴으로 식별.
     *  - 이전엔 catch-all 에서 잡혀 ERROR 로그 + 풀 스택트레이스 → 운영 로그 노이즈.
     *
     * 처리 방식:
     *  - 메시지 패턴 검사로 클라이언트 끊김 판별 → WARN
     *  - 다른 IOException 은 catch-all 로 떨어져 500 처리
     */
    @ExceptionHandler(IOException.class)
    public ResponseEntity<ErrorResponse> handleIOException(IOException e) {
        String msg = e.getMessage();
        if (msg != null && (msg.contains("failed to flush")
                || msg.contains("Broken pipe")
                || msg.contains("Connection reset"))) {
            // 클라이언트 끊김 — WARN 로만, 응답 본문 의미 없음
            log.warn("Client aborted connection (IOException): {}", msg);
            return null;
        }
        // 진짜 서버측 IO 오류 — 500
        log.error("Unexpected IOException: {}", msg, e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse(
                        HttpStatus.INTERNAL_SERVER_ERROR.value(),
                        "Internal Server Error",
                        "An I/O error occurred. Please try again later."));
    }

    /**
     * 처리되지 않은 모든 예외의 catch-all — 500 Internal Server Error.
     *
     * 추가 배경 (7-A 검증 중 발견, 5/11):
     *  - 기존엔 RuntimeException 이 GlobalExceptionHandler 에 잡히지 않아
     *    Spring Security ExceptionTranslationFilter 까지 올라가서
     *    AuthenticationEntryPoint 가 호출되어 401 응답이 나오는 버그.
     *  - 인증/인가와 무관한 비즈니스 실패가 401 로 표시되는 잘못된 HTTP semantics.
     *  - 5-B 의 401/403 분리 원칙과 일관되도록 500 으로 명시적 처리.
     *
     * 운영 안전성:
     *  - 스택트레이스는 log.error 로만 (사용자 응답엔 메시지만)
     *  - BusinessException 으로 명시 안 한 예외는 서버 버그로 간주 → 500
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception e) {
        log.error("Unhandled exception: {}", e.getMessage(), e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse(
                        HttpStatus.INTERNAL_SERVER_ERROR.value(),
                        "Internal Server Error",
                        "An unexpected error occurred. Please try again later."));
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
