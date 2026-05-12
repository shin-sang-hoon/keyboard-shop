package backend.repository.spec;

import backend.entity.AuditCategory;
import backend.entity.AuditEventType;
import backend.entity.AuditLog;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * AuditLog 동적 필터 조합용 Specification.
 *
 * 설계 이유:
 *  - 필터 조합이 다양 (adminId / category / eventType / result / 기간)
 *  - @Query 메서드를 모든 조합마다 만들면 폭증 (2^5 = 32 케이스)
 *  - Specification 으로 동적 조합 — 들어온 파라미터만 WHERE 절에 붙임
 *
 * Repository 가 JpaSpecificationExecutor<AuditLog> 상속해야 사용 가능.
 *
 * 면접 자산:
 *  - 동적 쿼리 패턴 (Spring Data JPA Specification)
 *  - QueryDSL 안 쓰고도 Criteria API 로 깔끔하게 처리 가능
 */
public class AuditLogSpecifications {

    private AuditLogSpecifications() {}  // util class

    /**
     * 모든 필터 조합 — null 인 파라미터는 무시.
     */
    public static Specification<AuditLog> filter(
            Long adminId,
            AuditCategory category,
            AuditEventType eventType,
            String result,
            LocalDateTime dateFrom,
            LocalDateTime dateTo
    ) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (adminId != null) {
                predicates.add(cb.equal(root.get("admin").get("id"), adminId));
            }
            if (category != null) {
                predicates.add(cb.equal(root.get("category"), category));
            }
            if (eventType != null) {
                predicates.add(cb.equal(root.get("eventType"), eventType));
            }
            if (result != null && !result.isBlank()) {
                predicates.add(cb.equal(root.get("result"), result));
            }
            if (dateFrom != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), dateFrom));
            }
            if (dateTo != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), dateTo));
            }

            return predicates.isEmpty() ? cb.conjunction() : cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
