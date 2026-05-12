// frontend/src/pages/SignupPage.jsx
//
// 5-B 회원가입 페이지 (LIGHT 톤).
//
// 동작:
// - 이메일/비번/이름 → useAuth().signup() → 백엔드가 토큰까지 발급해줘서 자동 로그인
// - 409 Conflict: 이메일 중복 메시지 표시
// - 클라이언트측 검증: 비번 4자 이상, 비번 확인 일치
// - 이메일 중복 사전 체크 API는 만들지 않음 (서버 응답이 단일 진실 공급원)
//
// 5-B fix (5/12): 사용자가 인풋 수정하면 이전 error 박스 자동으로 사라짐.
// 이전엔 한 번 실패 후 이메일 바꿔 입력해도 빨간 박스가 그대로 남아있어서
// 두 번째 시도가 막힌 것처럼 보였음. 이제 입력 변경 = 새 시도 의도로 간주.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { colors, typography, spacing, radius } from '../styles/tokens';

export default function SignupPage() {
  const navigate = useNavigate();
  const { signup } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const passwordMismatch =
    passwordConfirm.length > 0 && password !== passwordConfirm;
  const canSubmit =
    email.trim() &&
    password.length >= 4 &&
    password === passwordConfirm &&
    name.trim() &&
    !submitting;

  // 5-B fix: 인풋 변경 시 error 도 같이 비움.
  // 한 번 실패 후 사용자가 값을 고치는 = 새 시도 의도라고 간주.
  function clearErrorOn(setter) {
    return (e) => {
      if (error) setError('');
      setter(e.target.value);
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;

    setError('');
    setSubmitting(true);
    try {
      await signup({
        email: email.trim(),
        password,
        name: name.trim(),
      });
      navigate('/products', { replace: true });
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message;

      // 백엔드가 영어 메시지 ("Email already in use") 를 보내도
      // 한국어 우선. status 가 결정적 단서니까 그걸로 분기.
      if (status === 409) {
        setError('이미 사용 중인 이메일입니다.');
      } else if (status === 400) {
        setError(msg || '입력값을 확인해 주세요.');
      } else {
        setError('회원가입 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <h1 style={S.title}>회원가입</h1>
        <p style={S.subtitle}>이메일로 새 계정을 만드세요</p>

        <form onSubmit={handleSubmit} noValidate>
          <label style={S.label}>
            <span style={S.labelText}>이메일</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={clearErrorOn(setEmail)}
              required
              style={S.input}
              placeholder="you@example.com"
            />
          </label>

          <label style={S.label}>
            <span style={S.labelText}>이름</span>
            <input
              type="text"
              autoComplete="name"
              value={name}
              onChange={clearErrorOn(setName)}
              required
              maxLength={50}
              style={S.input}
              placeholder="홍길동"
            />
          </label>

          <label style={S.label}>
            <span style={S.labelText}>비밀번호</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={clearErrorOn(setPassword)}
              required
              minLength={4}
              style={S.input}
              placeholder="4자 이상"
            />
          </label>

          <label style={S.label}>
            <span style={S.labelText}>비밀번호 확인</span>
            <input
              type="password"
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={clearErrorOn(setPasswordConfirm)}
              required
              style={{
                ...S.input,
                ...(passwordMismatch ? { borderColor: '#dc2626' } : {}),
              }}
              placeholder="다시 입력"
            />
            {passwordMismatch && (
              <span style={S.fieldHint}>비밀번호가 일치하지 않아요</span>
            )}
          </label>

          {error && <div style={S.error}>{error}</div>}

          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              ...S.primaryBtn,
              ...(!canSubmit ? S.btnDisabled : {}),
            }}
          >
            {submitting ? '가입 중...' : '회원가입'}
          </button>
        </form>

        <div style={S.footer}>
          이미 계정이 있나요?{' '}
          <Link to="/login" style={S.link}>
            로그인
          </Link>
        </div>
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[4],
    background: colors.surface,
    fontFamily: typography.fontFamily.base,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.lg,
    padding: `${spacing[8]} ${spacing[6]}`,
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
  },
  title: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textOnLight,
    margin: 0,
    letterSpacing: typography.letterSpacing.tight,
  },
  subtitle: {
    color: colors.textOnLightDim,
    fontSize: typography.fontSize.sm,
    marginTop: spacing[2],
    marginBottom: spacing[6],
  },
  label: { display: 'block', marginBottom: spacing[4] },
  labelText: {
    display: 'block',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textOnLight,
    marginBottom: spacing[2],
  },
  input: {
    width: '100%',
    padding: spacing[3],
    fontSize: typography.fontSize.base,
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.md,
    color: colors.textOnLight,
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  fieldHint: {
    display: 'block',
    color: '#dc2626',
    fontSize: typography.fontSize.sm,
    marginTop: spacing[1],
  },
  error: {
    background: '#fef2f2',
    border: `1px solid #fecaca`,
    color: '#b91c1c',
    padding: spacing[3],
    borderRadius: radius.md,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing[4],
  },
  primaryBtn: {
    width: '100%',
    padding: `${spacing[3]} ${spacing[4]}`,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    background: colors.textOnLight,
    color: colors.white,
    border: 'none',
    borderRadius: radius.md,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  btnDisabled: { opacity: 0.4, cursor: 'not-allowed' },
  footer: {
    marginTop: spacing[5],
    textAlign: 'center',
    fontSize: typography.fontSize.sm,
    color: colors.textOnLightDim,
  },
  link: {
    color: colors.textOnLight,
    textDecoration: 'underline',
    fontWeight: typography.fontWeight.semibold,
    textUnderlineOffset: '3px',
  },
};
