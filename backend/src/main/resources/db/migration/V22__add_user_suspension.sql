-- =====================================================================
-- V22: 회원 제재(정지) — suspended_at + suspend_reason
-- 7-H 회원 관리 강화 (관리자 회원 상태 표시 + 불량 유저 정지/해제)
-- =====================================================================
--
-- 배경:
--   - status 는 V20 에서 이미 VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' + idx_user_status.
--     ACTIVE / WITHDRAWN 2-state 였던 것을 SUSPENDED 추가하여 3-state 로 확장.
--     enum 값 추가는 애플리케이션 레벨(@Enumerated STRING)이라 DDL 변경 불필요.
--   - 정지 메타데이터는 회원 탈퇴(withdrawn_at)와 대칭으로 설계:
--       suspended_at  : 정지 시각 (해제 시 NULL 복귀)
--       suspend_reason: 정지 사유 (해제 시 NULL 복귀) — 제재 이력 추적
--
-- 멱등 안전:
--   - 컬럼이 이미 있으면 ALTER 가 에러나므로, 최초 1회만 실행.
--   - 재실행 방지: 적용 전 DESC users 로 suspend 컬럼 부재 확인.
-- =====================================================================

ALTER TABLE users
    ADD COLUMN suspended_at   DATETIME     NULL COMMENT '정지 시각 (해제 시 NULL)'      AFTER withdrawn_at,
    ADD COLUMN suspend_reason VARCHAR(255) NULL COMMENT '정지 사유 (해제 시 NULL, 이력)' AFTER suspended_at;
