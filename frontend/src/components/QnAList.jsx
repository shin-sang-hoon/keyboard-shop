import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * QnAList — 상품 Q&A 리스트 (5-H C3)
 *
 * B3 백엔드:
 *   GET /api/products/{productId}/qna?page={p}&size={s}
 *   응답: PagedResponse<QnAResponse>
 *     QnAResponse: { id, productId, userId, userName, content, secret, canView,
 *                    answerContent, answeredById, answeredByName, answeredAt,
 *                    answered, createdAt, updatedAt }
 *     - secret=true && canView=false → content null, userName 마스킹
 *     - answered=false 또는 answerContent IS NULL → "답변 대기중"
 *     - title 필드 없음 (네이버 쇼핑/쿠팡 Q&A 패턴 — 본문만 사용)
 *
 * 면접 자산:
 *  - 4-state UI (loading/error/empty/data) — C1-c 패턴
 *  - AbortController + isMounted ref 이중 안전장치
 *  - 비밀글 자물쇠 UI (B3 DTO 마스킹 → C3 시각화)
 *  - 답변 1:1 임베드 (질문 카드 안에 답변 카드 nested)
 *  - lazy fetch (활성 탭일 때만 마운트)
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
const PAGE_SIZE = 10;

export default function QnAList({ productId, onRequestWrite, refetchKey = 0 }) {
  const [qnaList, setQnaList] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchQna = useCallback(async (pageNum) => {
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('accessToken');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const url = `${API_BASE}/products/${productId}/qna?page=${pageNum}&size=${PAGE_SIZE}`;
      const res = await fetch(url, { headers, signal: controller.signal });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      if (!isMountedRef.current) return;

      setQnaList(data.content || []);
      setTotalPages(data.totalPages || 0);
      setTotalElements(data.totalElements || 0);
      setPage(pageNum);
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (!isMountedRef.current) return;
      console.error('[QnAList] fetch error:', err);
      setError(err.message || 'Q&A를 불러오지 못했습니다.');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }

    return () => controller.abort();
  }, [productId]);

  useEffect(() => {
    fetchQna(0);
  }, [fetchQna, refetchKey]);

  const handlePageChange = (newPage) => {
    if (newPage < 0 || newPage >= totalPages) return;
    fetchQna(newPage);
    window.requestAnimationFrame(() => {
      document.getElementById('qna-list-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  return (
    <div style={S.wrap}>
      {/* Header */}
      <div style={S.header} id="qna-list-top">
        <div style={S.headerLeft}>
          <h3 style={S.title}>
            상품 Q&A
            <span style={S.count}>{totalElements}</span>
          </h3>
          <p style={S.subtitle}>상품에 대해 궁금한 점을 문의해보세요.</p>
        </div>
        <button
          type="button"
          onClick={onRequestWrite}
          style={S.writeBtn}
          aria-label="Q&A 질문하기"
        >
          + 질문하기
        </button>
      </div>

      {/* Body */}
      {loading && qnaList.length === 0 && <LoadingState />}
      {error && <ErrorState message={error} onRetry={() => fetchQna(page)} />}
      {!loading && !error && qnaList.length === 0 && <EmptyState onWrite={onRequestWrite} />}

      {qnaList.length > 0 && (
        <ul style={S.list} aria-label="Q&A 목록">
          {qnaList.map((qna) => (
            <QnACard key={qna.id} qna={qna} />
          ))}
        </ul>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onChange={handlePageChange} />
      )}
    </div>
  );
}

/* ────────────── 개별 카드 (질문 + 답변 임베드) ────────────── */
function QnACard({ qna }) {
  const [expanded, setExpanded] = useState(false);
  // 백엔드 필드명: secret (isSecret 아님), userName (authorName 아님), answeredByName
  const isSecret = qna.secret === true;
  const canView = qna.canView !== false; // 명시적으로 false 일 때만 마스킹
  const isMasked = isSecret && !canView;
  // answered 필드 우선 사용, 없으면 answerContent 존재 여부로 판단
  const hasAnswer = qna.answered === true || !!qna.answerContent;
  // 본문 미리보기 (title 필드가 없어서 content 첫 줄로 대체)
  const previewText = (qna.content || '').split('\n')[0].slice(0, 60);

  return (
    <li style={S.card} aria-label={isMasked ? '비밀글' : previewText}>
      <div
        onClick={() => !isMasked && setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (!isMasked && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
        role={isMasked ? undefined : 'button'}
        tabIndex={isMasked ? -1 : 0}
        aria-expanded={isMasked ? undefined : expanded}
        style={{ ...S.cardHeader, cursor: isMasked ? 'default' : 'pointer' }}
      >
        <div style={S.badges}>
          {hasAnswer ? (
            <span style={S.badgeAnswered}>✓ 답변완료</span>
          ) : (
            <span style={S.badgePending}>답변 대기중</span>
          )}
          {isSecret && (
            <span style={S.badgeSecret} title="비밀글">
              🔒 비밀글
            </span>
          )}
        </div>

        <h4 style={S.questionTitle}>
          {isMasked ? (
            <span style={S.maskedTitle}>비밀글입니다.</span>
          ) : (
            previewText || '(내용 없음)'
          )}
        </h4>

        <div style={S.meta}>
          <span>{qna.userName || '익명'}</span>
          <span style={S.metaDot}>·</span>
          <span>{formatRelative(qna.createdAt)}</span>
          {!isMasked && (
            <span style={S.expandHint}>{expanded ? '접기 ▴' : '펼치기 ▾'}</span>
          )}
        </div>
      </div>

      {/* 펼친 본문 (마스킹 아닐 때만) */}
      {expanded && !isMasked && (
        <div style={S.body}>
          <p style={S.questionContent}>{qna.content}</p>

          {/* 답변 임베드 */}
          {hasAnswer ? (
            <div style={S.answerBox}>
              <div style={S.answerHeader}>
                <span style={S.answerBadge}>판매자 답변</span>
                <span style={S.answerMeta}>
                  {qna.answeredByName || '판매자'} · {formatRelative(qna.answeredAt)}
                </span>
              </div>
              <p style={S.answerContent}>{qna.answerContent}</p>
            </div>
          ) : (
            <div style={S.noAnswer}>
              아직 답변이 등록되지 않았습니다.
            </div>
          )}
        </div>
      )}

      {/* 마스킹 본문 안내 */}
      {isMasked && (
        <div style={S.maskedBody}>
          작성자와 판매자만 볼 수 있는 글입니다.
        </div>
      )}
    </li>
  );
}

/* ────────────── 4-state UI ────────────── */
function LoadingState() {
  return (
    <div style={S.stateBox} role="status" aria-live="polite">
      <div style={S.spinner} />
      <p style={S.stateText}>Q&A를 불러오는 중…</p>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div style={S.stateBox} role="alert">
      <p style={{ ...S.stateText, color: '#dc2626' }}>⚠ {message}</p>
      <button type="button" onClick={onRetry} style={S.retryBtn}>
        다시 시도
      </button>
    </div>
  );
}

function EmptyState({ onWrite }) {
  return (
    <div style={S.stateBox}>
      <p style={S.stateText}>아직 등록된 Q&A가 없습니다.</p>
      <p style={{ ...S.stateText, fontSize: 13, color: '#a1a1aa' }}>
        궁금한 점을 가장 먼저 문의해보세요.
      </p>
      <button type="button" onClick={onWrite} style={S.writeBtnAlt}>
        + 질문하기
      </button>
    </div>
  );
}

function Pagination({ page, totalPages, onChange }) {
  const visible = 5;
  const start = Math.max(0, Math.min(page - Math.floor(visible / 2), totalPages - visible));
  const end = Math.min(totalPages, start + visible);
  const pages = [];
  for (let i = start; i < end; i++) pages.push(i);

  return (
    <nav style={S.pagination} aria-label="Q&A 페이지 이동">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page === 0}
        style={{ ...S.pageBtn, ...(page === 0 ? S.pageBtnDisabled : {}) }}
        aria-label="이전 페이지"
      >
        ‹
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          aria-current={p === page ? 'page' : undefined}
          style={{
            ...S.pageBtn,
            ...(p === page ? S.pageBtnActive : {}),
          }}
        >
          {p + 1}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages - 1}
        style={{ ...S.pageBtn, ...(page >= totalPages - 1 ? S.pageBtnDisabled : {}) }}
        aria-label="다음 페이지"
      >
        ›
      </button>
    </nav>
  );
}

/* ────────────── 유틸 ────────────── */
function formatRelative(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return '방금 전';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day}일 전`;
  return date.toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' });
}

/* ────────────── 라이트 테마 스타일 (ProductDetail 디자인 톤 일치) ────────────── */
const S = {
  wrap: { padding: '8px 0' },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottom: '1px solid #e4e4e7',
  },
  headerLeft: { flex: 1 },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: '#18181b',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  count: {
    fontSize: 13,
    fontWeight: 600,
    color: '#52525b',
    background: '#f4f4f5',
    padding: '2px 10px',
    borderRadius: 100,
    fontVariantNumeric: 'tabular-nums',
  },
  subtitle: { fontSize: 13, color: '#71717a', margin: '4px 0 0' },
  writeBtn: {
    background: '#18181b',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 18px',
    fontSize: 13.5,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    flexShrink: 0,
    fontFamily: 'inherit',
  },
  writeBtnAlt: {
    background: '#18181b',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 18px',
    fontSize: 13.5,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 8,
    fontFamily: 'inherit',
  },
  list: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 },

  card: {
    background: '#fff',
    border: '1px solid #e4e4e7',
    borderRadius: 10,
    overflow: 'hidden',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  },
  cardHeader: {
    padding: '16px 20px',
    userSelect: 'none',
  },
  badges: { display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  badgeAnswered: {
    fontSize: 11,
    fontWeight: 600,
    padding: '3px 9px',
    borderRadius: 4,
    background: '#f0fdf4',
    color: '#16a34a',
    border: '1px solid #bbf7d0',
  },
  badgePending: {
    fontSize: 11,
    fontWeight: 600,
    padding: '3px 9px',
    borderRadius: 4,
    background: '#fff7ed',
    color: '#c2410c',
    border: '1px solid #fed7aa',
  },
  badgeSecret: {
    fontSize: 11,
    fontWeight: 600,
    padding: '3px 9px',
    borderRadius: 4,
    background: '#f5f3ff',
    color: '#7c3aed',
    border: '1px solid #ddd6fe',
  },
  questionTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: '#18181b',
    margin: '0 0 6px',
    lineHeight: 1.45,
  },
  maskedTitle: { color: '#a1a1aa', fontStyle: 'italic', fontWeight: 500 },
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: '#71717a',
  },
  metaDot: { color: '#d4d4d8' },
  expandHint: {
    marginLeft: 'auto',
    color: '#a1a1aa',
    fontSize: 12,
  },
  body: {
    padding: '16px 20px 20px',
    borderTop: '1px dashed #e4e4e7',
    background: '#fafafa',
  },
  questionContent: {
    fontSize: 14,
    color: '#18181b',
    lineHeight: 1.6,
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  answerBox: {
    marginTop: 16,
    padding: '14px 16px',
    background: '#fff',
    borderRadius: 8,
    border: '1px solid #e4e4e7',
    borderLeft: '3px solid #18181b',
  },
  answerHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  answerBadge: {
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 10px',
    borderRadius: 4,
    background: '#18181b',
    color: '#fff',
    letterSpacing: '0.02em',
  },
  answerMeta: { fontSize: 12, color: '#71717a' },
  answerContent: {
    fontSize: 13.5,
    color: '#27272a',
    lineHeight: 1.6,
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  noAnswer: {
    marginTop: 16,
    padding: '12px 14px',
    background: '#fffbeb',
    border: '1px dashed #fed7aa',
    borderRadius: 8,
    fontSize: 13,
    color: '#92400e',
    textAlign: 'center',
  },
  maskedBody: {
    padding: '12px 20px 16px',
    fontSize: 12.5,
    color: '#71717a',
    fontStyle: 'italic',
    borderTop: '1px dashed #e4e4e7',
    background: '#faf5ff',
  },

  /* state */
  stateBox: {
    padding: '40px 20px',
    textAlign: 'center',
    background: '#fff',
    border: '1px solid #e4e4e7',
    borderRadius: 10,
  },
  stateText: { color: '#52525b', fontSize: 14, margin: '0 0 12px' },
  spinner: {
    width: 28,
    height: 28,
    margin: '0 auto 12px',
    border: '3px solid #e4e4e7',
    borderTop: '3px solid #18181b',
    borderRadius: '50%',
    animation: 'qna-spin 0.8s linear infinite',
  },
  retryBtn: {
    background: '#fff',
    border: '1px solid #d4d4d8',
    color: '#18181b',
    padding: '8px 16px',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  /* pagination */
  pagination: {
    marginTop: 24,
    display: 'flex',
    justifyContent: 'center',
    gap: 4,
  },
  pageBtn: {
    minWidth: 36,
    height: 36,
    background: '#fff',
    border: '1px solid #e4e4e7',
    color: '#52525b',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
    transition: 'all 0.15s ease',
    fontFamily: 'inherit',
  },
  pageBtnActive: {
    background: '#18181b',
    borderColor: '#18181b',
    color: '#fff',
    fontWeight: 700,
  },
  pageBtnDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
};

/* spinner keyframes — 한 번만 주입 */
if (typeof document !== 'undefined' && !document.getElementById('qna-list-keyframes')) {
  const style = document.createElement('style');
  style.id = 'qna-list-keyframes';
  style.textContent = `@keyframes qna-spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
}
