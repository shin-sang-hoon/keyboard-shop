package backend.repository;

import backend.entity.ChatbotQa;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * 챗봇 Q&A 리포지토리.
 *
 * 키워드 매칭은 200개 규모라 전체를 메모리에 올려 in-memory 스코어링한다
 * (LIKE 쿼리 N회보다 단순하고, 캐시 친화적). findAll() 결과를 ChatbotService 가
 * 한 번 로딩해 매칭에 사용.
 */
public interface ChatbotQaRepository extends JpaRepository<ChatbotQa, String> {

    List<ChatbotQa> findByCategory(String category);

    long countByCategory(String category);
}
