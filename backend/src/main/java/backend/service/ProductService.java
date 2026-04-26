package backend.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import backend.dto.ProductDto;
import backend.entity.Brand;
import backend.entity.Category;
import backend.entity.Product;
import backend.repository.BrandRepository;
import backend.repository.CategoryRepository;
import backend.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProductService {

    private final ProductRepository productRepository;
    private final BrandRepository brandRepository;
    private final CategoryRepository categoryRepository;

    /**
     * 상품 목록 조회 — 페이지네이션 + 검색
     *
     * 캐시 전략: (검색어 + 페이지번호 + 페이지크기) 조합을 키로 사용.
     *  - 메인 화면 첫 페이지 (search=null, page=0) 가 가장 많이 조회됨 → 캐시 효과 큼
     *  - 검색어가 다양해도 동일 검색어 내 같은 페이지는 캐시 적중
     *  - 검색어 trim/소문자 정규화는 호출 측이 아닌 여기서 한 번에 처리
     */
    @Cacheable(
            value = "products",
            key = "(#search == null ? 'all' : #search.trim().toLowerCase()) + '-' + #pageable.pageNumber + '-' + #pageable.pageSize"
    )
    public Page<ProductDto.Response> getAllProducts(String search, Pageable pageable) {
        Page<Product> page;
        if (search != null && !search.isBlank()) {
            page = productRepository.findByNameContainingIgnoreCase(search.trim(), pageable);
        } else {
            page = productRepository.findAll(pageable);
        }
        return page.map(this::toResponse);
    }

    public ProductDto.Response getProduct(Long id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("상품을 찾을 수 없습니다."));
        return toResponse(product);
    }

    @Transactional
    @CacheEvict(value = "products", allEntries = true)
    public ProductDto.Response createProduct(ProductDto.Request request) {
        Brand brand = request.getBrandId() != null ?
                brandRepository.findById(request.getBrandId()).orElse(null) : null;
        Category category = request.getCategoryId() != null ?
                categoryRepository.findById(request.getCategoryId()).orElse(null) : null;

        Product product = Product.builder()
                .name(request.getName())
                .brand(brand)
                .category(category)
                .price(request.getPrice())
                .stock(request.getStock())
                .imageUrl(request.getImageUrl())
                .layout(request.getLayout())
                .switchType(request.getSwitchType())
                .switchName(request.getSwitchName())
                .mountingType(request.getMountingType())
                .connectionType(request.getConnectionType())
                .gbStatus(request.getGbStatus())
                .sourceId(request.getSourceId())
                .status(request.getStatus() != null ? request.getStatus() : Product.ProductStatus.ACTIVE)
                .build();

        return toResponse(productRepository.save(product));
    }

    @Transactional
    @CacheEvict(value = "products", allEntries = true)
    public ProductDto.Response updateProduct(Long id, ProductDto.Request request) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("상품을 찾을 수 없습니다."));

        Brand brand = request.getBrandId() != null ?
                brandRepository.findById(request.getBrandId()).orElse(null) : null;
        Category category = request.getCategoryId() != null ?
                categoryRepository.findById(request.getCategoryId()).orElse(null) : null;

        product.setName(request.getName());
        product.setBrand(brand);
        product.setCategory(category);
        product.setPrice(request.getPrice());
        product.setStock(request.getStock());
        product.setImageUrl(request.getImageUrl());
        product.setLayout(request.getLayout());
        product.setSwitchType(request.getSwitchType());
        product.setSwitchName(request.getSwitchName());
        product.setMountingType(request.getMountingType());
        product.setConnectionType(request.getConnectionType());
        product.setGbStatus(request.getGbStatus());
        if (request.getStatus() != null) product.setStatus(request.getStatus());

        return toResponse(productRepository.save(product));
    }

    @Transactional
    @CacheEvict(value = "products", allEntries = true)
    public void deleteProduct(Long id) {
        productRepository.deleteById(id);
    }

    private ProductDto.Response toResponse(Product p) {
        return ProductDto.Response.builder()
                .id(p.getId())
                .name(p.getName())
                .brandName(p.getBrand() != null ? p.getBrand().getName() : null)
                .categoryName(p.getCategory() != null ? p.getCategory().getName() : null)
                .price(p.getPrice())
                .stock(p.getStock())
                .imageUrl(p.getImageUrl())
                .layout(p.getLayout())
                .switchType(p.getSwitchType())
                .switchName(p.getSwitchName())
                .mountingType(p.getMountingType())
                .connectionType(p.getConnectionType())
                .gbStatus(p.getGbStatus())
                .glbUrl(p.getGlbUrl())
                .sourceId(p.getSourceId())
                .status(p.getStatus())
                .createdAt(p.getCreatedAt())
                .build();
    }
}