package backend.repository;

import backend.entity.UnknownQueryLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 챗봇 미답변 질의 로그 리포지토리.
 * 관리자/개발자가 미답변 패턴을 분석해 Q&A 를 보강하는 용도.
 */
public interface UnknownQueryLogRepository extends JpaRepository<UnknownQueryLog, Long> {

    Page<UnknownQueryLog> findAllByOrderByCreatedAtDesc(Pageable pageable);

    long countByReason(String reason);
}
