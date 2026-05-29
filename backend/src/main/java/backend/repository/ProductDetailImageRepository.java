package backend.repository;

import backend.entity.ProductDetailImage;
import backend.entity.ProductDetailImage.Status;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface ProductDetailImageRepository extends JpaRepository<ProductDetailImage, Long> {

    /** 특정 상품의 모든 추적 이미지 — reconcile / 상품 삭제 시 파일 정리용. */
    List<ProductDetailImage> findByProductId(Long productId);

    /**
     * @Scheduled GC 대상 — 미확정(PENDING) + 생성 cutoff 이전.
     * 관리자가 이미지만 올리고 저장 없이 이탈한 "버려진 업로드" 회수.
     */
    List<ProductDetailImage> findByStatusAndCreatedAtBefore(Status status, LocalDateTime cutoff);
}
