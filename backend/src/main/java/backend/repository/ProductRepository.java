package backend.repository;

import backend.entity.Product;
import backend.entity.Product.ProductType;
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

    // 기존 메서드들 그대로 유지
    List<Product> findByCategory(Category category);
    List<Product> findByBrand(Brand brand);
    List<Product> findByBrandId(Long brandId);
    List<Product> findByBrandName(String brandName);
    List<Product> findByNameContaining(String keyword);
    Optional<Product> findBySourceId(String sourceId);

    @Query("SELECT p FROM Product p JOIN FETCH p.category WHERE p.status = 'ACTIVE'")
    List<Product> findAllOnSaleWithCategory();

    // ─── 5-G/Step 4: N+1 해결 ───────────────────────────────────────────
    @Override
    @EntityGraph(attributePaths = {"brand", "category"})
    Page<Product> findAll(Pageable pageable);

    @EntityGraph(attributePaths = {"brand", "category"})
    Page<Product> findByNameContainingIgnoreCase(String keyword, Pageable pageable);

    @Override
    @EntityGraph(attributePaths = {"brand", "category"})
    Optional<Product> findById(Long id);

    // ─── 5-G/Step 5: productType 필터링 ──────────────────────────────────
    @EntityGraph(attributePaths = {"brand", "category"})
    Page<Product> findByProductType(ProductType productType, Pageable pageable);

    @EntityGraph(attributePaths = {"brand", "category"})
    Page<Product> findByNameContainingIgnoreCaseAndProductType(
        String keyword, ProductType productType, Pageable pageable);
}