package backend.scheduler;

import backend.service.ProductDetailImageService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 상세정보 인라인 이미지 GC 스케줄러 (P3 · 5/29).
 *
 * 관리자가 이미지만 올리고 저장 없이 이탈하면 PENDING 추적 row + 디스크 파일이 고아로 남는다.
 * (reconcile 은 '저장' 시점에만 도므로 저장 안 한 업로드는 못 잡음.)
 * 매시 정각, 24h+ 경과한 PENDING 을 회수한다. AuctionScheduler @Scheduled 패턴 재사용.
 */
@Component
@RequiredArgsConstructor
public class ProductDetailImageScheduler {

    private static final Logger log = LoggerFactory.getLogger(ProductDetailImageScheduler.class);
    private static final int ABANDON_THRESHOLD_HOURS = 24;

    private final ProductDetailImageService productDetailImageService;

    @Scheduled(cron = "0 0 * * * *") // 매시 정각
    public void cleanupAbandonedUploads() {
        int removed = productDetailImageService.cleanupAbandonedUploads(ABANDON_THRESHOLD_HOURS);
        if (removed > 0) {
            log.info("[ProductDetailImage GC] 버려진 업로드 {}건 정리 완료", removed);
        }
    }
}
