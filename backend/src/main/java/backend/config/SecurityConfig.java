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
 * Spring Security configuration.
 *
 * Pattern: more specific paths first, broader (/**) second.
 *
 * 5-B (5/8) changes:
 *  - /api/auth/me explicitly authenticated() (others under /api/auth/** are entry points).
 *  - exceptionHandling() wired with custom handlers so unauthenticated requests
 *    return 401 (not Spring's default 403). 403 is reserved for "authenticated
 *    but role insufficient" cases (e.g. USER calling /api/admin/...).
 *
 * 7-A [9-2] (5/12) changes:
 *  - /api/admin/audit-logs/** temporarily permitAll for viewer verification.
 *    Removed once frontend ADMIN role guard (5-B Round 3) is in place.
 *
 * Phase 7 WebSocket (5/12) changes:
 *  - /ws/** permitAll for STOMP handshake. In production (Phase 8) a STOMP
 *    ChannelInterceptor should validate JWT on CONNECT frames instead.
 */
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtFilter jwtFilter;
    private final RestAuthenticationEntryPoint authenticationEntryPoint;
    private final RestAccessDeniedHandler accessDeniedHandler;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

                // 401/403 separation - HTTP semantics correct, frontend-friendly JSON body
                .exceptionHandling(eh -> eh
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler))

                .authorizeHttpRequests(auth -> auth
                        // Auth - /me requires token, others are entry points
                        .requestMatchers("/api/auth/me").authenticated()
                        .requestMatchers("/api/auth/**").permitAll()

                        // Product like (5-H B4) - count public, toggle authenticated
                        .requestMatchers("/api/products/*/like/count").permitAll()
                        .requestMatchers("/api/products/*/like").authenticated()
                        .requestMatchers("/api/products/*/wishlist").authenticated()
                        .requestMatchers("/api/wishlist", "/api/wishlist/**").authenticated()

                        // General product/category browsing - public
                        .requestMatchers("/api/products", "/api/products/**").permitAll()
                        .requestMatchers("/api/categories", "/api/categories/**").permitAll()
                        .requestMatchers("/swagger-ui/**", "/v3/api-docs/**").permitAll()
                        .requestMatchers("/api/internal/**").permitAll()

                        // [Phase 7 WebSocket · 5/12] STOMP endpoint - public handshake.
                        // SockJS info endpoint also under /ws/info, covered by /ws/** pattern.
                        // Phase 8: replace with STOMP ChannelInterceptor for JWT on CONNECT.
                        .requestMatchers("/ws/**").permitAll()

                        // Admin
                        // [TEMP] 7-A [9-2] AuditLog viewer - removed once frontend ADMIN guard is in
                        .requestMatchers("/api/admin/audit-logs/**").permitAll()
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")

                        // [TEMP] 7-A AuditLog @Aspect verification endpoint
                        .requestMatchers("/api/test-audit/**").permitAll()

                        // Reviews (5-H B2) - CUD authenticated
                        .requestMatchers("/api/reviews", "/api/reviews/**").authenticated()

                        // QnA (5-H B3) - GET public (with masking), CUD authenticated
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
