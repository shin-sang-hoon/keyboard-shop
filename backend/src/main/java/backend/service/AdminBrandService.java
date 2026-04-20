package backend.service;

import backend.dto.BrandDto;
import backend.entity.Brand;
import backend.repository.BrandRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminBrandService {

    private final BrandRepository brandRepository;

    public List<BrandDto.Response> getAllBrands() {
        return brandRepository.findAll().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public BrandDto.Response getBrand(Long id) {
        Brand brand = brandRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Brand not found"));
        return toResponse(brand);
    }

    @Transactional
    public BrandDto.Response createBrand(BrandDto.Request request) {
        Brand brand = Brand.builder()
                .name(request.getName())
                .logoUrl(request.getLogoUrl())
                .description(request.getDescription())
                .build();
        return toResponse(brandRepository.save(brand));
    }

    @Transactional
    public BrandDto.Response updateBrand(Long id, BrandDto.Request request) {
        Brand brand = brandRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Brand not found"));
        brand.setName(request.getName());
        brand.setLogoUrl(request.getLogoUrl());
        brand.setDescription(request.getDescription());
        return toResponse(brandRepository.save(brand));
    }

    @Transactional
    public void deleteBrand(Long id) {
        brandRepository.deleteById(id);
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