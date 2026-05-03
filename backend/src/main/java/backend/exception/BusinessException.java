package backend.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/**
 * 비즈니스 예외 통합 클래스 (5-H A6 추가).
 *
 * Service 레이어에서 도메인 규칙 위반 시 던지는 RuntimeException.
 * GlobalExceptionHandler 가 status 별로 적절한 HTTP 응답으로 변환.
 *
 * Static factory 4개 (notFound/forbidden/badRequest/conflict) 로
 * 호출부에서 의도가 명확.
 *
 * 면접 포인트:
 *  - RuntimeException 상속 → @Transactional 자동 롤백
 *  - HttpStatus 를 예외 자체에 보유 → 핸들러 1개로 다 처리
 *  - Service 가 HTTP 를 알아도 되나? → 도메인 의미("이미 존재")를 HTTP 시맨틱(409)에
 *    매핑하는 책임은 Service 가 가장 잘 안다. Spring 표준 패턴.
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

    public static BusinessException badRequest(String message) {
        return new BusinessException(HttpStatus.BAD_REQUEST, message);
    }

    public static BusinessException conflict(String message) {
        return new BusinessException(HttpStatus.CONFLICT, message);
    }
}
