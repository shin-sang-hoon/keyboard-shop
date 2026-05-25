package backend.controller;

import backend.dto.NoticeDto;
import backend.dto.PagedResponse;
import backend.service.NoticeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * 공개 공지 API (Phase 7-B — 사용자 공지 연동).
 *
 * 관리자 공지 API(AdminNoticeController, /api/admin/notices)와 분리한
 * 사용자 노출용 엔드포인트. 권한: SecurityConfig 에서 /api/notices/**
 * permitAll (비로그인 방문자도 공지 열람 + 조회수 증가 가능).
 *
 * Endpoints:
 *   GET  /api/notices            — 목록 (서버 페이징)
 *   GET  /api/notices/{id}       — 상세 (본문 + 이전/다음 글 통합)
 *   POST /api/notices/{id}/view  — 조회수 +1 (GET 멱등성 보존 위해 분리)
 */
@RestController
@RequestMapping("/api/notices")
@RequiredArgsConstructor
@Tag(name = "Notice", description = "공개 공지 API")
public class NoticeController {

    private final NoticeService noticeService;

    @GetMapping
    @Operation(summary = "공지 목록 (서버 페이징)")
    public ResponseEntity<PagedResponse<NoticeDto.ListItem>> list(
            @Parameter(description = "페이지 번호 (0-indexed)")
            @RequestParam(defaultValue = "0") int page,

            @Parameter(description = "페이지 크기 (1~100, 기본 10)")
            @RequestParam(defaultValue = "10") int size
    ) {
        return ResponseEntity.ok(noticeService.list(page, size));
    }

    @GetMapping("/{id}")
    @Operation(summary = "공지 상세 (본문 + 이전/다음 글)")
    public ResponseEntity<NoticeDto.Detail> get(@PathVariable Long id) {
        return ResponseEntity.ok(noticeService.get(id));
    }

    @PostMapping("/{id}/view")
    @Operation(summary = "조회수 +1 — 상세 진입 시 1회 호출")
    public ResponseEntity<NoticeDto.ViewCountResponse> increaseViewCount(
            @PathVariable Long id
    ) {
        return ResponseEntity.ok(noticeService.increaseViewCount(id));
    }
}
