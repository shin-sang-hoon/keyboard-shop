package backend.controller.admin;

import backend.dto.AdminNoticeDto;
import backend.dto.PagedResponse;
import backend.service.AdminNoticeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * 관리자 공지 관리 API (Phase 7-G 라운드 7).
 *
 * 권한: SecurityConfig 의 /api/admin/** hasRole("ADMIN") 일괄 가드.
 *
 * Endpoints:
 *   GET    /api/admin/notices         — 목록 (페이징 + 제목 검색)
 *   GET    /api/admin/notices/{id}    — 상세 (본문 포함)
 *   POST   /api/admin/notices         — 등록
 *   PUT    /api/admin/notices/{id}    — 수정
 *   DELETE /api/admin/notices/{id}    — 삭제
 */
@RestController
@RequestMapping("/api/admin/notices")
@RequiredArgsConstructor
@Tag(name = "Admin Notice", description = "관리자 공지 관리 API")
public class AdminNoticeController {

    private final AdminNoticeService adminNoticeService;

    @GetMapping
    @Operation(summary = "공지 목록 (페이징 + 제목 검색)")
    public ResponseEntity<PagedResponse<AdminNoticeDto.ListItem>> list(
            @Parameter(description = "제목 부분 검색어")
            @RequestParam(required = false) String search,

            @Parameter(description = "페이지 번호 (0-indexed)")
            @RequestParam(defaultValue = "0") int page,

            @Parameter(description = "페이지 크기 (1~100)")
            @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(adminNoticeService.list(search, page, size));
    }

    @GetMapping("/{id}")
    @Operation(summary = "공지 상세 (본문 포함)")
    public ResponseEntity<AdminNoticeDto.Detail> get(@PathVariable Long id) {
        return ResponseEntity.ok(adminNoticeService.get(id));
    }

    @PostMapping
    @Operation(summary = "공지 등록")
    public ResponseEntity<AdminNoticeDto.Detail> create(
            @RequestBody AdminNoticeDto.SaveRequest req
    ) {
        return ResponseEntity.ok(adminNoticeService.create(req));
    }

    @PutMapping("/{id}")
    @Operation(summary = "공지 수정")
    public ResponseEntity<AdminNoticeDto.Detail> update(
            @PathVariable Long id,
            @RequestBody AdminNoticeDto.SaveRequest req
    ) {
        return ResponseEntity.ok(adminNoticeService.update(id, req));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "공지 삭제")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        adminNoticeService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
