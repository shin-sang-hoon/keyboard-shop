package backend.repository;

import backend.entity.Product;
import backend.entity.Category;
import backend.entity.Brand;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;
import java.util.Optional;

public interface ProductRepository extends JpaRepository<Product, Long> {

    // 기존 메서드들 — 그대로 유지 (다른 곳에서 호출 가능성 ↓)
    List<Product> findByCategory(Category category);
    List<Product> findByBrand(Brand brand);
    List<Product> findByBrandId(Long brandId);
    List<Product> findByBrandName(String brandName);
    List<Product> findByNameContaining(String keyword);
    Optional<Product> findBySourceId(String sourceId);

    @Query("SELECT p FROM Product p JOIN FETCH p.category WHERE p.status = 'ACTIVE'")
    List<Product> findAllOnSaleWithCategory();

    // ─── 5-G/Step 4: N+1 해결 (brand + category JOIN FETCH) ──────────────
    // findAll(Pageable) 오버라이드: brand, category 한 번에 fetch
    @Override
    @EntityGraph(attributePaths = {"brand", "category"})
    Page<Product> findAll(Pageable pageable);

    // 검색용: brand, category 한 번에 fetch
    @EntityGraph(attributePaths = {"brand", "category"})
    Page<Product> findByNameContainingIgnoreCase(String keyword, Pageable pageable);

    // findById 도 단건 조회 시 N+1 방지
    @Override
    @EntityGraph(attributePaths = {"brand", "category"})
    Optional<Product> findById(Long id);
}