-- =====================================================================
-- V24__add_review_reply.sql
-- 리뷰 답글(판매자 답변) 도메인 — reviews 테이블에 답글 3컬럼 추가.
--
-- 설계:
--   reply        TEXT      NULL  관리자 답글 본문 (NULL = 미답변)
--   replied_by   BIGINT    NULL  답변한 관리자 FK (users.id) — Q&A.answeredBy 와 동일 패턴
--   replied_at   DATETIME  NULL  답변 시각
--
-- 세 값은 항상 함께 채워지거나 함께 NULL (addReply / removeReply 도메인 메서드가 원자적 관리).
--
-- 1 Review 당 최대 1 답글 → 별도 테이블 분리 없이 1:1 임베드 (QnA.answer_content 와 동일 철학).
--
-- replied_by FK:
--   ON DELETE SET NULL — 답변한 관리자 계정이 삭제돼도 리뷰·답글 본문은 보존,
--   답변자 링크만 끊김 (답글 내용 자체는 운영 이력으로 가치 있음).
--
-- ddl-auto=validate 환경 → 엔티티 매핑과 컬럼이 정확히 일치해야 부팅됨.
-- Flyway 미도입 → Mac 에서 수동 실행:
--   docker exec -i keyboard_mysql mysql -uroot -proot1234 \
--     --default-character-set=utf8mb4 keyboard_db < V24__add_review_reply.sql
-- =====================================================================

ALTER TABLE reviews
    ADD COLUMN reply       TEXT     NULL COMMENT '관리자(판매자) 답글 본문, NULL=미답변' AFTER content,
    ADD COLUMN replied_by  BIGINT   NULL COMMENT '답변한 관리자 FK(users.id)'           AFTER reply,
    ADD COLUMN replied_at  DATETIME NULL COMMENT '답변 시각'                              AFTER replied_by;

-- 답변자 FK 제약 (관리자 계정 삭제 시 링크만 끊고 답글 본문 보존)
ALTER TABLE reviews
    ADD CONSTRAINT fk_review_replied_by
        FOREIGN KEY (replied_by) REFERENCES users (id)
        ON DELETE SET NULL;

-- 마이페이지 "내가 답변한 리뷰" 조회 가속 (replied_by 필터 + replied_at 정렬)
CREATE INDEX idx_review_replied_by ON reviews (replied_by, replied_at);
