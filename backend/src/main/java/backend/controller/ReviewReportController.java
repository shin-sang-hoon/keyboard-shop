package backend.controller;

import backend.dto.ReviewReportDto;
import backend.exception.BusinessException;
import backend.service.ReviewReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

/**
 * 리뷰 신고 컨트롤러 — 사용자 측 (7-G R8).
 *
 * 관리자 측 신고 조회/처리는 AdminReviewController(/api/admin/reports) 가 담당.
 *
 * 인증:
 *  - 신고는 로그인 사용자만 가능.
 *  - SecurityConfig 가 /api/reviews/** 의 비-GET 을 authenticated 로 막는 것을 전제로 하되,
 *    혹시 누락돼 익명 요청이 들어와도 principal == null 가드로 401 을 보장 (이중 방어).
 */
@Tag(name = "Review Report", description = "리뷰 신고 (사용자)")
@RestController
@RequestMapping("/api/reviews")
@RequiredArgsConstructor
public class ReviewReportController {

    private final ReviewReportService reviewReportService;

    @Operation(summary = "리뷰 신고 등록", description = "부적절한 리뷰를 신고합니다. 본인 리뷰/중복 신고는 거부됩니다.")
    @PostMapping("/{reviewId}/report")
    public ResponseEntity<Void> reportReview(
            @PathVariable Long reviewId,
            @RequestBody ReviewReportDto.CreateRequest request,
            @AuthenticationPrincipal UserDetails principal) {

        if (principal == null) {
            throw BusinessException.unauthorized("로그인이 필요합니다.");
        }

        reviewReportService.createReport(principal.getUsername(), reviewId, request);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }
}
