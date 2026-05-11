package backend.entity;

/**
 * 감사 로그 이벤트 타입 — 어떤 종류의 액션인지.
 *
 * 카테고리(AuditCategory)와 직교 분류:
 *   예) (PRODUCT, UPDATE) = 상품 정보 수정
 *       (USER, BLOCK) = 회원 차단
 *       (CRAWLER, EXECUTE) = 크롤러 실행
 */
public enum AuditEventType {
    CREATE,     // 신규 생성
    UPDATE,     // 정보 수정
    DELETE,     // 삭제
    BLOCK,      // 차단/비활성화
    UNBLOCK,    // 차단 해제/활성화
    EXECUTE,    // 실행 (크롤러 수동 트리거 등)
    VIEW        // 민감 정보 조회 (비밀글, 회원 상세 등)
}
