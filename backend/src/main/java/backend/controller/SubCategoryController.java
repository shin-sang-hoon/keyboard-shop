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
 * 공개 하위 카테고리 조회 API (P2, 2026-05-28).
 *
 * 사용자단 ProductList 측면 필터에서 사용 — 관리자 API(/api/admin/sub-categories)는
 * hasRole(ADMIN) 가드라 일반 사용자가 못 부르므로 공개 GET 엔드포인트를 분리한다.
 * 조회 로직은 AdminSubCategoryService 를 그대로 재사용 (읽기 전용이라 안전).
 *
 * /api/sub-categories 는 SecurityConfig 에서 permitAll 필요.
 */
@RestController
@RequestMapping("/api/sub-categories")
@RequiredArgsConstructor
@Tag(name = "SubCategory API", description = "공개 하위 카테고리 조회 (사용자단 필터용)")
public class SubCategoryController {

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
}
