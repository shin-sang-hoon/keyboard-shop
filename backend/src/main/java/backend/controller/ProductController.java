package backend.controller;

import backend.dto.ProductDto;
import backend.service.ProductService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
@Tag(name = "상품 API", description = "상품 CRUD")
public class ProductController {

    private final ProductService productService;

    /**
     * 상품 목록 조회 — 페이지네이션 + 검색
     *
     * 쿼리 파라미터:
     *  - page (default: 0)         페이지 번호 (0부터 시작)
     *  - size (default: 20)        페이지 크기 (max 100 권장)
     *  - search (optional)         상품명 부분 일치, 대소문자 무시
     *  - sort (default: createdAt,desc)  정렬 기준 — 추후 price/name 등 확장 가능
     *
     * 예시: GET /api/products?page=0&size=20&search=k2
     */
    @GetMapping
    @Operation(summary = "상품 목록 조회 (페이지네이션 + 검색)")
    public ResponseEntity<Page<ProductDto.Response>> getAllProducts(
            @RequestParam(required = false) String search,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(productService.getAllProducts(search, pageable));
    }

    @GetMapping("/{id}")
    @Operation(summary = "상품 단건 조회")
    public ResponseEntity<ProductDto.Response> getProduct(@PathVariable Long id) {
        return ResponseEntity.ok(productService.getProduct(id));
    }

    @PostMapping
    @Operation(summary = "상품 등록")
    public ResponseEntity<ProductDto.Response> createProduct(@RequestBody ProductDto.Request request) {
        return ResponseEntity.ok(productService.createProduct(request));
    }

    @PutMapping("/{id}")
    @Operation(summary = "상품 수정")
    public ResponseEntity<ProductDto.Response> updateProduct(
            @PathVariable Long id,
            @RequestBody ProductDto.Request request) {
        return ResponseEntity.ok(productService.updateProduct(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "상품 삭제")
    public ResponseEntity<Void> deleteProduct(@PathVariable Long id) {
        productService.deleteProduct(id);
        return ResponseEntity.noContent().build();
    }
}