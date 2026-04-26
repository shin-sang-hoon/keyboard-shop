package backend.repository;

import backend.entity.Product;
import backend.entity.Category;
import backend.entity.Brand;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;
import java.util.Optional;

public interface ProductRepository extends JpaRepository<Product, Long> {

    // 기존 메서드 — 그대로 유지 (다른 곳에서 호출 가능성 대비)
    List<Product> findByCategory(Category category);
    List<Product> findByBrand(Brand brand);
    List<Product> findByBrandId(Long brandId);
    List<Product> findByBrandName(String brandName);
    List<Product> findByNameContaining(String keyword);
    Optional<Product> findBySourceId(String sourceId);

    @Query("SELECT p FROM Product p JOIN FETCH p.category WHERE p.status = 'ACTIVE'")
    List<Product> findAllOnSaleWithCategory();

    // ── 5-F 추가: 페이지네이션 + 대소문자 무시 검색 ─────────────────────
    // findAll(Pageable) 은 JpaRepository 기본 제공이라 별도 선언 불필요
    Page<Product> findByNameContainingIgnoreCase(String keyword, Pageable pageable);
}