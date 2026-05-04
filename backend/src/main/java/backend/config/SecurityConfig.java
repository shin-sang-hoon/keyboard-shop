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
                        // products/** permitAll 보다 먼저 등록.
                        // ─────────────────────────────────────────────
                        .requestMatchers("/api/products/*/like/count").permitAll()
                        .requestMatchers("/api/products/*/like").authenticated()
                        .requestMatchers("/api/products/*/wishlist").authenticated()
                        .requestMatchers("/api/wishlist", "/api/wishlist/**").authenticated()

                        // ─────────────────────────────────────────────
                        // 5-H B3: QnA — GET 은 public(마스킹 처리),
                        //              POST/PUT/DELETE 는 인증.
                        // GET 단건/목록만 분리해서 permitAll, 나머지는
                        // 아래 /api/qna/** authenticated 로 차단.
                        // ─────────────────────────────────────────────
                        .requestMatchers(HttpMethod.GET, "/api/qna/*").permitAll()

                        // 상품/카테고리 일반 조회는 비로그인 허용
                        // GET /api/products/{id}/qna 는 여기에 흡수되어 통과
                        .requestMatchers("/api/products", "/api/products/**").permitAll()
                        .requestMatchers("/api/categories", "/api/categories/**").permitAll()
                        .requestMatchers("/swagger-ui/**", "/v3/api-docs/**").permitAll()
                        .requestMatchers("/api/internal/**").permitAll()
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        // 5-H B2: 리뷰 CUD 는 인증
                        .requestMatchers("/api/reviews", "/api/reviews/**").authenticated()
                        // 5-H B3: QnA CUD/답변 인증 (GET 은 위에서 이미 permitAll 로 통과)
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
