USE keyboard_db;

-- ============================================
-- V11: Auction view_count + watch_count columns
-- Social proof signals for AuctionDetailPage (Phase 7 Round 4)
-- Uses V4/V10 idempotent pattern (information_schema PREPARE)
-- ASCII-only comments (Windows mysqld euckr_korean_ci safe)
-- ============================================

-- 1) view_count column (incremented on auction detail page load)
SET @dbname = DATABASE();
SET @tablename = 'auctions';
SET @columnname = 'view_count';
SET @preparedStatement = (SELECT IF(
  EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname),
  'SELECT "view_count already exists" AS msg',
  'ALTER TABLE auctions ADD COLUMN view_count BIGINT NOT NULL DEFAULT 0'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) watch_count column (incremented on user watchlist add)
SET @columnname = 'watch_count';
SET @preparedStatement = (SELECT IF(
  EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname),
  'SELECT "watch_count already exists" AS msg',
  'ALTER TABLE auctions ADD COLUMN watch_count BIGINT NOT NULL DEFAULT 0'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3) Verify
SHOW COLUMNS FROM auctions LIKE 'view_count';
SHOW COLUMNS FROM auctions LIKE 'watch_count';

-- 4) Sample inspection
SELECT id, status, current_price, bid_count, view_count, watch_count
FROM auctions ORDER BY id;
