package backend.service;

import backend.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Optional;

/**
 * 플래시 딜 임계값 동적 계산 서비스.
 *
 * 목적: KEYBOARD 상위 N% 가격을 운영 데이터 기반으로 자동 산출.
 * 상품 변동(추가/제거)에 자동 적응 + 매 요청 SQL 부담 회피.
 *
 * 캐시 전략 (cache-aside):
 *  - KEY: flashdeal:threshold:v1
 *  - VALUE: 임계값 (원)
 *  - TTL: 1h
 *  - evict 경로: (1) TTL 만료, (2) 관리자 수동 refresh, (3) 상품 ACTIVE 추가/제거 시
 *
 * 면접 자산 #23 후보:
 *  - 4/27 PageImpl stale (자산 #1) + 5/17 Redis 시드 evict 누락 (자산 #22) 의
 *    교훈을 선제 적용. 모든 write 경로에 evict 의무화.
 *  - 추가로 MySQL prepared statement OFFSET 제약 회피 (2단계 쿼리 분리).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FlashDealThresholdService {

    private static final String CACHE_KEY = "flashdeal:threshold:v1";
    private static final Duration CACHE_TTL = Duration.ofHours(1);

    private final ProductRepository productRepository;
    private final RedisTemplate<String, String> redisTemplate;

    @Value("${flashdeal.top-percent:5}")
    private int topPercent;

    public int getThreshold() {
        String cached = redisTemplate.opsForValue().get(CACHE_KEY);
        if (cached != null) {
            try {
                int value = Integer.parseInt(cached);
                log.debug("Flash deal threshold cache hit: {}", value);
                return value;
            } catch (NumberFormatException e) {
                log.warn("Invalid cached threshold value: {}", cached);
                redisTemplate.delete(CACHE_KEY);
            }
        }

        int threshold = computeThresholdFromDb();
        redisTemplate.opsForValue().set(CACHE_KEY, String.valueOf(threshold), CACHE_TTL);
        log.info("Flash deal threshold recomputed: top {}% = {}원 (cached 1h)", topPercent, threshold);
        return threshold;
    }

    public void evict() {
        redisTemplate.delete(CACHE_KEY);
        log.info("Flash deal threshold cache evicted");
    }

    public int refresh() {
        evict();
        return getThreshold();
    }

    public boolean isEligibleForFlashDeal(int price) {
        return price >= getThreshold();
    }

    private int computeThresholdFromDb() {
        // 1단계: KEYBOARD ACTIVE 총 개수
        long total = productRepository.countActiveKeyboards();
        if (total == 0) {
            log.warn("No active keyboards — fallback to 500,000원");
            return 500_000;
        }

        // 2단계: OFFSET 정수 계산 (MySQL prepared statement OFFSET 제약 회피)
        // 예: total=104, topPercent=5 → offset = FLOOR(104*5/100) = 5
        long offset = (total * topPercent) / 100;

        // 3단계: 해당 위치 가격 조회
        Optional<Integer> result = productRepository.findPriceAtOffset(offset);
        if (result.isEmpty() || result.get() == 0) {
            log.warn("Flash deal threshold computation returned empty (total={}, offset={}) — fallback to 500,000원",
                    total, offset);
            return 500_000;
        }

        log.debug("Threshold computed: total={}, topPercent={}%, offset={}, threshold={}",
                total, topPercent, offset, result.get());
        return result.get();
    }
}
