import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

// ── API ───────────────────────────────────────────────────────────────────────
const API_BASE = "http://localhost:8080/api";
const getToken = () => localStorage.getItem("accessToken");
const VERSION = "v3.5";

// ── 옵션 데이터 ───────────────────────────────────────────────────────────────
const LAYOUTS = [
  { id: "65",   name: "65%",   price: 79000,  desc: "68키 컴팩트" },
  { id: "75",   name: "75%",   price: 89000,  desc: "84키 + 방향키" },
  { id: "TKL",  name: "TKL",   price: 109000, desc: "87키 텐키리스" },
  { id: "FULL", name: "풀배열", price: 129000, desc: "104키 풀사이즈" },
];

const SWITCHES = [
  { id: "LINEAR",  name: "리니어", price: 25000, color: "#E74C3C", desc: "부드럽고 빠른 입력" },
  { id: "TACTILE", name: "택타일", price: 28000, color: "#E67E22", desc: "적당한 피드백" },
  { id: "CLICKY",  name: "클리키", price: 30000, color: "#3498DB", desc: "클릭감과 소리" },
];

const KEYCAP_COLORS = [
  { id: "original", name: "오리지널",   hex: null,      price: 0 },
  { id: "white",    name: "화이트 PBT", hex: "#F0EDE8", price: 35000 },
  { id: "black",    name: "블랙 PBT",   hex: "#1A1815", price: 35000 },
  { id: "gray",     name: "스모크",     hex: "#4A4845", price: 38000 },
  { id: "navy",     name: "네이비",     hex: "#1B2A4A", price: 38000 },
  { id: "red",      name: "레트로 레드", hex: "#C0392B", price: 42000 },
  { id: "mint",     name: "민트",       hex: "#2ECC9A", price: 42000 },
];

const CASE_COLORS = [
  { id: "original", name: "오리지널",       hex: null },
  { id: "space",    name: "스페이스 그레이", hex: "#2C2C2E" },
  { id: "silver",   name: "실버",          hex: "#C0C0C0" },
  { id: "black",    name: "블랙",          hex: "#0D0D0D" },
  { id: "cream",    name: "크림 화이트",   hex: "#F5F0E8" },
];

const SWITCH_BASE = Math.min(...SWITCHES.map(s => s.price));

function formatLayoutDiff(targetPrice, currentLayoutId) {
  const currentPrice = LAYOUTS.find(l => l.id === currentLayoutId)?.price ?? targetPrice;
  const diff = targetPrice - currentPrice;
  if (diff === 0) return "기본";
  if (diff > 0) return `+₩${diff.toLocaleString()}`;
  return `-₩${Math.abs(diff).toLocaleString()}`;
}

function formatSwitchDiff(price, base) {
  const diff = price - base;
  if (diff === 0) return "기본";
  if (diff > 0) return `+₩${diff.toLocaleString()}`;
  return `-₩${Math.abs(diff).toLocaleString()}`;
}

// ── 모델 라인/레이아웃 매핑 ───────────────────────────────────────────────
function getModelLine(glbUrl) {
  if (!glbUrl) return null;
  const decoded = decodeURIComponent(glbUrl);
  const m = decoded.match(/\/models\/[^/]+\/([^/]+)\//);
  if (!m) return null;
  const folder = m[1].replace(/\s+/g, '');
  const modelMatch = folder.match(/^([KQVCLP]\d+)/i);
  return modelMatch ? modelMatch[1].toUpperCase() : null;
}

const KEYCHRON_LAYOUT_MAP = {
  K6: "65", K7: "65", K11: "65",
  K2: "75", K3: "75", K15: "75",
  K1: "TKL", K8: "TKL",
  K5: "FULL", K10: "FULL",
  Q2: "65", Q1: "75", Q3: "TKL", Q6: "FULL", Q13: "FULL",
  V2: "65", V1: "75", V3: "TKL", V6: "FULL",
  C1: "TKL", C3: "TKL", C2: "FULL",
  P1: "65",
  K0: null, K4: null, K9: null, K12: null, K13: null, K14: null, K17: null,
  Q0: null, Q4: null, Q5: null, Q7: null, Q8: null, Q9: null,
  Q10: null, Q11: null, Q12: null, Q60: null, Q65: null,
  V4: null, V5: null, V7: null, V8: null, V10: null,
  L1: null, L3: null,
};

function detectLayoutFromGlbUrl(glbUrl) {
  const line = getModelLine(glbUrl);
  if (!line) return null;
  return KEYCHRON_LAYOUT_MAP[line] ?? null;
}

function isAccessoryGlb(glbUrl) {
  if (!glbUrl) return true;
  const n = glbUrl.toLowerCase();
  if (/stabilizer|bottom[-_]case|top[-_]case/.test(n)) return true;
  if (/-knob\.glb$|\/knob\.glb$/.test(n)) return true;
  if (n.includes('keycap') && !/full[-_]model/.test(n)) return true;
  if (n.includes('/mice/')) return true;
  return false;
}

// ─────────────────────────────────────────────────────────────────────────
//  v3.5: 면적 mode 기반 자동 적응형 분류
//
//  핵심 아이디어:
//   키보드의 mesh 중 가장 많은 동일 면적을 가진 그룹은 "일반 키캡"이다.
//   이 mode 면적을 자동으로 감지해 keycap 면적 reference로 삼고,
//   reference의 [0.2배 ~ 15배] 범위에 들어오는 mesh를 keycap으로 분류한다.
//   - 0.2배 미만: 스위치 stem, LED 디퓨저 등 작은 부속 → case
//   - 15배 초과: 외곽 셸, 상판 플레이트 등 큰 외곽 → case
//   - 그 사이: 일반 키캡 + 큰 키캡(스페이스바 6.25u 포함) → keycap
//
//  위치 임계값(yTopNorm < 0.20)은 모델 하단만 강제 case로 처리.
//  인체공학 키보드처럼 키캡 위치가 다양해도 면적 기반으로 정확히 분류됨.
// ─────────────────────────────────────────────────────────────────────────

function classifyByName(name) {
  if (!name) return null;
  const n = name.toLowerCase();
  if (/(keycap|caps?\b|key(?!board)|button|space|shift|arrow|legend|abs|pbt)/.test(n)) return "keycap";
  if (/(case|chassis|shell|plate|frame|housing|alumin|polycarbonate|wood|knob|rubber|bottom|deck|brass|pcb|bezel)/.test(n)) return "case";
  return null;
}

function autoOrientModel(model) {
  const meshes = [];
  model.traverse(c => { if (c.isMesh) meshes.push(c); });
  if (meshes.length === 0) return false;

  const modelBox = new THREE.Box3().setFromObject(model);
  const yCenter = (modelBox.min.y + modelBox.max.y) / 2;

  const meshData = meshes.map(m => {
    const box = new THREE.Box3().setFromObject(m);
    const sz = box.getSize(new THREE.Vector3());
    return {
      area: sz.x * sz.z,
      yCenter: (box.min.y + box.max.y) / 2,
    };
  });
  meshData.sort((a, b) => b.area - a.area);
  const topAreaMeshes = meshData.slice(0, 5);
  const avgY = topAreaMeshes.reduce((s, d) => s + d.yCenter, 0) / topAreaMeshes.length;

  const isFlipped = avgY > yCenter;
  if (isFlipped) {
    console.warn(`⚠️ GLB 방향 뒤집힘 감지 → 180도 회전 보정`);
    model.rotation.x = Math.PI;
    model.updateMatrixWorld(true);
    const newBox = new THREE.Box3().setFromObject(model);
    const newCenter = newBox.getCenter(new THREE.Vector3());
    model.position.sub(newCenter);
    model.position.y += 0.5;
  }
  return isFlipped;
}

function tagMeshRoles(model, fileName) {
  const meshes = [];
  model.traverse(c => { if (c.isMesh) meshes.push(c); });
  if (meshes.length === 0) return;

  // ── 1. 모델 박스 ──────────────────────────────────────────────────────
  const modelBox = new THREE.Box3().setFromObject(model);
  const yMin = modelBox.min.y;
  const yMax = modelBox.max.y;
  const yRange = (yMax - yMin) || 1;

  // ── 2. 메트릭 수집 ────────────────────────────────────────────────────
  const data = meshes.map(m => {
    const box = new THREE.Box3().setFromObject(m);
    const sz = box.getSize(new THREE.Vector3());
    const matName = (Array.isArray(m.material) ? m.material[0]?.name : m.material?.name) || '';
    const objName = m.name || '';
    return {
      mesh: m,
      yTop: box.max.y,
      yTopNorm:    (box.max.y - yMin) / yRange,
      yCenterNorm: ((box.min.y + box.max.y) / 2 - yMin) / yRange,
      area:   Math.max(sz.x * sz.z, 1e-9),
      volume: Math.max(sz.x * sz.y * sz.z, 1e-9),
      nameRole: classifyByName(matName) || classifyByName(objName),
      role: null,
    };
  });

  // ── 3. 이름으로 명확히 식별되는 mesh 우선 분류 ─────────────────────────
  let nameTagged = 0;
  data.forEach(d => {
    if (d.nameRole) { d.role = d.nameRole; nameTagged++; }
  });

  // ── 4. 면적 mode 자동 감지 (log10 히스토그램) ──────────────────────────
  //   키보드의 일반 키캡 mesh가 가장 많은 동일 면적 그룹을 형성한다.
  //   log10(area)를 0.25 단위 bin으로 나누어 가장 카운트가 많은 bin을 찾음.
  const bins = {};
  data.forEach(d => {
    if (d.role) return;  // 이름으로 분류된 건 제외
    const bin = Math.round(Math.log10(d.area) * 4) / 4;  // log10 0.25 단위
    bins[bin] = (bins[bin] || 0) + 1;
  });

  let modeBin = null, modeCount = 0;
  for (const b in bins) {
    if (bins[b] > modeCount) { modeCount = bins[b]; modeBin = parseFloat(b); }
  }
  // bin 중간값을 reference로 (0.25 단위 bin의 중심)
  const refArea = modeBin !== null ? Math.pow(10, modeBin + 0.125) : 0.01;

  // ── 5. 키캡 면적 범위 결정 ────────────────────────────────────────────
  //   일반 키캡 ≈ refArea (1u)
  //   스페이스바 ≈ refArea × 6.25 (FULL 키보드)
  //   → 안전 마진을 두어 0.2배 ~ 15배 범위를 keycap으로 인정
  const KP_MIN_RATIO = 0.2;   // 이보다 작으면 스위치 stem, LED, 작은 부속
  const KP_MAX_RATIO = 15;    // 이보다 크면 외곽 셸, 상판 플레이트
  const kpMinArea = refArea * KP_MIN_RATIO;
  const kpMaxArea = refArea * KP_MAX_RATIO;

  // ── 6. 분류: 면적 + 위치 ──────────────────────────────────────────────
  //   분류 우선순위:
  //     (a) 면적 < kpMinArea         → case  (작은 부속)
  //     (b) 면적 > kpMaxArea         → case  (외곽 셸)
  //     (c) yTopNorm < 0.20          → case  (모델 하단부)
  //     (d) 그 외                    → keycap
  const Y_VERY_LOW = 0.20;

  let smallCount = 0, largeCount = 0, lowCount = 0;
  data.forEach(d => {
    if (d.role) return;
    if (d.area < kpMinArea) { d.role = 'case'; smallCount++; return; }
    if (d.area > kpMaxArea) { d.role = 'case'; largeCount++; return; }
    if (d.yTopNorm < Y_VERY_LOW) { d.role = 'case'; lowCount++; return; }
    d.role = 'keycap';
  });

  // ── 7. 안전장치 ───────────────────────────────────────────────────────
  let stats = { keycap: 0, case: 0 };
  data.forEach(d => stats[d.role]++);

  if (stats.case === 0) {
    const sorted = [...data].sort((a, b) => b.area - a.area);
    const maxArea = sorted[0].area;
    sorted.forEach(d => { if (d.area >= maxArea * 0.3) d.role = 'case'; });
    console.warn(`[${fileName}] case 0 → 면적 최대치 기준 강제 지정`);
  }
  if (stats.keycap === 0) {
    let restored = 0;
    data.forEach(d => {
      if (d.role === 'case' && d.area >= kpMinArea && d.area <= kpMaxArea && d.yTopNorm > 0.30) {
        d.role = 'keycap';
        restored++;
      }
    });
    console.warn(`[${fileName}] keycap 0 → 면적 정상범위에서 ${restored}개 복원`);
  }

  // ── 8. 적용 ──────────────────────────────────────────────────────────
  data.forEach(d => { d.mesh.userData.role = d.role; });

  // ── 9. 디버그 로그 ────────────────────────────────────────────────────
  stats = { keycap: 0, case: 0 };
  data.forEach(d => stats[d.role]++);
  console.log(
    `[${VERSION}][${fileName}] mesh ${data.length} → 키캡:${stats.keycap}, 케이스:${stats.case} ` +
    `(name:${nameTagged}, refArea=${refArea.toFixed(3)}(mode×${modeCount}), ` +
    `kpRange=[${kpMinArea.toFixed(3)}, ${kpMaxArea.toFixed(3)}], ` +
    `→case: small=${smallCount}, large=${largeCount}, low=${lowCount})`
  );
}

// ── 캐시 ─────────────────────────────────────────────────────────────────
let _productsPromise = null;
function fetchAllProducts() {
  if (_productsPromise) return _productsPromise;
  _productsPromise = fetch(`${API_BASE}/products`)
    .then(r => r.ok ? r.json() : [])
    .catch(() => []);
  return _productsPromise;
}

let _validGlbsPromise = null;
function fetchValidGlbs() {
  if (_validGlbsPromise) return _validGlbsPromise;
  _validGlbsPromise = fetch('/validGlbs.json')
    .then(r => r.ok ? r.json() : [])
    .then(arr => new Set(arr))
    .catch(() => new Set());
  return _validGlbsPromise;
}

// ── 메인 ─────────────────────────────────────────────────────────────────
export default function KeyboardBuilder({
  productId       = null,
  glbUrl          = null,
  productName     = "",
  productLayout   = null,
  productDescription = "",
  basePrice       = null,
}) {
  const navigate = useNavigate();

  const mountRef   = useRef(null);
  const sceneRef   = useRef(null);
  const rendRef    = useRef(null);
  const cameraRef  = useRef(null);
  const modelRef   = useRef(null);
  const dragRef    = useRef({ drag:false, px:0, py:0, ry:0, rx:0, autoRot:true, t:0 });
  const rafRef     = useRef(null);

  const currentLayout = detectLayoutFromGlbUrl(glbUrl);
  const currentLine = getModelLine(glbUrl);

  const [layout,    setLayout]    = useState(currentLayout);
  const [sw,        setSw]        = useState("LINEAR");
  const [keycap,    setKeycap]    = useState(KEYCAP_COLORS[0]);
  const [caseColor, setCaseColor] = useState(CASE_COLORS[0]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [myBuilds,  setMyBuilds]  = useState([]);
  const [layoutVariants, setLayoutVariants] = useState({});

  const swPrice     = SWITCHES.find(s => s.id === sw)?.price || 0;
  const layoutPrice = LAYOUTS.find(l => l.id === layout)?.price || 0;
  const totalPrice  = (basePrice != null ? basePrice : layoutPrice) + swPrice + (keycap?.price || 0);

  useEffect(() => {
    setLayout(currentLayout);
  }, [currentLayout]);

  useEffect(() => {
    console.log(`[${VERSION}] Product 데이터:`, {
      productId, productName, productLayout, glbUrl, basePrice,
      detectedLayout: currentLayout,
      modelLine: currentLine,
    });
  }, [productId, productName, productLayout, glbUrl, basePrice, currentLayout, currentLine]);

  useEffect(() => {
    if (!glbUrl || !currentLine) {
      setLayoutVariants({});
      return;
    }

    Promise.all([fetchAllProducts(), fetchValidGlbs()]).then(([allProducts, validSet]) => {
      const variants = {};
      const usedGlbs = new Set();

      for (const p of allProducts) {
        if (!p.glbUrl) continue;
        if (!validSet.has(p.glbUrl)) continue;
        if (isAccessoryGlb(p.glbUrl)) continue;
        if (getModelLine(p.glbUrl) !== currentLine) continue;
        if (usedGlbs.has(p.glbUrl)) continue;

        const lay = detectLayoutFromGlbUrl(p.glbUrl);
        if (lay && !variants[lay]) {
          variants[lay] = p;
          usedGlbs.add(p.glbUrl);
        }
      }
      console.log(`[${VERSION}] Layout variants for line ${currentLine}:`, variants);
      setLayoutVariants(variants);
    });
  }, [glbUrl, currentLine]);

  // ── Three.js 초기화 ─────────────────────────────────────────────────────
  useEffect(() => {
    const wrap = mountRef.current;
    if (!wrap) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.setSize(wrap.clientWidth, wrap.clientHeight);
    wrap.appendChild(renderer.domElement);
    rendRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xF0EEE9);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(36, wrap.clientWidth / wrap.clientHeight, 0.1, 200);
    camera.position.set(0, 8, 18);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    scene.add(new THREE.AmbientLight(0xffffff, 2.5));
    const sun = new THREE.DirectionalLight(0xfff8e8, 3.0);
    sun.position.set(-5, 12, 8);
    sun.castShadow = true;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x7080ff, 1.0);
    fill.position.set(6, 3, -5);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.8);
    rim.position.set(0, -4, -10);
    scene.add(rim);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.ShadowMaterial({ opacity: 0.15 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.5;
    ground.receiveShadow = true;
    scene.add(ground);

    const d = dragRef.current;
    function loop() {
      rafRef.current = requestAnimationFrame(loop);
      d.t += 0.006;
      if (d.autoRot && modelRef.current) {
        modelRef.current.rotation.y = d.ry + Math.sin(d.t * 0.35) * 0.22;
      }
      renderer.render(scene, camera);
    }
    loop();

    const onDown = e => { d.drag=true; d.px=e.clientX; d.py=e.clientY; d.autoRot=false; };
    const onUp   = () => { d.drag=false; setTimeout(()=>d.autoRot=true,2500); };
    const onMove = e => {
      if (!d.drag || !modelRef.current) return;
      d.ry += (e.clientX - d.px) * 0.013;
      d.rx = Math.max(-0.55, Math.min(0.55, d.rx + (e.clientY - d.py) * 0.009));
      modelRef.current.rotation.y = d.ry;
      modelRef.current.rotation.x = d.rx;
      d.px=e.clientX; d.py=e.clientY;
    };
    const onTouchStart = e => { d.drag=true; d.px=e.touches[0].clientX; d.py=e.touches[0].clientY; d.autoRot=false; };
    const onTouchEnd   = () => { d.drag=false; setTimeout(()=>d.autoRot=true,2500); };
    const onTouchMove  = e => {
      if (!d.drag || !modelRef.current) return;
      d.ry += (e.touches[0].clientX - d.px) * 0.013;
      d.rx = Math.max(-0.55, Math.min(0.55, d.rx + (e.touches[0].clientY - d.py) * 0.009));
      modelRef.current.rotation.y = d.ry;
      modelRef.current.rotation.x = d.rx;
      d.px=e.touches[0].clientX; d.py=e.touches[0].clientY;
    };
    wrap.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("mousemove", onMove);
    wrap.addEventListener("touchstart", onTouchStart, { passive:true });
    wrap.addEventListener("touchend", onTouchEnd);
    wrap.addEventListener("touchmove", onTouchMove, { passive:true });

    const ro = new ResizeObserver(() => {
      const w = wrap.clientWidth, h = wrap.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(wrap);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      wrap.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("mousemove", onMove);
      wrap.removeEventListener("touchstart", onTouchStart);
      wrap.removeEventListener("touchend", onTouchEnd);
      wrap.removeEventListener("touchmove", onTouchMove);
      try { wrap.removeChild(renderer.domElement); } catch {}
      renderer.dispose();
    };
  }, []);

  const applyColors = useCallback((keycapHex, caseHex) => {
    if (!modelRef.current) return;
    modelRef.current.traverse(child => {
      if (!child.isMesh) return;
      const role = child.userData.role;
      if (!role) return;
      const target = role === 'keycap' ? keycapHex : caseHex;
      const origs = child.userData.origColors || [];
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((mat, i) => {
        if (!mat?.color) return;
        if (target) {
          mat.color.set(target);
        } else if (origs[i]) {
          mat.color.copy(origs[i]);
        }
      });
    });
  }, []);

  // ── GLB 로드 ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (!glbUrl) {
      setLoading(false);
      setLoadError("GLB 경로가 없습니다");
      return;
    }

    setLoading(true);
    setLoadError(null);

    if (modelRef.current) {
      scene.remove(modelRef.current);
      modelRef.current = null;
    }

    const fileName = glbUrl.split("/").pop();

    fetchValidGlbs().then(validSet => {
      if (!validSet.has(glbUrl)) {
        console.warn("⚠️ GLB가 화이트리스트에 없음:", glbUrl);
        setLoadError(`이 모델의 3D 파일이 준비되지 않았습니다`);
        setLoading(false);
        return;
      }

      const encodedUrl = encodeURI(glbUrl);
      const loader = new GLTFLoader();
      loader.load(
        encodedUrl,
        (gltf) => {
          const model = gltf.scene;

          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          const scale = 10 / maxDim;
          model.scale.setScalar(scale);
          model.position.sub(center.multiplyScalar(scale));
          model.position.y += 0.5;

          model.traverse(child => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              if (Array.isArray(child.material)) {
                child.material = child.material.map(m => m ? m.clone() : m);
              } else if (child.material) {
                child.material = child.material.clone();
              }
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              child.userData.origColors = mats.map(m => m?.color?.clone());
            }
          });

          autoOrientModel(model);
          tagMeshRoles(model, fileName);

          modelRef.current = model;
          scene.add(model);
          setLoading(false);

          applyColors(keycap.hex, caseColor.hex);
        },
        undefined,
        (err) => {
          console.error("GLB 로드 실패:", glbUrl, err);
          setLoadError(`모델 로드 실패: ${fileName}`);
          setLoading(false);
        }
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glbUrl]);

  useEffect(() => {
    applyColors(keycap.hex, caseColor.hex);
  }, [keycap, caseColor, applyColors]);

  const fetchMyBuilds = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/builds/my`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) setMyBuilds(await res.json());
    } catch {}
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/builds`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        },
        body: JSON.stringify({
          productId,
          buildConfig: { layout, switchType: sw, keycapColor: keycap.id, caseColor: caseColor.id, totalPrice },
        }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      fetchMyBuilds();
    } catch {
      alert("저장 실패: 로그인이 필요합니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleLoadBuild = (b) => {
    const cfg = b.buildConfig;
    if (cfg.switchType) setSw(cfg.switchType);
    if (cfg.keycapColor) setKeycap(KEYCAP_COLORS.find(k=>k.id===cfg.keycapColor)||KEYCAP_COLORS[0]);
    if (cfg.caseColor)  setCaseColor(CASE_COLORS.find(c=>c.id===cfg.caseColor)||CASE_COLORS[0]);
  };

  const handleLayoutClick = (l) => {
    const variant = layoutVariants[l.id];
    if (!variant || variant.id === productId) return;
    navigate(`/products/${variant.id}`);
  };

  return (
    <div style={S.container}>
      <p style={S.pageTitle}>
        {productName ? `${productName} · CUSTOM` : "KEYBOARD CUSTOM BUILDER · 3D"}
      </p>
      {productDescription && (
        <p style={S.pageSub}>{productDescription}</p>
      )}

      <div style={S.builder}>
        <div style={S.viewer}>
          <div ref={mountRef} style={S.canvas} />
          {loading && (
            <div style={S.loadingOverlay}>
              <div style={S.spinner} />
              <p style={S.loadingText}>모델 불러오는 중...</p>
            </div>
          )}
          {loadError && !loading && (
            <div style={S.loadingOverlay}>
              <p style={{ color: "#a23", fontSize: 13 }}>{loadError}</p>
            </div>
          )}
          {!loading && !loadError && <p style={S.dragHint}>드래그로 회전</p>}
        </div>

        <div style={S.panel}>
          <Section title="레이아웃 옵션">
            {LAYOUTS.map(l => {
              const variant = layoutVariants[l.id];
              const isCurrent = l.id === layout;
              const isAvailable = isCurrent || (variant && variant.id !== productId);
              return (
                <OptionCard
                  key={l.id}
                  selected={isCurrent}
                  disabled={!isAvailable}
                  onClick={() => handleLayoutClick(l)}
                  title={l.name}
                  sub={l.desc}
                  priceText={isAvailable ? formatLayoutDiff(l.price, layout) : "미지원"}
                />
              );
            })}
          </Section>

          <Section title="스위치">
            {SWITCHES.map(s => (
              <OptionCard key={s.id} selected={sw===s.id}
                onClick={()=>setSw(s.id)}
                title={s.name} sub={s.desc}
                priceText={formatSwitchDiff(s.price, SWITCH_BASE)} accent={s.color} />
            ))}
          </Section>

          <Section title="케이스 색상">
            <div style={S.colorRow}>
              {CASE_COLORS.map(c => (
                <button key={c.id} title={c.name} onClick={()=>setCaseColor(c)}
                  style={{
                    ...S.colorDot,
                    background: c.hex || "linear-gradient(135deg,#e0e0e0,#fff)",
                    border: caseColor.id===c.id ? "2px solid #4A42B0" : "2px solid rgba(0,0,0,0.15)",
                    outline: caseColor.id===c.id ? "2px solid #4A42B0" : "none",
                    outlineOffset: "2px",
                  }}
                />
              ))}
            </div>
            <p style={S.colorLabel}>{caseColor.name}</p>
          </Section>

          <Section title="키캡 색상">
            <div style={S.colorRow}>
              {KEYCAP_COLORS.map(k => (
                <button key={k.id} title={k.name} onClick={()=>setKeycap(k)}
                  style={{
                    ...S.colorDot,
                    background: k.hex || "linear-gradient(135deg,#f0ede8,#c0bdb8)",
                    border: keycap.id===k.id ? "2px solid #4A42B0" : "2px solid rgba(0,0,0,0.15)",
                    outline: keycap.id===k.id ? "2px solid #4A42B0" : "none",
                    outlineOffset: "2px",
                  }}
                />
              ))}
            </div>
            <p style={S.colorLabel}>{keycap.name} {keycap.price>0 ? `+₩${keycap.price.toLocaleString()}` : ""}</p>
          </Section>

          <div style={S.summary}>
            <SumRow label="레이아웃" value={LAYOUTS.find(l=>l.id===layout)?.name || "—"} />
            <SumRow label="스위치"   value={SWITCHES.find(s=>s.id===sw)?.name} />
            <SumRow label="케이스"   value={caseColor.name} />
            <SumRow label="키캡"     value={keycap.name} />
          </div>

          <div style={S.totalRow}>
            <span style={S.totalLabel}>총 가격</span>
            <span style={S.totalPrice}>₩{totalPrice.toLocaleString()}</span>
          </div>

          <button onClick={handleSave} disabled={saving} style={{
            ...S.saveBtn,
            background: saved ? "#27AE60" : "#4A42B0",
            opacity: saving ? 0.7 : 1,
          }}>
            {saving ? "저장 중..." : saved ? "✓ 저장됨!" : "빌드 저장하기"}
          </button>

          <button onClick={fetchMyBuilds} style={S.loadBtn}>내 빌드 불러오기</button>

          {myBuilds.length > 0 && (
            <div style={S.buildList}>
              <p style={S.buildListTitle}>저장된 빌드 ({myBuilds.length})</p>
              {myBuilds.map((b, i) => (
                <button key={b.id} onClick={()=>handleLoadBuild(b)} style={S.buildItem}>
                  빌드 #{i+1} · {b.buildConfig?.layout} · {b.buildConfig?.switchType} · ₩{b.buildConfig?.totalPrice?.toLocaleString()}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={S.section}>
      <p style={S.sectionTitle}>{title}</p>
      <div style={S.optionGrid}>{children}</div>
    </div>
  );
}

function OptionCard({ selected, onClick, title, sub, priceText, accent, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...S.optionCard,
        borderColor: selected ? "#4A42B0" : "rgba(0,0,0,0.1)",
        background: selected ? "#EDECFA" : (disabled ? "#F5F4F1" : "#FFFFFF"),
        opacity: disabled && !selected ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <div style={{ display:"flex", alignItems:"center", gap:"10px", flex:1 }}>
        {accent && <span style={{ ...S.accent, background: accent }} />}
        <div style={{ display:"flex", flexDirection:"column", gap:"2px" }}>
          <span style={S.optionName}>{title}</span>
          <span style={S.optionSub}>{sub}</span>
        </div>
      </div>
      <span style={{
        ...S.optionPrice,
        color: priceText === "기본" ? "#8A8680"
             : priceText === "미지원" ? "#B8B5B0"
             : priceText.startsWith("+") ? "#4A42B0"
             : "#27AE60",
      }}>{priceText}</span>
    </button>
  );
}

function SumRow({ label, value }) {
  return (
    <div style={S.sumRow}>
      <span style={S.sumLabel}>{label}</span>
      <span style={S.sumVal}>{value}</span>
    </div>
  );
}

const S = {
  container: { fontFamily:"'DM Sans','Pretendard',sans-serif", background:"#F0EEE9", minHeight:"100vh", padding:"2rem", color:"#1A1814" },
  pageTitle: { textAlign:"center", fontSize:"11px", fontWeight:600, letterSpacing:"0.14em", textTransform:"uppercase", color:"#5A5855", marginBottom:"4px" },
  pageSub:   { textAlign:"center", fontSize:"12px", color:"#8A8680", marginBottom:"1.5rem" },
  builder:   { display:"grid", gridTemplateColumns:"1fr 360px", gap:"18px", maxWidth:"1080px", margin:"0 auto" },
  viewer:    { background:"#F0EEE9", borderRadius:"14px", overflow:"hidden", position:"relative", minHeight:"480px", border:"1px solid rgba(0,0,0,0.08)" },
  canvas:    { width:"100%", height:"100%", minHeight:"480px", cursor:"grab" },
  loadingOverlay: { position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:"rgba(240,238,233,0.85)", gap:"12px" },
  spinner:   { width:"36px", height:"36px", border:"3px solid #EDECFA", borderTop:"3px solid #4A42B0", borderRadius:"50%", animation:"spin 0.8s linear infinite" },
  loadingText: { fontSize:"13px", color:"#8A8680" },
  dragHint:  { position:"absolute", bottom:"14px", left:"50%", transform:"translateX(-50%)", fontSize:"11px", color:"rgba(0,0,0,0.3)", letterSpacing:"0.05em", pointerEvents:"none" },
  panel:     { display:"flex", flexDirection:"column", gap:"14px" },
  section:   { background:"#FFFFFF", borderRadius:"12px", padding:"16px", border:"1px solid rgba(0,0,0,0.07)" },
  sectionTitle: { fontSize:"11px", fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:"#8A8680", marginBottom:"12px" },
  optionGrid: { display:"flex", flexDirection:"column", gap:"8px" },
  optionCard: { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 12px", borderRadius:"8px", border:"1.5px solid", textAlign:"left", transition:"all 0.15s", width:"100%", fontFamily:"inherit" },
  accent:    { width:"8px", height:"8px", borderRadius:"50%", flexShrink:0, display:"block" },
  optionName: { fontSize:"13px", fontWeight:500, color:"#1A1814" },
  optionSub:  { fontSize:"11px", color:"#8A8680" },
  optionPrice: { fontSize:"12px", fontWeight:500, whiteSpace:"nowrap" },
  colorRow:  { display:"flex", gap:"10px", flexWrap:"wrap", marginBottom:"8px" },
  colorDot:  { width:"28px", height:"28px", borderRadius:"50%", cursor:"pointer", transition:"all 0.15s" },
  colorLabel: { fontSize:"12px", color:"#5A5855" },
  summary:   { background:"#FFFFFF", borderRadius:"12px", padding:"14px 16px", border:"1px solid rgba(0,0,0,0.07)", display:"flex", flexDirection:"column", gap:"6px" },
  sumRow:    { display:"flex", justifyContent:"space-between", fontSize:"12px" },
  sumLabel:  { color:"#8A8680" },
  sumVal:    { color:"#1A1814", fontWeight:500 },
  totalRow:  { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 16px", background:"#FFFFFF", borderRadius:"10px", border:"1px solid rgba(0,0,0,0.07)" },
  totalLabel: { fontSize:"13px", fontWeight:500, color:"#5A5855" },
  totalPrice: { fontSize:"20px", fontWeight:700, color:"#1A1814" },
  saveBtn:   { width:"100%", padding:"13px", borderRadius:"10px", border:"none", color:"#FFFFFF", fontSize:"14px", fontWeight:600, cursor:"pointer", transition:"all 0.2s", letterSpacing:"0.03em", fontFamily:"inherit" },
  loadBtn:   { width:"100%", padding:"10px", borderRadius:"10px", border:"1.5px solid rgba(0,0,0,0.12)", background:"transparent", color:"#5A5855", fontSize:"13px", fontWeight:500, cursor:"pointer", fontFamily:"inherit" },
  buildList: { background:"#FFFFFF", borderRadius:"10px", padding:"12px", border:"1px solid rgba(0,0,0,0.07)", display:"flex", flexDirection:"column", gap:"6px" },
  buildListTitle: { fontSize:"11px", fontWeight:600, color:"#8A8680", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:"4px" },
  buildItem: { padding:"9px 12px", borderRadius:"7px", border:"1px solid rgba(0,0,0,0.08)", background:"#F8F7F5", fontSize:"12px", color:"#3A3835", cursor:"pointer", textAlign:"left", fontFamily:"inherit" },
};
