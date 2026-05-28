package backend.controller;

import backend.dto.SubCategoryDto;
import backend.service.AdminSubCategoryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 관리자 하위 카테고리 관리 API (P2, 2026-05-28).
 *
 * AdminCategoryController 와 동일 위치(controller/)·스타일.
 * /api/admin/** 는 SecurityConfig 에서 hasRole(ADMIN) 일괄 가드.
 */
@RestController
@RequestMapping("/api/admin/sub-categories")
@RequiredArgsConstructor
@Tag(name = "Admin SubCategory", description = "관리자 하위 카테고리 관리 API")
public class AdminSubCategoryController {

    private final AdminSubCategoryService adminSubCategoryService;

    @GetMapping
    @Operation(summary = "하위 카테고리 조회 (productType 지정 시 해당 대분류만, 없으면 전체)")
    public ResponseEntity<List<SubCategoryDto.Response>> getSubCategories(
            @RequestParam(required = false) String productType) {
        if (productType != null && !productType.isBlank()) {
            return ResponseEntity.ok(adminSubCategoryService.getByProductType(productType.trim().toUpperCase()));
        }
        return ResponseEntity.ok(adminSubCategoryService.getAll());
    }

    @PostMapping
    @Operation(summary = "하위 카테고리 생성")
    public ResponseEntity<SubCategoryDto.Response> create(@RequestBody SubCategoryDto.Request request) {
        return ResponseEntity.ok(adminSubCategoryService.create(request));
    }

    @PutMapping("/{id}")
    @Operation(summary = "하위 카테고리 수정 (name/sortOrder 만, productType 변경 불가)")
    public ResponseEntity<SubCategoryDto.Response> update(@PathVariable Long id,
                                                          @RequestBody SubCategoryDto.Request request) {
        return ResponseEntity.ok(adminSubCategoryService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "하위 카테고리 삭제 ('기타'·사용중 거부)")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        adminSubCategoryService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
