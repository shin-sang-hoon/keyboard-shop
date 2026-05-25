package backend.service;

import backend.dto.AdminNoticeDto;
import backend.dto.PagedResponse;
import backend.entity.Notice;
import backend.entity.NoticeAttachment;
import backend.exception.BusinessException;
import backend.repository.NoticeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * 관리자 공지 관리 서비스 (Phase 7-G 라운드 7 + 7-B 첨부 연동).
 *
 * 기능: 목록(페이징+제목검색) / 상세 / 등록 / 수정 / 삭제 — 공지 CRUD 전체.
 * 메인 페이지·관리자 페이지 양쪽의 공지 작성/수정/삭제가 모두 이 서비스를
 * 거친다 (호출 경로는 /api/admin/notices, ADMIN 가드).
 *
 * 7-B 변경:
 *   - create/update 가 첨부 이미지(MultipartFile)를 함께 받는다.
 *   - update 는 deleteAttachmentIds 로 기존 첨부 일부 삭제 + 새 이미지 추가.
 *   - delete 는 공지 삭제 전 디스크 파일을 먼저 정리한다.
 *   - 첨부 DB row 는 Notice 의 cascade(ALL+orphanRemoval)로 자동 관리되고,
 *     디스크 파일만 NoticeFileService 로 명시적으로 저장/삭제한다.
 */
@Service
@RequiredArgsConstructor
public class AdminNoticeService {

    private final NoticeRepository noticeRepository;
    private final NoticeFileService noticeFileService;

    private static final int MAX_PAGE_SIZE = 100;
    private static final int MAX_TITLE_LEN = 200;

    /** 목록 정렬: 고정 공지 먼저(pinned DESC) → 최신순(id DESC). */
    private static final Sort LIST_SORT = Sort.by(
            Sort.Order.desc("pinned"),
            Sort.Order.desc("id")
    );

    /**
     * 공지 목록 (페이징 + 제목 검색).
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
     * 공지 단건 상세 (본문 + 첨부 포함) — 수정 모달 진입용.
     */
    @Transactional(readOnly = true)
    public AdminNoticeDto.Detail get(Long id) {
        return AdminNoticeDto.Detail.from(findOrThrow(id));
    }

    /**
     * 공지 등록 — 첨부 이미지 포함.
     */
    @Transactional
    public AdminNoticeDto.Detail create(String title, String content, boolean pinned,
                                        List<MultipartFile> images) {
        Notice notice = Notice.builder()
                .title(requireTitle(title))
                .content(requireContent(content))
                .pinned(pinned)
                .viewCount(0)
                .build();

        attachImages(notice, images);

        Notice saved = noticeRepository.save(notice);   // cascade 로 첨부도 저장
        return AdminNoticeDto.Detail.from(saved);
    }

    /**
     * 공지 수정 — 제목/본문/고정 갱신 + 첨부 삭제·추가. viewCount/createdAt 보존.
     *
     * @param deleteAttachmentIds 삭제할 기존 첨부 id (null 이면 삭제 없음)
     * @param images              새로 추가할 이미지 (null 이면 추가 없음)
     */
    @Transactional
    public AdminNoticeDto.Detail update(Long id, String title, String content, boolean pinned,
                                        List<MultipartFile> images,
                                        List<Long> deleteAttachmentIds) {
        Notice notice = findOrThrow(id);

        notice.setTitle(requireTitle(title));
        notice.setContent(requireContent(content));
        notice.setPinned(pinned);

        // 삭제 지정된 기존 첨부 — 디스크 파일 + DB row(orphanRemoval) 제거.
        if (deleteAttachmentIds != null && !deleteAttachmentIds.isEmpty()) {
            List<NoticeAttachment> toRemove = notice.getAttachments().stream()
                    .filter(a -> deleteAttachmentIds.contains(a.getId()))
                    .toList();
            for (NoticeAttachment a : toRemove) {
                noticeFileService.delete(a.getStoredName());
                notice.removeAttachment(a);
            }
        }

        // 새 이미지 추가.
        attachImages(notice, images);

        return AdminNoticeDto.Detail.from(notice);
    }

    /**
     * 공지 삭제 — 디스크 첨부 파일을 먼저 정리한 뒤 공지 삭제
     * (첨부 DB row 는 cascade 로 함께 삭제).
     */
    @Transactional
    public void delete(Long id) {
        Notice notice = findOrThrow(id);
        for (NoticeAttachment a : notice.getAttachments()) {
            noticeFileService.delete(a.getStoredName());
        }
        noticeRepository.delete(notice);
    }

    // ─── 내부 헬퍼 ───────────────────────────────────────────────

    /** 이미지 목록을 디스크에 저장하고 NoticeAttachment 로 공지에 붙인다. */
    private void attachImages(Notice notice, List<MultipartFile> images) {
        if (images == null) {
            return;
        }
        for (MultipartFile file : images) {
            if (file == null || file.isEmpty()) {
                continue;   // 빈 파트는 건너뜀 (프론트가 빈 input 을 보낼 수 있음)
            }
            NoticeFileService.StoredFile sf = noticeFileService.store(file);
            NoticeAttachment attachment = NoticeAttachment.builder()
                    .originalName(sf.originalName())
                    .storedName(sf.storedName())
                    .url(sf.url())
                    .contentType(sf.contentType())
                    .fileSize(sf.size())
                    .build();
            notice.addAttachment(attachment);
        }
    }

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
