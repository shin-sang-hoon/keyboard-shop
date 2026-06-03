import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ChatbotWidget from './ChatbotWidget';

/**
 * Fab — 우하단 플로팅 액션 버튼 (전역 진입점).
 *
 * MUREAM FloatingChatBar 의 펼침 메뉴 패턴을 SWACHRON 으로 이식:
 *   - 닫힘 상태: 🧠 (창작자의 아이디어를 상징하는 메인 버튼)
 *   - 클릭 → 위로 메뉴 2개 펼침:
 *       · 🤖 AI 챗봇   → ChatbotWidget(떠있는 패널) 토글
 *       · ⌨️ 3D 미리보기 → /products?view=3d (3D 지원 키보드만 필터된 목록)
 *
 * 챗봇이 열려 있으면 ChatbotWidget 이 화면에 뜨고, FAB 메뉴는 접힌다.
 * App.jsx 에서 ConditionalChrome 으로 감싸 빌더·로그인·관리자 경로에선 숨김.
 */
export default function Fab() {
  const [expanded, setExpanded] = useState(false); // 메뉴 펼침
  const [chatOpen, setChatOpen] = useState(false);  // 챗봇 패널
  const navigate = useNavigate();

  function toggleMenu() {
    setExpanded((v) => !v);
  }

  function openChat() {
    setChatOpen(true);
    setExpanded(false);
  }

  function goto3D() {
    setExpanded(false);
    navigate('/products?view=3d');
  }

  return (
    <>
      {/* 챗봇 패널 */}
      <ChatbotWidget open={chatOpen} onClose={() => setChatOpen(false)} />

      {/* 펼침 메뉴 */}
      <div style={{ ...S.menu, ...(expanded ? S.menuOpen : {}) }}>
        <button style={S.menuItem} onClick={openChat}>
          <span style={S.menuLabel}>AI 챗봇</span>
          <span style={S.menuIcon}>🤖</span>
        </button>
        <button style={S.menuItem} onClick={goto3D}>
          <span style={S.menuLabel}>3D 미리보기</span>
          <span style={S.menuIcon}>⌨️</span>
        </button>
      </div>

      {/* 메인 FAB */}
      <button
        style={{ ...S.fab, ...(expanded ? S.fabOpen : {}) }}
        onClick={toggleMenu}
        aria-label="AI 기능 메뉴"
        aria-expanded={expanded}
      >
        <span style={S.fabIcon}>{expanded ? '✕' : '🧠'}</span>
      </button>
    </>
  );
}

const S = {
  fab: {
    position: 'fixed',
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: '#111827',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1050,
    transition: 'background 0.2s, transform 0.2s',
  },
  fabOpen: { background: '#374151', transform: 'rotate(90deg)' },
  fabIcon: { fontSize: 24, lineHeight: 1 },

  menu: {
    position: 'fixed',
    right: 24,
    bottom: 92,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 12,
    zIndex: 1050,
    // 접힘: 안 보이고 클릭 불가
    maxHeight: 0,
    opacity: 0,
    pointerEvents: 'none',
    transform: 'translateY(8px)',
    transition: 'max-height 0.3s ease, opacity 0.25s ease, transform 0.25s ease',
  },
  menuOpen: {
    maxHeight: 200,
    opacity: 1,
    pointerEvents: 'auto',
    transform: 'translateY(0)',
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    padding: 0,
  },
  menuLabel: {
    background: 'rgba(17,24,39,0.85)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    padding: '7px 12px',
    borderRadius: 8,
    whiteSpace: 'nowrap',
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    background: '#fff',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e5e7eb',
    boxShadow: '0 4px 14px rgba(0,0,0,0.16)',
  },
};
