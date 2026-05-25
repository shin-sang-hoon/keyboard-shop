package backend.repository;

import backend.entity.Notice;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

/**
 * 공지사항 Repository (Phase 7-G 라운드 7 + 7-B 사용자 연동).
 *
 * 관리자 공지 CRUD + 사용자 공개 조회 공용. 정렬은 Service 의 Pageable 에서
 * 지정 (pinned DESC → id DESC : 고정 공지 먼저, 그 안에서 최신순).
 */
public interface NoticeRepository extends JpaRepository<Notice, Long> {

    /**
     * 제목 부분 검색 (대소문자 무시) + 페이징.
     * 검색어가 없을 때는 Service 에서 findAll(pageable) 을 쓴다.
     */
    Page<Notice> findByTitleContainingIgnoreCase(String title, Pageable pageable);

    // ─── 7-B: 사용자 상세 페이지 이전/다음 글 ──────────────────────
    // 인접 정렬은 pinned 무시, 순수 id 기준 (일반 게시판 관행).

    /**
     * "이전 글" — 현재보다 id 가 큰 것 중 가장 작은 id (= 바로 다음 최신 글).
     * 양 끝(최신 글)이면 Optional.empty.
     */
    Optional<Notice> findFirstByIdGreaterThanOrderByIdAsc(Long id);

    /**
     * "다음 글" — 현재보다 id 가 작은 것 중 가장 큰 id (= 바로 이전 오래된 글).
     * 양 끝(가장 오래된 글)이면 Optional.empty.
     */
    Optional<Notice> findFirstByIdLessThanOrderByIdDesc(Long id);

    // ─── 7-B: 조회수 원자적 증가 ────────────────────────────────

    /**
     * 조회수 +1 — UPDATE ... SET view_count = view_count + 1 원자 연산.
     *
     * read-modify-write (엔티티 로드 후 setViewCount) 대신 DB 단일 UPDATE 로
     * 처리해 동시 조회 시 lost update 를 막는다.
     * 반환값은 영향 행 수 — 0 이면 해당 id 공지 없음 (Service 에서 404).
     * clearAutomatically=true : UPDATE 후 영속성 컨텍스트를 비워
     * 같은 트랜잭션의 후속 findById 가 증가분이 반영된 값을 읽도록 한다.
     */
    @Modifying(clearAutomatically = true)
    @Query("UPDATE Notice n SET n.viewCount = n.viewCount + 1 WHERE n.id = :id")
    int incrementViewCount(@Param("id") Long id);
}
