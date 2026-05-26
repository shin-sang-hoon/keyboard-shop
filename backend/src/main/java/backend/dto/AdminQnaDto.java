package backend.dto;

import backend.entity.QnA;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 관리자 Q&A 운영 DTO (7-G R8).
 *
 *  - ListItem           : Q&A 목록 한 행 (관리자는 비밀글 원문 열람)
 *  - AnswerRequest      : 개별 답변 요청
 *  - BatchAnswerRequest : 일괄 답변 요청 (미답변 다건 선택)
 *  - BatchResult        : 일괄 답변 결과 (처리/건너뜀 건수)
 *
 * 사용자 측 Q&A DTO(QnADto)와 분리 — 관리자는 비밀글 마스킹 없이 전체 열람.
 */
public class AdminQnaDto {

    private AdminQnaDto() {
    }

    /**
     * 관리자 Q&A 목록 항목.
     * 비밀글(secret=true)이라도 content 를 마스킹하지 않고 원문 노출 — 관리자 권한.
     */
    public record ListItem(
            Long id,
            Long productId,
            String productName,
            String userName,
            String content,
            boolean secret,
            boolean answered,
            String answerContent,
            String answeredByName,
            LocalDateTime answeredAt,
            LocalDateTime createdAt
    ) {
        public static ListItem from(QnA q) {
            return new ListItem(
                    q.getId(),
                    q.getProduct().getId(),
                    q.getProduct().getName(),
                    q.getUser().getName(),
                    q.getContent(),
                    Boolean.TRUE.equals(q.getIsSecret()),
                    q.getAnswerContent() != null,
                    q.getAnswerContent(),
                    q.getAnsweredBy() != null ? q.getAnsweredBy().getName() : null,
                    q.getAnsweredAt(),
                    q.getCreatedAt()
            );
        }
    }

    /** 개별 답변 요청 — POST /api/admin/qna/{id}/answer 바디 */
    public record AnswerRequest(String answerContent) {
    }

    /** 일괄 답변 요청 — POST /api/admin/qna/answers/batch 바디 */
    public record BatchAnswerRequest(List<Long> qnaIds, String answerContent) {
    }

    /**
     * 일괄 답변 결과.
     * @param answered 실제 답변 처리된 건수
     * @param skipped  건너뛴 건수 (이미 답변됨 / 존재하지 않음)
     */
    public record BatchResult(int answered, int skipped) {
    }
}
