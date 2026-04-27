package backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.data.domain.Page;

import java.util.List;

/**
 * Spring Data 의 PageImpl 을 그대로 직렬화하면 미래 버전에서 JSON 구조가
 * 깨질 수 있다는 경고가 발생함. 안정적인 JSON 응답을 위한 wrapper.
 *
 * 사용 예시:
 *   Page<Product> page = repo.findAll(pageable);
 *   return PagedResponse.from(page.map(this::toDto));
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PagedResponse<T> {

    private List<T> content;
    private int page;            // 현재 페이지 번호 (0-based)
    private int size;            // 페이지당 항목 수
    private long totalElements;  // 전체 항목 수
    private int totalPages;      // 전체 페이지 수
    private boolean first;       // 첫 페이지 여부
    private boolean last;        // 마지막 페이지 여부
    private int numberOfElements; // 현재 페이지의 실제 항목 수
    private boolean empty;       // 현재 페이지가 비어있는지

    /**
     * Spring Data 의 Page<T> 를 PagedResponse<T> 로 변환.
     */
    public static <T> PagedResponse<T> from(Page<T> page) {
        return PagedResponse.<T>builder()
                .content(page.getContent())
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .first(page.isFirst())
                .last(page.isLast())
                .numberOfElements(page.getNumberOfElements())
                .empty(page.isEmpty())
                .build();
    }
}