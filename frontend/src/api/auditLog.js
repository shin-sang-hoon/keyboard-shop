// frontend/src/api/auditLog.js
//
// Phase 7 [9-2B] - AuditLog 뷰어 프론트 API (5/14 학원).
// 백엔드: AdminAuditLogController (5/12 학원 commit f86df20).
//
// 권한: SecurityConfig 의 /api/admin/audit-logs/** 임시 permitAll (5-B Round 3 끝났으니
// 추후 hasRole("ADMIN") 으로 격상 예정). 그 동안 JWT 자동 첨부는 apiClient 가 처리.
//
// 5-B fix 컨벤션 (5/12): 모든 함수가 res.data (= 백엔드 JSON body) 만 반환.
// useAuth/페이지에서 data.* 직접 접근 가능.

import apiClient from './client';

export const auditLogApi = {
  /**
   * GET /api/admin/audit-logs
   *
   * @param {Object} params - 모두 선택 (undefined 면 axios 가 query string 에서 제외)
   * @param {number} [params.adminId]
   * @param {string} [params.category]   - PRODUCT / USER / ORDER / CRAWLER / CHATBOT
   * @param {string} [params.eventType]  - CREATE / UPDATE / DELETE / BLOCK / UNBLOCK / EXECUTE / VIEW
   * @param {string} [params.result]     - SUCCESS / FAILURE
   * @param {string} [params.dateFrom]   - ISO 8601 (예: 2026-05-11T00:00:00)
   * @param {string} [params.dateTo]     - ISO 8601
   * @param {number} [params.page=0]
   * @param {number} [params.size=20]
   * @returns PagedResponse<AuditLogDto.ListItem>
   *   { content: [...], totalElements, totalPages, page, size, first, last }
   */
  list: async (params = {}) => {
    // undefined/null/'' 값은 query 에서 제외 (백엔드 @RequestParam(required=false) 와 호환)
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== '')
    );
    const res = await apiClient.get('/admin/audit-logs', { params: cleaned });
    return res.data;
  },

  /**
   * GET /api/admin/audit-logs/{id}
   *
   * @param {number} id
   * @returns AuditLogDto.Detail
   *   ListItem 필드 + detail (JSON 문자열, 마스킹 적용) + userAgent
   */
  getDetail: async (id) => {
    const res = await apiClient.get(`/admin/audit-logs/${id}`);
    return res.data;
  },
};

export default auditLogApi;
