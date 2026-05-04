package backend.config;

import backend.jwt.JwtFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtFilter jwtFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/**").permitAll()

                        // ─────────────────────────────────────────────
                        // 5-H B4: Like/Wishlist 토글 — 매처 순서 중요
                        // Spring Security는 위에서 첫 매치 우선이라
                        // products/** permitAll 보다 먼저 등록해야 함.
                        // ─────────────────────────────────────────────
                        // 좋아요 카운트만 비로그인 허용 (read-only count)
                        .requestMatchers("/api/products/*/like/count").permitAll()
                        // 좋아요 토글 + 찜 토글은 인증 필수
                        .requestMatchers("/api/products/*/like").authenticated()
                        .requestMatchers("/api/products/*/wishlist").authenticated()
                        // 내 찜 목록은 인증 필수
                        .requestMatchers("/api/wishlist", "/api/wishlist/**").authenticated()

                        // 상품/카테고리 일반 조회는 비로그인 허용
                        .requestMatchers("/api/products", "/api/products/**").permitAll()
                        .requestMatchers("/api/categories", "/api/categories/**").permitAll()
                        .requestMatchers("/swagger-ui/**", "/v3/api-docs/**").permitAll()
                        .requestMatchers("/api/internal/**").permitAll()
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        // 5-H B2: 리뷰 CUD 는 인증. GET /api/products/{id}/reviews 는
                        //          앞쪽 /api/products/** permitAll 매칭으로 통과 (의도된 동작)
                        .requestMatchers("/api/reviews", "/api/reviews/**").authenticated()
                        // 5-H B3 사전 등록: QnA CUD 도 동일 패턴 (B3 컨트롤러 작성 시 활성화)
                        .requestMatchers("/api/qna", "/api/qna/**").authenticated()
                        .anyRequest().authenticated())
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(
            AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
}
