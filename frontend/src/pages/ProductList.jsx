import { useEffect, useMemo, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081/api';

// ─── 카테고리 탭 정의 ────────────────────────────────────────────────────────
// productType=null 은 "All" (백엔드 필터 미적용)
const CATEGORY_TABS = [
  { value: null, label: 'All' },
  { value: 'KEYBOARD', label: '키보드' },
  { value: 'MOUSE', label: '마우스' },
  { value: 'SWITCH_PART', label: '스위치 부품' },
  { value: 'ACCESSORY', label: '액세서리' },
];

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

  // glbUrl 이 있으면 3D 썸네일 시도, 없으면 image_url fallback
  useEffect(() => {
    if (!product.glbUrl) return;
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
  const hasGlb = Boolean(product.glbUrl);
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
            <span style={{
              position: 'absolute', top: 8, right: 8,
              background: '#6366f1', color: '#fff', fontSize: 11,
              padding: '2px 8px', borderRadius: 4, fontWeight: 600,
            }}>3D</span>
          )}
          {product.productType && product.productType !== 'KEYBOARD' && product.productType !== 'UNCLASSIFIED' && (
            <span style={{
              position: 'absolute', top: 8, left: 8,
              background: '#71717a', color: '#fff', fontSize: 10,
              padding: '2px 6px', borderRadius: 4, fontWeight: 500,
            }}>
              {product.productType === 'MOUSE' ? '마우스' :
               product.productType === 'SWITCH_PART' ? '부품' :
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

// ─── 카테고리 탭 컴포넌트 ────────────────────────────────────────────────────
function CategoryTabs({ active, onChange }) {
  return (
    <div style={{
      display: 'flex', gap: 8, marginBottom: 24,
      borderBottom: '1px solid #e4e4e7', paddingBottom: 0,
      overflowX: 'auto',
    }}>
      {CATEGORY_TABS.map((tab) => {
        const isActive = active === tab.value;
        return (
          <button
            key={tab.label}
            onClick={() => onChange(tab.value)}
            style={{
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? '#6366f1' : '#71717a',
              background: 'transparent',
              border: 'none',
              borderBottom: isActive ? '2px solid #6366f1' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        );
      })}
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
  const [products, setProducts] = useState([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(0);
  const [productType, setProductType] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 검색 디바운스 (300ms)
  useEffect(() => {
    const handle = setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(0); // 검색 변경 시 첫 페이지로
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  // 탭 변경 시 첫 페이지로
  useEffect(() => {
    setPage(0);
  }, [productType]);

  // API 호출 (AbortController 로 race condition 방지)
  // React StrictMode dev 모드 이중 호출 + 빠른 탭/검색 전환 시
  // 이전 호출을 cleanup 에서 취소하여 중복 응답/에러 방지
  useEffect(() => {
    const controller = new AbortController();

    const params = new URLSearchParams();
    params.set('page', page);
    params.set('size', PAGE_SIZE);
    if (productType) params.set('productType', productType);
    if (searchQuery) params.set('search', searchQuery);

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
        setProducts(data.content || []);
        setTotalElements(data.totalElements || 0);
        setTotalPages(data.totalPages || 0);
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
  }, [page, productType, searchQuery]);

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 8 }}>키보드 쇼핑몰</h1>
      <p style={{ color: '#71717a', marginBottom: 24, fontSize: 14 }}>
        총 {totalElements.toLocaleString()}개 상품
        {productType && ` · ${CATEGORY_TABS.find((t) => t.value === productType)?.label}`}
        {searchQuery && ` · "${searchQuery}" 검색`}
      </p>

      <input
        type="text"
        placeholder="상품 검색 (이름)"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        style={{
          width: '100%', padding: '12px 16px', fontSize: 15,
          marginBottom: 16, border: '1px solid #d4d4d8', borderRadius: 8,
          boxSizing: 'border-box',
        }}
      />

      <CategoryTabs active={productType} onChange={setProductType} />

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
          {searchQuery ? `"${searchQuery}" 검색 결과가 없습니다.` :
           productType ? `${CATEGORY_TABS.find((t) => t.value === productType)?.label} 카테고리에 상품이 없습니다.` :
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

          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </div>
  );
}