package backend.dto;

import backend.entity.QnA;
import backend.entity.User;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * QnA DTO (5-H B3).
 *
 * 구조:
 *   - CreateRequest: productId + content + isSecret (사용자 → 신규 질문)
 *   - UpdateRequest: content + isSecret (작성자 본인만, productId 변경 불가)
 *   - AnswerRequest: answerContent (ADMIN 답변)
 *   - Response: from(qna, currentUser, isAdmin) factory — 비밀글 마스킹 분기
 *
 * 마스킹 정책 (DTO 책임):
 *   - 비밀글이고 본인/ADMIN 이 아니면:
 *       title 자리(없으니 첫 줄 미리보기 자리) → "비밀글입니다"
 *       content → null
 *       userName → "비공개" (작성자 식별 가림)
 *       answerContent → null (있어도 가려짐)
 *   - secret=true 표시는 유지 (UI 에서 자물쇠 아이콘용)
 *   - id, productId, createdAt, isAnswered 등 식별/메타 정보는 노출 (목록 카운트 가능)
 */
public class QnADto {

    /** 질문 작성 요청 */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CreateRequest {
        private Long productId;
        private String content;
        private Boolean isSecret;  // null 이면 false 로 기본 처리 (Service)
    }

    /** 질문 수정 요청 (본인만, productId 변경 불가) */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UpdateRequest {
        private String content;
        private Boolean isSecret;
    }

    /** 답변 작성/수정 요청 (ADMIN) */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class AnswerRequest {
        private String answerContent;
    }

    /** QnA 응답 (마스킹 분기 포함) */
    @Getter
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor(access = AccessLevel.PRIVATE)
    public static class Response {
        private Long id;
        private Long productId;
        private Long userId;
        private String userName;          // 마스킹 시 "비공개"
        private String content;           // 마스킹 시 null
        private boolean isSecret;
        private boolean isAnswered;       // answerContent != null
        private boolean canView;          // 비밀글이라도 본인/ADMIN 이면 true (프론트 분기용)

        // 답변 (마스킹 시 또는 미답변 시 null)
        private String answerContent;
        private Long answeredById;
        private String answeredByName;
        private LocalDateTime answeredAt;

        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;

        /**
         * 표준 변환 — 마스킹 분기 적용.
         *
         * @param qna           대상 QnA
         * @param currentUser   현재 로그인 사용자 (없으면 null)
         * @param isAdmin       현재 사용자가 ADMIN 인지
         */
        public static Response from(QnA qna, User currentUser, boolean isAdmin) {
            boolean isOwner = currentUser != null
                    && qna.getUser().getId().equals(currentUser.getId());
            boolean canView = !qna.getIsSecret() || isOwner || isAdmin;

            // 비밀글 + 권한 없음 → 마스킹
            if (!canView) {
                return Response.builder()
                        .id(qna.getId())
                        .productId(qna.getProduct().getId())
                        .userId(null)             // 작성자 식별 가림
                        .userName("비공개")
                        .content(null)            // 본문 가림
                        .isSecret(true)
                        .isAnswered(qna.getAnswerContent() != null)
                        .canView(false)
                        .answerContent(null)      // 답변도 가림 (질문 보여야 답변 의미 있음)
                        .answeredById(null)
                        .answeredByName(null)
                        .answeredAt(qna.getAnsweredAt())  // 답변 여부만 시간으로 표시 가능
                        .createdAt(qna.getCreatedAt())
                        .updatedAt(qna.getUpdatedAt())
                        .build();
            }

            // 일반 응답 (공개글 또는 본인/ADMIN)
            return Response.builder()
                    .id(qna.getId())
                    .productId(qna.getProduct().getId())
                    .userId(qna.getUser().getId())
                    .userName(qna.getUser().getName())
                    .content(qna.getContent())
                    .isSecret(qna.getIsSecret())
                    .isAnswered(qna.getAnswerContent() != null)
                    .canView(true)
                    .answerContent(qna.getAnswerContent())
                    .answeredById(qna.getAnsweredBy() != null
                            ? qna.getAnsweredBy().getId() : null)
                    .answeredByName(qna.getAnsweredBy() != null
                            ? qna.getAnsweredBy().getName() : null)
                    .answeredAt(qna.getAnsweredAt())
                    .createdAt(qna.getCreatedAt())
                    .updatedAt(qna.getUpdatedAt())
                    .build();
        }
    }
}
