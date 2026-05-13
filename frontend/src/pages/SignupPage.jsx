// frontend/src/pages/SignupPage.jsx
//
// 5-B 회원가입 페이지 (LIGHT 톤).
//
// 5-B Round 3 (2026-05-13) - 스웨그키 가입 3단계 복제.
//   - 약관 동의 가드 추가: location.state.agreedAt 없으면 /signup/type 리다이렉트
//     (새로고침 시 PII 가 남지 않아 보안적으로 더 안전, 가입 흐름은 다시 시작)
//   - 연락처 필드 추가 (스웨그키 화면 참고)
//   - 마케팅 동의 정보 (sms/email) 는 location.state 에서 받지만,
//     백엔드 컬럼 미존재로 우선 console.log 로 기록 (Phase 8 user prefs 확장 예정)
//
// 5-B fix (5/12): clearErrorOn 헬퍼 유지.
// 사용자가 인풋 수정하면 이전 error 박스 자동으로 사라짐.

import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { colors, typography, spacing, radius } from '../styles/tokens';

export default function SignupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signup } = useAuth();

  // 약관 동의 가드: location.state.agreedAt 없으면 step1 로.
  // 새로고침 시 state 가 사라지므로 가입 흐름을 처음부터 다시 진행 (의도된 동작).
  useEffect(() => {
    if (!location.state?.agreedAt) {
      navigate('/signup/type', { replace: true });
    }
  }, [location.state, navigate]);

  const marketing = location.state?.marketing || { sms: false, email: false };

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const passwordMismatch =
    passwordConfirm.length > 0 && password !== passwordConfirm;
  const canSubmit =
    email.trim() &&
    password.length >= 4 &&
    password === passwordConfirm &&
    name.trim() &&
    phone.trim() &&
    !submitting;

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
      // 백엔드 signup 은 email/password/name 만 받음 (현재 스키마).
      // phone + marketing 은 향후 user prefs 확장 시 함께 보낼 예정.
      console.log('[Signup] marketing prefs (Phase 8 적용 예정):', {
        phone: phone.trim(),
        marketing,
      });

      await signup({
        email: email.trim(),
        password,
        name: name.trim(),
      });
      navigate('/products', { replace: true });
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message;

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

  // 가드 통과 전 깜빡임 방지
  if (!location.state?.agreedAt) {
    return null;
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <h1 style={S.title}>회원가입</h1>
        <p style={S.subtitle}>회원 정보를 입력해주세요</p>

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
                ...(passwordMismatch ? { border: '1px solid #dc2626' } : {}),
              }}
              placeholder="다시 입력"
            />
            {passwordMismatch && (
              <span style={S.fieldHint}>비밀번호가 일치하지 않아요</span>
            )}
          </label>

          <label style={S.label}>
            <span style={S.labelText}>
              이름 <span style={S.required}>*</span>
            </span>
            <input
              type="text"
              autoComplete="name"
              value={name}
              onChange={clearErrorOn(setName)}
              required
              maxLength={50}
              style={S.input}
              placeholder="이름을(를) 입력하세요"
            />
          </label>

          <label style={S.label}>
            <span style={S.labelText}>
              연락처 <span style={S.required}>*</span>
            </span>
            <input
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={clearErrorOn(setPhone)}
              required
              maxLength={20}
              style={S.input}
              placeholder="010-1234-5678"
            />
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
            {submitting ? '가입 중...' : '가입하기'}
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
    maxWidth: 480,
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.lg,
    padding: `${spacing[10]} ${spacing[8]}`,
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
  },
  title: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textOnLight,
    margin: 0,
    letterSpacing: typography.letterSpacing.tight,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textOnLightDim,
    fontSize: typography.fontSize.sm,
    marginTop: spacing[2],
    marginBottom: spacing[8],
    textAlign: 'center',
  },
  label: { display: 'block', marginBottom: spacing[4] },
  labelText: {
    display: 'block',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textOnLight,
    marginBottom: spacing[2],
  },
  required: {
    color: '#3b6bef',
    marginLeft: spacing[1],
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
    padding: `${spacing[4]} ${spacing[4]}`,
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
    marginTop: spacing[8],
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
