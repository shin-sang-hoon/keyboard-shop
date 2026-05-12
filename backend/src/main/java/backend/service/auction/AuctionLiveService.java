package backend.service.auction;

import backend.entity.Auction;
import backend.repository.AuctionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Optional;

/**
 * 경매 실시간 데이터 캐싱 service (Phase 7, 5/12).
 *
 * 캐시 전략 — cache-aside:
 *  - 조회 (getCurrentPrice):
 *      1) Redis 에서 KEY=auction:current:{id} 조회
 *      2) hit → 그대로 반환
 *      3) miss → DB 조회 → 캐시에 set (TTL 1시간) → 반환
 *  - 입찰 성공 (updateCurrentPrice):
 *      1) DB 갱신은 호출자 (controller) 가 책임
 *      2) 본 메서드는 캐시만 갱신 (write-through 변형)
 *
 * 직렬화:
 *  - RedisTemplate<String, Object> 사용 — Spring config 의 기본 (RedisConfig 에 정의된 직렬화)
 *  - Integer 를 Object 로 캐스팅해서 저장, 조회 시 다시 Integer 캐스팅
 *  - 단순한 정수만 다루므로 별도 직렬화 설정 불필요
 *
 * TTL 선택 — 1시간:
 *  - 경매는 보통 짧으면 24h, 길면 7d. 1시간 TTL 은 짧지만 의도적.
 *  - 입찰 발생 시마다 갱신되므로 TTL 만료보다 갱신이 빈번한 경우가 많음
 *  - 1시간 동안 입찰 없는 인기 없는 경매는 DB 한 번 더 hit — 부담 적음
 *
 * 면접 자산:
 *  - cache-aside vs write-through vs write-behind 트레이드오프
 *  - 입찰 (write) 빈도보다 조회 (read) 가 100배 많은 read-heavy 패턴 가정
 *  - TTL 로 stale 데이터 허용 범위 명시
 *  - RedisTemplate 직접 사용 vs @Cacheable 추상화 — write 시점 명시적 제어 우선
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuctionLiveService {

    private static final String KEY_PREFIX = "auction:current:";
    private static final Duration TTL = Duration.ofHours(1);

    private final RedisTemplate<String, Object> redisTemplate;
    private final AuctionRepository auctionRepository;

    /**
     * 현재가 조회. cache-aside.
     *
     * @return Optional.empty() 면 경매 자체가 없음. 그 외엔 현재가 (캐시 또는 DB).
     */
    public Optional<Integer> getCurrentPrice(Long auctionId) {
        String key = KEY_PREFIX + auctionId;

        // 1. 캐시 조회
        Object cached = redisTemplate.opsForValue().get(key);
        if (cached != null) {
            Integer price = toInt(cached);
            if (price != null) {
                log.debug("Cache hit: auction={}, price={}", auctionId, price);
                return Optional.of(price);
            }
        }

        // 2. miss → DB 조회
        Optional<Auction> auctionOpt = auctionRepository.findById(auctionId);
        if (auctionOpt.isEmpty()) {
            return Optional.empty();
        }
        int price = auctionOpt.get().getCurrentPrice();

        // 3. 캐시 갱신
        redisTemplate.opsForValue().set(key, price, TTL);
        log.debug("Cache miss → DB hit, set: auction={}, price={}", auctionId, price);
        return Optional.of(price);
    }

    /**
     * 캐시 갱신 — 입찰 성공 후 호출.
     * DB 갱신은 호출자가 트랜잭션 안에서 책임.
     */
    public void updateCurrentPrice(Long auctionId, int newPrice) {
        String key = KEY_PREFIX + auctionId;
        redisTemplate.opsForValue().set(key, newPrice, TTL);
        log.debug("Cache updated: auction={}, price={}", auctionId, newPrice);
    }

    /**
     * 캐시 무효화 — 경매 종료/취소/관리자 수정 등 갱신 신뢰 어려운 경우.
     */
    public void evict(Long auctionId) {
        String key = KEY_PREFIX + auctionId;
        redisTemplate.delete(key);
        log.debug("Cache evicted: auction={}", auctionId);
    }

    /**
     * Redis 직렬화 결과는 Object — Integer 일 수도 있고 (Integer 직접 저장),
     * Number 의 다른 구현체 (Long 등) 일 수도 있어서 안전 캐스팅.
     */
    private Integer toInt(Object value) {
        if (value instanceof Integer i) return i;
        if (value instanceof Number n) return n.intValue();
        if (value instanceof String s) {
            try { return Integer.parseInt(s); } catch (NumberFormatException ignored) {}
        }
        log.warn("Unexpected cache value type: {}", value.getClass().getName());
        return null;
    }
}
