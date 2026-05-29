package backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * 상품 상세정보(description) 본문에 인라인 삽입되는 이미지의 추적 레코드 (P3 · 5/29).
 *
 * 왜 추적 테이블이 필요한가 (자산 #21 NoticeAttachment 에서의 진화):
 *   - NoticeAttachment 는 1:N 으로 본문과 별개로 렌더 → cascade/orphanRemoval 만으로 수명주기 종결.
 *   - 상세정보 인라인 이미지는 description HTML 안에 <img src> 로 박혀 "HTML 이 진실의 원천".
 *     단순 1:N cascade 로는 "업로드됐지만 본문에서 제거된" 고아 파일을 못 잡는다.
 *   - 그래서 업로드 시 PENDING 으로 추적 → 저장(description) 시 HTML 을 파싱해
 *     참조 이미지 집합과 diff → 미참조 파일/row GC (reconcile). 미확정 PENDING 은 @Scheduled GC.
 *
 * 디스크 저장 패턴은 NoticeFileService 와 동일 (로컬 디스크 + UUID 저장명 + /uploads/ 정적 서빙).
 */
@Entity
@Table(name = "product_detail_images")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProductDetailImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    /** 디스크 UUID 저장명 (확장자 포함). 파일 삭제 키. */
    @Column(name = "stored_name", nullable = false)
    private String storedName;

    /** 접근 URL — /uploads/products/{storedName}. reconcile 시 HTML <img src> 매칭 키. */
    @Column(nullable = false, length = 512)
    private String url;

    @Column(name = "original_name")
    private String originalName;

    @Column(name = "content_type", length = 100)
    private String contentType;

    @Column(name = "file_size")
    private Long fileSize;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Status status = Status.PENDING;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) this.createdAt = LocalDateTime.now();
        if (this.status == null) this.status = Status.PENDING;
    }

    /**
     * PENDING  : 업로드만 됨 (아직 저장된 description HTML 에 참조 확인 안 됨).
     * CONFIRMED: 저장 시 reconcile 에서 HTML 참조 확인됨.
     */
    public enum Status {
        PENDING, CONFIRMED
    }
}
