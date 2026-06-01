-- =====================================================================
-- V25: cart_items 에 3D 빌더 커스텀 옵션 + 옵션 반영 단가(unit_price) 추가
-- =====================================================================
-- 배경: 빌더에서 담은 커스텀 키보드의 옵션 가격(스위치/키캡)이 장바구니에
--       반영되지 않던 문제 해결. 클라는 옵션 ID만 보내고 서버가 unit_price 를
--       재계산해 저장한다(가격 위변조 방어).
--
-- ddl-auto=validate / Flyway 미사용 → 수동 실행:
--   docker cp V25__cart_item_builder_options.sql keyboard_mysql:/tmp/v25.sql
--   docker exec keyboard_mysql mysql -uroot -proot1234 --default-character-set=utf8mb4 -e "USE keyboard_db; source /tmp/v25.sql"
--
-- ※ 백엔드 엔티티에서 @UniqueConstraint 를 제거했으므로, 이 SQL 을 먼저 실행한 뒤
--   백엔드를 재시작해야 validate 가 통과한다.
-- =====================================================================

-- 1) 옵션 + 단가 컬럼 추가 (일반 상품은 전부 NULL → 기존 동작 그대로 유지)
ALTER TABLE cart_items
  ADD COLUMN layout       VARCHAR(20) NULL,
  ADD COLUMN switch_type  VARCHAR(20) NULL,
  ADD COLUMN keycap_color VARCHAR(20) NULL,
  ADD COLUMN case_color   VARCHAR(20) NULL,
  ADD COLUMN unit_price   INT NULL;

-- 2) 같은 상품을 다른 옵션으로 담을 수 있도록 UNIQUE(cart_id, product_id) 제거
--    (앱 레벨 Cart.addItem 이 "같은 product + 같은 옵션 조합"만 합산)
--
--    ⚠ 아래 인덱스 이름(uk_cart_item_cart_product)이 실제 DB 와 다를 수 있으니,
--      먼저 다음으로 확인하세요:
--        SHOW INDEX FROM cart_items WHERE Non_unique = 0;
--      Key_name 이 다르면 아래 이름을 교체해서 실행하세요.
ALTER TABLE cart_items DROP INDEX uk_cart_item_cart_product;
