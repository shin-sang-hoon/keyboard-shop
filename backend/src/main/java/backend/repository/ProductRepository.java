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
import org.springframework.data.jpa.repository.Modifying;
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

    // ─── O-1 (6/5): 주문 생성 시 원자적 재고 차감 ──────────────────────
    /**
     * 재고를 원자적으로 차감한다 — 한 UPDATE 문이 "재고 충분?" 검사와 차감을 동시에 수행.
     *
     * WHERE p.stock >= :qty 덕분에, 동시 주문이 같은 마지막 재고를 노려도 DB 가
     * 직렬화해 초과판매(oversell, lost update)를 원천 차단한다.
     *
     * @return 영향받은 행 수. 1 = 차감 성공, 0 = 재고 부족(또는 없는 id) → 호출부에서 409.
     *
     * 주의: @Modifying 벌크 UPDATE 는 영속성 컨텍스트를 우회한다. 호출 직후 메모리상의
     *   Product.stock 은 차감 전(stale) 값이지만, 주문 생성 경로는 이후 stock 을 읽지
     *   않으므로 무해하다. clearAutomatically 는 쓰지 않는다 — 같은 트랜잭션에서 계속
     *   사용하는 cart/order 엔티티가 detach 되면 안 되기 때문.
     */
    @Modifying
    @Query("UPDATE Product p SET p.stock = p.stock - :qty WHERE p.id = :id AND p.stock >= :qty")
    int deductStock(@Param("id") Long id, @Param("qty") int qty);

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
           "AND (:subCategoryId IS NULL OR p.subCategory.id = :subCategoryId) " +
           "ORDER BY CASE WHEN (p.glbUrl IS NULL OR p.glbUrl = '') THEN 1 ELSE 0 END ASC, p.id ASC")
    Page<Product> findActiveWithFilters(
            @Param("search") String search,
            @Param("productType") ProductType productType,
            @Param("status") ProductStatus status,
            @Param("subCategoryId") Long subCategoryId,
            Pageable pageable);

    // ─── 챗봇 상품 추천 (B, 6/03) ────────────────────────────────────────
    /**
     * 챗봇 추천용 — ACTIVE + 지정 productType, 이름 키워드(선택) 매칭.
     *  - keyword == null/'' → 해당 타입 전체에서 GLB 보유 우선·id 순(대표 상품).
     *  - keyword 지정(C 특성 추천) → 상품명 LIKE 필터.
     * switch_type 등 구조 컬럼이 대부분 NULL이라 name LIKE 를 메인 신호로 사용.
     * limit 은 Pageable(PageRequest.of(0, N))로 제어.
     */
    @EntityGraph(attributePaths = {"brand", "category"})
    @Query("SELECT p FROM Product p WHERE p.status = 'ACTIVE' AND p.productType = :productType " +
           "AND (:keyword IS NULL OR :keyword = '' OR LOWER(p.name) LIKE LOWER(CONCAT('%', :keyword, '%'))) " +
           "ORDER BY CASE WHEN (p.glbUrl IS NULL OR p.glbUrl = '') THEN 1 ELSE 0 END ASC, p.id ASC")
    List<Product> findRecommendations(
            @Param("productType") ProductType productType,
            @Param("keyword") String keyword,
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

    /**
     * 특정 하위 카테고리에 속한 상품 수 (P2, 5/28).
     * AdminSubCategoryService.delete 가 호출 — 사용 중이면 삭제 거부(409).
     * toResponse 의 productCount 집계에도 사용.
     * Product.subCategory(ManyToOne) 연관 → 파생 쿼리로 sub_category_id 매핑.
     */
    long countBySubCategoryId(Long subCategoryId);

    // ─── 7-G 라운드 5 (5/25): 관리자 상품 관리 ──────────────────────────
    /**
     * 관리자 상품 목록 — status / productType / search / soldOut 모두 선택(NULL 허용).
     *
     * 공개 API 의 findActiveWithFilters 와 구분되는 점:
     *   - status 도 NULL 허용 → ACTIVE/INACTIVE 전체 조회 가능 (관리자는 숨긴 상품도 봐야 함).
     *   - GLB 우선 CASE 정렬 제거 → 관리자 목록은 Pageable 의 sort(기본 id) 를 그대로 따름.
     *   findActiveWithFilters 를 건드리지 않고 별도 메서드로 분리 — 공개 API 의
     *   "항상 ACTIVE 만 노출" 불변식(면접 자산)을 깨지 않기 위함.
     *
     * soldOut 필터 (P1, 5/28 — B-1 방식):
     *   - 품절은 ProductStatus 값(SOLD_OUT)이 아니라 stock 으로 판정한다 (status 축과 직교).
     *     status(노출 on/off) 와 품절(재고 유무) 은 별개 차원이므로 stock 으로만 본다.
     *   - soldOut == null  → stock 조건 무시 (기존 동작 그대로, 회귀 안전).
     *   - soldOut == TRUE  → stock 이 0 인 상품만 (품절).
     *   - soldOut == FALSE → stock 이 NULL 이거나 0 초과인 상품 (재고 있음).
     *   프론트 [품절] 필터는 status=ACTIVE 와 함께 soldOut=true 를 보낸다.
     */
    @EntityGraph(attributePaths = {"brand", "category"})
    @Query("SELECT p FROM Product p WHERE " +
           "(:status IS NULL OR p.status = :status) " +
           "AND (:search IS NULL OR :search = '' OR LOWER(p.name) LIKE LOWER(CONCAT('%', :search, '%'))) " +
           "AND (:productType IS NULL OR p.productType = :productType) " +
           "AND (:soldOut IS NULL " +
           "     OR (:soldOut = TRUE  AND p.stock IS NOT NULL AND p.stock = 0) " +
           "     OR (:soldOut = FALSE AND (p.stock IS NULL OR p.stock > 0)))")
    Page<Product> findForAdmin(
            @Param("search") String search,
            @Param("productType") ProductType productType,
            @Param("status") ProductStatus status,
            @Param("soldOut") Boolean soldOut,
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
