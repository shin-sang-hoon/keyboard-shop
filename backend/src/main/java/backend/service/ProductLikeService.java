package backend.service;

import backend.dto.ProductLikeDto;
import backend.entity.ProductLike;
import backend.entity.User;
import backend.exception.BusinessException;
import backend.repository.ProductLikeRepository;
import backend.repository.ProductRepository;
import backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 좋아요 토글 서비스 (B4).
 *
 * 면접 자산 — 낙관적 동시성 (Optimistic Concurrency):
 *   동일 사용자가 짧은 시간에 좋아요 버튼을 빠르게 두 번 클릭하면 두 요청이
 *   동시 처리되며 race condition 발생 가능. 두 요청 모두 existsBy... 가 false
 *   를 반환하면 둘 다 INSERT 시도 → 한쪽이 UNIQUE 제약 위반.
 *
 * 방어 전략 — 2중 방어선:
 *   1차) DB UNIQUE(user_id, product_id) 제약  ← 최후 보루, 절대 안전
 *   2차) Service 의 existsBy... 사전 체크    ← 일반 경로, 빠름
 *
 * 비관적 락(SELECT FOR UPDATE) 대신 UNIQUE 를 쓰는 이유:
 *   - 좋아요는 row 단위 conflict 만 방어하면 충분 (테이블/페이지 락 불필요)
 *   - 락은 throughput 저하를 일으키지만 UNIQUE 위반은 단순 예외만 발생
 *   - "happy path 는 빠르게, edge case 는 catch 로 방어" 패턴
 *
 * Redis 분산 락 대신 UNIQUE 를 쓰는 이유:
 *   - 단일 DB 인스턴스 환경에서는 DB UNIQUE 가 가장 가볍고 단순
 *   - 분산 환경 확장 시에도 DB UNIQUE 는 그대로 유효
 *
 * 토글 시맨틱:
 *   - 좋아요 ON  → INSERT (UNIQUE 위반 catch → 이미 ON 으로 간주)
 *   - 좋아요 OFF → DELETE
 *   - 응답에 토글 후 상태 + 최신 카운트를 함께 반환 (클라이언트 즉시 반영)
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProductLikeService {

    private final ProductLikeRepository productLikeRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;

    // ─────────────────────────────────────────────────────
    // 조회 (public 가능)
    // ─────────────────────────────────────────────────────

    /**
     * 상품의 좋아요 카운트 — 비로그인 사용자도 조회 가능.
     * 향후 Redis @Cacheable 캐싱 후보 (조회 빈도 높음, 정확도 요구 낮음).
     */
    public ProductLikeDto.CountResponse getCount(Long productId) {
        if (!productRepository.existsById(productId)) {
            throw BusinessException.notFound("상품을 찾을 수 없습니다: " + productId);
        }
        long count = productLikeRepository.countByProductId(productId);
        return ProductLikeDto.CountResponse.builder()
                .productId(productId)
                .count(count)
                .build();
    }

    // ─────────────────────────────────────────────────────
    // 토글 (인증 필요)
    // ─────────────────────────────────────────────────────

    /**
     * 좋아요 토글 — 누르면 ON, 다시 누르면 OFF.
     *
     * 동작 시퀀스:
     *   1) 상품 존재 검증 (404)
     *   2) 현재 사용자 조회
     *   3) 기존 좋아요 조회
     *      - 있음 → DELETE → liked=false
     *      - 없음 → INSERT → liked=true (UNIQUE 위반 시 race 로 간주, ON 처리)
     *   4) 최신 카운트 재조회 (응답)
     */
    @Transactional
    public ProductLikeDto.ToggleResponse toggle(String currentUserEmail, Long productId) {
        // 1) 상품 존재 검증
        if (!productRepository.existsById(productId)) {
            throw BusinessException.notFound("상품을 찾을 수 없습니다: " + productId);
        }

        // 2) 사용자 조회
        User currentUser = findUserByEmail(currentUserEmail);

        // 3) 토글
        boolean liked = doToggle(currentUser.getId(), productId);

        // 4) 카운트 재조회 (토글 직후 최신값)
        long count = productLikeRepository.countByProductId(productId);

        return ProductLikeDto.ToggleResponse.builder()
                .liked(liked)
                .count(count)
                .build();
    }

    /**
     * 실제 토글 로직 — exists 체크 + 분기 + UNIQUE race catch.
     *
     * 정상 경로:
     *   - exists = true  → delete → return false
     *   - exists = false → insert → return true
     *
     * Race 경로 (동시 클릭):
     *   - T1, T2 둘 다 exists = false 로 읽음
     *   - T1 INSERT 성공
     *   - T2 INSERT 시도 → UNIQUE 위반 → DataIntegrityViolationException
     *   - catch 후 "이미 ON 상태" 로 간주하고 return true
     *     (사용자 의도: 좋아요를 누름 → 결과: ON. 일관됨.)
     */
    private boolean doToggle(Long userId, Long productId) {
        boolean exists = productLikeRepository.existsByUserIdAndProductId(userId, productId);

        if (exists) {
            // OFF: 기존 row 삭제
            productLikeRepository.deleteByUserIdAndProductId(userId, productId);
            return false;
        }

        // ON: 새 row 삽입 (race 시 UNIQUE 위반 가능)
        try {
            ProductLike like = ProductLike.builder()
                    .user(userRepository.getReferenceById(userId))
                    .product(productRepository.getReferenceById(productId))
                    .build();
            productLikeRepository.save(like);
            return true;
        } catch (DataIntegrityViolationException e) {
            // Race condition — 다른 트랜잭션이 먼저 INSERT 함.
            // 사용자 의도(좋아요 ON)와 결과(ON)가 일치하므로 정상 응답.
            log.warn("ProductLike race detected — userId={}, productId={}, treated as ON",
                    userId, productId);
            return true;
        }
    }

    // ─────────────────────────────────────────────────────
    // helper
    // ─────────────────────────────────────────────────────

    private User findUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> BusinessException.notFound("사용자를 찾을 수 없습니다: " + email));
    }
}
