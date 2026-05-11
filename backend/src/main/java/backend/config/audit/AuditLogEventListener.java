package backend.config.audit;

import backend.entity.AuditLog;
import backend.entity.User;
import backend.repository.AuditLogRepository;
import backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * AuditLogEvent 비동기 수신 + DB 저장.
 *
 * 핵심 설계:
 *   1. @Async — 본 비즈니스 로직 스레드와 분리. 감사 로그 저장 latency 영향 0.
 *   2. @Transactional(propagation = REQUIRES_NEW) — 본 비즈니스 트랜잭션과 분리.
 *      → 본 비즈니스 commit 됐는데 감사 로그 저장 실패해도 본 작업은 보존됨.
 *      → 반대도 성립: 감사 로그는 항상 기록되도록 (FAILURE 도 SUCCESS 로 기록)
 *
 * 면접 포인트:
 *   - "감사 로그는 본 비즈니스 결과를 기록하는 사이드 이펙트일 뿐"
 *   - "기록 실패가 본 작업 롤백을 일으키면 안 됨"
 *   - "그래서 별도 트랜잭션 + 비동기"
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class AuditLogEventListener {

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    @Async("auditLogExecutor")
    @EventListener
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onAuditLogEvent(AuditLogEvent event) {
        try {
            // admin 조회 — adminId 있으면 lazy proxy, 없으면 null (anonymous)
            User admin = event.getAdminId() != null
                    ? userRepository.findById(event.getAdminId()).orElse(null)
                    : null;

            AuditLog auditLog = AuditLog.builder()
                    .admin(admin)
                    .category(event.getCategory())
                    .eventType(event.getEventType())
                    .targetType(event.getTargetType())
                    .targetId(event.getTargetId())
                    .detail(event.getDetail())
                    .ipAddress(event.getIpAddress())
                    .userAgent(event.getUserAgent())
                    .result(event.getResult())
                    .durationMs(event.getDurationMs())
                    .build();

            auditLogRepository.save(auditLog);
        } catch (Exception e) {
            // 감사 로그 저장 실패는 로그만 남기고 삼킴 — 절대 본 작업에 영향 주지 않음
            log.error("AuditLog 저장 실패 — category={}, eventType={}, adminId={}",
                    event.getCategory(), event.getEventType(), event.getAdminId(), e);
        }
    }
}
