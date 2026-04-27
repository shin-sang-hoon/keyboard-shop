-- =============================================================================
-- V1__classify_product_type.sql
-- 5-G Step 3: 기존 products 테이블에 product_type 분류 적용
--
-- 실행 컨텍스트:
--   - Step 2 에서 product_type 컬럼이 ENUM 으로 추가된 상태
--   - 새 row 는 @Builder.Default 로 UNCLASSIFIED, 기존 row 는 NULL
--   - 이 스크립트는 우선순위 규칙으로 NULL/UNCLASSIFIED 를 enum 값으로 채움
--
-- 분류 우선순위 (위 -> 아래 순서대로 평가, 먼저 매치되는 것이 우선):
--   1. glb_url IS NOT NULL          -> KEYBOARD  (3D 모델 매핑된 건 무조건 키보드)
--   2. 마우스 키워드                -> MOUSE
--   3. 스위치 부품 키워드           -> SWITCH_PART
--   4. 액세서리 키워드 (키캡 등)    -> ACCESSORY
--   5. 노이즈 키워드 (스위치 허브)  -> NOISE
--   6. 키보드 키워드                -> KEYBOARD  (나머지 키보드)
--   7. 위 어디에도 안 걸림          -> UNCLASSIFIED (그대로 둠)
--
-- 사용법:
--   각 섹션을 순서대로 실행. 섹션 1 의 DRY-RUN 결과로 영향 row 수를 먼저 확인 후
--   섹션 2 의 UPDATE 진행. 트랜잭션으로 묶여있어 ROLLBACK 가능.
-- =============================================================================


-- =============================================================================
-- 섹션 1: DRY-RUN COUNT (실제 UPDATE 전 영향 받을 row 수 미리 보기)
-- =============================================================================

SELECT
    'STEP_1_KEYBOARD_glb' AS step,
    COUNT(*) AS will_update
FROM products
WHERE (product_type IS NULL OR product_type = 'UNCLASSIFIED')
  AND glb_url IS NOT NULL;

SELECT
    'STEP_2_MOUSE' AS step,
    COUNT(*) AS will_update
FROM products
WHERE (product_type IS NULL OR product_type = 'UNCLASSIFIED')
  AND glb_url IS NULL
  AND (
       LOWER(name) LIKE '%mouse%'
    OR name LIKE '%마우스%'
  );

SELECT
    'STEP_3_SWITCH_PART' AS step,
    COUNT(*) AS will_update
FROM products
WHERE (product_type IS NULL OR product_type = 'UNCLASSIFIED')
  AND glb_url IS NULL
  AND name LIKE '%스위치%'
  AND NOT (LOWER(name) LIKE '%mouse%' OR name LIKE '%마우스%')
  AND (
       LOWER(name) LIKE '%pcs%'
    OR name LIKE '%개%'
    OR name LIKE '%축%'
    OR name LIKE '%교체%'
    OR name LIKE '%프리루브%'
  );

SELECT
    'STEP_4_ACCESSORY' AS step,
    COUNT(*) AS will_update
FROM products
WHERE (product_type IS NULL OR product_type = 'UNCLASSIFIED')
  AND glb_url IS NULL
  AND NOT (LOWER(name) LIKE '%mouse%' OR name LIKE '%마우스%')
  AND (
       name LIKE '%키캡%'
    OR LOWER(name) LIKE '%keycap%'
    OR name LIKE '%케이블%'
    OR LOWER(name) LIKE '%cable%'
    OR name LIKE '%팜레스트%'
    OR LOWER(name) LIKE '%palm rest%'
    OR LOWER(name) LIKE '%palmrest%'
    OR name LIKE '%커버%'
    OR LOWER(name) LIKE '%cover%'
    OR name LIKE '%케이스%'
    OR LOWER(name) LIKE '%case%'
    OR name LIKE '%노브%'
    OR LOWER(name) LIKE '%knob%'
  );

SELECT
    'STEP_5_NOISE' AS step,
    COUNT(*) AS will_update
FROM products
WHERE (product_type IS NULL OR product_type = 'UNCLASSIFIED')
  AND glb_url IS NULL
  AND (
       name LIKE '%스위치 허브%'
    OR LOWER(name) LIKE '%switch hub%'
    OR name LIKE '%네트워크 스위치%'
    OR LOWER(name) LIKE '%network switch%'
    OR LOWER(name) LIKE '%ethernet switch%'
  );

SELECT
    'STEP_6_KEYBOARD_keyword' AS step,
    COUNT(*) AS will_update
FROM products
WHERE (product_type IS NULL OR product_type = 'UNCLASSIFIED')
  AND glb_url IS NULL
  AND NOT (LOWER(name) LIKE '%mouse%' OR name LIKE '%마우스%')
  AND (
       name LIKE '%키보드%'
    OR LOWER(name) LIKE '%keyboard%'
    OR name LIKE '%키크론%'
    OR LOWER(name) LIKE '%keychron%'
    OR name LIKE '%적축%'
    OR name LIKE '%청축%'
    OR name LIKE '%갈축%'
    OR name LIKE '%흑축%'
    OR name LIKE '%바나나축%'
    OR name LIKE '%저소음%'
  );


-- =============================================================================
-- 섹션 2: 실제 UPDATE (트랜잭션으로 묶어서 ROLLBACK 가능하게)
-- =============================================================================

START TRANSACTION;

-- STEP 1: glb_url 있는 것은 모두 KEYBOARD (가장 높은 신뢰도)
UPDATE products
SET product_type = 'KEYBOARD'
WHERE (product_type IS NULL OR product_type = 'UNCLASSIFIED')
  AND glb_url IS NOT NULL;

-- STEP 2: 마우스 (mouse 또는 마우스 키워드)
UPDATE products
SET product_type = 'MOUSE'
WHERE product_type = 'UNCLASSIFIED'
  AND (
       LOWER(name) LIKE '%mouse%'
    OR name LIKE '%마우스%'
  );

-- STEP 3: 스위치 부품 (pcs/개/축/교체/프리루브 키워드 함께 있을 때)
UPDATE products
SET product_type = 'SWITCH_PART'
WHERE product_type = 'UNCLASSIFIED'
  AND name LIKE '%스위치%'
  AND (
       LOWER(name) LIKE '%pcs%'
    OR name LIKE '%개%'
    OR name LIKE '%축%'
    OR name LIKE '%교체%'
    OR name LIKE '%프리루브%'
  );

-- STEP 4: 액세서리 (키캡/케이블/팜레스트/커버/케이스/노브)
UPDATE products
SET product_type = 'ACCESSORY'
WHERE product_type = 'UNCLASSIFIED'
  AND (
       name LIKE '%키캡%'
    OR LOWER(name) LIKE '%keycap%'
    OR name LIKE '%케이블%'
    OR LOWER(name) LIKE '%cable%'
    OR name LIKE '%팜레스트%'
    OR LOWER(name) LIKE '%palm rest%'
    OR LOWER(name) LIKE '%palmrest%'
    OR name LIKE '%커버%'
    OR LOWER(name) LIKE '%cover%'
    OR name LIKE '%케이스%'
    OR LOWER(name) LIKE '%case%'
    OR name LIKE '%노브%'
    OR LOWER(name) LIKE '%knob%'
  );

-- STEP 5: 노이즈 (네트워크 스위치 허브 등 키보드 무관 데이터)
UPDATE products
SET product_type = 'NOISE'
WHERE product_type = 'UNCLASSIFIED'
  AND (
       name LIKE '%스위치 허브%'
    OR LOWER(name) LIKE '%switch hub%'
    OR name LIKE '%네트워크 스위치%'
    OR LOWER(name) LIKE '%network switch%'
    OR LOWER(name) LIKE '%ethernet switch%'
  );

-- STEP 6: 키보드 키워드 + 브랜드명 + 스위치 색상으로 잔여 키보드 흡수
-- (한국 쇼핑몰 제품명에 '키보드' 단어 없이 모델명만 적힌 경우 대응)
UPDATE products
SET product_type = 'KEYBOARD'
WHERE product_type = 'UNCLASSIFIED'
  AND (
       name LIKE '%키보드%'
    OR LOWER(name) LIKE '%keyboard%'
    OR name LIKE '%키크론%'
    OR LOWER(name) LIKE '%keychron%'
    OR name LIKE '%적축%'
    OR name LIKE '%청축%'
    OR name LIKE '%갈축%'
    OR name LIKE '%흑축%'
    OR name LIKE '%바나나축%'
    OR name LIKE '%저소음%'
  );

-- COMMIT 또는 ROLLBACK 은 검증 결과 본 후 수동으로 실행
-- 자동 COMMIT 하지 않음 (안전 장치)


-- =============================================================================
-- 섹션 3: 검증 (트랜잭션 안에서 SELECT - COMMIT 전 분포 확인용)
-- =============================================================================

-- 최종 분포
SELECT
    IFNULL(product_type, 'NULL') AS type,
    COUNT(*) AS cnt
FROM products
GROUP BY product_type
ORDER BY cnt DESC;

-- glb_url 가진 것 중 KEYBOARD 가 아닌 게 있는지 (있으면 안 됨)
SELECT 'glb_url + non-KEYBOARD' AS check_name, COUNT(*) AS should_be_zero
FROM products
WHERE glb_url IS NOT NULL AND product_type != 'KEYBOARD';

-- UNCLASSIFIED 로 남은 것 샘플 10개 (어떤 타입이 더 필요한지 단서)
SELECT id, LEFT(name, 80) AS name_preview
FROM products
WHERE product_type = 'UNCLASSIFIED'
ORDER BY id
LIMIT 10;


-- =============================================================================
-- 결정: COMMIT 또는 ROLLBACK
-- =============================================================================
-- 검증 결과가 만족스러우면:    COMMIT;
-- 다시 시작하고 싶으면:        ROLLBACK;