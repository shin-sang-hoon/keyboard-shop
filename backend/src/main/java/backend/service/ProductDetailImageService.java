package backend.service;

import backend.entity.Product;
import backend.entity.ProductDetailImage;
import backend.entity.ProductDetailImage.Status;
import backend.exception.BusinessException;
import backend.repository.ProductDetailImageRepository;
import backend.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * 상품 상세정보(description) 인라인 이미지의 저장 + 수명주기 관리 (P3 · 5/29).
 *
 * 디스크 저장 패턴은 NoticeFileService 와 동일 (로컬 디스크 + UUID 저장명 + /uploads/ 정적 서빙),
 * 단 subdir 가 "products" 이고 추적 테이블(product_detail_images)로 수명주기를 관리한다는 점이 다르다.
 *
 * 핵심: WYSIWYG 인라인 이미지는 description HTML 이 진실의 원천 → 단순 1:N cascade 로
 * "업로드됐다 본문에서 제거된" 고아를 못 잡는다. 그래서:
 *   - store    : 업로드 → 디스크 저장 + PENDING row 추적, URL 반환 (에디터가 임베드)
 *   - reconcile: 저장된 HTML 파싱 → 참조 url 은 CONFIRMED, 미참조는 파일+row 삭제 (GC)
 *   - cleanupAbandonedUploads : 저장 없이 버려진 PENDING(24h+) 회수 (@Scheduled)
 *   - deleteAllByProduct      : 상품 삭제 전 파일+row 선정리
 */
@Service
@RequiredArgsConstructor
public class ProductDetailImageService {

    private static final Logger log = LoggerFactory.getLogger(ProductDetailImageService.class);

    private final ProductDetailImageRepository detailImageRepository;
    private final ProductRepository productRepository;

    @Value("${app.upload.dir:./uploads}")
    private String uploadDir;

    /** 상세 이미지 전용 하위 디렉터리 (공지=notices, 상세=products). */
    private static final String SUBDIR = "products";

    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"
    );

    /** 업로드 결과 — 에디터가 <img src> 로 임베드할 URL 만 필요. */
    public record UploadResult(String url) {
    }

    /**
     * 인라인 이미지 1개 업로드 — 디스크 저장 + PENDING 추적 row 생성.
     *
     * @throws BusinessException 상품 없음 / 빈 파일 / 비이미지 / 저장 실패
     */
    @Transactional
    public UploadResult store(Long productId, MultipartFile file) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> BusinessException.notFound("상품을 찾을 수 없습니다."));

        if (file == null || file.isEmpty()) {
            throw BusinessException.badRequest("빈 파일은 업로드할 수 없습니다.");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase())) {
            throw BusinessException.badRequest("이미지 파일(png/jpg/gif/webp)만 업로드할 수 있습니다.");
        }

        String ext = extractExtension(file.getOriginalFilename());
        String storedName = UUID.randomUUID().toString().replace("-", "") + ext;
        try {
            Path dir = Paths.get(uploadDir, SUBDIR);
            Files.createDirectories(dir);
            file.transferTo(dir.resolve(storedName));
        } catch (IOException e) {
            throw BusinessException.badRequest("파일 저장에 실패했습니다: " + e.getMessage());
        }

        String url = "/uploads/" + SUBDIR + "/" + storedName;
        ProductDetailImage img = ProductDetailImage.builder()
                .product(product)
                .storedName(storedName)
                .url(url)
                .originalName(file.getOriginalFilename())
                .contentType(contentType)
                .fileSize(file.getSize())
                .status(Status.PENDING)
                .build();
        detailImageRepository.save(img);

        return new UploadResult(url);
    }

    /**
     * 저장된 description HTML 기준으로 추적 이미지를 정리한다 (핵심 — 고아 파일 GC).
     *   - HTML 에 url 참조됨   → CONFIRMED (dirty checking 으로 update)
     *   - 참조 안 됨(본문에서 제거) → 디스크 파일 + row 삭제
     *
     * url(/uploads/products/{uuid}.ext)은 UUID 라 contains() 매칭이 안전.
     * 에디터가 절대 URL(http://host/uploads/...)로 저장해도 상대 url 을 substring 으로 포함 → 매칭 OK.
     */
    @Transactional
    public void reconcile(Long productId, String html) {
        List<ProductDetailImage> tracked = detailImageRepository.findByProductId(productId);
        if (tracked.isEmpty()) return;

        String safe = html == null ? "" : html;
        List<ProductDetailImage> orphans = new ArrayList<>();
        for (ProductDetailImage img : tracked) {
            if (safe.contains(img.getUrl())) {
                if (img.getStatus() != Status.CONFIRMED) {
                    img.setStatus(Status.CONFIRMED);
                }
            } else {
                orphans.add(img);
            }
        }
        for (ProductDetailImage o : orphans) {
            deleteFile(o.getStoredName());
        }
        if (!orphans.isEmpty()) {
            detailImageRepository.deleteAll(orphans);
            log.info("[ProductDetailImage] reconcile product={} 고아 {}건 정리", productId, orphans.size());
        }
    }

    /** 상품 삭제 전 호출 — 디스크 파일 + row 선정리 (DB FK ON DELETE CASCADE 는 안전망). */
    @Transactional
    public void deleteAllByProduct(Long productId) {
        List<ProductDetailImage> imgs = detailImageRepository.findByProductId(productId);
        if (imgs.isEmpty()) return;
        for (ProductDetailImage img : imgs) {
            deleteFile(img.getStoredName());
        }
        detailImageRepository.deleteAll(imgs);
    }

    /**
     * @Scheduled GC — 미확정(PENDING) + cutoff 이전 = 저장 없이 버려진 업로드 회수.
     * @return 정리된 건수
     */
    @Transactional
    public int cleanupAbandonedUploads(int olderThanHours) {
        LocalDateTime cutoff = LocalDateTime.now().minusHours(olderThanHours);
        List<ProductDetailImage> abandoned =
                detailImageRepository.findByStatusAndCreatedAtBefore(Status.PENDING, cutoff);
        if (abandoned.isEmpty()) return 0;
        for (ProductDetailImage img : abandoned) {
            deleteFile(img.getStoredName());
        }
        detailImageRepository.deleteAll(abandoned);
        return abandoned.size();
    }

    private void deleteFile(String storedName) {
        if (storedName == null || storedName.isBlank()) return;
        try {
            Files.deleteIfExists(Paths.get(uploadDir, SUBDIR, storedName));
        } catch (IOException ignored) {
            // 삭제 실패해도 치명적이지 않음(DB row 는 제거됨) — 다음 GC 대상.
        }
    }

    private String extractExtension(String filename) {
        if (filename == null) return "";
        int dot = filename.lastIndexOf('.');
        return dot >= 0 ? filename.substring(dot).toLowerCase() : "";
    }
}
