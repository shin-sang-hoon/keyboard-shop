-- ============================================
-- V15: notice_attachments table (Phase 7-B, 5/25)
--
-- Image attachments for notices. Phase 7-B feature.
-- A notice can have multiple ordered image attachments, shown
-- below the body on the public notice detail page.
--
-- Relationship: Notice 1 : N NoticeAttachment.
--   FK notice_id -> notices(id) ON DELETE CASCADE
--   (deleting a notice removes its attachment rows).
--
-- Columns:
--   notice_id     : owning notice (FK, NOT NULL).
--   original_name : user-facing file name as uploaded.
--   stored_name   : UUID-based name on disk (collision-free).
--   url           : public path, e.g. /uploads/notices/{uuid}.png
--                   served as a static resource by NoticeUploadWebConfig.
--   content_type  : MIME type (image/png, image/jpeg, ...).
--   file_size     : byte size. 0 as a safety-net default.
--   created_at    : managed by JPA @PrePersist.
--
-- Files themselves live on the server local disk under
-- app.upload.dir (./uploads); only metadata is stored here.
--
-- ASCII-only comments + idempotent (V13 carts/cart_items pattern).
-- ============================================

USE keyboard_db;

-- 1) notice_attachments table
CREATE TABLE IF NOT EXISTS notice_attachments (
  id            BIGINT       NOT NULL AUTO_INCREMENT,
  notice_id     BIGINT       NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name   VARCHAR(255) NOT NULL,
  url           VARCHAR(500) NOT NULL,
  content_type  VARCHAR(100) DEFAULT NULL,
  file_size     BIGINT       NOT NULL DEFAULT 0,
  created_at    DATETIME(6)  NOT NULL,
  PRIMARY KEY (id),
  -- idx_notice_attachment_notice : detail query loads a notice's
  --   attachments by notice_id.
  KEY idx_notice_attachment_notice (notice_id),
  -- ON DELETE CASCADE : removing a notice removes its attachment rows
  --   (also mirrored by JPA orphanRemoval on the entity side).
  CONSTRAINT fk_notice_attachment_notice
    FOREIGN KEY (notice_id) REFERENCES notices (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 2) Verify
SHOW CREATE TABLE notice_attachments\G

SELECT COUNT(*) AS attachment_count FROM notice_attachments;
