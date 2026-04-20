package backend.controller;

import backend.dto.CategoryDto;
import backend.service.AdminCategoryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/categories")
@RequiredArgsConstructor
@Tag(name = "Admin Category", description = "관리자 카테고리 관리 API")
public class AdminCategoryController {

    private final AdminCategoryService adminCategoryService;

    @GetMapping
    @Operation(summary = "카테고리 전체 조회 (트리 구조)")
    public ResponseEntity<List<CategoryDto.Response>> getAllCategories() {
        return ResponseEntity.ok(adminCategoryService.getAllCategories());
    }

    @PostMapping
    @Operation(summary = "카테고리 생성")
    public ResponseEntity<CategoryDto.Response> createCategory(@RequestBody CategoryDto.Request request) {
        return ResponseEntity.ok(adminCategoryService.createCategory(request));
    }

    @PutMapping("/{id}")
    @Operation(summary = "카테고리 수정")
    public ResponseEntity<CategoryDto.Response> updateCategory(@PathVariable Long id,
                                                               @RequestBody CategoryDto.Request request) {
        return ResponseEntity.ok(adminCategoryService.updateCategory(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "카테고리 삭제")
    public ResponseEntity<Void> deleteCategory(@PathVariable Long id) {
        adminCategoryService.deleteCategory(id);
        return ResponseEntity.noContent().build();
    }
}