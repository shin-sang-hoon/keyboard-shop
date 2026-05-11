package backend.repository;

import backend.entity.AuditCategory;
import backend.entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    /** 관리자별 최신 액션 (idx_audit_admin_created 활용) */
    @EntityGraph(attributePaths = "admin")
    List<AuditLog> findByAdmin_IdOrderByCreatedAtDesc(Long adminId);

    /** 카테고리별 최신 액션 (idx_audit_category_created 활용) */
    @EntityGraph(attributePaths = "admin")
    Page<AuditLog> findByCategoryOrderByCreatedAtDesc(AuditCategory category, Pageable pageable);

    /** 전체 최신 목록 - 관리자 페이지 뷰어용 */
    @EntityGraph(attributePaths = "admin")
    Page<AuditLog> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
