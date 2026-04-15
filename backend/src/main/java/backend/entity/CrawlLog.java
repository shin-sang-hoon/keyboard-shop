package backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "crawl_logs")
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CrawlLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "site_name", nullable = false)
    private String siteName;

    @Column(name = "site_url", nullable = false)
    private String siteUrl;

    @Column(name = "items_crawled")
    private int itemsCrawled;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status;

    @Column(name = "crawled_at")
    private LocalDateTime crawledAt;

    @PrePersist
    public void prePersist() {
        this.crawledAt = LocalDateTime.now();
        if (this.status == null) this.status = Status.SUCCESS;
    }

    public enum Status {
        SUCCESS, FAILED, PARTIAL
    }
}