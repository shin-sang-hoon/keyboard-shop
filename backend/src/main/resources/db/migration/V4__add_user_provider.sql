-- ============================================================================
-- V4__add_user_provider.sql  (idempotent + ENUM + MySQL 호환)
-- 5-B 인증/회원 - 카카오 OAuth 대비 User 스키마 확장
-- ============================================================================
--
-- 적용 전제: V0__initial_schema.sql 이 먼저 적용되어 users 테이블이 존재해야 함.
--
-- 변경사항:
--  1. users.provider 컬럼 (ENUM('LOCAL','KAKAO'))
--  2. users.provider_id 컬럼 (소셜 로그인 식별자, LOCAL은 NULL)
--  3. (provider, provider_id) 복합 인덱스
--  4. password NOT NULL → NULL 허용 (카카오 유저는 비밀번호 없음)
--
-- IDEMPOTENT 설계 — information_schema 동적 체크:
--  - MySQL 은 ALTER TABLE ... ADD COLUMN IF NOT EXISTS 미지원 (PostgreSQL 만 지원)
--  - 따라서 information_schema 로 컬럼 존재 여부 확인 후 동적 ALTER 실행
--  - 첫 실행: ALTER 적용 / 재실행: 이미 있으므로 SELECT no-op 만 실행
--  - MODIFY COLUMN 은 같은 정의여도 멱등 (no-op) 이라 그대로 사용
--
-- 면접 자산:
--  - DB 호환성 차이 (MySQL vs PostgreSQL) 인지 + information_schema 동적 SQL 패턴
--  - Hibernate ddl-auto 와 명시적 마이그레이션의 충돌 해결
--  - ENUM 첫 값이 implicit default 가 되는 MySQL 동작 (LOCAL 우선 둠)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. provider 컬럼 (없으면 추가)
-- ----------------------------------------------------------------------------
SET @col_exists = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'users'
      AND column_name = 'provider'
);
SET @sql = IF(
    @col_exists = 0,
    'ALTER TABLE users ADD COLUMN provider ENUM(''LOCAL'',''KAKAO'') NOT NULL DEFAULT ''LOCAL''',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 1-1. provider 컬럼 정의 보장 (이미 있는 경우 ENUM 순서/DEFAULT 정정 - 멱등)
ALTER TABLE users
    MODIFY COLUMN provider ENUM('LOCAL','KAKAO') NOT NULL DEFAULT 'LOCAL';


-- ----------------------------------------------------------------------------
-- 2. provider_id 컬럼 (없으면 추가)
-- ----------------------------------------------------------------------------
SET @col_exists = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'users'
      AND column_name = 'provider_id'
);
SET @sql = IF(
    @col_exists = 0,
    'ALTER TABLE users ADD COLUMN provider_id VARCHAR(100) NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- ----------------------------------------------------------------------------
-- 3. password NOT NULL → NULL 허용 (멱등)
-- ----------------------------------------------------------------------------
ALTER TABLE users
    MODIFY COLUMN password VARCHAR(255) NULL;


-- ----------------------------------------------------------------------------
-- 4. 복합 인덱스 (없으면 추가)
-- ----------------------------------------------------------------------------
SET @idx_exists = (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'users'
      AND index_name = 'idx_user_provider'
);
SET @sql = IF(
    @idx_exists = 0,
    'CREATE INDEX idx_user_provider ON users (provider, provider_id)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- ----------------------------------------------------------------------------
-- 5. 백필 — 기존 LOCAL 유저가 잘못 마킹된 케이스 정정
--    조건: 비밀번호가 있고 (이메일 가입자) provider_id 가 없으면 (소셜 X) → LOCAL
-- ----------------------------------------------------------------------------
UPDATE users
SET provider = 'LOCAL'
WHERE password IS NOT NULL
  AND provider_id IS NULL;

-- 6. NULL provider 정리 (안전 장치)
UPDATE users
SET provider = 'LOCAL'
WHERE provider IS NULL;


-- ============================================================================
-- 검증 쿼리 (수동 확인용, 주석)
-- ============================================================================
-- DESC users;
--   기대: password Null=YES, provider ENUM('LOCAL','KAKAO') NOT NULL DEFAULT 'LOCAL'
-- SELECT provider, COUNT(*) FROM users GROUP BY provider;
--   기대: LOCAL = 기존 유저 수, KAKAO = 0
