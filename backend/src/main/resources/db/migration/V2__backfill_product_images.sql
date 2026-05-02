-- V2__backfill_product_images.sql
-- 5-H A5: Backfill product_images from products.image_url (2026-05-02)
--
-- Source: products table (2,477 rows total, 2,462 with valid image_url, 15 empty strings auto-filtered)
-- Target: product_images table (initially 0 rows for first backfill)
-- Strategy: 1 product = 1 ProductImage row, image_type=GALLERY, display_order=0
--
-- image_type=GALLERY rationale:
--   In Korean e-commerce UX (Coupang/11st/Naver Shopping), the same gallery
--   slider images are reused as card thumbnails (display_order=0 = card image).
--   Storing as GALLERY avoids data duplication and lets the future
--   D1/D2 crawler add GALLERY[1]~[6] to reach the 7-image gallery shown in
--   the ProductDetail v3 design (5-H C4 reference: swagkey.kr style).
--
--   Card list query: WHERE image_type='GALLERY' AND display_order=0
--   Detail gallery query: WHERE image_type='GALLERY' ORDER BY display_order
--
-- Idempotent: NOT EXISTS guard prevents duplicate inserts on re-run.
-- Safe execution: Wrap in explicit transaction (START TRANSACTION ... COMMIT/ROLLBACK).
--   Closing the mysql session without explicit COMMIT triggers auto-ROLLBACK.

INSERT INTO product_images (product_id, image_url, image_type, display_order)
SELECT
    p.id,
    p.image_url,
    'GALLERY',
    0
FROM products p
WHERE p.image_url IS NOT NULL
  AND p.image_url != ''
  AND NOT EXISTS (
    SELECT 1
    FROM product_images pi
    WHERE pi.product_id = p.id
      AND pi.display_order = 0
  );
