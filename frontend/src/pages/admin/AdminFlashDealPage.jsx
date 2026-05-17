// frontend/src/pages/admin/AdminFlashDealPage.jsx
//
// Phase 7 라운드 3 (5/17) - 플래시 경매 관리 페이지.
//
// 구성:
//   1. 헤더: "Admin > 플래시 경매 관리"
//   2. 임계값 카드: Top 10% 기준 + 캐시 갱신 버튼
//   3. 상태 탭: 전체 / 진행 중 / 대기 중 / 완료
//   4. 표: 플래시 경매 목록 + 액션 버튼 (status 별 분기)
//   5. 등록 모달 (FlashDealRegisterModal)
//   6. 수정 모달 (FlashDealEditModal, SCHEDULED 만)
//
// 디자인: swagkey 흰 톤 (adminTheme.js + tokens.js light 변수 일관성).
// 라우트: /admin/flash-deals (ProtectedRoute + ADMIN role).
//
// 면접 자산:
//   - 운영 데이터 기반 동적 임계값 카드 (관리자가 바로 확인 가능)
//   - 상태별 액션 버튼 분기 (대기=수정/삭제, 진행=강제종료, 완료=detail)
//   - 1초마다 남은 시간 갱신 (clock tick)

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getFlashDealThreshold,
  refreshThreshold,
  listFlashDealsByStatuses,
  forceEndAuction,
  cancelAuction,
} from '../../api/auction';
import { colors, typography, spacing, radius } from '../../styles/tokens';
import FlashDealRegisterModal from '../../components/admin/FlashDealRegisterModal';
import FlashDealEditModal from '../../components/admin/FlashDealEditModal';

const TABS = [
  { key: 'all',       label: '전체',     statuses: ['ACTIVE', 'SCHEDULED', 'ENDED', 'CANCELLED'] },
  { key: 'active',    label: '▶️ 진행 중', statuses: ['ACTIVE'] },
  { key: 'scheduled', label: '📅 대기 중', statuses: ['SCHEDULED'] },
  { key: 'ended',     label: '⏱️ 완료',   statuses: ['ENDED', 'CANCELLED'] },
];

const STATUS_BADGE = {
  ACTIVE:    { bg: '#fed7aa', fg: '#9a3412', label: '진행 중' },
  SCHEDULED: { bg: '#ede9fe', fg: '#5b21b6', label: '대기 중' },
  ENDED:     { bg: '#e5e7eb', fg: '#374151', label: '완료' },
  CANCELLED: { bg: '#fecaca', fg: '#991b1b', label: '취소' },
};

const krw = (n) => (n != null ? n.toLocaleString('ko-KR') : '-');

/**
 * UTC ISO 문자열 → 한국 시각 표시 (KST = UTC+9).
 */
function formatKst(isoUtc) {
  if (!isoUtc) return '-';
  const d = new Date(isoUtc + 'Z'); // 백엔드가 UTC 라 명시
  return d.toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  });
}

/**
 * 남은 시간 hh:mm:ss 또는 "Xh Ym".
 */
function formatRemaining(endAt, now) {
  if (!endAt) return '-';
  const end = new Date(endAt + 'Z').getTime();
  const diffMs = end - now;
  if (diffMs <= 0) return '종료';
  const totalMin = Math.floor(diffMs / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/**
 * 시작 시각까지 카운트다운 (SCHEDULED 용).
 */
function formatUntilStart(startAt, now) {
  if (!startAt) return '-';
  const start = new Date(startAt + 'Z').getTime();
  const diffMs = start - now;
  if (diffMs <= 0) return '곧 시작';
  const totalMin = Math.floor(diffMs / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 24) return `${Math.floor(h / 24)}일 ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m 후`;
  return `${m}m 후`;
}

export default function AdminFlashDealPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [auctions, setAuctions] = useState([]);
  const [threshold, setThreshold] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshingCache, setRefreshingCache] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [editingAuction, setEditingAuction] = useState(null);

  // 1초 tick — 남은 시간 갱신용
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const tid = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tid);
  }, []);

  const currentTab = useMemo(
    () => TABS.find((t) => t.key === activeTab),
    [activeTab],
  );

  // 데이터 로드
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [thresholdData, auctionsData] = await Promise.all([
        getFlashDealThreshold(),
        listFlashDealsByStatuses(currentTab.statuses),
      ]);
      setThreshold(thresholdData);
      setAuctions(auctionsData);
    } catch (e) {
      console.error('Failed to load flash deals:', e);
      setError(e.response?.data?.message || '데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  }, [currentTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 캐시 갱신
  const handleRefreshCache = async () => {
    setRefreshingCache(true);
    try {
      const newThreshold = await refreshThreshold();
      setThreshold(newThreshold);
    } catch (e) {
      alert('캐시 갱신 실패: ' + (e.response?.data?.message || e.message));
    } finally {
      setRefreshingCache(false);
    }
  };

  // 강제 종료
  const handleForceEnd = async (auction) => {
    if (!window.confirm(
      `[강제 종료]\n${auction.productName}\n\n` +
      `현재가 ${krw(auction.currentPrice)}원 / 입찰 ${auction.bidCount}건\n` +
      `즉시 종료하시겠습니까?`,
    )) return;
    try {
      await forceEndAuction(auction.id);
      loadData();
    } catch (e) {
      alert('강제 종료 실패: ' + (e.response?.data?.message || e.message));
    }
  };

  // 취소
  const handleCancel = async (auction) => {
    if (auction.bidCount > 0) {
      alert('입찰이 있는 경매는 취소할 수 없습니다. 강제 종료를 사용하세요.');
      return;
    }
    if (!window.confirm(`[취소]\n${auction.productName}\n취소하시겠습니까?`)) return;
    try {
      await cancelAuction(auction.id);
      loadData();
    } catch (e) {
      alert('취소 실패: ' + (e.response?.data?.message || e.message));
    }
  };

  // ─── 스타일 (인라인, light 톤) ───────────────────────────────
  const styles = {
    page: {
      minHeight: '100vh',
      background: colors.white,
      color: colors.textOnLight,
      fontFamily: typography.fontFamily,
      padding: '32px 40px 80px',
    },
    breadcrumb: {
      fontSize: '13px',
      color: colors.textOnLightDim,
      marginBottom: spacing.sm,
    },
    h1: {
      fontSize: '28px',
      fontWeight: 700,
      letterSpacing: '-0.02em',
      marginBottom: spacing.xl,
    },
    thresholdCard: {
      background: colors.white,
      border: `1px solid ${colors.borderLight}`,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.xl,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.lg,
    },
    thresholdInfo: { flex: 1 },
    thresholdTitle: {
      fontSize: '13px',
      fontWeight: 600,
      color: colors.textOnLightDim,
      marginBottom: '6px',
      letterSpacing: '0.02em',
    },
    thresholdValue: {
      fontSize: '28px',
      fontWeight: 800,
      color: colors.textOnLight,
      letterSpacing: '-0.02em',
    },
    thresholdMeta: {
      fontSize: '12px',
      color: colors.textOnLightDim,
      marginTop: '6px',
    },
    refreshBtn: {
      background: colors.white,
      color: colors.textOnLight,
      border: `1px solid ${colors.borderLight}`,
      borderRadius: radius.md,
      padding: '10px 18px',
      fontSize: '13px',
      fontWeight: 500,
      cursor: 'pointer',
      transition: 'all 0.15s ease',
    },
    tabs: {
      display: 'flex',
      gap: '4px',
      marginBottom: spacing.lg,
      borderBottom: `1px solid ${colors.borderLight}`,
    },
    tab: (active) => ({
      padding: '10px 16px',
      background: 'transparent',
      border: 'none',
      borderBottom: active ? `2px solid ${colors.textOnLight}` : '2px solid transparent',
      fontSize: '14px',
      fontWeight: active ? 600 : 500,
      color: active ? colors.textOnLight : colors.textOnLightDim,
      cursor: 'pointer',
      marginBottom: '-1px',
      transition: 'all 0.15s ease',
    }),
    listCard: {
      background: colors.white,
      border: `1px solid ${colors.borderLight}`,
      borderRadius: radius.lg,
      overflow: 'hidden',
    },
    listHeader: {
      padding: '18px 20px',
      borderBottom: `1px solid ${colors.borderLight}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    listTitle: { fontSize: '15px', fontWeight: 600 },
    createBtn: {
      background: colors.textOnLight,
      color: colors.white,
      border: 'none',
      borderRadius: radius.md,
      padding: '10px 18px',
      fontSize: '13px',
      fontWeight: 600,
      cursor: 'pointer',
    },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: {
      padding: '12px 16px',
      textAlign: 'left',
      fontSize: '11px',
      fontWeight: 600,
      color: colors.textOnLightDim,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      background: colors.surface,
      borderBottom: `1px solid ${colors.borderLight}`,
    },
    td: {
      padding: '14px 16px',
      fontSize: '13.5px',
      color: colors.textOnLight,
      borderBottom: `1px solid ${colors.borderLight}`,
      verticalAlign: 'middle',
    },
    badge: (s) => ({
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: '12px',
      fontSize: '11px',
      fontWeight: 600,
      background: STATUS_BADGE[s]?.bg || '#e5e7eb',
      color: STATUS_BADGE[s]?.fg || '#374151',
    }),
    actionBtn: {
      padding: '6px 12px',
      fontSize: '12px',
      fontWeight: 500,
      border: `1px solid ${colors.borderLight}`,
      borderRadius: radius.sm,
      background: colors.white,
      color: colors.textOnLight,
      cursor: 'pointer',
      marginRight: '6px',
    },
    dangerBtn: {
      padding: '6px 12px',
      fontSize: '12px',
      fontWeight: 500,
      border: '1px solid #fecaca',
      borderRadius: radius.sm,
      background: colors.white,
      color: '#b91c1c',
      cursor: 'pointer',
      marginRight: '6px',
    },
    emptyRow: {
      padding: '60px 20px',
      textAlign: 'center',
      color: colors.textOnLightDim,
      fontSize: '14px',
    },
    errorBox: {
      padding: '12px 16px',
      background: '#fef2f2',
      color: '#b91c1c',
      borderRadius: radius.md,
      marginBottom: spacing.md,
      fontSize: '13px',
    },
  };

  // ─── 렌더 ─────────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      <div style={styles.breadcrumb}>
        <span style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/audit-logs')}>
          Admin
        </span>
        {' > '}플래시 경매 관리
      </div>
      <h1 style={styles.h1}>플래시 경매 관리</h1>

      {error && <div style={styles.errorBox}>{error}</div>}

      {/* 임계값 카드 */}
      <div style={styles.thresholdCard}>
        <div style={styles.thresholdInfo}>
          <div style={styles.thresholdTitle}>🔥 플래시 딜 기준 (Top {threshold?.topPercent ?? '-'}%)</div>
          <div style={styles.thresholdValue}>
            ₩{krw(threshold?.threshold)} <span style={{ fontSize: '14px', color: colors.textOnLightDim, fontWeight: 500 }}>이상</span>
          </div>
          <div style={styles.thresholdMeta}>
            Active Keyboards: {threshold?.totalKeyboards ?? '-'}개 · {threshold?.formula ?? '계산 중...'}
          </div>
        </div>
        <button
          style={styles.refreshBtn}
          onClick={handleRefreshCache}
          disabled={refreshingCache}
        >
          {refreshingCache ? '갱신 중...' : '🔄 캐시 갱신'}
        </button>
      </div>

      {/* 상태 탭 */}
      <div style={styles.tabs}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            style={styles.tab(activeTab === tab.key)}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 목록 카드 */}
      <div style={styles.listCard}>
        <div style={styles.listHeader}>
          <div style={styles.listTitle}>
            플래시 경매 목록 {!loading && `(${auctions.length})`}
          </div>
          <button
            style={styles.createBtn}
            onClick={() => setShowRegisterModal(true)}
          >
            + 새 경매 등록
          </button>
        </div>

        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, width: '50px' }}>#</th>
              <th style={styles.th}>상품</th>
              <th style={{ ...styles.th, width: '100px' }}>상태</th>
              <th style={{ ...styles.th, width: '110px', textAlign: 'right' }}>시작가</th>
              <th style={{ ...styles.th, width: '110px', textAlign: 'right' }}>현재가</th>
              <th style={{ ...styles.th, width: '120px' }}>남은시간</th>
              <th style={{ ...styles.th, width: '60px', textAlign: 'center' }}>입찰</th>
              <th style={{ ...styles.th, width: '180px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={styles.emptyRow}>불러오는 중...</td></tr>
            ) : auctions.length === 0 ? (
              <tr>
                <td colSpan={8} style={styles.emptyRow}>
                  등록된 플래시 경매가 없습니다.
                </td>
              </tr>
            ) : (
              auctions.map((a) => (
                <tr key={a.id}>
                  <td style={styles.td}>{a.id}</td>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div style={{
                        width: 60,
                        height: 60,
                        borderRadius: radius.sm,
                        overflow: 'hidden',
                        background: colors.surface,
                        border: `1px solid ${colors.borderLight}`,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        {a.productImageUrl ? (
                          <img
                            src={a.productImageUrl}
                            alt={a.productName}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          <span style={{ fontSize: '10px', color: colors.textOnLightDim }}>NO IMG</span>
                        )}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 500 }}>{a.productName}</div>
                        <div style={{ fontSize: '11px', color: colors.textOnLightDim, marginTop: '2px' }}>
                          정가 ₩{krw(a.productPrice)} · {a.startPricePercent}% 시작
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.badge(a.status)}>{STATUS_BADGE[a.status]?.label || a.status}</span>
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>₩{krw(a.startPrice)}</td>
                  <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600 }}>
                    {a.status === 'SCHEDULED' ? '-' : `₩${krw(a.currentPrice)}`}
                  </td>
                  <td style={styles.td}>
                    {a.status === 'ACTIVE' && formatRemaining(a.endAt, now)}
                    {a.status === 'SCHEDULED' && formatUntilStart(a.startAt, now)}
                    {(a.status === 'ENDED' || a.status === 'CANCELLED') && '-'}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>{a.bidCount}</td>
                  <td style={styles.td}>
                    {a.status === 'ACTIVE' && (
                      <button
                        style={styles.dangerBtn}
                        onClick={() => handleForceEnd(a)}
                      >
                        강제 종료
                      </button>
                    )}
                    {a.status === 'SCHEDULED' && (
                      <>
                        <button
                          style={styles.actionBtn}
                          onClick={() => setEditingAuction(a)}
                        >
                          수정
                        </button>
                        <button
                          style={styles.dangerBtn}
                          onClick={() => handleCancel(a)}
                        >
                          삭제
                        </button>
                      </>
                    )}
                    {(a.status === 'ENDED' || a.status === 'CANCELLED') && (
                      <span style={{ fontSize: '12px', color: colors.textOnLightDim }}>
                        {formatKst(a.endAt)}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 등록 모달 */}
      {showRegisterModal && (
        <FlashDealRegisterModal
          threshold={threshold}
          onClose={() => setShowRegisterModal(false)}
          onSuccess={() => {
            setShowRegisterModal(false);
            loadData();
          }}
        />
      )}

      {/* 수정 모달 */}
      {editingAuction && (
        <FlashDealEditModal
          auction={editingAuction}
          onClose={() => setEditingAuction(null)}
          onSuccess={() => {
            setEditingAuction(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}
