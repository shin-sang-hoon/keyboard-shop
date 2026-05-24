package backend.dto;

import backend.entity.User;

import java.time.LocalDateTime;

/**
 * 회원 관리 DTO (Phase 7-G 라운드 4).
 *
 * 중첩 구조:
 *   - UserDto.ListItem      : 회원 목록 응답 1행
 *   - UserDto.RoleUpdateRequest : role 변경 요청 body
 *
 * 보안: password (BCrypt 해시) 는 어떤 응답에도 포함하지 않는다.
 *       providerId (카카오 회원번호) 도 노출 불필요 → 제외.
 */
public final class UserDto {

    private UserDto() {}

    /**
     * 회원 목록 1행. AdminUserService 가 User 엔티티 → ListItem 변환.
     */
    public record ListItem(
            Long id,
            String email,
            String name,
            String role,        // USER / ADMIN
            String provider,    // LOCAL / KAKAO
            LocalDateTime createdAt
    ) {
        public static ListItem from(User u) {
            return new ListItem(
                    u.getId(),
                    u.getEmail(),
                    u.getName(),
                    u.getRole().name(),
                    u.getProvider().name(),
                    u.getCreatedAt()
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
}
