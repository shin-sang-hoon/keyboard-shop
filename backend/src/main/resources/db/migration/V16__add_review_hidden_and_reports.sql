-- =====================================================================
-- V16__add_review_hidden_and_reports.sql
-- Phase 7-G R8 (2026-05-26) — 리뷰 운영 + 리뷰 신고 시스템
--
--   (1) reviews.hidden  : 관리자 숨김 플래그 (BOOLEAN, 기본 FALSE)
--   (2) review_reports  : 리뷰 신고 테이블
--
-- 실행 환경: ddl-auto=validate — bootRun 전에 먼저 적용해야 함.
--   docker cp V16__add_review_hidden_and_reports.sql keyboard_mysql:/tmp/v16.sql
--   docker exec keyboard_mysql mysql -uroot -proot1234 keyboard_db -e "source /tmp/v16.sql"
--
-- idempotent — 재실행해도 안전 (information_schema 가드 + CREATE IF NOT EXISTS).
--
-- [실행 전 확인] reviews.hidden 컬럼 타입 — 기존 boolean 컬럼과 동일하게 맞출 것:
--   SHOW COLUMNS FROM qna LIKE 'is_secret';
--   대부분 tinyint(1) → 아래 BOOLEAN(=TINYINT(1)) 그대로 OK.
--   (MySQL JDBC tinyInt1isBit=true 기본값 → BOOLEAN/TINYINT(1)/BIT 모두 validate 통과)
-- =====================================================================

-- ── (1) reviews.hidden 컬럼 ───────────────────────────────────────────
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'reviews'
    AND COLUMN_NAME  = 'hidden'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE reviews ADD COLUMN hidden BOOLEAN NOT NULL DEFAULT FALSE',
  'SELECT ''reviews.hidden already exists - skipped'' AS msg'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ── (2) review_reports 테이블 ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS review_reports (
  id           BIGINT       NOT NULL AUTO_INCREMENT,
  review_id    BIGINT       NOT NULL,
  reporter_id  BIGINT       NOT NULL,
  reason       VARCHAR(20)  NOT NULL,
  detail       VARCHAR(500) NULL,
  status       VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
  handled_by   BIGINT       NULL,
  handled_at   DATETIME(6)  NULL,
  created_at   DATETIME(6)  NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT uk_review_report   UNIQUE (review_id, reporter_id),
  CONSTRAINT fk_report_review   FOREIGN KEY (review_id)   REFERENCES reviews(id) ON DELETE CASCADE,
  CONSTRAINT fk_report_reporter FOREIGN KEY (reporter_id) REFERENCES users(id),
  CONSTRAINT fk_report_handler  FOREIGN KEY (handled_by)  REFERENCES users(id),
  INDEX idx_report_status (status),
  INDEX idx_report_review (review_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 검증 쿼리 (실행 후 수동 확인용) ───────────────────────────────────
-- SHOW COLUMNS FROM reviews LIKE 'hidden';
-- SHOW CREATE TABLE review_reports\G
