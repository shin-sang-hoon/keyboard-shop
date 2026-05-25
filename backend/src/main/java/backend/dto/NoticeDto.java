package backend.dto;

import backend.entity.Notice;
import backend.entity.NoticeAttachment;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 공개 공지 DTO (Phase 7-B — 사용자 공지 연동).
 *
 * 관리자용 AdminNoticeDto 와 분리한 이유:
 *   - 사용자 페이지는 등록·수정 요청(SaveRequest)이 없다.
 *   - 사용자 상세는 "이전/다음 글"을 함께 내려준다 (Detail.prev/next).
 *   AdminNoticeDto 를 재사용하면 사용자에게 불필요한 필드가 새거나
 *   사용자 전용 필드가 관리자 DTO 를 오염시킨다 → 도메인별 DTO 분리.
 *
 * 중첩 구조:
 *   - NoticeDto.ListItem          : 목록 1행 (본문 제외 — 페이로드 절감)
 *   - NoticeDto.Adjacent          : 이전/다음 글 요약 (id + title 만)
 *   - NoticeDto.Detail            : 상세 — 본문 + prev/next 통합 (왕복 1회)
 *   - NoticeDto.ViewCountResponse : POST /{id}/view 응답 — 증가 후 조회수
 */
public final class NoticeDto {

    private NoticeDto() {}

    /** 목록 1행 — 본문 제외 (AdminNoticeDto.ListItem 과 동일 패턴). */
    public record ListItem(
            Long id,
            String title,
            boolean pinned,
            int viewCount,
            LocalDateTime createdAt
    ) {
        public static ListItem from(Notice n) {
            return new ListItem(
                    n.getId(),
                    n.getTitle(),
                    n.isPinned(),
                    n.getViewCount(),
                    n.getCreatedAt()
            );
        }
    }

    /**
     * 이전/다음 글 요약 — 토글 박스에 id + title 만 필요.
     * 본문·메타는 클릭 후 별도 GET 으로 받으므로 여기선 최소 필드만.
     */
    public record Adjacent(
            Long id,
            String title
    ) {
        /** null 안전 — 양 끝 공지는 prev 또는 next 가 없다. */
        public static Adjacent from(Notice n) {
            return n == null ? null : new Adjacent(n.getId(), n.getTitle());
        }
    }

    /**
     * 첨부파일(이미지) — 공개/관리자 공용 표현.
     * url 은 정적 리소스 경로 (/uploads/notices/{storedName}).
     */
    public record Attachment(
            Long id,
            String originalName,
            String url,
            String contentType,
            long fileSize
    ) {
        public static Attachment from(NoticeAttachment a) {
            return new Attachment(
                    a.getId(),
                    a.getOriginalName(),
                    a.getUrl(),
                    a.getContentType(),
                    a.getFileSize()
            );
        }
    }

    /**
     * 상세 — 본문 + 첨부 이미지 + 이전/다음 글을 한 응답에 통합 (B안: 1회 배달).
     *
     * 인접 정렬은 pinned 무시하고 순수 id 기준이다 (일반 게시판 관행):
     *   - prev (이전 글) : 현재보다 id 가 큰 = 더 최신 글
     *   - next (다음 글) : 현재보다 id 가 작은 = 더 오래된 글
     * pinned 는 목록 노출 순서에만 영향을 주고, 읽기 순서(이전/다음)는
     * 시간순으로 흐르게 둔다.
     */
    public record Detail(
            Long id,
            String title,
            String content,
            boolean pinned,
            int viewCount,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            List<Attachment> attachments,
            Adjacent prev,
            Adjacent next
    ) {
        public static Detail from(Notice n, Notice prev, Notice next) {
            return new Detail(
                    n.getId(),
                    n.getTitle(),
                    n.getContent(),
                    n.isPinned(),
                    n.getViewCount(),
                    n.getCreatedAt(),
                    n.getUpdatedAt(),
                    n.getAttachments().stream().map(Attachment::from).toList(),
                    Adjacent.from(prev),
                    Adjacent.from(next)
            );
        }
    }

    /**
     * 조회수 증가 응답 — POST /api/notices/{id}/view.
     * 증가가 반영된 최신 조회수를 돌려줘서 프론트가 즉시 화면에 반영한다.
     */
    public record ViewCountResponse(
            int viewCount
    ) {
    }
}
