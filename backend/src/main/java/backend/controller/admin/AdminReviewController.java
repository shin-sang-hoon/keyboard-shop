package backend.controller.admin;

import backend.dto.AdminReviewDto;
import backend.dto.PagedResponse;
import backend.entity.ReviewReport;
import backend.service.AdminReviewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

/**
 * 관리자 리뷰·신고 운영 컨트롤러 (7-G R8).
 *
 * 경로: /api/admin/** — SecurityConfig 의 hasRole("ADMIN") 일괄 가드로 보호.
 *   (별도 메서드 레벨 권한 어노테이션 불필요 — 7-G R3~R7 컨트롤러와 동일 패턴)
 *
 * 엔드포인트:
 *   GET    /api/admin/reviews                 리뷰 목록 (hidden 필터)
 *   PATCH  /api/admin/reviews/{id}/visibility 리뷰 숨김/복원
 *   GET    /api/admin/reports                 신고 큐 (status 필터)
 *   POST   /api/admin/reports/{id}/resolve    신고 인용 (리뷰 숨김)
 *   POST   /api/admin/reports/{id}/dismiss    신고 기각
 */
@Tag(name = "Admin Review", description = "관리자 리뷰·신고 운영")
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminReviewController {

    private final AdminReviewService adminReviewService;

    // ─── 리뷰 ───────────────────────────────────────────

    @Operation(summary = "리뷰 목록", description = "숨김 리뷰 포함. hidden 파라미터로 필터(생략 시 전체).")
    @GetMapping("/reviews")
    public ResponseEntity<PagedResponse<AdminReviewDto.ListItem>> listReviews(
            @RequestParam(required = false) Boolean hidden,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(adminReviewService.listReviews(hidden, page, size));
    }

    @Operation(summary = "리뷰 숨김/복원", description = "hidden=true 숨김, false 복원. 숨김 리뷰는 공개 페이지·별점 통계에서 제외.")
    @PatchMapping("/reviews/{id}/visibility")
    public ResponseEntity<AdminReviewDto.ListItem> updateVisibility(
            @PathVariable Long id,
            @RequestBody AdminReviewDto.VisibilityRequest request) {
        return ResponseEntity.ok(adminReviewService.updateVisibility(id, request.hidden()));
    }

    // ─── 신고 ───────────────────────────────────────────

    @Operation(summary = "신고 큐", description = "status 파라미터로 필터(PENDING/RESOLVED/DISMISSED, 생략 시 전체).")
    @GetMapping("/reports")
    public ResponseEntity<PagedResponse<AdminReviewDto.ReportItem>> listReports(
            @RequestParam(required = false) ReviewReport.ReportStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(adminReviewService.listReports(status, page, size));
    }

    @Operation(summary = "신고 인용", description = "대상 리뷰를 숨기고 같은 리뷰의 대기 신고를 일괄 처리합니다.")
    @PostMapping("/reports/{id}/resolve")
    public ResponseEntity<Void> resolveReport(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails admin) {
        adminReviewService.resolveReport(id, admin.getUsername());
        return ResponseEntity.ok().build();
    }

    @Operation(summary = "신고 기각", description = "해당 신고만 기각 처리합니다. 리뷰는 그대로 노출됩니다.")
    @PostMapping("/reports/{id}/dismiss")
    public ResponseEntity<Void> dismissReport(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails admin) {
        adminReviewService.dismissReport(id, admin.getUsername());
        return ResponseEntity.ok().build();
    }
}
