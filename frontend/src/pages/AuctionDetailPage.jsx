// frontend/src/pages/AuctionDetailPage.jsx
// Phase 7 후속 (5/17) - 실시간 경매 상세 + 입찰.
//
// 핵심 면접 자산:
//   1. STOMP + SockJS 연결 / 자동 재연결 / cleanup
//   2. 백엔드 type 필드 분기 (BID_SUCCESS / BID_REJECTED / AUCTION_ENDED)
//   3. 낙관적 업데이트 + 서버 broadcast 로 confirm
//   4. 2-브라우저 동시 입찰 시연 가능 (낙관적 락 retry 동작 확인)

import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { getAuctionDetail } from '../api/auction';
import { useAuth } from '../hooks/useAuth';
import { colors, typography, spacing, radius } from '../styles/tokens';

const WS_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api')
  .replace('/api', '') + '/ws';

export default function AuctionDetailPage() {
  const { id } = useParams();
  const auctionId = Number(id);
  const { user } = useAuth();

  const [auction, setAuction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bidInput, setBidInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'success'|'error', message: string }
  const [now, setNow] = useState(Date.now());
  const [wsStatus, setWsStatus] = useState('disconnected');

  const clientRef = useRef(null);

  // 1초마다 now 갱신
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // 최초 REST 로드
  useEffect(() => {
    let mounted = true;
    getAuctionDetail(auctionId)
      .then((data) => {
        if (mounted) {
          setAuction(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load auction:', err);
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [auctionId]);

  // STOMP 연결
  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      reconnectDelay: 5000,
      onConnect: () => {
        console.log('STOMP connected');
        setWsStatus('connected');

        client.subscribe(`/topic/auction/${auctionId}`, (msg) => {
          try {
            const data = JSON.parse(msg.body);
            console.log('Broadcast received:', data);
            handleBroadcast(data);
          } catch (e) {
            console.error('Parse error:', e);
          }
        });
      },
      onDisconnect: () => {
        console.log('STOMP disconnected');
        setWsStatus('disconnected');
      },
      onStompError: (frame) => {
        console.error('STOMP error:', frame);
        setWsStatus('error');
      },
    });

    client.activate();
    clientRef.current = client;

    return () => {
      client.deactivate();
      clientRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auctionId]);

  function handleBroadcast(data) {
    if (data.type === 'BID_SUCCESS') {
      setAuction((prev) => prev ? {
        ...prev,
        currentPrice: data.currentPrice,
        bidCount: (prev.bidCount || 0) + 1,
        recentBids: [
          { id: Date.now(), bidPrice: data.currentPrice, bidderName: data.bidderName, createdAt: data.bidAt },
          ...(prev.recentBids || []),
        ].slice(0, 10),
      } : prev);
      setSubmitting(false);
      showToast('success', `${data.bidderName}님 입찰 ${data.currentPrice.toLocaleString()}원`);
    } else if (data.type === 'BID_REJECTED') {
      setSubmitting(false);
      showToast('error', data.reason || '입찰 실패');
    } else if (data.type === 'AUCTION_ENDED') {
      setAuction((prev) => prev ? { ...prev, status: 'ENDED' } : prev);
      showToast('success', `경매 종료 - 낙찰자: ${data.winnerName || '없음'}`);
    }
  }

  function showToast(type, message) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  }

  function handleBid(e) {
    e.preventDefault();
    if (!user) {
      showToast('error', '로그인이 필요합니다');
      return;
    }
    const bidPrice = parseInt(bidInput, 10);
    if (!bidPrice || bidPrice <= (auction?.currentPrice || 0)) {
      showToast('error', `현재가 ${(auction?.currentPrice || 0).toLocaleString()}원 보다 높게 입찰하세요`);
      return;
    }
    if (!clientRef.current || !clientRef.current.connected) {
      showToast('error', '연결이 끊겼습니다. 잠시 후 다시 시도하세요.');
      return;
    }

    setSubmitting(true);
    clientRef.current.publish({
      destination: `/app/auction/${auctionId}/bid`,
      body: JSON.stringify({ userId: user.id, bidPrice }),
    });
    setBidInput('');
  }

  if (loading) return <div style={styles.loading}>경매 정보 불러오는 중...</div>;
  if (!auction) return <div style={styles.empty}>경매를 찾을 수 없습니다.</div>;

  const endAtMs = new Date(auction.endAt + "Z").getTime();
  const remainMs = endAtMs - now;
  const ended = remainMs <= 0 || auction.status === 'ENDED';
  const minBid = (auction.currentPrice || 0) + 1000;

  return (
    <div style={styles.container}>
      <div style={styles.breadcrumb}>
        <Link to="/auctions" style={styles.link}>경매 목록</Link>
        <span style={styles.breadcrumbSep}>›</span>
        <span>{auction.productName}</span>
      </div>

      <div style={styles.layout}>
        {/* 좌측 이미지 */}
        <div style={styles.imageSection}>
          <div style={styles.imageBox}>
            {auction.thumbnailUrl ? (
              <img src={auction.thumbnailUrl} alt={auction.productName} style={styles.image} />
            ) : (
              <div style={styles.placeholder}>이미지 없음</div>
            )}
          </div>
        </div>

        {/* 우측 정보 */}
        <div style={styles.infoSection}>
          <h1 style={styles.productName}>{auction.productName}</h1>

          <div style={styles.statusRow}>
            <StatusBadge status={ended ? 'ENDED' : auction.status} />
            <ConnStatus status={wsStatus} />
          </div>

          <div style={styles.priceCard}>
            <div style={styles.priceLabelLg}>현재 입찰가</div>
            <div style={styles.priceValueLg}>{(auction.currentPrice || 0).toLocaleString()}원</div>
            <div style={styles.priceSub}>
              시작가 {(auction.startPrice || 0).toLocaleString()}원 · 입찰 {auction.bidCount || 0}건
            </div>
          </div>

          <div style={styles.countdownCard}>
            <span style={styles.countdownLabel}>남은시간</span>
            <Countdown remainMs={remainMs} />
          </div>

          {/* 입찰 폼 */}
          {!ended ? (
            <form onSubmit={handleBid} style={styles.bidForm}>
              <input
                type="number"
                value={bidInput}
                onChange={(e) => setBidInput(e.target.value)}
                placeholder={`${minBid.toLocaleString()}원 이상`}
                min={minBid}
                step={1000}
                style={styles.bidInput}
                disabled={submitting}
              />
              <button type="submit" style={styles.bidButton} disabled={submitting}>
                {submitting ? '입찰중...' : '입찰하기'}
              </button>
            </form>
          ) : (
            <div style={styles.endedNotice}>이 경매는 종료되었습니다.</div>
          )}

          <div style={styles.metaRow}>
            <span style={styles.metaLabel}>판매자</span>
            <span>{auction.sellerName || '익명'}</span>
          </div>
          <div style={styles.metaRow}>
            <span style={styles.metaLabel}>상품 상태</span>
            <span>{conditionLabel(auction.condition)}</span>
          </div>

          {auction.description && (
            <div style={styles.descriptionBox}>
              <div style={styles.descLabel}>상품 설명</div>
              <div style={styles.descText}>{auction.description}</div>
            </div>
          )}
        </div>
      </div>

      {/* 입찰 내역 */}
      <div style={styles.bidsSection}>
        <h2 style={styles.bidsTitle}>입찰 내역 ({auction.bidCount || 0}건)</h2>
        {auction.recentBids && auction.recentBids.length > 0 ? (
          <table style={styles.bidsTable}>
            <thead>
              <tr>
                <th style={styles.th}>입찰가</th>
                <th style={styles.th}>입찰자</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>시각</th>
              </tr>
            </thead>
            <tbody>
              {auction.recentBids.map((b) => (
                <tr key={b.id} style={styles.tr}>
                  <td style={styles.td}>{(b.bidPrice || 0).toLocaleString()}원</td>
                  <td style={styles.td}>{b.bidderName || '익명'}</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>{formatTime(b.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={styles.noBids}>아직 입찰이 없습니다.</div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ ...styles.toast, background: toast.type === 'error' ? colors.danger : colors.success }}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const color = status === 'ACTIVE' ? '#10b981' : status === 'ENDED' ? '#6b7280' : '#ef4444';
  const label = status === 'ACTIVE' ? '진행중' : status === 'ENDED' ? '종료' : '취소';
  return <span style={{ ...styles.statusBadge, background: color }}>{label}</span>;
}

function ConnStatus({ status }) {
  const map = {
    connected: { label: '🟢 실시간 연결', color: '#10b981' },
    disconnected: { label: '⚪ 연결중...', color: '#6b7280' },
    error: { label: '🔴 연결 실패', color: '#ef4444' },
  };
  const m = map[status] || map.disconnected;
  return <span style={{ ...styles.connStatus, color: m.color }}>{m.label}</span>;
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
      ? `${days}일 ${hours}시간 ${minutes}분`
      : hours > 0
      ? `${hours}시간 ${minutes}분 ${seconds}초`
      : `${minutes}분 ${seconds}초`;
  const urgent = remainMs < 5 * 60 * 1000;
  return <span style={{ ...styles.countdownValue, color: urgent ? colors.danger : colors.textOnLight }}>{text}</span>;
}

function conditionLabel(c) {
  const map = { NEW: '미개봉/새상품', EXCELLENT: '아주 좋음', GOOD: '좋음', FAIR: '보통' };
  return map[c] || c || '-';
}

function formatTime(iso) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  } catch { return '-'; }
}

const styles = {
  container: { maxWidth: 1200, margin: '0 auto', padding: `${spacing[8]} ${spacing[6]}` },
  breadcrumb: { color: colors.textOnLightDim, fontSize: typography.fontSize.sm, marginBottom: spacing[6] },
  link: { color: colors.textOnLightDim, textDecoration: 'none' },
  breadcrumbSep: { margin: `0 ${spacing[2]}` },

  layout: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: spacing[10],
    marginBottom: spacing[12],
  },

  imageSection: {},
  imageBox: {
    aspectRatio: '1/1',
    background: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%', objectFit: 'contain' },
  placeholder: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textOnLightDim },

  infoSection: { display: 'flex', flexDirection: 'column', gap: spacing[4] },
  productName: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textOnLight,
    lineHeight: 1.3,
    marginBottom: spacing[2],
  },
  statusRow: { display: 'flex', alignItems: 'center', gap: spacing[3] },
  statusBadge: {
    padding: '4px 12px', borderRadius: radius.sm,
    fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold,
    color: colors.white,
  },
  connStatus: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.medium },

  priceCard: {
    background: '#f8f9fa',
    padding: spacing[5],
    borderRadius: radius.md,
    border: `1px solid ${colors.borderLight}`,
  },
  priceLabelLg: { fontSize: typography.fontSize.sm, color: colors.textOnLightDim, marginBottom: spacing[1] },
  priceValueLg: {
    fontSize: 32,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.textOnLight,
    marginBottom: spacing[1],
  },
  priceSub: { fontSize: typography.fontSize.sm, color: colors.textOnLightDim },

  countdownCard: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing[4],
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.md,
  },
  countdownLabel: { fontSize: typography.fontSize.sm, color: colors.textOnLightDim },
  countdownValue: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold },
  countdownEnded: { fontSize: typography.fontSize.lg, color: colors.danger, fontWeight: typography.fontWeight.bold },

  bidForm: { display: 'flex', gap: spacing[2], marginTop: spacing[2] },
  bidInput: {
    flex: 1,
    padding: spacing[3],
    fontSize: typography.fontSize.base,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.sm,
    fontFamily: 'inherit',
  },
  bidButton: {
    padding: `${spacing[3]} ${spacing[6]}`,
    background: colors.textOnLight,
    color: colors.white,
    border: 'none',
    borderRadius: radius.sm,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  endedNotice: {
    padding: spacing[4],
    background: '#f8f9fa',
    textAlign: 'center',
    color: colors.textOnLightDim,
    borderRadius: radius.sm,
  },

  metaRow: { display: 'flex', justifyContent: 'space-between', padding: `${spacing[2]} 0`, borderBottom: `1px solid ${colors.borderLight}` },
  metaLabel: { color: colors.textOnLightDim, fontSize: typography.fontSize.sm },

  descriptionBox: { marginTop: spacing[4] },
  descLabel: { fontSize: typography.fontSize.sm, color: colors.textOnLightDim, marginBottom: spacing[2] },
  descText: { lineHeight: 1.7, color: colors.textOnLight, fontSize: typography.fontSize.base, whiteSpace: 'pre-wrap' },

  bidsSection: { marginTop: spacing[8] },
  bidsTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textOnLight,
    marginBottom: spacing[4],
  },
  bidsTable: { width: '100%', borderCollapse: 'collapse' },
  th: {
    padding: `${spacing[3]} ${spacing[4]}`,
    textAlign: 'left',
    fontWeight: typography.fontWeight.medium,
    color: colors.textOnLightDim,
    fontSize: typography.fontSize.sm,
    borderBottom: `1px solid ${colors.borderLight}`,
  },
  tr: { borderBottom: `1px solid ${colors.borderLight}` },
  td: { padding: `${spacing[3]} ${spacing[4]}`, color: colors.textOnLight, fontSize: typography.fontSize.sm },
  noBids: { textAlign: 'center', padding: spacing[8], color: colors.textOnLightDim },

  loading: { textAlign: 'center', padding: spacing[16], color: colors.textOnLightDim },
  empty: { textAlign: 'center', padding: spacing[16], color: colors.textOnLightDim },

  toast: {
    position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
    color: 'white', padding: '12px 24px', borderRadius: 8,
    fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.medium,
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 9999,
  },
};
