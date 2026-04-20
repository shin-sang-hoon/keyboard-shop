package backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "filter_groups")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class FilterGroup {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(name = "display_order")
    private Integer displayOrder;

    @OneToMany(mappedBy = "filterGroup", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<FilterOption> options = new ArrayList<>();
}