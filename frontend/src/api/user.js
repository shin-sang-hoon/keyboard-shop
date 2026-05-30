// frontend/src/api/user.js
//
// 사용자단 회원정보 API (V23, 회원정보 수정).
// 백엔드: UserController (/api/users/me).
//
// 본인 토큰으로만 동작 — JWT 자동 첨부는 apiClient 인터셉터가 처리.
// 컨벤션 (5/12 5-B fix): 함수는 res.data (백엔드 JSON body) 만 반환.

import apiClient from './client';

export const userApi = {
  /**
   * GET /api/users/me — 내 정보 조회 (회원정보 수정 화면 초기값).
   * @returns UserDto.Me
   *   { id, email, name, nickname, phone, zipcode, address, addressDetail,
   *     provider, displayName }
   */
  getMe: async () => {
    const res = await apiClient.get('/users/me');
    return res.data;
  },

  /**
   * PATCH /api/users/me — 프로필 수정 (닉네임/휴대폰/주소).
   * 이름/이메일/권한은 변경 불가 (DTO 에 필드 없음).
   *
   * @param {Object} body
   * @param {string} [body.nickname]
   * @param {string} [body.phone]
   * @param {string} [body.zipcode]
   * @param {string} [body.address]
   * @param {string} [body.addressDetail]
   * @returns UserDto.Me (수정 후 — displayName 갱신됨)
   */
  updateProfile: async (body) => {
    const res = await apiClient.patch('/users/me', body);
    return res.data;
  },

  /**
   * PATCH /api/users/me/password — 비밀번호 변경 (LOCAL 전용).
   * 현재 비번 검증 후 교체. KAKAO 는 400.
   *
   * @param {string} currentPassword
   * @param {string} newPassword
   * @returns void (200)
   *
   * 백엔드 가드: 현재 비번 불일치 401 / 소셜 계정·짧은 비번·동일 비번 400 → 호출부 catch.
   */
  changePassword: async (currentPassword, newPassword) => {
    const res = await apiClient.patch('/users/me/password', { currentPassword, newPassword });
    return res.data;
  },
};

export default userApi;
