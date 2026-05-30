// frontend/src/pages/ResetPasswordPage.jsx
//
// 비밀번호 재설정 (5/29). 메일 링크(/reset-password?token=...)로 진입.
//
// 흐름:
//   1) URL 쿼리스트링 ?token= 추출 (useSearchParams)
//   2) 새 비밀번호 + 확인 입력 → 일치/길이 검증
//   3) authApi.resetPassword(token, newPassword)
//      - 200: 성공 → 안내 후 로그인으로
//      - 400: 토큰 무효/만료/이미 사용됨 (백엔드 메시지 영어 → 한국어 변환)
//      - 403: 탈퇴 계정
//   - 토큰이 아예 없으면(직접 진입 등) 안내 + 비번찾기로 유도.

import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../api/auth';
import { colors, typography, spacing, radius } from '../styles/tokens';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setError('');

    if (password.length < 4) {
      setError('비밀번호는 4자 이상이어야 해요.');
      return;
    }
    if (password !== confirm) {
      setError('비밀번호가 일치하지 않아요.');
      return;
    }

    setSubmitting(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 400) {
        setError('링크가 만료되었거나 이미 사용되었어요. 비밀번호 찾기를 다시 시도해 주세요.');
      } else if (status === 403) {
        setError('이 계정은 이미 탈퇴한 계정입니다.');
      } else {
        setError('재설정 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  // 토큰 없이 직접 진입한 경우
  if (!token) {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <h1 style={S.title}>비밀번호 재설정</h1>
          <p style={S.subtitle}>
            유효하지 않은 접근이에요. 비밀번호 재설정은 메일로 받은 링크를 통해 진행해 주세요.
          </p>
          <Link to="/forgot-password" style={{ ...S.primaryBtn, display: 'block', textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box' }}>
            비밀번호 찾기로 가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <h1 style={S.title}>비밀번호 재설정</h1>

        {done ? (
          <>
            <p style={S.subtitle}>
              비밀번호가 변경되었어요. 새 비밀번호로 로그인해 주세요.
            </p>
            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              style={S.primaryBtn}
            >
              로그인하러 가기
            </button>
          </>
        ) : (
          <>
            <p style={S.subtitle}>새로 사용할 비밀번호를 입력해 주세요.</p>
            <form onSubmit={handleSubmit} noValidate>
              <label style={S.label}>
                <span style={S.labelText}>새 비밀번호</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={4}
                  style={S.input}
                  placeholder="••••••••"
                />
              </label>

              <label style={S.label}>
                <span style={S.labelText}>새 비밀번호 확인</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={4}
                  style={S.input}
                  placeholder="••••••••"
                />
              </label>

              {error && <div style={S.error}>{error}</div>}

              <button
                type="submit"
                disabled={submitting || !password || !confirm}
                style={{ ...S.primaryBtn, ...(submitting || !password || !confirm ? S.btnDisabled : {}) }}
              >
                {submitting ? '변경 중...' : '비밀번호 변경'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: spacing[4], background: colors.surface, fontFamily: typography.fontFamily.base },
  card: { width: '100%', maxWidth: 420, background: colors.white, border: `1px solid ${colors.borderLight}`, borderRadius: radius.lg, padding: `${spacing[8]} ${spacing[6]}`, boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)' },
  title: { fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.bold, color: colors.textOnLight, margin: 0, letterSpacing: typography.letterSpacing.tight },
  subtitle: { color: colors.textOnLightDim, fontSize: typography.fontSize.sm, marginTop: spacing[2], marginBottom: spacing[6], lineHeight: 1.6 },
  label: { display: 'block', marginBottom: spacing[4] },
  labelText: { display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textOnLight, marginBottom: spacing[2] },
  input: { width: '100%', padding: spacing[3], fontSize: typography.fontSize.base, background: colors.white, border: `1px solid ${colors.borderLight}`, borderRadius: radius.md, color: colors.textOnLight, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },
  error: { background: '#fef2f2', border: `1px solid #fecaca`, color: '#b91c1c', padding: spacing[3], borderRadius: radius.md, fontSize: typography.fontSize.sm, marginBottom: spacing[4] },
  primaryBtn: { width: '100%', padding: `${spacing[3]} ${spacing[4]}`, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, background: colors.textOnLight, color: colors.white, border: 'none', borderRadius: radius.md, cursor: 'pointer', fontFamily: 'inherit' },
  btnDisabled: { opacity: 0.4, cursor: 'not-allowed' },
};
