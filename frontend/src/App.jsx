// frontend/src/App.jsx
//
// 5-B Step 3 - 인증 페이지 실제 구현으로 교체.
//
// 변경:
//  - /login, /signup → PlaceholderPage → LoginPage / SignupPage (LIGHT 톤)
//  - /mypage → PlaceholderPage → ProtectedRoute로 감싼 MyPage
//  - /cart 는 비로그인도 보게 둠 (가입 유도용, 5-D에서 본격 구현 시 재검토)

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProductList from './pages/ProductList';
import ProductDetail from './pages/ProductDetail';
import KeyboardBuilder from './pages/KeyboardBuilder';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import MyPage from './pages/MyPage';
import PlaceholderPage from './pages/PlaceholderPage';
import ProtectedRoute from './components/ProtectedRoute';
import { useCartStore } from './stores/cartStore';

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
      <Routes>
        {/* 메인 */}
        <Route path="/" element={<Navigate to="/products" replace />} />
        <Route path="/products" element={<ProductList />} />
        <Route path="/products/:id" element={<ProductDetail />} />
        <Route path="/builder/:id" element={<KeyboardBuilder />} />

        {/* 5-B 인증/회원 - 본격 구현 */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/mypage"
          element={
            <ProtectedRoute>
              <MyPage />
            </ProtectedRoute>
          }
        />

        {/* 5-D 장바구니/주문 - placeholder */}
        <Route path="/cart" element={<CartPlaceholder />} />

        {/* 404 */}
        <Route
          path="*"
          element={
            <PlaceholderPage
              title="404"
              subtitle="요청하신 페이지를 찾을 수 없어요"
              links={[{ to: '/products', label: '상품 목록으로' }]}
            />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
