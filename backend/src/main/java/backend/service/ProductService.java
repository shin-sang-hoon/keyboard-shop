package backend.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import backend.dto.ProductDto;
import backend.dto.PagedResponse;
import backend.entity.Brand;
import backend.entity.Category;
import backend.entity.Product;
import backend.entity.Product.ProductType;
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
     * 상품 목록 조회 - 페이지네이션 + 검색 + productType 필터
     *
     * 캐시 키: search + productType + page + size 조합
     *  - 4가지 분기 (search/productType 각각 null 여부) 별로 분리 캐싱
     *  - 메인 화면 첫 페이지 (search=null, productType=null) 가 가장 많이 hit
     */
    @Cacheable(
            value = "products_v2",
            key = "(#search == null ? 'all' : #search.trim().toLowerCase()) + '-' " +
                    "+ (#productType == null ? 'any' : #productType.name()) + '-' " +
                    "+ #pageable.pageNumber + '-' + #pageable.pageSize"
    )
    public PagedResponse<ProductDto.Response> getAllProducts(String search, ProductType productType, Pageable pageable) {
        Page<Product> page;
        boolean hasSearch = search != null && !search.isBlank();
        String trimmed = hasSearch ? search.trim() : null;

        if (hasSearch && productType != null) {
            page = productRepository.findByNameContainingIgnoreCaseAndProductType(trimmed, productType, pageable);
        } else if (hasSearch) {
            page = productRepository.findByNameContainingIgnoreCase(trimmed, pageable);
        } else if (productType != null) {
            page = productRepository.findByProductType(productType, pageable);
        } else {
            page = productRepository.findAll(pageable);
        }
        return PagedResponse.from(page.map(this::toResponse));
    }

    public ProductDto.Response getProduct(Long id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("상품을 찾을 수 없습니다."));
        return toResponse(product);
    }

    @Transactional
    @CacheEvict(value = "products_v2", allEntries = true)
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
    @CacheEvict(value = "products_v2", allEntries = true)
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
    @CacheEvict(value = "products_v2", allEntries = true)
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