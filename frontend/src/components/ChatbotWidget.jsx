import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * ChatbotWidget — 떠있는 AI 챗봇 패널 (크론이).
 *
 * MUREAM FloatingChatBar 의 AI 챗봇 팝업 디자인을 SWACHRON 으로 이식:
 *   - 헤더 아래 카테고리 버튼 바(고정), 봇/유저 말풍선, 로딩 점(typing), 추천 상품 카드
 *   - 상담원 연결 안내(showAgent), 서버 상태 핑(/api/chatbot/health)
 *
 * 백엔드: POST /api/chatbot/chat { message }
 *   → { answer, intent, showAgent, sources, cached, products?, quickButtons? }
 *     · products:     [{ id, name, price, imageUrl, brand }]  — 추천 상품 카드 (B·C)
 *     · quickButtons: [{ label, query }]                       — 카테고리·추가 선택 버튼 (A·D)
 *         GET  /api/chatbot/health
 * 공개 엔드포인트라 토큰 불필요(비로그인도 사용 가능).
 *
 * props:
 *   - open(boolean): 표시 여부
 *   - onClose(): 닫기 콜백 (FAB 가 제어)
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

// 헤더 아래 고정 카테고리 버튼 (클릭 → 관련 질문 전송). MUREAM 카테고리 바 이식(렌탈 제외).
const CATEGORY_BUTTONS = [
  { label: '🔨 입찰 참여', query: '경매(입찰)는 어떻게 참여하나요?' },
  { label: '🚚 배송', query: '배송은 얼마나 걸리나요?' },
  { label: '🔄 취소·교환', query: '주문 취소나 교환은 어떻게 하나요?' },
  { label: '🛍️ 상품 문의', query: '상품 관련 문의하고 싶어요.' },
  { label: '💳 주문·결제', query: '어떤 결제 수단을 쓸 수 있나요?' },
  { label: '👤 회원 정보', query: '회원가입은 무료인가요?' },
  { label: '📞 상담원 연결', query: '__AGENT__' },
];

// 상담원 연결 버튼 클릭 시 (백엔드 호출 없이 즉시 안내)
const AGENT_MSG =
  '상담이 필요하시면 아래 상담원 연결 버튼을 이용하시거나 고객센터(010-6824-7715)로 연락 주세요.';

const WELCOME = '안녕하세요! 스웨크론 AI 도우미 크론이예요 🤖 스위치·배열·키캡·브랜드·가격·3D 빌더, 무엇이든 물어보세요!';

let _msgSeq = 1;
const nextId = () => _msgSeq++;

// 메시지 표시용 시각 ("오후 02:28" 형식)
const nowTime = () =>
  new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true });

export default function ChatbotWidget({ open, onClose }) {
  const [messages, setMessages] = useState([
    { id: nextId(), sender: 'bot', text: WELCOME, time: nowTime() },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState(null); // null=확인중, true/false

  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // 스크롤 항상 최하단
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // 열릴 때 health 핑 + 입력 포커스
  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetch(`${API_BASE}/chatbot/health`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      // 백엔드가 gemini:false 를 주면 오프라인(빨강). true/누락이면 온라인(초록). fetch 실패도 오프라인.
      .then((data) => { if (alive) setOnline(data?.gemini !== false); })
      .catch(() => { if (alive) setOnline(false); });
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => { alive = false; clearTimeout(t); };
  }, [open]);

  const send = useCallback(async (text) => {
    const msg = (text ?? '').trim();
    if (!msg || loading) return;

    setMessages((prev) => [...prev, { id: nextId(), sender: 'me', text: msg, time: nowTime() }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/chatbot/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });
      if (!res.ok) throw new Error('bad status');
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          sender: 'bot',
          text: data.answer || '죄송해요, 답변을 가져오지 못했어요.',
          showAgent: !!data.showAgent,
          time: nowTime(),
          // B·C: 추천 상품 카드 / A·D: 카테고리·추가 선택 버튼 (백엔드가 채울 때만)
          products: Array.isArray(data.products) ? data.products : null,
          quickButtons: Array.isArray(data.quickButtons) ? data.quickButtons : null,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          sender: 'bot',
          text: '지금 답변을 가져오지 못했어요. 잠시 후 다시 시도하거나, 고객센터(010-6824-7715)로 문의해 주세요.',
          showAgent: true,
          time: nowTime(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  // 카테고리 버튼 클릭: 상담원 연결은 즉시 안내, 그 외엔 관련 질문 전송
  function handleCategory(btn) {
    if (btn.query === '__AGENT__') {
      setMessages((prev) => [
        ...prev,
        { id: nextId(), sender: 'bot', text: AGENT_MSG, showAgent: true, time: nowTime() },
      ]);
      return;
    }
    send(btn.query);
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  if (!open) return null;

  return (
    <div style={S.popup} role="dialog" aria-label="AI 챗봇">
      {/* 헤더 */}
      <div style={S.header}>
        <div style={S.headerLeft}>
          <span style={S.botAvatar}>🤖</span>
          <div>
            <div style={S.headerTitle}>크론이</div>
            <div style={S.headerSub}>
              <span
                style={{
                  ...S.statusDot,
                  background: online === true ? '#22c55e' : online === false ? '#ef4444' : '#9ca3af',
                }}
              />
              {online === true ? '온라인' : online === false ? '오프라인' : '연결 확인 중'}
            </div>
          </div>
        </div>
        <button style={S.closeBtn} onClick={onClose} aria-label="닫기">✕</button>
      </div>

      {/* 카테고리 버튼 바 (헤더 아래 고정) */}
      <div style={S.catBar}>
        {CATEGORY_BUTTONS.map((b) => (
          <button
            key={b.label}
            style={S.catBtn}
            onClick={() => handleCategory(b)}
            disabled={loading}
          >
            {b.label}
          </button>
        ))}
      </div>

      {/* 메시지 */}
      <div style={S.messages} ref={scrollRef}>
        {messages.map((m) => (
          <div key={m.id}>
            <div style={{ ...S.msgRow, ...(m.sender === 'me' ? S.msgRowMe : {}) }}>
              <div
                style={{
                  ...S.bubble,
                  ...(m.sender === 'me' ? S.bubbleMe : S.bubbleBot),
                }}
              >
                {m.text}
              </div>
            </div>

            {m.time && (
              <div style={{ ...S.msgTime, ...(m.sender === 'me' ? S.msgTimeMe : {}) }}>
                {m.time}
              </div>
            )}

            {/* 추천 상품 카드 (B·C) — 백엔드 products 채워질 때만 */}
            {Array.isArray(m.products) && m.products.length > 0 && (
              <div style={S.productCards}>
                {m.products.map((p) => (
                  <div key={p.id} style={S.productCard}>
                    <div style={S.cardThumbWrap}>
                      {p.imageUrl
                        ? <img src={p.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" style={S.cardThumb} />
                        : <span style={S.cardNoImg} aria-hidden="true">📦</span>}
                    </div>
                    <div style={S.cardBody}>
                      {p.brand && <span style={S.cardBrand}>{p.brand}</span>}
                      <span style={S.cardName}>{p.name}</span>
                      {typeof p.price === 'number' && (
                        <span style={S.cardPrice}>₩{p.price.toLocaleString()}</span>
                      )}
                      <button
                        style={S.cardBtn}
                        onClick={() => window.open(`/products/${p.id}`, '_blank')}
                      >
                        상품 보기
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 카테고리·추가 선택 버튼 (A·D) — 백엔드 quickButtons 채워질 때만 */}
            {Array.isArray(m.quickButtons) && m.quickButtons.length > 0 && (
              <div style={S.msgButtons}>
                {m.quickButtons.map((b) => (
                  <button key={b.label} style={S.msgButton} onClick={() => send(b.query)}>
                    {b.label}
                  </button>
                ))}
              </div>
            )}

            {m.showAgent && (
              <div style={S.agentRow}>
                <a href="tel:010-6824-7715" style={S.agentBtn}>📞 상담원 연결 (010-6824-7715)</a>
              </div>
            )}
          </div>
        ))}

        {/* 로딩 점 */}
        {loading && (
          <div style={S.msgRow}>
            <div style={{ ...S.bubble, ...S.bubbleBot, ...S.typing }}>
              <span style={{ ...S.dot, animationDelay: '0ms' }} />
              <span style={{ ...S.dot, animationDelay: '150ms' }} />
              <span style={{ ...S.dot, animationDelay: '300ms' }} />
            </div>
          </div>
        )}
      </div>

      {/* 입력 */}
      <div style={S.inputRow}>
        <input
          ref={inputRef}
          style={S.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="궁금한 점을 입력하세요..."
          disabled={loading}
        />
        <button
          style={{ ...S.sendBtn, ...(loading || !input.trim() ? S.sendBtnOff : {}) }}
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
        >
          전송
        </button>
      </div>

      {/* 로딩 점 애니메이션 keyframes */}
      <style>{`
        @keyframes swachron-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

const S = {
  popup: {
    position: 'fixed',
    right: 24,
    bottom: 96, // FAB 위
    width: 'min(540px, 94vw)',
    height: 'min(720px, 80vh)',
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    zIndex: 1100,
    fontFamily: 'inherit',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 14px',
    background: '#111827',
    color: '#fff',
    flexShrink: 0,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  botAvatar: {
    width: 32, height: 32, borderRadius: '50%',
    background: '#fff',
    borderWidth: '1px', borderStyle: 'solid', borderColor: '#e5e7eb',
    display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 18,
  },
  headerTitle: { fontSize: 15, fontWeight: 700, lineHeight: 1.2 },
  headerSub: { fontSize: 11, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 },
  statusDot: { width: 7, height: 7, borderRadius: '50%', display: 'inline-block' },
  closeBtn: {
    background: 'none', border: 'none', color: '#fff', fontSize: 18,
    cursor: 'pointer', lineHeight: 1, padding: 4,
  },
  messages: {
    flex: 1, minHeight: 0, overflowY: 'auto',
    padding: '14px', background: '#f8fafc',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  msgRow: { display: 'flex', justifyContent: 'flex-start' },
  msgRowMe: { justifyContent: 'flex-end' },
  msgTime: { fontSize: 11, color: '#9ca3af', margin: '3px 2px 2px', textAlign: 'left' },
  msgTimeMe: { textAlign: 'right' },
  bubble: {
    maxWidth: '78%', padding: '9px 12px', borderRadius: 14,
    fontSize: 13.5, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  },
  bubbleBot: { background: '#eff6ff', color: '#1e293b', borderTopLeftRadius: 4 },
  bubbleMe: { background: '#111827', color: '#fff', borderTopRightRadius: 4 },
  typing: { display: 'flex', gap: 4, alignItems: 'center', padding: '12px 14px' },
  dot: {
    width: 7, height: 7, borderRadius: '50%', background: '#94a3b8',
    display: 'inline-block', animation: 'swachron-bounce 1.2s infinite ease-in-out',
  },
  // 헤더 아래 카테고리 버튼 바
  catBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    padding: '10px 12px',
    borderBottom: '1px solid #e2e8f0',
    background: '#fff',
    flexShrink: 0,
  },
  catBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 10px',
    borderRadius: 999,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e5e7eb',
    background: '#f8fafc',
    color: '#334155',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  agentRow: { display: 'flex', justifyContent: 'flex-start', marginTop: 6 },
  agentBtn: {
    display: 'inline-block', padding: '8px 12px', borderRadius: 10,
    background: '#111827', color: '#fff', fontSize: 12.5, fontWeight: 600,
    textDecoration: 'none',
  },
  inputRow: {
    display: 'flex', gap: 8, padding: '10px 12px',
    borderTop: '1px solid #e2e8f0', background: '#fff', flexShrink: 0,
  },
  input: {
    flex: 1, border: '1px solid #cbd5e1', borderRadius: 10,
    padding: '9px 12px', fontSize: 13.5, outline: 'none',
  },
  sendBtn: {
    border: 'none', borderRadius: 10, padding: '0 16px',
    background: '#111827', color: '#fff', fontSize: 13.5, fontWeight: 600,
    cursor: 'pointer', whiteSpace: 'nowrap',
  },
  sendBtnOff: { background: '#cbd5e1', cursor: 'not-allowed' },

  // 추천 상품 카드 (B·C)
  productCards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: 8,
    marginTop: 8,
  },
  productCard: {
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e5e7eb',
    borderRadius: 12,
    overflow: 'hidden',
    background: '#fff',
    display: 'flex',
    flexDirection: 'column',
  },
  cardThumbWrap: {
    width: '100%',
    aspectRatio: '4 / 3',
    background: '#f1f5f9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardThumb: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  cardNoImg: { fontSize: 28 },
  cardBody: { padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 },
  cardBrand: { fontSize: 11, color: '#94a3b8' },
  cardName: {
    fontSize: 12.5,
    fontWeight: 600,
    color: '#1e293b',
    lineHeight: 1.35,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  cardPrice: { fontSize: 13, fontWeight: 700, color: '#111827' },
  cardBtn: {
    marginTop: 4,
    textAlign: 'center',
    padding: '6px 8px',
    borderRadius: 8,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#c7d2fe',
    background: '#eef2ff',
    color: '#4f46e5',
    fontSize: 11.5,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  // 카테고리·추가 선택 버튼 (A·D, 백엔드 quickButtons)
  msgButtons: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  msgButton: {
    padding: '7px 11px',
    borderRadius: 8,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#dbeafe',
    background: '#fff',
    color: '#2563eb',
    fontSize: 12.5,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
};
