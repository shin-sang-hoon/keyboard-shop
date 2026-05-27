-- ============================================================
-- V16__seed_demo_order.sql
-- UX P0 (5/28) 검증용 시연 시드: 관리자 계정에 DELIVERED 주문 1건 주입
-- ============================================================
--
-- 배경:
--   리뷰 작성 모달 검색식 전환 후, 관리자(popeeplus87@naver.com) 계정으로
--   끝까지 검증하려면 본인 주문 + DELIVERED + product 103 조합이 필요함.
--   현재 ADMIN 주문 이력 0건이라 reviewable 후보가 0개로 나오는 게 정상.
--   → 시연용으로 1건 주입.
--
-- 안전 장치:
--   1) idempotent — INSERT ... SELECT ... WHERE NOT EXISTS 로 중복 실행 시 no-op
--   2) user_id 하드코딩 X — email lookup
--   3) product 존재 검증 후 진행
--
-- 실행 방법 (Mac, docker exec):
--   cat > /tmp/v16.sql << 'EOF'
--   (이 파일 내용 복붙)
--   EOF
--   docker cp /tmp/v16.sql keyboard_mysql:/tmp/v16.sql
--   docker exec keyboard_mysql mysql -uroot -proot1234 \
--     --default-character-set=utf8mb4 -e "USE keyboard_db; source /tmp/v16.sql"
--
-- DRY-RUN 패턴:
--   처음엔 아래 'COMMIT;' 를 'ROLLBACK;' 로 바꿔 실행 → 결과 확인 후
--   COMMIT 으로 재실행. 또는 START TRANSACTION 없이 SELECT 부분만 먼저 돌려도 됨.
-- ============================================================

USE keyboard_db;

-- ── 사전 검증: 대상 데이터 존재 확인 ──
SELECT 'STEP 1 · 관리자 user_id 확인' AS step;
SELECT id, email, name, role FROM users WHERE email = 'popeeplus87@naver.com';

SELECT 'STEP 2 · 시드 대상 product 확인 (product_id=103)' AS step;
SELECT id, name, price, status FROM products WHERE id = 103;

SELECT 'STEP 3 · 기존 시드 주문 존재 여부' AS step;
SELECT o.id AS order_id, o.status, o.total_price, o.created_at
  FROM orders o
  JOIN users u ON u.id = o.user_id
 WHERE u.email = 'popeeplus87@naver.com'
   AND o.status = 'DELIVERED';

-- ── 시드 주입 (트랜잭션 격리) ──
START TRANSACTION;

-- (A) orders 1행 — 이미 동일 조건 시드가 있으면 skip
INSERT INTO orders (user_id, total_price, status, created_at)
SELECT u.id, p.price, 'DELIVERED', NOW()
  FROM users u
  CROSS JOIN products p
 WHERE u.email = 'popeeplus87@naver.com'
   AND p.id = 103
   AND NOT EXISTS (
       SELECT 1 FROM orders o2
        WHERE o2.user_id = u.id
          AND o2.status = 'DELIVERED'
          AND o2.total_price = p.price
   );

-- (B) order_items 1행 — 위에서 만든 orders 의 가장 최근 DELIVERED 주문에 연결
INSERT INTO order_items (order_id, product_id, quantity, price)
SELECT o.id, 103, 1, p.price
  FROM orders o
  JOIN users u ON u.id = o.user_id
  JOIN products p ON p.id = 103
 WHERE u.email = 'popeeplus87@naver.com'
   AND o.status = 'DELIVERED'
   AND NOT EXISTS (
       SELECT 1 FROM order_items oi
        WHERE oi.order_id = o.id
          AND oi.product_id = 103
   )
 ORDER BY o.id DESC
 LIMIT 1;

-- ── 사후 검증 ──
SELECT 'STEP 4 · 시드 후 주문/주문상품 확인' AS step;
SELECT o.id AS order_id, o.status, o.total_price, o.created_at,
       oi.id AS order_item_id, oi.product_id, oi.quantity, oi.price
  FROM orders o
  JOIN users u ON u.id = o.user_id
  LEFT JOIN order_items oi ON oi.order_id = o.id
 WHERE u.email = 'popeeplus87@naver.com'
   AND o.status = 'DELIVERED'
 ORDER BY o.id DESC
 LIMIT 5;

SELECT 'STEP 5 · 이 order_item 에 리뷰 작성 여부 (NULL = reviewable)' AS step;
SELECT oi.id AS order_item_id, r.id AS review_id
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  JOIN users u ON u.id = o.user_id
  LEFT JOIN reviews r ON r.order_item_id = oi.id
 WHERE u.email = 'popeeplus87@naver.com'
   AND o.status = 'DELIVERED'
   AND oi.product_id = 103
 ORDER BY oi.id DESC
 LIMIT 5;

-- ────────────────────────────────────────────────
-- 검증 후 OK 면 아래를 COMMIT 으로,
-- 결과가 이상하면 ROLLBACK 으로 바꿔 재실행
-- (현재 기본은 COMMIT)
-- ────────────────────────────────────────────────
COMMIT;
-- ROLLBACK;
