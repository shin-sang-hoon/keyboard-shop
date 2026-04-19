package backend.controller;

import backend.dto.ProductDto;
import backend.service.ProductService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
@Tag(name = "상품 API", description = "상품 CRUD")
public class ProductController {

    private final ProductService productService;

    @GetMapping
    @Operation(summary = "상품 목록 조회")
    public ResponseEntity<List<ProductDto.Response>> getAllProducts() {
        return ResponseEntity.ok(productService.getAllProducts());
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