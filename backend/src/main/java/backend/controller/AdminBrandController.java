package backend.controller;

import backend.dto.BrandDto;
import backend.service.AdminBrandService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/brands")
@RequiredArgsConstructor
@Tag(name = "Admin Brand", description = "관리자 브랜드 관리 API")
public class AdminBrandController {

    private final AdminBrandService adminBrandService;

    @GetMapping
    @Operation(summary = "브랜드 전체 조회")
    public ResponseEntity<List<BrandDto.Response>> getAllBrands() {
        return ResponseEntity.ok(adminBrandService.getAllBrands());
    }

    @GetMapping("/{id}")
    @Operation(summary = "브랜드 단건 조회")
    public ResponseEntity<BrandDto.Response> getBrand(@PathVariable Long id) {
        return ResponseEntity.ok(adminBrandService.getBrand(id));
    }

    @PostMapping
    @Operation(summary = "브랜드 생성")
    public ResponseEntity<BrandDto.Response> createBrand(@RequestBody BrandDto.Request request) {
        return ResponseEntity.ok(adminBrandService.createBrand(request));
    }

    @PutMapping("/{id}")
    @Operation(summary = "브랜드 수정")
    public ResponseEntity<BrandDto.Response> updateBrand(@PathVariable Long id,
                                                         @RequestBody BrandDto.Request request) {
        return ResponseEntity.ok(adminBrandService.updateBrand(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "브랜드 삭제")
    public ResponseEntity<Void> deleteBrand(@PathVariable Long id) {
        adminBrandService.deleteBrand(id);
        return ResponseEntity.noContent().build();
    }
}