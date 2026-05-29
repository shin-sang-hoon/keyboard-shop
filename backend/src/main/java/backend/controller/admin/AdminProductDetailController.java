package backend.controller.admin;

import backend.dto.AdminProductDetailDto;
import backend.service.ProductDetailImageService;
import backend.service.ProductService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/**
 * 관리자 상품 상세정보(description) + 인라인 이미지 관리 API (P3 · 5/29).
 *
 * 권한: SecurityConfig 의 /api/admin/** hasRole("ADMIN") 일괄 가드.
 * AdminProductController 와 같은 /api/admin/products 베이스지만 경로가 달라 충돌 없음
 * (필드 토글=AdminProductController / 콘텐츠·파일 수명주기=본 컨트롤러, 책임 분리).
 *
 * description 쓰기를 공개 PUT /api/products/{id}(permitAll)가 아니라 이 가드 경로로만 허용 —
 * HTML 본문이 stored XSS 벡터라 인증/권한 경계 안에서만 입력받는다 (방어 깊이).
 */
@RestController
@RequestMapping("/api/admin/products")
@RequiredArgsConstructor
@Tag(name = "Admin Product Detail", description = "관리자 상세정보 + 인라인 이미지 관리 API")
public class AdminProductDetailController {

    private final ProductService productService;
    private final ProductDetailImageService productDetailImageService;

    @PatchMapping("/{id}/description")
    @Operation(summary = "상품 상세정보(HTML) 저장 + 인라인 이미지 reconcile")
    public ResponseEntity<Void> updateDescription(
            @PathVariable Long id,
            @RequestBody AdminProductDetailDto.DescriptionUpdateRequest req
    ) {
        productService.updateDescription(id, req.description());
        return ResponseEntity.ok().build();
    }

    @PostMapping(value = "/{id}/detail-images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "상세정보 인라인 이미지 업로드 (PENDING 추적 + URL 반환)")
    public ResponseEntity<AdminProductDetailDto.UploadResponse> uploadDetailImage(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file
    ) {
        ProductDetailImageService.UploadResult result = productDetailImageService.store(id, file);
        return ResponseEntity.ok(new AdminProductDetailDto.UploadResponse(result.url()));
    }
}
