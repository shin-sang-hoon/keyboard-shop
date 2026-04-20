package backend.repository;

import backend.entity.FilterOption;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface FilterOptionRepository extends JpaRepository<FilterOption, Long> {
    List<FilterOption> findByFilterGroupId(Long filterGroupId);
}