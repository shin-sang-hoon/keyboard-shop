package backend.dto;

import backend.entity.Notice;

import java.time.LocalDateTime;

/**
 * 관리자 공지 관리 DTO (Phase 7-G 라운드 7).
 *
 * 중첩 구조:
 *   - AdminNoticeDto.ListItem  : 목록 1행 (본문 제외 — 페이로드 절감)
 *   - AdminNoticeDto.Detail    : 상세/수정 모달용 (본문 포함)
 *   - AdminNoticeDto.SaveRequest : 등록·수정 공용 요청 body
 *
 * 목록은 본문(content)을 빼서 가볍게, 상세 조회 시에만 본문을 내린다
 * (AuditLog 뷰어의 ListItem/Detail 분리와 동일 패턴).
 */
public final class AdminNoticeDto {

    private AdminNoticeDto() {}

    /** 목록 1행 — 본문 제외. */
    public record ListItem(
            Long id,
            String title,
            boolean pinned,
            int viewCount,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
        public static ListItem from(Notice n) {
            return new ListItem(
                    n.getId(),
                    n.getTitle(),
                    n.isPinned(),
                    n.getViewCount(),
                    n.getCreatedAt(),
                    n.getUpdatedAt()
            );
        }
    }

    /** 상세 — 본문 포함 (수정 모달 진입 시 사용). */
    public record Detail(
            Long id,
            String title,
            String content,
            boolean pinned,
            int viewCount,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
        public static Detail from(Notice n) {
            return new Detail(
                    n.getId(),
                    n.getTitle(),
                    n.getContent(),
                    n.isPinned(),
                    n.getViewCount(),
                    n.getCreatedAt(),
                    n.getUpdatedAt()
            );
        }
    }

    /**
     * 등록·수정 공용 요청 body.
     * POST /api/admin/notices            { title, content, pinned }
     * PUT  /api/admin/notices/{id}       { title, content, pinned }
     */
    public record SaveRequest(
            String title,
            String content,
            Boolean pinned      // null 허용 → Service 에서 false 로 기본값 처리
    ) {
    }
}
