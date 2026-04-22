package backend.service;

import backend.dto.InternalProductDtos;
import backend.entity.Brand;
import backend.entity.Product;
import backend.repository.BrandRepository;
import backend.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class InternalCrawlerService {

    private final ProductRepository productRepository;
    private final BrandRepository brandRepository;

    @Value("${internal.api-key}")
    private String internalApiKey;

    @Transactional
    public InternalProductDtos.UpsertResponse upsert(String key, InternalProductDtos.UpsertRequest request) {
        if (!internalApiKey.equals(key)) {
            throw new RuntimeException("Invalid internal API key");
        }

        Optional<Product> existing = productRepository.findBySourceId(request.getSourceId());

        Brand brand = brandRepository.findByName(request.getBrandName())
                .orElseGet(() -> brandRepository.save(
                        Brand.builder().name(request.getBrandName()).build()
                ));

        if (existing.isPresent()) {
            Product product = existing.get();
            product.setName(request.getName());
            product.setImageUrl(request.getImageUrl());
            product.setPrice(request.getPrice());
            product.setLayout(request.getLayout());
            product.setSwitchType(request.getSwitchType());
            product.setMountingType(request.getMountingType());
            product.setConnectionType(request.getConnectionType());
            product.setBrand(brand);
            return InternalProductDtos.UpsertResponse.builder()
                    .productId(product.getId())
                    .status("updated")
                    .build();
        } else {
            Product product = Product.builder()
                    .sourceId(request.getSourceId())
                    .name(request.getName())
                    .imageUrl(request.getImageUrl())
                    .price(request.getPrice())
                    .layout(request.getLayout())
                    .switchType(request.getSwitchType())
                    .mountingType(request.getMountingType())
                    .connectionType(request.getConnectionType())
                    .brand(brand)
                    .build();
            Product saved = productRepository.save(product);
            return InternalProductDtos.UpsertResponse.builder()
                    .productId(saved.getId())
                    .status("created")
                    .build();
        }
    }
}