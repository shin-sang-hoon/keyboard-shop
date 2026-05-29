// frontend/src/utils/assetUrl.js
//
// 업로드 정적 파일(/uploads/**) URL 의 dev/prod origin 보정 (P3 · 자산 #21 fileUrl 패턴 일반화).
//
// 원칙 — "저장은 상대, 표시는 절대":
//   · description HTML 에는 항상 상대 URL(/uploads/...)로 보관 → EC2 배포(Phase 8) 시 동일 origin 안전.
//   · dev 는 프론트(5173)·백엔드(8080) 포트가 달라, 표시(에디터 미리보기 + 사용자 렌더)할 때만
//     백엔드 origin 을 prepend. prod 는 동일 origin 이라 prepend 0 (BACKEND_ORIGIN='').

const BACKEND_ORIGIN = import.meta.env.DEV ? 'http://localhost:8080' : '';

/** 단일 상대경로 → 표시용 절대 URL (이미 http(s) 절대면 그대로). */
export function assetUrl(u) {
  if (!u) return u;
  if (/^https?:\/\//i.test(u)) return u;
  return `${BACKEND_ORIGIN}${u}`;
}

/** HTML 내 src="/uploads/..." 를 표시용 절대 URL 로 (에디터/렌더 진입 시). dev 전용. */
export function prependAssetOrigins(html) {
  if (!html || !BACKEND_ORIGIN) return html || '';
  return html.replaceAll('"/uploads/', `"${BACKEND_ORIGIN}/uploads/`);
}

/** 표시용 절대 URL 을 다시 상대로 (저장 직전 — prod 안전한 canonical 형태). dev 전용. */
export function stripAssetOrigins(html) {
  if (!html || !BACKEND_ORIGIN) return html || '';
  return html.replaceAll(`"${BACKEND_ORIGIN}/uploads/`, '"/uploads/');
}
