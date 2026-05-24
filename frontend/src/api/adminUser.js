// frontend/src/api/adminUser.js
//
// Phase 7-G 라운드 4 (2026-05-24) — 관리자 회원 관리 API.
// 백엔드: AdminUserController.
//
// 권한: SecurityConfig 의 /api/admin/** hasRole("ADMIN") 일괄 가드.
//   JWT 자동 첨부는 apiClient 인터셉터가 처리 (auditLog.js 와 동일 패턴).
//
// 컨벤션 (5/12 5-B fix): 함수는 res.data (백엔드 JSON body) 만 반환.

import apiClient from './client';

export const adminUserApi = {
  /**
   * GET /api/admin/users
   *
   * @param {Object} params - 모두 선택
   * @param {string} [params.provider] - LOCAL / KAKAO (생략 시 전체)
   * @param {number} [params.page=0]
   * @param {number} [params.size=20]
   * @returns PagedResponse<UserDto.ListItem>
   *   { content: [{ id, email, name, role, provider, createdAt }], totalElements, totalPages, page, size, first, last, ... }
   */
  list: async (params = {}) => {
    // undefined/null/'' 값은 query 에서 제외 (백엔드 @RequestParam(required=false) 호환)
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== '')
    );
    const res = await apiClient.get('/admin/users', { params: cleaned });
    return res.data;
  },

  /**
   * PATCH /api/admin/users/{id}/role
   *
   * @param {number} id   - 변경 대상 회원 id
   * @param {string} role - 'USER' / 'ADMIN'
   * @returns UserDto.ListItem (변경 후 회원 정보)
   *
   * 백엔드가 본인 권한 변경을 400 으로 차단함 → 호출부에서 catch 필요.
   */
  updateRole: async (id, role) => {
    const res = await apiClient.patch(`/admin/users/${id}/role`, { role });
    return res.data;
  },
};

export default adminUserApi;
