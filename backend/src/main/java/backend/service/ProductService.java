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

    /**
     * 상품 목록 조회 — 페이지네이션 + 검색 + productType 필터.
     *
     * 5-H B1 enrichment 패턴:
     *   1) Page<Product> 가져오기 (EntityGraph 로 brand/category JOIN FETCH — Step 4)
     *   2) ID 리스트 추출 → 3개 IN 절 일괄 쿼리 (images / review-stats / qna-count)
     *   3) Map<productId, ...> 으로 lookup → DTO 빌드
     *
     * 쿼리 카운트: 24개 페이지 = 5쿼리 (count 1 + page 1 + images 1 + review 1 + qna 1)
     * 페이지 크기 무관하게 상수. @Formula 서브쿼리 컬럼 (3N 추가) 보다 효율적.
     *
     * @Cacheable products_v2 캐시는 PagedResponse 직렬화 (PageImpl 아님 — 4/27 사고 회피).
     */
    @Cacheable(
            value = "products_v2",
            key = "(#search == null ? 'all' : #search.trim().toLowerCase()) + '-' " +
                    "+ (#productType == null ? 'any' : #productType.name()) + '-' " +
                    "+ #pageable.pageNumber + '-' + #pageable.pageSize"
    )
    public PagedResponse<ProductDto.Response> getAllProducts(String search, ProductType productType, Pageable pageable) {
        Page<Product> page;
        boolean hasSearch = search != null && !search.isBlank();
        String trimmed = hasSearch ? search.trim() : null;

        if (hasSearch && productType != null) {
            page = productRepository.findByNameContainingIgnoreCaseAndProductType(trimmed, productType, pageable);
        } else if (hasSearch) {
            page = productRepository.findByNameContainingIgnoreCase(trimmed, pageable);
        } else if (productType != null) {
            page = productRepository.findByProductType(productType, pageable);
        } else {
            page = productRepository.findAll(pageable);
        }

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
        return toResponse(product,
                fetchImagesGrouped(single),
                fetchReviewStats(single),
                fetchQnaCounts(single));
    }

    @Transactional
    @CacheEvict(value = "products_v2", allEntries = true)
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
                .build();

        Product saved = productRepository.save(product);
        // 신규 상품 — images/reviews/qna 모두 0 보장 → 빈 Map 으로 즉시 응답
        return toResponse(saved, Map.of(), Map.of(), Map.of());
    }

    @Transactional
    @CacheEvict(value = "products_v2", allEntries = true)
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

        Product saved = productRepository.save(product);
        // 기존 상품 — 이미지/리뷰가 있을 수 있어 fetch
        List<Product> single = List.of(saved);
        return toResponse(saved,
                fetchImagesGrouped(single),
                fetchReviewStats(single),
                fetchQnaCounts(single));
    }

    @Transactional
    @CacheEvict(value = "products_v2", allEntries = true)
    public void deleteProduct(Long id) {
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