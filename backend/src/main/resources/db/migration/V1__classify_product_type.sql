-- =============================================================================
-- V1__classify_product_type.sql (v3: 키보드 본체 오분류 fix)
-- 5-G Step 3: products 테이블에 product_type 분류 적용
--
-- 4/29 v2 진단 → v3 패치:
--   - ACCESSORY/SWITCH_PART에 키보드 본체가 다수 섞여 들어감
--     ("기계식 키보드 PBT 키캡", "K8 키보드 갈색 스위치 갈축")
--   - 처방: STEP_3, 4에 "키보드"/"keyboard" 단어 제외 조건 추가
--   - 트레이드오프: "키보드 호환 팜레스트" 등 5~10개는 KEYBOARD 오분류 (Phase 6 KoBERT 정밀화 대상)
--
-- 환경:
--   - Flyway 미사용, 수동 실행
--   - docker exec --default-character-set=utf8mb4 필수
-- =============================================================================

SET NAMES utf8mb4;


-- =============================================================================
-- 섹션 1: DRY-RUN COUNT
-- =============================================================================

SELECT 'STEP_1_MOUSE_PAD (-> ACCESSORY)' AS step, COUNT(*) AS will_update
FROM products
WHERE (product_type IS NULL OR product_type = 'UNCLASSIFIED')
  AND (name LIKE '%마우스 패드%' OR name LIKE '%마우스패드%'
    OR LOWER(name) LIKE '%mouse pad%' OR LOWER(name) LIKE '%mousepad%');

SELECT 'STEP_2_MOUSE' AS step, COUNT(*) AS will_update
FROM products
WHERE (product_type IS NULL OR product_type = 'UNCLASSIFIED')
  AND (LOWER(name) LIKE '%mouse%' OR name LIKE '%마우스%')
  AND NOT (name LIKE '%마우스 패드%' OR name LIKE '%마우스패드%'
           OR LOWER(name) LIKE '%mouse pad%' OR LOWER(name) LIKE '%mousepad%');

SELECT 'STEP_3_SWITCH_PART (no 키보드)' AS step, COUNT(*) AS will_update
FROM products
WHERE (product_type IS NULL OR product_type = 'UNCLASSIFIED')
  AND name LIKE '%스위치%'
  AND name NOT LIKE '%키보드%'
  AND LOWER(name) NOT LIKE '%keyboard%'
  AND NOT (LOWER(name) LIKE '%mouse%' OR name LIKE '%마우스%')
  AND (LOWER(name) LIKE '%pcs%' OR name LIKE '%개%' OR name LIKE '%축%'
    OR name LIKE '%교체%' OR name LIKE '%프리루브%');

SELECT 'STEP_4_ACCESSORY (no 키보드)' AS step, COUNT(*) AS will_update
FROM products
WHERE (product_type IS NULL OR product_type = 'UNCLASSIFIED')
  AND name NOT LIKE '%키보드%'
  AND LOWER(name) NOT LIKE '%keyboard%'
  AND NOT (LOWER(name) LIKE '%mouse%' OR name LIKE '%마우스%')
  AND (name LIKE '%키캡%' OR LOWER(name) LIKE '%keycap%'
    OR name LIKE '%케이블%' OR LOWER(name) LIKE '%cable%'
    OR name LIKE '%팜레스트%' OR LOWER(name) LIKE '%palm rest%' OR LOWER(name) LIKE '%palmrest%'
    OR name LIKE '%커버%' OR LOWER(name) LIKE '%cover%'
    OR name LIKE '%케이스%' OR LOWER(name) LIKE '%case%'
    OR name LIKE '%노브%' OR LOWER(name) LIKE '%knob%');

SELECT 'STEP_5_NOISE' AS step, COUNT(*) AS will_update
FROM products
WHERE (product_type IS NULL OR product_type = 'UNCLASSIFIED')
  AND (name LIKE '%스위치 허브%' OR LOWER(name) LIKE '%switch hub%'
    OR name LIKE '%네트워크 스위치%' OR LOWER(name) LIKE '%network switch%'
    OR LOWER(name) LIKE '%ethernet switch%');

SELECT 'STEP_6_KEYBOARD_glb' AS step, COUNT(*) AS will_update
FROM products
WHERE (product_type IS NULL OR product_type = 'UNCLASSIFIED')
  AND glb_url IS NOT NULL
  AND NOT (LOWER(name) LIKE '%mouse%' OR name LIKE '%마우스%');

SELECT 'STEP_7_KEYBOARD_keyword' AS step, COUNT(*) AS will_update
FROM products
WHERE (product_type IS NULL OR product_type = 'UNCLASSIFIED')
  AND glb_url IS NULL
  AND NOT (LOWER(name) LIKE '%mouse%' OR name LIKE '%마우스%')
  AND (name LIKE '%키보드%' OR LOWER(name) LIKE '%keyboard%'
    OR name LIKE '%키크론%' OR LOWER(name) LIKE '%keychron%'
    OR name LIKE '%적축%' OR name LIKE '%청축%' OR name LIKE '%갈축%'
    OR name LIKE '%흑축%' OR name LIKE '%바나나축%' OR name LIKE '%저소음%');


-- =============================================================================
-- 섹션 2: 실제 UPDATE (트랜잭션, ROLLBACK 가능)
-- =============================================================================

START TRANSACTION;

-- STEP 1: 마우스 패드 → ACCESSORY
UPDATE products SET product_type = 'ACCESSORY'
WHERE (product_type IS NULL OR product_type = 'UNCLASSIFIED')
  AND (name LIKE '%마우스 패드%' OR name LIKE '%마우스패드%'
    OR LOWER(name) LIKE '%mouse pad%' OR LOWER(name) LIKE '%mousepad%');

-- STEP 2: 마우스 본체 → MOUSE (glb 무관, 키워드 우선)
UPDATE products SET product_type = 'MOUSE'
WHERE (product_type IS NULL OR product_type = 'UNCLASSIFIED')
  AND (LOWER(name) LIKE '%mouse%' OR name LIKE '%마우스%');

-- STEP 3: 스위치 부품 → SWITCH_PART (키보드 본체 제외)
UPDATE products SET product_type = 'SWITCH_PART'
WHERE (product_type IS NULL OR product_type = 'UNCLASSIFIED')
  AND name LIKE '%스위치%'
  AND name NOT LIKE '%키보드%'
  AND LOWER(name) NOT LIKE '%keyboard%'
  AND (LOWER(name) LIKE '%pcs%' OR name LIKE '%개%' OR name LIKE '%축%'
    OR name LIKE '%교체%' OR name LIKE '%프리루브%');

-- STEP 4: 액세서리 → ACCESSORY (키보드 본체 제외)
UPDATE products SET product_type = 'ACCESSORY'
WHERE (product_type IS NULL OR product_type = 'UNCLASSIFIED')
  AND name NOT LIKE '%키보드%'
  AND LOWER(name) NOT LIKE '%keyboard%'
  AND (name LIKE '%키캡%' OR LOWER(name) LIKE '%keycap%'
    OR name LIKE '%케이블%' OR LOWER(name) LIKE '%cable%'
    OR name LIKE '%팜레스트%' OR LOWER(name) LIKE '%palm rest%' OR LOWER(name) LIKE '%palmrest%'
    OR name LIKE '%커버%' OR LOWER(name) LIKE '%cover%'
    OR name LIKE '%케이스%' OR LOWER(name) LIKE '%case%'
    OR name LIKE '%노브%' OR LOWER(name) LIKE '%knob%');

-- STEP 5: NOISE
UPDATE products SET product_type = 'NOISE'
WHERE (product_type IS NULL OR product_type = 'UNCLASSIFIED')
  AND (name LIKE '%스위치 허브%' OR LOWER(name) LIKE '%switch hub%'
    OR name LIKE '%네트워크 스위치%' OR LOWER(name) LIKE '%network switch%'
    OR LOWER(name) LIKE '%ethernet switch%');

-- STEP 6: glb_url 잔여 → KEYBOARD
UPDATE products SET product_type = 'KEYBOARD'
WHERE (product_type IS NULL OR product_type = 'UNCLASSIFIED')
  AND glb_url IS NOT NULL;

-- STEP 7: 키보드 키워드 잔여 → KEYBOARD
UPDATE products SET product_type = 'KEYBOARD'
WHERE (product_type IS NULL OR product_type = 'UNCLASSIFIED')
  AND (name LIKE '%키보드%' OR LOWER(name) LIKE '%keyboard%'
    OR name LIKE '%키크론%' OR LOWER(name) LIKE '%keychron%'
    OR name LIKE '%적축%' OR name LIKE '%청축%' OR name LIKE '%갈축%'
    OR name LIKE '%흑축%' OR name LIKE '%바나나축%' OR name LIKE '%저소음%');


-- =============================================================================
-- 섹션 3: 검증
-- =============================================================================

SELECT IFNULL(product_type, 'NULL') AS type, COUNT(*) AS cnt
FROM products GROUP BY product_type ORDER BY cnt DESC;

SELECT 'ACCESSORY+glb 잔여' AS info, COUNT(*) AS cnt
FROM products WHERE product_type='ACCESSORY' AND glb_url IS NOT NULL;

SELECT 'SWITCH_PART+glb 잔여' AS info, COUNT(*) AS cnt
FROM products WHERE product_type='SWITCH_PART' AND glb_url IS NOT NULL;

SELECT 'glb_url 분포 (검증)' AS info, product_type, COUNT(*) AS cnt
FROM products WHERE glb_url IS NOT NULL
GROUP BY product_type;

SELECT id, LEFT(name, 80) AS name_preview
FROM products WHERE product_type = 'UNCLASSIFIED'
ORDER BY id LIMIT 10;

-- COMMIT 또는 ROLLBACK 은 검증 후 수동 실행
