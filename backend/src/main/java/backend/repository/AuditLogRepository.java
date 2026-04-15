package backend.repository;

import backend.entity.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    List<AuditLog> findByAdminIdOrderByCreatedAtDesc(Long adminId);
    List<AuditLog> findByCategoryOrderByCreatedAtDesc(String category);
}