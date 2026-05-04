package backend.config;

import backend.jwt.JwtFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
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

/**
 * Spring Security 설정.
 *
 * 매처 순서 원칙: 좁은 경로(구체적) 먼저, 넓은 경로(/**) 마지막.
 * 같은 경로라도 GET-only permitAll → method 불문 authenticated 순으로 둬야
 * "GET 공개 + CUD 인증" 패턴이 성립한다.
 */
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
                        // ── 인증/인가 ────────────────────────────────────────
                        .requestMatchers("/api/auth/**").permitAll()

                        // ── 상품 좋아요/찜 (5-H B4) ────────────────────────
                        // 카운트 조회는 공개, 토글은 인증 필요.
                        // products/** permitAll 보다 먼저 등록되어야 한다.
                        .requestMatchers("/api/products/*/like/count").permitAll()
                        .requestMatchers("/api/products/*/like").authenticated()
                        .requestMatchers("/api/products/*/wishlist").authenticated()
                        .requestMatchers("/api/wishlist", "/api/wishlist/**").authenticated()

                        // ── 일반 조회 (비로그인 허용) ────────────────────────
                        .requestMatchers("/api/products", "/api/products/**").permitAll()
                        .requestMatchers("/api/categories", "/api/categories/**").permitAll()
                        .requestMatchers("/swagger-ui/**", "/v3/api-docs/**").permitAll()
                        .requestMatchers("/api/internal/**").permitAll()

                        // ── 관리자 ──────────────────────────────────────────
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")

                        // ── 리뷰 (5-H B2) — CUD 인증 필요 ────────────────
                        .requestMatchers("/api/reviews", "/api/reviews/**").authenticated()

                        // ── QnA (5-H B3) — GET 공개(마스킹 처리), CUD 인증 ──
                        // 좁은 GET 매처 먼저, 넓은 authenticated 매처 나중.
                        .requestMatchers(HttpMethod.GET, "/api/qna", "/api/qna/**").permitAll()
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
