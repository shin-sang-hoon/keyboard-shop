package backend.controller.admin;

import backend.config.audit.AdminAction;
import backend.entity.AuditCategory;
import backend.entity.AuditEventType;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * AuditLog @Aspect 동작 검증용 더미 컨트롤러.
 * 검증 후 삭제하거나 진짜 ADMIN 컨트롤러로 대체할 것.
 *
 * 사용:
 *   curl -X POST http://localhost:8081/api/test-audit/product/42 \
 *     -H "Content-Type: application/json" \
 *     -d "{\"name\":\"new\",\"password\":\"should-be-masked\"}"
 *   → audit_logs 테이블에 row 생성 확인
 *
 * 검증 시나리오:
 *   1) UPDATE 성공 — POST /product/{id} → category=PRODUCT, event_type=UPDATE, result=SUCCESS
 *   2) DELETE 성공 — DELETE /product/{id} → category=PRODUCT, event_type=DELETE, result=SUCCESS
 *   3) CRAWLER 실행 — POST /crawler/execute → category=CRAWLER, event_type=EXECUTE
 *   4) 의도적 실패 — POST /fail/{id} → result=FAILURE 기록 + 본 메서드 예외 전파 → 500 응답
 *   5) 민감 정보 마스킹 — body 의 password 필드가 detail 컬럼에 "***MASKED***" 로 저장
 *
 * 7-A (5/11) 수정:
 *   - shouldFail 에 @PathVariable Long id 추가 → targetIdParam=0 이 실제 id 가리키도록 정정
 *   - UPDATE/DELETE 와 시그니처 일관성 맞춤
 */
@RestController
@RequestMapping("/api/test-audit")
@RequiredArgsConstructor
public class TestAuditController {

    @PostMapping("/product/{id}")
    @AdminAction(category = AuditCategory.PRODUCT, eventType = AuditEventType.UPDATE, targetIdParam = 0)
    public Map<String, Object> updateProduct(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return Map.of("ok", true, "id", id, "body", body);
    }

    @DeleteMapping("/product/{id}")
    @AdminAction(category = AuditCategory.PRODUCT, eventType = AuditEventType.DELETE, targetIdParam = 0)
    public Map<String, Object> deleteProduct(@PathVariable Long id) {
        return Map.of("ok", true, "deleted", id);
    }

    @PostMapping("/crawler/execute")
    @AdminAction(category = AuditCategory.CRAWLER, eventType = AuditEventType.EXECUTE)
    public Map<String, Object> executeCrawler(@RequestBody Map<String, Object> body) {
        return Map.of("ok", true, "started", true);
    }

    @PostMapping("/fail/{id}")
    @AdminAction(category = AuditCategory.PRODUCT, eventType = AuditEventType.UPDATE, targetIdParam = 0)
    public Map<String, Object> shouldFail(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        throw new RuntimeException("Intentional failure for audit FAILURE test (id=" + id + ")");
    }
}
