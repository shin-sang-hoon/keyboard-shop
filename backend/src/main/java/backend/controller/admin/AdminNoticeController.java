package backend.controller.admin;

import backend.dto.AdminNoticeDto;
import backend.dto.PagedResponse;
import backend.service.AdminNoticeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * 관리자 공지 관리 API (Phase 7-G 라운드 7 + 7-B 첨부 연동).
 *
 * 권한: SecurityConfig 의 /api/admin/** hasRole("ADMIN") 일괄 가드.
 * 메인 페이지의 ADMIN 글쓰기/수정/삭제도 모두 이 엔드포인트를 호출한다.
 *
 * 7-B 변경: 등록·수정이 첨부 이미지 업로드를 포함하므로
 * application/json → multipart/form-data 로 전환. 텍스트 필드와 파일을
 * @RequestParam 으로 함께 받는다(프론트 FormData 와 1:1 매칭).
 *
 * Endpoints:
 *   GET    /api/admin/notices         — 목록 (페이징 + 제목 검색)
 *   GET    /api/admin/notices/{id}    — 상세 (본문 + 첨부 포함)
 *   POST   /api/admin/notices         — 등록 (multipart)
 *   PUT    /api/admin/notices/{id}    — 수정 (multipart)
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
    @Operation(summary = "공지 상세 (본문 + 첨부 포함)")
    public ResponseEntity<AdminNoticeDto.Detail> get(@PathVariable Long id) {
        return ResponseEntity.ok(adminNoticeService.get(id));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "공지 등록 (첨부 이미지 포함)")
    public ResponseEntity<AdminNoticeDto.Detail> create(
            @RequestParam String title,
            @RequestParam String content,
            @RequestParam(required = false, defaultValue = "false") boolean pinned,

            @Parameter(description = "첨부 이미지 파일들 (선택)")
            @RequestParam(required = false) List<MultipartFile> images
    ) {
        return ResponseEntity.ok(
                adminNoticeService.create(title, content, pinned, images));
    }

    @PutMapping(path = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "공지 수정 (첨부 추가/삭제 포함)")
    public ResponseEntity<AdminNoticeDto.Detail> update(
            @PathVariable Long id,
            @RequestParam String title,
            @RequestParam String content,
            @RequestParam(required = false, defaultValue = "false") boolean pinned,

            @Parameter(description = "새로 추가할 첨부 이미지 (선택)")
            @RequestParam(required = false) List<MultipartFile> images,

            @Parameter(description = "삭제할 기존 첨부 id (선택)")
            @RequestParam(required = false) List<Long> deleteAttachmentIds
    ) {
        return ResponseEntity.ok(
                adminNoticeService.update(id, title, content, pinned, images, deleteAttachmentIds));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "공지 삭제")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        adminNoticeService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
