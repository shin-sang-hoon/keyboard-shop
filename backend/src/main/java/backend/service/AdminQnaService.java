package backend.service;

import backend.dto.AdminQnaDto;
import backend.dto.PagedResponse;
import backend.entity.QnA;
import backend.entity.User;
import backend.exception.BusinessException;
import backend.repository.QnARepository;
import backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 관리자 Q&A 운영 서비스 (7-G R8).
 *
 * 담당:
 *  - Q&A 목록 조회 (answered 필터 — 미답변 큐 / 답변 완료 / 전체)
 *  - 개별 답변 작성·수정
 *  - 일괄 답변 — 미답변 다건에 같은 답변 적용 (FAQ성 질문 대응)
 *
 * QnA 엔티티는 setter 가 없는 빌더 기반 — 답변을 넣으려면 id 를 보존한 새 객체로
 * rebuild 후 save 해야 함(Hibernate 가 UPDATE 로 처리). 기존 QnAService.addOrUpdateAnswer
 * 와 동일한 패턴을 private applyAnswer 로 추출해 개별/일괄이 공유.
 *
 * /api/admin/** 는 SecurityConfig 가 hasRole("ADMIN") 으로 가드하므로
 * 본 서비스 진입 시점에 호출자는 이미 관리자 — 별도 role 재검증은 생략.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminQnaService {

    private static final int ANSWER_MAX_LENGTH = 2000;

    private final QnARepository qnaRepository;
    private final UserRepository userRepository;

    // ─────────────────────────────────────────────────────
    // 목록
    // ─────────────────────────────────────────────────────

    /**
     * 관리자 Q&A 목록 — answered 필터 선택적.
     *   null = 전체, true = 답변 완료, false = 미답변 큐
     */
    public PagedResponse<AdminQnaDto.ListItem> list(Boolean answered, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<AdminQnaDto.ListItem> result = qnaRepository.findForAdmin(answered, pageable)
                .map(AdminQnaDto.ListItem::from);
        return PagedResponse.from(result);
    }

    // ─────────────────────────────────────────────────────
    // 답변
    // ─────────────────────────────────────────────────────

    /**
     * 개별 답변 작성·수정.
     * 이미 답변이 있으면 덮어씀(수정) — addOrUpdate 시맨틱.
     */
    @Transactional
    public AdminQnaDto.ListItem answer(String adminEmail, Long qnaId, String answerContent) {
        validateAnswer(answerContent);

        QnA qna = qnaRepository.findById(qnaId)
                .orElseThrow(() -> BusinessException.notFound("Q&A를 찾을 수 없습니다: " + qnaId));

        User admin = findUserByEmail(adminEmail);
        QnA saved = applyAnswer(qna, admin, answerContent);
        return AdminQnaDto.ListItem.from(saved);
    }

    /**
     * 일괄 답변 — 선택된 미답변 Q&A 들에 같은 답변을 적용.
     *
     * 이미 답변된 건 / 존재하지 않는 id 는 건너뛰고 BatchResult 에 집계.
     * (목록 로딩 후 다른 관리자가 먼저 답변하는 race 상황에서도 안전 — 덮어쓰지 않음)
     */
    @Transactional
    public AdminQnaDto.BatchResult batchAnswer(String adminEmail, List<Long> qnaIds, String answerContent) {
        validateAnswer(answerContent);
        if (qnaIds == null || qnaIds.isEmpty()) {
            throw BusinessException.badRequest("답변할 Q&A를 한 건 이상 선택해 주세요.");
        }

        User admin = findUserByEmail(adminEmail);
        int answered = 0;
        int skipped = 0;

        for (Long id : qnaIds) {
            QnA qna = qnaRepository.findById(id).orElse(null);
            if (qna == null) {
                skipped++;
                continue;
            }
            // 일괄 답변은 미답변 대상만 — 이미 답변된 건은 건너뜀
            if (qna.getAnswerContent() != null) {
                skipped++;
                continue;
            }
            applyAnswer(qna, admin, answerContent);
            answered++;
        }

        return new AdminQnaDto.BatchResult(answered, skipped);
    }

    // ─────────────────────────────────────────────────────
    // helper
    // ─────────────────────────────────────────────────────

    /**
     * 답변 적용 — QnA 는 setter 가 없으므로 id 를 보존한 새 객체로 rebuild 후 save.
     * Hibernate 는 id 가 채워진 엔티티를 save 하면 UPDATE 로 처리.
     * (기존 QnAService.addOrUpdateAnswer 와 동일한 패턴 — 일관성 유지)
     */
    private QnA applyAnswer(QnA qna, User admin, String answerContent) {
        QnA updated = QnA.builder()
                .id(qna.getId())
                .user(qna.getUser())
                .product(qna.getProduct())
                .content(qna.getContent())
                .isSecret(qna.getIsSecret())
                .answeredBy(admin)
                .answerContent(answerContent)
                .answeredAt(LocalDateTime.now())
                .createdAt(qna.getCreatedAt())
                .updatedAt(LocalDateTime.now())
                .build();
        return qnaRepository.save(updated);
    }

    private void validateAnswer(String answerContent) {
        if (answerContent == null || answerContent.isBlank()) {
            throw BusinessException.badRequest("답변 내용은 비어 있을 수 없습니다.");
        }
        if (answerContent.length() > ANSWER_MAX_LENGTH) {
            throw BusinessException.badRequest(
                    "답변 내용은 " + ANSWER_MAX_LENGTH + "자를 초과할 수 없습니다.");
        }
    }

    private User findUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> BusinessException.notFound("사용자를 찾을 수 없습니다: " + email));
    }
}
