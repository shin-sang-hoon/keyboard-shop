-- ════════════════════════════════════════════════════════════════
-- V3: swagkey 비키보드 row INACTIVE 처리
-- 
-- 배경:
-- 5-H D2 후속 swagkey crawler 가 6 카테고리 순차 크롤 시도했으나
-- collect_from_listing 셀렉터가 broad 해서 카테고리별 hub_products 가
-- 사이트 글로벌 메뉴를 동일하게 잡음. 결과 377개 적재됐지만 카테고리
-- 분류 의미 없어서 모두 product_type=KEYBOARD 통일했었음.
--
-- 이후 데이터 품질 점검 결과 비키보드 (부품/액세서리) 가 다수 포함됨:
--   - 가격 < 1만원: 119개 (무게추/스테빌철심/체리스냅인 등)
--   - 키보드 키캡 패턴: 31개 (키캡 단품)  
--   - 스테빌라이저 (한글 ㅔ): 32개
--   - 윤활제/데스크패드/케이블/마우스/PCB/하우징/상판 등
--
-- 처리: 비키보드 키워드 매칭되는 263개 → status='INACTIVE'
-- 보존: 진짜 키보드 본체 114개 → status='ACTIVE' 유지
-- 
-- 검증: ACTIVE 샘플 30개 100% 키보드 본체 확인
-- 미래: multi-category 정확 분류는 다음 작업으로 보류 (셀렉터 좁히기)
-- ════════════════════════════════════════════════════════════════

UPDATE products
SET status = 'INACTIVE'
WHERE source_id LIKE 'swagkey_%'
  AND status = 'ACTIVE'
  AND (
    -- 가격 < 1만원 (부품/액세서리/소품)
    price < 10000
    
    -- 윤활제 / 데스크패드 / 케이블
    OR name LIKE '%윤활%' OR name LIKE '%lube%' OR name LIKE '%krytox%'
    OR name LIKE '%데스크패드%' OR name LIKE '%deskpad%' OR name LIKE '%마우스패드%' OR name LIKE '%장패드%' OR name LIKE '%데스크매트%'
    OR ((name LIKE '%케이블%' OR name LIKE '%cable%') AND name NOT LIKE '%키보드%')
    
    -- 스위치/키캡 단품 (키보드 단어 없는 경우)
    OR ((name LIKE '%스위치%' OR name LIKE '%switch%') AND name NOT LIKE '%키보드%' AND name NOT LIKE '%keyboard%')
    OR ((name LIKE '%키캡%' OR name LIKE '%keycap%') AND name NOT LIKE '%키보드%' AND name NOT LIKE '%keyboard%')
    
    -- "키보드 키캡" / "키보드 가방" 패턴 (키보드는 수식어, 본체는 키캡/가방)
    OR name LIKE '%키보드 키캡%' OR name LIKE '%keyboard keycap%'
    OR name LIKE '%키보드 가방%' OR name LIKE '%키보드 케이스%' OR name LIKE '%보호 케이스%' OR name LIKE '%보호케이스%'
    OR name LIKE '%Top case%' OR name LIKE '%top case%'
    
    -- 부품 (스태빌/스테빌/플레이트/PCB/기판/보강판/foam)
    OR name LIKE '%스태빌%' OR name LIKE '%스테빌%' OR name LIKE '%stab%'
    OR name LIKE '%플레이트%' OR name LIKE '%PCB%' OR name LIKE '%기판%' OR name LIKE '%보강판%' OR name LIKE '%foam%' OR name LIKE '%폼%'
    
    -- 마우스 / 넘패드
    OR name LIKE '%마우스%' OR name LIKE '%mouse%'
    OR name LIKE '%numpad%' OR name LIKE '%넘패드%'
    
    -- 일반 부품/소품 키워드
    OR name LIKE '%parts%' OR name LIKE '%Parts%'
    OR name LIKE '%무게추%' OR name LIKE '%철심%'
    OR name LIKE '%빌드 서비스%'
    OR name LIKE '%Add on%' OR name LIKE '%애드온%' OR name LIKE '%add-on%'
    OR name LIKE '%하우징%'
    OR name LIKE '%상판%' OR name LIKE '%하판%'
    OR name LIKE '%트레이%'
    OR name LIKE '%여분%' OR name LIKE '%파츠%' OR name LIKE '%파트%'
  );
