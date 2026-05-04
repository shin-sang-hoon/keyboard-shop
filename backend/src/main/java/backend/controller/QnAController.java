package backend.controller;

import backend.dto.PagedResponse;
import backend.dto.QnADto;
import backend.service.QnAService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * QnA 컨트롤러 (5-H B3).
 *
 * 엔드포인트:
 *   GET    /api/products/{productId}/qna        public  — 상품별 QnA 목록 (마스킹)
 *   GET    /api/qna/{id}                        public  — QnA 단건 (마스킹)
 *   POST   /api/qna                             auth    — 질문 작성
 *   PUT    /api/qna/{id}                        auth    — 본인 질문 수정
 *   DELETE /api/qna/{id}                        auth    — 본인/ADMIN 삭제
 *   POST   /api/qna/{id}/answer                 auth    — ADMIN 답변 작성/수정
 *
 * 인증 추출:
 *   - Authentication 이 null 또는 anonymous 면 currentUserEmail = null 로 Service 호출
 *   - 비밀글 마스킹은 이 null 분기로 자동 처리
 */
@RestController
@RequiredArgsConstructor
public class QnAController {

    private final QnAService qnaService;

    // ─── 조회 (public) ──────────────────────────────────────

    @GetMapping("/api/products/{productId}/qna")
    public ResponseEntity<PagedResponse<QnADto.Response>> getQnaListByProduct(
            @PathVariable Long productId,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC)
            Pageable pageable,
            Authentication authentication) {
        String email = extractEmail(authentication);
        return ResponseEntity.ok(qnaService.getQnaListByProduct(productId, pageable, email));
    }

    @GetMapping("/api/qna/{id}")
    public ResponseEntity<QnADto.Response> getQnaDetail(
            @PathVariable Long id,
            Authentication authentication) {
        String email = extractEmail(authentication);
        return ResponseEntity.ok(qnaService.getQnaDetail(id, email));
    }

    // ─── 질문 CUD (auth) ────────────────────────────────────

    @PostMapping("/api/qna")
    public ResponseEntity<QnADto.Response> createQuestion(
            @RequestBody QnADto.CreateRequest request,
            Authentication authentication) {
        String email = authentication.getName();
        return ResponseEntity.ok(qnaService.createQuestion(email, request));
    }

    @PutMapping("/api/qna/{id}")
    public ResponseEntity<QnADto.Response> updateQuestion(
            @PathVariable Long id,
            @RequestBody QnADto.UpdateRequest request,
            Authentication authentication) {
        String email = authentication.getName();
        return ResponseEntity.ok(qnaService.updateQuestion(email, id, request));
    }

    @DeleteMapping("/api/qna/{id}")
    public ResponseEntity<Void> deleteQuestion(
            @PathVariable Long id,
            Authentication authentication) {
        String email = authentication.getName();
        qnaService.deleteQuestion(email, id);
        return ResponseEntity.noContent().build();
    }

    // ─── 답변 (ADMIN) ───────────────────────────────────────

    @PostMapping("/api/qna/{id}/answer")
    public ResponseEntity<QnADto.Response> addOrUpdateAnswer(
            @PathVariable Long id,
            @RequestBody QnADto.AnswerRequest request,
            Authentication authentication) {
        String email = authentication.getName();
        return ResponseEntity.ok(qnaService.addOrUpdateAnswer(email, id, request));
    }

    // ─── helper ─────────────────────────────────────────────

    /**
     * Authentication 에서 email 추출.
     * 비로그인 (anonymous) 이면 null 반환 — Service 가 분기 처리.
     */
    private String extractEmail(Authentication authentication) {
        if (authentication == null
                || !authentication.isAuthenticated()
                || "anonymousUser".equals(authentication.getPrincipal())) {
            return null;
        }
        return authentication.getName();
    }
}
