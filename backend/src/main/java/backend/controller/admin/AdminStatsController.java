package backend.controller.admin;

import backend.dto.AdminStatsDto;
import backend.service.AdminStatsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 관리자 대시보드 통계 API (Phase 7-G 라운드 3).
 *
 * 권한: SecurityConfig 의 /api/admin/** hasRole("ADMIN") 으로 일괄 가드.
 * 별도 @PreAuthorize 불필요 (AdminAuditLogController 와 동일 패턴).
 *
 * Endpoint:
 *   GET /api/admin/stats — 대시보드 4개 COUNT (상품/회원/리뷰/주문)
 */
@RestController
@RequestMapping("/api/admin/stats")
@RequiredArgsConstructor
@Tag(name = "Admin Stats", description = "관리자 대시보드 통계 API")
public class AdminStatsController {

    private final AdminStatsService adminStatsService;

    @GetMapping
    @Operation(summary = "대시보드 통계 (상품/회원/리뷰/주문 COUNT)")
    public ResponseEntity<AdminStatsDto> getStats() {
        return ResponseEntity.ok(adminStatsService.getStats());
    }
}
