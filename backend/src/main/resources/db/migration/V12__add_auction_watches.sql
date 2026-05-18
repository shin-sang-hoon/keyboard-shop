USE keyboard_db;

-- ============================================
-- V12: auction_watches table (N:M)
-- User-Auction watch relationship for watch_count toggle
-- Pattern: same as wishlists (Asset Box #4: ProductLike + Wishlist 분리)
-- ASCII-only comments + idempotent (V4/V10/V11 pattern)
-- ============================================

-- 1) Create auction_watches table (idempotent: IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS auction_watches (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  auction_id BIGINT NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT uk_auction_watch_user_auction UNIQUE KEY (user_id, auction_id),
  CONSTRAINT fk_auction_watch_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_auction_watch_auction FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE CASCADE,
  INDEX idx_auction_watch_auction (auction_id),
  INDEX idx_auction_watch_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) Verify
SHOW CREATE TABLE auction_watches\G

-- 3) Initial row inspection (should be empty)
SELECT COUNT(*) AS watch_count_total FROM auction_watches;
