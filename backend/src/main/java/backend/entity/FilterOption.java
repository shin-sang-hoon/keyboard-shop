package backend.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "filter_options")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class FilterOption {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "filter_group_id", nullable = false)
    private FilterGroup filterGroup;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(length = 50)
    private String value;

    @Column(name = "display_order")
    private Integer displayOrder;
}