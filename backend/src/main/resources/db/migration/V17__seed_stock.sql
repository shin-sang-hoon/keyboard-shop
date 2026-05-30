-- V17__seed_stock.sql
-- P1 (2026-05-28) — 재고/품절 (B-1 방식) 시연용 stock 시드.
--
-- 배경:
--   stock 컬럼은 Product 엔티티에 이미 존재하나, 222 ACTIVE / 2633 INACTIVE
--   전부 stock = NULL 상태였음 (크롤러가 재고 정보를 적재하지 않음).
--   품절 필터/배지/구매버튼 비활성을 시연하려면 실제 stock 값이 필요.
--
-- 방침 (B-1 — 품절은 stock 으로만 판정, status 는 안 건드림):
--   1) ACTIVE 상품 전체에 양수 재고 부여 (id 기반 의사난수, 5~51개 범위 → 0 안 나옴).
--   2) 그중 일부(id % 23 = 0)만 품절(stock=0)로 설정 → 품절 시연 대상 확보.
--   3) INACTIVE 는 건드리지 않음 (숨김 상품은 재고 개념 불필요, NULL 유지).
--
-- 멱등성:
--   - 재실행해도 동일 결과 (id 기반 결정적 계산). WHERE status='ACTIVE' 고정.
--   - 한글 없는 순수 숫자 UPDATE → Mac docker exec 인코딩 안전.
--
-- 실행 (Mac):
--   docker cp V17__seed_stock.sql keyboard_mysql:/tmp/V17.sql
--   docker exec keyboard_mysql mysql -uroot -proot1234 \
--     --default-character-set=utf8mb4 -e "USE keyboard_db; SOURCE /tmp/V17.sql;"

-- (1) ACTIVE 전체에 양수 재고 (5 ~ 51개). id 기반 결정적.
UPDATE products
   SET stock = (id % 47) + 5
 WHERE status = 'ACTIVE';

-- (2) 품절 시연 대상: id 가 23 의 배수인 ACTIVE 상품만 stock = 0.
--     222 개 중 대략 9~10 개가 품절로 표시됨.
UPDATE products
   SET stock = 0
 WHERE status = 'ACTIVE'
   AND id % 23 = 0;

-- ─── 검증 쿼리 (실행 후 수동 확인용, 주석 처리) ───────────────────
-- SELECT
--   SUM(CASE WHEN stock IS NULL THEN 1 ELSE 0 END) AS stock_null,
--   SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END)     AS stock_zero,
--   SUM(CASE WHEN stock > 0 THEN 1 ELSE 0 END)     AS stock_positive,
--   COUNT(*) AS total
-- FROM products WHERE status = 'ACTIVE';
-- 기대: stock_null=0, stock_zero≈9~10, stock_positive≈212~213, total=222
