package backend.controller.admin;

import backend.dto.AdminQnaDto;
import backend.dto.PagedResponse;
import backend.service.AdminQnaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

/**
 * 관리자 Q&A 운영 컨트롤러 (7-G R8).
 *
 * 경로: /api/admin/** — SecurityConfig 의 hasRole("ADMIN") 일괄 가드로 보호.
 *
 * 엔드포인트:
 *   GET  /api/admin/qna                 Q&A 목록 (answered 필터)
 *   POST /api/admin/qna/{id}/answer     개별 답변 작성·수정
 *   POST /api/admin/qna/answers/batch   미답변 다건 일괄 답변
 */
@Tag(name = "Admin QnA", description = "관리자 Q&A 운영")
@RestController
@RequestMapping("/api/admin/qna")
@RequiredArgsConstructor
public class AdminQnaController {

    private final AdminQnaService adminQnaService;

    @Operation(summary = "Q&A 목록", description = "answered 파라미터로 필터(true 답변완료 / false 미답변 / 생략 시 전체).")
    @GetMapping
    public ResponseEntity<PagedResponse<AdminQnaDto.ListItem>> list(
            @RequestParam(required = false) Boolean answered,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(adminQnaService.list(answered, page, size));
    }

    @Operation(summary = "개별 답변", description = "Q&A 한 건에 답변을 작성/수정합니다.")
    @PostMapping("/{id}/answer")
    public ResponseEntity<AdminQnaDto.ListItem> answer(
            @PathVariable Long id,
            @RequestBody AdminQnaDto.AnswerRequest request,
            @AuthenticationPrincipal UserDetails admin) {
        return ResponseEntity.ok(
                adminQnaService.answer(admin.getUsername(), id, request.answerContent()));
    }

    @Operation(summary = "일괄 답변", description = "선택한 미답변 Q&A 들에 같은 답변을 적용합니다. 이미 답변된 건은 건너뜁니다.")
    @PostMapping("/answers/batch")
    public ResponseEntity<AdminQnaDto.BatchResult> batchAnswer(
            @RequestBody AdminQnaDto.BatchAnswerRequest request,
            @AuthenticationPrincipal UserDetails admin) {
        return ResponseEntity.ok(adminQnaService.batchAnswer(
                admin.getUsername(), request.qnaIds(), request.answerContent()));
    }
}
