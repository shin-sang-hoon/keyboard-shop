package backend.dto;

import java.util.List;

/**
 * 비밀번호 찾기/재설정 + 아이디 찾기 DTO (5/29).
 */
public class PasswordResetDto {

    /** 비밀번호 찾기 요청 (이메일 입력 → 재설정 링크 메일 발송). */
    public record ForgotRequest(String email) {}

    /** 비밀번호 재설정 (토큰 + 새 비밀번호). */
    public record ResetRequest(String token, String newPassword) {}

    /** 아이디(이메일) 찾기 요청 (이름 입력). */
    public record FindEmailRequest(String name) {}

    /** 아이디 찾기 응답 (마스킹된 이메일 목록). */
    public record FindEmailResponse(List<String> emails) {}
}
