package backend.repository;

import backend.entity.NoticeAttachment;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 공지 첨부 Repository (Phase 7-B).
 *
 * 첨부의 생성·삭제는 대부분 Notice 의 cascade(ALL + orphanRemoval)로
 * 처리되므로 별도 커스텀 메서드 없이 기본 CRUD 만 둔다.
 */
public interface NoticeAttachmentRepository extends JpaRepository<NoticeAttachment, Long> {
}
