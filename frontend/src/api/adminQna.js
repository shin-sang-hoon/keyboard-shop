// frontend/src/api/adminQna.js
//
// 관리자 Q&A 운영 API (7-G R8).
// 백엔드: AdminQnaController (/api/admin/qna)

import apiClient from './client';

// undefined / null / '' 파라미터 제거 — 'false' 문자열은 유효값이므로 보존됨
function clean(params) {
  return Object.fromEntries(
    Object.entries(params || {}).filter(
      ([, v]) => v !== undefined && v !== null && v !== ''
    )
  );
}

export const adminQnaApi = {
  /** Q&A 목록 — params: { answered?: 'true'|'false', page, size } */
  list: async (params = {}) => {
    const res = await apiClient.get('/admin/qna', { params: clean(params) });
    return res.data;
  },

  /** 개별 답변 작성·수정 */
  answer: async (id, answerContent) => {
    const res = await apiClient.post(`/admin/qna/${id}/answer`, { answerContent });
    return res.data;
  },

  /** 미답변 다건 일괄 답변 — qnaIds: number[] */
  batchAnswer: async (qnaIds, answerContent) => {
    const res = await apiClient.post('/admin/qna/answers/batch', {
      qnaIds,
      answerContent,
    });
    return res.data;
  },
};

export default adminQnaApi;
