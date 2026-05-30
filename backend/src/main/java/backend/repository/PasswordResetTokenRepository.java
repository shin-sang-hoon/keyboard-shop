package backend.repository;

import backend.entity.PasswordResetToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * 비밀번호 재설정 토큰 Repository (5/29).
 */
public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {

    /** 재설정 화면에서 토큰 문자열로 조회 (uk_prt_token UNIQUE 인덱스 lookup). */
    Optional<PasswordResetToken> findByToken(String token);
}
