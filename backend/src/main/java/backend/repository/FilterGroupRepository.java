package backend.repository;

import backend.entity.FilterGroup;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FilterGroupRepository extends JpaRepository<FilterGroup, Long> {
}