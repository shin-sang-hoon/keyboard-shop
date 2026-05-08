// frontend/src/App.jsx
// 5-A Step 4 - 라우트 확장.
//
// 추가된 것:
//  - /login, /signup, /mypage  → 5-B 에서 본격 구현 (PlaceholderPage)
//  - /cart                      → 5-D 에서 본격 구현 (cartStore 살아있는 검증 겸용)
//  - *  (404 fallback)
//
// 향후 각 페이지 본격 구현 시: 해당 Route 의 element 만 갈아끼우면 됨.

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProductList from './pages/ProductList';
import ProductDetail from './pages/ProductDetail';
import KeyboardBuilder from './pages/KeyboardBuilder';
import PlaceholderPage from './pages/PlaceholderPage';
import { useCartStore } from './stores/cartStore';

// === Cart placeholder ===
// cartStore 가 정상 동작하는지 살아있는 검증 겸용.
// ProductDetail 의 "장바구니" 버튼 눌러서 담은 후 /cart 가면 카운트가 보여야 함.
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
        {/* 메인 (이미 있던 라우트) */}
        <Route path="/" element={<Navigate to="/products" replace />} />
        <Route path="/products" element={<ProductList />} />
        <Route path="/products/:id" element={<ProductDetail />} />
        <Route path="/builder/:id" element={<KeyboardBuilder />} />

        {/* 5-B 인증/회원 - 본격 작업 예정 */}
        <Route
          path="/login"
          element={
            <PlaceholderPage
              title="로그인"
              subtitle="이메일/비밀번호 → JWT 발급 → authStore 저장"
              plannedPhase="5-B 인증/회원"
              links={[
                { to: '/signup', label: '회원가입' },
                { to: '/products', label: '상품 목록으로' },
              ]}
            />
          }
        />
        <Route
          path="/signup"
          element={
            <PlaceholderPage
              title="회원가입"
              subtitle="이메일 중복 체크 + 비밀번호 검증 + 약관 동의"
              plannedPhase="5-B 인증/회원"
              links={[
                { to: '/login', label: '로그인' },
                { to: '/products', label: '상품 목록으로' },
              ]}
            />
          }
        />
        <Route
          path="/mypage"
          element={
            <PlaceholderPage
              title="마이페이지"
              subtitle="주문내역 + 찜/좋아요 + 작성한 리뷰 / Q&A"
              plannedPhase="5-B 인증/회원"
              links={[{ to: '/products', label: '상품 목록으로' }]}
            />
          }
        />

        {/* 5-D 장바구니/주문 - 본격 작업 예정 */}
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
