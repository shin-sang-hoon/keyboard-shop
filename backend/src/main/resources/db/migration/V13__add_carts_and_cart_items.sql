USE keyboard_db;

-- ============================================
-- V13: carts + cart_items tables (Phase 8 5-D, 5/18)
--
-- Aggregate Root pattern:
--   User 1 ─── 1 Cart ─── N CartItem ─── N Product
--
-- Cart: per-user singleton (auto-created on signup)
-- CartItem: actual cart row with quantity
--
-- ASCII-only comments + idempotent (V4/V10/V11/V12 pattern)
-- ============================================

-- 1) Cart table (per-user, auto-created on signup)
CREATE TABLE IF NOT EXISTS carts (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT uk_cart_user UNIQUE KEY (user_id),
  CONSTRAINT fk_cart_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) CartItem table (actual cart row, N per Cart)
CREATE TABLE IF NOT EXISTS cart_items (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  cart_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT uk_cart_item_cart_product UNIQUE KEY (cart_id, product_id),
  CONSTRAINT fk_cart_item_cart FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_item_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_cart_item_cart (cart_id),
  INDEX idx_cart_item_product (product_id),
  CONSTRAINT chk_cart_item_quantity CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3) Backfill: create Cart for existing users (idempotent via INSERT IGNORE)
-- Without this, existing 4 users would not have a Cart and the invariant
-- "user always has 1 cart" would be broken.
INSERT IGNORE INTO carts (user_id)
SELECT id FROM users
WHERE id NOT IN (SELECT user_id FROM carts);

-- 4) Verify
SHOW CREATE TABLE carts\G
SHOW CREATE TABLE cart_items\G

SELECT COUNT(*) AS user_count FROM users;
SELECT COUNT(*) AS cart_count FROM carts;
SELECT COUNT(*) AS cart_item_count FROM cart_items;
