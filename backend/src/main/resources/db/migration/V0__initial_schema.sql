-- ============================================================================
-- V0__initial_schema.sql
-- 5-B 인증/회원 마이그레이션 정석화 작업의 부트스트랩 SQL
-- ============================================================================
--
-- 배경:
--   학습 단계에서 ddl-auto=update 로 엔티티가 추가될 때마다 DB 스키마가
--   자동 생성되어 왔음. 단일 진실 공급원이 없어서 새 PC (Mac 등) 에서
--   깨끗한 DB로 V1~V4 만 적용하면 부팅 자체가 불가능한 문제 발견.
--
--   이 V0 파일은 학원 PC 의 현재 스키마 (mysqldump --no-data) 를 베이스로
--   V4가 만든 변경분 (provider/provider_id 컬럼 + idx_user_provider 인덱스
--   + password nullable) 만 제거하여 "V4 적용 직전" 상태로 되돌린 것.
--
-- 적용 순서:
--   V0 (이 파일) → V1 (product_type 분류) → V2 (product_images 백필)
--                → V3 (swagkey INACTIVE) → V4 (user provider/카카오 대비)
--
-- 면접 자산:
--   - ddl-auto=update 와 명시적 마이그레이션의 충돌을 인지하고
--     운영 패턴인 ddl-auto=validate + 마이그레이션 SQL 단일 진실 공급원으로 전환
--   - 외래키(FK) 의존성 그래프를 분석해 CREATE 순서를 재배치
--     (mysqldump 는 알파벳 순으로 출력하므로 그대로는 FK 에러 발생)
--   - utf8mb4_0900_ai_ci 정렬 (MySQL 8.0 default) 명시
--
-- 환경:
--   - MySQL 8.0+
--   - utf8mb4 charset 필수
--   - docker exec --default-character-set=utf8mb4 로 적용 권장
-- ============================================================================

SET FOREIGN_KEY_CHECKS=0;
SET NAMES utf8mb4;


-- ============================================================================
-- 의존성 없는 루트 테이블 먼저
-- ============================================================================

CREATE TABLE IF NOT EXISTS `users` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('ADMIN','USER') NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK6dotkott2kjsp8vw4d0m25fb7` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `brands` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `logo_url` varchar(255) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `name_en` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKoce3937d2f4mpfqrycbr0l93m` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `categories` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `slug` varchar(255) NOT NULL,
  `parent_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKoul14ho7bctbefv8jywp5v3i2` (`slug`),
  KEY `FKsaok720gsu4u2wrgbk10b5n8d` (`parent_id`),
  CONSTRAINT `FKsaok720gsu4u2wrgbk10b5n8d` FOREIGN KEY (`parent_id`) REFERENCES `categories` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `tags` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `color` varchar(255) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKt48xdq560gs3gap9g7jg36kgc` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `crawl_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `crawled_at` datetime(6) DEFAULT NULL,
  `items_crawled` int DEFAULT NULL,
  `site_name` varchar(255) NOT NULL,
  `site_url` varchar(255) NOT NULL,
  `status` enum('FAILED','PARTIAL','SUCCESS') NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `filter_groups` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `display_order` int DEFAULT NULL,
  `name` varchar(50) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- ============================================================================
-- 1차 의존 (브랜드/카테고리 → 상품, 사용자 → 주문)
-- ============================================================================

CREATE TABLE IF NOT EXISTS `products` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `connection_type` varchar(255) DEFAULT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `gb_status` varchar(255) DEFAULT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  `layout` varchar(255) DEFAULT NULL,
  `mounting_type` varchar(255) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `price` int DEFAULT NULL,
  `source_id` varchar(255) DEFAULT NULL,
  `status` enum('ACTIVE','INACTIVE','SOLD_OUT') DEFAULT NULL,
  `stock` int DEFAULT NULL,
  `switch_name` varchar(255) DEFAULT NULL,
  `switch_type` varchar(255) DEFAULT NULL,
  `brand_id` bigint DEFAULT NULL,
  `category_id` bigint DEFAULT NULL,
  `glb_url` varchar(255) DEFAULT NULL,
  `product_type` enum('ACCESSORY','KEYBOARD','MOUSE','NOISE','SWITCH_PART','UNCLASSIFIED') DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKt9vjai7rvvp17dps63ibb1cqx` (`source_id`),
  KEY `FKa3a4mpsfdf4d2y6r8ra3sc8mv` (`brand_id`),
  KEY `FKog2rp4qthbtt2lfyhfo32lsw9` (`category_id`),
  CONSTRAINT `FKa3a4mpsfdf4d2y6r8ra3sc8mv` FOREIGN KEY (`brand_id`) REFERENCES `brands` (`id`),
  CONSTRAINT `FKog2rp4qthbtt2lfyhfo32lsw9` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `orders` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `status` enum('CANCELLED','DELIVERED','PAID','PENDING','SHIPPING') NOT NULL,
  `total_price` int NOT NULL,
  `user_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK32ql8ubntj5uh44ph9659tiih` (`user_id`),
  CONSTRAINT `FK32ql8ubntj5uh44ph9659tiih` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `category` varchar(255) NOT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `detail` text,
  `event_type` varchar(255) NOT NULL,
  `target_id` varchar(255) DEFAULT NULL,
  `admin_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FKipd9i0r8h4lyhkehn7nm5qkc0` (`admin_id`),
  CONSTRAINT `FKipd9i0r8h4lyhkehn7nm5qkc0` FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `filter_options` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `display_order` int DEFAULT NULL,
  `name` varchar(50) NOT NULL,
  `value` varchar(50) DEFAULT NULL,
  `filter_group_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKby8pgchl8d8y6mgb4tcjdsk9f` (`filter_group_id`),
  CONSTRAINT `FKby8pgchl8d8y6mgb4tcjdsk9f` FOREIGN KEY (`filter_group_id`) REFERENCES `filter_groups` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- ============================================================================
-- 2차 의존 (products + users → 주문/리뷰/QnA/좋아요/찜/이미지/태그/빌드)
-- ============================================================================

CREATE TABLE IF NOT EXISTS `order_items` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `price` int NOT NULL,
  `quantity` int NOT NULL,
  `order_id` bigint DEFAULT NULL,
  `product_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FKbioxgbv59vetrxe0ejfubep1w` (`order_id`),
  KEY `FKocimc7dtr037rh4ls4l95nlfi` (`product_id`),
  CONSTRAINT `FKbioxgbv59vetrxe0ejfubep1w` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`),
  CONSTRAINT `FKocimc7dtr037rh4ls4l95nlfi` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `product_images` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `display_order` int NOT NULL,
  `image_type` enum('DETAIL','GALLERY','THUMBNAIL') NOT NULL,
  `image_url` varchar(500) NOT NULL,
  `product_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_product_image_order` (`product_id`,`display_order`),
  CONSTRAINT `FKqnq71xsohugpqwf3c9gxmsuy` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `product_likes` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `product_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_product_like_user_product` (`user_id`,`product_id`),
  KEY `idx_product_like_product` (`product_id`),
  KEY `idx_product_like_user` (`user_id`),
  CONSTRAINT `FK795q9hiytbh68mn8om6hmxpoa` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `FK8cbn21ikwcvtgr8lkaspdhgpo` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `wishlists` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `product_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_wishlist_user_product` (`user_id`,`product_id`),
  KEY `idx_wishlist_user` (`user_id`),
  KEY `idx_wishlist_product` (`product_id`),
  CONSTRAINT `FK330pyw2el06fn5g28ypyljt16` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `FKl7ao98u2bm8nijc1rv4jobcrx` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `qna` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `answer_content` text,
  `answered_at` datetime(6) DEFAULT NULL,
  `content` text NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `is_secret` bit(1) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `answered_by` bigint DEFAULT NULL,
  `product_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_qna_product` (`product_id`),
  KEY `idx_qna_user` (`user_id`),
  KEY `idx_qna_answered_at` (`answered_at`),
  KEY `FKq35xlge494l4qdbib53ka2glg` (`answered_by`),
  CONSTRAINT `FK5wdo2mwiedk3g62owqrwopq8` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `FK90r3rkluxrf6bknnw579991k9` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `FKq35xlge494l4qdbib53ka2glg` FOREIGN KEY (`answered_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `product_tags` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `product_id` bigint NOT NULL,
  `tag_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FK5rk6s19k3risy7q7wqdr41uss` (`product_id`),
  KEY `FKpur2885qb9ae6fiquu77tcv1o` (`tag_id`),
  CONSTRAINT `FK5rk6s19k3risy7q7wqdr41uss` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `FKpur2885qb9ae6fiquu77tcv1o` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `custom_builds` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `build_config` json DEFAULT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `product_id` bigint DEFAULT NULL,
  `user_id` bigint DEFAULT NULL,
  `case_color` varchar(20) DEFAULT NULL,
  `keycap_color` varchar(20) DEFAULT NULL,
  `layout` varchar(20) DEFAULT NULL,
  `switch_type` varchar(20) DEFAULT NULL,
  `total_price` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FKn7e0grtyqnmcm1poykwebi0mb` (`product_id`),
  KEY `FKq7kcky3y4hin8jwfs6fohskw8` (`user_id`),
  CONSTRAINT `FKn7e0grtyqnmcm1poykwebi0mb` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `FKq7kcky3y4hin8jwfs6fohskw8` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `auctions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `item_condition` enum('EXCELLENT','FAIR','GOOD','NEW') NOT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `current_price` int NOT NULL,
  `description` text,
  `end_at` datetime(6) NOT NULL,
  `item_images` varchar(255) DEFAULT NULL,
  `start_price` int NOT NULL,
  `status` enum('ACTIVE','CANCELLED','ENDED') NOT NULL,
  `product_id` bigint DEFAULT NULL,
  `seller_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK5o1kpvuu8n7sgxm5cpb6fvbxo` (`product_id`),
  KEY `FKlu950hyc1m3wi2km1mlrcttw1` (`seller_id`),
  CONSTRAINT `FK5o1kpvuu8n7sgxm5cpb6fvbxo` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `FKlu950hyc1m3wi2km1mlrcttw1` FOREIGN KEY (`seller_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- ============================================================================
-- 3차 의존 (order_items, auctions → reviews, auction_bids)
-- ============================================================================

CREATE TABLE IF NOT EXISTS `reviews` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `content` text,
  `created_at` datetime(6) NOT NULL,
  `rating` double NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `order_item_id` bigint NOT NULL,
  `product_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_review_order_item` (`order_item_id`),
  KEY `idx_review_product` (`product_id`),
  KEY `idx_review_user` (`user_id`),
  CONSTRAINT `FK2x2x74lnliqmt91bc1w95ll8n` FOREIGN KEY (`order_item_id`) REFERENCES `order_items` (`id`),
  CONSTRAINT `FKcgy7qjc1r99dp117y9en6lxye` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `FKpl51cejpw4gy5swfar8br9ngi` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `auction_bids` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `bid_price` int NOT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `auction_id` bigint DEFAULT NULL,
  `user_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FKk65xkkbe2o37a0w7eork92pvp` (`auction_id`),
  KEY `FKi8ij4ikb13183741gqi183ebx` (`user_id`),
  CONSTRAINT `FKi8ij4ikb13183741gqi183ebx` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `FKk65xkkbe2o37a0w7eork92pvp` FOREIGN KEY (`auction_id`) REFERENCES `auctions` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


SET FOREIGN_KEY_CHECKS=1;

-- ============================================================================
-- 검증 (수동, 주석)
-- ============================================================================
-- SHOW TABLES;       -- 21 개 테이블 모두 보여야 함
-- DESC users;        -- provider, provider_id 없음 / password NOT NULL
-- DESC products;     -- product_type, glb_url, status 모두 있음
