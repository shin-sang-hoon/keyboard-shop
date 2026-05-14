-- V8: swagkey 키캡 카드 이미지 매핑 버그 fix (5/14 새벽)
--
-- 배경:
--   swagkey_crawler.py 의 'Keycaps' 카테고리 (cate_id=23) 가 listing page 셀렉터 broad 하여
--   각 상품 thumbnail 이 아닌 페이지 상단 SW 로고 img (cfe04b2239733.png) 를 잡음.
--   결과: 키캡 93개 카드 이미지가 모두 SW 로고로 표시됨 (메인 ProductList 키캡 탭).
--
-- 발견:
--   - 5/12 commit 9358fb2 가 키보드 카테고리만 fix
--   - product_images (5-H A1 1:N) 의 다중 이미지 (GALLERY) 는 정상 적재됨 → 첫 이미지 활용
--
-- fix:
--   products.image_url ← product_images WHERE display_order=1 AND image_type='GALLERY'

UPDATE products p
INNER JOIN product_images pi
  ON pi.product_id = p.id
  AND pi.display_order = 1
  AND pi.image_type = 'GALLERY'
SET p.image_url = pi.image_url
WHERE p.product_type = 'KEYCAP'
  AND p.status = 'ACTIVE'
  AND p.image_url LIKE '%cfe04b2239733%';

-- 검증:
--   기대: 93 row 업데이트
--   확인 SQL: SELECT COUNT(*) FROM products WHERE product_type='KEYCAP' AND status='ACTIVE' AND image_url LIKE '%cdn-optimized%';
