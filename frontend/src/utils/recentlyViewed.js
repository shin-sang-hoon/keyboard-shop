// frontend/src/utils/recentlyViewed.js
//
// 최근 본 상품 localStorage 헬퍼 (5/15 0:45, swagkey UX 패턴 이식).
//
// 정책:
//   - 최대 5개 (swagkey 우측 패널 기준)
//   - 가장 최근 본 상품이 맨 앞 (LIFO)
//   - 중복 productId 는 앞으로 끌어올림 (재방문 시 순서 갱신)
//
// 스토리지 키: 'swachron_recently_viewed'

const KEY = 'swachron_recently_viewed';
const MAX = 5;

export function getRecentlyViewed() {
  try {
    const raw = localStorage.getItem(KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

export function addRecentlyViewed(productId) {
  if (!productId) return;
  try {
    const current = getRecentlyViewed().filter((id) => id !== productId);
    const next = [productId, ...current].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('recentlyViewedChange', { detail: next }));
  } catch {}
}

export function clearRecentlyViewed() {
  try {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new CustomEvent('recentlyViewedChange', { detail: [] }));
  } catch {}
}
