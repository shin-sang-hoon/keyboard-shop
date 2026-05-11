package backend.config.audit;

import backend.entity.AuditCategory;
import backend.entity.AuditEventType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

/**
 * AuditLog 저장 요청 이벤트 (DTO).
 *
 * AuditLogAspect 에서 발행 → AuditLogEventListener 가 @Async 로 수신.
 * 트랜잭션 분리 + 비동기 처리로 본 작업 latency 영향 0.
 */
@Getter
@Builder
@AllArgsConstructor
public class AuditLogEvent {
    private final Long adminId;
    private final AuditCategory category;
    private final AuditEventType eventType;
    private final String targetType;
    private final String targetId;
    private final String detail;        // JSON 직렬화된 인자 (민감 정보 마스킹됨)
    private final String ipAddress;
    private final String userAgent;
    private final String result;        // SUCCESS / FAILURE
    private final Long durationMs;
}
