package backend.service;

import backend.dto.AdminNoticeDto;
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
 * 관리자 공지 관리 서비스 (Phase 7-G 라운드 7).
 *
 * 기능: 목록(페이징+제목검색) / 상세 / 등록 / 수정 / 삭제 — 공지 CRUD 전체.
 *
 * 설계 노트:
 *   - 정렬: pinned DESC → id DESC (고정 공지 최상단, 그 안에서 최신순).
 *   - 제목 검색: 값이 있으면 findByTitleContainingIgnoreCase, 없으면 findAll.
 *   - title/content 는 필수 — 빈 값이면 400.
 *   - viewCount 는 등록 시 0, 수정 시 보존 (수정 폼에서 건드리지 않음).
 *     증가 로직은 사용자 노출 페이지 DB 연동 단계에서 별도로 붙는다.
 */
@Service
@RequiredArgsConstructor
public class AdminNoticeService {

    private final NoticeRepository noticeRepository;

    private static final int MAX_PAGE_SIZE = 100;
    private static final int MAX_TITLE_LEN = 200;

    /** 목록 정렬: 고정 공지 먼저(pinned DESC) → 최신순(id DESC). */
    private static final Sort LIST_SORT = Sort.by(
            Sort.Order.desc("pinned"),
            Sort.Order.desc("id")
    );

    /**
     * 공지 목록 (페이징 + 제목 검색).
     *
     * @param search 제목 부분 검색어 (null·"" 이면 전체)
     */
    @Transactional(readOnly = true)
    public PagedResponse<AdminNoticeDto.ListItem> list(String search, int page, int size) {
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        Pageable pageable = PageRequest.of(Math.max(page, 0), safeSize, LIST_SORT);

        Page<Notice> result;
        if (search == null || search.isBlank()) {
            result = noticeRepository.findAll(pageable);
        } else {
            result = noticeRepository.findByTitleContainingIgnoreCase(search.trim(), pageable);
        }
        return PagedResponse.from(result.map(AdminNoticeDto.ListItem::from));
    }

    /**
     * 공지 단건 상세 (본문 포함) — 수정 모달 진입용.
     */
    @Transactional(readOnly = true)
    public AdminNoticeDto.Detail get(Long id) {
        Notice notice = findOrThrow(id);
        return AdminNoticeDto.Detail.from(notice);
    }

    /**
     * 공지 등록.
     */
    @Transactional
    public AdminNoticeDto.Detail create(AdminNoticeDto.SaveRequest req) {
        String title = requireTitle(req.title());
        String content = requireContent(req.content());

        Notice notice = Notice.builder()
                .title(title)
                .content(content)
                .pinned(Boolean.TRUE.equals(req.pinned()))   // null-safe
                .viewCount(0)
                .build();

        Notice saved = noticeRepository.save(notice);
        return AdminNoticeDto.Detail.from(saved);
    }

    /**
     * 공지 수정. viewCount / createdAt 은 보존.
     */
    @Transactional
    public AdminNoticeDto.Detail update(Long id, AdminNoticeDto.SaveRequest req) {
        Notice notice = findOrThrow(id);

        notice.setTitle(requireTitle(req.title()));
        notice.setContent(requireContent(req.content()));
        notice.setPinned(Boolean.TRUE.equals(req.pinned()));
        // viewCount / createdAt 은 의도적으로 건드리지 않음.
        // updatedAt 은 @PreUpdate 가 자동 갱신.

        return AdminNoticeDto.Detail.from(notice);
    }

    /**
     * 공지 삭제.
     */
    @Transactional
    public void delete(Long id) {
        Notice notice = findOrThrow(id);
        noticeRepository.delete(notice);
    }

    // ─── 내부 헬퍼 ───────────────────────────────────────────────

    private Notice findOrThrow(Long id) {
        return noticeRepository.findById(id)
                .orElseThrow(() -> BusinessException.notFound(
                        "공지를 찾을 수 없습니다. id=" + id));
    }

    private String requireTitle(String raw) {
        if (raw == null || raw.isBlank()) {
            throw BusinessException.badRequest("제목을 입력해 주세요.");
        }
        String trimmed = raw.trim();
        if (trimmed.length() > MAX_TITLE_LEN) {
            throw BusinessException.badRequest(
                    "제목은 " + MAX_TITLE_LEN + "자 이내로 입력해 주세요.");
        }
        return trimmed;
    }

    private String requireContent(String raw) {
        if (raw == null || raw.isBlank()) {
            throw BusinessException.badRequest("본문을 입력해 주세요.");
        }
        return raw;
    }
}
