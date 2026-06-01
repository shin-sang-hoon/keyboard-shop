// frontend/src/pages/MyPage.jsx
//
// 마이페이지 (LIGHT 톤) — ② 3탭 실데이터 + role 분기 (5/30).
//
// role 분기:
//   - 일반 사용자(USER): 주문내역 / 찜한 상품 / 작성한 리뷰  (3탭)
//   - 관리자(ADMIN)    : 답변한 리뷰  (1탭) — 주문/찜은 관리자 계정과 무관하므로 숨김
//       · 관리자가 고객 리뷰에 단 "판매자 답변" 목록을 모아 보여줌 (R10 my-replies 활용)
//
// 데이터 소스:
//   - 주문    GET /api/orders/my          (List<OrderDto.Response>)        api/order.js
//   - 찜      GET /api/wishlist            (PagedResponse<WishlistDto.Item>) api/wishlist.js
//   - 내 리뷰  GET /api/reviews/my          (List<ReviewDto.MyReviewItem>)   api/review.js
//   - 답변리뷰 GET /api/admin/reviews/my-replies (PagedResponse<ListItem>)   api/adminReview.js
//
// 각 탭은 최초 진입 시 lazy fetch + 캐시(한 번 불러오면 재요청 안 함). 로딩/빈/에러 상태 처리.
//
// 회원 정보 수정 / 로그아웃 / 회원 탈퇴 영역은 기존 그대로 보존.
// 보호: ProtectedRoute로 감싸져 있어서 비로그인 진입 불가.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { colors, typography, spacing, radius } from '../styles/tokens';
import { getMyOrders } from '../api/order';
import { getMyWishlist, toggleWishlist } from '../api/wishlist';
import { getMyReviews, deleteMyReview } from '../api/review';
import { adminReviewApi } from '../api/adminReview';

// ─── 주문 상태 한글 라벨 ───────────────────────────────────────────────
const ORDER_STATUS_LABEL = {
  PENDING: '결제 대기',
  PAID: '결제 완료',
  PREPARING: '배송 준비',
  SHIPPED: '배송 중',
  DELIVERED: '배송 완료',
  CANCELLED: '취소됨',
};

// ─── 3D 빌더 옵션 id → 한글 라벨 (KeyboardBuilder / CartPage 와 일치) ──────
const LAYOUT_LABEL = { '65': '65%', '75': '75%', TKL: 'TKL', FULL: '풀배열' };
const SWITCH_LABEL = { LINEAR: '리니어', TACTILE: '택타일', CLICKY: '클리키' };
const KEYCAP_LABEL = {
  original: '오리지널 키캡', white: '화이트 키캡', black: '블랙 키캡',
  gray: '스모크 키캡', navy: '네이비 키캡', red: '레트로 레드 키캡', mint: '민트 키캡',
};
const CASE_LABEL = {
  original: '오리지널 케이스', white: '화이트 케이스', silver: '실버 케이스',
  black: '블랙 케이스', beige: '베이지 케이스',
};

function buildOptionLabels(it) {
  const labels = [];
  if (it.layout) labels.push(LAYOUT_LABEL[it.layout] || it.layout);
  if (it.switchType) labels.push(SWITCH_LABEL[it.switchType] || it.switchType);
  if (it.keycapColor) labels.push(KEYCAP_LABEL[it.keycapColor] || it.keycapColor);
  if (it.caseColor) labels.push(CASE_LABEL[it.caseColor] || it.caseColor);
  return labels;
}

function formatPrice(v) {
  if (v == null) return '-';
  return `${Number(v).toLocaleString()}원`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd}`;
}

export default function MyPage() {
  const { user, logout, withdraw } = useAuth();
  const navigate = useNavigate();

  const isAdmin = user?.role === 'ADMIN';

  // role 에 따라 탭 구성이 달라짐
  const TABS = isAdmin
    ? [{ id: 'replies', label: '답변한 리뷰' }]
    : [
        { id: 'orders', label: '주문내역' },
        { id: 'wishlist', label: '찜한 상품' },
        { id: 'reviews', label: '작성한 리뷰' },
      ];

  const [activeTab, setActiveTab] = useState(TABS[0].id);

  // 회원 탈퇴 모달 상태
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [pw, setPw] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function handleLogout() {
    logout();
    navigate('/products', { replace: true });
  }

  function openWithdraw() {
    setPw('');
    setReason('');
    setError('');
    setShowWithdraw(true);
  }

  function closeWithdraw() {
    if (submitting) return; // 처리 중엔 닫기 방지
    setShowWithdraw(false);
  }

  async function handleWithdraw() {
    setSubmitting(true);
    setError('');
    try {
      await withdraw({ password: pw, reason });
      setShowWithdraw(false);
      navigate('/products', { replace: true });
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message;
      if (status === 400) {
        setError('비밀번호를 입력해 주세요.');
      } else if (status === 401) {
        setError('비밀번호가 일치하지 않습니다.');
      } else if (status === 409) {
        setError('이미 탈퇴 처리된 계정입니다.');
      } else {
        setError(msg || '탈퇴 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* 프로필 헤더 */}
        <div style={S.header}>
          <div>
            <div style={S.name}>{user?.displayName || user?.name || '회원'}</div>
            <div style={S.email}>{user?.email}</div>
            {isAdmin && <span style={S.adminBadge}>관리자</span>}
          </div>
          <div style={S.headerActions}>
            <button onClick={() => navigate('/mypage/edit')} style={S.editBtn}>
              회원 정보 수정
            </button>
            <button onClick={handleLogout} style={S.logoutBtn}>
              로그아웃
            </button>
          </div>
        </div>

        {/* 탭 */}
        <div style={S.tabs}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                ...S.tab,
                ...(activeTab === tab.id ? S.tabActive : {}),
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 탭 내용 */}
        <div style={S.tabContent}>
          {activeTab === 'orders' && <OrdersTab />}
          {activeTab === 'wishlist' && <WishlistTab />}
          {activeTab === 'reviews' && <ReviewsTab />}
          {activeTab === 'replies' && <RepliesTab />}
        </div>

        {/* 회원 탈퇴 영역 */}
        <div style={S.dangerZone}>
          <div>
            <div style={S.dangerTitle}>회원 탈퇴</div>
            <div style={S.dangerDesc}>
              탈퇴하면 계정이 비활성화되며, 동일한 이메일로 다시 가입할 수 없습니다.
            </div>
          </div>
          <button onClick={openWithdraw} style={S.dangerBtn}>
            회원 탈퇴
          </button>
        </div>
      </div>

      {/* 탈퇴 확인 모달 */}
      {showWithdraw && (
        <div style={S.backdrop} onClick={closeWithdraw}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={S.modalTitle}>정말 탈퇴하시겠어요?</h3>
            <p style={S.modalText}>
              탈퇴 시 계정이 비활성화되고 <strong>같은 이메일로 재가입할 수 없습니다.</strong>
              <br />
              작성하신 구매평·문의·주문 내역은 보존되며, 작성자는 ‘탈퇴한 회원’으로 표시됩니다.
            </p>

            <label style={S.label}>
              비밀번호 확인
              <input
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                style={S.input}
                autoFocus
              />
            </label>
            <p style={S.hint}>
              카카오 로그인으로 가입하셨다면 비밀번호 없이 ‘탈퇴하기’를 눌러주세요.
            </p>

            <label style={S.label}>
              탈퇴 사유 (선택)
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="서비스 개선에 참고하겠습니다"
                style={S.input}
              />
            </label>

            {error && <div style={S.error}>{error}</div>}

            <div style={S.modalActions}>
              <button onClick={closeWithdraw} style={S.cancelBtn} disabled={submitting}>
                취소
              </button>
              <button onClick={handleWithdraw} style={S.confirmBtn} disabled={submitting}>
                {submitting ? '처리 중…' : '탈퇴하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// 공용 — 상태 박스 (로딩/빈/에러)
// ═════════════════════════════════════════════════════════════════════

function StatusBox({ icon, title, sub }) {
  return (
    <div style={S.placeholder}>
      {icon && <div style={S.placeholderIcon}>{icon}</div>}
      <h3 style={S.placeholderTitle}>{title}</h3>
      {sub && <p style={S.placeholderText}>{sub}</p>}
    </div>
  );
}

// 데이터 페치 + 로딩/에러/빈 처리를 공통화한 커스텀 훅.
//
// 무한루프 방지: 호출부가 () => getMyWishlist({size:100}) 같은 "인라인 화살표 함수"를
// 넘기면 매 렌더마다 fetcher 참조가 바뀐다. fetcher 를 useEffect/useCallback 의존성에
// 그대로 넣으면 (fetch→setState→리렌더→새 fetcher→다시 fetch) 무한 루프가 된다.
// → fetcher 를 ref 에 담아 항상 최신 함수를 가리키되, effect 의존성에서는 제외한다.
//   effect 는 마운트 시 1회만 실행(빈 deps) → 탭 진입 시 한 번만 로드.
function useTabData(fetcher) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  // 최신 fetcher 를 ref 로 유지 (참조 변경이 effect 를 재실행시키지 않도록)
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      setData(result);
    } catch (err) {
      console.error('[MyPage] tab fetch error:', err);
      setError(err?.response?.data?.message || '불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []); // fetcher 는 ref 로 접근 → deps 비움 (load 참조 고정)

  useEffect(() => {
    load();
  }, [load]); // load 가 고정이라 마운트 시 1회만 실행

  return { loading, error, data, reload: load, setData };
}

// ═════════════════════════════════════════════════════════════════════
// 주문내역 탭
// ═════════════════════════════════════════════════════════════════════

function OrdersTab() {
  const { loading, error, data } = useTabData(getMyOrders);

  if (loading) return <StatusBox title="주문내역을 불러오는 중..." />;
  if (error) return <StatusBox icon="⚠️" title="주문내역" sub={error} />;
  if (!data || data.length === 0)
    return <StatusBox icon="📦" title="주문 내역이 없습니다" sub="첫 주문을 기다리고 있어요" />;

  return (
    <div style={S.list}>
      {data.map((order) => (
        <div key={order.id} style={S.orderCard}>
          <div style={S.orderHead}>
            <span style={S.orderDate}>{formatDate(order.createdAt)}</span>
            <span style={S.orderStatus}>
              {ORDER_STATUS_LABEL[order.status] || order.status}
            </span>
          </div>
          <div style={S.orderItems}>
            {(order.items || []).map((it, idx) => {
              const optionLabels = buildOptionLabels(it);
              return (
              <div key={idx} style={S.orderItemRow}>
                <div style={S.orderItemThumb}>
                  {it.productImage ? (
                    <img src={it.productImage} alt={it.productName} style={S.orderItemImg} />
                  ) : (
                    <div style={S.orderItemNoImg}>📦</div>
                  )}
                </div>
                <div style={S.orderItemNameWrap}>
                  <span style={S.orderItemName}>{it.productName}</span>
                  {optionLabels.length > 0 && (
                    <div style={S.orderItemOptions}>
                      {optionLabels.map((opt) => (
                        <span key={opt} style={S.orderItemOptionBadge}>{opt}</span>
                      ))}
                    </div>
                  )}
                </div>
                <span style={S.orderItemQty}>
                  {formatPrice(it.price)} · {it.quantity}개
                </span>
              </div>
              );
            })}
          </div>
          <div style={S.orderFoot}>
            <span style={S.orderTotalLabel}>합계</span>
            <span style={S.orderTotal}>{formatPrice(order.totalPrice)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// 찜한 상품 탭
// ═════════════════════════════════════════════════════════════════════

function WishlistTab() {
  const navigate = useNavigate();
  const { loading, error, data, setData } = useTabData(() => getMyWishlist({ size: 100 }));
  const [busyId, setBusyId] = useState(null);

  const items = data?.content || [];

  async function handleRemove(productId) {
    setBusyId(productId);
    try {
      await toggleWishlist(productId); // 이미 찜 상태 → 해제
      // 로컬에서 제거 (재요청 없이 즉시 반영)
      setData((prev) => ({
        ...prev,
        content: (prev?.content || []).filter((x) => x.productId !== productId),
      }));
    } catch (err) {
      console.error('[MyPage] wishlist remove error:', err);
      window.alert('찜 해제에 실패했습니다.');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <StatusBox title="찜한 상품을 불러오는 중..." />;
  if (error) return <StatusBox icon="⚠️" title="찜한 상품" sub={error} />;
  if (items.length === 0)
    return <StatusBox icon="🤍" title="찜한 상품이 없습니다" sub="마음에 드는 상품을 찜해보세요" />;

  return (
    <div style={S.wishGrid}>
      {items.map((it) => (
        <div key={it.wishlistId} style={S.wishCard}>
          <div
            style={S.wishThumb}
            onClick={() => navigate(`/products/${it.productId}`)}
            role="button"
          >
            {it.imageUrl ? (
              <img src={it.imageUrl} alt={it.productName} style={S.wishImg} />
            ) : (
              <div style={S.wishNoImg}>이미지 없음</div>
            )}
          </div>
          <div style={S.wishBody}>
            {it.brandName && <div style={S.wishBrand}>{it.brandName}</div>}
            <div
              style={S.wishName}
              onClick={() => navigate(`/products/${it.productId}`)}
              role="button"
            >
              {it.productName}
            </div>
            <div style={S.wishPrice}>{formatPrice(it.price)}</div>
          </div>
          <button
            onClick={() => handleRemove(it.productId)}
            disabled={busyId === it.productId}
            style={S.wishRemoveBtn}
          >
            {busyId === it.productId ? '해제 중…' : '찜 해제'}
          </button>
        </div>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// 작성한 리뷰 탭 (일반 사용자)
// ═════════════════════════════════════════════════════════════════════

function ReviewsTab() {
  const navigate = useNavigate();
  const { loading, error, data, setData } = useTabData(getMyReviews);
  const [busyId, setBusyId] = useState(null);

  async function handleDelete(reviewId) {
    if (!window.confirm('이 리뷰를 삭제할까요?')) return;
    setBusyId(reviewId);
    try {
      await deleteMyReview(reviewId);
      setData((prev) => (prev || []).filter((r) => r.reviewId !== reviewId));
    } catch (err) {
      console.error('[MyPage] review delete error:', err);
      window.alert('리뷰 삭제에 실패했습니다.');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <StatusBox title="작성한 리뷰를 불러오는 중..." />;
  if (error) return <StatusBox icon="⚠️" title="작성한 리뷰" sub={error} />;
  if (!data || data.length === 0)
    return <StatusBox icon="✍️" title="작성한 리뷰가 없습니다" sub="구매한 상품에 리뷰를 남겨보세요" />;

  return (
    <div style={S.list}>
      {data.map((rv) => (
        <div key={rv.reviewId} style={S.reviewCard}>
          <div style={S.reviewTop}>
            <div
              style={S.reviewThumb}
              onClick={() => navigate(`/products/${rv.productId}`)}
              role="button"
            >
              {rv.productImageUrl ? (
                <img src={rv.productImageUrl} alt={rv.productName} style={S.reviewImg} />
              ) : (
                <div style={S.reviewNoImg}>—</div>
              )}
            </div>
            <div style={S.reviewMain}>
              <div
                style={S.reviewProductName}
                onClick={() => navigate(`/products/${rv.productId}`)}
                role="button"
              >
                {rv.productName}
              </div>
              <div style={S.reviewMeta}>
                <Stars rating={rv.rating} />
                <span style={S.reviewDate}>{formatDate(rv.createdAt)}</span>
                {rv.hidden && <span style={S.hiddenBadge}>관리자 숨김</span>}
              </div>
              {rv.content && <p style={S.reviewContent}>{rv.content}</p>}
            </div>
            <button
              onClick={() => handleDelete(rv.reviewId)}
              disabled={busyId === rv.reviewId}
              style={S.reviewDeleteBtn}
            >
              {busyId === rv.reviewId ? '삭제 중…' : '삭제'}
            </button>
          </div>

          {/* 판매자 답변이 달렸으면 함께 표시 */}
          {rv.hasReply && (
            <div style={S.sellerReply}>
              <div style={S.sellerReplyHead}>
                <span style={S.sellerReplyBadge}>판매자</span>
                <span style={S.sellerReplyName}>{rv.repliedByName || '판매자'}</span>
                {rv.repliedAt && (
                  <span style={S.sellerReplyDate}>· {formatDate(rv.repliedAt)}</span>
                )}
              </div>
              <p style={S.sellerReplyContent}>{rv.reply}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// 답변한 리뷰 탭 (관리자)
// ═════════════════════════════════════════════════════════════════════

function RepliesTab() {
  const navigate = useNavigate();
  const { loading, error, data } = useTabData(() =>
    adminReviewApi.getMyReplies({ size: 100 })
  );

  const items = data?.content || [];

  if (loading) return <StatusBox title="답변한 리뷰를 불러오는 중..." />;
  if (error) return <StatusBox icon="⚠️" title="답변한 리뷰" sub={error} />;
  if (items.length === 0)
    return (
      <StatusBox
        icon="💬"
        title="답변한 리뷰가 없습니다"
        sub="고객 리뷰에 판매자 답변을 달면 여기에 모입니다"
      />
    );

  return (
    <div style={S.list}>
      <p style={S.adminHint}>
        고객 리뷰에 남긴 판매자 답변 목록입니다. 답변 수정·삭제는 상품 상세 또는 리뷰·Q&A 운영에서 가능합니다.
      </p>
      {items.map((rv) => (
        <div key={rv.id} style={S.reviewCard}>
          <div
            style={S.reviewProductName}
            onClick={() => navigate(`/products/${rv.productId}`)}
            role="button"
          >
            {rv.productName}
          </div>
          <div style={S.reviewMeta}>
            <Stars rating={rv.rating} />
            <span style={S.reviewDate}>{rv.userName} 님의 리뷰</span>
            {rv.hidden && <span style={S.hiddenBadge}>숨김</span>}
          </div>
          {rv.content && <p style={S.reviewContent}>{rv.content}</p>}

          {/* 내가 단 답변 */}
          <div style={S.sellerReply}>
            <div style={S.sellerReplyHead}>
              <span style={S.sellerReplyBadge}>판매자</span>
              <span style={S.sellerReplyName}>{rv.repliedByName || '판매자'}</span>
              {rv.repliedAt && (
                <span style={S.sellerReplyDate}>· {formatDate(rv.repliedAt)}</span>
              )}
            </div>
            <p style={S.sellerReplyContent}>{rv.reply}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── 별점 렌더 ──────────────────────────────────────────────────────────
function Stars({ rating = 0 }) {
  return (
    <span style={S.stars} aria-label={`별점 ${rating} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} style={{ color: rating >= n ? '#fbbf24' : '#e4e4e7' }}>
          ★
        </span>
      ))}
    </span>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: colors.surface,
    fontFamily: typography.fontFamily.base,
    padding: `${spacing[6]} ${spacing[4]}`,
  },
  container: {
    maxWidth: 880,
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.lg,
    padding: spacing[6],
    marginBottom: spacing[5],
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
  },
  name: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textOnLight,
    letterSpacing: typography.letterSpacing.base,
  },
  email: {
    fontSize: typography.fontSize.sm,
    color: colors.textOnLightDim,
    marginTop: spacing[1],
  },
  adminBadge: {
    display: 'inline-block',
    marginTop: spacing[2],
    padding: `2px ${spacing[2]}`,
    background: colors.interviewSoft,
    color: colors.interview,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    borderRadius: radius.sm,
    letterSpacing: typography.letterSpacing.wide,
  },
  headerActions: {
    display: 'flex',
    gap: spacing[2],
    flexShrink: 0,
  },
  editBtn: {
    background: colors.textOnLight,
    border: `1px solid ${colors.textOnLight}`,
    color: colors.white,
    padding: `${spacing[2]} ${spacing[4]}`,
    borderRadius: radius.md,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  logoutBtn: {
    background: 'transparent',
    border: `1px solid ${colors.borderLight}`,
    color: colors.textOnLightDim,
    padding: `${spacing[2]} ${spacing[4]}`,
    borderRadius: radius.md,
    fontSize: typography.fontSize.sm,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  tabs: {
    display: 'flex',
    gap: spacing[1],
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.md,
    padding: spacing[1],
    marginBottom: spacing[4],
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
  },
  tab: {
    flex: 1,
    padding: spacing[3],
    background: 'transparent',
    border: 'none',
    color: colors.textOnLightDim,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    cursor: 'pointer',
    borderRadius: radius.sm,
    fontFamily: 'inherit',
  },
  tabActive: {
    background: colors.surfaceMuted,
    color: colors.textOnLight,
    fontWeight: typography.fontWeight.semibold,
  },
  tabContent: {
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.lg,
    padding: spacing[6],
    minHeight: 280,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
  },
  placeholder: {
    textAlign: 'center',
    padding: `${spacing[8]} ${spacing[4]}`,
  },
  placeholderIcon: {
    fontSize: 48,
    marginBottom: spacing[3],
  },
  placeholderTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textOnLight,
    margin: 0,
    marginBottom: spacing[2],
  },
  placeholderText: {
    fontSize: typography.fontSize.sm,
    color: '#94a3b8',
    margin: 0,
  },

  // === 공용 리스트 ===
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing[3],
  },
  adminHint: {
    fontSize: typography.fontSize.sm,
    color: colors.textOnLightDim,
    background: colors.surfaceMuted,
    padding: spacing[3],
    borderRadius: radius.md,
    margin: 0,
    marginBottom: spacing[2],
  },

  // === 주문 카드 ===
  orderCard: {
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.md,
    padding: spacing[4],
  },
  orderHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
    paddingBottom: spacing[2],
    borderBottom: `1px solid ${colors.borderLight}`,
  },
  orderDate: {
    fontSize: typography.fontSize.sm,
    color: colors.textOnLightDim,
    fontWeight: typography.fontWeight.medium,
  },
  orderStatus: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textOnLight,
    background: colors.surfaceMuted,
    padding: `2px ${spacing[2]}`,
    borderRadius: radius.sm,
  },
  orderItems: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  orderItemRow: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[3],
    fontSize: typography.fontSize.sm,
  },
  orderItemThumb: {
    width: 44,
    height: 44,
    flexShrink: 0,
    borderRadius: radius.sm,
    overflow: 'hidden',
    border: `1px solid ${colors.borderLight}`,
    background: colors.white,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderItemImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  orderItemNoImg: {
    fontSize: 18,
  },
  orderItemNameWrap: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  orderItemName: {
    color: colors.textOnLight,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  orderItemOptions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
  },
  orderItemOptionBadge: {
    fontSize: 11,
    fontWeight: 500,
    color: '#4A42B0',
    background: 'rgba(74,66,176,0.08)',
    border: '1px solid rgba(74,66,176,0.2)',
    borderRadius: 5,
    padding: '1px 6px',
    whiteSpace: 'nowrap',
  },
  orderItemQty: {
    color: colors.textOnLightDim,
    flexShrink: 0,
    marginLeft: spacing[3],
  },
  orderFoot: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing[2],
    borderTop: `1px solid ${colors.borderLight}`,
  },
  orderTotalLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textOnLightDim,
  },
  orderTotal: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textOnLight,
  },

  // === 찜 그리드 ===
  wishGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: spacing[4],
  },
  wishCard: {
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.md,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  wishThumb: {
    aspectRatio: '1 / 1',
    background: colors.surfaceMuted,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wishImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  wishNoImg: {
    fontSize: typography.fontSize.xs,
    color: '#94a3b8',
  },
  wishBody: {
    padding: spacing[3],
    flex: 1,
  },
  wishBrand: {
    fontSize: typography.fontSize.xs,
    color: colors.textOnLightDim,
    marginBottom: spacing[1],
  },
  wishName: {
    fontSize: typography.fontSize.sm,
    color: colors.textOnLight,
    cursor: 'pointer',
    lineHeight: 1.4,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  wishPrice: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.textOnLight,
    marginTop: spacing[2],
  },
  wishRemoveBtn: {
    border: 'none',
    borderTop: `1px solid ${colors.borderLight}`,
    background: colors.white,
    color: colors.textOnLightDim,
    padding: spacing[3],
    fontSize: typography.fontSize.sm,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  // === 리뷰 카드 ===
  reviewCard: {
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.md,
    padding: spacing[4],
  },
  reviewTop: {
    display: 'flex',
    gap: spacing[3],
    alignItems: 'flex-start',
  },
  reviewThumb: {
    width: 64,
    height: 64,
    borderRadius: radius.sm,
    background: colors.surfaceMuted,
    flexShrink: 0,
    cursor: 'pointer',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  reviewNoImg: {
    color: '#cbd5e1',
  },
  reviewMain: {
    flex: 1,
    minWidth: 0,
  },
  reviewProductName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textOnLight,
    cursor: 'pointer',
    marginBottom: spacing[1],
  },
  reviewMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[2],
    flexWrap: 'wrap',
  },
  reviewDate: {
    fontSize: typography.fontSize.xs,
    color: colors.textOnLightDim,
  },
  hiddenBadge: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: '#dc2626',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: radius.sm,
    padding: `1px ${spacing[2]}`,
  },
  reviewContent: {
    fontSize: typography.fontSize.sm,
    color: colors.textOnLight,
    lineHeight: 1.6,
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  reviewDeleteBtn: {
    border: `1px solid ${colors.borderLight}`,
    background: colors.white,
    color: colors.textOnLightDim,
    padding: `${spacing[1]} ${spacing[3]}`,
    borderRadius: radius.sm,
    fontSize: typography.fontSize.xs,
    cursor: 'pointer',
    fontFamily: 'inherit',
    flexShrink: 0,
  },

  // === 판매자 답변 (리뷰 카드 내부) ===
  sellerReply: {
    marginTop: spacing[3],
    marginLeft: spacing[4],
    padding: spacing[3],
    background: colors.surfaceMuted,
    borderLeft: `3px solid ${colors.textOnLight}`,
    borderRadius: radius.sm,
  },
  sellerReplyHead: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[1],
  },
  sellerReplyBadge: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
    background: colors.textOnLight,
    borderRadius: radius.sm,
    padding: `1px ${spacing[2]}`,
  },
  sellerReplyName: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textOnLight,
  },
  sellerReplyDate: {
    fontSize: typography.fontSize.xs,
    color: colors.textOnLightDim,
  },
  sellerReplyContent: {
    fontSize: typography.fontSize.sm,
    color: colors.textOnLight,
    lineHeight: 1.6,
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },

  stars: {
    display: 'inline-flex',
    fontSize: typography.fontSize.sm,
    letterSpacing: '1px',
  },

  // === 회원 탈퇴 영역 ===
  dangerZone: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.lg,
    padding: spacing[5],
    marginTop: spacing[5],
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
  },
  dangerTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textOnLight,
  },
  dangerDesc: {
    fontSize: typography.fontSize.sm,
    color: colors.textOnLightDim,
    marginTop: spacing[1],
  },
  dangerBtn: {
    background: 'transparent',
    border: '1px solid #dc2626',
    color: '#dc2626',
    padding: `${spacing[2]} ${spacing[4]}`,
    borderRadius: radius.md,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    marginLeft: spacing[4],
  },

  // === 모달 ===
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[4],
    zIndex: 1000,
  },
  modal: {
    background: colors.white,
    borderRadius: radius.lg,
    padding: spacing[6],
    width: '100%',
    maxWidth: 440,
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)',
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textOnLight,
    margin: 0,
    marginBottom: spacing[3],
  },
  modalText: {
    fontSize: typography.fontSize.sm,
    color: colors.textOnLightDim,
    lineHeight: 1.6,
    margin: 0,
    marginBottom: spacing[5],
  },
  label: {
    display: 'block',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textOnLight,
    marginBottom: spacing[3],
  },
  input: {
    display: 'block',
    width: '100%',
    marginTop: spacing[2],
    padding: spacing[3],
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.md,
    fontSize: typography.fontSize.base,
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  hint: {
    fontSize: typography.fontSize.xs,
    color: '#94a3b8',
    margin: 0,
    marginTop: `-${spacing[1]}`,
    marginBottom: spacing[4],
  },
  error: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    fontSize: typography.fontSize.sm,
    padding: spacing[3],
    borderRadius: radius.md,
    marginBottom: spacing[4],
  },
  modalActions: {
    display: 'flex',
    gap: spacing[2],
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    background: 'transparent',
    border: `1px solid ${colors.borderLight}`,
    color: colors.textOnLightDim,
    padding: `${spacing[3]} ${spacing[5]}`,
    borderRadius: radius.md,
    fontSize: typography.fontSize.sm,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  confirmBtn: {
    background: '#dc2626',
    border: '1px solid #dc2626',
    color: colors.white,
    padding: `${spacing[3]} ${spacing[5]}`,
    borderRadius: radius.md,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
