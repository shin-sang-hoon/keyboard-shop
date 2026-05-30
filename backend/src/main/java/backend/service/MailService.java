package backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 * 메일 발송 서비스 (5/29).
 *
 * Gmail SMTP (spring-boot-starter-mail). 환경변수 MAIL_USERNAME/MAIL_PASSWORD.
 * 현재는 비밀번호 재설정 링크 발송 용도. 향후 주문 확인 등 확장 가능.
 *
 * 설계:
 *  - 본문에 재설정 링크(reset-url?token=...) 포함.
 *  - 발송 실패 시 예외를 던지지 않고 로깅만 — 호출부(PasswordResetService)가
 *    "요청 접수"를 항상 200 으로 반환해야 enumeration 방지가 유지되므로,
 *    메일 실패가 응답에 영향을 주면 안 됨(존재하는 계정만 메일 시도하는 구조).
 *  - 단, 운영 가시성을 위해 성공/실패는 로그로 남김.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MailService {

    private final JavaMailSender mailSender;

    @Value("${app.password-reset.from}")
    private String from;

    @Value("${app.password-reset.reset-url}")
    private String resetUrl;

    /**
     * 비밀번호 재설정 메일 발송.
     * @param to    수신자 이메일
     * @param token 재설정 토큰 (링크 쿼리스트링에 첨부)
     */
    public void sendPasswordResetMail(String to, String token) {
        String link = resetUrl + "?token=" + token;
        try {
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setFrom(from);
            msg.setTo(to);
            msg.setSubject("[스웨크론] 비밀번호 재설정 안내");
            msg.setText(
                    "안녕하세요, 스웨크론(SWACHRON)입니다.\n\n"
                    + "아래 링크를 눌러 비밀번호를 재설정해 주세요. (유효시간 30분)\n\n"
                    + link + "\n\n"
                    + "본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.\n"
                    + "감사합니다.\n");
            mailSender.send(msg);
            log.info("Password reset mail sent: to={}", to);
        } catch (Exception e) {
            // enumeration 방지: 호출부 응답에 영향 없도록 예외를 흡수하고 로깅만.
            log.error("Password reset mail send failed: to={}, reason={}", to, e.getMessage());
        }
    }
}
