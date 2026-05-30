-- =====================================================================
-- V21: 비밀번호 재설정 토큰 (5/29)
-- =====================================================================
-- 설계:
--   - 비밀번호 찾기 요청 시 1회용 토큰 생성 → 메일로 재설정 링크 발송.
--   - token: UUID 등 추측 불가 문자열. UNIQUE.
--   - expires_at: 만료 시각(기본 30분). 지나면 무효.
--   - used_at: 1회용. 사용 시 시각 기록 → 재사용 차단(used_at IS NOT NULL 이면 거부).
--   - user_id: FK(users) ON DELETE CASCADE. (탈퇴는 soft delete라 실삭제 드묾, 안전망)
--   - 한 유저가 여러 번 요청 가능(과거 토큰은 만료/미사용으로 남되, 검증 시 최신/유효만 통과).
--
-- idempotent: CREATE TABLE IF NOT EXISTS.
-- 적용: docker cp + docker exec mysql < /tmp/x.sql 패턴.
-- =====================================================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    user_id     BIGINT       NOT NULL,
    token       VARCHAR(100) NOT NULL,
    expires_at  DATETIME     NOT NULL,
    used_at     DATETIME     NULL,
    created_at  DATETIME     NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_prt_token UNIQUE (token),
    CONSTRAINT fk_prt_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE,
    KEY idx_prt_user (user_id),
    KEY idx_prt_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
