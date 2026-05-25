package backend.dto;

import backend.entity.Notice;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 관리자 공지 관리 DTO (Phase 7-G 라운드 7 + 7-B 첨부 연동).
 *
 * 중첩 구조:
 *   - AdminNoticeDto.ListItem : 목록 1행 (본문·첨부 제외 — 페이로드 절감)
 *   - AdminNoticeDto.Detail   : 상세/수정 모달용 (본문 + 첨부 포함)
 *
 * 7-B 변경:
 *   - Detail 에 attachments 추가 (수정 모달이 기존 첨부를 보여주고
 *     일부를 삭제 지정할 수 있도록).
 *   - SaveRequest(JSON record) 제거 — 작성/수정이 첨부 업로드를 포함하는
 *     multipart/form-data 로 전환되어 Controller 에서 @RequestParam 으로
 *     개별 필드를 받는다.
 *
 * 첨부 표현(Attachment)은 공개 DTO 와 동일하므로 NoticeDto.Attachment 를
 * 공유한다 (중복 정의 회피).
 */
public final class AdminNoticeDto {

    private AdminNoticeDto() {}

    /** 목록 1행 — 본문·첨부 제외. */
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

    /** 상세 — 본문 + 첨부 포함 (수정 모달 진입 / 작성·수정 응답). */
    public record Detail(
            Long id,
            String title,
            String content,
            boolean pinned,
            int viewCount,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            List<NoticeDto.Attachment> attachments
    ) {
        public static Detail from(Notice n) {
            return new Detail(
                    n.getId(),
                    n.getTitle(),
                    n.getContent(),
                    n.isPinned(),
                    n.getViewCount(),
                    n.getCreatedAt(),
                    n.getUpdatedAt(),
                    n.getAttachments().stream()
                            .map(NoticeDto.Attachment::from)
                            .toList()
            );
        }
    }
}
