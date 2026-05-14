// frontend/src/App.jsx
//
// 5-B 라운드 Day 2 (2026-05-09) - KakaoCallbackPage 라우트 추가.
// 5-B Round 3 (2026-05-13) - 회원가입 3단계 분리 라우트 추가.
// Phase 7 [9-2B] (2026-05-14) - AdminAuditLogPage 라우트 추가.
//   - /admin/audit-logs : 감사 로그 뷰어 (ProtectedRoute + ADMIN role 가드)
//   - CHROME_HIDDEN_PATHS '/admin' 추가 — 관리자 영역은 별도 chrome 정책 (Phase 7-A 에서 AdminApp shell 도입 예정)
//
// 그 외 라우트는 라운드 3-Q 그대로 유지.

import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ProductList from './pages/ProductList';
import ProductDetail from './pages/ProductDetail';
import KeyboardBuilder from './pages/KeyboardBuilder';
import KeyboardBuilderRoute from './pages/KeyboardBuilderRoute';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import JoinTypeChoicePage from './pages/JoinTypeChoicePage';
import JoinAgreePage from './pages/JoinAgreePage';
import MyPage from './pages/MyPage';
import PlaceholderPage from './pages/PlaceholderPage';
import NoticeDetailPage from './pages/NoticeDetailPage';
import KakaoCallbackPage from './pages/KakaoCallbackPage';
import AdminAuditLogPage from './pages/admin/AdminAuditLogPage';
import ProtectedRoute from './components/ProtectedRoute';
import Header from './components/Header';
import RecentlyViewedSidebar from './components/RecentlyViewedSidebar';
import Footer from './components/Footer';
import { useCartStore } from './stores/cartStore';

// '/auth' 추가: 카카오 콜백 페이지는 잠깐 거치는 페이지라 헤더/푸터 노출 불필요.
// '/signup' prefix 라서 /signup/type, /signup/agree 도 자동 적용됨.
// '/admin' 추가: 관리자 영역은 사용자 chrome 숨김 (Phase 7-A 의 AdminApp shell 도입 시 별도 admin chrome 제공 예정).
const CHROME_HIDDEN_PATHS = ['/builder', '/login', '/signup', '/auth', '/admin'];

function ConditionalChrome({ children }) {
  const location = useLocation();
  const hide = CHROME_HIDDEN_PATHS.some((p) => location.pathname.startsWith(p));
  return hide ? null : children;
}

// === Cart placeholder (5-D에서 본격 구현) ===
function CartPlaceholder() {
  const totalCount = useCartStore((s) => s.totalCount());
  return (
    <PlaceholderPage
      title="장바구니"
      subtitle={
        totalCount > 0
          ? `현재 ${totalCount}개 담겨 있어요`
          : '아직 담긴 상품이 없습니다'
      }
      plannedPhase="5-D 장바구니/주문"
      links={[{ to: '/products', label: '쇼핑 계속하기' }]}
    />
  );
}

function App() {
  return (
    <BrowserRouter>
      <ConditionalChrome><Header /></ConditionalChrome>
      <ConditionalChrome><RecentlyViewedSidebar /></ConditionalChrome>
      <Routes>
        {/* 메인 - 5-B 라운드 3-D 신규 HomePage */}
        <Route path="/" element={<HomePage />} />
        <Route path="/products" element={<ProductList />} />
        <Route path="/products/:id" element={<ProductDetail />} />
        <Route path="/builder/:id" element={<KeyboardBuilderRoute />} />
        {/* /builder/:id 는 KeyboardBuilderRoute wrapper 사용 — useParams + fetch 후 props 주입.
            KeyboardBuilder 자체는 props 인터페이스 보존 (다른 사용처 호환). 5/10 fix. */}

        {/* 공지사항 상세 - 5-B 라운드 3-Q 신규 */}
        <Route path="/notices/:id" element={<NoticeDetailPage />} />

        {/* 5-B 인증/회원 */}
        <Route path="/login" element={<LoginPage />} />

        {/* 5-B Round 3 - 회원가입 3단계 분리 */}
        <Route path="/signup/type" element={<JoinTypeChoicePage />} />
        <Route path="/signup/agree" element={<JoinAgreePage />} />
        <Route path="/signup" element={<SignupPage />} />

        <Route
          path="/mypage"
          element={
            <ProtectedRoute>
              <MyPage />
            </ProtectedRoute>
          }
        />

        {/* Phase 7 [9-2B] - 감사 로그 뷰어 (ADMIN role 가드).
            ProtectedRoute 가 비로그인 시 /login 으로, role 검사로 ADMIN 만 통과. */}
        <Route
          path="/admin/audit-logs"
          element={
            <ProtectedRoute requireRole="ADMIN">
              <AdminAuditLogPage />
            </ProtectedRoute>
          }
        />

        {/* 5-B Day 2 신규 - 카카오 OAuth 콜백 */}
        <Route path="/auth/kakao/success" element={<KakaoCallbackPage />} />

        {/* 5-D 장바구니/주문 - placeholder */}
        <Route path="/cart" element={<CartPlaceholder />} />

        {/* 약관 - placeholder (Phase 8 배포 시 실제 콘텐츠) */}
        <Route
          path="/terms"
          element={
            <PlaceholderPage
              title="이용약관"
              subtitle="실제 운영 시 법무 검토 후 게재 예정"
              plannedPhase="Phase 8 배포"
              links={[{ to: '/', label: '메인으로' }]}
            />
          }
        />
        <Route
          path="/privacy"
          element={
            <PlaceholderPage
              title="개인정보처리방침"
              subtitle="실제 운영 시 법무 검토 후 게재 예정"
              plannedPhase="Phase 8 배포"
              links={[{ to: '/', label: '메인으로' }]}
            />
          }
        />

        {/* 404 */}
        <Route
          path="*"
          element={
            <PlaceholderPage
              title="404"
              subtitle="요청하신 페이지를 찾을 수 없어요"
              links={[{ to: '/', label: '메인으로' }]}
            />
          }
        />
      </Routes>
      <ConditionalChrome><Footer /></ConditionalChrome>
    </BrowserRouter>
  );
}

export default App;
