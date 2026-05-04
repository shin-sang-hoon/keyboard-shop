package backend.dto;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 좋아요 토글 응답 DTO (B4).
 *
 * 응답 포맷 결정 (4/5/2026):
 *   - {liked: boolean, count: long} 형식
 *   - 클라이언트가 카운트를 즉시 반영 가능 (낙관적 업데이트 + 서버 동기화)
 *   - 별도 GET count 호출 없이 토글 1회로 UI 갱신 완료
 *
 * 페어 관계: WishlistDto.ToggleResponse 와 대비
 *   - ProductLike 는 public count (♥ 카운트 표시)
 *   - Wishlist 는 private intent (⭐ 본인만 보는 찜)
 *   → ProductLike 만 count 포함, Wishlist 는 단순 wishlisted boolean
 */
public class ProductLikeDto {

    @Getter
    @NoArgsConstructor(access = AccessLevel.PRIVATE)
    @AllArgsConstructor
    @Builder
    public static class ToggleResponse {
        private boolean liked;   // 토글 후 상태 (true = 좋아요 ON, false = 좋아요 OFF)
        private long count;      // 해당 상품의 총 좋아요 수
    }

    @Getter
    @NoArgsConstructor(access = AccessLevel.PRIVATE)
    @AllArgsConstructor
    @Builder
    public static class CountResponse {
        private Long productId;
        private long count;
    }
}
