import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";

// ── API 설정 ──────────────────────────────────────────────────────────────────
const API_BASE = "http://localhost:8080/api";
const getToken = () => localStorage.getItem("accessToken");

// ── 옵션 데이터 ───────────────────────────────────────────────────────────────
const LAYOUTS = [
  { id: "75",   name: "75%",  price: 89000,  desc: "84키 컴팩트" },
  { id: "TKL",  name: "TKL",  price: 109000, desc: "87키 텐키리스" },
  { id: "FULL", name: "풀배열", price: 129000, desc: "104키 풀사이즈" },
];

const SWITCHES = [
  { id: "LINEAR",  name: "리니어", price: 25000, color: "#E74C3C", desc: "부드럽고 빠른 입력" },
  { id: "TACTILE", name: "택타일", price: 28000, color: "#E67E22", desc: "적당한 피드백" },
  { id: "CLICKY",  name: "클리키", price: 30000, color: "#3498DB", desc: "클릭감과 소리" },
];

const KEYCAP_COLORS = [
  { id: "black",  name: "블랙 PBT",   hex: "#1A1815", price: 35000 },
  { id: "white",  name: "화이트 PBT", hex: "#F0EDE8", price: 35000 },
  { id: "gray",   name: "스모크",     hex: "#4A4845", price: 38000 },
  { id: "navy",   name: "네이비",     hex: "#1B2A4A", price: 38000 },
  { id: "red",    name: "레트로 레드", hex: "#C0392B", price: 42000 },
  { id: "mint",   name: "민트",       hex: "#2ECC9A", price: 42000 },
];

const CASE_COLORS = [
  { id: "space",  name: "스페이스 그레이", hex: "#2C2C2E" },
  { id: "silver", name: "실버",          hex: "#C0C0C0" },
  { id: "black",  name: "블랙",          hex: "#0D0D0D" },
  { id: "cream",  name: "크림 화이트",   hex: "#F5F0E8" },
];

// ── Three.js 키보드 빌더 ──────────────────────────────────────────────────────
function buildKeyboard(scene, layout) {
  // 기존 키보드 제거
  const old = scene.getObjectByName("keyboard");
  if (old) scene.remove(old);

  const kb = new THREE.Group();
  kb.name = "keyboard";
  kb.rotation.x = -0.2;

  const UNIT = 1.0, GAP = 0.11;
  const KH = 0.30, CASE_H = 0.28;

  // 레이아웃별 키 행 정의
  const LAYOUT_ROWS = {
    "75": [
      [1,-0.25,1,1,1,1,-0.25,1,1,1,1,-0.25,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,2],
      [1.5,1,1,1,1,1,1,1,1,1,1,1,1,1.5],
      [1.75,1,1,1,1,1,1,1,1,1,1,2.25],
      [2.25,1,1,1,1,1,1,1,1,1,1.75,1],
      [1.25,1.25,1.25,6.25,1,1,1,1,1],
    ],
    "TKL": [
      [1,-0.25,1,1,1,1,-0.25,1,1,1,1,-0.25,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,2,-0.25,1,1,1],
      [1.5,1,1,1,1,1,1,1,1,1,1,1,1,1.5,-0.25,1,1,1],
      [1.75,1,1,1,1,1,1,1,1,1,1,2.25],
      [2.25,1,1,1,1,1,1,1,1,1,2.75,-0.25,1],
      [1.25,1.25,1.25,6.25,1.25,1.25,-0.25,1,1,1],
    ],
    "FULL": [
      [1,-0.25,1,1,1,1,-0.25,1,1,1,1,-0.25,1,1,1,-0.25,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,2,-0.25,1,1,1,-0.25,1,1,1,1],
      [1.5,1,1,1,1,1,1,1,1,1,1,1,1,1.5,-0.25,1,1,1,-0.25,1,1,1,1],
      [1.75,1,1,1,1,1,1,1,1,1,1,2.25,-0.66666,-0.25,1,1,1],
      [2.25,1,1,1,1,1,1,1,1,1,2.75,-0.25,1,-0.25,1,1,1],
      [1.25,1.25,1.25,6.25,1.25,1.25,1.25,-0.25,1,1,1,1],
    ],
  };

  const ROWS = LAYOUT_ROWS[layout] || LAYOUT_ROWS["75"];

  // 보드 사이즈 계산
  let maxW = 0;
  ROWS.forEach(row => {
    let w = row.reduce((a, v) => a + Math.abs(v), 0);
    if (w > maxW) maxW = w;
  });
  const BW = maxW;
  const BD = ROWS.length;

  // 케이스
  const caseMat = new THREE.MeshStandardMaterial({ color: 0x1A1815, roughness: 0.3, metalness: 0.65 });
  caseMat.name = "caseMat";
  const caseBox = new THREE.Mesh(new THREE.BoxGeometry(BW + 0.55, CASE_H, BD + 0.55), caseMat);
  caseBox.position.y = -CASE_H / 2;
  caseBox.castShadow = true;
  caseBox.receiveShadow = true;
  kb.add(caseBox);

  // 고무발
  const feetGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.08, 8);
  const feetMat = new THREE.MeshStandardMaterial({ color: 0x040303, roughness: 0.95 });
  const bw2 = BW / 2 - 0.5, bd2 = BD / 2 - 0.3;
  [[-bw2,-bd2],[bw2,-bd2],[-bw2,bd2],[bw2,bd2]].forEach(([fx, fz]) => {
    const f = new THREE.Mesh(feetGeo, feetMat);
    f.position.set(fx, -CASE_H - 0.03, fz);
    kb.add(f);
  });

  // 키캡
  const keycapMat = new THREE.MeshStandardMaterial({ color: 0x2A2826, roughness: 0.52, metalness: 0.04 });
  keycapMat.name = "keycapMat";
  const switchMat = new THREE.MeshStandardMaterial({ color: 0x0D0C0B, roughness: 0.75, metalness: 0.1 });

  const keyMeshes = [];
  ROWS.forEach((row, ri) => {
    let x = 0;
    row.forEach(w => {
      if (w < 0) { x += Math.abs(w); return; }
      const kw = w * UNIT - GAP;
      const kd = UNIT - GAP;
      const cx = x + (w * UNIT) / 2 - BW / 2;
      const cz = ri * UNIT + UNIT / 2 - BD / 2;

      const sw = new THREE.Mesh(new THREE.BoxGeometry(kw * 0.55, 0.20, kd * 0.55), switchMat);
      sw.position.set(cx, 0.02, cz);
      kb.add(sw);

      const cap = new THREE.Mesh(new THREE.BoxGeometry(kw, KH, kd), keycapMat.clone());
      cap.position.set(cx, CASE_H / 2 + KH / 2, cz);
      cap.castShadow = true;
      cap.name = "keycap";
      kb.add(cap);
      keyMeshes.push(cap);
      x += w;
    });
  });

  scene.add(kb);
  return { kb, keyMeshes, caseMat };
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function KeyboardBuilder({ productId = null }) {
  const mountRef = useRef(null);
  const sceneRef  = useRef(null);
  const rendRef   = useRef(null);
  const kbRef     = useRef({ kb: null, keyMeshes: [], caseMat: null });
  const dragRef   = useRef({ drag: false, px: 0, py: 0, ry: 0, rx: 0, autoRot: true, t: 0 });
  const rafRef    = useRef(null);

  const [layout,    setLayout]    = useState("75");
  const [sw,        setSw]        = useState("LINEAR");
  const [keycap,    setKeycap]    = useState(KEYCAP_COLORS[0]);
  const [caseColor, setCaseColor] = useState(CASE_COLORS[0]);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [myBuilds,  setMyBuilds]  = useState([]);
  const [loadingBuilds, setLoadingBuilds] = useState(false);

  const totalPrice =
    (LAYOUTS.find(l => l.id === layout)?.price || 0) +
    (SWITCHES.find(s => s.id === sw)?.price || 0) +
    (keycap?.price || 0);

  // ── Three.js 초기화 ─────────────────────────────────────────────────────────
  useEffect(() => {
    const wrap = mountRef.current;
    if (!wrap) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.NoToneMapping;
    
    renderer.setSize(wrap.clientWidth, wrap.clientHeight);
    wrap.appendChild(renderer.domElement);
    rendRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xF0EEE9);
    // fog 제거
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(36, wrap.clientWidth / wrap.clientHeight, 0.1, 80);
    camera.position.set(0, 8, 14);
    camera.lookAt(0, 0, 0);

    // 조명
    scene.add(new THREE.AmbientLight(0xffffff, 3.0));
    const sun = new THREE.DirectionalLight(0xffffff, 4.0);
    sun.position.set(-5, 12, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left:-16, right:16, top:14, bottom:-14, near:1, far:30 });
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x7080FF, 1.0);
    fill.position.set(6, 3, -5);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.8);
    rim.position.set(0, -4, -10);
    scene.add(rim);

    // 그림자 바닥
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.ShadowMaterial({ opacity: 0.3 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.85;
    ground.receiveShadow = true;
    scene.add(ground);

    // 키보드 생성
    kbRef.current = buildKeyboard(scene, "75");

    // 애니메이션
    const d = dragRef.current;
    function loop() {
      rafRef.current = requestAnimationFrame(loop);
      d.t += 0.006;
      if (d.autoRot && kbRef.current.kb) {
        kbRef.current.kb.rotation.y = d.ry + Math.sin(d.t * 0.35) * 0.22;
      }
      renderer.render(scene, camera);
    }
    loop();

    // 드래그
    const onDown = e => { d.drag = true; d.px = e.clientX; d.py = e.clientY; d.autoRot = false; };
    const onUp   = () => { d.drag = false; setTimeout(() => d.autoRot = true, 2500); };
    const onMove = e => {
      if (!d.drag || !kbRef.current.kb) return;
      d.ry += (e.clientX - d.px) * 0.013;
      d.rx = Math.max(-0.55, Math.min(0.55, d.rx + (e.clientY - d.py) * 0.009));
      kbRef.current.kb.rotation.y = d.ry;
      kbRef.current.kb.rotation.x = -0.2 + d.rx;
      d.px = e.clientX; d.py = e.clientY;
    };
    wrap.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("mousemove", onMove);

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

  // ── 레이아웃 변경 ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sceneRef.current) return;
    kbRef.current = buildKeyboard(sceneRef.current, layout);
    // 현재 색상 재적용
    applyKeycapColor(keycap.hex);
    applyCaseColor(caseColor.hex);
  }, [layout]);

  // ── 색상 적용 함수 ──────────────────────────────────────────────────────────
  const applyKeycapColor = useCallback((hex) => {
    const c = new THREE.Color(hex);
    kbRef.current.keyMeshes?.forEach(m => m.material.color.copy(c));
  }, []);

  const applyCaseColor = useCallback((hex) => {
    if (kbRef.current.caseMat) {
      kbRef.current.caseMat.color.set(hex);
    }
  }, []);

  useEffect(() => { applyKeycapColor(keycap.hex); }, [keycap]);
  useEffect(() => { applyCaseColor(caseColor.hex); }, [caseColor]);

  // ── Spring Boot 저장 ────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const buildConfig = {
        layout,
        switchType: sw,
        keycapColor: keycap.id,
        caseColor: caseColor.id,
        totalPrice,
      };
      const res = await fetch(`${API_BASE}/builds`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        },
        body: JSON.stringify({
          productId: productId,
          buildConfig,
        }),
      });
      if (!res.ok) throw new Error("저장 실패");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      fetchMyBuilds();
    } catch (e) {
      console.error(e);
      alert("저장 실패: 로그인이 필요합니다.");
    } finally {
      setSaving(false);
    }
  };

  // ── 내 빌드 목록 불러오기 ───────────────────────────────────────────────────
  const fetchMyBuilds = async () => {
    setLoadingBuilds(true);
    try {
      const res = await fetch(`${API_BASE}/builds/my`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setMyBuilds(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingBuilds(false);
    }
  };

  const handleLoadBuild = (build) => {
    const cfg = build.buildConfig;
    if (cfg.layout)      setLayout(cfg.layout);
    if (cfg.switchType)  setSw(cfg.switchType);
    if (cfg.keycapColor) {
      const kc = KEYCAP_COLORS.find(k => k.id === cfg.keycapColor);
      if (kc) setKeycap(kc);
    }
    if (cfg.caseColor) {
      const cc = CASE_COLORS.find(c => c.id === cfg.caseColor);
      if (cc) setCaseColor(cc);
    }
  };

  // ── UI ──────────────────────────────────────────────────────────────────────
  return (
    <div style={styles.container}>
      {/* 제목 */}
      <p style={styles.pageTitle}>KEYBOARD CUSTOM BUILDER · 3D</p>

      <div style={styles.builder}>
        {/* 3D 뷰어 */}
        <div style={styles.viewer}>
          <div ref={mountRef} style={styles.canvas} />
          <p style={styles.dragHint}>드래그로 회전</p>
        </div>

        {/* 컨트롤 패널 */}
        <div style={styles.panel}>

          {/* 레이아웃 */}
          <Section title="레이아웃">
            {LAYOUTS.map(l => (
              <OptionCard
                key={l.id}
                selected={layout === l.id}
                onClick={() => setLayout(l.id)}
                title={l.name}
                sub={l.desc}
                price={l.price}
              />
            ))}
          </Section>

          {/* 스위치 */}
          <Section title="스위치">
            {SWITCHES.map(s => (
              <OptionCard
                key={s.id}
                selected={sw === s.id}
                onClick={() => setSw(s.id)}
                title={s.name}
                sub={s.desc}
                price={s.price}
                accent={s.color}
              />
            ))}
          </Section>

          {/* 케이스 색상 */}
          <Section title="케이스 색상">
            <div style={styles.colorRow}>
              {CASE_COLORS.map(c => (
                <button
                  key={c.id}
                  title={c.name}
                  onClick={() => setCaseColor(c)}
                  style={{
                    ...styles.colorDot,
                    background: c.hex,
                    border: caseColor.id === c.id
                      ? "2px solid #4A42B0"
                      : "2px solid transparent",
                    outline: caseColor.id === c.id ? "2px solid #4A42B0" : "none",
                    outlineOffset: "2px",
                  }}
                />
              ))}
            </div>
            <p style={styles.colorLabel}>{caseColor.name}</p>
          </Section>

          {/* 키캡 색상 */}
          <Section title="키캡 색상">
            <div style={styles.colorRow}>
              {KEYCAP_COLORS.map(k => (
                <button
                  key={k.id}
                  title={k.name}
                  onClick={() => setKeycap(k)}
                  style={{
                    ...styles.colorDot,
                    background: k.hex,
                    border: keycap.id === k.id
                      ? "2px solid #4A42B0"
                      : "2px solid rgba(0,0,0,0.15)",
                    outline: keycap.id === k.id ? "2px solid #4A42B0" : "none",
                    outlineOffset: "2px",
                  }}
                />
              ))}
            </div>
            <p style={styles.colorLabel}>{keycap.name}</p>
          </Section>

          {/* 요약 */}
          <div style={styles.summary}>
            <SumRow label="레이아웃" value={LAYOUTS.find(l => l.id === layout)?.name} />
            <SumRow label="스위치"   value={SWITCHES.find(s => s.id === sw)?.name} />
            <SumRow label="케이스"   value={caseColor.name} />
            <SumRow label="키캡"     value={keycap.name} />
          </div>

          <div style={styles.totalRow}>
            <span style={styles.totalLabel}>총 가격</span>
            <span style={styles.totalPrice}>₩{totalPrice.toLocaleString()}</span>
          </div>

          {/* 저장 버튼 */}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              ...styles.saveBtn,
              background: saved ? "#27AE60" : "#4A42B0",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "저장 중..." : saved ? "✓ 저장됨!" : "빌드 저장하기"}
          </button>

          {/* 내 빌드 목록 */}
          <button onClick={fetchMyBuilds} style={styles.loadBtn}>
            내 빌드 불러오기
          </button>

          {loadingBuilds && <p style={styles.hint}>불러오는 중...</p>}

          {myBuilds.length > 0 && (
            <div style={styles.buildList}>
              <p style={styles.buildListTitle}>저장된 빌드 ({myBuilds.length})</p>
              {myBuilds.map((b, i) => (
                <button
                  key={b.id}
                  onClick={() => handleLoadBuild(b)}
                  style={styles.buildItem}
                >
                  빌드 #{i + 1} · {b.buildConfig?.layout} ·{" "}
                  {b.buildConfig?.switchType} ·{" "}
                  ₩{b.buildConfig?.totalPrice?.toLocaleString()}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 서브 컴포넌트 ─────────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div style={styles.section}>
      <p style={styles.sectionTitle}>{title}</p>
      <div style={styles.optionGrid}>{children}</div>
    </div>
  );
}

function OptionCard({ selected, onClick, title, sub, price, accent }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.optionCard,
        borderColor: selected ? "#4A42B0" : "rgba(0,0,0,0.1)",
        background: selected ? "#EDECFA" : "#FFFFFF",
      }}
    >
      {/* 왼쪽: 색상 닷 + 이름/설명 */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
        {accent && (
          <span style={{ ...styles.accent, background: accent, flexShrink: 0 }} />
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <span style={styles.optionName}>{title}</span>
          <span style={styles.optionSub}>{sub}</span>
        </div>
      </div>
      {/* 오른쪽: 가격 */}
      <span style={styles.optionPrice}>+₩{price.toLocaleString()}</span>
    </button>
  );
}

function SumRow({ label, value }) {
  return (
    <div style={styles.sumRow}>
      <span style={styles.sumLabel}>{label}</span>
      <span style={styles.sumVal}>{value}</span>
    </div>
  );
}

// ── 스타일 ────────────────────────────────────────────────────────────────────
const styles = {
  container: {
    fontFamily: "'DM Sans', 'Pretendard', sans-serif",
    background: "#F0EEE9",
    minHeight: "100vh",
    padding: "2rem",
    color: "#1A1814",
  },
  pageTitle: {
    textAlign: "center",
    fontSize: "11px",
    fontWeight: 500,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "#8A8680",
    marginBottom: "1.5rem",
  },
  builder: {
    display: "grid",
    gridTemplateColumns: "1fr 360px",
    gap: "18px",
    maxWidth: "1080px",
    margin: "0 auto",
  },
  viewer: {
    background: "#F0EEE9",
    borderRadius: "14px",
    overflow: "hidden",
    position: "relative",
    minHeight: "480px",
  },
  canvas: {
    width: "100%",
    height: "100%",
    minHeight: "480px",
    cursor: "grab",
  },
  dragHint: {
    position: "absolute",
    bottom: "14px",
    left: "50%",
    transform: "translateX(-50%)",
    fontSize: "11px",
    color: "rgba(255,255,255,0.35)",
    letterSpacing: "0.05em",
    pointerEvents: "none",
  },
  panel: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  section: {
    background: "#FFFFFF",
    borderRadius: "12px",
    padding: "16px",
    border: "1px solid rgba(0,0,0,0.07)",
  },
  sectionTitle: {
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#8A8680",
    marginBottom: "12px",
  },
  optionGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  optionCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1.5px solid",
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.15s",
    width: "100%",
  },
  accent: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    gridRow: "1 / 3",
    display: "block",
  },
  optionName: {
    fontSize: "13px",
    fontWeight: 500,
    color: "#1A1814",
  },
  optionSub: {
    fontSize: "11px",
    color: "#8A8680",
  },
  optionPrice: {
    fontSize: "12px",
    fontWeight: 500,
    color: "#4A42B0",
    gridRow: "1 / 3",
    alignSelf: "center",
  },
  colorRow: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    marginBottom: "8px",
  },
  colorDot: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    cursor: "pointer",
    transition: "all 0.15s",
  },
  colorLabel: {
    fontSize: "12px",
    color: "#5A5855",
  },
  summary: {
    background: "#FFFFFF",
    borderRadius: "12px",
    padding: "14px 16px",
    border: "1px solid rgba(0,0,0,0.07)",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  sumRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "12px",
  },
  sumLabel: { color: "#8A8680" },
  sumVal:   { color: "#1A1814", fontWeight: 500 },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    background: "#FFFFFF",
    borderRadius: "10px",
    border: "1px solid rgba(0,0,0,0.07)",
  },
  totalLabel: { fontSize: "13px", fontWeight: 500, color: "#5A5855" },
  totalPrice: { fontSize: "20px", fontWeight: 700, color: "#1A1814" },
  saveBtn: {
    width: "100%",
    padding: "13px",
    borderRadius: "10px",
    border: "none",
    color: "#FFFFFF",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
    letterSpacing: "0.03em",
  },
  loadBtn: {
    width: "100%",
    padding: "10px",
    borderRadius: "10px",
    border: "1.5px solid rgba(0,0,0,0.12)",
    background: "transparent",
    color: "#5A5855",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
  },
  hint: {
    fontSize: "12px",
    color: "#8A8680",
    textAlign: "center",
  },
  buildList: {
    background: "#FFFFFF",
    borderRadius: "10px",
    padding: "12px",
    border: "1px solid rgba(0,0,0,0.07)",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  buildListTitle: {
    fontSize: "11px",
    fontWeight: 600,
    color: "#8A8680",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    marginBottom: "4px",
  },
  buildItem: {
    padding: "9px 12px",
    borderRadius: "7px",
    border: "1px solid rgba(0,0,0,0.08)",
    background: "#F8F7F5",
    fontSize: "12px",
    color: "#3A3835",
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "inherit",
  },
};
