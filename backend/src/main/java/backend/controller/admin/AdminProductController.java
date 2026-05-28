package backend.controller.admin;

import backend.dto.AdminProductDto;
import backend.dto.PagedResponse;
import backend.service.AdminProductService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * 관리자 상품 관리 API (Phase 7-G 라운드 5).
 *
 * 권한: SecurityConfig 의 /api/admin/** hasRole("ADMIN") 으로 일괄 가드.
 * 별도 @PreAuthorize 불필요 (AdminAuditLogController 와 동일 패턴).
 *
 * Endpoints:
 *   GET   /api/admin/products              — 상품 목록 (페이징 + 필터)
 *   PATCH /api/admin/products/{id}/status  — 상품 상태 토글 (ACTIVE ↔ INACTIVE)
 *   PATCH /api/admin/products/{id}/brand   — 상품 브랜드 변경 (P1)
 *   PATCH /api/admin/products/{id}/stock   — 상품 재고 변경 (P1 5/28 — 품절/판매재개)
 *
 * 필터 파라미터 (목록, 모두 선택):
 *   status      : ACTIVE / INACTIVE / SOLD_OUT  (생략 시 전체)
 *   productType : KEYBOARD / KEYCAP / SWITCH_PART / ACCESSORY ... (생략 시 전체)
 *   search      : 상품명 부분 일치 (생략 시 전체)
 *   soldOut     : true=품절(stock=0)만 / false=재고있음만 (생략 시 전체)
 *   page        : 0-indexed (기본 0)
 *   size        : 1~100 (기본 20)
 */
@RestController
@RequestMapping("/api/admin/products")
@RequiredArgsConstructor
@Tag(name = "Admin Product", description = "관리자 상품 관리 API")
public class AdminProductController {

    private final AdminProductService adminProductService;

    @GetMapping
    @Operation(summary = "상품 목록 (페이징 + status/type/search/soldOut 필터)")
    public ResponseEntity<PagedResponse<AdminProductDto.ListItem>> list(
            @Parameter(description = "상태 필터 (ACTIVE / INACTIVE / SOLD_OUT)")
            @RequestParam(required = false) String status,

            @Parameter(description = "상품 타입 필터 (KEYBOARD / KEYCAP / SWITCH_PART / ACCESSORY)")
            @RequestParam(required = false) String productType,

            @Parameter(description = "상품명 검색어")
            @RequestParam(required = false) String search,

            @Parameter(description = "품절 필터 (true=품절만, false=재고있음만, 생략=전체)")
            @RequestParam(required = false) Boolean soldOut,

            @Parameter(description = "페이지 번호 (0-indexed)")
            @RequestParam(defaultValue = "0") int page,

            @Parameter(description = "페이지 크기 (1~100)")
            @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(
                adminProductService.list(status, productType, search, soldOut, page, size));
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "상품 상태 토글 (ACTIVE ↔ INACTIVE)")
    public ResponseEntity<AdminProductDto.ListItem> updateStatus(
            @PathVariable Long id,
            @RequestBody AdminProductDto.StatusUpdateRequest req
    ) {
        return ResponseEntity.ok(adminProductService.updateStatus(id, req.status()));
    }

    @PatchMapping("/{id}/brand")
    @Operation(summary = "상품 브랜드 변경 (brandId=null 이면 미지정)")
    public ResponseEntity<AdminProductDto.ListItem> updateBrand(
            @PathVariable Long id,
            @RequestBody AdminProductDto.BrandUpdateRequest req
    ) {
        return ResponseEntity.ok(adminProductService.updateBrand(id, req.brandId()));
    }

    @PatchMapping("/{id}/stock")
    @Operation(summary = "상품 재고 변경 (품절 처리=0, 판매 재개=양수)")
    public ResponseEntity<AdminProductDto.ListItem> updateStock(
            @PathVariable Long id,
            @RequestBody AdminProductDto.StockUpdateRequest req
    ) {
        return ResponseEntity.ok(adminProductService.updateStock(id, req.stock()));
    }
}
