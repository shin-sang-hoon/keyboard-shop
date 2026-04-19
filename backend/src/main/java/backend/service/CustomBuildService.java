package backend.service;

import backend.dto.CustomBuildDto;
import backend.entity.CustomBuild;
import backend.entity.Product;
import backend.entity.User;
import backend.repository.CustomBuildRepository;
import backend.repository.ProductRepository;
import backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CustomBuildService {

    private final CustomBuildRepository customBuildRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;

    @Transactional
    public CustomBuildDto.Response saveBuild(String email, CustomBuildDto.Request request) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));
        Product product = request.getProductId() != null ?
                productRepository.findById(request.getProductId()).orElse(null) : null;

        CustomBuild build = CustomBuild.builder()
                .user(user)
                .product(product)
                .buildConfig(request.getBuildConfig())
                .build();

        return toResponse(customBuildRepository.save(build));
    }

    public List<CustomBuildDto.Response> getMyBuilds(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));
        return customBuildRepository.findByUserOrderByCreatedAtDesc(user)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    public CustomBuildDto.Response getBuild(Long id) {
        CustomBuild build = customBuildRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("빌드를 찾을 수 없습니다."));
        return toResponse(build);
    }

    private CustomBuildDto.Response toResponse(CustomBuild build) {
        return CustomBuildDto.Response.builder()
                .id(build.getId())
                .productId(build.getProduct() != null ? build.getProduct().getId() : null)
                .productName(build.getProduct() != null ? build.getProduct().getName() : null)
                .buildConfig(build.getBuildConfig())
                .createdAt(build.getCreatedAt())
                .build();
    }
}