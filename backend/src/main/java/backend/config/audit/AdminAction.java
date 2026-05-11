package backend.config.audit;

import backend.entity.AuditCategory;
import backend.entity.AuditEventType;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 관리자 액션 감사 로깅 어노테이션.
 *
 * 사용 예:
 *   @AdminAction(category = AuditCategory.PRODUCT, eventType = AuditEventType.UPDATE)
 *   public void updateProduct(Long id, ProductDto dto) { ... }
 *
 * AuditLogAspect 가 @Around 로 가로채서 자동 로깅한다.
 * 본 비즈니스 로직 실행 후 ApplicationEventPublisher 로 이벤트만 발행하고,
 * 실제 DB 저장은 AuditLogEventListener 가 @Async + 별도 트랜잭션으로 처리.
 *
 * 면접 포인트:
 *   - "감사 로그 저장 실패가 본 비즈니스 로직 롤백을 일으키면 안 된다"
 *   - 그래서 동기 저장 ❌, ApplicationEventPublisher + @Async ✓
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface AdminAction {
    AuditCategory category();
    AuditEventType eventType();

    /**
     * target_id 를 메서드 인자 중 어떤 위치에서 가져올지 (0-indexed).
     * -1 (기본값) 이면 target_id 미기록.
     * 예: updateProduct(Long id, dto) 에서 id 는 0번 인자 → targetIdParam = 0
     */
    int targetIdParam() default -1;

    /**
     * target_type 명시. 미지정 시 category 이름 사용.
     * 예: category=PRODUCT 면 자동으로 "PRODUCT"
     */
    String targetType() default "";
}
