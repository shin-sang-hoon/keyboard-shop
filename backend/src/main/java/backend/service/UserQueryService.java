package backend.service;

import backend.entity.User;
import backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 아이디(이메일) 찾기 서비스 (5/29).
 *
 * - 이름으로 ACTIVE 계정 조회 → 이메일을 마스킹해 반환 (동명이인이면 여러 개).
 * - 마스킹 규칙: 로컬파트 앞 2글자만 노출, 나머지 *, 도메인 유지.
 *   예) wd2@test.com → wd*@test.com,  popeeplus87@gmail.com → po*********@gmail.com
 *   (로컬파트 2글자 이하면 첫 1글자만 노출)
 * - enumeration: 이름 찾기는 가입 화면에서 이메일 중복을 이미 노출하는 도메인 특성상
 *   민감도가 낮으나, 그래도 전체 이메일은 마스킹해서 노출 최소화.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserQueryService {

    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<String> findEmailsByName(String name) {
        if (name == null || name.isBlank()) {
            return List.of();
        }
        List<User> users = userRepository.findByNameAndStatus(name.trim(), User.Status.ACTIVE);
        return users.stream()
                .map(u -> maskEmail(u.getEmail()))
                .toList();
    }

    /** 이메일 마스킹: 로컬파트 앞 일부만 노출. */
    static String maskEmail(String email) {
        if (email == null || !email.contains("@")) {
            return "***";
        }
        int at = email.indexOf('@');
        String local = email.substring(0, at);
        String domain = email.substring(at); // '@' 포함

        if (local.length() <= 2) {
            // 1~2글자: 첫 글자만 노출
            return local.charAt(0) + "*".repeat(Math.max(1, local.length() - 1)) + domain;
        }
        // 3글자 이상: 앞 2글자 노출 + 나머지 마스킹
        String visible = local.substring(0, 2);
        String masked = "*".repeat(local.length() - 2);
        return visible + masked + domain;
    }
}
