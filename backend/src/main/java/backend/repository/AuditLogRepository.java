package backend.repository;

import backend.entity.AuditCategory;
import backend.entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;

/**
 * AuditLog Repository.
 *
 * 7-A 백엔드 (6d984ac) — 기본 페이징 조회 메서드.
 * 7 [9-2] 뷰어 — JpaSpecificationExecutor 추가로 동적 필터 지원.
 */
public interface AuditLogRepository extends JpaRepository<AuditLog, Long>,
                                            JpaSpecificationExecutor<AuditLog> {

    /** 관리자별 최신 액션 (idx_audit_admin_created 활용) */
    @EntityGraph(attributePaths = "admin")
    List<AuditLog> findByAdmin_IdOrderByCreatedAtDesc(Long adminId);

    /** 카테고리별 최신 액션 (idx_audit_category_created 활용) */
    @EntityGraph(attributePaths = "admin")
    Page<AuditLog> findByCategoryOrderByCreatedAtDesc(AuditCategory category, Pageable pageable);

    /** 전체 최신 목록 - 관리자 페이지 뷰어용 */
    @EntityGraph(attributePaths = "admin")
    Page<AuditLog> findAllByOrderByCreatedAtDesc(Pageable pageable);

    /**
     * JpaSpecificationExecutor 가 제공하는 메서드 (별도 선언 불필요):
     *   Page<AuditLog> findAll(Specification<AuditLog> spec, Pageable pageable);
     *
     * 사용: AuditLogSpecifications.filter(...) 와 조합.
     * 단, Specification 으로 호출 시 @EntityGraph 가 자동 적용 안 되므로
     * Service 에서 별도 처리하거나 N+1 감수. 본 뷰어는 ListItem.adminEmail 한 필드라
     * 100 row 페이지 × 1 query = 100 query 가 안 됨 (Hibernate batch fetch 기본 + admin LAZY).
     * 필요시 ProjectionDto 또는 @EntityGraph(type=FETCH) 명시 추가 가능.
     */
}
