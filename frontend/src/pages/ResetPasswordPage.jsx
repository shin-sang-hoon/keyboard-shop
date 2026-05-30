// frontend/src/pages/ResetPasswordPage.jsx
//
// 비밀번호 재설정 (5/29, 5/30 UI 정돈). 메일 링크(/reset-password?token=...)로 진입.
//
// 흐름:
//   1) URL ?token= 추출 (useSearchParams)
//   2) 새 비밀번호 + 확인 입력 → 일치/길이 검증
//   3) authApi.resetPassword(token, newPassword)
//      - 200: 성공 → 안내 후 로그인. / 400: 토큰 무효·만료·사용됨. / 403: 탈퇴 계정.
//   - 토큰이 없으면(직접 진입) 안내 + 비번찾기로 유도.
// 디자인: 사이트 공통 톤(흰 배경 + 검정 포인트). 에러 메시지만 빨강(기능적 의미).

import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../api/auth';
import { colors, typography, spacing, radius, shadow, transition } from '../styles/tokens';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [focus, setFocus] = useState('');   // 'pw' | 'confirm' | ''
  const [hover, setHover] = useState(false);

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

  // 토큰 없이 직접 진입
  if (!token) {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <h1 style={S.title}>유효하지 않은 접근</h1>
          <p style={S.subtitle}>
            비밀번호 재설정은 메일로 받은 링크를 통해 진행해 주세요.
          </p>
          <Link to="/forgot-password" style={S.primaryLink}>비밀번호 찾기로 가기</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        {done ? (
          <>
            <h1 style={S.title}>비밀번호가 변경되었어요</h1>
            <p style={S.subtitle}>새 비밀번호로 로그인해 주세요.</p>
            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              onMouseEnter={() => setHover(true)}
              onMouseLeave={() => setHover(false)}
              style={{ ...S.primaryBtn, ...(hover ? S.primaryBtnHover : {}) }}
            >
              로그인하러 가기
            </button>
          </>
        ) : (
          <>
            <h1 style={S.title}>비밀번호 재설정</h1>
            <p style={S.subtitle}>새로 사용할 비밀번호를 입력해 주세요.</p>

            <form onSubmit={handleSubmit} noValidate>
              <label style={S.label}>
                <span style={S.labelText}>새 비밀번호</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocus('pw')}
                  onBlur={() => setFocus('')}
                  required
                  minLength={4}
                  style={{ ...S.input, ...(focus === 'pw' ? S.inputFocus : {}) }}
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
                  onFocus={() => setFocus('confirm')}
                  onBlur={() => setFocus('')}
                  required
                  minLength={4}
                  style={{ ...S.input, ...(focus === 'confirm' ? S.inputFocus : {}) }}
                  placeholder="••••••••"
                />
              </label>

              {error && <div style={S.error}>{error}</div>}

              <button
                type="submit"
                disabled={submitting || !password || !confirm}
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
                style={{
                  ...S.primaryBtn,
                  ...(hover && !(submitting || !password || !confirm) ? S.primaryBtnHover : {}),
                  ...(submitting || !password || !confirm ? S.btnDisabled : {}),
                }}
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
  card: { width: '100%', maxWidth: 400, background: colors.white, border: `1px solid ${colors.borderLight}`, borderRadius: radius.xl, padding: `${spacing[10]} ${spacing[8]}`, boxShadow: shadow.card, textAlign: 'center' },
  title: { fontSize: typography.fontSize['2xl'], fontWeight: typography.fontWeight.bold, color: colors.textOnLight, margin: 0, letterSpacing: typography.letterSpacing.tight },
  subtitle: { color: colors.textOnLightDim, fontSize: typography.fontSize.base, marginTop: spacing[3], marginBottom: spacing[6], lineHeight: typography.lineHeight.relaxed },
  label: { display: 'block', marginBottom: spacing[4], textAlign: 'left' },
  labelText: { display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textOnLight, marginBottom: spacing[2] },
  input: { width: '100%', padding: `${spacing[3]} ${spacing[4]}`, fontSize: typography.fontSize.md, background: colors.white, border: `1px solid ${colors.borderLight}`, borderRadius: radius.lg, color: colors.textOnLight, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', transition: transition.base },
  inputFocus: { borderColor: colors.textOnLight, boxShadow: `0 0 0 3px rgba(15, 23, 42, 0.08)` },
  error: { background: colors.dangerSoft, border: `1px solid ${colors.danger}`, color: colors.danger, padding: `${spacing[2]} ${spacing[3]}`, borderRadius: radius.md, fontSize: typography.fontSize.sm, marginBottom: spacing[4], textAlign: 'left' },
  primaryBtn: { width: '100%', padding: `${spacing[3]} ${spacing[4]}`, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, background: colors.textOnLight, color: colors.white, border: 'none', borderRadius: radius.lg, cursor: 'pointer', fontFamily: 'inherit', transition: transition.base },
  primaryBtnHover: { opacity: 0.88 },
  primaryLink: { display: 'block', width: '100%', padding: `${spacing[3]} ${spacing[4]}`, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, background: colors.textOnLight, color: colors.white, border: 'none', borderRadius: radius.lg, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', boxSizing: 'border-box', transition: transition.base },
  btnDisabled: { opacity: 0.4, cursor: 'not-allowed' },
};
