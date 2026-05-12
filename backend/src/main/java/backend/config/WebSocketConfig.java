package backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * Spring WebSocket + STOMP 설정 (Phase 7 경매 실시간 입찰용, 5/12).
 *
 * 설계:
 * - STOMP endpoint: /ws (브라우저 연결 진입점)
 *   - SockJS fallback 활성화: WebSocket 미지원 환경에서 long-polling 등으로 대체
 *   - CORS: setAllowedOriginPatterns("*") 로 개발 편의 (Phase 8 배포 시 origin 제한 필요)
 *
 * - 메시지 broker:
 *   - Inbound (client → server) prefix: /app
 *     예: client 가 /app/auction/{id}/bid 로 전송 → @MessageMapping 핸들러로 라우팅
 *   - Outbound (server → client) prefix: /topic, /queue
 *     예: server 가 /topic/auction/{id} 로 브로드캐스트 → 구독한 모든 client 에 전달
 *   - SimpleBroker (인메모리) 사용 — 단일 인스턴스 가정. 분산 환경에선 RabbitMQ/Redis 등 외부 broker 필요 (Phase 8).
 *
 * 보안:
 * - SecurityConfig 에 /ws/** permitAll 추가 필요 (또는 STOMP CONNECT 시 JWT 검증).
 *   현재는 개발 편의로 permitAll, Phase 8 시 STOMP interceptor 로 JWT 검증 추가.
 *
 * 면접 자산 포인트:
 * - simple broker vs full broker 트레이드오프 이해
 * - SockJS fallback 으로 폐쇄망/구형 환경 대응
 * - prefix 분리 (/app inbound vs /topic outbound) 로 메시지 흐름 명확화
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")  // 개발용 — Phase 8 시 도메인 제한
                .withSockJS();                  // WebSocket 미지원 환경 fallback
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // client → server: /app/** 로 들어온 메시지는 @MessageMapping 으로 라우팅
        registry.setApplicationDestinationPrefixes("/app");

        // server → client: /topic, /queue 로 보낸 메시지는 broker 가 구독자에게 fan-out
        registry.enableSimpleBroker("/topic", "/queue");
    }
}
