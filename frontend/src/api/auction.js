// frontend/src/api/auction.js
// Phase 7 후속 (5/17) - 경매 REST API 클라이언트.
// 입찰 자체는 WebSocket (STOMP) 으로 분리 - AuctionDetailPage 에서 직접 처리.

import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

/**
 * 진행중 경매 목록 (endAt 가까운 순).
 */
export async function listAuctions() {
  const res = await axios.get(`${API_BASE}/auctions`);
  return res.data;
}

/**
 * 경매 상세 + 최근 입찰 10개.
 */
export async function getAuctionDetail(id) {
  const res = await axios.get(`${API_BASE}/auctions/${id}`);
  return res.data;
}

/**
 * 경매 입찰 내역 (가격 내림차순).
 */
export async function listAuctionBids(id, limit = 50) {
  const res = await axios.get(`${API_BASE}/auctions/${id}/bids`, {
    params: { limit },
  });
  return res.data;
}
