package backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * 공지 첨부파일 엔티티 (Phase 7-B — 공지 첨부 이미지).
 *
 * Notice 1:N NoticeAttachment. 업로드된 이미지 파일의 메타데이터를 담는다.
 * 실제 바이너리는 서버 로컬 디스크({app.upload.dir}/notices/)에 저장되고,
 * 이 엔티티는 그 파일을 가리키는 메타(원본명/저장명/URL/타입/크기)만 보관한다.
 *
 * 필드:
 *   - originalName : 사용자가 올린 원본 파일명 (다운로드 표시용)
 *   - storedName   : 디스크 저장명 (UUID + 확장자 — 충돌 방지)
 *   - url          : 접근 경로 (/uploads/notices/{storedName})
 *   - contentType  : MIME 타입 (image/png 등)
 *   - fileSize     : 바이트 크기
 */
@Entity
@Table(name = "notice_attachments")
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NoticeAttachment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "notice_id", nullable = false)
    private Notice notice;

    @Column(name = "original_name", nullable = false)
    private String originalName;

    @Column(name = "stored_name", nullable = false)
    private String storedName;

    @Column(nullable = false, length = 500)
    private String url;

    @Column(name = "content_type", length = 100)
    private String contentType;

    @Column(name = "file_size", nullable = false)
    @Builder.Default
    private long fileSize = 0L;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
    }
}
