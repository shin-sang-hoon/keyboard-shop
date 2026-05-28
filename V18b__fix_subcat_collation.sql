-- =====================================================================
-- V18b__fix_subcat_collation.sql
-- V18 collation 충돌 fix — 2026-05-28
--
-- 원인: sub_categories(utf8mb4_unicode_ci) vs products(utf8mb4_0900_ai_ci)
--       ④ bulk update JOIN 의 product_type = product_type 비교에서
--       collation 불일치 → ERROR 1267.
--
-- 해결: sub_categories 테이블/컬럼 collation 을 products 와 동일하게
--       (utf8mb4_0900_ai_ci) 변경 후 ④bulk update + ⑤FK 마저 수행.
--
-- 멱등: V18 에서 ①②③ 까지는 이미 적용됐을 수 있음. 이 스크립트는
--       그 상태에서 이어서 안전하게 실행 가능.
-- =====================================================================

USE keyboard_db;

-- ---------------------------------------------------------------------
-- ① 테이블 + product_type 컬럼 collation 을 products 와 동일하게 변경
--    (이미 0900_ai_ci 면 no-op 에 가까움)
-- ---------------------------------------------------------------------
ALTER TABLE sub_categories
  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------
-- ② '기타' 6종 시드 재확인 (V18 ③ 에서 됐어도 멱등)
-- ---------------------------------------------------------------------
INSERT INTO sub_categories (product_type, name, sort_order, created_at)
SELECT t.pt, '기타', 999, NOW(6)
FROM (
    SELECT 'KEYBOARD'    AS pt UNION ALL
    SELECT 'KEYCAP'          UNION ALL
    SELECT 'SWITCH_PART'     UNION ALL
    SELECT 'ACCESSORY'       UNION ALL
    SELECT 'MOUSE'           UNION ALL
    SELECT 'NOISE'
) t
WHERE NOT EXISTS (
    SELECT 1 FROM sub_categories s
    WHERE s.product_type = t.pt AND s.name = '기타'
);

-- ---------------------------------------------------------------------
-- ③ bulk update — 이제 collation 일치 → 정상 동작
-- ---------------------------------------------------------------------
UPDATE products p
JOIN sub_categories s
  ON s.product_type = p.product_type
 AND s.name = '기타'
SET p.sub_category_id = s.id
WHERE p.sub_category_id IS NULL;

-- ---------------------------------------------------------------------
-- ④ FK 제약 추가 (없을 때만 = 멱등)
-- ---------------------------------------------------------------------
SET @fk_exists := (
    SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA    = 'keyboard_db'
      AND TABLE_NAME      = 'products'
      AND CONSTRAINT_NAME = 'fk_products_sub_category'
);
SET @fk_ddl := IF(@fk_exists = 0,
    'ALTER TABLE products ADD CONSTRAINT fk_products_sub_category FOREIGN KEY (sub_category_id) REFERENCES sub_categories(id)',
    'SELECT "fk_products_sub_category already exists" AS info'
);
PREPARE fkstmt FROM @fk_ddl;
EXECUTE fkstmt;
DEALLOCATE PREPARE fkstmt;

-- ---------------------------------------------------------------------
-- ⑤ 검증
-- ---------------------------------------------------------------------
SELECT '--- sub_categories seed ---' AS section;
SELECT id, product_type, name, sort_order FROM sub_categories ORDER BY id;

SELECT '--- products mapping by type ---' AS section;
SELECT product_type,
       COUNT(*)                          AS total,
       COUNT(sub_category_id)            AS mapped,
       COUNT(*) - COUNT(sub_category_id) AS unmapped
FROM products
GROUP BY product_type
ORDER BY product_type;

SELECT '--- total summary (expect 2855/2855/0) ---' AS section;
SELECT COUNT(*) AS total,
       COUNT(sub_category_id) AS mapped,
       COUNT(*) - COUNT(sub_category_id) AS unmapped
FROM products;

-- 6) collation 최종 확인 (둘 다 0900_ai_ci 여야 함)
SELECT '--- collation check ---' AS section;
SELECT TABLE_NAME, COLUMN_NAME, COLLATION_NAME
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA='keyboard_db'
  AND ((TABLE_NAME='sub_categories' AND COLUMN_NAME='product_type')
    OR (TABLE_NAME='products' AND COLUMN_NAME='product_type'));
