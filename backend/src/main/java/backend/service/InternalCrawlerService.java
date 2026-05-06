package backend.service;

import backend.dto.InternalProductDtos;
import backend.entity.Brand;
import backend.entity.CrawlLog;
import backend.entity.Product;
import backend.entity.ProductImage;
import backend.repository.BrandRepository;
import backend.repository.CrawlLogRepository;
import backend.repository.ProductImageRepository;
import backend.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

/**
 * 크롤러 internal upsert 서비스 (5-H D1 + D2 후속 확장).
 *
 * D1 추가 (5/2):
 *   - imageUrls: List<String> 배열 수신 → ProductImage 테이블에 적재 (1:N)
 *   - clean-replace 패턴: 기존 product_images row 들 먼저 삭제 → 신규 N장 INSERT
 *     ↳ 5/2 A5 마이그레이션의 1장씩 적재를 N장씩으로 자연스럽게 진화
 *   - imageUrls 비어있으면 imageUrl 1장으로 fallback (후방 호환)
 *
 * D2 후속 추가 (5/6 — swagkey path):
 *   - brandName null safety: 빈 brand 면 "Unknown" 으로 fallback (NPE 방지)
 *   - productType 직접 매핑: 카테고리가 사이트 메뉴에서 명확한 source (스웨그키) 의 경우
 *     크롤 시점에 KEYBOARD/SWITCH_PART/ACCESSORY 매핑 (5-G v3 SQL 키워드 분류 우회)
 *
 * Note:
 *   DTO 의 productUrl 필드는 Product 엔티티에 매핑되지 않음 (의도된 디자인).
 *
 * 면접 포인트:
 *   - 1차 마이그레이션 (A5) 은 image_url 1장씩 적재 → 2차 (D1) 는 N장씩 재적재.
 *     같은 테이블이지만 데이터 의미가 발전한 clean-replace 패턴.
 *     productImageRepository.deleteByProductId() 로 기존 row 들 제거 후
 *     saveAll() 로 신규 N장 INSERT — 트랜잭션 한 번에 처리해서 일관성 보장
 *   - productType 분류 트레이드오프: naver_* 는 데이터가 어지러워서 키워드 SQL 분류 (v3),
 *     swagkey 는 메뉴 자체가 명확해서 크롤 시점 직접 매핑. 데이터 흐름 깔끔.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class InternalCrawlerService {

    private final ProductRepository productRepository;
    private final BrandRepository brandRepository;
    private final CrawlLogRepository crawlLogRepository;
    private final ProductImageRepository productImageRepository; // 5-H D1 신규

    @Value("${internal.api-key}")
    private String internalApiKey;

    // ── 단건 upsert (기존 호환) ──────────────────────────────────────────

    @Transactional
    public InternalProductDtos.UpsertResponse upsert(String key, InternalProductDtos.UpsertRequest request) {
        validateKey(key);
        return doUpsert(request);
    }

    // ── 배치 upsert + CrawlLog 저장 ─────────────────────────────────────

    @Transactional
    public InternalProductDtos.BatchUpsertResponse batchUpsert(
            String key, InternalProductDtos.BatchUpsertRequest request) {
        validateKey(key);

        int created = 0, updated = 0, failed = 0, totalImages = 0;

        for (InternalProductDtos.UpsertRequest product : request.getProducts()) {
            try {
                InternalProductDtos.UpsertResponse res = doUpsert(product);
                if ("created".equals(res.getStatus())) created++;
                else updated++;
                if (res.getImagesCount() != null) totalImages += res.getImagesCount();
            } catch (Exception e) {
                log.warn("upsert 실패: sourceId={}, error={}", product.getSourceId(), e.getMessage());
                failed++;
            }
        }

        int total = created + updated + failed;
        CrawlLog.Status status = failed == total ? CrawlLog.Status.FAILED
                : failed > 0 ? CrawlLog.Status.PARTIAL
                : CrawlLog.Status.SUCCESS;

        CrawlLog crawlLog = CrawlLog.builder()
                .siteName(request.getSiteName())
                .siteUrl(request.getSiteUrl())
                .itemsCrawled(created + updated)
                .status(status)
                .build();
        CrawlLog saved = crawlLogRepository.save(crawlLog);
        log.info("CrawlLog 저장: id={}, site={}, created={}, updated={}, failed={}, totalImages={}",
                saved.getId(), request.getSiteName(), created, updated, failed, totalImages);

        return InternalProductDtos.BatchUpsertResponse.builder()
                .crawlLogId(saved.getId())
                .created(created)
                .updated(updated)
                .failed(failed)
                .totalImages(totalImages)
                .status(status.name())
                .build();
    }

    // ── 내부 헬퍼 ────────────────────────────────────────────────────────

    private void validateKey(String key) {
        if (!internalApiKey.equals(key)) {
            throw new RuntimeException("Invalid internal API key");
        }
    }

    private InternalProductDtos.UpsertResponse doUpsert(InternalProductDtos.UpsertRequest request) {
        // 5-H D2: brandName null safety (swagkey 처럼 brand 정보 없는 source 대응)
        // null/blank 면 "Unknown" 으로 fallback. 일관성 + NPE 방지.
        String resolvedBrandName = request.getBrandName();
        if (resolvedBrandName == null || resolvedBrandName.isBlank()) {
            resolvedBrandName = "Unknown";
        }
        final String brandNameForLambda = resolvedBrandName;
        Brand brand = brandRepository.findByName(brandNameForLambda)
                .orElseGet(() -> brandRepository.save(
                        Brand.builder().name(brandNameForLambda).build()
                ));

        // 5-H D1: imageUrls 우선, 없으면 imageUrl 1장으로 fallback (후방 호환)
        List<String> imageUrls = resolveImageUrls(request);
        // product.image_url 컬럼은 첫 번째 이미지로 동기화 (카드 UI 등 단일 이미지 사용처)
        String primaryImageUrl = imageUrls.isEmpty() ? null : imageUrls.get(0);

        // 5-H D2: productType 명시되면 enum 변환 (swagkey 카테고리 매핑)
        Product.ProductType resolvedProductType = null;
        if (request.getProductType() != null && !request.getProductType().isBlank()) {
            try {
                resolvedProductType = Product.ProductType.valueOf(request.getProductType());
            } catch (IllegalArgumentException e) {
                log.warn("알 수 없는 productType={}, 무시", request.getProductType());
            }
        }

        Optional<Product> existing = productRepository.findBySourceId(request.getSourceId());

        Product product;
        String upsertStatus;

        if (existing.isPresent()) {
            product = existing.get();
            product.setName(request.getName());
            product.setImageUrl(primaryImageUrl);
            product.setPrice(request.getPrice());
            product.setLayout(request.getLayout());
            product.setSwitchType(request.getSwitchType());
            product.setMountingType(request.getMountingType());
            product.setConnectionType(request.getConnectionType());
            if (request.getGlbUrl() != null) product.setGlbUrl(request.getGlbUrl());
            product.setBrand(brand);
            // 5-H D2: productType 명시되면 적용 (null 이면 기존 값 유지)
            if (resolvedProductType != null) {
                product.setProductType(resolvedProductType);
            }
            upsertStatus = "updated";
        } else {
            // 5-H D2: 신규 product 의 productType 기본값
            // - request.productType 명시 → 그 값
            // - null → UNCLASSIFIED (5-G v3 SQL 분류 후처리 가능)
            Product.ProductType pt = resolvedProductType != null
                    ? resolvedProductType
                    : Product.ProductType.UNCLASSIFIED;
            product = Product.builder()
                    .sourceId(request.getSourceId())
                    .name(request.getName())
                    .imageUrl(primaryImageUrl)
                    .price(request.getPrice())
                    .layout(request.getLayout())
                    .switchType(request.getSwitchType())
                    .mountingType(request.getMountingType())
                    .connectionType(request.getConnectionType())
                    .glbUrl(request.getGlbUrl())
                    .brand(brand)
                    .productType(pt)
                    .build();
            product = productRepository.save(product);
            upsertStatus = "created";
        }

        // 5-H D1: ProductImage 적재 — clean-replace 패턴
        int imagesCount = upsertProductImages(product, imageUrls);

        return InternalProductDtos.UpsertResponse.builder()
                .productId(product.getId())
                .status(upsertStatus)
                .imagesCount(imagesCount)
                .build();
    }

    /**
     * 다중 이미지 URL 결정 (5-H D1).
     *
     * 우선순위:
     *   1) imageUrls 가 있고 비어있지 않으면 → 그대로 사용 (null/빈 문자열은 필터링)
     *   2) imageUrl 단일 필드 → 1장 리스트로 변환
     *   3) 둘 다 없음 → 빈 리스트 (이미지 없는 상품)
     */
    private List<String> resolveImageUrls(InternalProductDtos.UpsertRequest request) {
        List<String> urls = request.getImageUrls();
        if (urls != null && !urls.isEmpty()) {
            // null / 빈 문자열 필터링
            List<String> filtered = new ArrayList<>();
            for (String url : urls) {
                if (url != null && !url.isBlank()) filtered.add(url);
            }
            if (!filtered.isEmpty()) return filtered;
        }
        // fallback: 단일 imageUrl
        String single = request.getImageUrl();
        if (single != null && !single.isBlank()) {
            return Collections.singletonList(single);
        }
        return Collections.emptyList();
    }

    /**
     * ProductImage 테이블 clean-replace 패턴 적재 (5-H D1).
     *
     * 1) 기존 productId 의 product_images row 들 모두 삭제
     * 2) 신규 imageUrls 를 display_order 1, 2, 3... 으로 INSERT
     *
     * 면접 포인트:
     *   - 갱신 시 row 순서가 깨지지 않도록 깨끗이 비우고 다시 적재
     *   - 같은 트랜잭션 안에서 처리해서 일관성 보장 (중간 실패 시 둘 다 롤백)
     *   - GALLERY 타입으로 통일 (THUMBNAIL = display_order=1 의 별도 의미는 사용하지 않음 —
     *     대신 product.image_url 을 첫 번째 이미지로 동기화해서 카드 UI 호환)
     *
     * @return 적재된 이미지 개수
     */
    private int upsertProductImages(Product product, List<String> imageUrls) {
        // 1) 기존 row 정리
        productImageRepository.deleteByProductId(product.getId());

        if (imageUrls.isEmpty()) return 0;

        // 2) 신규 N장 INSERT — display_order 1부터 순차
        List<ProductImage> newImages = new ArrayList<>();
        int order = 1;
        for (String url : imageUrls) {
            newImages.add(ProductImage.builder()
                    .product(product)
                    .imageUrl(url)
                    .displayOrder(order++)
                    .imageType(ProductImage.ImageType.GALLERY)
                    .build());
        }
        productImageRepository.saveAll(newImages);
        return newImages.size();
    }
}
