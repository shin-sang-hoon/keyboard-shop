package backend.service;

import backend.dto.KakaoOAuthDto;
import backend.exception.BusinessException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Kakao OAuth 외부 API 클라이언트.
 *
 * 책임:
 *  - 인가 URL 생성 (state 파라미터 포함, CSRF 방어)
 *  - Authorization Code → Access Token 교환
 *  - Access Token → 유저 정보 조회
 *
 * 비즈니스 로직(유저 upsert, JWT 발급)은 AuthService.loginByKakao() 가 담당.
 *
 * 면접 포인트:
 *  - WebClient(reactive) 가 아닌 RestClient(Spring 6.1+) 사용 — 동기 호출이라
 *    reactive 의 복잡성 불필요. 대신 RestTemplate 보다 fluent API 깔끔.
 *  - state 파라미터: CSRF 방어. 프론트가 sessionStorage 에 random nonce 저장,
 *    인가 URL 의 state 파라미터로 함께 전송 → 카카오가 콜백 URL 의 state 로
 *    돌려보내면 프론트가 검증. 이 클래스는 state 생성에만 관여, 검증은 프론트.
 *  - 카카오 에러 코드 표준화 → BusinessException 으로 래핑하여
 *    GlobalExceptionHandler 가 적절한 HTTP status 로 변환.
 */
@Slf4j
@Component
public class KakaoOAuthClient {

    @Value("${kakao.client-id}")
    private String clientId;

    @Value("${kakao.redirect-uri}")
    private String redirectUri;

    @Value("${kakao.auth-url}")
    private String authUrl;

    @Value("${kakao.api-url}")
    private String apiUrl;

    private final RestClient restClient = RestClient.create();

    /**
     * 카카오 인가 URL 생성. 프론트는 이 URL 로 location.href = ... 시키면 됨.
     *
     * scope 는 application.properties 가 아닌 카카오 콘솔 "동의항목" 에서 관리.
     * (콘솔에서 필수/선택 동의 설정 → 자동 적용. URL 에 scope 명시하면 콘솔 설정 override)
     *
     * @param state CSRF 방어용 random nonce (프론트 생성, sessionStorage 저장)
     */
    public String buildAuthorizeUrl(String state) {
        return String.format(
                "%s/oauth/authorize?response_type=code&client_id=%s&redirect_uri=%s&state=%s",
                authUrl, clientId, redirectUri, state
        );
    }

    /**
     * Authorization Code → Access Token 교환.
     * 카카오는 Client Secret 선택사항이라 grant_type/client_id/redirect_uri/code 만 전송.
     */
    public KakaoOAuthDto.TokenResponse exchangeCodeForToken(String code) {
        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("grant_type", "authorization_code");
        body.add("client_id", clientId);
        body.add("redirect_uri", redirectUri);
        body.add("code", code);

        try {
            KakaoOAuthDto.TokenResponse response = restClient.post()
                    .uri(authUrl + "/oauth/token")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(body)
                    .retrieve()
                    .body(KakaoOAuthDto.TokenResponse.class);

            if (response == null || response.accessToken() == null) {
                throw BusinessException.unauthorized(
                        "Kakao token exchange failed: empty response");
            }
            log.info("Kakao token exchange success: scope={}", response.scope());
            return response;
        } catch (RestClientException e) {
            // 가장 흔한 케이스: code 만료(10분) / redirect_uri 불일치 / 이미 사용된 code
            log.warn("Kakao token exchange failed: {}", e.getMessage());
            throw BusinessException.unauthorized(
                    "Kakao authorization failed. Please try login again.");
        }
    }

    /**
     * Access Token 으로 유저 정보 조회.
     * 카카오는 GET /v2/user/me (Authorization: Bearer ...) 로 응답.
     */
    public KakaoOAuthDto.UserResponse fetchUser(String accessToken) {
        try {
            KakaoOAuthDto.UserResponse response = restClient.get()
                    .uri(apiUrl + "/v2/user/me")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                    .retrieve()
                    .body(KakaoOAuthDto.UserResponse.class);

            if (response == null || response.id() == null) {
                throw BusinessException.unauthorized(
                        "Kakao user fetch failed: empty response");
            }

            // 이메일 동의 항목 검증 - 비즈 앱 + 필수 동의 시 항상 받지만 방어적으로 체크
            if (response.email() == null || response.email().isBlank()) {
                throw BusinessException.unauthorized(
                        "Kakao account does not provide an email. Please use a different account.");
            }

            log.info("Kakao user fetch success: id={}, email={}",
                    response.id(), response.email());
            return response;
        } catch (RestClientException e) {
            log.warn("Kakao user fetch failed: {}", e.getMessage());
            throw BusinessException.unauthorized(
                    "Failed to fetch Kakao profile.");
        }
    }
}
