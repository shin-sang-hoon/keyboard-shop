import { useEffect, useMemo, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

// ── 썸네일 캐시 + 동시 로드 제한 ──────────────────────────────────────────
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

    // ─────────────────────────────────────────────────────────────────
    //  cleanup — 어떤 분기에서든 호출되어 WebGL context 즉시 회수
    //   순서: 모델 자원 dispose → renderer dispose → forceContextLoss
    //   forceContextLoss() 는 GPU 에 "이 context 안 쓴다" 명시적 신호
    //   이게 빠지면 dispose() 만으론 GC 시점이 늦어 contexts 한계 초과
    // ─────────────────────────────────────────────────────────────────
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
        renderer.forceContextLoss();   // ★ 핵심: GPU context 즉시 해제
        renderer.domElement.remove();   // canvas DOM 도 정리
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
          cleanup(model);   // 렌더링 중 에러나도 누수 방지
          reject(e);
        }
      },
      undefined,
      (err) => {
        cleanup(null);   // 로드 실패해도 누수 방지
        reject(err);
      }
    );
  });
}

// ── 카드 컴포넌트 ────────────────────────────────────────────────────────
function ProductCard({ product }) {
  const ref = useRef(null);
  const startedRef = useRef(false);
  const [thumb, setThumb] = useState(null);
  const [hover, setHover] = useState(false);

  useEffect(() => {
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
          {thumb ? (
            <img
              src={thumb}
              alt={product.name}
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#a1a1aa', fontSize: 13,
            }}>
              {startedRef.current ? '렌더링 중...' : '미리보기'}
            </div>
          )}
          <span style={{
            position: 'absolute', top: 8, right: 8,
            background: '#6366f1', color: '#fff', fontSize: 11,
            padding: '2px 8px', borderRadius: 4, fontWeight: 600,
          }}>3D</span>
        </div>
        <div style={{
          fontSize: 14, fontWeight: 500, marginBottom: 6, lineHeight: 1.4,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {product.name}
        </div>
        <div style={{ fontSize: 14, color: '#18181b', fontWeight: 600 }}>
          ₩{(product.price || 0).toLocaleString()}
        </div>
      </Link>
    </div>
  );
}

// ── 메인 ─────────────────────────────────────────────────────────────────
export default function ProductList() {
  const [products, setProducts] = useState([]);
  const [validGlbs, setValidGlbs] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/products`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setProducts)
      .catch((err) => setError(`API 호출 실패: ${err.message}`));

    fetch('/validGlbs.json')
      .then((r) => (r.ok ? r.json() : []))
      .then(setValidGlbs)
      .catch(() => setValidGlbs([]));
  }, []);

  const visibleProducts = useMemo(() => {
    if (!validGlbs) return [];
    const validSet = new Set(validGlbs);

    return products.filter((p) => {
      if (!p.glbUrl || !validSet.has(p.glbUrl)) return false;
      if (p.glbUrl.includes('/models/Mice/')) return false;
      if (search.trim()) {
        return (p.name || '').toLowerCase().includes(search.toLowerCase());
      }
      return true;
    });
  }, [products, validGlbs, search]);

  if (error) {
    return <div style={{ padding: 40, color: '#c00', textAlign: 'center' }}>{error}</div>;
  }
  if (!validGlbs) {
    return <div style={{ padding: 40, textAlign: 'center' }}>로딩 중…</div>;
  }

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 8 }}>키보드 상품</h1>
      <p style={{ color: '#71717a', marginBottom: 24, fontSize: 14 }}>
        3D 미리보기 가능한 {visibleProducts.length}개 상품
      </p>

      <input
        type="text"
        placeholder="상품 검색…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: '100%', padding: '12px 16px', fontSize: 15,
          marginBottom: 24, border: '1px solid #d4d4d8', borderRadius: 8,
          boxSizing: 'border-box',
        }}
      />

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 16,
      }}>
        {visibleProducts.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>

      {visibleProducts.length === 0 && (
        <div style={{ padding: 60, textAlign: 'center', color: '#71717a' }}>
          {search ? '검색 결과가 없습니다.' : '표시할 상품이 없습니다.'}
        </div>
      )}
    </div>
  );
}
