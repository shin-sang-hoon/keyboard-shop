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

    // ─── 7-G 라운드 3 (5/24): 관리자 대시보드 통계 ──────────────────────
    /**
     * 상태별 상품 개수. Spring Data JPA 메서드명 파생 쿼리.
     * AdminStatsService 가 ProductStatus.ACTIVE 로 호출 → 판매중 상품 수.
     */
    long countByStatus(ProductStatus status);

    // ─── 7-G R9 (5/26): 카테고리/브랜드 삭제 가드 ───────────────────────
    /**
     * 특정 카테고리에 속한 상품 수.
     * AdminCategoryService.deleteCategory 가 호출 — 사용 중이면 삭제 거부(409).
     * Product.category(ManyToOne) 연관 → 파생 쿼리로 category_id 매핑.
     */
    long countByCategoryId(Long categoryId);

    /**
     * 특정 브랜드에 속한 상품 수.
     * AdminBrandService.deleteBrand 가 호출 — 사용 중이면 삭제 거부(409).
     */
    long countByBrandId(Long brandId);

    // ─── 7-G 라운드 5 (5/25): 관리자 상품 관리 ──────────────────────────
    /**
     * 관리자 상품 목록 — status / productType / search 3개 모두 선택(NULL 허용).
     *
     * 공개 API 의 findActiveWithFilters 와 구분되는 점:
     *   - status 도 NULL 허용 → ACTIVE/INACTIVE 전체 조회 가능 (관리자는 숨긴 상품도 봐야 함).
     *   - GLB 우선 CASE 정렬 제거 → 관리자 목록은 Pageable 의 sort(기본 id) 를 그대로 따름.
     *   findActiveWithFilters 를 건드리지 않고 별도 메서드로 분리 — 공개 API 의
     *   "항상 ACTIVE 만 노출" 불변식(면접 자산)을 깨지 않기 위함.
     */
    @EntityGraph(attributePaths = {"brand", "category"})
    @Query("SELECT p FROM Product p WHERE " +
           "(:status IS NULL OR p.status = :status) " +
           "AND (:search IS NULL OR :search = '' OR LOWER(p.name) LIKE LOWER(CONCAT('%', :search, '%'))) " +
           "AND (:productType IS NULL OR p.productType = :productType)")
    Page<Product> findForAdmin(
            @Param("search") String search,
            @Param("productType") ProductType productType,
            @Param("status") ProductStatus status,
            Pageable pageable);

    // ─── Flash Deal 임계값 (5/17) ──────────────────────────────────
    /**
     * KEYBOARD ACTIVE 총 개수.
     * MySQL 의 prepared statement OFFSET 제약 회피용 2단계 쿼리 1단계.
     */
    @Query(value = """
        SELECT COUNT(*) FROM products
        WHERE product_type = 'KEYBOARD' AND status = 'ACTIVE'
        """, nativeQuery = true)
    long countActiveKeyboards();

    /**
     * KEYBOARD ACTIVE 가격 내림차순 N번째.
     * Service 가 OFFSET 정수를 계산해서 전달 (prepared statement 안전).
     *
     * 예: total=104, topPercent=5 → offset=5 → 6번째 비싼 키보드 = 상위 5% 임계
     * (FLOOR(104*5/100)=5, 0-indexed offset)
     */
    @Query(value = """
        SELECT price FROM products
        WHERE product_type = 'KEYBOARD' AND status = 'ACTIVE'
        ORDER BY price DESC
        LIMIT 1 OFFSET :offset
        """, nativeQuery = true)
    Optional<Integer> findPriceAtOffset(@Param("offset") long offset);
}
