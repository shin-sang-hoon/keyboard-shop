package backend.repository;

import backend.entity.ProductImage;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ProductImageRepository extends JpaRepository<ProductImage, Long> {

    // 한 상품의 이미지를 displayOrder 순으로 조회 (갤러리 렌더링용)
    List<ProductImage> findByProductIdOrderByDisplayOrderAsc(Long productId);

    // 특정 타입만 조회 (예: 썸네일만)
    List<ProductImage> findByProductIdAndImageType(Long productId, ProductImage.ImageType imageType);

    // 한 상품의 모든 이미지 삭제 (re-crawl 시 cascade 미사용 케이스 대비)
    void deleteByProductId(Long productId);

    // 5-H B1: 목록 일괄 fetch (N+1 회피, IN 절 1쿼리)
    // product 별 displayOrder 정렬 → Service 에서 Map<productId, List> 로 group
    List<ProductImage> findByProductIdInOrderByProductIdAscDisplayOrderAsc(List<Long> productIds);
}
