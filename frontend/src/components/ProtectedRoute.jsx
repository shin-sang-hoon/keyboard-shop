// frontend/src/components/ProtectedRoute.jsx
//
// 5-B 라우트 가드.
//
// 사용:
//   <Route path="/mypage" element={<ProtectedRoute><MyPage /></ProtectedRoute>} />
//
// 동작:
// - 비로그인이면 /login 으로 리다이렉트
// - 원래 가려던 경로를 location.state.from 에 저장 → 로그인 후 그곳으로 복귀 가능
// - 로그인되어 있으면 children 그대로 렌더
//
// requireRole prop으로 role 검증도 가능 (예: <ProtectedRoute requireRole="ADMIN">).

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function ProtectedRoute({ children, requireRole = null }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireRole && user?.role !== requireRole) {
    return <Navigate to="/products" replace />;
  }

  return children;
}

export default ProtectedRoute;
