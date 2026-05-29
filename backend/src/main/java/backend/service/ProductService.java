package backend.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import backend.dto.ProductDto;
import backend.dto.ProductImageDto;
import backend.dto.PagedResponse;
import backend.entity.Brand;
import backend.entity.Category;
import backend.entity.Product;
import backend.entity.Product.ProductType;
import backend.entity.ProductImage;
import backend.repository.BrandRepository;
import backend.repository.CategoryRepository;
import backend.repository.ProductRepository;
import backend.repository.ProductImageRepository;
import backend.repository.QnARepository;
import backend.repository.ReviewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProductService {

    private final ProductRepository productRepository;
    private final BrandRepository brandRepository;
    private final CategoryRepository categoryRepository;

    // 5-H B1: 목록 응답 enrichment 용
    private final ProductImageRepository productImageRepository;
    private final ReviewRepository reviewRepository;
    private final QnARepository qnaRepository;

    // P3 (5/29): 상세정보 인라인 이미지 수명주기 (reconcile / 상품 삭제 시 파일 정리)
    private final ProductDetailImageService productDetailImageService;

    /**
     * 상품 목록 조회 — 페이지네이션 + 검색 + productType 필터 + subCategoryId 필터 + status='ACTIVE' 강제.
     *
     * 5-H 후속 (5/10) 변경:
     *   - 4-way 분기 → 단일 JPQL 통합 (productRepository.findActiveWithFilters)
     *   - 공개 API 는 항상 ACTIVE 만 노출 (V3 SQL 로 INACTIVE 처리한 데이터 자동 hide)
     *
     * P2 (5/28) 변경:
     *   - subCategoryId 필터 추가 (사용자단 측면 필터 — 하위 카테고리별 상품)
     *   - @Cacheable 캐시 키에 subCategoryId 반영 + products_v3 → products_v4 bump
     *     (키에 안 넣으면 다른 하위카테고리가 같은 캐시 반환하는 버그 — 4/27 stale 사고 패턴)
     *
     * P3 (5/29) 노트:
     *   - description 은 목록 응답에 미포함 (toResponse 에서 set 안 함) → 목록 페이로드에 LONGTEXT 미적재.
     *     단건 getProduct 에서만 hydrate (detail-only 로딩). 따라서 products_v4 캐시 키/버전 변경 불필요.
     *
     * 5-H B1 enrichment 패턴:
     *   1) Page<Product> 가져오기 (EntityGraph 로 brand/category JOIN FETCH — Step 4)
     *   2) ID 리스트 추출 → 3개 IN 절 일괄 쿼리 (images / review-stats / qna-count)
     *   3) Map<productId, ...> 으로 lookup → DTO 빌드
     *
     * @Cacheable products_v4 캐시는 PagedResponse 직렬화 (PageImpl 아님 — 4/27 사고 회피).
     */
    @Cacheable(
            value = "products_v4",
            key = "(#search == null ? 'all' : #search.trim().toLowerCase()) + '-' " +
                    "+ (#productType == null ? 'any' : #productType.name()) + '-' " +
                    "+ (#subCategoryId == null ? 'anysub' : #subCategoryId) + '-' " +
                    "+ #pageable.pageNumber + '-' + #pageable.pageSize"
    )
    public PagedResponse<ProductDto.Response> getAllProducts(String search, ProductType productType,
                                                             Long subCategoryId, Pageable pageable) {
        boolean hasSearch = search != null && !search.isBlank();
        String trimmed = hasSearch ? search.trim() : null;

        // 5-H 후속 (5/10): 4-way 분기 → 단일 JPQL 호출 + status='ACTIVE' 강제
        // P2 (5/28): subCategoryId 필터 추가
        Page<Product> page = productRepository.findActiveWithFilters(
                trimmed,
                productType,
                Product.ProductStatus.ACTIVE,
                subCategoryId,
                pageable
        );

        // 5-H B1: 외부 Map 3개 미리 fetch (closure 로 toResponse 에 주입)
        List<Product> products = page.getContent();
        Map<Long, List<ProductImageDto>> imagesMap = fetchImagesGrouped(products);
        Map<Long, ReviewStats> reviewStatsMap = fetchReviewStats(products);
        Map<Long, Long> qnaCountMap = fetchQnaCounts(products);

        // page.map 으로 PageImpl wrap → PagedResponse.from 으로 직렬화 안전 변환
        return PagedResponse.from(page.map(p -> toResponse(p, imagesMap, reviewStatsMap, qnaCountMap)));
    }

    public ProductDto.Response getProduct(Long id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("상품을 찾을 수 없습니다."));
        List<Product> single = List.of(product);
        ProductDto.Response resp = toResponse(product,
                fetchImagesGrouped(single),
                fetchReviewStats(single),
                fetchQnaCounts(single));
        // P3: description 은 단건 상세에서만 hydrate (목록 페이로드 제외).
        resp.setDescription(product.getDescription());
        return resp;
    }

    @Transactional
    @CacheEvict(value = "products_v4", allEntries = true)
    public ProductDto.Response createProduct(ProductDto.Request request) {
        Brand brand = request.getBrandId() != null ?
                brandRepository.findById(request.getBrandId()).orElse(null) : null;
        Category category = request.getCategoryId() != null ?
                categoryRepository.findById(request.getCategoryId()).orElse(null) : null;

        Product product = Product.builder()
                .name(request.getName())
                .brand(brand)
                .category(category)
                .price(request.getPrice())
                .stock(request.getStock())
                .imageUrl(request.getImageUrl())
                .layout(request.getLayout())
                .switchType(request.getSwitchType())
                .switchName(request.getSwitchName())
                .mountingType(request.getMountingType())
                .connectionType(request.getConnectionType())
                .gbStatus(request.getGbStatus())
                .sourceId(request.getSourceId())
                .status(request.getStatus() != null ? request.getStatus() : Product.ProductStatus.ACTIVE)
                .productType(request.getProductType() != null ? request.getProductType() : Product.ProductType.UNCLASSIFIED)
                .build();

        Product saved = productRepository.save(product);
        // 신규 상품 — images/reviews/qna 모두 0 보장 → 빈 Map 으로 즉시 응답
        return toResponse(saved, Map.of(), Map.of(), Map.of());
    }

    @Transactional
    @CacheEvict(value = "products_v4", allEntries = true)
    public ProductDto.Response updateProduct(Long id, ProductDto.Request request) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("상품을 찾을 수 없습니다."));

        Brand brand = request.getBrandId() != null ?
                brandRepository.findById(request.getBrandId()).orElse(null) : null;
        Category category = request.getCategoryId() != null ?
                categoryRepository.findById(request.getCategoryId()).orElse(null) : null;

        product.setName(request.getName());
        product.setBrand(brand);
        product.setCategory(category);
        product.setPrice(request.getPrice());
        product.setStock(request.getStock());
        product.setImageUrl(request.getImageUrl());
        product.setLayout(request.getLayout());
        product.setSwitchType(request.getSwitchType());
        product.setSwitchName(request.getSwitchName());
        product.setMountingType(request.getMountingType());
        product.setConnectionType(request.getConnectionType());
        product.setGbStatus(request.getGbStatus());
        if (request.getStatus() != null) product.setStatus(request.getStatus());
        if (request.getProductType() != null) product.setProductType(request.getProductType());
        // 주의: description 은 여기서 의도적으로 다루지 않는다.
        //   이 경로(PUT /api/products/{id})는 SecurityConfig 에서 permitAll(공개)이므로
        //   HTML 본문(stored XSS 벡터)을 받으면 무가드 쓰기 구멍이 된다.
        //   description 쓰기는 가드된 updateDescription(아래) 로만 허용.

        Product saved = productRepository.save(product);
        // 기존 상품 — 이미지/리뷰가 있을 수 있어 fetch
        List<Product> single = List.of(saved);
        return toResponse(saved,
                fetchImagesGrouped(single),
                fetchReviewStats(single),
                fetchQnaCounts(single));
    }

    /**
     * P3 (5/29): 상세정보 HTML 저장 + 인라인 이미지 reconcile.
     *
     * 호출 경로: PATCH /api/admin/products/{id}/description (AdminProductDetailController, hasRole ADMIN).
     *
     * 캐시 evict 불필요:
     *   - description 은 목록(products_v4) 응답에 미포함
     *   - 단건 getProduct 는 @Cacheable 아님 → 저장 즉시 사용자 상세에 반영
     */
    @Transactional
    public void updateDescription(Long id, String html) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("상품을 찾을 수 없습니다."));
        product.setDescription(html);
        productRepository.save(product);
        // 저장된 HTML 기준으로 인라인 이미지 정리 (미참조 파일 GC, PENDING→CONFIRMED)
        productDetailImageService.reconcile(id, html);
    }

    @Transactional
    @CacheEvict(value = "products_v4", allEntries = true)
    public void deleteProduct(Long id) {
        // P3: 상세 인라인 이미지 디스크 파일 + 추적 row 선정리 (FK ON DELETE CASCADE 는 안전망)
        productDetailImageService.deleteAllByProduct(id);
        productRepository.deleteById(id);
    }

    // ──────────────────────────────────────────────────────────
    // 5-H B1 helpers — IN 절 일괄 fetch + Map 그룹화
    // ──────────────────────────────────────────────────────────

    private Map<Long, List<ProductImageDto>> fetchImagesGrouped(List<Product> products) {
        if (products.isEmpty()) return Map.of();
        List<Long> ids = products.stream().map(Product::getId).toList();
        List<ProductImage> images = productImageRepository
                .findByProductIdInOrderByProductIdAscDisplayOrderAsc(ids);
        return images.stream().collect(Collectors.groupingBy(
                img -> img.getProduct().getId(),
                Collectors.mapping(ProductImageDto::from, Collectors.toList())
        ));
    }

    private Map<Long, ReviewStats> fetchReviewStats(List<Product> products) {
        if (products.isEmpty()) return Map.of();
        List<Long> ids = products.stream().map(Product::getId).toList();
        List<Object[]> rows = reviewRepository.findReviewStatsByProductIds(ids);
        Map<Long, ReviewStats> result = new HashMap<>();
        for (Object[] row : rows) {
            Long productId = (Long) row[0];
            Long count = (Long) row[1];
            Double avg = (Double) row[2];
            result.put(productId, new ReviewStats(count, avg));
        }
        return result;
    }

    private Map<Long, Long> fetchQnaCounts(List<Product> products) {
        if (products.isEmpty()) return Map.of();
        List<Long> ids = products.stream().map(Product::getId).toList();
        List<Object[]> rows = qnaRepository.countByProductIds(ids);
        Map<Long, Long> result = new HashMap<>();
        for (Object[] row : rows) {
            result.put((Long) row[0], (Long) row[1]);
        }
        return result;
    }

    private ProductDto.Response toResponse(Product p,
                                           Map<Long, List<ProductImageDto>> imagesMap,
                                           Map<Long, ReviewStats> reviewStatsMap,
                                           Map<Long, Long> qnaCountMap) {
        Long pid = p.getId();
        ReviewStats stats = reviewStatsMap.getOrDefault(pid, ReviewStats.EMPTY);
        // 주의: description 은 여기서 set 하지 않는다 (목록 페이로드 제외 — detail-only 로딩).
        //       단건 getProduct 에서만 resp.setDescription() 으로 hydrate.
        return ProductDto.Response.builder()
                .id(pid)
                .name(p.getName())
                .brandName(p.getBrand() != null ? p.getBrand().getName() : null)
                .categoryName(p.getCategory() != null ? p.getCategory().getName() : null)
                .price(p.getPrice())
                .stock(p.getStock())
                .imageUrl(p.getImageUrl())
                .layout(p.getLayout())
                .switchType(p.getSwitchType())
                .switchName(p.getSwitchName())
                .mountingType(p.getMountingType())
                .connectionType(p.getConnectionType())
                .gbStatus(p.getGbStatus())
                .glbUrl(p.getGlbUrl())
                .sourceId(p.getSourceId())
                .status(p.getStatus())
                .productType(p.getProductType() != null ? p.getProductType().name() : null)
                .createdAt(p.getCreatedAt())
                // 5-H B1
                .images(imagesMap.getOrDefault(pid, Collections.emptyList()))
                .ratingAvg(stats.avgRating())
                .reviewCount(stats.count())
                .qnaCount(qnaCountMap.getOrDefault(pid, 0L))
                .build();
    }

    /** 리뷰 집계 결과 record. 0건일 때 EMPTY (count=0, avg=null) */
    private record ReviewStats(Long count, Double avgRating) {
        static final ReviewStats EMPTY = new ReviewStats(0L, null);
    }
}
