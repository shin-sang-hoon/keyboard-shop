package backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "custom_builds")
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CustomBuild {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id")
    private Product product;

    @Column(name = "build_config", columnDefinition = "JSON")
    private String buildConfig;

    // ========== 3D 빌더 스펙 정규화 필드 (4/27 추가, ERD v3) ==========
    // build_config JSON 의 핵심 값을 별도 컬럼으로 추출 — 검색/통계/인덱스용
    // JSON 은 확장성, 컬럼은 쿼리 효율 — 듀얼 구조

    @Column(name = "layout", length = 20)
    private String layout;          // "FULL" / "TKL" / "KEYS_75" / "KEYS_60"

    @Column(name = "switch_type", length = 20)
    private String switchType;      // "LINEAR" / "TACTILE" / "CLICKY" / "SILENT_LINEAR"

    @Column(name = "keycap_color", length = 20)
    private String keycapColor;     // "BLACK" / "WHITE" / "PINK" / "MINT"

    @Column(name = "case_color", length = 20)
    private String caseColor;       // "BLACK" / "WHITE" / "SILVER"

    @Column(name = "total_price")
    private Integer totalPrice;     // 한국 원화, Integer 충분
    // =================================================================

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
    }
}