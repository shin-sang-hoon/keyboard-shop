USE keyboard_db;

-- ============================================
-- V8: 플래시 딜 (한정판 콜라보 이벤트) 컬럼 추가
-- V4 idempotent 패턴 (information_schema PREPARE) 재활용
-- ============================================

-- 1) is_flash_deal 컬럼 추가
SET @dbname = DATABASE();
SET @tablename = 'auctions';
SET @columnname = 'is_flash_deal';
SET @preparedStatement = (SELECT IF(
  EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname),
  'SELECT "is_flash_deal already exists" AS msg',
  'ALTER TABLE auctions ADD COLUMN is_flash_deal BOOLEAN NOT NULL DEFAULT FALSE'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) start_price_percent 컬럼 추가 (30~70, 플래시 딜만)
SET @columnname = 'start_price_percent';
SET @preparedStatement = (SELECT IF(
  EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname),
  'SELECT "start_price_percent already exists" AS msg',
  'ALTER TABLE auctions ADD COLUMN start_price_percent INT NULL'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3) duration_hours 컬럼 추가 (1~168, 기본 24)
SET @columnname = 'duration_hours';
SET @preparedStatement = (SELECT IF(
  EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname),
  'SELECT "duration_hours already exists" AS msg',
  'ALTER TABLE auctions ADD COLUMN duration_hours INT NOT NULL DEFAULT 24'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4) 검증
SHOW COLUMNS FROM auctions LIKE 'is_flash_deal';
SHOW COLUMNS FROM auctions LIKE 'start_price_percent';
SHOW COLUMNS FROM auctions LIKE 'duration_hours';

-- 5) 기존 seed 정합성 (id=1, id=2 가 있다면 default 값 적용됨)
SELECT id, product_id, status, current_price, 
       is_flash_deal, start_price_percent, duration_hours 
FROM auctions ORDER BY id;
