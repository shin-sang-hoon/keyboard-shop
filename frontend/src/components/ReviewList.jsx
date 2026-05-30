import { useEffect, useRef, useState } from 'react';
import RatingDistributionChart from './RatingDistributionChart';
import ReviewReportModal from './ReviewReportModal';
import { useAuthStore } from '../stores/authStore';
import { adminReviewApi } from '../api/adminReview';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

/**
 * 상품 리뷰 리스트 (5-H C1-c + C2 + B6, R10 판매자 답변 노출 + 관리자 인라인 답글).
 *
 * C2 변경:
 *   - props 에 onRequestWrite, refetchKey 추가 (C3 패턴 그대로)
 *   - 헤더 우측에 "+ 리뷰 작성" 버튼
 *   - EmptyState 에도 작성 버튼
 *   - refetchKey 변경 시 자동 refetch (등록 성공 후 트리거용)
 *
 * B6 변경:
 *   - sort dropdown 활성화 (disabled 제거)
 *   - state value 를 백엔드 ReviewSort enum 값과 매칭 (LATEST/RATING_DESC/RATING_ASC)
 *   - sort 변경 시 첫 페이지 reset + 자동 refetch
 *   - fetch URL 에 ?orderBy=${sort} 추가
 *   - 도움순(helpful) 만 disabled 유지 (도움 카운트 컬럼 부재)
 *
 * P0.5 변경 (7-G R8 사용자 측 연동):
 *   - ReviewCard 에 신고 버튼 추가 → ReviewReportModal 띄움
 *   - 백엔드 POST /api/reviews/{reviewId}/report (ReviewReportController) 와 연결
 *
 * R10 변경 (판매자 답변 노출 + 관리자 인라인 답글):
 *   - 공개: review.reply 가 있으면 content 아래 "판매자 답변" 블록 노출 (모두에게)
 *   - 관리자 전용 인라인 운영 UI — Header 와 동일하게 user?.role === 'ADMIN' 분기:
 *       · 답글 없는 리뷰 → "+ 판매자 답변 달기" 버튼
 *       · 답글 있는 리뷰 → 답변 블록에 "수정 / 삭제" 버튼
 *       · 클릭 시 카드 내 인라인 textarea (모달 없이 가볍게) → PATCH/DELETE /api/admin/reviews/{id}/reply
 *   - 일반 사용자 / 비로그인 → 기존과 동일하게 읽기만 (운영 UI 없음)
 *   - 답글 저장/삭제 후 내부 트리거(internalRefetch)로 목록 갱신 → 공개 노출 즉시 반영
 *   - 권한: /api/admin/** 는 백엔드 hasRole("ADMIN") 가드 → 비관리자가 호출해도 403 (UI+서버 2중 방어)
 *
 * 구성 (위 → 아래):
 *   [1] 헤더 — 정렬 dropdown (B6 활성화) + 작성 버튼
 *   [2] 별점 분포 차트 (RatingDistributionChart, B5 stats API)
 *   [3] 리뷰 리스트 (B2 GET /api/products/{id}/reviews?orderBy=...)
 *
 * Props:
 *   - productId: number
 *   - onRequestWrite: () => void  (C2)
 *   - refetchKey: number          (C2)
 */
export default function ReviewList({ productId, onRequestWrite, refetchKey = 0 }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [isLast, setIsLast] = useState(true);

  // B6: 백엔드 ReviewSort enum 값과 매칭 (helpful 은 보류 — disabled)
  const [sort, setSort] = useState('LATEST');

  // R10: 답글 작성/수정/삭제 후 목록을 다시 불러오기 위한 내부 트리거
  // (부모가 주는 refetchKey 와 별개 — 관리자 운영 행위로 인한 갱신 전용)
  const [internalRefetch, setInternalRefetch] = useState(0);

  // R10: 관리자 여부 — Header.jsx 와 동일 패턴
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // refetchKey 변경 시 첫 페이지로 돌아가서 다시 fetch
  useEffect(() => {
    if (refetchKey > 0) setPage(0);
  }, [refetchKey]);

  // B6: sort 변경 → 첫 페이지로 reset (refetch 는 useEffect 가 자동)
  const handleSortChange = (newSort) => {
    setSort(newSort);
    setPage(0);
  };

  useEffect(() => {
    if (!productId) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(
      `${API_BASE}/products/${productId}/reviews?page=${page}&size=10&orderBy=${sort}`,
      { signal: controller.signal }
    )
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!isMountedRef.current) return;
        setReviews(data.content || []);
        setTotalElements(data.totalElements ?? 0);
        setIsLast(data.last ?? true);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        if (!isMountedRef.current) return;
        console.error('[ReviewList] fetch error:', err);
        setError(err.message);
        setLoading(false);
      });

    return () => controller.abort();
  }, [productId, page, sort, refetchKey, internalRefetch]);

  // R10: 답글 작성/수정/삭제 후 목록 갱신
  const handleReplyChanged = () => setInternalRefetch((k) => k + 1);

  return (
    <div style={S.container}>
      {/* ═══════ [1] 헤더 — 정렬 dropdown + 작성 버튼 ═══════ */}
      <div style={S.header}>
        <div style={S.headerLeft}>
          <h2 style={S.title}>구매평</h2>
          {!loading && !error && (
            <span style={S.totalCount}>
              총 {totalElements.toLocaleString()}건
            </span>
          )}
        </div>

        <div style={S.headerRight}>
          {/* B6: 정렬 dropdown 활성화 (helpful 만 disabled 유지) */}
          <div style={S.sortGroup}>
            <label style={S.sortLabel} htmlFor="review-sort">정렬</label>
            <select
              id="review-sort"
              value={sort}
              onChange={(e) => handleSortChange(e.target.value)}
              style={S.sortSelectActive}
              aria-label="리뷰 정렬"
            >
              <option value="LATEST">최신순</option>
              <option value="RATING_DESC">별점 높은순</option>
              <option value="RATING_ASC">별점 낮은순</option>
              <option value="helpful" disabled>도움순 (준비 중)</option>
            </select>
          </div>

          {/* C2: 리뷰 작성 버튼 */}
          {onRequestWrite && (
            <button
              type="button"
              onClick={onRequestWrite}
              style={S.writeBtn}
              aria-label="리뷰 작성"
            >
              + 리뷰 작성
            </button>
          )}
        </div>
      </div>

      {/* ═══════ [2] 별점 분포 차트 ═══════ */}
      <div style={S.chartWrap}>
        <RatingDistributionChart productId={productId} />
      </div>

      {/* ═══════ [3] 리뷰 리스트 ═══════ */}
      <div style={S.listWrap}>
        {loading && (
          <div style={S.statusBox}>리뷰를 불러오는 중...</div>
        )}

        {error && (
          <div style={{ ...S.statusBox, color: '#dc2626' }}>
            리뷰를 불러오지 못했습니다 ({error})
          </div>
        )}

        {!loading && !error && reviews.length === 0 && (
          <div style={S.emptyBox}>
            <div style={S.emptyIcon}>📝</div>
            <div style={S.emptyTitle}>아직 리뷰가 없습니다</div>
            <div style={S.emptySub}>구매하신 분들의 첫 리뷰를 기다리고 있어요</div>
            {onRequestWrite && (
              <button
                type="button"
                onClick={onRequestWrite}
                style={S.emptyWriteBtn}
              >
                + 첫 리뷰 작성하기
              </button>
            )}
          </div>
        )}

        {!loading && !error && reviews.length > 0 && (
          <>
            <div style={S.cardList}>
              {reviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  isAdmin={isAdmin}
                  onReplyChanged={handleReplyChanged}
                />
              ))}
            </div>

            <div style={S.pagination}>
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                style={{
                  ...S.pageBtn,
                  opacity: page === 0 ? 0.4 : 1,
                  cursor: page === 0 ? 'not-allowed' : 'pointer',
                }}
                type="button"
              >
                이전
              </button>
              <span style={S.pageInfo}>{page + 1}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={isLast}
                style={{
                  ...S.pageBtn,
                  opacity: isLast ? 0.4 : 1,
                  cursor: isLast ? 'not-allowed' : 'pointer',
                }}
                type="button"
              >
                다음
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// 리뷰 카드 (개별 리뷰 한 건)
// ═════════════════════════════════════════════════════════════════════

function ReviewCard({ review, isAdmin = false, onReplyChanged }) {
  const {
    id,
    rating,
    content,
    userName = '익명',
    createdAt,
    verifiedPurchase = true,
    // R10 판매자 답변
    reply,
    repliedByName,
    repliedAt,
  } = review;

  const [reportOpen, setReportOpen] = useState(false);

  // R10 관리자 인라인 답글 편집 상태
  const hasReply = reply && reply.trim().length > 0;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(reply || '');
  const [busy, setBusy] = useState(false);

  // 신고 버튼 클릭 — 비로그인 시 모달을 열지 않고 안내 (P0.5)
  const handleReportClick = () => {
    const token = useAuthStore.getState().accessToken;
    if (!token) {
      window.alert('로그인이 필요합니다.');
      return;
    }
    setReportOpen(true);
  };

  // R10: 답글 편집 시작 (작성 or 수정)
  const startEdit = () => {
    setDraft(reply || '');
    setEditing(true);
  };

  // R10: 답글 저장 (작성·수정 공용 — upsert)
  const saveReply = async () => {
    if (!draft.trim()) {
      window.alert('답변 내용을 입력해 주세요.');
      return;
    }
    setBusy(true);
    try {
      await adminReviewApi.addReply(id, draft.trim());
      setEditing(false);
      onReplyChanged && onReplyChanged();
    } catch {
      window.alert('답변 저장에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  // R10: 답글 삭제
  const deleteReply = async () => {
    const ok = window.confirm('판매자 답변을 삭제할까요?');
    if (!ok) return;
    setBusy(true);
    try {
      await adminReviewApi.removeReply(id);
      onReplyChanged && onReplyChanged();
    } catch {
      window.alert('답변 삭제에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={S.card}>
      <div style={S.cardHeader}>
        <div style={S.cardLeft}>
          <StarRating rating={rating} />
          {verifiedPurchase && (
            <span style={S.verifiedBadge}>✓ 구매 인증</span>
          )}
        </div>
        <div style={S.cardRight}>
          <span style={S.userName}>{userName}</span>
          <span style={S.dot}>·</span>
          <span style={S.date}>{formatRelativeDate(createdAt)}</span>
        </div>
      </div>

      {content && <p style={S.cardContent}>{content}</p>}

      {/* R10: 판매자 답변 — reply 가 있을 때 노출 (모두에게 보임) */}
      {hasReply && !editing && (
        <div style={S.sellerReply}>
          <div style={S.sellerReplyHead}>
            <span style={S.sellerReplyBadge}>판매자</span>
            <span style={S.sellerReplyName}>{repliedByName || '판매자'}</span>
            {repliedAt && (
              <>
                <span style={S.dot}>·</span>
                <span style={S.sellerReplyDate}>{formatRelativeDate(repliedAt)}</span>
              </>
            )}
            {/* 관리자 전용 — 수정/삭제 */}
            {isAdmin && (
              <span style={S.sellerReplyAdminActions}>
                <button type="button" onClick={startEdit} disabled={busy} style={S.replyTextBtn}>
                  수정
                </button>
                <span style={S.dot}>·</span>
                <button type="button" onClick={deleteReply} disabled={busy} style={S.replyTextBtnDanger}>
                  삭제
                </button>
              </span>
            )}
          </div>
          <p style={S.sellerReplyContent}>{reply}</p>
        </div>
      )}

      {/* R10: 관리자 인라인 답글 편집기 (작성/수정 공용) */}
      {isAdmin && editing && (
        <div style={S.replyEditor}>
          <div style={S.replyEditorLabel}>판매자 답변 {hasReply ? '수정' : '작성'}</div>
          <textarea
            style={S.replyTextarea}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="고객 리뷰에 대한 판매자 답변을 입력하세요 (최대 1000자)"
            maxLength={1000}
            rows={3}
            autoFocus
          />
          <div style={S.replyEditorFooter}>
            <span style={S.replyCharCount}>{draft.length} / 1000</span>
            <div style={S.replyEditorBtns}>
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={busy}
                style={S.replyCancelBtn}
              >
                취소
              </button>
              <button
                type="button"
                onClick={saveReply}
                disabled={busy}
                style={{ ...S.replySaveBtn, ...(busy ? { opacity: 0.55, cursor: 'progress' } : null) }}
              >
                {busy ? '저장 중…' : (hasReply ? '수정' : '등록')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* R10: 관리자 — 답글 없을 때 "답변 달기" 버튼 */}
      {isAdmin && !hasReply && !editing && (
        <div style={S.adminReplyAddRow}>
          <button type="button" onClick={startEdit} style={S.adminReplyAddBtn}>
            + 판매자 답변 달기
          </button>
        </div>
      )}

      {/* 신고 버튼 (7-G R8 사용자 측 연동, P0.5) */}
      <div style={S.cardFooter}>
        <button
          type="button"
          onClick={handleReportClick}
          style={S.reportBtn}
          aria-label="리뷰 신고"
        >
          🚩 신고
        </button>
      </div>

      {/* 신고 모달 — 백엔드 POST /api/reviews/{id}/report */}
      {reportOpen && (
        <ReviewReportModal
          reviewId={id}
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  );
}

function StarRating({ rating = 0 }) {
  return (
    <div style={S.starGroup} aria-label={`별점 ${rating} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        let fillPercent = 0;
        if (rating >= n) fillPercent = 100;
        else if (rating > n - 1) fillPercent = (rating - (n - 1)) * 100;

        return (
          <span key={n} style={S.starWrap}>
            <span style={S.starBg}>☆</span>
            <span
              style={{
                ...S.starFg,
                width: `${fillPercent}%`,
              }}
            >
              ★
            </span>
          </span>
        );
      })}
    </div>
  );
}

function formatRelativeDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;

  const now = Date.now();
  const diff = now - d.getTime();
  const min = 60 * 1000;
  const hour = 60 * min;
  const day = 24 * hour;

  if (diff < min) return '방금';
  if (diff < hour) return `${Math.floor(diff / min)}분 전`;
  if (diff < day) return `${Math.floor(diff / hour)}시간 전`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}일 전`;

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd}`;
}

// ─── 인라인 스타일 ───────────────────────────────────────────────────────
const S = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 12,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: '#18181b',
    margin: 0,
  },
  totalCount: {
    fontSize: 13,
    color: '#71717a',
    fontWeight: 500,
    fontVariantNumeric: 'tabular-nums',
  },

  sortGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  sortLabel: {
    fontSize: 12,
    color: '#71717a',
    fontWeight: 500,
  },
  // B6: 활성 dropdown 스타일 (기존 disabled placeholder 와 차이)
  sortSelectActive: {
    padding: '6px 28px 6px 10px',
    fontSize: 13,
    color: '#18181b',
    background: '#fff',
    border: '1px solid #d4d4d8',
    borderRadius: 6,
    cursor: 'pointer',
    fontFamily: 'inherit',
    appearance: 'menulist',
  },

  writeBtn: {
    background: '#18181b',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    fontFamily: 'inherit',
    flexShrink: 0,
  },

  chartWrap: {},

  listWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },

  statusBox: {
    background: '#fff',
    border: '1px solid #e4e4e7',
    borderRadius: 12,
    padding: '40px 24px',
    textAlign: 'center',
    color: '#71717a',
    fontSize: 14,
  },

  emptyBox: {
    background: '#fff',
    border: '1px solid #e4e4e7',
    borderRadius: 12,
    padding: '48px 24px',
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: '#374151',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 16,
  },
  emptyWriteBtn: {
    background: '#18181b',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 20px',
    fontSize: 13.5,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginTop: 4,
  },

  cardList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  card: {
    background: '#fff',
    border: '1px solid #e4e4e7',
    borderRadius: 12,
    padding: '16px 20px',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  cardLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  cardRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: '#71717a',
  },
  userName: {
    color: '#52525b',
    fontWeight: 500,
  },
  dot: {
    color: '#d4d4d8',
  },
  date: {
    color: '#a1a1aa',
  },
  verifiedBadge: {
    fontSize: 11,
    fontWeight: 600,
    color: '#16a34a',
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: 4,
    padding: '2px 6px',
  },
  cardContent: {
    fontSize: 14,
    color: '#3f3f46',
    lineHeight: 1.6,
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },

  // R10: 판매자 답변 블록 (content 아래 들여쓴 회색 패널)
  sellerReply: {
    marginTop: 12,
    marginLeft: 12,
    padding: '12px 16px',
    background: '#f8fafc',
    border: '1px solid #e4e4e7',
    borderLeft: '3px solid #18181b',
    borderRadius: 8,
  },
  sellerReplyHead: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    fontSize: 12,
    flexWrap: 'wrap',
  },
  sellerReplyBadge: {
    fontSize: 11,
    fontWeight: 700,
    color: '#fff',
    background: '#18181b',
    borderRadius: 4,
    padding: '2px 7px',
  },
  sellerReplyName: {
    fontWeight: 600,
    color: '#3f3f46',
  },
  sellerReplyDate: {
    color: '#a1a1aa',
  },
  sellerReplyAdminActions: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  sellerReplyContent: {
    fontSize: 13.5,
    color: '#3f3f46',
    lineHeight: 1.6,
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },

  // R10: 관리자 답글 텍스트 버튼 (수정/삭제)
  replyTextBtn: {
    background: 'transparent',
    border: 'none',
    color: '#52525b',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'inherit',
  },
  replyTextBtnDanger: {
    background: 'transparent',
    border: 'none',
    color: '#dc2626',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'inherit',
  },

  // R10: 관리자 "답변 달기" 행
  adminReplyAddRow: {
    marginTop: 10,
    marginLeft: 12,
  },
  adminReplyAddBtn: {
    background: 'transparent',
    color: '#18181b',
    border: '1px dashed #d4d4d8',
    borderRadius: 8,
    padding: '7px 14px',
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  // R10: 관리자 인라인 답글 편집기
  replyEditor: {
    marginTop: 12,
    marginLeft: 12,
    padding: '12px 16px',
    background: '#f8fafc',
    border: '1px solid #d4d4d8',
    borderLeft: '3px solid #18181b',
    borderRadius: 8,
  },
  replyEditorLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: '#18181b',
    marginBottom: 8,
  },
  replyTextarea: {
    width: '100%',
    boxSizing: 'border-box',
    border: '1px solid #d4d4d8',
    borderRadius: 6,
    padding: 10,
    fontSize: 13.5,
    fontFamily: 'inherit',
    lineHeight: 1.6,
    resize: 'vertical',
  },
  replyEditorFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  replyCharCount: {
    fontSize: 11,
    color: '#a1a1aa',
  },
  replyEditorBtns: {
    display: 'flex',
    gap: 8,
  },
  replyCancelBtn: {
    background: '#fff',
    color: '#52525b',
    border: '1px solid #d4d4d8',
    borderRadius: 6,
    padding: '6px 14px',
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  replySaveBtn: {
    background: '#18181b',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '6px 16px',
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  // P0.5: 신고 버튼 (카드 우하단)
  cardFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  reportBtn: {
    background: 'transparent',
    border: 'none',
    color: '#a1a1aa',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    padding: '2px 4px',
    fontFamily: 'inherit',
    transition: 'color 0.15s ease',
  },

  starGroup: {
    display: 'inline-flex',
    gap: 1,
    fontSize: 14,
    lineHeight: 1,
  },
  starWrap: {
    position: 'relative',
    display: 'inline-block',
    width: 14,
    height: 14,
    color: '#e4e4e7',
  },
  starBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    color: '#e4e4e7',
  },
  starFg: {
    position: 'absolute',
    top: 0,
    left: 0,
    color: '#fbbf24',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
  },

  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 16,
    paddingTop: 16,
    borderTop: '1px solid #f4f4f5',
  },
  pageBtn: {
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 500,
    color: '#52525b',
    background: '#fff',
    border: '1px solid #d4d4d8',
    borderRadius: 6,
    fontFamily: 'inherit',
    transition: 'all 0.15s',
  },
  pageInfo: {
    fontSize: 13,
    fontWeight: 600,
    color: '#18181b',
    fontVariantNumeric: 'tabular-nums',
  },
};
