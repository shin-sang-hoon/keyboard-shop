-- V6__add_auction_version.sql
-- Phase 7 WebSocket (5/12)
-- @Version 낙관적 락 컬럼 추가. 동시 입찰 race condition 방지용.
--
-- 패턴: information_schema PREPARE (V4/V5 패턴 재활용) — idempotent.
-- 같은 SQL 두 번 실행해도 안전. 학원 PC sync 시 자동 적용 가능 (ddl-auto=validate 와 호환).

SET @col_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'auctions'
      AND COLUMN_NAME  = 'version'
);

SET @sql := IF(@col_exists = 0,
    'ALTER TABLE auctions ADD COLUMN version BIGINT NOT NULL DEFAULT 0',
    'SELECT ''auctions.version already exists, skipping ALTER'' AS info'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 기존 row 의 version 을 0 으로 명시적 초기화 (DEFAULT 0 이라 자동이지만 안전 확인)
UPDATE auctions SET version = 0 WHERE version IS NULL;

SELECT
    COUNT(*) AS total_rows,
    COUNT(version) AS rows_with_version,
    MIN(version) AS min_version,
    MAX(version) AS max_version
FROM auctions;
