// frontend/src/pages/ProductList.jsx
//
// 5-B 라운드 3 - 카테고리 탭 헤더로 통합. 검색 입력창도 제거 (헤더의 Search 오버레이 사용).
//
// 변경:
//   - URL 쿼리스트링이 single source of truth
//     - ?productType=KEYBOARD → 헤더 카테고리 탭 클릭으로 진입
//     - ?search=keyword       → 헤더 Search 오버레이로 진입
//   - useSearchParams로 URL 읽고, useEffect로 백엔드 호출
//   - 페이지 상단에 검색 키워드 표시 + × 버튼으로 검색 해제

import { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { is3DReady } from '../utils/builder3d';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

// productType → 한글 라벨 (페이지 상단 표시용)
const CATEGORY_LABELS = {
  KEYBOARD: '키보드',
  KEYCAP: '키캡',
  SWITCH_PART: '스위치 부품',
  ACCESSORY: '액세서리',
};

// ─── 3D 썸네일 캐시 + 동시 로드 제한 ─────────────────────────────────────────
const thumbCache = new Map();
let activeLoads = 0;
const MAX_CONCURRENT = 3;
const queue = [];

function processQueue() {
  while (activeLoads < MAX_CONCURRENT && queue.length > 0) {
    const job = queue.shift();
    activeLoads++;
    job().finally(() => {
      activeLoads--;
      processQueue();
    });
  }
}

function getThumbnail(glbUrl) {
  if (thumbCache.has(glbUrl)) return thumbCache.get(glbUrl);
  const promise = new Promise((resolve) => {
    queue.push(() => renderThumbnail(glbUrl).then(resolve).catch(() => resolve(null)));
    processQueue();
  });
  thumbCache.set(glbUrl, promise);
  return promise;
}

function renderThumbnail(glbUrl) {
  return new Promise((resolve, reject) => {
    const W = 320, H = 240;
    const renderer = new THREE.WebGLRenderer({
      antialias: true, alpha: true, preserveDrawingBuffer: true,
    });
    renderer.setSize(W, H);
    renderer.setPixelRatio(1.5);
    renderer.outputEncoding = THREE.sRGBEncoding;

    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 2.4));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-3, 8, 6);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x9090ff, 0.5);
    fill.position.set(5, 2, -3);
    scene.add(fill);

    const camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 100);
    camera.position.set(0, 5.5, 14);
    camera.lookAt(0, 0, 0);

    // WebGL 컨텍스트 누수 방지: 모델 dispose → renderer dispose → forceContextLoss
    const cleanup = (model) => {
      try {
        if (model) {
          model.traverse((c) => {
            if (c.geometry) c.geometry.dispose();
            if (c.material) {
              const mats = Array.isArray(c.material) ? c.material : [c.material];
              mats.forEach((m) => {
                if (m.map) m.map.dispose();
                m.dispose();
              });
            }
          });
        }
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      } catch (e) { /* cleanup 중 에러 무시 */ }
    };

    const loader = new GLTFLoader();
    loader.load(
      encodeURI(glbUrl),
      (gltf) => {
        let model = null;
        try {
          model = gltf.scene;
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          const scale = 9 / maxDim;
          model.scale.setScalar(scale);
          model.position.sub(center.multiplyScalar(scale));
          model.rotation.y = -0.45;
          model.rotation.x = -0.18;
          scene.add(model);
          renderer.render(scene, camera);
          const dataUrl = renderer.domElement.toDataURL('image/png');
          cleanup(model);
          resolve(dataUrl);
        } catch (e) {
          cleanup(model);
          reject(e);
        }
      },
      undefined,
      (err) => {
        cleanup(null);
        reject(err);
      }
    );
  });
}

// ─── 카드 컴포넌트 ───────────────────────────────────────────────────────────
function ProductCard({ product }) {
  const ref = useRef(null);
  const startedRef = useRef(false);
  const [thumb, setThumb] = useState(null);
  const [hover, setHover] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [badgeHover, setBadgeHover] = useState(false);

  // glbUrl 이 있으면 3D 썸네일 시도, 없으면 image_url fallback
  useEffect(() => {
    if (!is3DReady(product.glbUrl)) return;
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !startedRef.current) {
            startedRef.current = true;
            getThumbnail(product.glbUrl).then((t) => {
              if (t) setThumb(t);
            });
          }
        });
      },
      { rootMargin: '300px' }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [product.glbUrl]);

  // 표시 우선순위: 3D 썸네일 > image_url > placeholder
  const hasGlb = is3DReady(product.glbUrl) && product.productType === 'KEYBOARD';
  const showImage = !hasGlb && product.imageUrl && !imgError;

  return (
    <div
      ref={ref}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        border: '1px solid #e4e4e7', borderRadius: 12,
        padding: 16, background: '#fff',
        transition: 'all 0.2s',
        boxShadow: hover ? '0 4px 12px rgba(0,0,0,0.08)' : 'none',
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
      }}
    >
      <Link
        to={`/products/${product.id}`}
        style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
      >
        <div style={{
          aspectRatio: '4/3', background: '#f4f4f5', borderRadius: 8,
          marginBottom: 12, overflow: 'hidden', position: 'relative',
        }}>
          {hasGlb && thumb && (
            <img
              src={thumb}
              alt={product.name}
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            />
          )}
          {hasGlb && !thumb && (
            <div style={{
              width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#a1a1aa', fontSize: 13,
            }}>
              {startedRef.current ? '렌더링 중...' : '미리보기'}
            </div>
          )}
          {showImage && (
            <img
              src={product.imageUrl}
              alt={product.name}
              onError={() => setImgError(true)}
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            />
          )}
          {!hasGlb && (!product.imageUrl || imgError) && (
            <div style={{
              width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#a1a1aa', fontSize: 13,
            }}>
              이미지 없음
            </div>
          )}
          {hasGlb && (
            <span
              role="button"
              tabIndex={0}
              title="3D 미리보기 — 키캡·케이스 색상 커스터마이징"
              onClick={(e) => {
                // 카드 전체는 상세(/products/:id)로 가지만, 이 뱃지는 3D 빌더로 진입.
                // 상품 상세의 handle3DPreview 와 동일한 새 창 스펙(1400×900).
                // 바깥 Link 클릭을 둘 다 막아야 함:
                //   preventDefault → 네이티브 <a> 이동 취소, stopPropagation → React Router onClick 차단.
                e.preventDefault();
                e.stopPropagation();
                window.open(`/builder/${product.id}`, '_blank', 'width=1400,height=900');
              }}
              onMouseEnter={() => setBadgeHover(true)}
              onMouseLeave={() => setBadgeHover(false)}
              style={{
                position: 'absolute', top: 8, right: 8,
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: badgeHover ? '#4f46e5' : '#6366f1',
                color: '#fff', fontSize: 11, fontWeight: 700,
                padding: '4px 10px', borderRadius: 6,
                cursor: 'pointer', whiteSpace: 'nowrap',
                boxShadow: '0 1px 4px rgba(79,70,229,0.45)',
              }}
            >
              ⌨️ 3D 미리보기
            </span>
          )}
          {product.productType && product.productType !== 'KEYBOARD' && product.productType !== 'UNCLASSIFIED' && (
            <span style={{
              position: 'absolute', top: 8, left: 8,
              background: '#71717a', color: '#fff', fontSize: 10,
              padding: '2px 6px', borderRadius: 4, fontWeight: 500,
            }}>
              {product.productType === 'KEYCAP' ? '키캡' :
               product.productType === 'SWITCH_PART' ? '스위치' :
               product.productType === 'ACCESSORY' ? '액세서리' : ''}
            </span>
          )}
        </div>
        <div style={{
          fontSize: 14, fontWeight: 500, marginBottom: 6, lineHeight: 1.4,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
          minHeight: 40,
        }}>
          {product.name}
        </div>
        <div style={{ fontSize: 13, color: '#71717a', marginBottom: 4 }}>
          {product.brandName || '키크론'}
        </div>
        <div style={{ fontSize: 14, color: '#18181b', fontWeight: 600 }}>
          ₩{(product.price || 0).toLocaleString()}
        </div>
      </Link>
    </div>
  );
}

// ─── 페이지네이션 컴포넌트 ───────────────────────────────────────────────────
function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;

  // 표시할 페이지 번호 계산 (현재 페이지 ±2)
  const window = 2;
  const start = Math.max(0, page - window);
  const end = Math.min(totalPages - 1, page + window);
  const pages = [];
  for (let i = start; i <= end; i++) pages.push(i);

  const btnStyle = (active, disabled) => ({
    padding: '8px 14px',
    minWidth: 40,
    fontSize: 14,
    fontWeight: active ? 600 : 500,
    color: active ? '#fff' : disabled ? '#a1a1aa' : '#18181b',
    background: active ? '#6366f1' : '#fff',
    border: '1px solid ' + (active ? '#6366f1' : '#d4d4d8'),
    borderRadius: 6,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.15s',
  });

  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      gap: 6, marginTop: 32, flexWrap: 'wrap',
    }}>
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 0}
        style={btnStyle(false, page === 0)}
      >
        ← 이전
      </button>

      {start > 0 && (
        <>
          <button onClick={() => onChange(0)} style={btnStyle(false, false)}>1</button>
          {start > 1 && <span style={{ padding: '0 4px', color: '#a1a1aa' }}>...</span>}
        </>
      )}

      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          style={btnStyle(p === page, false)}
        >
          {p + 1}
        </button>
      ))}

      {end < totalPages - 1 && (
        <>
          {end < totalPages - 2 && <span style={{ padding: '0 4px', color: '#a1a1aa' }}>...</span>}
          <button
            onClick={() => onChange(totalPages - 1)}
            style={btnStyle(false, false)}
          >
            {totalPages}
          </button>
        </>
      )}

      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages - 1}
        style={btnStyle(false, page >= totalPages - 1)}
      >
        다음 →
      </button>
    </div>
  );
}

// ─── 메인 ProductList ────────────────────────────────────────────────────────
const PAGE_SIZE = 24;

export default function ProductList() {
  // URL 쿼리스트링이 single source of truth.
  // 헤더가 URL을 바꾸면 이 페이지가 그걸 읽어 백엔드 호출.
  const [searchParams, setSearchParams] = useSearchParams();
  const productType = searchParams.get('productType') || null;
  const urlSearch = searchParams.get('search') || '';
  const subCategoryId = searchParams.get('subCategoryId') || null;
  // FAB → /products?view=3d : 3D 미리보기 가능한 키보드(화이트리스트 15개)만 모아 보기 모드.
  const is3DView = searchParams.get('view') === '3d';

  const [products, setProducts] = useState([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // [P2] 측면 필터용 하위 카테고리 목록 — productType 이 있을 때만 로드
  const [subCategories, setSubCategories] = useState([]);

  // productType 별 하위 카테고리 로드 (productType 없으면 비움)
  useEffect(() => {
    if (!productType) {
      setSubCategories([]);
      return;
    }
    const controller = new AbortController();
    fetch(`${API_BASE}/sub-categories?productType=${productType}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => setSubCategories(Array.isArray(list) ? list : []))
      .catch((err) => { if (err.name !== 'AbortError') setSubCategories([]); });
    return () => controller.abort();
  }, [productType]);

  // 카테고리/검색/하위분류/3D모드 변경 시 첫 페이지로
  useEffect(() => {
    setPage(0);
  }, [productType, urlSearch, subCategoryId, is3DView]);

  // API 호출 (AbortController 로 race condition 방지)
  // React StrictMode dev 모드 이중 호출 + 빠른 탭/검색 전환 시
  // 이전 호출을 cleanup 에서 취소하여 중복 응답/에러 방지
  useEffect(() => {
    const controller = new AbortController();

    const params = new URLSearchParams();
    if (is3DView) {
      // 3D 화이트리스트(15개)는 프론트(builder3d.js)에만 존재 → 서버가 모름.
      // 키보드 전체를 한 번에 받아 클라이언트에서 is3DReady 로 추린다. 페이징 없음.
      params.set('page', 0);
      params.set('size', 200);
      params.set('productType', 'KEYBOARD');
    } else {
      params.set('page', page);
      params.set('size', PAGE_SIZE);
      if (productType) params.set('productType', productType);
      if (urlSearch) params.set('search', urlSearch);
      if (subCategoryId) params.set('subCategoryId', subCategoryId);
    }

    const url = `${API_BASE}/products?${params.toString()}`;

    setLoading(true);
    setError(null);

    fetch(url, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        // PagedResponse<T> 응답 처리
        const all = data.content || [];
        if (is3DView) {
          const only3d = all.filter(
            (p) => is3DReady(p.glbUrl) && p.productType === 'KEYBOARD'
          );
          setProducts(only3d);
          setTotalElements(only3d.length);
          setTotalPages(1);
        } else {
          setProducts(all);
          setTotalElements(data.totalElements || 0);
          setTotalPages(data.totalPages || 0);
        }
      })
      .catch((err) => {
        // 의도된 abort 는 무시 (다음 호출이 이미 시작됨)
        if (err.name === 'AbortError') return;
        setError(`API 호출 실패: ${err.message}`);
      })
      .finally(() => {
        // abort 된 호출은 loading 그대로 두기 (다음 호출이 처리)
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [page, productType, urlSearch, subCategoryId, is3DView]);

  const clearSearch = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('search');
    setSearchParams(next);
  };

  // [P2] 하위 카테고리 선택/해제 — URL ?subCategoryId 갱신.
  //   같은 걸 또 누르면 토글 해제. productType 은 유지.
  const handleSubCategoryClick = (id) => {
    const next = new URLSearchParams(searchParams);
    if (String(id) === subCategoryId) {
      next.delete('subCategoryId');   // 토글 off
    } else {
      next.set('subCategoryId', String(id));
    }
    setSearchParams(next);
  };

  const clearSubCategory = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('subCategoryId');
    setSearchParams(next);
  };

  const activeSubName = subCategoryId
    ? (subCategories.find((s) => String(s.id) === subCategoryId)?.name || null)
    : null;

  // 본문(상품 그리드 + 페이징) — 사이드바 유무와 무관하게 동일
  const mainContent = (
    <div style={{ flex: 1, minWidth: 0 }}>
      <h1 style={{ marginBottom: 8 }}>키보드 쇼핑몰</h1>
      <p style={{ color: '#71717a', marginBottom: 24, fontSize: 14 }}>
        총 {totalElements.toLocaleString()}개 상품
        {productType && ` · ${CATEGORY_LABELS[productType] || productType}`}
        {activeSubName && (
          <>
            {' '}
            <span style={{ color: '#6366f1', fontWeight: 600 }}>&gt; {activeSubName}</span>
          </>
        )}
        {urlSearch && (
          <>
            {' · '}
            "{urlSearch}" 검색
            <button
              onClick={clearSearch}
              style={{
                marginLeft: 8, padding: '2px 8px', fontSize: 12,
                background: '#f4f4f5', border: '1px solid #d4d4d8',
                borderRadius: 4, cursor: 'pointer',
              }}
            >
              ×
            </button>
          </>
        )}
      </p>

      {is3DView && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 16, flexWrap: 'wrap',
          padding: '16px 20px', marginBottom: 20,
          background: '#eef2ff',
          borderWidth: '1px', borderStyle: 'solid', borderColor: '#c7d2fe',
          borderRadius: 12,
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#3730a3', marginBottom: 4 }}>
              ⌨️ 3D 미리보기 가능한 키보드
            </div>
            <div style={{ fontSize: 13, color: '#4f46e5' }}>
              카드의 <strong>⌨️ 3D 미리보기</strong> 버튼을 누르면 3D로 돌려보고 키캡·케이스 색상을 직접 바꿔볼 수 있어요.
            </div>
          </div>
          <Link
            to="/products"
            style={{
              flexShrink: 0,
              padding: '8px 14px', fontSize: 13, fontWeight: 600,
              color: '#4f46e5', background: '#ffffff',
              borderWidth: '1px', borderStyle: 'solid', borderColor: '#c7d2fe',
              borderRadius: 8, textDecoration: 'none',
            }}
          >
            전체 상품 보기
          </Link>
        </div>
      )}

      {error && (
        <div style={{
          padding: 16, background: '#fef2f2', color: '#991b1b',
          borderRadius: 8, marginBottom: 16, fontSize: 14,
        }}>
          {error}
        </div>
      )}

      {loading && products.length === 0 && (
        <div style={{ padding: 60, textAlign: 'center', color: '#71717a' }}>
          로딩 중...
        </div>
      )}

      {!loading && products.length === 0 && !error && (
        <div style={{ padding: 60, textAlign: 'center', color: '#71717a' }}>
          {is3DView ? '3D 미리보기 가능한 키보드가 없습니다.' :
           urlSearch ? `"${urlSearch}" 검색 결과가 없습니다.` :
           productType ? `${CATEGORY_LABELS[productType] || productType} 카테고리에 상품이 없습니다.` :
           '표시할 상품이 없습니다.'}
        </div>
      )}

      {products.length > 0 && (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 16,
            opacity: loading ? 0.5 : 1,
            transition: 'opacity 0.2s',
          }}>
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>

          {!is3DView && (
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          )}
        </>
      )}
    </div>
  );

  // [P2] 측면 필터 — productType 이 있고 하위 카테고리가 1개 초과일 때만 노출.
  //   '기타'만 있으면(미분류 상태) 필터 의미가 없으므로 숨김.
  const showSidebar = productType && subCategories.length > 1;

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {showSidebar && (
          <aside style={{
            width: 200, flexShrink: 0,
            position: 'sticky', top: 24,
          }}>
            <div style={{
              fontSize: 13, fontWeight: 700, color: '#18181b',
              marginBottom: 12, paddingBottom: 8,
              borderBottom: '1px solid #e4e4e7',
            }}>
              {CATEGORY_LABELS[productType] || productType} 하위 분류
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <li>
                <button
                  onClick={clearSubCategory}
                  style={{
                    width: '100%', textAlign: 'left',
                    padding: '8px 10px', fontSize: 13,
                    background: subCategoryId ? 'transparent' : '#eef2ff',
                    color: subCategoryId ? '#52525b' : '#4f46e5',
                    fontWeight: subCategoryId ? 400 : 600,
                    borderWidth: '0', borderStyle: 'none', borderColor: 'transparent',
                    borderRadius: 6, cursor: 'pointer',
                  }}
                >
                  전체
                </button>
              </li>
              {subCategories.map((s) => {
                const active = String(s.id) === subCategoryId;
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => handleSubCategoryClick(s.id)}
                      style={{
                        width: '100%', textAlign: 'left',
                        padding: '8px 10px', fontSize: 13,
                        background: active ? '#eef2ff' : 'transparent',
                        color: active ? '#4f46e5' : '#52525b',
                        fontWeight: active ? 600 : 400,
                        borderWidth: '0', borderStyle: 'none', borderColor: 'transparent',
                        borderRadius: 6, cursor: 'pointer',
                      }}
                    >
                      {s.name}
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>
        )}
        {mainContent}
      </div>
    </div>
  );
}
