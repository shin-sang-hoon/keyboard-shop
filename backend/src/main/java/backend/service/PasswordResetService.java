package backend.service;

import backend.entity.PasswordResetToken;
import backend.entity.User;
import backend.exception.BusinessException;
import backend.repository.PasswordResetTokenRepository;
import backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * 비밀번호 찾기/재설정 서비스 (5/29).
 *
 * 보안 설계:
 *  - forgot(): 이메일 존재 여부와 무관하게 항상 정상 종료(void) → 컨트롤러는 항상 200.
 *    enumeration 방지. 실제 계정이 ACTIVE + LOCAL 일 때만 토큰 생성 + 메일 발송.
 *    · WITHDRAWN: 재설정 대상 아님(조용히 무시).
 *    · KAKAO(password=null): 비밀번호가 없으므로 재설정 불가(조용히 무시).
 *  - reset(): 토큰 검증(존재/미사용/미만료) → 비번 변경 + 토큰 소멸(1회용).
 *    토큰이 가리키는 유저가 WITHDRAWN 이면 거부(탈퇴 후 재설정 차단).
 *  - 토큰: UUID(추측 불가). TTL 설정값(기본 30분).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PasswordResetService {

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final MailService mailService;

    @Value("${app.password-reset.token-ttl-minutes:30}")
    private long ttlMinutes;

    /**
     * 비밀번호 찾기 요청. 항상 정상 종료(컨트롤러 200) — enumeration 방지.
     * 실제 ACTIVE + LOCAL 계정일 때만 토큰 생성 + 메일 발송.
     */
    @Transactional
    public void forgot(String email) {
        if (email == null || email.isBlank()) {
            // 입력 형식 문제도 조용히 종료(공격자에게 단서 주지 않음).
            return;
        }
        userRepository.findByEmail(email.trim()).ifPresent(user -> {
            // 탈퇴 계정 / 소셜 로그인 계정은 재설정 대상 아님 (조용히 무시).
            if (user.getStatus() == User.Status.WITHDRAWN) {
                log.info("Password reset skipped (withdrawn): email={}", email);
                return;
            }
            if (user.getProvider() != User.Provider.LOCAL || user.getPassword() == null) {
                log.info("Password reset skipped (social account): email={}", email);
                return;
            }

            String token = UUID.randomUUID().toString().replace("-", "");
            PasswordResetToken prt = PasswordResetToken.builder()
                    .user(user)
                    .token(token)
                    .expiresAt(LocalDateTime.now().plusMinutes(ttlMinutes))
                    .build();
            tokenRepository.save(prt);

            mailService.sendPasswordResetMail(user.getEmail(), token);
            log.info("Password reset token issued: email={}", email);
        });
        // 계정이 없어도 아무 일 없이 종료 → 호출부 200.
    }

    /**
     * 비밀번호 재설정. 토큰 검증 후 새 비번 저장 + 토큰 1회용 소멸.
     *  - 토큰 없음/만료/사용됨 → 400.
     *  - 토큰 유저가 WITHDRAWN → 403.
     *  - 새 비번 형식(최소 길이) 검증 → 400.
     */
    @Transactional
    public void reset(String token, String newPassword) {
        if (token == null || token.isBlank()) {
            throw BusinessException.badRequest("Reset token is required");
        }
        if (newPassword == null || newPassword.length() < 4) {
            throw BusinessException.badRequest("Password must be at least 4 characters");
        }

        PasswordResetToken prt = tokenRepository.findByToken(token)
                .orElseThrow(() -> BusinessException.badRequest("Invalid or expired reset token"));

        if (!prt.isValid()) {
            // 만료 or 이미 사용됨 — 동일 메시지로 단서 최소화.
            throw BusinessException.badRequest("Invalid or expired reset token");
        }

        User user = prt.getUser();
        if (user.getStatus() == User.Status.WITHDRAWN) {
            throw BusinessException.forbidden("This account has been withdrawn.");
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        prt.markUsed(); // 1회용 소멸 (dirty checking flush)
        tokenRepository.save(prt);

        log.info("Password reset success: email={}", user.getEmail());
    }
}
