-- =====================================================================
-- V27: chatbot_qa 테이블 — 챗봇 RAG 지식 베이스 (keyboard_qa.json 200개 적재 대상)
-- =====================================================================
-- ChatbotQaImporter(ApplicationRunner)가 기동 시 classpath:data/keyboard_qa.json 을
-- 이 테이블에 적재한다(이미 행이 있으면 skip). keywords 는 콤마조인 1컬럼.
--
-- ddl-auto=validate / Flyway 미사용 → 수동 실행:
--   docker exec keyboard_mysql mysql -uroot -proot1234 --default-character-set=utf8mb4 \
--     -e "USE keyboard_db; CREATE TABLE IF NOT EXISTS chatbot_qa (id VARCHAR(40) NOT NULL PRIMARY KEY, category VARCHAR(20) NOT NULL, question VARCHAR(500) NOT NULL, answer TEXT NOT NULL, keywords VARCHAR(1000) NULL, INDEX idx_chatbot_qa_category (category)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;"
--
-- ※ 이 테이블을 먼저 만든 뒤 백엔드를 재시작해야 validate 통과 + 적재가 실행된다.
-- =====================================================================

CREATE TABLE IF NOT EXISTS chatbot_qa (
    id        VARCHAR(40)   NOT NULL,
    category  VARCHAR(20)   NOT NULL,
    question  VARCHAR(500)  NOT NULL,
    answer    TEXT          NOT NULL,
    keywords  VARCHAR(1000) NULL,
    PRIMARY KEY (id),
    INDEX idx_chatbot_qa_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
