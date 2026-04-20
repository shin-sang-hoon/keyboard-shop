package backend.controller;

import backend.dto.TagDto;
import backend.service.AdminTagService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/tags")
@RequiredArgsConstructor
@Tag(name = "Admin Tag", description = "관리자 태그 관리 API")
public class AdminTagController {

    private final AdminTagService adminTagService;

    @GetMapping
    @Operation(summary = "태그 전체 조회")
    public ResponseEntity<List<TagDto.Response>> getAllTags() {
        return ResponseEntity.ok(adminTagService.getAllTags());
    }

    @PostMapping
    @Operation(summary = "태그 생성")
    public ResponseEntity<TagDto.Response> createTag(@RequestBody TagDto.Request request) {
        return ResponseEntity.ok(adminTagService.createTag(request));
    }

    @PutMapping("/{id}")
    @Operation(summary = "태그 수정")
    public ResponseEntity<TagDto.Response> updateTag(@PathVariable Long id,
                                                     @RequestBody TagDto.Request request) {
        return ResponseEntity.ok(adminTagService.updateTag(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "태그 삭제")
    public ResponseEntity<Void> deleteTag(@PathVariable Long id) {
        adminTagService.deleteTag(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/bulk-apply")
    @Operation(summary = "태그 상품 일괄 적용")
    public ResponseEntity<Void> bulkApply(@RequestBody TagDto.BulkApplyRequest request) {
        adminTagService.bulkApply(request);
        return ResponseEntity.ok().build();
    }
}