package backend.service;

import backend.dto.AdminStatsDto;
import backend.entity.Product.ProductStatus;
import backend.repository.OrderRepository;
import backend.repository.ProductRepository;
import backend.repository.ReviewRepository;
import backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 관리자 대시보드 통계 서비스 (Phase 7-G 라운드 3).
 *
 * 4개 COUNT 집계를 한 번에 수행해서 AdminStatsDto 로 반환.
 *
 * 설계 노트:
 *   - readOnly 트랜잭션: COUNT 만 수행, 쓰기 없음 → 성능 힌트.
 *   - countByStatus: Spring Data JPA 가 메서드명으로 자동 구현 (쿼리 파생).
 *   - count(): JpaRepository 기본 제공 (전체 row COUNT).
 */
@Service
@RequiredArgsConstructor
public class AdminStatsService {

    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final ReviewRepository reviewRepository;
    private final OrderRepository orderRepository;

    @Transactional(readOnly = true)
    public AdminStatsDto getStats() {
        long activeProductCount = productRepository.countByStatus(ProductStatus.ACTIVE);
        long totalUserCount = userRepository.count();
        long reviewCount = reviewRepository.count();
        long orderCount = orderRepository.count();

        return new AdminStatsDto(
                activeProductCount,
                totalUserCount,
                reviewCount,
                orderCount
        );
    }
}
