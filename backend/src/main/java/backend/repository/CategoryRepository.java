package backend.repository;

import backend.entity.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface CategoryRepository extends JpaRepository<Category, Long> {

    Optional<Category> findBySlug(String slug);

    List<Category> findByNameContainingIgnoreCase(String keyword);

    // fetch join으로 N+1 해결 — 자식 카테고리를 한 번에 조회
    @Query("SELECT DISTINCT c FROM Category c LEFT JOIN FETCH c.children WHERE c.parent IS NULL")
    List<Category> findAllWithChildren();
}