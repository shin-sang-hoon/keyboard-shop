// frontend/src/api/notices.js
// Phase 7-B — 공개 공지 REST API 클라이언트.
//
// 관리자 공지 CRUD(/api/admin/notices)와 분리된 사용자 노출용 엔드포인트.
// auction.js 와 동일하게 apiClient 인터셉터 패턴 사용:
//   - baseURL (client.js) 통일
//   - JWT 자동 첨부 (공지는 공개 API 라 비로그인도 호출 가능)
//   - 401 → refresh 자동 처리
//
// 함수 3개: 목록(서버 페이징) / 상세(prev·next 통합) / 조회수 증가.

import apiClient from './client';

/**
 * 공지 목록 (서버 페이징).
 *
 * @param {number} page 0-indexed 페이지 번호
 * @param {number} size 페이지 크기 (기본 10)
 * @returns PagedResponse — { content, page, size, totalElements, totalPages, first, last, empty }
 *          content 항목: { id, title, pinned, viewCount, createdAt } — 본문 제외.
 */
export async function listNotices(page = 0, size = 10) {
  const res = await apiClient.get('/notices', {
    params: { page, size },
  });
  return res.data;
}

/**
 * 공지 상세 — 본문 + 이전/다음 글을 한 응답에 통합 (왕복 1회).
 *
 * @param {number|string} id 공지 ID
 * @returns { id, title, content, pinned, viewCount, createdAt, updatedAt, prev, next }
 *          prev/next 는 { id, title } 또는 null (양 끝 공지).
 */
export async function getNotice(id) {
  const res = await apiClient.get(`/notices/${id}`);
  return res.data;
}

/**
 * 조회수 +1 — NoticeDetailPage 진입 시 1회 호출.
 *
 * GET 의 멱등성 보존을 위해 조회수 증가만 POST 로 분리했다.
 * 비로그인 사용자도 호출 가능 (인증 불필요).
 *
 * @param {number|string} id 공지 ID
 * @returns { viewCount: number } 증가가 반영된 최신 조회수
 */
export async function incrementNoticeView(id) {
  const res = await apiClient.post(`/notices/${id}/view`);
  return res.data;
}
