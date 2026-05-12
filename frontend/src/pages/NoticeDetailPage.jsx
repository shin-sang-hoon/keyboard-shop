// frontend/src/pages/NoticeDetailPage.jsx
// 5-B 라운드 3-S - 다음/이전 글 토글 박스 디자인으로 복구.
//
// 변경 사항 (3-R → 3-S):
//   - 외곽 박스 (border + borderRadius) 부활 (라운드 3-O 디자인으로 복구)
//   - "▼ 다음 글" / "▲ 이전 글" 라벨 부활 (텍스트 라벨 + 화살표)
//   - next 위, prev 아래 (일반 게시판 관행)
//   - hover CSS 패턴 그대로 유지 (.sw-adjacent-row:hover)
//
// 그 외 본문/메타/액션 영역은 라운드 3-R 그대로 유지.

import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { findNoticeById, findAdjacent } from '../data/notices';
import { colors, typography, spacing, radius } from '../styles/tokens';

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

  const notice = findNoticeById(id);
  const { prev, next } = findAdjacent(id);

  // 존재하지 않는 id
  if (!notice) {
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

  const handleWrite = () => {
    if (user?.role === 'ADMIN') {
      alert('Phase 7 — 관리자 공지 작성 페이지에서 처리됩니다.');
    } else {
      alert('작성 권한이 없습니다.');
    }
  };

  return (
    <div style={styles.container}>
      <style>{ADJACENT_HOVER_CSS}</style>

      <article style={styles.article}>
        {/* 제목 */}
        <h1 style={styles.title}>{notice.title}</h1>

        {/* 메타 */}
        <div style={styles.meta}>
          <span style={styles.metaItem}>공지사항</span>
          <span style={styles.metaSep}>·</span>
          <span style={styles.metaItem}>{notice.date}</span>
          <span style={styles.metaSep}>·</span>
          <span style={styles.metaItem}>조회수 {notice.viewCount.toLocaleString()}</span>
        </div>

        {/* 본문 */}
        <div style={styles.content}>{notice.content}</div>
      </article>

      {/* 이전/다음 글 토글 — 3-S: 박스 디자인 복구 (라운드 3-O 톤) */}
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

      {/* 하단 액션 */}
      <div style={styles.actions}>
        <button onClick={() => navigate('/')} style={styles.btnGhost}>목록</button>
        <button onClick={handleWrite} style={styles.btnGhost}>글쓰기</button>
      </div>
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
  // 3-S: 박스 디자인 복구 — 외곽 border + radius
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
  // 3-S 신규: 라벨 (▼ 다음 글 / ▲ 이전 글)
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
