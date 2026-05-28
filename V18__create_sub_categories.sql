-- =====================================================================
-- V18__create_sub_categories.sql
-- P2 하위 카테고리 (SubCategory) 도입 — 2026-05-28
--
-- 설계:
--   대분류 = Product.product_type enum (KEYBOARD/KEYCAP/SWITCH_PART/ACCESSORY...) 고정
--     └ 하위분류 = sub_categories (product_type 종속, 관리자 CRUD)
--         └ 상품 = products.sub_category_id FK
--
-- product_type 종속이 기존 categories(parent/children) 테이블과의 차별점.
-- categories 는 crawler 시절 미사용 레거시라 건드리지 않음 (category_id 0건 확인).
--
-- 멱등(idempotent): Flyway 미도입 + 학원 PC 동기화 재실행 대비.
--   docker cp + docker exec mysql -e "source /tmp/V18.sql" 수동 실행.
-- =====================================================================

USE keyboard_db;

-- ---------------------------------------------------------------------
-- ① sub_categories 테이블 (CREATE IF NOT EXISTS = 멱등)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sub_categories (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    product_type VARCHAR(32)  NOT NULL,
    name         VARCHAR(100) NOT NULL,
    sort_order   INT          NOT NULL DEFAULT 0,
    created_at   DATETIME(6)  NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_subcat_type_name (product_type, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- ② products.sub_category_id 컬럼 추가 (information_schema PREPARE = 멱등)
--    이미 있으면 건너뜀.
-- ---------------------------------------------------------------------
SET @col_exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'keyboard_db'
      AND TABLE_NAME   = 'products'
      AND COLUMN_NAME  = 'sub_category_id'
);
SET @ddl := IF(@col_exists = 0,
    'ALTER TABLE products ADD COLUMN sub_category_id BIGINT NULL',
    'SELECT "sub_category_id already exists" AS info'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------
-- ③ '기타' 6종 시드 (product_type 별 1개씩, INSERT WHERE NOT EXISTS = 멱등)
--    UNIQUE(product_type, name) 가 있어 INSERT IGNORE 도 가능하지만,
--    명시적 WHERE NOT EXISTS 로 의도를 드러냄.
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
-- ④ 기존 상품 bulk update — 자기 product_type 의 '기타' 로 매핑
--    (sub_category_id 가 아직 NULL 인 것만 = 멱등 + 이미 분류된 것 보존)
--    UNCLASSIFIED 등 '기타' 가 없는 type 은 매핑 안 됨 (NULL 유지) — 정상.
-- ---------------------------------------------------------------------
UPDATE products p
JOIN sub_categories s
  ON s.product_type = p.product_type
 AND s.name = '기타'
SET p.sub_category_id = s.id
WHERE p.sub_category_id IS NULL;

-- ---------------------------------------------------------------------
-- ⑤ FK 제약 추가 (없을 때만 = 멱등)
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
-- ⑥ 검증 SELECT
-- ---------------------------------------------------------------------
-- 6-1) 시드된 '기타' 6종 확인
SELECT '--- sub_categories seed ---' AS section;
SELECT id, product_type, name, sort_order FROM sub_categories ORDER BY id;

-- 6-2) product_type 별 매핑 현황 (mapped = sub_category_id 채워진 수)
SELECT '--- products mapping by type ---' AS section;
SELECT product_type,
       COUNT(*)                                AS total,
       COUNT(sub_category_id)                  AS mapped,
       COUNT(*) - COUNT(sub_category_id)       AS unmapped
FROM products
GROUP BY product_type
ORDER BY product_type;

-- 6-3) 전체 매핑 요약 (기대: total 2855, mapped 2855, unmapped 0)
SELECT '--- total summary ---' AS section;
SELECT COUNT(*) AS total,
       COUNT(sub_category_id) AS mapped,
       COUNT(*) - COUNT(sub_category_id) AS unmapped
FROM products;
