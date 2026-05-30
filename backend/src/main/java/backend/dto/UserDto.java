package backend.dto;

import backend.entity.User;

import java.time.LocalDateTime;

/**
 * 회원 관리 DTO (Phase 7-G 라운드 4 -> 7-H 회원 관리 강화 -> 회원정보 수정 V23).
 *
 * 중첩 구조:
 *   - UserDto.ListItem          : 회원 목록 응답 1행 (관리자 목록)
 *   - UserDto.Detail            : 회원 상세 (관리자 수정 화면 — 프로필+메모+접속이력 포함)
 *   - UserDto.Me                : 내 정보 (사용자단 마이페이지 — adminMemo 등 비노출)
 *   - UserDto.RoleUpdateRequest : role 변경 요청 body
 *   - UserDto.SuspendRequest    : 회원 정지 요청 body (V22)
 *   - UserDto.ProfileUpdateRequest      : 사용자단 프로필 수정 (닉네임/휴대폰/주소)
 *   - UserDto.PasswordChangeRequest     : 사용자단 비밀번호 변경 (현재→새)
 *   - UserDto.AdminUserUpdateRequest    : 관리자단 회원 수정 (이름+프로필+권한+메모)
 *
 * 보안:
 *   - password (BCrypt 해시) 는 어떤 응답에도 포함하지 않는다.
 *   - providerId (카카오 회원번호) 도 노출 불필요 -> 제외.
 *   - adminMemo / lastLoginAt 는 관리자 응답(Detail)에만. 사용자단 Me 에는 절대 비노출.
 */
public final class UserDto {

    private UserDto() {}

    /**
     * 회원 목록 1행. AdminUserService 가 User 엔티티 -> ListItem 변환.
     *
     * 7-H 추가: status / suspendedAt / suspendReason — 관리자 화면에서
     *   정상/정지/탈퇴 구별 + 정지 사유·시각 표시.
     * V23 추가: nickname — 목록에서도 닉네임 표시(이름 옆).
     */
    public record ListItem(
            Long id,
            String email,
            String name,
            String nickname,        // V23 — 닉네임 (없으면 null)
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
                    u.getNickname(),
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
     * 회원 상세 (V23) — 관리자 회원 수정 화면용.
     * 프로필 전체 + 관리자 메모 + 가입일/최종접속(읽기전용 노출) 포함.
     * 비밀번호는 절대 포함하지 않음. providerId 도 제외.
     */
    public record Detail(
            Long id,
            String email,
            String name,
            String nickname,
            String phone,
            String zipcode,
            String address,
            String addressDetail,
            String role,            // USER / ADMIN
            String provider,        // LOCAL / KAKAO
            String status,          // ACTIVE / SUSPENDED / WITHDRAWN
            String adminMemo,       // 관리자 메모 (관리자 응답에만)
            LocalDateTime createdAt,
            LocalDateTime lastLoginAt,
            LocalDateTime withdrawnAt,
            LocalDateTime suspendedAt,
            String suspendReason
    ) {
        public static Detail from(User u) {
            return new Detail(
                    u.getId(),
                    u.getEmail(),
                    u.getName(),
                    u.getNickname(),
                    u.getPhone(),
                    u.getZipcode(),
                    u.getAddress(),
                    u.getAddressDetail(),
                    u.getRole().name(),
                    u.getProvider().name(),
                    u.getStatus().name(),
                    u.getAdminMemo(),
                    u.getCreatedAt(),
                    u.getLastLoginAt(),
                    u.getWithdrawnAt(),
                    u.getSuspendedAt(),
                    u.getSuspendReason()
            );
        }
    }

    /**
     * 내 정보 (V23) — 사용자단 마이페이지 회원정보 수정 화면용.
     * 본인이 보고 수정할 수 있는 필드만. adminMemo / lastLoginAt / status 메타는 비노출.
     * provider 는 비밀번호 섹션 노출 분기(LOCAL vs KAKAO)에 필요하므로 포함.
     */
    public record Me(
            Long id,
            String email,
            String name,
            String nickname,
            String phone,
            String zipcode,
            String address,
            String addressDetail,
            String provider,        // LOCAL / KAKAO (비번 섹션 분기용)
            String displayName      // "이름(닉네임)" 또는 "이름"
    ) {
        public static Me from(User u) {
            return new Me(
                    u.getId(),
                    u.getEmail(),
                    u.getName(),
                    u.getNickname(),
                    u.getPhone(),
                    u.getZipcode(),
                    u.getAddress(),
                    u.getAddressDetail(),
                    u.getProvider().name(),
                    u.displayName()
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

    // ------------------------------------------------------------------------
    // 회원정보 수정 (V23)
    // ------------------------------------------------------------------------

    /**
     * 사용자단 프로필 수정 요청 (V23).
     * PATCH /api/users/me
     * 이름/이메일/권한은 변경 불가 — 닉네임/휴대폰/주소만. 전부 선택(빈값 허용=미설정).
     */
    public record ProfileUpdateRequest(
            String nickname,
            String phone,
            String zipcode,
            String address,
            String addressDetail
    ) {
    }

    /**
     * 사용자단 비밀번호 변경 요청 (V23).
     * PATCH /api/users/me/password   { "currentPassword": "...", "newPassword": "..." }
     * LOCAL 계정만 가능 — 현재 비밀번호 검증 후 새 비밀번호로 교체.
     */
    public record PasswordChangeRequest(
            String currentPassword,
            String newPassword
    ) {
    }

    /**
     * 관리자단 회원 수정 요청 (V23).
     * PATCH /api/admin/users/{id}
     * 관리자는 이름/프로필/권한/상태가 아닌 정보 + 관리자 메모를 수정.
     * (상태(정지/해제)는 기존 전용 엔드포인트 /suspend·/unsuspend 사용,
     *  권한(role)도 기존 /role 사용 — 여기선 이름/닉/휴대폰/주소/메모만 다룬다.)
     *  newPassword 가 있으면 관리자 강제 재설정 (현재 비번 불요, LOCAL 만).
     */
    public record AdminUserUpdateRequest(
            String name,
            String nickname,
            String phone,
            String zipcode,
            String address,
            String addressDetail,
            String adminMemo,
            String newPassword      // 선택 — 있으면 관리자 강제 비번 재설정 (LOCAL만)
    ) {
    }
}
