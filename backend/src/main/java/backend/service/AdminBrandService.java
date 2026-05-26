package backend.service;

import backend.dto.BrandDto;
import backend.entity.Brand;
import backend.exception.BusinessException;
import backend.repository.BrandRepository;
import backend.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

/**
 * 관리자 브랜드 관리 서비스 (Phase 2 생성, 7-G R9 보강).
 *
 * 7-G R9 변경점:
 *  - deleteBrand 삭제 가드 추가 — 상품이 사용 중인 브랜드는 삭제 거부(409).
 *    가드 없이 deleteById 하면 products.brand_id FK 제약 위반으로 DB 레벨 500 이 남.
 *  - RuntimeException → BusinessException — 프로젝트 표준 예외로 통일 (404/409 정확히).
 *  - 이름 유니크 사전 검증 — Brand.name UNIQUE 제약을 깔끔한 409 로 변환
 *    (DB 제약은 race condition 최후 안전망).
 */
@Service
@RequiredArgsConstructor
public class AdminBrandService {

    private final BrandRepository brandRepository;
    private final ProductRepository productRepository;

    public List<BrandDto.Response> getAllBrands() {
        return brandRepository.findAll().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public BrandDto.Response getBrand(Long id) {
        return toResponse(findBrand(id));
    }

    @Transactional
    public BrandDto.Response createBrand(BrandDto.Request request) {
        validateName(request.getName());
        String name = request.getName().trim();

        // 이름 유니크 사전 검증 (Brand.name UNIQUE — DB 제약이 최후 안전망)
        brandRepository.findByName(name).ifPresent(b -> {
            throw BusinessException.conflict("이미 존재하는 브랜드명입니다: " + name);
        });

        Brand brand = Brand.builder()
                .name(name)
                .logoUrl(request.getLogoUrl())
                .description(request.getDescription())
                .build();
        return toResponse(brandRepository.save(brand));
    }

    @Transactional
    public BrandDto.Response updateBrand(Long id, BrandDto.Request request) {
        validateName(request.getName());
        Brand brand = findBrand(id);
        String name = request.getName().trim();

        // 다른 브랜드가 같은 이름을 쓰고 있으면 거부 (본인은 허용)
        brandRepository.findByName(name)
                .filter(other -> !other.getId().equals(id))
                .ifPresent(other -> {
                    throw BusinessException.conflict("이미 존재하는 브랜드명입니다: " + name);
                });

        brand.setName(name);
        brand.setLogoUrl(request.getLogoUrl());
        brand.setDescription(request.getDescription());
        return toResponse(brandRepository.save(brand));
    }

    @Transactional
    public void deleteBrand(Long id) {
        Brand brand = findBrand(id);

        // 삭제 가드 — 이 브랜드를 사용 중인 상품이 있으면 거부
        long inUse = productRepository.countByBrandId(id);
        if (inUse > 0) {
            throw BusinessException.conflict(
                    "이 브랜드를 사용 중인 상품이 " + inUse + "개 있어 삭제할 수 없습니다.");
        }

        brandRepository.delete(brand);
    }

    // ─────────────────────────────────────────────────────
    // helper
    // ─────────────────────────────────────────────────────

    private Brand findBrand(Long id) {
        return brandRepository.findById(id)
                .orElseThrow(() -> BusinessException.notFound("브랜드를 찾을 수 없습니다: " + id));
    }

    private void validateName(String name) {
        if (name == null || name.isBlank()) {
            throw BusinessException.badRequest("브랜드명은 필수입니다.");
        }
    }

    private BrandDto.Response toResponse(Brand brand) {
        return BrandDto.Response.builder()
                .id(brand.getId())
                .name(brand.getName())
                .logoUrl(brand.getLogoUrl())
                .description(brand.getDescription())
                .build();
    }
}
