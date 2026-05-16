// frontend/src/pages/AuctionListPage.jsx
// Phase 7 후속 (5/17) - 경매 목록 그리드 페이지.
//
// 특징:
// - 실시간 카운트다운 (1초마다 갱신, endAt - now)
// - swagkey light 톤 + ProductList 와 일관성
// - 카드 클릭 -> /auctions/:id (상세 + 실시간 입찰)

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listAuctions } from '../api/auction';
import { colors, typography, spacing, radius } from '../styles/tokens';

export default function AuctionListPage() {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  // 1초마다 now 갱신 (카운트다운용)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // 최초 + 30초마다 목록 fetch
  useEffect(() => {
    let mounted = true;
    const fetchList = async () => {
      try {
        const data = await listAuctions();
        if (mounted) {
          setAuctions(data);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to fetch auctions:', err);
        if (mounted) setLoading(false);
      }
    };
    fetchList();
    const id = setInterval(fetchList, 30000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  if (loading) return <div style={styles.loading}>경매 목록 불러오는 중...</div>;
  if (auctions.length === 0) return <div style={styles.empty}>진행중인 경매가 없습니다.</div>;

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>실시간 경매</h1>
      <p style={styles.subtitle}>현재 {auctions.length}건 진행중 · 입찰가 갱신 실시간</p>

      <div style={styles.grid}>
        {auctions.map((a) => (
          <AuctionCard key={a.id} auction={a} now={now} />
        ))}
      </div>
    </div>
  );
}

function AuctionCard({ auction, now }) {
  const endAtMs = new Date(auction.endAt + "Z").getTime();
  const remainMs = endAtMs - now;
  const ended = remainMs <= 0;

  return (
    <Link to={`/auctions/${auction.id}`} style={styles.card}>
      <div style={styles.imageBox}>
        {auction.thumbnailUrl ? (
          <img src={auction.thumbnailUrl} alt={auction.productName} style={styles.image} />
        ) : (
          <div style={styles.placeholder}>이미지 없음</div>
        )}
        {ended && <div style={styles.endedBadge}>종료</div>}
      </div>
      <div style={styles.productName}>{auction.productName}</div>
      <div style={styles.priceRow}>
        <span style={styles.priceLabel}>현재가</span>
        <span style={styles.priceValue}>{(auction.currentPrice || 0).toLocaleString()}원</span>
      </div>
      <div style={styles.countdownRow}>
        <span style={styles.countdownLabel}>남은시간</span>
        <Countdown remainMs={remainMs} />
      </div>
    </Link>
  );
}

function Countdown({ remainMs }) {
  if (remainMs <= 0) return <span style={styles.countdownEnded}>종료됨</span>;
  const s = Math.floor(remainMs / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;

  const text =
    days > 0
      ? `${days}일 ${hours}시간`
      : hours > 0
      ? `${hours}시간 ${minutes}분`
      : `${minutes}분 ${seconds}초`;

  const urgent = remainMs < 5 * 60 * 1000;
  return <span style={{ ...styles.countdownValue, color: urgent ? colors.danger : colors.textOnLight }}>{text}</span>;
}

const styles = {
  container: { maxWidth: 1400, margin: '0 auto', padding: `${spacing[12]} ${spacing[6]}` },
  title: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.extrabold,
    color: colors.textOnLight,
    textAlign: 'center',
    marginBottom: spacing[3],
    letterSpacing: typography.letterSpacing.tight,
  },
  subtitle: {
    color: colors.textOnLightDim,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing[12],
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: spacing[8],
  },
  card: {
    textDecoration: 'none',
    color: 'inherit',
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.md,
    padding: spacing[5],
    transition: 'transform 0.15s, box-shadow 0.15s',
    cursor: 'pointer',
  },
  imageBox: {
    position: 'relative',
    aspectRatio: '1/1',
    background: colors.surface,
    overflow: 'hidden',
    marginBottom: spacing[4],
    borderRadius: radius.sm,
  },
  image: { width: '100%', height: '100%', objectFit: 'contain', display: 'block' },
  placeholder: {
    width: '100%', height: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: colors.textOnLightDim, fontSize: typography.fontSize.sm,
  },
  endedBadge: {
    position: 'absolute', top: 8, right: 8,
    background: 'rgba(0,0,0,0.7)', color: colors.white,
    padding: '4px 10px', borderRadius: radius.sm,
    fontSize: 11, fontWeight: typography.fontWeight.bold,
  },
  productName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.textOnLight,
    marginBottom: spacing[3],
    lineHeight: 1.45,
    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
    overflow: 'hidden', minHeight: 40,
  },
  priceRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing[2] },
  priceLabel: { fontSize: typography.fontSize.sm, color: colors.textOnLightDim },
  priceValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textOnLight,
  },
  countdownRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' },
  countdownLabel: { fontSize: typography.fontSize.sm, color: colors.textOnLightDim },
  countdownValue: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold },
  countdownEnded: { fontSize: typography.fontSize.sm, color: colors.danger, fontWeight: typography.fontWeight.semibold },
  loading: { textAlign: 'center', padding: spacing[16], color: colors.textOnLightDim },
  empty: { textAlign: 'center', padding: spacing[16], color: colors.textOnLightDim },
};
