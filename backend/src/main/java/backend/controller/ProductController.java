package backend.controller;

import backend.dto.ProductDto;
import backend.entity.Product.ProductType;
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
@Tag(name = "Product API", description = "Product CRUD with pagination, search, and type filter")
public class ProductController {

    private final ProductService productService;

    /**
     * 상품 목록 조회 - 페이지네이션 + 검색 + productType 필터
     *
     * Query parameters:
     *  - page (default: 0)            페이지 번호
     *  - size (default: 20)           페이지 크기
     *  - search (optional)            상품명 부분 일치 검색 (대소문자 무시)
     *  - productType (optional)       enum: KEYBOARD/MOUSE/SWITCH_PART/ACCESSORY/NOISE/UNCLASSIFIED
     *  - sort (default: createdAt,desc)
     *
     * 예시:
     *  GET /api/products
     *  GET /api/products?search=K10
     *  GET /api/products?productType=KEYBOARD&page=0&size=20
     *  GET /api/products?search=Keychron&productType=MOUSE
     */
    @GetMapping
    @Operation(summary = "상품 목록 조회 (페이지네이션 + 검색 + 타입 필터)")
    public ResponseEntity<Page<ProductDto.Response>> getAllProducts(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) ProductType productType,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(productService.getAllProducts(search, productType, pageable));
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