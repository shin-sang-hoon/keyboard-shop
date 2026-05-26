// frontend/src/pages/admin/AdminReviewQnaPage.jsx
//
// Phase 7-G R8 (2026-05-26) — 리뷰·Q&A 운영 페이지.
//
// 3개 탭 (페이지 내부 상태로 전환, 라우트는 /admin/reviews 하나):
//   1) 리뷰    — 전체 리뷰 목록 + 숨김/복원 토글 (숨김 시 공개 페이지·별점 통계에서 제외)
//   2) 신고 큐 — 사용자 신고 처리 (인용=리뷰 숨김 / 기각)
//   3) Q&A     — 미답변 큐 + 개별 답변 + 미답변 다건 일괄 답변
//
// 디자인: swagkey 화이트 톤 (AdminLayout / AdminProductPage 와 일관).
// 각 탭은 독립 컴포넌트 — 탭 전환 시 언마운트/리마운트로 항상 fresh load.

import { useState, useEffect, useCallback } from 'react';
import { colors, typography, spacing, radius, shadow, zIndex } from '../../styles/tokens';
import { adminReviewApi } from '../../api/adminReview';
import { adminQnaApi } from '../../api/adminQna';

const PAGE_SIZE = 20;

const TABS = [
  { id: 'reviews', label: '리뷰' },
  { id: 'reports', label: '신고' },
  { id: 'qna', label: 'Q&A' },
];

const REVIEW_FILTERS = [
  { value: '', label: '전체' },
  { value: 'false', label: '노출 중' },
  { value: 'true', label: '숨김' },
];

const REPORT_FILTERS = [
  { value: 'PENDING', label: '처리 대기' },
  { value: 'RESOLVED', label: '인용 완료' },
  { value: 'DISMISSED', label: '기각' },
  { value: '', label: '전체' },
];

const QNA_FILTERS = [
  { value: 'false', label: '미답변' },
  { value: 'true', label: '답변 완료' },
  { value: '', label: '전체' },
];

const STATUS_LABEL = { PENDING: '대기', RESOLVED: '인용', DISMISSED: '기각' };

// ────────────────────────────────────────────────────────────────────
// 공통 helper
// ────────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('ko-KR', {
    year: '2-digit', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function StatePanel({ children }) {
  return <div style={S.statePanel}>{children}</div>;
}

function Pager({ data, onPrev, onNext }) {
  if (!data || data.totalElements === 0) return null;
  return (
    <div style={S.pager}>
      <button
        type="button"
        style={{ ...S.pagerBtn, ...(data.first ? S.pagerBtnDisabled : null) }}
        disabled={data.first}
        onClick={onPrev}
      >
        ← 이전
      </button>
      <span style={S.pagerInfo}>
        {data.page + 1} / {Math.max(data.totalPages, 1)} 페이지 · 총 {data.totalElements}건
      </span>
      <button
        type="button"
        style={{ ...S.pagerBtn, ...(data.last ? S.pagerBtnDisabled : null) }}
        disabled={data.last}
        onClick={onNext}
      >
        다음 →
      </button>
    </div>
  );
}

function FilterBar({ options, value, onChange }) {
  return (
    <div style={S.filterBar}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value || 'all'}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{ ...S.filterChip, ...(active ? S.filterChipActive : null) }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function Stars({ rating }) {
  const r = Math.round((rating || 0) * 2) / 2;
  return (
    <span style={S.stars}>
      <span style={{ color: colors.warning }}>★</span> {r.toFixed(1)}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────
// 1) 리뷰 탭
// ────────────────────────────────────────────────────────────────────
function ReviewsTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, size: PAGE_SIZE };
      if (filter !== '') params.hidden = filter;
      const res = await adminReviewApi.listReviews(params);
      setData(res);
    } catch {
      setError('리뷰 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => { load(); }, [load]);

  const changeFilter = (v) => { setFilter(v); setPage(0); };

  const toggleHidden = async (review) => {
    const next = !review.hidden;
    const ok = window.confirm(
      next
        ? '이 리뷰를 숨김 처리할까요?\n숨긴 리뷰는 상품 페이지와 별점 통계에서 제외됩니다.'
        : '이 리뷰를 다시 노출할까요?'
    );
    if (!ok) return;
    setBusyId(review.id);
    try {
      await adminReviewApi.updateVisibility(review.id, next);
      await load();
    } catch {
      window.alert('상태 변경에 실패했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <FilterBar options={REVIEW_FILTERS} value={filter} onChange={changeFilter} />

      {loading && <StatePanel>불러오는 중…</StatePanel>}
      {error && <StatePanel><span style={{ color: colors.danger }}>{error}</span></StatePanel>}
      {!loading && !error && data && data.content.length === 0 && (
        <StatePanel>해당 조건의 리뷰가 없습니다.</StatePanel>
      )}

      {!loading && !error && data && data.content.length > 0 && (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>상품</th>
                <th style={S.th}>작성자</th>
                <th style={{ ...S.th, width: 90 }}>별점</th>
                <th style={S.th}>내용</th>
                <th style={{ ...S.th, width: 130 }}>작성일</th>
                <th style={{ ...S.th, width: 90 }}>상태</th>
                <th style={{ ...S.th, width: 100 }}>처리</th>
              </tr>
            </thead>
            <tbody>
              {data.content.map((r) => (
                <tr key={r.id} style={r.hidden ? S.rowHidden : null}>
                  <td style={S.td}>{r.productName}</td>
                  <td style={S.td}>{r.userName}</td>
                  <td style={S.td}><Stars rating={r.rating} /></td>
                  <td style={S.td}>
                    <div style={S.clamp2}>{r.content || <em style={S.muted}>(별점만)</em>}</div>
                  </td>
                  <td style={{ ...S.td, ...S.tdDim }}>{fmtDate(r.createdAt)}</td>
                  <td style={S.td}>
                    <span style={r.hidden ? S.badgeHidden : S.badgeVisible}>
                      {r.hidden ? '숨김' : '노출'}
                    </span>
                  </td>
                  <td style={S.td}>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => toggleHidden(r)}
                      style={{
                        ...S.actionBtn,
                        ...(r.hidden ? S.actionBtnNeutral : S.actionBtnDanger),
                        ...(busyId === r.id ? S.actionBtnBusy : null),
                      }}
                    >
                      {r.hidden ? '복원' : '숨김'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pager
        data={data}
        onPrev={() => setPage((p) => Math.max(0, p - 1))}
        onNext={() => setPage((p) => p + 1)}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// 2) 신고 큐 탭
// ────────────────────────────────────────────────────────────────────
function ReportsTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('PENDING');
  const [page, setPage] = useState(0);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, size: PAGE_SIZE };
      if (filter !== '') params.status = filter;
      const res = await adminReviewApi.listReports(params);
      setData(res);
    } catch {
      setError('신고 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => { load(); }, [load]);

  const changeFilter = (v) => { setFilter(v); setPage(0); };

  const handle = async (report, kind) => {
    const ok = window.confirm(
      kind === 'resolve'
        ? '이 신고를 인용할까요?\n대상 리뷰가 숨김 처리되고, 같은 리뷰의 다른 대기 신고도 함께 처리됩니다.'
        : '이 신고를 기각할까요?\n리뷰는 그대로 노출됩니다.'
    );
    if (!ok) return;
    setBusyId(report.reportId);
    try {
      if (kind === 'resolve') await adminReviewApi.resolveReport(report.reportId);
      else await adminReviewApi.dismissReport(report.reportId);
      await load();
    } catch {
      window.alert('처리에 실패했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <FilterBar options={REPORT_FILTERS} value={filter} onChange={changeFilter} />

      {loading && <StatePanel>불러오는 중…</StatePanel>}
      {error && <StatePanel><span style={{ color: colors.danger }}>{error}</span></StatePanel>}
      {!loading && !error && data && data.content.length === 0 && (
        <StatePanel>해당 조건의 신고가 없습니다.</StatePanel>
      )}

      {!loading && !error && data && data.content.length > 0 && (
        <div style={S.cardList}>
          {data.content.map((rp) => (
            <div key={rp.reportId} style={S.reportCard}>
              <div style={S.reportHead}>
                <div style={S.reportHeadLeft}>
                  <span style={S.reasonBadge}>{rp.reasonLabel}</span>
                  <span style={statusBadgeStyle(rp.status)}>{STATUS_LABEL[rp.status]}</span>
                </div>
                <span style={S.tdDim}>{fmtDate(rp.reportedAt)}</span>
              </div>

              {rp.detail && <div style={S.reportDetail}>“{rp.detail}”</div>}
              <div style={S.reportMeta}>
                신고자 <strong>{rp.reporterName}</strong>
                {rp.handledByName && (
                  <> · 처리 <strong>{rp.handledByName}</strong> ({fmtDate(rp.handledAt)})</>
                )}
              </div>

              {/* 신고된 리뷰 스냅샷 */}
              <div style={S.reportedReview}>
                <div style={S.reportedReviewTop}>
                  <span style={S.reportedProduct}>{rp.productName}</span>
                  <Stars rating={rp.reviewRating} />
                  <span style={S.tdDim}>작성자 {rp.reviewAuthorName}</span>
                  {rp.reviewHidden && <span style={S.badgeHidden}>숨김 상태</span>}
                </div>
                <div style={S.reportedReviewContent}>
                  {rp.reviewContent || <em style={S.muted}>(별점만)</em>}
                </div>
              </div>

              {rp.status === 'PENDING' && (
                <div style={S.reportActions}>
                  <button
                    type="button"
                    disabled={busyId === rp.reportId}
                    onClick={() => handle(rp, 'resolve')}
                    style={{
                      ...S.actionBtn, ...S.actionBtnDanger,
                      ...(busyId === rp.reportId ? S.actionBtnBusy : null),
                    }}
                  >
                    인용 (리뷰 숨김)
                  </button>
                  <button
                    type="button"
                    disabled={busyId === rp.reportId}
                    onClick={() => handle(rp, 'dismiss')}
                    style={{
                      ...S.actionBtn, ...S.actionBtnNeutral,
                      ...(busyId === rp.reportId ? S.actionBtnBusy : null),
                    }}
                  >
                    기각
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Pager
        data={data}
        onPrev={() => setPage((p) => Math.max(0, p - 1))}
        onNext={() => setPage((p) => p + 1)}
      />
    </div>
  );
}

function statusBadgeStyle(status) {
  if (status === 'PENDING') return { ...S.statusBadge, background: colors.warningSoft, color: colors.warning };
  if (status === 'RESOLVED') return { ...S.statusBadge, background: colors.dangerSoft, color: colors.danger };
  return { ...S.statusBadge, background: colors.surfaceMuted, color: colors.textOnLightDim };
}

// ────────────────────────────────────────────────────────────────────
// 3) Q&A 탭
// ────────────────────────────────────────────────────────────────────
function QnaTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('false'); // 기본 = 미답변 큐
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(() => new Set());
  const [modal, setModal] = useState(null); // { mode:'single'|'batch', qna?, ids? }
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, size: PAGE_SIZE };
      if (filter !== '') params.answered = filter;
      const res = await adminQnaApi.list(params);
      setData(res);
    } catch {
      setError('Q&A 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => { load(); }, [load]);

  // 페이지/필터가 바뀌면 선택 초기화 (다른 페이지 항목까지 일괄 답변되는 혼선 방지)
  useEffect(() => { setSelected(new Set()); }, [filter, page]);

  const changeFilter = (v) => { setFilter(v); setPage(0); };

  const unanswered = (data?.content || []).filter((q) => !q.answered);

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected((prev) => {
      const allIds = unanswered.map((q) => q.id);
      const allSelected = allIds.length > 0 && allIds.every((id) => prev.has(id));
      return allSelected ? new Set() : new Set(allIds);
    });
  };

  const submitAnswer = async (text) => {
    setSubmitting(true);
    try {
      if (modal.mode === 'single') {
        await adminQnaApi.answer(modal.qna.id, text);
      } else {
        const result = await adminQnaApi.batchAnswer(modal.ids, text);
        const msg =
          `일괄 답변 완료 — ${result.answered}건 처리` +
          (result.skipped > 0 ? `, ${result.skipped}건 건너뜀(이미 답변됨)` : '');
        window.alert(msg);
      }
      setModal(null);
      setSelected(new Set());
      await load();
    } catch {
      window.alert('답변 저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const allUnansweredSelected =
    unanswered.length > 0 && unanswered.every((q) => selected.has(q.id));

  return (
    <div>
      <FilterBar options={QNA_FILTERS} value={filter} onChange={changeFilter} />

      {selected.size > 0 && (
        <div style={S.batchBar}>
          <span><strong>{selected.size}건</strong> 선택됨</span>
          <div style={{ display: 'flex', gap: spacing[2] }}>
            <button
              type="button"
              style={{ ...S.actionBtn, ...S.actionBtnPrimary }}
              onClick={() => setModal({ mode: 'batch', ids: [...selected] })}
            >
              선택 항목 일괄 답변
            </button>
            <button
              type="button"
              style={{ ...S.actionBtn, ...S.actionBtnNeutral }}
              onClick={() => setSelected(new Set())}
            >
              선택 해제
            </button>
          </div>
        </div>
      )}

      {loading && <StatePanel>불러오는 중…</StatePanel>}
      {error && <StatePanel><span style={{ color: colors.danger }}>{error}</span></StatePanel>}
      {!loading && !error && data && data.content.length === 0 && (
        <StatePanel>해당 조건의 Q&A가 없습니다.</StatePanel>
      )}

      {!loading && !error && data && data.content.length > 0 && (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={{ ...S.th, width: 40 }}>
                  <input
                    type="checkbox"
                    checked={allUnansweredSelected}
                    onChange={toggleSelectAll}
                    disabled={unanswered.length === 0}
                    title="이 페이지의 미답변 전체 선택"
                  />
                </th>
                <th style={S.th}>상품</th>
                <th style={S.th}>질문자</th>
                <th style={S.th}>질문</th>
                <th style={{ ...S.th, width: 130 }}>작성일</th>
                <th style={{ ...S.th, width: 90 }}>상태</th>
                <th style={{ ...S.th, width: 90 }}>답변</th>
              </tr>
            </thead>
            <tbody>
              {data.content.map((q) => (
                <tr key={q.id}>
                  <td style={S.td}>
                    {!q.answered && (
                      <input
                        type="checkbox"
                        checked={selected.has(q.id)}
                        onChange={() => toggleSelect(q.id)}
                      />
                    )}
                  </td>
                  <td style={S.td}>{q.productName}</td>
                  <td style={S.td}>{q.userName}</td>
                  <td style={S.td}>
                    {q.secret && <span style={S.secretBadge}>🔒 비밀글</span>}
                    <div style={S.clamp2}>{q.content}</div>
                    {q.answered && (
                      <div style={S.answerPreview}>
                        <span style={S.answerLabel}>답변</span>
                        <span style={S.clamp2}>{q.answerContent}</span>
                      </div>
                    )}
                  </td>
                  <td style={{ ...S.td, ...S.tdDim }}>{fmtDate(q.createdAt)}</td>
                  <td style={S.td}>
                    <span style={q.answered ? S.badgeAnswered : S.badgePending}>
                      {q.answered ? '답변완료' : '미답변'}
                    </span>
                  </td>
                  <td style={S.td}>
                    <button
                      type="button"
                      onClick={() => setModal({ mode: 'single', qna: q })}
                      style={{
                        ...S.actionBtn,
                        ...(q.answered ? S.actionBtnNeutral : S.actionBtnPrimary),
                      }}
                    >
                      {q.answered ? '수정' : '답변'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pager
        data={data}
        onPrev={() => setPage((p) => Math.max(0, p - 1))}
        onNext={() => setPage((p) => p + 1)}
      />

      {modal && (
        <AnswerModal
          modal={modal}
          submitting={submitting}
          onClose={() => !submitting && setModal(null)}
          onSubmit={submitAnswer}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// 답변 모달 (개별 / 일괄 공용)
// ────────────────────────────────────────────────────────────────────
function AnswerModal({ modal, submitting, onClose, onSubmit }) {
  const isSingle = modal.mode === 'single';
  const [text, setText] = useState(
    isSingle ? modal.qna.answerContent || '' : ''
  );

  const handleSubmit = () => {
    if (!text.trim()) {
      window.alert('답변 내용을 입력해 주세요.');
      return;
    }
    onSubmit(text.trim());
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={S.modalTitle}>
          {isSingle
            ? (modal.qna.answered ? '답변 수정' : '답변 작성')
            : `일괄 답변 — ${modal.ids.length}건`}
        </h3>

        {isSingle ? (
          <div style={S.modalQuestion}>
            {modal.qna.secret && <span style={S.secretBadge}>🔒 비밀글</span>}
            <div style={S.modalQuestionText}>{modal.qna.content}</div>
            <div style={S.tdDim}>
              {modal.qna.productName} · {modal.qna.userName}
            </div>
          </div>
        ) : (
          <p style={S.modalHint}>
            선택한 미답변 Q&A {modal.ids.length}건에 동일한 답변이 적용됩니다.
            이미 답변된 항목은 자동으로 건너뜁니다.
          </p>
        )}

        <textarea
          style={S.textarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="답변 내용을 입력하세요 (최대 2000자)"
          maxLength={2000}
          rows={6}
          autoFocus
        />
        <div style={S.charCount}>{text.length} / 2000</div>

        <div style={S.modalActions}>
          <button
            type="button"
            style={{ ...S.actionBtn, ...S.actionBtnNeutral }}
            onClick={onClose}
            disabled={submitting}
          >
            취소
          </button>
          <button
            type="button"
            style={{
              ...S.actionBtn, ...S.actionBtnPrimary,
              ...(submitting ? S.actionBtnBusy : null),
            }}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? '저장 중…' : '답변 등록'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// 메인 — 탭 셸
// ────────────────────────────────────────────────────────────────────
export default function AdminReviewQnaPage() {
  const [tab, setTab] = useState('reviews');

  return (
    <div style={S.root}>
      <div style={S.tabBar}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{ ...S.tab, ...(tab === t.id ? S.tabActive : null) }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={S.tabBody}>
        {tab === 'reviews' && <ReviewsTab />}
        {tab === 'reports' && <ReportsTab />}
        {tab === 'qna' && <QnaTab />}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// 스타일 — swagkey 화이트 톤
// ────────────────────────────────────────────────────────────────────
const S = {
  root: { fontFamily: typography.fontFamily.base },

  // ─── 탭 바 ───
  tabBar: {
    display: 'flex',
    gap: spacing[1],
    borderBottom: `1px solid ${colors.borderLight}`,
    marginBottom: spacing[5],
  },
  tab: {
    padding: `10px ${spacing[5]}`,
    border: 'none',
    background: 'transparent',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
    color: colors.textOnLightDim,
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    marginBottom: -1,
    transition: 'all 0.12s ease',
  },
  tabActive: {
    color: colors.accent,
    fontWeight: typography.fontWeight.bold,
    borderBottom: `2px solid ${colors.accent}`,
  },
  tabBody: { minHeight: 200 },

  // ─── 필터 바 ───
  filterBar: { display: 'flex', gap: spacing[2], marginBottom: spacing[4] },
  filterChip: {
    padding: `6px ${spacing[4]}`,
    borderRadius: radius.pill,
    border: `1px solid ${colors.borderLight}`,
    background: colors.white,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textOnLightDim,
    cursor: 'pointer',
    transition: 'all 0.12s ease',
  },
  filterChipActive: {
    background: colors.accent,
    borderColor: colors.accent,
    color: '#fff',
    fontWeight: typography.fontWeight.semibold,
  },

  // ─── 상태 패널 ───
  statePanel: {
    padding: `${spacing[12]} ${spacing[6]}`,
    textAlign: 'center',
    color: colors.textOnLightDim,
    fontSize: typography.fontSize.base,
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.lg,
  },

  // ─── 테이블 ───
  tableWrap: {
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.lg,
    overflow: 'hidden',
    boxShadow: shadow.card,
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.base },
  th: {
    textAlign: 'left',
    padding: `11px ${spacing[3]}`,
    background: colors.surfaceMuted,
    color: colors.textOnLightDim,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    borderBottom: `1px solid ${colors.borderLight}`,
    whiteSpace: 'nowrap',
  },
  td: {
    padding: `11px ${spacing[3]}`,
    borderBottom: `1px solid ${colors.borderLight}`,
    color: colors.textOnLight,
    verticalAlign: 'top',
  },
  tdDim: { color: colors.textOnLightDim, fontSize: typography.fontSize.sm, whiteSpace: 'nowrap' },
  rowHidden: { background: colors.surfaceMuted },
  muted: { color: colors.textOnLightDim },
  clamp2: {
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    lineHeight: typography.lineHeight.base,
    maxWidth: 360,
  },
  stars: { whiteSpace: 'nowrap', fontWeight: typography.fontWeight.semibold },

  // ─── 배지 ───
  badgeVisible: {
    display: 'inline-block', padding: '2px 9px', borderRadius: radius.pill,
    background: colors.successSoft, color: colors.success,
    fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold,
  },
  badgeHidden: {
    display: 'inline-block', padding: '2px 9px', borderRadius: radius.pill,
    background: colors.surfaceMuted, color: colors.textOnLightDim,
    fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold,
  },
  badgeAnswered: {
    display: 'inline-block', padding: '2px 9px', borderRadius: radius.pill,
    background: colors.accentSoft, color: colors.accent,
    fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold,
  },
  badgePending: {
    display: 'inline-block', padding: '2px 9px', borderRadius: radius.pill,
    background: colors.warningSoft, color: colors.warning,
    fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold,
  },
  secretBadge: {
    display: 'inline-block', marginBottom: 4, padding: '1px 7px',
    borderRadius: radius.sm, background: colors.surfaceMuted,
    color: colors.textOnLightDim, fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  statusBadge: {
    display: 'inline-block', padding: '2px 9px', borderRadius: radius.pill,
    fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold,
  },
  reasonBadge: {
    display: 'inline-block', padding: '2px 9px', borderRadius: radius.sm,
    background: colors.dangerSoft, color: colors.danger,
    fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold,
  },

  // ─── 액션 버튼 ───
  actionBtn: {
    padding: `6px ${spacing[3]}`,
    borderRadius: radius.md,
    border: '1px solid transparent',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.12s ease',
  },
  actionBtnPrimary: { background: colors.accent, color: '#fff' },
  actionBtnDanger: { background: colors.danger, color: '#fff' },
  actionBtnNeutral: {
    background: colors.white, color: colors.textOnLightDim,
    borderColor: colors.borderLight,
  },
  actionBtnBusy: { opacity: 0.55, cursor: 'progress' },

  // ─── 페이저 ───
  pager: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: spacing[4], marginTop: spacing[5],
  },
  pagerBtn: {
    padding: `7px ${spacing[4]}`, borderRadius: radius.md,
    border: `1px solid ${colors.borderLight}`, background: colors.white,
    fontSize: typography.fontSize.sm, color: colors.textOnLight,
    cursor: 'pointer', fontWeight: typography.fontWeight.medium,
  },
  pagerBtnDisabled: { opacity: 0.4, cursor: 'not-allowed' },
  pagerInfo: { fontSize: typography.fontSize.sm, color: colors.textOnLightDim },

  // ─── 신고 카드 ───
  cardList: { display: 'flex', flexDirection: 'column', gap: spacing[3] },
  reportCard: {
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.lg,
    padding: spacing[4],
    boxShadow: shadow.card,
  },
  reportHead: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  reportHeadLeft: { display: 'flex', alignItems: 'center', gap: spacing[2] },
  reportDetail: {
    fontSize: typography.fontSize.base, color: colors.textOnLight,
    background: colors.surfaceMuted, borderRadius: radius.md,
    padding: `8px ${spacing[3]}`, marginBottom: spacing[2],
  },
  reportMeta: {
    fontSize: typography.fontSize.sm, color: colors.textOnLightDim,
    marginBottom: spacing[3],
  },
  reportedReview: {
    background: colors.surface,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.md,
    padding: spacing[3],
  },
  reportedReviewTop: {
    display: 'flex', alignItems: 'center', gap: spacing[3],
    flexWrap: 'wrap', marginBottom: 6,
  },
  reportedProduct: {
    fontWeight: typography.fontWeight.bold, color: colors.textOnLight,
    fontSize: typography.fontSize.base,
  },
  reportedReviewContent: {
    fontSize: typography.fontSize.base, color: colors.textOnLight,
    lineHeight: typography.lineHeight.base,
  },
  reportActions: { display: 'flex', gap: spacing[2], marginTop: spacing[3] },

  // ─── Q&A 답변 미리보기 ───
  answerPreview: {
    marginTop: 6, paddingLeft: spacing[3],
    borderLeft: `2px solid ${colors.accentSoft}`,
    fontSize: typography.fontSize.sm, color: colors.textOnLightDim,
  },
  answerLabel: {
    display: 'inline-block', marginRight: 6,
    color: colors.accent, fontWeight: typography.fontWeight.bold,
  },

  // ─── 일괄 답변 바 ───
  batchBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: colors.accentSoft,
    border: `1px solid ${colors.accent}`,
    borderRadius: radius.md,
    padding: `10px ${spacing[4]}`,
    marginBottom: spacing[4],
    fontSize: typography.fontSize.base,
    color: colors.textOnLight,
  },

  // ─── 모달 ───
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(15, 23, 42, 0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: zIndex.modalBackdrop,
    padding: spacing[4],
  },
  modal: {
    background: colors.white,
    borderRadius: radius.xl,
    padding: spacing[6],
    width: '100%', maxWidth: 520,
    boxShadow: shadow.lg,
    zIndex: zIndex.modal,
  },
  modalTitle: {
    margin: 0, marginBottom: spacing[4],
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textOnLight,
  },
  modalQuestion: {
    background: colors.surface,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.md,
    padding: spacing[3],
    marginBottom: spacing[4],
  },
  modalQuestionText: {
    fontSize: typography.fontSize.base, color: colors.textOnLight,
    lineHeight: typography.lineHeight.base, marginBottom: 4,
  },
  modalHint: {
    fontSize: typography.fontSize.sm, color: colors.textOnLightDim,
    background: colors.surface, borderRadius: radius.md,
    padding: spacing[3], marginBottom: spacing[4],
    lineHeight: typography.lineHeight.base,
  },
  textarea: {
    width: '100%', boxSizing: 'border-box',
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.md,
    padding: spacing[3],
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.base,
    lineHeight: typography.lineHeight.base,
    resize: 'vertical',
  },
  charCount: {
    textAlign: 'right', fontSize: typography.fontSize.xs,
    color: colors.textOnLightDim, marginTop: 4,
  },
  modalActions: {
    display: 'flex', justifyContent: 'flex-end',
    gap: spacing[2], marginTop: spacing[4],
  },
};
