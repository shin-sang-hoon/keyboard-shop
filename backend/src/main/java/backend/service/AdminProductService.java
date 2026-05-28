package backend.service;

import backend.dto.AdminProductDto;
import backend.dto.PagedResponse;
import backend.entity.Brand;
import backend.entity.Product;
import backend.entity.Product.ProductStatus;
import backend.entity.Product.ProductType;
import backend.entity.SubCategory;
import backend.exception.BusinessException;
import backend.repository.BrandRepository;
import backend.repository.ProductRepository;
import backend.repository.SubCategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 관리자 상품 관리 서비스 (Phase 7-G 라운드 5).
 *
 * 기능:
 *   - 상품 목록 조회 (페이징 + status / productType / search / soldOut 필터)
 *   - 상품 상태 토글 (ACTIVE ↔ INACTIVE — 상품 노출 on/off)
 *   - 상품 브랜드 변경 (P1)
 *   - 상품 재고 변경 (P1 5/28 — 품절/판매재개)
 *   - 상품 하위 카테고리 변경 (P2 5/28 — product_type 일치 가드)
 *
 * 설계 노트:
 *   - 공개 API(ProductService.getAllProducts) 와 분리. 공개 API 는 ACTIVE 만,
 *     관리자는 INACTIVE 숨김 상품까지 봐야 하므로 Repository.findForAdmin 사용.
 *   - 필터는 모두 NULL 허용 — 비어 있으면 전체.
 *   - 정렬: id 내림차순 (최근 등록 상품 먼저).
 *   - 상태 토글은 ACTIVE/INACTIVE 2-state 만 허용. SOLD_OUT enum 값은 존재하지만
 *     B-1 방식(5/28)에서 품절은 stock=0 으로만 판정하므로 status 토글 대상에서 제외.
 *   - 품절(soldOut) 은 status 축과 직교 — stock 으로만 판정. updateStock 으로 0↔양수 전환.
 */
@Service
@RequiredArgsConstructor
public class AdminProductService {

    private final ProductRepository productRepository;
    private final BrandRepository brandRepository;
    private final SubCategoryRepository subCategoryRepository;

    /** 페이지 크기 상한 (DOS 가드 — AuditLog/회원 관리와 동일 정책). */
    private static final int MAX_PAGE_SIZE = 100;

    /** [판매 재개] 시 채워 넣는 기본 재고 수량. */
    private static final int DEFAULT_RESTOCK = 100;

    /**
     * 관리자 상품 목록 (페이징 + 필터).
     *
     * @param status      "ACTIVE" / "INACTIVE" / "SOLD_OUT" / null·"" (전체)
     * @param productType "KEYBOARD" / "KEYCAP" / ... / null·"" (전체)
     * @param search      상품명 부분 일치 / null·"" (전체)
     * @param soldOut     true=품절(stock=0)만 / false=재고있음만 / null=전체
     * @param page        0-indexed
     * @param size        1~100
     */
    @Transactional(readOnly = true)
    public PagedResponse<AdminProductDto.ListItem> list(
            String status, String productType, String search, Boolean soldOut, int page, int size) {

        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        Pageable pageable = PageRequest.of(
                Math.max(page, 0),
                safeSize,
                Sort.by(Sort.Direction.DESC, "id")
        );

        ProductStatus statusEnum = parseStatusOrNull(status);
        ProductType typeEnum = parseTypeOrNull(productType);
        String searchOrNull = (search == null || search.isBlank()) ? null : search.trim();

        Page<Product> result = productRepository.findForAdmin(
                searchOrNull, typeEnum, statusEnum, soldOut, pageable);

        return PagedResponse.from(result.map(AdminProductDto.ListItem::from));
    }

    /**
     * 상품 상태 토글 (ACTIVE ↔ INACTIVE).
     *
     * @param productId 대상 상품 id
     * @param newStatus "ACTIVE" / "INACTIVE"
     */
    @Transactional
    public AdminProductDto.ListItem updateStatus(Long productId, String newStatus) {
        ProductStatus statusEnum = parseStatusForToggle(newStatus);

        Product product = productRepository.findById(productId)
                .orElseThrow(() -> BusinessException.notFound(
                        "상품을 찾을 수 없습니다. id=" + productId));

        product.setStatus(statusEnum);
        // JPA dirty checking 으로 flush 시 UPDATE (명시적 save 불필요).

        return AdminProductDto.ListItem.from(product);
    }

    /**
     * 상품 브랜드 변경 (관리자).
     *
     * brandId 가 null 이면 브랜드 미지정(연결 해제). 그 외에는 해당 브랜드를
     * 조회해 연결한다. JPA dirty checking 으로 flush 시 UPDATE.
     *
     * 사용자 측 반영: ProductDto.Response 에 brandName 필드가 이미 있어,
     * brand_id 가 채워지면 ProductCard/ProductDetail 에 자동 전파된다.
     *
     * @param productId 대상 상품 id
     * @param brandId   연결할 브랜드 id (null = 미지정)
     */
    @Transactional
    public AdminProductDto.ListItem updateBrand(Long productId, Long brandId) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> BusinessException.notFound(
                        "상품을 찾을 수 없습니다. id=" + productId));

        if (brandId == null) {
            product.setBrand(null);
        } else {
            Brand brand = brandRepository.findById(brandId)
                    .orElseThrow(() -> BusinessException.notFound(
                            "브랜드를 찾을 수 없습니다. id=" + brandId));
            product.setBrand(brand);
        }
        // JPA dirty checking 으로 flush 시 UPDATE (명시적 save 불필요).

        return AdminProductDto.ListItem.from(product);
    }

    /**
     * 상품 재고 변경 (P1 5/28 — B-1 품절 방식).
     *
     * 관리자 [품절 처리] = stock 0, [판매 재개] = stock 양수(프론트가 DEFAULT_RESTOCK 전달).
     * status(노출 on/off) 는 건드리지 않는다 — 품절은 stock 으로만 판정하므로
     * 기존 숨김 토글 로직과 완전히 독립적이다.
     *
     * @param productId 대상 상품 id
     * @param stock     설정할 재고 수량 (0 이상). null/음수면 badRequest.
     */
    @Transactional
    public AdminProductDto.ListItem updateStock(Long productId, Integer stock) {
        if (stock == null || stock < 0) {
            throw BusinessException.badRequest("재고는 0 이상의 정수여야 합니다.");
        }

        Product product = productRepository.findById(productId)
                .orElseThrow(() -> BusinessException.notFound(
                        "상품을 찾을 수 없습니다. id=" + productId));

        product.setStock(stock);
        // JPA dirty checking 으로 flush 시 UPDATE (명시적 save 불필요).

        return AdminProductDto.ListItem.from(product);
    }

    /**
     * 상품 하위 카테고리 변경 (P2 5/28).
     *
     * subCategoryId 가 null 이면 하위분류 미지정(연결 해제). 그 외에는 해당
     * 하위분류를 조회해 연결한다. JPA dirty checking 으로 flush 시 UPDATE.
     *
     * 핵심 가드 — product_type 일치 검증:
     *   하위 카테고리는 product_type 에 종속된다(예: KEYBOARD '풀배열').
     *   KEYBOARD 상품에 KEYCAP 하위분류를 붙이면 도메인 모순이므로,
     *   상품의 productType 과 하위분류의 productType 이 다르면 badRequest 로 차단.
     *
     * 사용자 측 반영: 공개 API findActiveWithFilters 의 subCategoryId 필터가
     * 이 값을 읽어 ProductList 측면 필터에 자동 전파된다.
     *
     * @param productId     대상 상품 id
     * @param subCategoryId 연결할 하위분류 id (null = 미지정)
     */
    @Transactional
    public AdminProductDto.ListItem updateSubCategory(Long productId, Long subCategoryId) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> BusinessException.notFound(
                        "상품을 찾을 수 없습니다. id=" + productId));

        if (subCategoryId == null) {
            product.setSubCategory(null);
        } else {
            SubCategory sub = subCategoryRepository.findById(subCategoryId)
                    .orElseThrow(() -> BusinessException.notFound(
                            "하위 카테고리를 찾을 수 없습니다. id=" + subCategoryId));

            // product_type 일치 가드 — 상품과 하위분류의 대분류가 같아야 함
            String productTypeName = product.getProductType() != null
                    ? product.getProductType().name() : null;
            if (!sub.getProductType().equals(productTypeName)) {
                throw BusinessException.badRequest(
                        "상품의 대분류(" + productTypeName + ")와 하위 카테고리의 대분류("
                      + sub.getProductType() + ")가 일치하지 않습니다.");
            }
            product.setSubCategory(sub);
        }
        // JPA dirty checking 으로 flush 시 UPDATE (명시적 save 불필요).

        return AdminProductDto.ListItem.from(product);
    }

    // ─── 내부 파싱 헬퍼 ───────────────────────────────────────────

    /** 목록 필터용 — null/빈 문자열이면 null 반환 (전체 의미). */
    private ProductStatus parseStatusOrNull(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return ProductStatus.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw BusinessException.badRequest("알 수 없는 status 값입니다: " + raw);
        }
    }

    /** 목록 필터용 — null/빈 문자열이면 null 반환 (전체 의미). */
    private ProductType parseTypeOrNull(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return ProductType.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw BusinessException.badRequest("알 수 없는 productType 값입니다: " + raw);
        }
    }

    /** 상태 토글용 — ACTIVE/INACTIVE 만 허용. SOLD_OUT 등은 차단. */
    private ProductStatus parseStatusForToggle(String raw) {
        if (raw == null || raw.isBlank()) {
            throw BusinessException.badRequest("status 값이 필요합니다.");
        }
        ProductStatus parsed;
        try {
            parsed = ProductStatus.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw BusinessException.badRequest("알 수 없는 status 값입니다: " + raw);
        }
        if (parsed != ProductStatus.ACTIVE && parsed != ProductStatus.INACTIVE) {
            throw BusinessException.badRequest(
                    "상태 토글은 ACTIVE 또는 INACTIVE 만 가능합니다.");
        }
        return parsed;
    }
}
