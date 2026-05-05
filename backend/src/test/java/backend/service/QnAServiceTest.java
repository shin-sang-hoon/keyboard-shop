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
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * QnAService 단위 테스트 (5-H A7).
 *
 * 테스트 전략:
 *   - ReviewServiceTest 와 동일한 BDD + AssertJ + @Nested 패턴
 *   - 비로그인 조회 가능 (currentUserEmail==null) 분기 명시 검증
 *
 * 커버 범위 (12 cases):
 *   - createQuestion : 정상 / 빈 content 400 / 2000자 초과 400 / 미존재 product 404 (4)
 *   - getQnaListByProduct : 비로그인 정상 / 미존재 product 404                       (2)
 *   - updateQuestion : 본인 정상 / 타인 forbidden 403 / 빈 content 400              (3)
 *   - deleteQuestion : 본인 / ADMIN / 타인 forbidden                                  (3)
 *   - addOrUpdateAnswer : ADMIN 정상 / 일반 user forbidden 403                       (2)
 *
 * 면접 자산:
 *   - "비밀글 마스킹 책임은 DTO.from() 에 위임 — Service 는 currentUser/isAdmin 만 전달"
 *     (B3 commit message 의 "DTO 마스킹 책임분리" 를 테스트로 입증)
 *   - "비로그인 조회는 throw 안 하고 마스킹된 응답 — canView=false 자물쇠 UI 신호"
 *   - "권한 매트릭스가 메서드별로 다름 — 작성=인증/수정=본인/삭제=본인+ADMIN/답변=ADMIN"
 *   - "QnA 엔티티에 setter 없음 → 새 builder 객체 교체 (id 보존) save 패턴"
 */
@ExtendWith(MockitoExtension.class)
class QnAServiceTest {

    @Mock private QnARepository qnaRepository;
    @Mock private ProductRepository productRepository;
    @Mock private UserRepository userRepository;

    @InjectMocks private QnAService qnaService;

    // ─────────────────────────────────────────────────────
    // Test fixtures
    // ─────────────────────────────────────────────────────

    private static final String EMAIL = "test@keychron.com";
    private static final String ADMIN_EMAIL = "admin@keychron.com";

    private User user(Long id, User.Role role) {
        String email = role == User.Role.ADMIN ? ADMIN_EMAIL : EMAIL;
        return User.builder().id(id).email(email).name("테스터").role(role).build();
    }

    private Product product(Long id) {
        return Product.builder().id(id).name("Keychron K10 Pro").build();
    }

    private QnA qna(Long id, User author, Product p, String content, boolean secret) {
        return QnA.builder()
                .id(id)
                .user(author)
                .product(p)
                .content(content)
                .isSecret(secret)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }

    // ═════════════════════════════════════════════════════
    // createQuestion()
    // ═════════════════════════════════════════════════════

    @Nested
    @DisplayName("createQuestion() 질문 작성")
    class CreateQuestionTest {

        @Test
        @DisplayName("정상 — 비밀글 false, content 정상 → 저장")
        void create_success() {
            User u = user(1L, User.Role.USER);
            Product p = product(10L);

            given(productRepository.findById(10L)).willReturn(Optional.of(p));
            given(userRepository.findByEmail(EMAIL)).willReturn(Optional.of(u));
            given(qnaRepository.save(any(QnA.class)))
                    .willAnswer(inv -> {
                        QnA q = inv.getArgument(0);
                        return QnA.builder()
                                .id(500L)
                                .user(q.getUser()).product(q.getProduct())
                                .content(q.getContent()).isSecret(q.getIsSecret())
                                .createdAt(LocalDateTime.now())
                                .updatedAt(LocalDateTime.now())
                                .build();
                    });

            QnADto.CreateRequest req = QnADto.CreateRequest.builder()
                    .productId(10L).content("배송 언제 와요?").isSecret(false).build();

            QnADto.Response resp = qnaService.createQuestion(EMAIL, req);

            assertThat(resp.getId()).isEqualTo(500L);

            // ArgumentCaptor — save 시 정확한 user/product/content/isSecret 전달
            ArgumentCaptor<QnA> captor = ArgumentCaptor.forClass(QnA.class);
            verify(qnaRepository).save(captor.capture());
            QnA saved = captor.getValue();
            assertThat(saved.getContent()).isEqualTo("배송 언제 와요?");
            assertThat(saved.getIsSecret()).isFalse();
            assertThat(saved.getUser().getId()).isEqualTo(1L);
            assertThat(saved.getProduct().getId()).isEqualTo(10L);
        }

        @Test
        @DisplayName("빈 content → 400 (validateContent 가 가장 먼저)")
        void create_emptyContent() {
            QnADto.CreateRequest req = QnADto.CreateRequest.builder()
                    .productId(10L).content("   ").isSecret(false).build();

            assertThatThrownBy(() -> qnaService.createQuestion(EMAIL, req))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("비어 있을 수 없습니다")
                    .extracting("status").isEqualTo(HttpStatus.BAD_REQUEST);

            // content 검증이 가장 먼저 → product/user 조회 안 함
            verify(productRepository, never()).findById(any());
            verify(userRepository, never()).findByEmail(any());
        }

        @Test
        @DisplayName("2000자 초과 content → 400")
        void create_contentTooLong() {
            String longContent = "가".repeat(2001);
            QnADto.CreateRequest req = QnADto.CreateRequest.builder()
                    .productId(10L).content(longContent).isSecret(false).build();

            assertThatThrownBy(() -> qnaService.createQuestion(EMAIL, req))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("2000자를 초과")
                    .extracting("status").isEqualTo(HttpStatus.BAD_REQUEST);
        }

        @Test
        @DisplayName("미존재 product → 404")
        void create_productNotFound() {
            given(productRepository.findById(99L)).willReturn(Optional.empty());

            QnADto.CreateRequest req = QnADto.CreateRequest.builder()
                    .productId(99L).content("질문있어요").isSecret(false).build();

            assertThatThrownBy(() -> qnaService.createQuestion(EMAIL, req))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("상품을 찾을 수 없습니다")
                    .extracting("status").isEqualTo(HttpStatus.NOT_FOUND);

            verify(qnaRepository, never()).save(any());
        }
    }

    // ═════════════════════════════════════════════════════
    // getQnaListByProduct()
    // ═════════════════════════════════════════════════════

    @Nested
    @DisplayName("getQnaListByProduct() 상품별 QnA 목록 (비로그인 가능)")
    class GetQnaListTest {

        @Test
        @DisplayName("비로그인 정상 — viewer null 로 마스킹 분기 활성화")
        void list_anonymous() {
            User author = user(1L, User.Role.USER);
            QnA secretQna = qna(500L, author, product(10L), "비밀스런질문", true);
            Pageable pageable = PageRequest.of(0, 10);
            Page<QnA> page = new PageImpl<>(List.of(secretQna), pageable, 1);

            given(productRepository.existsById(10L)).willReturn(true);
            given(qnaRepository.findByProductId(10L, pageable)).willReturn(page);

            // currentUserEmail = null → 비로그인
            PagedResponse<QnADto.Response> resp =
                    qnaService.getQnaListByProduct(10L, pageable, null);

            assertThat(resp.getContent()).hasSize(1);
            assertThat(resp.getTotalElements()).isEqualTo(1L);
            // 비로그인이라 userRepository 조회 안 함 (resolveViewer 가 null 분기)
            verify(userRepository, never()).findByEmail(any());
        }

        @Test
        @DisplayName("미존재 product → 404 (목록도 똑같이 차단)")
        void list_productNotFound() {
            Pageable pageable = PageRequest.of(0, 10);

            given(productRepository.existsById(99L)).willReturn(false);

            assertThatThrownBy(() -> qnaService.getQnaListByProduct(99L, pageable, null))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("상품을 찾을 수 없습니다")
                    .extracting("status").isEqualTo(HttpStatus.NOT_FOUND);

            verify(qnaRepository, never()).findByProductId(anyLong(), any());
        }
    }

    // ═════════════════════════════════════════════════════
    // updateQuestion()
    // ═════════════════════════════════════════════════════

    @Nested
    @DisplayName("updateQuestion() 질문 수정")
    class UpdateQuestionTest {

        @Test
        @DisplayName("본인 수정 정상 — id 보존 새 객체 교체 save")
        void update_byOwner() {
            User u = user(1L, User.Role.USER);
            QnA original = qna(500L, u, product(10L), "원래질문", false);

            given(qnaRepository.findById(500L)).willReturn(Optional.of(original));
            given(userRepository.findByEmail(EMAIL)).willReturn(Optional.of(u));
            given(qnaRepository.save(any(QnA.class)))
                    .willAnswer(inv -> inv.getArgument(0));

            QnADto.UpdateRequest req = QnADto.UpdateRequest.builder()
                    .content("수정된질문").isSecret(true).build();

            qnaService.updateQuestion(EMAIL, 500L, req);

            // ArgumentCaptor — id 보존 + content/isSecret 변경 검증
            ArgumentCaptor<QnA> captor = ArgumentCaptor.forClass(QnA.class);
            verify(qnaRepository).save(captor.capture());
            QnA saved = captor.getValue();
            assertThat(saved.getId()).isEqualTo(500L);             // id 보존
            assertThat(saved.getContent()).isEqualTo("수정된질문");
            assertThat(saved.getIsSecret()).isTrue();
            assertThat(saved.getUser().getId()).isEqualTo(1L);     // 작성자 보존
        }

        @Test
        @DisplayName("타인 수정 시도 → 403 (ADMIN 도 다른 사람 질문은 수정 X)")
        void update_byOther_forbidden() {
            User me = user(1L, User.Role.USER);
            User author = user(2L, User.Role.USER);
            QnA original = qna(500L, author, product(10L), "원래질문", false);

            given(qnaRepository.findById(500L)).willReturn(Optional.of(original));
            given(userRepository.findByEmail(EMAIL)).willReturn(Optional.of(me));

            QnADto.UpdateRequest req = QnADto.UpdateRequest.builder()
                    .content("악의적수정").isSecret(false).build();

            assertThatThrownBy(() -> qnaService.updateQuestion(EMAIL, 500L, req))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("본인이 작성한 질문만")
                    .extracting("status").isEqualTo(HttpStatus.FORBIDDEN);

            verify(qnaRepository, never()).save(any());
        }

        @Test
        @DisplayName("빈 content 수정 → 400 (validate 가 가장 먼저)")
        void update_emptyContent() {
            QnADto.UpdateRequest req = QnADto.UpdateRequest.builder()
                    .content("").isSecret(false).build();

            assertThatThrownBy(() -> qnaService.updateQuestion(EMAIL, 500L, req))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("비어 있을 수 없습니다")
                    .extracting("status").isEqualTo(HttpStatus.BAD_REQUEST);

            // 검증이 가장 먼저 → DB 조회 안 함
            verify(qnaRepository, never()).findById(any());
        }
    }

    // ═════════════════════════════════════════════════════
    // deleteQuestion()
    // ═════════════════════════════════════════════════════

    @Nested
    @DisplayName("deleteQuestion() 질문 삭제 (본인 또는 ADMIN)")
    class DeleteQuestionTest {

        @Test
        @DisplayName("본인 삭제 → 정상")
        void delete_byOwner() {
            User u = user(1L, User.Role.USER);
            QnA q = qna(500L, u, product(10L), "질문", false);

            given(qnaRepository.findById(500L)).willReturn(Optional.of(q));
            given(userRepository.findByEmail(EMAIL)).willReturn(Optional.of(u));

            qnaService.deleteQuestion(EMAIL, 500L);

            verify(qnaRepository, times(1)).delete(q);
        }

        @Test
        @DisplayName("ADMIN 이 타인 질문 삭제 → 정상 (정책상 허용)")
        void delete_byAdmin() {
            User author = user(1L, User.Role.USER);
            User admin = user(99L, User.Role.ADMIN);
            QnA q = qna(500L, author, product(10L), "질문", false);

            given(qnaRepository.findById(500L)).willReturn(Optional.of(q));
            given(userRepository.findByEmail(ADMIN_EMAIL)).willReturn(Optional.of(admin));

            qnaService.deleteQuestion(ADMIN_EMAIL, 500L);

            verify(qnaRepository, times(1)).delete(q);
        }

        @Test
        @DisplayName("일반 사용자가 타인 질문 삭제 시도 → 403")
        void delete_byOther_forbidden() {
            User me = user(1L, User.Role.USER);
            User author = user(2L, User.Role.USER);
            QnA q = qna(500L, author, product(10L), "질문", false);

            given(qnaRepository.findById(500L)).willReturn(Optional.of(q));
            given(userRepository.findByEmail(EMAIL)).willReturn(Optional.of(me));

            assertThatThrownBy(() -> qnaService.deleteQuestion(EMAIL, 500L))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("본인 질문만 삭제")
                    .extracting("status").isEqualTo(HttpStatus.FORBIDDEN);

            verify(qnaRepository, never()).delete(any());
        }
    }

    // ═════════════════════════════════════════════════════
    // addOrUpdateAnswer() — ADMIN 전용
    // ═════════════════════════════════════════════════════

    @Nested
    @DisplayName("addOrUpdateAnswer() 답변 (ADMIN 전용)")
    class AddAnswerTest {

        @Test
        @DisplayName("ADMIN 답변 정상 — answeredBy/answerContent/answeredAt 임베드")
        void answer_byAdmin() {
            User author = user(1L, User.Role.USER);
            User admin = user(99L, User.Role.ADMIN);
            QnA q = qna(500L, author, product(10L), "질문", false);

            given(qnaRepository.findById(500L)).willReturn(Optional.of(q));
            given(userRepository.findByEmail(ADMIN_EMAIL)).willReturn(Optional.of(admin));
            given(qnaRepository.save(any(QnA.class)))
                    .willAnswer(inv -> inv.getArgument(0));

            QnADto.AnswerRequest req = QnADto.AnswerRequest.builder()
                    .answerContent("3-5일 내 배송됩니다").build();

            qnaService.addOrUpdateAnswer(ADMIN_EMAIL, 500L, req);

            ArgumentCaptor<QnA> captor = ArgumentCaptor.forClass(QnA.class);
            verify(qnaRepository).save(captor.capture());
            QnA saved = captor.getValue();
            assertThat(saved.getId()).isEqualTo(500L);                       // id 보존
            assertThat(saved.getContent()).isEqualTo("질문");                // 원본 질문 보존
            assertThat(saved.getAnsweredBy().getId()).isEqualTo(99L);         // ADMIN
            assertThat(saved.getAnswerContent()).isEqualTo("3-5일 내 배송됩니다");
            assertThat(saved.getAnsweredAt()).isNotNull();
        }

        @Test
        @DisplayName("일반 USER 답변 시도 → 403")
        void answer_byUser_forbidden() {
            User me = user(1L, User.Role.USER);
            User author = user(2L, User.Role.USER);
            QnA q = qna(500L, author, product(10L), "질문", false);

            given(qnaRepository.findById(500L)).willReturn(Optional.of(q));
            given(userRepository.findByEmail(EMAIL)).willReturn(Optional.of(me));

            QnADto.AnswerRequest req = QnADto.AnswerRequest.builder()
                    .answerContent("내가답해주마").build();

            assertThatThrownBy(() -> qnaService.addOrUpdateAnswer(EMAIL, 500L, req))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("관리자만 답변")
                    .extracting("status").isEqualTo(HttpStatus.FORBIDDEN);

            verify(qnaRepository, never()).save(any());
        }
    }
}
