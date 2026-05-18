// frontend/src/pages/AuctionDetailPage.jsx
// Phase 7 후속 (5/17) - 실시간 경매 상세 + 입찰.
// Phase 7 Round 4 (5/18) - 시각 신호 7개 보강 (LIVE 펄스 / 카운트다운 박스 / 빠른 입찰 칩 / 사회적 증명 / 입찰 스트림 카드+slideIn)
//
// 핵심 면접 자산:
//   1. STOMP + SockJS 연결 / 자동 재연결 / cleanup
//   2. 백엔드 type 필드 분기 (BID_SUCCESS / BID_REJECTED / AUCTION_ENDED)
//   3. 낙관적 업데이트 + 서버 broadcast 로 confirm
//   4. 2-브라우저 동시 입찰 시연 가능 (낙관적 락 retry 동작 확인)
//   5. "단순 할인 행사" vs "진짜 경매" 시각 차별화 7-신호 (5/18 추가)

import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { getAuctionDetail } from '../api/auction';
import { useAuth } from '../hooks/useAuth';
import { colors, typography, spacing, radius } from '../styles/tokens';

const WS_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api')
  .replace('/api', '') + '/ws';

// === LIVE pulse + slideIn 애니메이션 (한 번만 주입) ===
if (typeof document !== 'undefined' && !document.getElementById('auction-anim-styles')) {
  const styleEl = document.createElement('style');
  styleEl.id = 'auction-anim-styles';
  styleEl.textContent = `
    @keyframes livePulseKey {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }
    @keyframes slideInBidKey {
      from { transform: translateX(-14px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes urgentBlinkKey {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
  `;
  document.head.appendChild(styleEl);
}

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
  const [newestBidId, setNewestBidId] = useState(null); // slideIn 효과용

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
      const newBidId = Date.now();
      setAuction((prev) => prev ? {
        ...prev,
        currentPrice: data.currentPrice,
        bidCount: (prev.bidCount || 0) + 1,
        recentBids: [
          { id: newBidId, bidPrice: data.currentPrice, bidderName: data.bidderName, createdAt: data.bidAt },
          ...(prev.recentBids || []),
        ].slice(0, 10),
      } : prev);
      setNewestBidId(newBidId);
      // 3초 후 slideIn 강조 해제
      setTimeout(() => setNewestBidId((cur) => cur === newBidId ? null : cur), 3000);
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
    if (e && e.preventDefault) e.preventDefault();
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

  // 빠른 입찰 칩: 현재가 + delta 로 input 채우기
  function handleQuickBid(delta) {
    const next = (auction?.currentPrice || 0) + delta;
    setBidInput(String(next));
  }

  if (loading) return <div style={styles.loading}>경매 정보 불러오는 중...</div>;
  if (!auction) return <div style={styles.empty}>경매를 찾을 수 없습니다.</div>;

  const endAtMs = new Date(auction.endAt + "Z").getTime();
  const remainMs = endAtMs - now;
  const ended = remainMs <= 0 || auction.status === 'ENDED';
  const minBid = (auction.currentPrice || 0) + 1000;

  // === 사회적 증명 계산 (가용 데이터만 사용) ===
  const bidCount = auction.bidCount || 0;
  const priceUpAmount = (auction.currentPrice || 0) - (auction.startPrice || 0);
  const priceUpPercent = auction.startPrice
    ? Math.round((priceUpAmount / auction.startPrice) * 100)
    : 0;
  // 고유 입찰자 수 (recentBids 기반, 최대 10개 한계 있음)
  const uniqueBidders = auction.recentBids
    ? new Set(auction.recentBids.map((b) => b.bidderName).filter(Boolean)).size
    : 0;

  return (
    <div style={styles.container}>
      <div style={styles.breadcrumb}>
        <Link to="/auctions" style={styles.link}>경매 목록</Link>
        <span style={styles.breadcrumbSep}>›</span>
        <span>{auction.productName}</span>
      </div>

      {/* === 시각 신호 1: LIVE 펄스 헤더 === */}
      <div style={styles.liveBanner}>
        <span style={styles.livePulse} />
        <span style={styles.liveText}>
          {ended ? '경매 종료됨' : 'LIVE 경매 진행중'}
        </span>
        <span style={styles.liveWsBadge}>
          <span style={{ ...styles.liveWsDot, background: wsStatus === 'connected' ? '#10b981' : '#9ca3af' }} />
          {wsStatus === 'connected' ? 'WebSocket 연결됨' : 'WebSocket 대기중'}
        </span>
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

          {/* === 가격 카드 (현재가 + 상승률) === */}
          <div style={styles.priceCard}>
            <div style={styles.priceLabelLg}>현재 입찰가</div>
            <div style={styles.priceRow}>
              <div style={styles.priceValueLg}>{(auction.currentPrice || 0).toLocaleString()}원</div>
              {priceUpAmount > 0 && (
                <div style={styles.priceUpBadge}>
                  ▲ {priceUpAmount.toLocaleString()}원 ({priceUpPercent}%)
                </div>
              )}
            </div>
            <div style={styles.priceSub}>
              시작가 <span style={styles.priceStartStrike}>
                {(auction.startPrice || 0).toLocaleString()}원
              </span> · 입찰 {bidCount}건
            </div>
          </div>

          {/* === 시각 신호 2: 카운트다운 박스화 (빨간 배경 + 36px) === */}
          <CountdownBox remainMs={remainMs} endAt={auction.endAt} />

          {/* === 시각 신호 4: 사회적 증명 3-grid === */}
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statIcon}>📣</div>
              <div style={styles.statValue}>{bidCount}</div>
              <div style={styles.statLabel}>총 입찰</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statIcon}>👥</div>
              <div style={styles.statValue}>{uniqueBidders > 0 ? `${uniqueBidders}+` : 0}</div>
              <div style={styles.statLabel}>입찰자</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statIcon}>📈</div>
              <div style={{
                ...styles.statValue,
                color: priceUpAmount > 0 ? '#10b981' : colors.textOnLight,
              }}>
                {priceUpAmount > 0 ? `+${priceUpPercent}%` : '0%'}
              </div>
              <div style={styles.statLabel}>상승률</div>
            </div>
          </div>

          {/* === 입찰 폼 + 시각 신호 3: 빠른 입찰 칩 === */}
          {!ended ? (
            <div style={styles.bidArea}>
              <div style={styles.bidFormLabel}>입찰하기 · 최소 단위 1,000원</div>
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
              <div style={styles.quickChipsRow}>
                <button type="button" onClick={() => handleQuickBid(1000)} style={styles.quickChip}>
                  +1,000
                </button>
                <button type="button" onClick={() => handleQuickBid(5000)} style={styles.quickChip}>
                  +5,000
                </button>
                <button type="button" onClick={() => handleQuickBid(10000)} style={styles.quickChip}>
                  +10,000
                </button>
                <button type="button" onClick={() => handleQuickBid(50000)} style={styles.quickChip}>
                  +50,000
                </button>
              </div>
            </div>
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

      {/* === 시각 신호 5: 입찰 스트림 카드화 + slideIn === */}
      <div style={styles.bidsSection}>
        <div style={styles.bidsHeader}>
          <div style={styles.bidsHeaderLeft}>
            <span style={styles.bidsHeaderIcon}>📡</span>
            <h2 style={styles.bidsTitle}>실시간 입찰 내역</h2>
            <span style={styles.bidsCount}>{bidCount}건</span>
          </div>
          <div style={styles.bidsWsStatus}>
            <span style={{ ...styles.bidsWsDot, background: wsStatus === 'connected' ? '#10b981' : '#9ca3af' }} />
            {wsStatus === 'connected' ? '실시간 수신중' : '연결 대기'}
          </div>
        </div>

        {auction.recentBids && auction.recentBids.length > 0 ? (
          <div style={styles.bidsStream}>
            {auction.recentBids.map((b, idx) => {
              const isNewest = b.id === newestBidId;
              const isHighest = idx === 0;
              const initial = (b.bidderName || '익').charAt(0);
              return (
                <div
                  key={b.id}
                  style={{
                    ...styles.bidRow,
                    ...(isNewest ? styles.bidRowNew : {}),
                    ...(isHighest && !isNewest ? styles.bidRowHighest : {}),
                  }}
                >
                  <div style={{
                    ...styles.bidAvatar,
                    background: isNewest ? '#F7C1C1' : (isHighest ? '#FEF3C7' : '#f1f5f9'),
                    color: isNewest ? '#791F1F' : (isHighest ? '#92400E' : colors.textOnLightDim),
                  }}>
                    {initial}
                  </div>
                  <div style={styles.bidContent}>
                    <div style={styles.bidBidderName}>
                      {b.bidderName || '익명'}님 입찰
                      {isHighest && <span style={styles.bidHighestTag}>🏆 최고가</span>}
                      {isNewest && <span style={styles.bidNewTag}>NEW</span>}
                    </div>
                    <div style={styles.bidTime}>{formatTime(b.createdAt)}</div>
                  </div>
                  <div style={{
                    ...styles.bidPrice,
                    color: isNewest ? '#A32D2D' : (isHighest ? '#92400E' : colors.textOnLight),
                  }}>
                    {(b.bidPrice || 0).toLocaleString()}원
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={styles.noBids}>아직 입찰이 없습니다. 첫 입찰자가 되어보세요!</div>
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

// === 시각 신호 2: CountdownBox (빨간 박스 + 36px 모노스페이스) ===
function CountdownBox({ remainMs, endAt }) {
  if (remainMs <= 0) {
    return (
      <div style={styles.countdownBoxEnded}>
        <div style={styles.countdownBoxLabel}>⏰ 경매 종료됨</div>
        <div style={styles.countdownBoxValueEnded}>00 : 00 : 00</div>
      </div>
    );
  }
  const s = Math.floor(remainMs / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const isUrgent = days === 0 && hours === 0 && minutes < 10;
  const isVeryUrgent = days === 0 && hours === 0 && minutes < 1;

  const text = days > 0
    ? `${days}일 ${pad2(hours)} : ${pad2(minutes)} : ${pad2(seconds)}`
    : `${pad2(hours)} : ${pad2(minutes)} : ${pad2(seconds)}`;

  return (
    <div style={{
      ...styles.countdownBox,
      animation: isVeryUrgent ? 'urgentBlinkKey 0.6s ease-in-out infinite' : 'none',
    }}>
      <div style={styles.countdownBoxLabel}>⏰ {isUrgent ? '곧 종료' : '남은 시간'}</div>
      <div style={{
        ...styles.countdownBoxValue,
        color: isUrgent ? '#A32D2D' : '#A32D2D',
      }}>{text}</div>
      {endAt && (
        <div style={styles.countdownBoxSub}>
          {new Date(endAt + "Z").toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} 종료
        </div>
      )}
    </div>
  );
}

function pad2(n) {
  return String(n).padStart(2, '0');
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

  // === 시각 신호 1: LIVE 펄스 헤더 ===
  liveBanner: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 16px',
    background: '#FCEBEB',
    border: '1px solid #F09595',
    borderRadius: 10,
    marginBottom: spacing[6],
  },
  livePulse: {
    width: 10, height: 10, background: '#ef4444', borderRadius: '50%',
    display: 'inline-block', flexShrink: 0,
    animation: 'livePulseKey 1.4s ease-in-out infinite',
    boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.6)',
  },
  liveText: {
    fontSize: 14, fontWeight: 800, color: '#791F1F', letterSpacing: '0.04em',
  },
  liveWsBadge: {
    marginLeft: 'auto',
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontSize: 11, color: '#791F1F', fontWeight: 500,
  },
  liveWsDot: {
    width: 6, height: 6, borderRadius: '50%', display: 'inline-block',
  },

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
  priceRow: {
    display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap',
    marginBottom: spacing[1],
  },
  priceValueLg: {
    fontSize: 32,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.textOnLight,
  },
  priceUpBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    fontSize: 13, fontWeight: 700, color: '#10b981',
    padding: '2px 8px', background: 'rgba(16,185,129,0.12)',
    borderRadius: 4,
  },
  priceSub: { fontSize: typography.fontSize.sm, color: colors.textOnLightDim },
  priceStartStrike: { textDecoration: 'line-through', color: '#9ca3af' },

  // === 시각 신호 2: CountdownBox ===
  countdownBox: {
    padding: '16px 20px',
    background: '#FCEBEB',
    border: '1px solid #F09595',
    borderRadius: 10,
    textAlign: 'center',
  },
  countdownBoxEnded: {
    padding: '16px 20px',
    background: '#f3f4f6',
    border: '1px solid #d1d5db',
    borderRadius: 10,
    textAlign: 'center',
  },
  countdownBoxLabel: {
    fontSize: 12, fontWeight: 700, color: '#791F1F',
    letterSpacing: '0.08em', marginBottom: 4,
  },
  countdownBoxValue: {
    fontSize: 36, fontWeight: 800,
    color: '#A32D2D',
    fontFamily: 'monospace',
    letterSpacing: '0.04em',
    fontVariantNumeric: 'tabular-nums',
  },
  countdownBoxValueEnded: {
    fontSize: 36, fontWeight: 800,
    color: '#6b7280',
    fontFamily: 'monospace',
    letterSpacing: '0.04em',
  },
  countdownBoxSub: {
    fontSize: 11, color: '#791F1F', marginTop: 4,
  },

  // === 시각 신호 4: 사회적 증명 3-grid ===
  statsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
    marginTop: spacing[1],
  },
  statCard: {
    background: '#f8f9fa',
    border: `1px solid ${colors.borderLight}`,
    borderRadius: 8,
    padding: '12px 8px',
    textAlign: 'center',
  },
  statIcon: { fontSize: 16, marginBottom: 4 },
  statValue: {
    fontSize: 18, fontWeight: 800, color: colors.textOnLight,
    fontVariantNumeric: 'tabular-nums',
  },
  statLabel: {
    fontSize: 11, color: colors.textOnLightDim, marginTop: 2,
  },

  // === 입찰 영역 + 빠른 칩 ===
  bidArea: {
    marginTop: spacing[2],
    padding: spacing[4],
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.md,
  },
  bidFormLabel: {
    fontSize: 12, fontWeight: 600, color: colors.textOnLightDim,
    marginBottom: 10,
  },
  bidForm: { display: 'flex', gap: spacing[2] },
  bidInput: {
    flex: 1,
    padding: spacing[3],
    fontSize: typography.fontSize.base,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.sm,
    fontFamily: 'inherit',
    fontWeight: 700,
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

  // === 시각 신호 3: 빠른 입찰 칩 ===
  quickChipsRow: {
    display: 'flex', gap: 6, marginTop: 8,
  },
  quickChip: {
    flex: 1,
    padding: '8px 4px',
    background: '#f8f9fa',
    border: `1px solid ${colors.borderLight}`,
    borderRadius: 6,
    fontSize: 12, fontWeight: 600,
    color: colors.textOnLight,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 0.15s',
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

  // === 시각 신호 5: 입찰 스트림 카드화 ===
  bidsSection: { marginTop: spacing[8] },
  bidsHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing[4],
  },
  bidsHeaderLeft: {
    display: 'flex', alignItems: 'center', gap: 8,
  },
  bidsHeaderIcon: { fontSize: 18, color: '#ef4444' },
  bidsTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textOnLight,
    margin: 0,
  },
  bidsCount: {
    fontSize: 13, color: colors.textOnLightDim,
    fontWeight: 500,
    padding: '2px 8px', background: '#f1f5f9', borderRadius: 100,
  },
  bidsWsStatus: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 11, color: '#10b981', fontWeight: 500,
  },
  bidsWsDot: {
    width: 6, height: 6, borderRadius: '50%', display: 'inline-block',
  },

  bidsStream: {
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  bidRow: {
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '12px 16px',
    borderBottom: `1px solid ${colors.borderLight}`,
  },
  bidRowNew: {
    background: '#FCEBEB',
    animation: 'slideInBidKey 0.6s ease',
  },
  bidRowHighest: {
    background: '#FFFBEB',
  },
  bidAvatar: {
    width: 32, height: 32, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 700,
    flexShrink: 0,
  },
  bidContent: { flex: 1 },
  bidBidderName: {
    fontSize: 14, fontWeight: 500, color: colors.textOnLight,
    display: 'flex', alignItems: 'center', gap: 6,
  },
  bidHighestTag: {
    fontSize: 11, fontWeight: 700,
    padding: '2px 6px',
    background: '#FEF3C7',
    color: '#92400E',
    borderRadius: 4,
  },
  bidNewTag: {
    fontSize: 11, fontWeight: 800,
    padding: '2px 6px',
    background: '#ef4444',
    color: 'white',
    borderRadius: 4,
    letterSpacing: '0.04em',
  },
  bidTime: {
    fontSize: 11, color: colors.textOnLightDim, marginTop: 2,
  },
  bidPrice: {
    fontSize: 15, fontWeight: 700,
    color: colors.textOnLight,
    fontVariantNumeric: 'tabular-nums',
  },

  noBids: {
    textAlign: 'center', padding: spacing[8], color: colors.textOnLightDim,
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.md,
  },

  loading: { textAlign: 'center', padding: spacing[16], color: colors.textOnLightDim },
  empty: { textAlign: 'center', padding: spacing[16], color: colors.textOnLightDim },

  toast: {
    position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
    color: 'white', padding: '12px 24px', borderRadius: 8,
    fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.medium,
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 9999,
  },
};
