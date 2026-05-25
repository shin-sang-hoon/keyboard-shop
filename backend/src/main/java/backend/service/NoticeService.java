package backend.service;

import backend.dto.NoticeDto;
import backend.dto.PagedResponse;
import backend.entity.Notice;
import backend.exception.BusinessException;
import backend.repository.NoticeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 공개 공지 서비스 (Phase 7-B — 사용자 공지 연동).
 *
 * 기능: 목록(서버 페이징) / 상세(이전·다음 글 통합) / 조회수 증가.
 *
 * 설계 노트:
 *   - 목록 정렬은 AdminNoticeService 와 동일 — pinned DESC → id DESC.
 *     관리자 페이지와 사용자 페이지가 같은 순서로 보여야 일관적이다.
 *   - 사용자 페이지는 제목 검색이 없다 (HomePage 공지 영역은 단순 페이징).
 *     검색이 필요하면 관리자 페이지에서 한다.
 *   - 조회수 증가는 GET 이 아닌 별도 POST 로 분리 — GET 의 멱등성 보존.
 *     증가는 read-modify-write 대신 DB UPDATE ... SET view_count = view_count + 1
 *     원자 연산으로 처리 → 동시 조회 시 lost update 방지.
 */
@Service
@RequiredArgsConstructor
public class NoticeService {

    private final NoticeRepository noticeRepository;

    private static final int DEFAULT_PAGE_SIZE = 10;
    private static final int MAX_PAGE_SIZE = 100;

    /** 목록 정렬: 고정 공지 먼저(pinned DESC) → 최신순(id DESC). */
    private static final Sort LIST_SORT = Sort.by(
            Sort.Order.desc("pinned"),
            Sort.Order.desc("id")
    );

    /**
     * 공지 목록 (서버 페이징).
     *
     * HomePage 공지 영역이 10개씩 끊어서 보여주고 이전/다음 페이지 버튼을
     * 쓰므로, 클라이언트 전체 슬라이스 대신 서버 페이징으로 내려준다.
     */
    @Transactional(readOnly = true)
    public PagedResponse<NoticeDto.ListItem> list(int page, int size) {
        int safeSize = size <= 0 ? DEFAULT_PAGE_SIZE : Math.min(size, MAX_PAGE_SIZE);
        Pageable pageable = PageRequest.of(Math.max(page, 0), safeSize, LIST_SORT);

        Page<Notice> result = noticeRepository.findAll(pageable);
        return PagedResponse.from(result.map(NoticeDto.ListItem::from));
    }

    /**
     * 공지 단건 상세 — 본문 + 이전/다음 글을 한 응답에 통합.
     *
     * 인접 글은 pinned 무시, 순수 id 기준:
     *   - prev (이전 글) : 현재보다 큰 id 중 가장 작은 것 = 바로 다음 최신 글
     *   - next (다음 글) : 현재보다 작은 id 중 가장 큰 것 = 바로 이전 오래된 글
     */
    @Transactional(readOnly = true)
    public NoticeDto.Detail get(Long id) {
        Notice notice = noticeRepository.findById(id)
                .orElseThrow(() -> BusinessException.notFound(
                        "공지를 찾을 수 없습니다. id=" + id));

        Notice prev = noticeRepository
                .findFirstByIdGreaterThanOrderByIdAsc(id)
                .orElse(null);
        Notice next = noticeRepository
                .findFirstByIdLessThanOrderByIdDesc(id)
                .orElse(null);

        return NoticeDto.Detail.from(notice, prev, next);
    }

    /**
     * 조회수 +1 — POST /api/notices/{id}/view 전용.
     *
     * UPDATE ... SET view_count = view_count + 1 원자 연산.
     * 영향 행이 0 이면 존재하지 않는 공지 → 404.
     * clearAutomatically 로 영속성 컨텍스트를 비운 뒤 다시 읽어
     * 증가가 반영된 최신 조회수를 응답한다.
     */
    @Transactional
    public NoticeDto.ViewCountResponse increaseViewCount(Long id) {
        int updated = noticeRepository.incrementViewCount(id);
        if (updated == 0) {
            throw BusinessException.notFound("공지를 찾을 수 없습니다. id=" + id);
        }

        Notice notice = noticeRepository.findById(id)
                .orElseThrow(() -> BusinessException.notFound(
                        "공지를 찾을 수 없습니다. id=" + id));

        return new NoticeDto.ViewCountResponse(notice.getViewCount());
    }
}
