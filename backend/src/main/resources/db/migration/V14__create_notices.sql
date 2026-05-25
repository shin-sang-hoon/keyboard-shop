USE keyboard_db;

-- ============================================
-- V14: notices table (Phase 7-G Round 7, 5/25)
--
-- Admin notice CRUD domain.
-- Replaces the static dummy data in frontend/src/data/notices.js
-- with a real DB-backed table.
--
-- Columns:
--   title      : notice title (max 200)
--   content    : notice body (TEXT, no length limit)
--   pinned     : pin-to-top flag (pinned notices show first in list)
--   view_count : view counter. 0 on create.
--                Incremented by the public notice detail endpoint
--                (GET /api/notices/{id}) when a user opens a notice.
--   created_at / updated_at : managed by JPA @PrePersist / @PreUpdate.
--                DB DEFAULT is also set as a safety net (V13 pattern).
--
-- ASCII-only comments + idempotent (V13 carts/cart_items pattern)
-- ============================================

-- 1) notices table
CREATE TABLE IF NOT EXISTS notices (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  pinned TINYINT(1) NOT NULL DEFAULT 0,
  view_count INT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  INDEX idx_notice_pinned_id (pinned, id),
  INDEX idx_notice_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- idx_notice_pinned_id : list query sorts by (pinned DESC, id DESC).
-- idx_notice_created_at : supports created-at based ordering on the
--                         public user-facing notice list.

-- 2) Verify
SHOW CREATE TABLE notices\G

SELECT COUNT(*) AS notice_count FROM notices;
