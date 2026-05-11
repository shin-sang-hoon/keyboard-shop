-- ============================================================================
-- V5__expand_audit_log.sql  (idempotent + ENUM + 한글 주석)
-- Phase 7 관리자 패널 - AuditLog @Aspect 자동 감사 로깅을 위한 컬럼 확장
-- ============================================================================
--
-- 선행 조건: V0__initial_schema.sql 에 audit_logs 테이블이 이미 존재해야 함
--
-- 변경사항:
--  1. category 컬럼을 String → ENUM 격상 (PRODUCT/USER/ORDER/CRAWLER/CHATBOT)
--  2. event_type 컬럼을 String → ENUM 격상 (CREATE/UPDATE/DELETE/BLOCK/UNBLOCK/EXECUTE/VIEW)
--  3. target_type 컬럼 추가 (target_id 짝꿍 - 다형성 추적: PRODUCT, USER, ORDER 등)
--  4. ip_address 컬럼 추가 (IPv6 대비 VARCHAR(45))
--  5. user_agent 컬럼 추가 (브라우저/봇 구분, 디버깅)
--  6. result 컬럼 추가 (SUCCESS / FAILURE - 실패 액션도 추적)
--  7. duration_ms 컬럼 추가 (성능 추적 - 어떤 액션이 느린지)
--  8. 복합 인덱스 추가 (admin_id, created_at) - 관리자별 최신 액션 조회
--  9. 복합 인덱스 추가 (category, created_at) - 카테고리별 필터 조회
--
-- IDEMPOTENT 설계 — information_schema 동적 체크:
--  - V4 패턴 그대로 활용 (PREPARE/EXECUTE/DEALLOCATE)
--  - 컬럼/인덱스 존재 여부 확인 후 동적 ALTER 실행
--  - 재실행 안전 (no-op)
--
-- 면접 자산:
--  - DB 호환성 (MySQL information_schema 패턴)
--  - ENUM 격상으로 컴파일 타임 안전성 + DB 무결성 양면 강화
--  - 성능 추적 컬럼 (duration_ms) - 운영 분석 가치
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. category 컬럼 ENUM 격상 (없으면 추가, 있으면 ENUM 으로 변경)
-- ----------------------------------------------------------------------------
SET @col_exists = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'audit_logs'
      AND column_name = 'category'
);
SET @sql = IF(
    @col_exists = 0,
    'ALTER TABLE audit_logs ADD COLUMN category ENUM(''PRODUCT'',''USER'',''ORDER'',''CRAWLER'',''CHATBOT'') NOT NULL DEFAULT ''PRODUCT''',
    'ALTER TABLE audit_logs MODIFY COLUMN category ENUM(''PRODUCT'',''USER'',''ORDER'',''CRAWLER'',''CHATBOT'') NOT NULL'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- ----------------------------------------------------------------------------
-- 2. event_type 컬럼 ENUM 격상
-- ----------------------------------------------------------------------------
SET @col_exists = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'audit_logs'
      AND column_name = 'event_type'
);
SET @sql = IF(
    @col_exists = 0,
    'ALTER TABLE audit_logs ADD COLUMN event_type ENUM(''CREATE'',''UPDATE'',''DELETE'',''BLOCK'',''UNBLOCK'',''EXECUTE'',''VIEW'') NOT NULL DEFAULT ''VIEW''',
    'ALTER TABLE audit_logs MODIFY COLUMN event_type ENUM(''CREATE'',''UPDATE'',''DELETE'',''BLOCK'',''UNBLOCK'',''EXECUTE'',''VIEW'') NOT NULL'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- ----------------------------------------------------------------------------
-- 3. target_type 컬럼 추가
-- ----------------------------------------------------------------------------
SET @col_exists = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'audit_logs'
      AND column_name = 'target_type'
);
SET @sql = IF(
    @col_exists = 0,
    'ALTER TABLE audit_logs ADD COLUMN target_type VARCHAR(50) NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- ----------------------------------------------------------------------------
-- 4. ip_address 컬럼 추가 (IPv6 대비 45 chars)
-- ----------------------------------------------------------------------------
SET @col_exists = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'audit_logs'
      AND column_name = 'ip_address'
);
SET @sql = IF(
    @col_exists = 0,
    'ALTER TABLE audit_logs ADD COLUMN ip_address VARCHAR(45) NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- ----------------------------------------------------------------------------
-- 5. user_agent 컬럼 추가
-- ----------------------------------------------------------------------------
SET @col_exists = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'audit_logs'
      AND column_name = 'user_agent'
);
SET @sql = IF(
    @col_exists = 0,
    'ALTER TABLE audit_logs ADD COLUMN user_agent VARCHAR(500) NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- ----------------------------------------------------------------------------
-- 6. result 컬럼 추가 (SUCCESS / FAILURE)
-- ----------------------------------------------------------------------------
SET @col_exists = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'audit_logs'
      AND column_name = 'result'
);
SET @sql = IF(
    @col_exists = 0,
    'ALTER TABLE audit_logs ADD COLUMN result VARCHAR(20) NOT NULL DEFAULT ''SUCCESS''',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- ----------------------------------------------------------------------------
-- 7. duration_ms 컬럼 추가
-- ----------------------------------------------------------------------------
SET @col_exists = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'audit_logs'
      AND column_name = 'duration_ms'
);
SET @sql = IF(
    @col_exists = 0,
    'ALTER TABLE audit_logs ADD COLUMN duration_ms BIGINT NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- ----------------------------------------------------------------------------
-- 8. 인덱스 (admin_id, created_at) — 관리자별 최신 액션 조회
-- ----------------------------------------------------------------------------
SET @idx_exists = (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'audit_logs'
      AND index_name = 'idx_audit_admin_created'
);
SET @sql = IF(
    @idx_exists = 0,
    'CREATE INDEX idx_audit_admin_created ON audit_logs (admin_id, created_at DESC)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- ----------------------------------------------------------------------------
-- 9. 인덱스 (category, created_at) — 카테고리별 필터 조회
-- ----------------------------------------------------------------------------
SET @idx_exists = (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'audit_logs'
      AND index_name = 'idx_audit_category_created'
);
SET @sql = IF(
    @idx_exists = 0,
    'CREATE INDEX idx_audit_category_created ON audit_logs (category, created_at DESC)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- ============================================================================
-- 검증 쿼리 (수동 확인용, 주석)
-- ============================================================================
-- DESC audit_logs;
-- SHOW INDEX FROM audit_logs;
-- SELECT category, event_type, result, COUNT(*) FROM audit_logs GROUP BY 1,2,3;
