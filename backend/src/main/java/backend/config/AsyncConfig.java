package backend.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;

/**
 * 비동기 처리 설정.
 *
 * AuditLog 저장 전용 Executor 분리:
 *   - 핵심 풀 2, 최대 5, 큐 100
 *   - 큐 가득 차면 CallerRunsPolicy (이벤트 발행자 스레드에서 처리)
 *     → 감사 로그 유실 방지 (관리자 액션 추적은 누락되면 의미 없음)
 *
 * 면접 포인트:
 *   - 비동기 작업 풀 격리 (감사 로그 / 메일 발송 / 통계 집계 등 각자 풀)
 *   - 거부 정책 설계 — CallerRunsPolicy 는 백프레셔 효과
 */
@Configuration
@EnableAsync
@Slf4j
public class AsyncConfig {

    @Bean(name = "auditLogExecutor")
    public Executor auditLogExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(5);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("audit-log-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(10);
        executor.initialize();
        log.info("AuditLog Executor initialized — core=2, max=5, queue=100, rejection=CallerRuns");
        return executor;
    }
}
