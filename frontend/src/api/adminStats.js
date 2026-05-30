// frontend/src/api/adminStats.js
//
// Phase 7-G 라운드 3 (2026-05-24) — 관리자 대시보드 통계 API.
// 5/30 현황 강화 — 상태별 분포 + 알림성 + 최근 목록 추가 (단일 호출).
// 백엔드: AdminStatsController — GET /api/admin/stats.
//
// 권한: SecurityConfig 의 /api/admin/** hasRole("ADMIN") 일괄 가드.
//   JWT 자동 첨부는 apiClient 인터셉터가 처리.
//
// 컨벤션 (5/12 5-B fix): 함수는 res.data (백엔드 JSON body) 만 반환.

import apiClient from './client';

export const adminStatsApi = {
  /**
   * GET /api/admin/stats
   *
   * @returns AdminStatsDto
   *   {
   *     activeProductCount, totalUserCount, reviewCount, orderCount,  // 기존 4 카드
   *     userStatus:    { active, suspended, withdrawn },              // 회원 분포
   *     orderStatus:   { pending, paid, shipping, delivered, cancelled },
   *     productStatus: { active, inactive },
   *     pendingQnaCount, activeAuctionCount,                          // 알림성
   *     recentUsers:  [{ id, email, displayName, provider, status, createdAt }],
   *     recentOrders: [{ id, userName, totalPrice, status, createdAt }]
   *   }
   */
  getStats: async () => {
    const res = await apiClient.get('/admin/stats');
    return res.data;
  },
};

export default adminStatsApi;
