package backend.config.audit;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;

/**
 * 관리자 액션 감사 로깅 Aspect.
 *
 * @AdminAction 어노테이션 붙은 메서드를 @Around 로 가로채서:
 *   1. 시작 시각 측정
 *   2. SecurityContext 에서 actor (관리자 User) 추출
 *   3. HttpServletRequest 에서 IP, UA 추출
 *   4. 인자 JSON 직렬화 (민감 정보 마스킹)
 *   5. 본 메서드 실행
 *   6. 성공/실패 분기 + duration 측정
 *   7. ApplicationEventPublisher 로 이벤트 발행 (DB 저장은 비동기)
 *
 * 본 메서드가 예외 던져도 감사 로그는 FAILURE 로 기록 후 예외 재던지기.
 *
 * 7-A (5/11) 수정:
 *   - duration_ms 정확도 개선 — 단순 정수 나눗셈은 < 1ms 작업이 모두 0 으로
 *     truncate 되어 운영 분석 불가. 나노→밀리 반올림으로 변경.
 */
@Aspect
@Component
@Slf4j
@RequiredArgsConstructor
public class AuditLogAspect {

    private final ApplicationEventPublisher eventPublisher;
    private final ObjectMapper objectMapper;

    // 민감 정보 키 (대소문자 무관)
    private static final Set<String> SENSITIVE_KEYS = Set.of(
            "password", "passwd", "pwd",
            "token", "accesstoken", "refreshtoken",
            "secret", "apikey", "authorization"
    );

    @Around("@annotation(adminAction)")
    public Object logAdminAction(ProceedingJoinPoint joinPoint, AdminAction adminAction) throws Throwable {
        long startNs = System.nanoTime();

        // 1. actor 추출
        Long adminId = extractAdminId();

        // 2. HTTP 컨텍스트 추출 (없을 수도 있음 — 스케줄러/배치)
        String ipAddress = null;
        String userAgent = null;
        HttpServletRequest request = currentRequest();
        if (request != null) {
            ipAddress = extractClientIp(request);
            userAgent = abbreviate(request.getHeader("User-Agent"), 500);
        }

        // 3. target_id 추출
        Object[] args = joinPoint.getArgs();
        String targetId = extractTargetId(adminAction, args);

        // 4. target_type 추출
        String targetType = adminAction.targetType().isEmpty()
                ? adminAction.category().name()
                : adminAction.targetType();

        // 5. 인자 직렬화 (마스킹)
        String detail = serializeArgs(joinPoint, args);

        // 6. 실행 + try/catch
        Object result;
        String resultStatus = "SUCCESS";
        Throwable thrown = null;
        try {
            result = joinPoint.proceed();
        } catch (Throwable t) {
            resultStatus = "FAILURE";
            thrown = t;
            result = null;
        }

        // 나노초 → 밀리초 반올림 변환.
        // 단순 정수 나눗셈 (/1_000_000L) 은 < 1ms 작업이 모두 0 으로 truncate 되어
        // 운영 분석 불가능. 0.5ms 이상은 1로, 1.5ms 는 2로 반올림하도록 변경.
        long durationNs = System.nanoTime() - startNs;
        long durationMs = Math.round(durationNs / 1_000_000.0);

        // 7. 이벤트 발행
        try {
            AuditLogEvent event = AuditLogEvent.builder()
                    .adminId(adminId)
                    .category(adminAction.category())
                    .eventType(adminAction.eventType())
                    .targetType(targetType)
                    .targetId(targetId)
                    .detail(detail)
                    .ipAddress(ipAddress)
                    .userAgent(userAgent)
                    .result(resultStatus)
                    .durationMs(durationMs)
                    .build();
            eventPublisher.publishEvent(event);
        } catch (Exception e) {
            // 감사 로그 발행 실패가 본 비즈니스 로직에 영향 가면 안 됨 → 로그만 남기고 삼킴
            log.warn("AuditLog 이벤트 발행 실패 — 본 로직은 정상 진행. category={}, eventType={}",
                    adminAction.category(), adminAction.eventType(), e);
        }

        if (thrown != null) throw thrown;
        return result;
    }

    /** SecurityContext 에서 현재 인증된 관리자 User.id 추출. 인증 없으면 null. */
    private Long extractAdminId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return null;
        }
        // CustomUserDetails / 프로젝트의 Principal 구현체에서 id 추출
        // 프로젝트의 실제 Principal 타입에 맞춰 캐스팅 필요 — 안 맞으면 여기 수정
        Object principal = auth.getPrincipal();
        try {
            // 1순위: principal.getUser().getId() — CustomUserDetails 패턴
            Method getUser = principal.getClass().getMethod("getUser");
            Object user = getUser.invoke(principal);
            Method getId = user.getClass().getMethod("getId");
            return (Long) getId.invoke(user);
        } catch (Exception ignore) {
            // 2순위: principal.getId() — 직접 id 노출 패턴
            try {
                Method getId = principal.getClass().getMethod("getId");
                Object id = getId.invoke(principal);
                if (id instanceof Long) return (Long) id;
                if (id instanceof Number) return ((Number) id).longValue();
            } catch (Exception ignore2) {
                log.debug("Principal 에서 adminId 추출 실패 — null 로 기록: {}", principal.getClass().getName());
            }
            return null;
        }
    }

    /** 현재 HTTP 요청 컨텍스트. 없을 수도 (스케줄러/배치 등). */
    private HttpServletRequest currentRequest() {
        try {
            ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            return attrs == null ? null : attrs.getRequest();
        } catch (Exception e) {
            return null;
        }
    }

    /** X-Forwarded-For 우선 → remote addr 폴백. 프록시 환경 대비. */
    private String extractClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isEmpty()) {
            return abbreviate(xff.split(",")[0].trim(), 45);
        }
        return abbreviate(request.getRemoteAddr(), 45);
    }

    private String extractTargetId(AdminAction adminAction, Object[] args) {
        int idx = adminAction.targetIdParam();
        if (idx < 0 || idx >= args.length || args[idx] == null) return null;
        return String.valueOf(args[idx]);
    }

    /**
     * 메서드 인자를 JSON 으로 직렬화.
     * 파라미터 이름 기준으로 민감 정보 키는 "***MASKED***" 로 치환.
     */
    private String serializeArgs(ProceedingJoinPoint joinPoint, Object[] args) {
        try {
            MethodSignature sig = (MethodSignature) joinPoint.getSignature();
            String[] paramNames = sig.getParameterNames();
            Map<String, Object> map = new HashMap<>();
            for (int i = 0; i < args.length; i++) {
                String name = (paramNames != null && i < paramNames.length) ? paramNames[i] : "arg" + i;
                if (isSensitive(name)) {
                    map.put(name, "***MASKED***");
                } else {
                    map.put(name, args[i]);
                }
            }
            String json = objectMapper.writeValueAsString(map);
            // 민감 정보가 DTO 내부 필드에 있을 수 있어 1차 후처리 (간이 마스킹)
            json = maskSensitiveInJson(json);
            return abbreviate(json, 4000);  // detail 컬럼 TEXT 지만 과도하게 큰 페이로드 방어
        } catch (JsonProcessingException e) {
            return "<serialize failed: " + e.getMessage() + ">";
        } catch (Exception e) {
            return "<unknown args>";
        }
    }

    private boolean isSensitive(String name) {
        if (name == null) return false;
        String lower = name.toLowerCase();
        return SENSITIVE_KEYS.stream().anyMatch(lower::contains);
    }

    /** JSON 문자열 내에서 "password":"xxx" 같은 필드 마스킹 (1차 후처리). */
    private String maskSensitiveInJson(String json) {
        if (json == null) return null;
        String result = json;
        for (String key : SENSITIVE_KEYS) {
            // "key":"...값..." → "key":"***MASKED***"
            result = result.replaceAll(
                    "(?i)(\"" + key + "\"\\s*:\\s*)\"[^\"]*\"",
                    "$1\"***MASKED***\""
            );
        }
        return result;
    }

    private String abbreviate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }
}
