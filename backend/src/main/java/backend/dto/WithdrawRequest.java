package backend.dto;

/**
 * 회원 탈퇴 요청 DTO.
 *
 * - password: LOCAL 유저 재인증용. KAKAO 유저는 비밀번호가 없어 null 허용
 *   (서비스단에서 provider 로 분기 — KAKAO 는 password 무시).
 * - reason: 탈퇴 사유 (선택). 현재는 로그에만 남김. 향후 통계/분석 활용 여지.
 *
 * 탈퇴는 본인 토큰(SecurityContext)으로만 가능 → email 은 받지 않음
 * (요청 바디의 email 을 신뢰하면 타인 계정 탈퇴 위험).
 */
public record WithdrawRequest(String password, String reason) {}
