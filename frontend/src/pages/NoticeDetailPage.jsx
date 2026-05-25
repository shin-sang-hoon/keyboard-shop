// frontend/src/pages/NoticeDetailPage.jsx
// Phase 7-B — 사용자 공지 DB 연동 + 첨부 이미지 + ADMIN 수정/삭제.
//
// 7-B 변경:
//   - data/notices.js 더미 → api/notices.js (getNotice / incrementNoticeView).
//   - 동기 렌더 → 비동기 (loading / error 상태).
//   - 상세 응답에 prev/next + attachments 가 통합되어 옴 (왕복 1회).
//   - 조회수 증가는 별도 POST. 자산 #18 패턴: StrictMode 이중 마운트에서도
//     useRef 가드로 정확히 1회만 POST.
//   - 첨부 이미지: 본문 아래에 등록 순서대로 나열.
//   - ADMIN 이면 하단에 [수정]/[삭제] (수정은 NoticeFormModal 재사용).
//     USER 는 [글쓰기] → "관리자만 작성할 수 있습니다" 안내.

import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { getNotice, incrementNoticeView } from '../api/notices';
import { adminNoticeApi } from '../api/adminNotice';
import { useAuth } from '../hooks/useAuth';
import NoticeFormModal from '../components/NoticeFormModal';
import { colors, typography, spacing, radius } from '../styles/tokens';

// 첨부 이미지 URL 절대경로화 — 백엔드 url 은 /uploads/... 상대경로라
// 그대로 쓰면 Vite dev(5173)로 가서 404. API origin(8080)을 앞에 붙인다.
const FILE_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api')
  .replace(/\/api\/?$/, '');
function fileUrl(path) {
  if (!path) return '';
  return /^https?:\/\//.test(path) ? path : FILE_BASE + path;
}

const ADJACENT_HOVER_CSS = `
.sw-adjacent-row { transition: background 0.15s; }
.sw-adjacent-row:hover { background: rgba(0,0,0,0.02); }
.sw-adjacent-row:hover .sw-adjacent-title { text-decoration: underline; text-underline-offset: 3px; }
.sw-adjacent-row:not(:last-child) { border-bottom: 1px solid rgba(0,0,0,0.08); }
`;

export default function NoticeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);   // 수정 직후 상세 재조회 트리거
  const [editOpen, setEditOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);  // 상세에서 새 공지 작성

  // 조회수 POST 를 이미 보낸 공지 id — StrictMode double-mount 이중 호출 방지.
  const viewCountedRef = useRef(null);
  // POST 로 증가된 최신 조회수 — 상세 GET 과의 응답 순서 race 보정용.
  const bumpedCountRef = useRef(null);

  // 상세 fetch — 본문 + 첨부 + 이전/다음 글이 한 응답에 통합되어 온다.
  // id 또는 reloadKey(수정 직후)가 바뀌면 재조회.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    getNotice(id)
      .then((data) => {
        if (cancelled) return;
        // 조회수 POST 가 GET 보다 먼저 끝났다면 그 값으로 보정한다.
        const bumped = bumpedCountRef.current;
        setNotice(
          bumped && String(bumped.id) === String(id)
            ? { ...data, viewCount: bumped.count }
            : data
        );
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  // 조회수 +1 — GET 멱등성 보존을 위해 별도 POST.
  // 자산 #18 패턴: StrictMode dev 이중 마운트에서도 useRef 가드로 1회만 호출.
  // id 가 바뀌면(이전/다음 글 이동) 새 id 기준으로 다시 1회 카운트한다.
  useEffect(() => {
    if (viewCountedRef.current === id) return;
    viewCountedRef.current = id;
    incrementNoticeView(id)
      .then((res) => {
        bumpedCountRef.current = { id, count: res.viewCount };
        setNotice((prev) =>
          prev && String(prev.id) === String(id)
            ? { ...prev, viewCount: res.viewCount }
            : prev
        );
      })
      .catch(() => {
        /* 조회수 증가 실패는 공지 열람 자체에 영향이 없으므로 무시한다. */
      });
  }, [id]);

  // 글쓰기 (USER) — 안내용. ADMIN 은 글쓰기 대신 수정/삭제 버튼이 보인다.
  const handleWrite = () => alert('관리자만 작성할 수 있습니다.');

  // 수정 완료 — 모달 닫고 상세 재조회.
  const handleEdited = () => {
    setEditOpen(false);
    setReloadKey((k) => k + 1);
  };

  // 새 공지 작성 완료 — 모달 닫고, 방금 만든 공지 상세로 이동.
  const handleCreated = (saved) => {
    setCreateOpen(false);
    if (saved?.id) navigate(`/notices/${saved.id}`);
  };

  // 삭제 (ADMIN) — 확인 후 삭제하고 목록으로.
  const handleDelete = async () => {
    if (!notice) return;
    const ok = window.confirm(
      `"${notice.title}"\n\n이 공지를 삭제할까요? 이 작업은 되돌릴 수 없습니다.`
    );
    if (!ok) return;
    try {
      await adminNoticeApi.remove(id);
      navigate('/', { state: { scrollTo: 'notices' } });
    } catch (e) {
      alert(e?.response?.data?.message || '삭제에 실패했습니다.');
    }
  };

  // 로딩 중
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>공지사항을 불러오는 중...</div>
      </div>
    );
  }

  // 존재하지 않는 id / 로드 실패
  if (error || !notice) {
    return (
      <div style={styles.container}>
        <div style={styles.notFound}>
          <h2 style={styles.notFoundTitle}>공지사항을 찾을 수 없습니다</h2>
          <p style={styles.notFoundDesc}>요청하신 공지(#{id})가 존재하지 않거나 삭제되었습니다.</p>
          <button onClick={() => navigate('/')} style={styles.btnPrimary}>
            메인으로
          </button>
        </div>
      </div>
    );
  }

  // 상세 응답에 통합되어 온 인접 글 ({ id, title } 또는 null)과 첨부.
  const prev = notice.prev;
  const next = notice.next;
  const attachments = notice.attachments || [];

  return (
    <div style={styles.container}>
      <style>{ADJACENT_HOVER_CSS}</style>

      <article style={styles.article}>
        {/* 제목 */}
        <h1 style={styles.title}>{notice.title}</h1>

        {/* 메타 */}
        <div style={styles.meta}>
          <span style={styles.metaItem}>관리자</span>
          <span style={styles.metaSep}>·</span>
          <span style={styles.metaItem}>{(notice.createdAt || '').slice(0, 10)}</span>
          <span style={styles.metaSep}>·</span>
          <span style={styles.metaItem}>조회수 {(notice.viewCount ?? 0).toLocaleString()}</span>
        </div>

        {/* 본문 */}
        <div style={styles.content}>{notice.content}</div>

        {/* 첨부 이미지 — 본문 아래에 등록 순서대로 나열 */}
        {attachments.length > 0 && (
          <div style={styles.attachments}>
            {attachments.map((a) => (
              <img
                key={a.id}
                src={fileUrl(a.url)}
                alt={a.originalName}
                style={styles.attachmentImg}
              />
            ))}
          </div>
        )}
      </article>

      {/* 이전/다음 글 토글 */}
      {(prev || next) && (
        <div style={styles.adjacent}>
          {next && (
            <Link
              to={`/notices/${next.id}`}
              className="sw-adjacent-row"
              style={styles.adjacentRow}
            >
              <span style={styles.adjacentLabel}>▼ 다음 글</span>
              <span className="sw-adjacent-title" style={styles.adjacentTitle}>{next.title}</span>
            </Link>
          )}
          {prev && (
            <Link
              to={`/notices/${prev.id}`}
              className="sw-adjacent-row"
              style={styles.adjacentRow}
            >
              <span style={styles.adjacentLabel}>▲ 이전 글</span>
              <span className="sw-adjacent-title" style={styles.adjacentTitle}>{prev.title}</span>
            </Link>
          )}
        </div>
      )}

      {/* 하단 액션 — 좌: 목록 / 우: ADMIN 이면 수정·삭제, USER 면 글쓰기 */}
      <div style={styles.actions}>
        <button
          onClick={() => navigate('/', { state: { scrollTo: 'notices' } })}
          style={styles.btnGhost}
        >목록</button>

        {isAdmin ? (
          <div style={styles.adminActions}>
            <button onClick={() => setCreateOpen(true)} style={styles.btnGhost}>+ 새 공지</button>
            <button onClick={() => setEditOpen(true)} style={styles.btnGhost}>수정</button>
            <button onClick={handleDelete} style={styles.btnDanger}>삭제</button>
          </div>
        ) : (
          <button onClick={handleWrite} style={styles.btnGhost}>글쓰기</button>
        )}
      </div>

      {/* ADMIN 수정 모달 */}
      {editOpen && (
        <NoticeFormModal
          mode="edit"
          noticeId={id}
          onClose={() => setEditOpen(false)}
          onSaved={handleEdited}
        />
      )}

      {/* ADMIN 새 공지 작성 모달 — 상세에서 바로 다음 글 작성 */}
      {createOpen && (
        <NoticeFormModal
          mode="create"
          onClose={() => setCreateOpen(false)}
          onSaved={handleCreated}
        />
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: `${spacing[12]} ${spacing[6]}`,
    fontFamily: typography.fontFamily.base,
    color: colors.textOnLight,
    minHeight: 'calc(100vh - 300px)',
  },
  loading: {
    textAlign: 'center',
    padding: `${spacing[20]} ${spacing[6]}`,
    fontSize: typography.fontSize.base,
    color: colors.textOnLightDim,
  },
  article: {
    paddingBottom: spacing[10],
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textOnLight,
    marginBottom: spacing[5],
    lineHeight: 1.4,
    letterSpacing: '-0.01em',
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    paddingBottom: spacing[8],
    borderBottom: `1px solid ${colors.borderLight}`,
    fontSize: typography.fontSize.sm,
    color: colors.textOnLightDim,
  },
  metaItem: {
    color: colors.textOnLightDim,
  },
  metaSep: {
    color: colors.borderLight,
  },
  content: {
    paddingTop: spacing[10],
    fontSize: typography.fontSize.base,
    color: colors.textOnLight,
    lineHeight: 1.8,
    whiteSpace: 'pre-line',
    minHeight: 200,
  },
  // 7-B 신규: 첨부 이미지 — 본문 아래 세로 나열
  attachments: {
    marginTop: spacing[8],
    display: 'flex',
    flexDirection: 'column',
    gap: spacing[4],
  },
  attachmentImg: {
    display: 'block',
    maxWidth: '100%',
    height: 'auto',
    borderRadius: radius.sm,
    border: `1px solid ${colors.borderLight}`,
  },
  adjacent: {
    marginTop: spacing[10],
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.sm,
    overflow: 'hidden',
    background: colors.white,
  },
  adjacentRow: {
    display: 'flex',
    alignItems: 'center',
    padding: `${spacing[4]} ${spacing[5]}`,
    textDecoration: 'none',
    color: colors.textOnLight,
    gap: spacing[6],
    background: colors.white,
  },
  adjacentLabel: {
    color: colors.textOnLightDim,
    fontSize: typography.fontSize.sm,
    flexShrink: 0,
    minWidth: 80,
  },
  adjacentTitle: {
    flex: 1,
    color: colors.textOnLight,
    fontSize: typography.fontSize.sm,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  actions: {
    marginTop: spacing[10],
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  adminActions: {
    display: 'flex',
    gap: spacing[2],
  },
  btnGhost: {
    padding: `${spacing[3]} ${spacing[8]}`,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textOnLight,
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.sm,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.15s',
  },
  btnDanger: {
    padding: `${spacing[3]} ${spacing[8]}`,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.danger,
    background: colors.white,
    border: '1px solid #fecaca',
    borderRadius: radius.sm,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.15s',
  },
  btnPrimary: {
    padding: `${spacing[3]} ${spacing[10]}`,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
    background: colors.textOnLight,
    border: 'none',
    borderRadius: radius.sm,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  notFound: {
    textAlign: 'center',
    padding: `${spacing[20]} ${spacing[6]}`,
  },
  notFoundTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textOnLight,
    marginBottom: spacing[3],
  },
  notFoundDesc: {
    fontSize: typography.fontSize.base,
    color: colors.textOnLightDim,
    marginBottom: spacing[8],
  },
};
