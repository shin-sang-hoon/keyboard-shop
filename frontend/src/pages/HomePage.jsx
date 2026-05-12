// frontend/src/pages/HomePage.jsx
// 5-B 라운드 3-S - swagkey 매칭 정밀화.
//
// 변경 사항 (3-R → 3-S):
//   1) heroStyles.cta:
//      - padding: spacing[5] spacing[16] → spacing[3] spacing[10] (swagkey 첫 번째 이미지 사이즈로 원복)
//      - fontSize: 22 / fontWeight: medium 유지
//      - .sw-hero-cta 클래스로 hover 시 흰 배경 + 검은 글씨 전환 (스크린샷 2)
//
//   2) NoticeBoard:
//      - 3컬럼(No/제목/작성일) → 4컬럼(No/제목/작성시간/조회수) (스크린샷 3 매칭)
//      - notices.js 의 n.viewCount 필드 사용
//      - 헤더 톤 미세 조정: 굵은 2px 검정 → 1px 회색 가는 라인 (위/아래)
//      - 우측 하단 [글쓰기] 버튼 추가, 호버 시 검정 채움, 클릭 → "작성 권한이 없습니다"
//
// 그 외 모든 섹션(Hero 본체/HomeProductCard/ProductSection)은 라운드 3-R 그대로 유지.

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { colors, typography, spacing, radius } from '../styles/tokens';
import { ALL_NOTICES } from '../data/notices';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const SECTIONS = [
  { title: 'NEW ARRIVALS', size: 6 },
  { title: 'KEYBOARD', productType: 'KEYBOARD', size: 6 },
  { title: 'KEYCAPS', productType: 'KEYCAP', size: 6 },
  { title: 'SWITCHES', productType: 'SWITCH_PART', size: 6 },
  { title: 'ACCESSORIES', productType: 'ACCESSORY', size: 6 },
];

// ─── HERO CTA HOVER CSS (3-S 신규) ───────────────────────────────────────────
const HERO_CTA_CSS = `
.sw-hero-cta { transition: background 0.25s ease, color 0.25s ease; }
.sw-hero-cta:hover { background: #ffffff !important; color: #000000 !important; }
`;

// ─── HERO ────────────────────────────────────────────────────────────────────
function Hero() {
  const [featured, setFeatured] = useState(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE}/products?productType=KEYBOARD&size=1`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        if (data.content?.[0]) setFeatured(data.content[0]);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!featured?.imageUrl) {
      setImgLoaded(false);
      return;
    }
    const img = new Image();
    img.onload = () => setImgLoaded(true);
    img.onerror = () => setImgLoaded(false);
    img.src = featured.imageUrl;
  }, [featured?.imageUrl]);

  const ctaTo = featured ? `/products/${featured.id}` : '/products?productType=KEYBOARD';
  const title = featured?.name || 'SWACHRON Custom Keyboards';

  const bgStyle =
    imgLoaded && featured?.imageUrl
      ? {
          backgroundImage: `url(${featured.imageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }
      : { background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)' };

  return (
    <div style={{ ...heroStyles.wrapper, ...bgStyle }}>
      <style>{HERO_CTA_CSS}</style>
      <div style={heroStyles.dimOverlay} />
      <div style={heroStyles.content}>
        <h1 style={heroStyles.title}>{title}</h1>
        <Link to={ctaTo} className="sw-hero-cta" style={heroStyles.cta}>제품 보러가기</Link>
      </div>
    </div>
  );
}

// ─── PRODUCT CARD ────────────────────────────────────────────────────────────
function HomeProductCard({ product }) {
  const [imgError, setImgError] = useState(false);

  return (
    <Link to={`/products/${product.id}`} style={cardStyles.link}>
      <div style={cardStyles.imageBox}>
        {product.imageUrl && !imgError ? (
          <img src={product.imageUrl} alt={product.name} onError={() => setImgError(true)} style={cardStyles.image} />
        ) : (
          <div style={cardStyles.placeholder}>이미지 없음</div>
        )}
      </div>
      <div style={cardStyles.name}>{product.name}</div>
      <div style={cardStyles.price}>{(product.price || 0).toLocaleString()}원</div>
    </Link>
  );
}

// ─── SECTION ─────────────────────────────────────────────────────────────────
function ProductSection({ title, productType, size = 6 }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    params.set('page', 0);
    params.set('size', size);
    if (productType) params.set('productType', productType);

    fetch(`${API_BASE}/products?${params.toString()}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => setProducts(data.content || []))
      .catch((err) => {
        if (err.name !== 'AbortError') console.error(`Section ${title} fetch failed:`, err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [productType, size, title]);

  if (!loading && products.length === 0) return null;

  return (
    <section style={sectionStyles.section}>
      <h2 style={sectionStyles.title}>{title}</h2>
      <div style={sectionStyles.grid}>
        {products.map((p) => <HomeProductCard key={p.id} product={p} />)}
      </div>
    </section>
  );
}

// ─── NOTICE BOARD ────────────────────────────────────────────────────────────
const NOTICES_PER_PAGE = 10;
const NOTICE_HOVER_CSS = `
.sw-notice-row { transition: background 0.15s; cursor: pointer; }
.sw-notice-row:hover { background: rgba(0,0,0,0.025); }
.sw-notice-row:hover .sw-notice-title { text-decoration: underline; text-underline-offset: 3px; }
.sw-write-btn { transition: background 0.15s ease, color 0.15s ease; cursor: pointer; }
.sw-write-btn:hover { background: ${colors.textOnLight}; color: ${colors.white}; }
`;

function NoticeBoard() {
  const [page, setPage] = useState(0);
  const navigate = useNavigate();
  const totalPages = Math.ceil(ALL_NOTICES.length / NOTICES_PER_PAGE);
  const start = page * NOTICES_PER_PAGE;
  const currentNotices = ALL_NOTICES.slice(start, start + NOTICES_PER_PAGE);

  const goPage = (p) => setPage(Math.max(0, Math.min(totalPages - 1, p)));
  const handleWrite = () => alert('작성 권한이 없습니다.');

  return (
    <section style={noticeStyles.section}>
      <style>{NOTICE_HOVER_CSS}</style>

      <h2 style={noticeStyles.title}>공지사항</h2>

      <table style={noticeStyles.table}>
        <thead>
          <tr>
            <th style={{ ...noticeStyles.th, width: 70 }}>No</th>
            <th style={noticeStyles.th}>제목</th>
            <th style={{ ...noticeStyles.th, width: 140, textAlign: 'right' }}>작성시간</th>
            <th style={{ ...noticeStyles.th, width: 100, textAlign: 'right' }}>조회수</th>
          </tr>
        </thead>
        <tbody>
          {currentNotices.map((n) => (
            <tr
              key={n.id}
              className="sw-notice-row"
              style={noticeStyles.row}
              onClick={() => navigate(`/notices/${n.id}`)}
            >
              <td style={{ ...noticeStyles.td, color: colors.textOnLightDim }}>{n.id}</td>
              <td style={noticeStyles.td}>
                <span className="sw-notice-title">{n.title}</span>
                {n.isNew && <span style={noticeStyles.newBadge}>N</span>}
              </td>
              <td style={{ ...noticeStyles.td, textAlign: 'right', color: colors.textOnLightDim }}>
                {n.date}
              </td>
              <td style={{ ...noticeStyles.td, textAlign: 'right', color: colors.textOnLightDim }}>
                {(n.viewCount ?? 0).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 글쓰기 버튼 (우측 하단) */}
      <div style={noticeStyles.writeBtnRow}>
        <button
          type="button"
          className="sw-write-btn"
          onClick={handleWrite}
          style={noticeStyles.writeBtn}
        >
          글쓰기
        </button>
      </div>

      {/* 페이지네이션 */}
      <div style={noticeStyles.pagination}>
        <button
          onClick={() => goPage(page - 1)}
          disabled={page === 0}
          aria-label="이전 페이지"
          style={{
            ...noticeStyles.pageNav,
            opacity: page === 0 ? 0.25 : 1,
            cursor: page === 0 ? 'default' : 'pointer',
          }}
        >‹</button>

        {Array.from({ length: totalPages }, (_, i) => (
          <button
            key={i}
            onClick={() => goPage(i)}
            style={{
              ...noticeStyles.pageNum,
              fontWeight: page === i ? typography.fontWeight.bold : typography.fontWeight.medium,
              color: page === i ? colors.textOnLight : colors.textOnLightDim,
              borderBottom: page === i ? `2px solid ${colors.textOnLight}` : '2px solid transparent',
            }}
          >{i + 1}</button>
        ))}

        <button
          onClick={() => goPage(page + 1)}
          disabled={page === totalPages - 1}
          aria-label="다음 페이지"
          style={{
            ...noticeStyles.pageNav,
            opacity: page === totalPages - 1 ? 0.25 : 1,
            cursor: page === totalPages - 1 ? 'default' : 'pointer',
          }}
        >›</button>
      </div>
    </section>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <div style={{ background: colors.white, fontFamily: typography.fontFamily.base }}>
      <Hero />
      <div style={containerStyles.container}>
        {SECTIONS.map((s) => <ProductSection key={s.title} {...s} />)}
        <NoticeBoard />
      </div>
    </div>
  );
}

// ============================================================================
// STYLES
// ============================================================================
const heroStyles = {
  wrapper: {
    position: 'relative',
    height: '85vh',
    minHeight: 600,
    overflow: 'hidden',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  },
  dimOverlay: {
    position: 'absolute',
    inset: 0,
    background:
      'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.2) 30%, rgba(0,0,0,0.45) 100%)',
    zIndex: 1,
  },
  content: {
    position: 'relative',
    zIndex: 2,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[8],
    textAlign: 'center',
  },
  title: {
    fontSize: typography.fontSize['4xl'],
    fontWeight: typography.fontWeight.extrabold,
    color: colors.white,
    marginBottom: spacing[10],
    letterSpacing: typography.letterSpacing.tight,
    maxWidth: 1000,
    lineHeight: 1.15,
    textShadow: '0 2px 12px rgba(0,0,0,0.4)',
  },
  // 3-S: padding 원복 (swagkey 첫 번째 이미지 사이즈) + .sw-hero-cta 클래스로 hover 처리
  cta: {
    display: 'inline-block',
    padding: `${spacing[3]} ${spacing[10]}`,
    fontSize: 22,
    fontWeight: typography.fontWeight.medium,
    color: colors.white,
    border: `1.5px solid ${colors.white}`,
    background: 'transparent',
    textDecoration: 'none',
    letterSpacing: '0.02em',
    cursor: 'pointer',
  },
};

const containerStyles = {
  container: { maxWidth: 1600, margin: '0 auto', padding: `${spacing[12]} ${spacing[6]}` },
};

const sectionStyles = {
  section: { marginBottom: spacing[20] },
  title: {
    textAlign: 'center',
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.extrabold,
    color: colors.textOnLight,
    marginBottom: spacing[12],
    letterSpacing: '0.05em',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: spacing[8],
  },
};

const cardStyles = {
  link: { textDecoration: 'none', color: 'inherit', display: 'block' },
  imageBox: {
    aspectRatio: '1/1',
    background: colors.surface,
    overflow: 'hidden',
    marginBottom: spacing[4],
    borderRadius: radius.sm,
  },
  image: { width: '100%', height: '100%', objectFit: 'contain', display: 'block' },
  placeholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: colors.textOnLightDim,
    fontSize: typography.fontSize.sm,
  },
  name: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.textOnLight,
    marginBottom: spacing[2],
    lineHeight: 1.45,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    minHeight: 40,
  },
  price: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textOnLight,
  },
};

const noticeStyles = {
  section: { marginTop: spacing[20], marginBottom: spacing[8] },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textOnLight,
    marginBottom: spacing[6],
    textAlign: 'center',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.base },
  // 3-S: 헤더 톤 swagkey 매칭 (굵은 2px 검정 → 1px 회색 위/아래)
  th: {
    padding: `${spacing[3]} ${spacing[4]}`,
    textAlign: 'left',
    fontWeight: typography.fontWeight.medium,
    color: colors.textOnLightDim,
    fontSize: typography.fontSize.sm,
    borderTop: `1px solid ${colors.borderLight}`,
    borderBottom: `1px solid ${colors.borderLight}`,
  },
  row: { borderBottom: `1px solid ${colors.borderLight}` },
  td: { padding: `${spacing[3]} ${spacing[4]}`, color: colors.textOnLight },
  newBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing[2],
    width: 18,
    height: 18,
    background: colors.danger,
    color: colors.white,
    fontSize: 10,
    borderRadius: '50%',
    fontWeight: typography.fontWeight.bold,
    verticalAlign: 'middle',
  },
  // 3-S 신규: 글쓰기 버튼 row (우측 정렬)
  writeBtnRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: spacing[5],
  },
  writeBtn: {
    padding: `${spacing[2]} ${spacing[6]}`,
    border: `1px solid ${colors.textOnLight}`,
    background: colors.white,
    color: colors.textOnLight,
    fontSize: typography.fontSize.sm,
    fontFamily: 'inherit',
  },
  pagination: {
    marginTop: spacing[10],
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[2],
  },
  pageNum: {
    background: 'none',
    border: 'none',
    padding: `${spacing[2]} ${spacing[3]}`,
    fontSize: typography.fontSize.base,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.15s',
    minWidth: 32,
  },
  pageNav: {
    background: 'none',
    border: 'none',
    padding: `${spacing[2]} ${spacing[3]}`,
    fontSize: typography.fontSize.lg,
    color: colors.textOnLight,
    fontFamily: 'inherit',
    transition: 'opacity 0.15s',
  },
};
