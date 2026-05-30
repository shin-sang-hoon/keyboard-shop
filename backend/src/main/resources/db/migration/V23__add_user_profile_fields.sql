-- V23__add_user_profile_fields.sql
--
-- 회원정보 수정 (2026-05-30) — 사용자단 + 관리자단 프로필 편집 지원.
--
-- 신규 컬럼 7개 (전부 NULL 허용 — 기존 row 백필 불필요):
--   nickname        : 닉네임. 로그인/헤더 표시 "이름(닉네임)". NULL 이면 이름만 표시.
--   phone           : 휴대폰 번호. 회원가입 시 입력받았으나 그동안 컬럼 미보존 → 신설.
--   zipcode         : 우편번호 (Daum 우편번호 서비스 자동 입력).
--   address         : 기본 주소 (Daum 자동 입력).
--   address_detail  : 상세 주소 (동/호수/층 — 사용자 직접 입력).
--   admin_memo      : 관리자 메모. 관리자단에서만 입력/노출 (회원 관리용 내부 메모).
--   last_login_at   : 최종 접속 시각. 로그인 성공 시 갱신. 관리자단 읽기전용 노출.
--
-- 멱등성: information_schema 확인 후 PREPARE 로 컬럼별 ADD (V4/V22 패턴과 동일).
--         재실행해도 "Duplicate column" 없이 안전.

-- nickname --------------------------------------------------------------
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'nickname');
SET @ddl := IF(@col = 0,
  'ALTER TABLE users ADD COLUMN nickname VARCHAR(50) NULL AFTER name',
  'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- phone -----------------------------------------------------------------
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'phone');
SET @ddl := IF(@col = 0,
  'ALTER TABLE users ADD COLUMN phone VARCHAR(20) NULL AFTER nickname',
  'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- zipcode ---------------------------------------------------------------
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'zipcode');
SET @ddl := IF(@col = 0,
  'ALTER TABLE users ADD COLUMN zipcode VARCHAR(10) NULL AFTER phone',
  'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- address ---------------------------------------------------------------
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'address');
SET @ddl := IF(@col = 0,
  'ALTER TABLE users ADD COLUMN address VARCHAR(255) NULL AFTER zipcode',
  'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- address_detail --------------------------------------------------------
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'address_detail');
SET @ddl := IF(@col = 0,
  'ALTER TABLE users ADD COLUMN address_detail VARCHAR(255) NULL AFTER address',
  'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- admin_memo ------------------------------------------------------------
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'admin_memo');
SET @ddl := IF(@col = 0,
  'ALTER TABLE users ADD COLUMN admin_memo VARCHAR(500) NULL AFTER suspend_reason',
  'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- last_login_at ---------------------------------------------------------
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'last_login_at');
SET @ddl := IF(@col = 0,
  'ALTER TABLE users ADD COLUMN last_login_at DATETIME NULL AFTER created_at',
  'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
