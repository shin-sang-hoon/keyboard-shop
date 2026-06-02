-- =====================================================================
-- V28: chatbot_unknown_log — 챗봇 미답변/저신뢰 질의 로그
-- =====================================================================
-- RAG 검색 실패(매칭 0건)·LLM 폴백 등 "답 못한 질문"을 기록.
-- 면접 포인트: 미답변 로그 분석 → keyboard_qa.json 보강 → 커버리지 개선 선순환.
--
-- ddl-auto=validate / Flyway 미사용 → 수동 실행:
--   docker exec keyboard_mysql mysql -uroot -proot1234 --default-character-set=utf8mb4 \
--     -e "USE keyboard_db; CREATE TABLE IF NOT EXISTS chatbot_unknown_log (id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY, question VARCHAR(1000) NOT NULL, reason VARCHAR(40) NOT NULL, top_score INT NOT NULL DEFAULT 0, created_at DATETIME(6) NOT NULL, INDEX idx_unknown_created (created_at), INDEX idx_unknown_reason (reason)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;"
-- =====================================================================

CREATE TABLE IF NOT EXISTS chatbot_unknown_log (
    id         BIGINT        NOT NULL AUTO_INCREMENT,
    question   VARCHAR(1000) NOT NULL,
    reason     VARCHAR(40)   NOT NULL,
    top_score  INT           NOT NULL DEFAULT 0,
    created_at DATETIME(6)   NOT NULL,
    PRIMARY KEY (id),
    INDEX idx_unknown_created (created_at),
    INDEX idx_unknown_reason (reason)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
