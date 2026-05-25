package backend.repository;

import backend.entity.Notice;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 공지사항 Repository (Phase 7-G 라운드 7).
 *
 * 관리자 공지 CRUD 용. 정렬은 Service 의 Pageable 에서 지정
 * (pinned DESC → id DESC : 고정 공지 먼저, 그 안에서 최신순).
 */
public interface NoticeRepository extends JpaRepository<Notice, Long> {

    /**
     * 제목 부분 검색 (대소문자 무시) + 페이징.
     * 검색어가 없을 때는 Service 에서 findAll(pageable) 을 쓴다.
     */
    Page<Notice> findByTitleContainingIgnoreCase(String title, Pageable pageable);
}
