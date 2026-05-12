package backend.repository;

import backend.entity.Product;
import backend.entity.Product.ProductStatus;
import backend.entity.Product.ProductType;
import backend.entity.Category;
import backend.entity.Brand;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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

    // ─── 5-H 후속 (5/10): 공개 API 통합 — status 필수 + search/productType 옵션 ───
    /**
     * 4-way 분기 (findAll / findByName / findByProductType / findByName+ProductType)
     * 를 단일 JPQL 로 통합한 메서드. ProductService.getAllProducts 가 이 메서드만 호출.
     *
     * 면접 자산:
     *   - 공개 API 는 항상 ACTIVE 만 노출 (V3 SQL 로 INACTIVE 처리한 비키보드/노이즈 자동 hide)
     *   - 4-way 분기 → 1 메서드 통합 (NULL 가드 JPQL 패턴)
     *   - @EntityGraph 로 N+1 방어 유지 (Step 4 와 동일)
     *
     * 5-H 후속 (5/10) 정렬 추가:
     *   - GLB 보유 상품 우선 노출 (3D 와이어프레임이 보이는 keychron 9개가 첫 페이지)
     *   - 같은 그룹 내에서는 id ASC tiebreak (keychron 100번대가 swagkey 2400번대보다 앞)
     *   - CASE 문으로 NULL/빈 문자열을 1로 매핑, 그 외는 0 → ORDER BY ASC 시 GLB 있는 게 위로
     *   - Pageable 의 Sort 가 비어있을 때만 적용되며, 명시적 정렬 요청 시 ProductService 가 우선
     */
    @EntityGraph(attributePaths = {"brand", "category"})
    @Query("SELECT p FROM Product p WHERE " +
           "p.status = :status " +
           "AND (:search IS NULL OR :search = '' OR LOWER(p.name) LIKE LOWER(CONCAT('%', :search, '%'))) " +
           "AND (:productType IS NULL OR p.productType = :productType) " +
           "ORDER BY CASE WHEN (p.glbUrl IS NULL OR p.glbUrl = '') THEN 1 ELSE 0 END ASC, p.id ASC")
    Page<Product> findActiveWithFilters(
            @Param("search") String search,
            @Param("productType") ProductType productType,
            @Param("status") ProductStatus status,
            Pageable pageable);
}
