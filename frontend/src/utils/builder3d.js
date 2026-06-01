// ───────────────────────────────────────────────────────────────────────────
//  3D 빌더 화이트리스트
//
//  색분리(키캡만 색칠) + 방향이 실제 빌더에서 정상 동작하는 것으로
//  육안 검증을 통과한 GLB 파일명 목록.
//  자동 분석(keycap 수·면적·방향 지표)은 정상/실패를 가리지 못해서,
//  실제 빌더 렌더 스크린샷을 사람이 직접 확인해 확정했다.
//
//  화이트리스트에 없는 GLB는 3D 진입점(카드 뱃지·상세 미리보기·빌더)이
//  모두 비활성화되고, 원래 크롤링 이미지(imageUrl)로 폴백된다.
//
//  파일명은 products.glb_url 의 마지막 경로 조각과 정확히 일치해야 한다.
//  (대소문자 주의: k17-Pro 는 소문자 k)
// ───────────────────────────────────────────────────────────────────────────

const WHITELIST = new Set([
  'K8-Pro-US-Full-Model.glb',
  'K1-Max-US-Full-Model.glb',
  'K5-Max-US-Full-Model.glb',
  'K5-Pro-US-Full-Model.glb',
  'K7-Max-US-Full-Model-20231226.glb',
  'K7-Pro-US-Full-Model-20231226.glb',
  'K8_HE_Standard_Version_US_Full_Model_20260411.glb',
  'K13-Max-US-Full-Model-20241130.glb',
  'K13-Pro-US-Full-Model-20241130.glb',
  'K17-Max-US-Full-Model-20241113.glb',
  'k17-Pro-US-Full-Model-20241113.glb',
  'Q8-US-Full-Model-20220729.glb',
  'Q10-US-Full-Model-20220908.glb',
  'Q13-Pro-US-Full-Model.glb',
  'V1-Max-US-Full-Model-20240808.glb',
]);

/**
 * 주어진 glbUrl 이 3D 빌더에서 정상 동작하는 검증된 모델인지 판정.
 * @param {string|null|undefined} glbUrl - 예: "/models/K-Pro-Series/K8 Pro/K8-Pro-US-Full-Model.glb"
 * @returns {boolean}
 */
export function is3DReady(glbUrl) {
  if (!glbUrl) return false;
  let fileName;
  try {
    fileName = decodeURIComponent(glbUrl).split('/').pop();
  } catch {
    fileName = glbUrl.split('/').pop();
  }
  return WHITELIST.has(fileName);
}

export const WHITELIST_3D = WHITELIST;
