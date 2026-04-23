import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

// ── API ───────────────────────────────────────────────────────────────────────
const API_BASE = "http://localhost:8080/api";
const getToken = () => localStorage.getItem("accessToken");

// ── 레이아웃 → GLB 매핑 ───────────────────────────────────────────────────────
const LAYOUT_TO_MODEL = {
  "65":   "/models/custom_-_mechanical_keyboard.glb",
  "75":   "/models/vortexseries_mechanical_keyboard_gt-8__nj80.glb",
  "TKL":  "/models/mechanical_keyboard_-_aesthetic.glb",
  "FULL": "/models/knob1_mechanical_keyboard.glb",
  // fallback
  "40":   "/models/custom_-_mechanical_keyboard.glb",
  "60":   "/models/custom_-_mechanical_keyboard.glb",
};

// ── GLB별 재질 이름 매핑 ──────────────────────────────────────────────────────
const MODEL_MATERIAL_MAP = {
  "vortexseries_mechanical_keyboard_gt-8__nj80.glb": {
    keycap: ["White_Keys_1","White_Keys_2","White_Keys_3","White_Keys_4",
             "White_Keys_5","White_Keys_7","Black_Keys_1","Black_Keys_2",
             "Black_Keys_3","Black_Keys_5","Black_keys_4","Space",
             "Shift_Arrow","Arrow.001","Material","material"],
    case:   ["Polycarbonate_Case","Material.001","Material.003","Alumunium_Knob"],
  },
  "knob1_mechanical_keyboard.glb": {
    keycap: ["Plastic_1","Plastic_2","Plastic_3","Plastic_4","Plastic_5","Custom_1"],
    case:   ["Metal_1","Metal_2"],
  },
  "custom_-_mechanical_keyboard.glb": {
    keycap: ["Keyboard"],
    case:   ["Wood_00"],
  },
  "mechanical_keyboard_-_aesthetic.glb": {
    keycap: ["Big_Buttons","Small_Buttons"],
    case:   ["Chassis"],
  },
  "nzxt_minitkl_-_mechanical_keyboard.glb": {
    keycap: ["Keys_Top","Keys_Bottom","Stabilizer_1","Stabilizer_2"],
    case:   ["Top_Plate","Bottom_Shell","Side","Rubber","Metal"],
  },
};

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

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function KeyboardBuilder({ productId = null, productLayout = null }) {
  const mountRef   = useRef(null);
  const sceneRef   = useRef(null);
  const rendRef    = useRef(null);
  const cameraRef  = useRef(null);
  const modelRef   = useRef(null);   // 현재 로드된 모델
  const matMapRef  = useRef({});     // materialName → material 객체
  const origColRef = useRef({});     // materialName → 원본 color
  const dragRef    = useRef({ drag:false, px:0, py:0, ry:0, rx:0, autoRot:true, t:0 });
  const rafRef     = useRef(null);

  const [layout,    setLayout]    = useState(productLayout || "75");
  const [sw,        setSw]        = useState("LINEAR");
  const [keycap,    setKeycap]    = useState(KEYCAP_COLORS[0]);
  const [caseColor, setCaseColor] = useState(CASE_COLORS[0]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [myBuilds,  setMyBuilds]  = useState([]);

  const totalPrice =
    (LAYOUTS.find(l => l.id === layout)?.price || 0) +
    (SWITCHES.find(s => s.id === sw)?.price || 0) +
    (keycap?.price || 0);

  // ── GLB 파일명 추출 헬퍼 ───────────────────────────────────────────────────
  const getModelFileName = useCallback((glbPath) => {
    return glbPath.split("/").pop();
  }, []);

  // ── Three.js 초기화 ─────────────────────────────────────────────────────────
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

    const camera = new THREE.PerspectiveCamera(
      36, wrap.clientWidth / wrap.clientHeight, 0.1, 200
    );
    camera.position.set(0, 8, 18);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // 조명
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

    // 그림자 바닥
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.ShadowMaterial({ opacity: 0.15 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.5;
    ground.receiveShadow = true;
    scene.add(ground);

    // 애니메이션
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

    // 드래그
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
    // 터치
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

    // 리사이즈
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
      wrap.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  // ── GLB 모델 로드 ──────────────────────────────────────────────────────────
  const loadModel = useCallback((layoutId) => {
    const scene = sceneRef.current;
    if (!scene) return;

    setLoading(true);

    // 기존 모델 제거
    if (modelRef.current) {
      scene.remove(modelRef.current);
      modelRef.current = null;
      matMapRef.current = {};
      origColRef.current = {};
    }

    const glbPath = LAYOUT_TO_MODEL[layoutId] || LAYOUT_TO_MODEL["75"];
    const fileName = glbPath.split("/").pop();
    const matMap = MODEL_MATERIAL_MAP[fileName] || { keycap: [], case: [] };

    const loader = new GLTFLoader();
    loader.load(
      glbPath,
      (gltf) => {
        const model = gltf.scene;

        // 바운딩박스로 자동 크기/위치 조정
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 10 / maxDim;
        model.scale.setScalar(scale);
        model.position.sub(center.multiplyScalar(scale));
        model.position.y += 0.5;

        // 재질 맵 구축 + 그림자 설정
        const matMapping = {};
        const origColors = {};
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            const mats = Array.isArray(child.material)
              ? child.material : [child.material];
            mats.forEach(mat => {
              if (mat && mat.name) {
                matMapping[mat.name] = mat;
                if (mat.color) {
                  origColors[mat.name] = mat.color.clone();
                }
              }
            });
          }
        });
        matMapRef.current = matMapping;
        origColRef.current = origColors;

        modelRef.current = model;
        scene.add(model);
        setLoading(false);

        // 현재 선택된 색상 재적용
        applyColors(keycap.hex, caseColor.hex, matMap);
      },
      undefined,
      (err) => {
        console.error("GLB 로드 실패:", err);
        setLoading(false);
      }
    );
  }, [keycap, caseColor]);

  // ── 색상 적용 ──────────────────────────────────────────────────────────────
  const applyColors = useCallback((keycapHex, caseHex, matMapOverride) => {
    const matMapping = matMapRef.current;
    const origColors = origColRef.current;
    const scene = sceneRef.current;
    if (!scene || !modelRef.current) return;

    // 현재 모델의 fileName 파악
    const glbPath = LAYOUT_TO_MODEL[layout] || LAYOUT_TO_MODEL["75"];
    const fileName = glbPath.split("/").pop();
    const matMap = matMapOverride || MODEL_MATERIAL_MAP[fileName] || { keycap: [], case: [] };

    Object.entries(matMapping).forEach(([name, mat]) => {
      if (!mat.color) return;
      const isKeycap = matMap.keycap.includes(name);
      const isCase   = matMap.case.includes(name);

      if (isKeycap && keycapHex) {
        mat.color.set(keycapHex);
      } else if (isCase && caseHex) {
        mat.color.set(caseHex);
      } else if (!isKeycap && !isCase) {
        // 매핑 없는 재질은 원본 유지
        if (origColors[name]) mat.color.copy(origColors[name]);
      } else {
        // 오리지널 선택 시 원본 복원
        if (!keycapHex && isKeycap && origColors[name]) mat.color.copy(origColors[name]);
        if (!caseHex && isCase && origColors[name]) mat.color.copy(origColors[name]);
      }
    });
  }, [layout]);

  // ── 레이아웃 변경 시 모델 재로드 ──────────────────────────────────────────
  useEffect(() => {
    loadModel(layout);
  }, [layout]);

  // ── 색상 변경 시 적용 ──────────────────────────────────────────────────────
  useEffect(() => {
    applyColors(keycap.hex, caseColor.hex);
  }, [keycap, caseColor, applyColors]);

  // ── 빌드 저장 ──────────────────────────────────────────────────────────────
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

  const fetchMyBuilds = async () => {
    try {
      const res = await fetch(`${API_BASE}/builds/my`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) setMyBuilds(await res.json());
    } catch {}
  };

  const handleLoadBuild = (b) => {
    const cfg = b.buildConfig;
    if (cfg.layout)     setLayout(cfg.layout);
    if (cfg.switchType) setSw(cfg.switchType);
    if (cfg.keycapColor) setKeycap(KEYCAP_COLORS.find(k=>k.id===cfg.keycapColor)||KEYCAP_COLORS[0]);
    if (cfg.caseColor)  setCaseColor(CASE_COLORS.find(c=>c.id===cfg.caseColor)||CASE_COLORS[0]);
  };

  // ── UI ─────────────────────────────────────────────────────────────────────
  return (
    <div style={S.container}>
      <p style={S.pageTitle}>KEYBOARD CUSTOM BUILDER · 3D</p>

      <div style={S.builder}>
        {/* 3D 뷰어 */}
        <div style={S.viewer}>
          <div ref={mountRef} style={S.canvas} />
          {loading && (
            <div style={S.loadingOverlay}>
              <div style={S.spinner} />
              <p style={S.loadingText}>모델 불러오는 중...</p>
            </div>
          )}
          {!loading && <p style={S.dragHint}>드래그로 회전</p>}
        </div>

        {/* 컨트롤 패널 */}
        <div style={S.panel}>

          <Section title="레이아웃">
            {LAYOUTS.map(l => (
              <OptionCard key={l.id} selected={layout===l.id}
                onClick={()=>setLayout(l.id)}
                title={l.name} sub={l.desc} price={l.price} />
            ))}
          </Section>

          <Section title="스위치">
            {SWITCHES.map(s => (
              <OptionCard key={s.id} selected={sw===s.id}
                onClick={()=>setSw(s.id)}
                title={s.name} sub={s.desc} price={s.price} accent={s.color} />
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

          {/* 요약 */}
          <div style={S.summary}>
            <SumRow label="레이아웃" value={LAYOUTS.find(l=>l.id===layout)?.name} />
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

// ── 서브 컴포넌트 ──────────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div style={S.section}>
      <p style={S.sectionTitle}>{title}</p>
      <div style={S.optionGrid}>{children}</div>
    </div>
  );
}

function OptionCard({ selected, onClick, title, sub, price, accent }) {
  return (
    <button onClick={onClick} style={{
      ...S.optionCard,
      borderColor: selected ? "#4A42B0" : "rgba(0,0,0,0.1)",
      background: selected ? "#EDECFA" : "#FFFFFF",
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:"10px", flex:1 }}>
        {accent && <span style={{ ...S.accent, background: accent }} />}
        <div style={{ display:"flex", flexDirection:"column", gap:"2px" }}>
          <span style={S.optionName}>{title}</span>
          <span style={S.optionSub}>{sub}</span>
        </div>
      </div>
      <span style={S.optionPrice}>+₩{price.toLocaleString()}</span>
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

// ── 스타일 ────────────────────────────────────────────────────────────────────
const S = {
  container: { fontFamily:"'DM Sans','Pretendard',sans-serif", background:"#F0EEE9", minHeight:"100vh", padding:"2rem", color:"#1A1814" },
  pageTitle: { textAlign:"center", fontSize:"11px", fontWeight:500, letterSpacing:"0.14em", textTransform:"uppercase", color:"#8A8680", marginBottom:"1.5rem" },
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
  optionCard: { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 12px", borderRadius:"8px", border:"1.5px solid", cursor:"pointer", textAlign:"left", transition:"all 0.15s", width:"100%", fontFamily:"inherit" },
  accent:    { width:"8px", height:"8px", borderRadius:"50%", flexShrink:0, display:"block" },
  optionName: { fontSize:"13px", fontWeight:500, color:"#1A1814" },
  optionSub:  { fontSize:"11px", color:"#8A8680" },
  optionPrice: { fontSize:"12px", fontWeight:500, color:"#4A42B0", whiteSpace:"nowrap" },
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
