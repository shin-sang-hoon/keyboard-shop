package backend.controller.admin;

import backend.dto.AuditLogDto;
import backend.dto.PagedResponse;
import backend.entity.AuditCategory;
import backend.entity.AuditEventType;
import backend.service.AdminAuditLogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;

/**
 * AuditLog 뷰어 API (Phase 7 [9-2]).
 *
 * 권한: SecurityConfig 의 /api/admin/** hasRole("ADMIN") 으로 일괄 가드.
 * 별도 @PreAuthorize 어노테이션 불필요 (기존 AdminBrand/Category 와 동일 패턴).
 *
 * Endpoints:
 *   GET /api/admin/audit-logs           — 페이징 + 필터 목록
 *   GET /api/admin/audit-logs/{id}      — 단건 상세 (detail JSON 포함)
 *
 * 필터 파라미터 (모두 선택):
 *   adminId     : Long
 *   category    : PRODUCT / USER / ORDER / CRAWLER / CHATBOT
 *   eventType   : CREATE / UPDATE / DELETE / BLOCK / UNBLOCK / EXECUTE / VIEW
 *   result      : SUCCESS / FAILURE
 *   dateFrom    : ISO 8601 (예: 2026-05-11T00:00:00)
 *   dateTo      : ISO 8601
 *   page        : 0-indexed (기본 0)
 *   size        : 1~100 (기본 20)
 */
@RestController
@RequestMapping("/api/admin/audit-logs")
@RequiredArgsConstructor
@Tag(name = "Admin AuditLog", description = "관리자 감사 로그 조회 API (7-A 백엔드 짝꿍 뷰어)")
public class AdminAuditLogController {

    private final AdminAuditLogService adminAuditLogService;

    @GetMapping
    @Operation(summary = "감사 로그 목록 (페이징 + 필터)")
    public ResponseEntity<PagedResponse<AuditLogDto.ListItem>> list(
            @Parameter(description = "관리자 ID 필터")
            @RequestParam(required = false) Long adminId,

            @Parameter(description = "카테고리 필터")
            @RequestParam(required = false) AuditCategory category,

            @Parameter(description = "이벤트 타입 필터")
            @RequestParam(required = false) AuditEventType eventType,

            @Parameter(description = "결과 필터 (SUCCESS / FAILURE)")
            @RequestParam(required = false) String result,

            @Parameter(description = "시작 시각 (ISO 8601)")
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime dateFrom,

            @Parameter(description = "종료 시각 (ISO 8601)")
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime dateTo,

            @Parameter(description = "페이지 번호 (0-indexed)")
            @RequestParam(defaultValue = "0") int page,

            @Parameter(description = "페이지 크기 (1~100)")
            @RequestParam(defaultValue = "20") int size
    ) {
        PagedResponse<AuditLogDto.ListItem> response = adminAuditLogService.list(
                adminId, category, eventType, result, dateFrom, dateTo, page, size
        );
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    @Operation(summary = "감사 로그 단건 상세 (detail JSON 포함)")
    public ResponseEntity<AuditLogDto.Detail> getDetail(@PathVariable Long id) {
        return ResponseEntity.ok(adminAuditLogService.getDetail(id));
    }
}
