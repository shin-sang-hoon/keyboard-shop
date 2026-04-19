package backend.controller;

import backend.dto.CategoryDto;
import backend.service.CategoryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/categories")
@RequiredArgsConstructor
@Tag(name = "카테고리 API", description = "카테고리 조회 및 검색")
public class CategoryController {

    private final CategoryService categoryService;

    @GetMapping
    @Operation(summary = "카테고리 전체 조회 (2depth 트리)")
    public ResponseEntity<List<CategoryDto.Response>> getAllCategories() {
        return ResponseEntity.ok(categoryService.getAllCategories());
    }

    @GetMapping("/search")
    @Operation(summary = "카테고리 이름 검색")
    public ResponseEntity<List<CategoryDto.Response>> searchCategories(
            @RequestParam String keyword) {
        return ResponseEntity.ok(categoryService.searchByName(keyword));
    }
}