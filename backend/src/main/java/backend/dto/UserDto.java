package backend.dto;

import backend.entity.User;

import java.time.LocalDateTime;

/**
 * 회원 관리 DTO (Phase 7-G 라운드 4 -> 7-H 회원 관리 강화).
 *
 * 중첩 구조:
 *   - UserDto.ListItem          : 회원 목록 응답 1행
 *   - UserDto.RoleUpdateRequest : role 변경 요청 body
 *   - UserDto.SuspendRequest    : 회원 정지 요청 body (V22)
 *
 * 보안: password (BCrypt 해시) 는 어떤 응답에도 포함하지 않는다.
 *       providerId (카카오 회원번호) 도 노출 불필요 -> 제외.
 */
public final class UserDto {

    private UserDto() {}

    /**
     * 회원 목록 1행. AdminUserService 가 User 엔티티 -> ListItem 변환.
     *
     * 7-H 추가: status / suspendedAt / suspendReason — 관리자 화면에서
     *   정상/정지/탈퇴 구별 + 정지 사유·시각 표시.
     */
    public record ListItem(
            Long id,
            String email,
            String name,
            String role,            // USER / ADMIN
            String provider,        // LOCAL / KAKAO
            String status,          // ACTIVE / SUSPENDED / WITHDRAWN
            LocalDateTime createdAt,
            LocalDateTime withdrawnAt,   // 탈퇴 시각 (WITHDRAWN 아니면 null)
            LocalDateTime suspendedAt,   // 정지 시각 (SUSPENDED 아니면 null)
            String suspendReason         // 정지 사유 (SUSPENDED 아니면 null)
    ) {
        public static ListItem from(User u) {
            return new ListItem(
                    u.getId(),
                    u.getEmail(),
                    u.getName(),
                    u.getRole().name(),
                    u.getProvider().name(),
                    u.getStatus().name(),
                    u.getCreatedAt(),
                    u.getWithdrawnAt(),
                    u.getSuspendedAt(),
                    u.getSuspendReason()
            );
        }
    }

    /**
     * role 변경 요청 body.
     * PATCH /api/admin/users/{id}/role  { "role": "ADMIN" }
     */
    public record RoleUpdateRequest(
            String role         // USER / ADMIN
    ) {
    }

    /**
     * 회원 정지 요청 body (V22).
     * PATCH /api/admin/users/{id}/suspend  { "reason": "욕설/광고성 리뷰 반복" }
     * reason 은 선택 — null/빈 문자열이면 사유 미입력 정지.
     */
    public record SuspendRequest(
            String reason       // 정지 사유 (선택)
    ) {
    }
}
