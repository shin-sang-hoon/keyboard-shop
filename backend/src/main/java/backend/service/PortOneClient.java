package backend.service;

import backend.exception.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * PortOne V2 결제내역 단건조회 클라이언트 (6/5).
 *
 * 결제완료(complete) 단계에서 "이 결제가 실제로 됐는지 + 얼마가 결제됐는지"를 포트원에
 * 직접 조회해 검증하기 위한 컴포넌트. 프론트가 보낸 금액은 신뢰하지 않고, 포트원에 저장된
 * 권위 있는 값을 가져와 우리 DB(PENDING 주문)의 금액과 대조한다 — 결제 위변조 차단의 핵심.
 *
 * 설계 노트:
 *  - V2 최신 방식은 액세스 토큰 발급(/signin/api-key → access_token) 단계가 필요 없다.
 *    API Secret 을 Authorization: PortOne {secret} 헤더에 직접 실어 호출한다.
 *    (구 gitbook 의 getToken/Bearer 방식은 deprecated.)
 *  - RestClient(Spring 6.1+) 사용 — KakaoOAuthClient / GeminiChatbotClient 와 동일 패턴.
 *    동기 호출이라 reactive(WebClient) 불필요, spring-boot-starter-web 에 포함.
 *  - 단건조회 엔드포인트: GET {base-url}/payments/{paymentId}
 *    응답(JSON)의 status(=PAID 등) 와 amount.total(실결제액), method.type(결제수단)을 추출.
 *
 * 면접 자산:
 *  - 결제 검증을 "프론트 신뢰 0" 원칙으로 설계 — 금액/상태를 PG 원본에서 재확인.
 *  - 외부 PG 응답을 도메인 중립 결과(PaymentResult)로 좁혀 서비스 계층이 PG SDK 형식에
 *    의존하지 않게 격리(KakaoOAuthClient 가 카카오 응답을 좁히는 것과 같은 패턴).
 */
@Slf4j
@Component
public class PortOneClient {

    private final RestClient restClient;
    private final String apiSecret;

    public PortOneClient(
            @Value("${portone.api.base-url}") String baseUrl,
            @Value("${portone.api.secret}") String apiSecret) {
        this.restClient = RestClient.builder().baseUrl(baseUrl).build();
        this.apiSecret = apiSecret;
    }

    /**
     * 포트원에서 단건 결제내역을 조회한다.
     *
     * @param paymentId 가맹점이 발급한 결제 고유번호(prepare 단계에서 주문에 저장한 값)
     * @return 조회 결과(상태/실결제액/결제수단)를 좁힌 PaymentResult
     * @throws BusinessException 미설정(시크릿 없음)·조회 실패·응답 파싱 실패 시
     */
    public PaymentResult getPayment(String paymentId) {
        if (apiSecret == null || apiSecret.isBlank()) {
            // 환경변수 PORTONE_API_SECRET 미설정 → 결제검증 불가. 부팅은 되지만 호출 시 차단.
            throw BusinessException.badRequest("결제 검증 설정이 누락되었습니다. (PORTONE_API_SECRET)");
        }
        if (paymentId == null || paymentId.isBlank()) {
            throw BusinessException.badRequest("결제 식별자가 없습니다.");
        }

        try {
            // toBodilessEntity 대신 상태코드를 직접 받기 위해 toEntity 사용.
            // onStatus 로 예외를 던지지 않는 이유: "결제 없음(404)"은 통신 오류가 아니라
            // "정상 결제가 아님"이라는 정상적인 검증 결과다. 예외로 흐름을 끊으면 호출부
            // (PaymentService.complete)가 주문을 CANCELLED 로 처리할 기회를 잃는다.
            // 따라서 404 는 isPaid()=false 인 PaymentResult 로 반환하고, 호출부가 검증 실패로
            // 일관 처리(주문 취소)하게 한다. 진짜 통신 장애(5xx·네트워크)만 예외로 던진다.
            org.springframework.http.ResponseEntity<JsonNode> response = restClient.get()
                    .uri("/payments/{paymentId}", paymentId)
                    .header("Authorization", "PortOne " + apiSecret)
                    .retrieve()
                    // ★ 4xx(404 등)는 예외를 던지지 않고 통과시킨다 — RestClient 는 기본적으로
                    //    4xx/5xx 에서 자동 예외를 던지므로, 4xx 를 빈 핸들러로 가로채야 아래
                    //    toEntity 로 응답이 넘어와 상태코드 분기(미결제 처리)가 작동한다.
                    //    (이 줄이 없으면 404 가 HttpClientErrorException 으로 catch 블록에 잡혀
                    //     "통신 오류"로 오분류되고, 호출부의 주문 취소 경로를 타지 못한다.)
                    .onStatus(HttpStatusCode::is4xxClientError, (req, res) -> { /* no-op: 아래에서 분기 */ })
                    .onStatus(HttpStatusCode::is5xxServerError, (req, res) -> {
                        // 5xx = PortOne 서버 장애 → 진짜 오류. 예외로 던져 사용자에게 재시도 유도.
                        log.warn("[PortOne] 단건조회 서버오류 status={} paymentId={}",
                                res.getStatusCode(), paymentId);
                        throw BusinessException.badRequest("결제 정보 조회 중 오류가 발생했습니다.");
                    })
                    .toEntity(JsonNode.class);

            // 404 등 4xx(서버오류 아님) = 결제가 존재하지 않거나 조회 불가 → "결제 안 됨"으로 간주.
            // status="NOT_PAID" 로 표시해 호출부가 isPaid()=false → 검증 실패 → 주문 취소로 흐르게.
            if (!response.getStatusCode().is2xxSuccessful()) {
                log.warn("[PortOne] 단건조회 비정상 status={} paymentId={} → 미결제로 처리",
                        response.getStatusCode(), paymentId);
                return new PaymentResult("NOT_PAID", 0, null);
            }

            JsonNode body = response.getBody();
            if (body == null) {
                log.warn("[PortOne] 단건조회 응답 본문 없음 paymentId={} → 미결제로 처리", paymentId);
                return new PaymentResult("NOT_PAID", 0, null);
            }

            // 응답 파싱 — V2 결제객체 구조: { status, amount: { total, ... }, method: { type, ... } }
            String status = text(body, "status");                  // 예: PAID, FAILED, CANCELLED
            Integer paidAmount = body.path("amount").path("total").isMissingNode()
                    ? null : body.path("amount").path("total").asInt();
            String payMethod = body.path("method").path("type").isMissingNode()
                    ? null : text(body.path("method"), "type");    // 예: PaymentMethodCard

            if (status == null || paidAmount == null) {
                // 형식이 깨졌으면 검증 통과시키면 안 됨 → 미결제로 간주(안전한 실패).
                log.warn("[PortOne] 응답에 status/amount 누락 paymentId={} body={} → 미결제로 처리",
                        paymentId, body);
                return new PaymentResult("NOT_PAID", 0, null);
            }

            return new PaymentResult(status, paidAmount, payMethod);

        } catch (RestClientException e) {
            // 네트워크 단절·타임아웃 등 → 진짜 통신 장애. 예외로 던져 재시도 유도(검증 통과 아님).
            log.warn("[PortOne] 단건조회 통신 오류 paymentId={} : {}", paymentId, e.getMessage());
            throw BusinessException.badRequest("결제 정보 조회 중 오류가 발생했습니다.");
        }
    }

    private static String text(JsonNode node, String field) {
        JsonNode v = node.get(field);
        return (v == null || v.isNull()) ? null : v.asText();
    }

    /**
     * 포트원 단건조회 결과를 좁힌 도메인 중립 타입.
     *
     * @param status     결제 상태 문자열 (PAID 면 결제 완료)
     * @param paidAmount 실제 결제된 총 금액 (amount.total) — DB 주문금액과 대조할 값
     * @param payMethod  결제 수단 타입 (없을 수 있음, 표시용)
     */
    public record PaymentResult(String status, int paidAmount, String payMethod) {

        /** 결제가 완료(PAID) 상태인지. */
        public boolean isPaid() {
            return "PAID".equalsIgnoreCase(status);
        }
    }
}
