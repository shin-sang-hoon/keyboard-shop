package backend.repository;

import backend.entity.CrawlLog;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CrawlLogRepository extends JpaRepository<CrawlLog, Long> {
    List<CrawlLog> findBySiteName(String siteName);
    List<CrawlLog> findByStatus(CrawlLog.Status status);
    List<CrawlLog> findAllByOrderByCrawledAtDesc();
}