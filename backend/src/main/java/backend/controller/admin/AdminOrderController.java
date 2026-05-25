package backend.controller.admin;

import backend.dto.AdminOrderDto;
import backend.dto.PagedResponse;
import backend.service.AdminOrderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * 관리자 주문 관리 API (Phase 7-G 라운드 6).
 *
 * 권한: SecurityConfig 의 /api/admin/** hasRole("ADMIN") 으로 일괄 가드.
 * 별도 @PreAuthorize 불필요 (AdminAuditLogController 와 동일 패턴).
 *
 * Endpoints:
 *   GET   /api/admin/orders              — 주문 목록 (페이징 + status 필터)
 *   PATCH /api/admin/orders/{id}/status  — 주문 상태 변경
 *
 * 필터 파라미터 (목록, 모두 선택):
 *   status : PENDING / PAID / SHIPPING / DELIVERED / CANCELLED (생략 시 전체)
 *   page   : 0-indexed (기본 0)
 *   size   : 1~100 (기본 20)
 */
@RestController
@RequestMapping("/api/admin/orders")
@RequiredArgsConstructor
@Tag(name = "Admin Order", description = "관리자 주문 관리 API")
public class AdminOrderController {

    private final AdminOrderService adminOrderService;

    @GetMapping
    @Operation(summary = "주문 목록 (페이징 + status 필터)")
    public ResponseEntity<PagedResponse<AdminOrderDto.ListItem>> list(
            @Parameter(description = "주문 상태 필터 (PENDING / PAID / SHIPPING / DELIVERED / CANCELLED)")
            @RequestParam(required = false) String status,

            @Parameter(description = "페이지 번호 (0-indexed)")
            @RequestParam(defaultValue = "0") int page,

            @Parameter(description = "페이지 크기 (1~100)")
            @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(adminOrderService.list(status, page, size));
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "주문 상태 변경")
    public ResponseEntity<AdminOrderDto.ListItem> updateStatus(
            @PathVariable Long id,
            @RequestBody AdminOrderDto.StatusUpdateRequest req
    ) {
        return ResponseEntity.ok(adminOrderService.updateStatus(id, req.status()));
    }
}
