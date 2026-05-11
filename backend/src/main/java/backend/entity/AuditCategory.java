package backend.entity;

/**
 * 감사 로그 카테고리 — 관리자가 어떤 도메인 영역에서 액션했는지 분류.
 *
 * 컴파일 타임 안전성을 위해 enum 격상.
 * 새 카테고리가 필요하면 여기 추가 + V_NEXT__ 마이그레이션으로 MySQL ENUM ADD VALUE.
 */
public enum AuditCategory {
    PRODUCT,    // 상품 CRUD, 이미지 관리, ProductType 재분류
    USER,       // 회원 차단/해제, role 변경
    ORDER,      // 주문 수정/취소
    CRAWLER,    // 크롤러 수동 실행, source 관리
    CHATBOT     // Q&A 추가/수정/삭제, 미인식 쿼리 처리
}
