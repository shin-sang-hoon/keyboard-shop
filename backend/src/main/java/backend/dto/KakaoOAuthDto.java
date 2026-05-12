package backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * 카카오 OAuth API 응답 매핑 DTO 모음.
 *
 * 카카오 응답은 snake_case ("access_token", "kakao_account") 인데
 * 우리 코드는 camelCase 이므로 @JsonProperty 로 매핑.
 *
 * record 사용 이유:
 *  - 응답 DTO는 불변이어야 안전하고, getter/생성자 보일러플레이트 제거.
 *  - Jackson 이 record 의 component 를 직렬화/역직렬화 자동 지원 (Java 14+).
 *
 * 면접 포인트:
 *  - record 는 단순 데이터 캐리어용. 도메인 엔티티(User) 같은 가변 객체엔 부적합.
 *  - @JsonProperty 외에 ObjectMapper 의 PropertyNamingStrategy.SNAKE_CASE 로
 *    전역 설정도 가능하나, 카카오 한 곳만 snake_case 라 명시적 매핑 선호.
 */
public class KakaoOAuthDto {

    /**
     * POST /oauth/token 응답.
     * 우리는 access_token 만 사용 (유저 정보 조회용).
     * refresh_token / scope / id_token 은 받지만 미사용.
     */
    public record TokenResponse(
            @JsonProperty("access_token") String accessToken,
            @JsonProperty("token_type") String tokenType,
            @JsonProperty("refresh_token") String refreshToken,
            @JsonProperty("expires_in") Integer expiresIn,
            @JsonProperty("scope") String scope,
            @JsonProperty("refresh_token_expires_in") Integer refreshTokenExpiresIn
    ) {}

    /**
     * GET /v2/user/me 응답.
     * id 는 카카오 회원번호 (Long, 절대 변경되지 않는 식별자) → providerId 로 저장.
     * kakao_account 안에 email / profile 중첩.
     */
    public record UserResponse(
            @JsonProperty("id") Long id,
            @JsonProperty("kakao_account") KakaoAccount kakaoAccount
    ) {
        /** 편의 메서드: nested 접근 줄이기 */
        public String email() {
            return kakaoAccount != null ? kakaoAccount.email() : null;
        }
        public String nickname() {
            if (kakaoAccount == null || kakaoAccount.profile() == null) return null;
            return kakaoAccount.profile().nickname();
        }
    }

    public record KakaoAccount(
            @JsonProperty("email") String email,
            @JsonProperty("email_needs_agreement") Boolean emailNeedsAgreement,
            @JsonProperty("profile") Profile profile
    ) {}

    public record Profile(
            @JsonProperty("nickname") String nickname,
            @JsonProperty("profile_image_url") String profileImageUrl
    ) {}
}
