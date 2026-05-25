package backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 공지사항 엔티티 (Phase 7-G 라운드 7 + 7-B 첨부 연동).
 *
 * 관리자 공지 CRUD 의 도메인 모델.
 *
 * 필드:
 *   - title     : 공지 제목
 *   - content   : 본문 (TEXT)
 *   - pinned    : 상단 고정 여부 (목록에서 고정 공지가 최상단)
 *   - viewCount : 조회수. 신규 등록 시 0.
 *   - createdAt / updatedAt : 작성·수정 시각 (@PrePersist / @PreUpdate 자동)
 *   - attachments : 첨부 이미지 (7-B). cascade ALL + orphanRemoval —
 *                   공지 저장 시 첨부도 함께 영속화되고, 컬렉션에서 빼면
 *                   DB row 도 삭제된다 (디스크 파일은 Service 에서 별도 처리).
 */
@Entity
@Table(name = "notices")
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Notice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(nullable = false)
    @Builder.Default
    private boolean pinned = false;

    @Column(name = "view_count", nullable = false)
    @Builder.Default
    private int viewCount = 0;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    // 7-B: 첨부 이미지 1:N. id 오름차순(등록순) 정렬.
    @OneToMany(mappedBy = "notice", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    @Builder.Default
    private List<NoticeAttachment> attachments = new ArrayList<>();

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    // ─── 첨부 양방향 동기화 편의 메서드 ──────────────────────────

    public void addAttachment(NoticeAttachment attachment) {
        attachments.add(attachment);
        attachment.setNotice(this);
    }

    public void removeAttachment(NoticeAttachment attachment) {
        attachments.remove(attachment);
        attachment.setNotice(null);
    }
}
