-- =====================================================================
-- V26: order_items 에 3D 빌더 커스텀 옵션 + 단가 스냅샷(unit_price) 추가
-- =====================================================================
-- 배경: cart 와 동일하게, 주문 생성 시 커스텀 키보드의 옵션 가격(스위치/키캡)을
--       주문 내역에 반영. 서버가 BuilderPriceCalculator 로 단가를 재계산해 스냅샷
--       저장(주문 시점 가격 고정 + 위변조 방어). cart_items 와 대칭 구조.
--
-- ddl-auto=validate / Flyway 미사용 → 수동 실행:
--   docker exec keyboard_mysql mysql -uroot -proot1234 --default-character-set=utf8mb4 \
--     -e "USE keyboard_db; ALTER TABLE order_items ADD COLUMN layout VARCHAR(20) NULL, ADD COLUMN switch_type VARCHAR(20) NULL, ADD COLUMN keycap_color VARCHAR(20) NULL, ADD COLUMN case_color VARCHAR(20) NULL, ADD COLUMN unit_price INT NULL;"
--
-- ※ 이 SQL 을 먼저 실행한 뒤 백엔드를 재시작해야 validate 가 통과한다.
-- =====================================================================

ALTER TABLE order_items
  ADD COLUMN layout       VARCHAR(20) NULL,
  ADD COLUMN switch_type  VARCHAR(20) NULL,
  ADD COLUMN keycap_color VARCHAR(20) NULL,
  ADD COLUMN case_color   VARCHAR(20) NULL,
  ADD COLUMN unit_price   INT NULL;
