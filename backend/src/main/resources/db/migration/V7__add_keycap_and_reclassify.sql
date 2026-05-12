-- V7__add_keycap_and_reclassify.sql (5-J: ProductType 재편)
-- 작성: 5/13 새벽 Mac
-- 목적:
--   (1) ProductType ENUM 에 KEYCAP 값 추가 (MySQL native ENUM 격상)
--   (2) swagkey INACTIVE 키캡 93개 → KEYCAP + ACTIVE 복원
--       배경: V3 SQL '키캡' BLACKLIST 패턴에 묻혀있던 진짜 키캡 상품 복원
--   (3) MOUSE ACTIVE 1개 (id=117 M5) → INACTIVE (도메인 학습 후 deprecate)
-- idempotent: 재실행 시 WHERE 조건이 1차 실행 후 상태와 안 맞아서 no-op

-- (1) ALTER ENUM — DDL autocommit
ALTER TABLE products 
  MODIFY COLUMN product_type 
  ENUM('ACCESSORY','KEYBOARD','KEYCAP','MOUSE','NOISE','SWITCH_PART','UNCLASSIFIED');

-- (2) swagkey 키캡 93개 복원 — KEYBOARD INACTIVE → KEYCAP ACTIVE
UPDATE products
SET product_type = 'KEYCAP',
    status = 'ACTIVE'
WHERE source_id LIKE 'swagkey%'
  AND product_type = 'KEYBOARD'
  AND status = 'INACTIVE'
  AND (name LIKE '%키캡%' OR name LIKE '%keycap%' 
       OR name LIKE '%Keycap%' OR name LIKE '%KeyCap%');

-- (3) MOUSE ACTIVE → INACTIVE (M5 1개)
UPDATE products
SET status = 'INACTIVE'
WHERE product_type = 'MOUSE'
  AND status = 'ACTIVE';
