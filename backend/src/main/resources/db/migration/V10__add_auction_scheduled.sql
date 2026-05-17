USE keyboard_db;

-- ============================================
-- V10: 경매 SCHEDULED 상태 + 시작 시각 컬럼
-- 한정판 예약 등록 (관리자가 미래 시작 시각 설정)
-- V4 idempotent 패턴 (information_schema PREPARE) 재활용
-- ============================================

-- 1) start_at 컬럼 추가 (NULL = 등록 즉시 ACTIVE, NOT NULL = SCHEDULED)
SET @dbname = DATABASE();
SET @tablename = 'auctions';
SET @columnname = 'start_at';
SET @preparedStatement = (SELECT IF(
  EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname),
  'SELECT "start_at already exists" AS msg',
  'ALTER TABLE auctions ADD COLUMN start_at DATETIME(6) NULL COMMENT "예약 시작 시각 (UTC). NULL=즉시 ACTIVE."'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) status ENUM 에 SCHEDULED 추가
-- MySQL native ENUM 이라 ALTER COLUMN 으로 enum 값 추가
-- 기존 값 보존: ACTIVE, ENDED, CANCELLED, + SCHEDULED
ALTER TABLE auctions
  MODIFY COLUMN status ENUM('ACTIVE','ENDED','CANCELLED','SCHEDULED') NOT NULL;

-- 3) 검증
SHOW COLUMNS FROM auctions LIKE 'start_at';
SHOW COLUMNS FROM auctions LIKE 'status';

-- 4) 기존 row 정합성 (V9 와 동일)
SELECT id, product_id, status, current_price,
       is_flash_deal, start_price_percent, duration_hours, start_at
FROM auctions ORDER BY id;
