package backend.service;

import backend.dto.PagedResponse;
import backend.dto.QnADto;
import backend.entity.Product;
import backend.entity.QnA;
import backend.entity.User;
import backend.exception.BusinessException;
import backend.repository.ProductRepository;
import backend.repository.QnARepository;
import backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * QnA 서비스 (5-H B3).
 *
 * 핵심 정책:
 *   1) 비밀글 마스킹 — 목록/상세 조회 시 본인/ADMIN 이 아니면 content/userName/answerContent 가림
 *      마스킹 책임은 DTO.from() 에 위임 (Service 는 currentUser/isAdmin 만 전달)
 *   2) 답변 1:1 임베드 — answerContent 컬럼이 곧 답변. UNIQUE 없이 도메인 룰로 강제
 *      (이미 답변 있으면 추가 답변 거부, 답변 수정은 PUT 으로)
 *   3) 권한 매트릭스:
 *      - 질문 작성: 인증
 *      - 질문 수정: 본인만
 *      - 질문 삭제: 본인 또는 ADMIN
 *      - 답변 작성/수정: ADMIN 만
 *
 * 비로그인 조회 (currentUserEmail == null) 처리:
 *   - 목록/상세 조회는 비로그인 가능
 *   - currentUser=null 로 from() 호출 시 비밀글은 자동 마스킹
 *   - findUserByEmail 은 인증 필요 메서드에서만 호출
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class QnAService {

    private final QnARepository qnaRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;

    // ─────────────────────────────────────────────────────
    // 조회
    // ─────────────────────────────────────────────────────

    /**
     * 상품별 QnA 페이지 조회 (비로그인 가능).
     * 비밀글은 본인/ADMIN 이 아니면 마스킹된 응답.
     */
    public PagedResponse<QnADto.Response> getQnaListByProduct(
            Long productId, Pageable pageable, String currentUserEmail) {

        if (!productRepository.existsById(productId)) {
            throw BusinessException.notFound("상품을 찾을 수 없습니다: " + productId);
        }

        ViewerContext viewer = resolveViewer(currentUserEmail);

        Page<QnADto.Response> page = qnaRepository.findByProductId(productId, pageable)
                .map(qna -> QnADto.Response.from(qna, viewer.user, viewer.isAdmin));

        return PagedResponse.from(page);
    }

    /**
     * QnA 단건 조회 (비로그인 가능).
     * 비밀글이라도 마스킹된 응답을 돌려주므로 권한 거부(403)는 던지지 않음.
     * → 프론트는 canView=false 로 자물쇠 화면 렌더.
     */
    public QnADto.Response getQnaDetail(Long qnaId, String currentUserEmail) {
        QnA qna = qnaRepository.findById(qnaId)
                .orElseThrow(() -> BusinessException.notFound(
                        "QnA를 찾을 수 없습니다: " + qnaId));

        ViewerContext viewer = resolveViewer(currentUserEmail);
        return QnADto.Response.from(qna, viewer.user, viewer.isAdmin);
    }

    // ─────────────────────────────────────────────────────
    // 질문 CUD (인증 필수)
    // ─────────────────────────────────────────────────────

    @Transactional
    public QnADto.Response createQuestion(String currentUserEmail, QnADto.CreateRequest request) {
        validateContent(request.getContent());

        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> BusinessException.notFound(
                        "상품을 찾을 수 없습니다: " + request.getProductId()));

        User currentUser = findUserByEmail(currentUserEmail);

        QnA qna = QnA.builder()
                .user(currentUser)
                .product(product)
                .content(request.getContent())
                .isSecret(Boolean.TRUE.equals(request.getIsSecret()))
                .build();

        QnA saved = qnaRepository.save(qna);

        // 작성자 본인 응답 → 마스킹 안 됨 (canView=true)
        return QnADto.Response.from(saved, currentUser, isAdminUser(currentUser));
    }

    @Transactional
    public QnADto.Response updateQuestion(String currentUserEmail, Long qnaId,
                                          QnADto.UpdateRequest request) {
        validateContent(request.getContent());

        QnA qna = qnaRepository.findById(qnaId)
                .orElseThrow(() -> BusinessException.notFound(
                        "QnA를 찾을 수 없습니다: " + qnaId));

        User currentUser = findUserByEmail(currentUserEmail);

        // 본인만 수정 가능 (ADMIN 도 다른 사람 질문은 수정 X — 검열로 보일 수 있음)
        if (!qna.getUser().getId().equals(currentUser.getId())) {
            throw BusinessException.forbidden("본인이 작성한 질문만 수정할 수 있습니다.");
        }

        // QnA 엔티티에 setter/updater 없음 → 새 객체로 교체
        // (Review 와 다른 패턴 — Review 는 updateContent() 메서드 가짐)
        // QnA 는 @Setter 없는 immutable + builder 라 우회 필요.
        // 임시 방안: id 보존 새 빌드 후 save (Hibernate 가 UPDATE 로 처리)
        QnA updated = QnA.builder()
                .id(qna.getId())
                .user(qna.getUser())
                .product(qna.getProduct())
                .content(request.getContent())
                .isSecret(Boolean.TRUE.equals(request.getIsSecret()))
                .answeredBy(qna.getAnsweredBy())
                .answerContent(qna.getAnswerContent())
                .answeredAt(qna.getAnsweredAt())
                .createdAt(qna.getCreatedAt())  // 보존
                .updatedAt(LocalDateTime.now())  // 갱신 (PreUpdate 가 또 덮어씀)
                .build();

        QnA saved = qnaRepository.save(updated);
        return QnADto.Response.from(saved, currentUser, isAdminUser(currentUser));
    }

    @Transactional
    public void deleteQuestion(String currentUserEmail, Long qnaId) {
        QnA qna = qnaRepository.findById(qnaId)
                .orElseThrow(() -> BusinessException.notFound(
                        "QnA를 찾을 수 없습니다: " + qnaId));

        User currentUser = findUserByEmail(currentUserEmail);

        boolean isOwner = qna.getUser().getId().equals(currentUser.getId());
        boolean isAdmin = isAdminUser(currentUser);
        if (!isOwner && !isAdmin) {
            throw BusinessException.forbidden("본인 질문만 삭제할 수 있습니다.");
        }

        qnaRepository.delete(qna);
    }

    // ─────────────────────────────────────────────────────
    // 답변 (ADMIN 전용)
    // ─────────────────────────────────────────────────────

    @Transactional
    public QnADto.Response addOrUpdateAnswer(String currentUserEmail, Long qnaId,
                                             QnADto.AnswerRequest request) {
        validateAnswerContent(request.getAnswerContent());

        QnA qna = qnaRepository.findById(qnaId)
                .orElseThrow(() -> BusinessException.notFound(
                        "QnA를 찾을 수 없습니다: " + qnaId));

        User currentUser = findUserByEmail(currentUserEmail);
        if (!isAdminUser(currentUser)) {
            throw BusinessException.forbidden("관리자만 답변을 작성할 수 있습니다.");
        }

        // 답변 임베드 — 새 객체로 교체 (QnA 엔티티에 setter 없음)
        QnA updated = QnA.builder()
                .id(qna.getId())
                .user(qna.getUser())
                .product(qna.getProduct())
                .content(qna.getContent())
                .isSecret(qna.getIsSecret())
                .answeredBy(currentUser)
                .answerContent(request.getAnswerContent())
                .answeredAt(LocalDateTime.now())
                .createdAt(qna.getCreatedAt())
                .updatedAt(LocalDateTime.now())
                .build();

        QnA saved = qnaRepository.save(updated);
        return QnADto.Response.from(saved, currentUser, true);  // ADMIN 본인 응답
    }

    // ─────────────────────────────────────────────────────
    // helper
    // ─────────────────────────────────────────────────────

    /**
     * Viewer 컨텍스트 — 비로그인이면 user=null/isAdmin=false.
     * 마스킹 분기에 사용.
     */
    private static class ViewerContext {
        final User user;
        final boolean isAdmin;

        ViewerContext(User user, boolean isAdmin) {
            this.user = user;
            this.isAdmin = isAdmin;
        }
    }

    private ViewerContext resolveViewer(String email) {
        if (email == null) {
            return new ViewerContext(null, false);
        }
        // email 이 있어도 사용자가 없으면 null 처리 (토큰 만료 등 edge case)
        return userRepository.findByEmail(email)
                .map(u -> new ViewerContext(u, isAdminUser(u)))
                .orElseGet(() -> new ViewerContext(null, false));
    }

    private boolean isAdminUser(User user) {
        return user != null && user.getRole() == User.Role.ADMIN;
    }

    private User findUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> BusinessException.notFound("사용자를 찾을 수 없습니다: " + email));
    }

    private void validateContent(String content) {
        if (content == null || content.isBlank()) {
            throw BusinessException.badRequest("질문 내용은 비어 있을 수 없습니다.");
        }
        if (content.length() > 2000) {
            throw BusinessException.badRequest("질문 내용은 2000자를 초과할 수 없습니다.");
        }
    }

    private void validateAnswerContent(String answerContent) {
        if (answerContent == null || answerContent.isBlank()) {
            throw BusinessException.badRequest("답변 내용은 비어 있을 수 없습니다.");
        }
        if (answerContent.length() > 2000) {
            throw BusinessException.badRequest("답변 내용은 2000자를 초과할 수 없습니다.");
        }
    }
}
