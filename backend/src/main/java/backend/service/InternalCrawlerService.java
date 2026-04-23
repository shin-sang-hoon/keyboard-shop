package backend.service;

import backend.dto.InternalProductDtos;
import backend.entity.Brand;
import backend.entity.CrawlLog;
import backend.entity.Product;
import backend.repository.BrandRepository;
import backend.repository.CrawlLogRepository;
import backend.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class InternalCrawlerService {

    private final ProductRepository productRepository;
    private final BrandRepository brandRepository;
    private final CrawlLogRepository crawlLogRepository;

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

        int created = 0, updated = 0, failed = 0;

        for (InternalProductDtos.UpsertRequest product : request.getProducts()) {
            try {
                InternalProductDtos.UpsertResponse res = doUpsert(product);
                if ("created".equals(res.getStatus())) created++;
                else updated++;
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
        log.info("CrawlLog 저장: id={}, site={}, created={}, updated={}, failed={}",
                saved.getId(), request.getSiteName(), created, updated, failed);

        return InternalProductDtos.BatchUpsertResponse.builder()
                .crawlLogId(saved.getId())
                .created(created)
                .updated(updated)
                .failed(failed)
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
        Brand brand = brandRepository.findByName(request.getBrandName())
                .orElseGet(() -> brandRepository.save(
                        Brand.builder().name(request.getBrandName()).build()
                ));

        Optional<Product> existing = productRepository.findBySourceId(request.getSourceId());

        if (existing.isPresent()) {
            Product product = existing.get();
            product.setName(request.getName());
            product.setImageUrl(request.getImageUrl());
            product.setPrice(request.getPrice());
            product.setLayout(request.getLayout());
            product.setSwitchType(request.getSwitchType());
            product.setMountingType(request.getMountingType());
            product.setConnectionType(request.getConnectionType());
            if (request.getGlbUrl() != null) product.setGlbUrl(request.getGlbUrl());
            product.setBrand(brand);
            return InternalProductDtos.UpsertResponse.builder()
                    .productId(product.getId())
                    .status("updated")
                    .build();
        } else {
            Product product = Product.builder()
                    .sourceId(request.getSourceId())
                    .name(request.getName())
                    .imageUrl(request.getImageUrl())
                    .price(request.getPrice())
                    .layout(request.getLayout())
                    .switchType(request.getSwitchType())
                    .mountingType(request.getMountingType())
                    .connectionType(request.getConnectionType())
                    .glbUrl(request.getGlbUrl())
                    .brand(brand)
                    .build();
            Product saved = productRepository.save(product);
            return InternalProductDtos.UpsertResponse.builder()
                    .productId(saved.getId())
                    .status("created")
                    .build();
        }
    }
}
