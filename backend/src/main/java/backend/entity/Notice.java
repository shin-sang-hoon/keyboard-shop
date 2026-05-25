package backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * 공지사항 엔티티 (Phase 7-G 라운드 7).
 *
 * 관리자 공지 CRUD 의 도메인 모델. 기존 frontend/src/data/notices.js 의
 * 정적 더미(제목/본문/조회수)를 DB 로 옮긴 형태 + CRUD 운영에 필요한
 * id / 작성일 / 수정일을 추가했다.
 *
 * 필드:
 *   - title     : 공지 제목
 *   - content   : 본문 (TEXT — 길이 제한 없이)
 *   - pinned    : 상단 고정 여부 (목록에서 고정 공지가 최상단)
 *   - viewCount : 조회수. 신규 등록 시 0.
 *                 증가 로직은 사용자 노출 페이지(NoticeDetailPage) 의
 *                 DB 연동 단계에서 붙는다 — 스키마만 미리 확보.
 *   - createdAt / updatedAt : 작성·수정 시각 (@PrePersist / @PreUpdate 자동)
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
}
