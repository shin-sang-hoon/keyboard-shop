// frontend/src/api/auction.js
// Phase 7 (5/17 update) - 경매 REST API 클라이언트.
// Phase 7 Round 4 (5/18 update) - view/watch 풀스택 함수 2개 추가.
//
// 5/17 18:25 fix: axios 직접 호출 → apiClient 인터셉터 패턴으로 통일
//   - JWT 자동 첨부 (Zustand authStore)
//   - 401 → refresh 자동 처리
//   - baseURL 통일 (client.js 환경변수)
//
// 사용자용 함수 5개 + 관리자용 함수 8개.
// 입찰 자체는 WebSocket (STOMP) 으로 분리.

import apiClient from './client';

// ─── 사용자용 ────────────────────────────────────────────

export async function listAuctions() {
  const res = await apiClient.get('/auctions');
  return res.data;
}

export async function getAuctionDetail(id) {
  const res = await apiClient.get(`/auctions/${id}`);
  return res.data;
}

export async function listAuctionBids(id, limit = 50) {
  const res = await apiClient.get(`/auctions/${id}/bids`, {
    params: { limit },
  });
  return res.data;
}

/**
 * 조회수 +1 (Phase 7 Round 4, 5/18).
 * AuctionDetailPage 진입 시 useEffect 에서 호출.
 * 비로그인 사용자도 호출 가능 (인증 불필요).
 *
 * @param id 경매 ID
 * @returns { viewCount: number } 갱신된 조회수
 */
export async function incrementAuctionView(id) {
  const res = await apiClient.post(`/auctions/${id}/view`);
  return res.data;
}

/**
 * 관심 등록 토글 (Phase 7 Round 4, 5/18).
 * 인증 필수 (apiClient 인터셉터가 401 시 refresh 자동 처리).
 *
 * @param id 경매 ID
 * @returns { watched: boolean, watchCount: number }
 */
export async function toggleAuctionWatch(id) {
  const res = await apiClient.post(`/auctions/${id}/watch`);
  return res.data;
}

// ─── 관리자용 (5/17 신규) ────────────────────────────────

/** GET /api/admin/flash-deal/threshold */
export async function getFlashDealThreshold() {
  const res = await apiClient.get('/admin/flash-deal/threshold');
  return res.data;
}

/** POST /api/admin/flash-deal/threshold/refresh */
export async function refreshThreshold() {
  const res = await apiClient.post('/admin/flash-deal/threshold/refresh');
  return res.data;
}

/** POST /api/admin/auctions/flash-deal — 즉시 등록 (ACTIVE) */
export async function createFlashDeal(body) {
  const res = await apiClient.post('/admin/auctions/flash-deal', body);
  return res.data;
}

/** POST /api/admin/auctions/flash-deal/scheduled — 예약 등록 (SCHEDULED) */
export async function createScheduledFlashDeal(body) {
  const res = await apiClient.post('/admin/auctions/flash-deal/scheduled', body);
  return res.data;
}

/** PATCH /api/admin/auctions/{id} — SCHEDULED 수정 */
export async function updateScheduledAuction(id, body) {
  const res = await apiClient.patch(`/admin/auctions/${id}`, body);
  return res.data;
}

/** POST /api/admin/auctions/{id}/force-end — ACTIVE 강제 종료 */
export async function forceEndAuction(id) {
  const res = await apiClient.post(`/admin/auctions/${id}/force-end`);
  return res.data;
}

/** DELETE /api/admin/auctions/{id} — 취소 (입찰 0건만) */
export async function cancelAuction(id) {
  const res = await apiClient.delete(`/admin/auctions/${id}`);
  return res.data;
}

/** GET /api/admin/auctions/flash-deals/by-statuses?statuses=ACTIVE,SCHEDULED */
export async function listFlashDealsByStatuses(statuses) {
  const res = await apiClient.get('/admin/auctions/flash-deals/by-statuses', {
    params: { statuses: statuses.join(',') },
  });
  return res.data;
}
