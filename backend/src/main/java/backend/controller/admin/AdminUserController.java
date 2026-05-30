package backend.controller.admin;

import backend.dto.PagedResponse;
import backend.dto.UserDto;
import backend.service.AdminUserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

/**
 * 관리자 회원 관리 API (Phase 7-G 라운드 4 -> 7-H 회원 관리 강화).
 *
 * 권한: SecurityConfig 의 /api/admin/** hasRole("ADMIN") 으로 일괄 가드.
 * 별도 @PreAuthorize 불필요 (AdminAuditLogController 와 동일 패턴).
 *
 * Endpoints:
 *   GET   /api/admin/users                 — 회원 목록 (페이징 + Provider/Status 필터)
 *   PATCH /api/admin/users/{id}/role       — 회원 role 변경 (USER <-> ADMIN)
 *   PATCH /api/admin/users/{id}/suspend    — 회원 정지 (7-H, body: reason)
 *   PATCH /api/admin/users/{id}/unsuspend  — 정지 해제 (7-H)
 *
 * 필터 파라미터 (목록, 모두 선택):
 *   provider : LOCAL / KAKAO              (생략 시 전체)
 *   status   : ACTIVE / SUSPENDED / WITHDRAWN  (생략 시 전체)
 *   page     : 0-indexed (기본 0)
 *   size     : 1~100 (기본 20)
 */
@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
@Tag(name = "Admin User", description = "관리자 회원 관리 API")
public class AdminUserController {

    private final AdminUserService adminUserService;

    @GetMapping
    @Operation(summary = "회원 목록 (페이징 + Provider/Status 필터)")
    public ResponseEntity<PagedResponse<UserDto.ListItem>> list(
            @Parameter(description = "Provider 필터 (LOCAL / KAKAO)")
            @RequestParam(required = false) String provider,

            @Parameter(description = "Status 필터 (ACTIVE / SUSPENDED / WITHDRAWN)")
            @RequestParam(required = false) String status,

            @Parameter(description = "페이지 번호 (0-indexed)")
            @RequestParam(defaultValue = "0") int page,

            @Parameter(description = "페이지 크기 (1~100)")
            @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(adminUserService.list(provider, status, page, size));
    }

    @PatchMapping("/{id}/role")
    @Operation(summary = "회원 role 변경 (USER <-> ADMIN)")
    public ResponseEntity<UserDto.ListItem> updateRole(
            @PathVariable Long id,
            @RequestBody UserDto.RoleUpdateRequest req,
            @AuthenticationPrincipal UserDetails admin
    ) {
        // admin.getUsername() == 현재 로그인 관리자 email (JWT principal).
        UserDto.ListItem updated = adminUserService.updateRole(id, req.role(), admin.getUsername());
        return ResponseEntity.ok(updated);
    }

    @PatchMapping("/{id}/suspend")
    @Operation(summary = "회원 정지 (불량 유저 제재)")
    public ResponseEntity<UserDto.ListItem> suspend(
            @PathVariable Long id,
            @RequestBody(required = false) UserDto.SuspendRequest req,
            @AuthenticationPrincipal UserDetails admin
    ) {
        // body 가 없을 수도 있음(사유 미입력 정지) -> reason null 처리.
        String reason = (req == null) ? null : req.reason();
        UserDto.ListItem updated = adminUserService.suspend(id, reason, admin.getUsername());
        return ResponseEntity.ok(updated);
    }

    @PatchMapping("/{id}/unsuspend")
    @Operation(summary = "회원 정지 해제")
    public ResponseEntity<UserDto.ListItem> unsuspend(
            @PathVariable Long id
    ) {
        UserDto.ListItem updated = adminUserService.unsuspend(id);
        return ResponseEntity.ok(updated);
    }
}
