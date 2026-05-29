-- =====================================================================
-- V20: 회원 탈퇴(soft delete) 도메인 — users.status + withdrawn_at
-- =====================================================================
-- 설계:
--   - status: ACTIVE(기본) / WITHDRAWN. 기존 row 전부 ACTIVE 백필.
--   - withdrawn_at: 탈퇴 시각. ACTIVE 면 NULL.
--   - 이메일은 보존(익명화 X) → 재가입 차단(existsByEmail) + 제재 연계.
--   - 로그인/refresh 가드는 status 로 판별 (password 검증 통과 후).
--
-- idempotent: information_schema 로 컬럼 존재 여부 확인 후 ADD.
--   (Flyway 미도입 + ddl-auto=validate 환경 → 수동 실행, 재실행 안전 필요)
--   docker cp + docker exec mysql < /tmp/x.sql 패턴으로 적용.
-- =====================================================================

-- 1) status 컬럼 (ENUM, NOT NULL, 기본 ACTIVE)
SET @col_status := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'users'
      AND COLUMN_NAME  = 'status'
);
SET @sql_status := IF(@col_status = 0,
    'ALTER TABLE users ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT ''ACTIVE''',
    'SELECT ''V20: users.status already exists, skip'' AS msg'
);
PREPARE stmt FROM @sql_status;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) withdrawn_at 컬럼 (DATETIME, NULL 허용)
SET @col_wat := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'users'
      AND COLUMN_NAME  = 'withdrawn_at'
);
SET @sql_wat := IF(@col_wat = 0,
    'ALTER TABLE users ADD COLUMN withdrawn_at DATETIME NULL',
    'SELECT ''V20: users.withdrawn_at already exists, skip'' AS msg'
);
PREPARE stmt FROM @sql_wat;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3) 기존 row 백필: status 가 NULL/빈값이면 ACTIVE 로 (방어적; DEFAULT 로 이미 채워지지만 명시)
UPDATE users SET status = 'ACTIVE' WHERE status IS NULL OR status = '';

-- 4) 조회 인덱스: 로그인/관리자 회원목록에서 status 필터 자주 사용
SET @idx := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'users'
      AND INDEX_NAME   = 'idx_user_status'
);
SET @sql_idx := IF(@idx = 0,
    'CREATE INDEX idx_user_status ON users (status)',
    'SELECT ''V20: idx_user_status already exists, skip'' AS msg'
);
PREPARE stmt FROM @sql_idx;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
