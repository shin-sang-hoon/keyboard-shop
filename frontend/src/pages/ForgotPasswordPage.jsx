// frontend/src/pages/ForgotPasswordPage.jsx
//
// 비밀번호 찾기 (5/29). 이메일 입력 → 재설정 메일 발송 요청.
//
// 보안:
//   - 백엔드 forgot 은 enumeration 방지를 위해 이메일 존재 여부와 무관하게 항상 200.
//   - 따라서 프론트도 "계정이 있다면 메일을 보냈다"는 동일 안내만 노출.
//     (존재 여부를 알려주지 않음 → 계정 열거 공격 차단)
//   - 디자인 톤은 LoginPage 와 동일 (light, S 스타일 패턴 재사용).

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/auth';
import { colors, typography, spacing, radius } from '../styles/tokens';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await authApi.forgotPassword(email.trim());
      // 성공/실패 무관하게 동일 안내 (enumeration 방지).
      setSent(true);
    } catch {
      // 네트워크 등 예외도 동일 안내로 수렴 (정보 노출 최소화).
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <h1 style={S.title}>비밀번호 찾기</h1>

        {sent ? (
          <>
            <p style={S.subtitle}>
              입력하신 이메일로 가입된 계정이 있다면, 비밀번호 재설정 링크를 보내드렸어요.
              메일함(스팸함 포함)을 확인해 주세요. 링크는 30분간 유효합니다.
            </p>
            <Link to="/login" style={{ ...S.primaryBtn, display: 'block', textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box' }}>
              로그인으로 돌아가기
            </Link>
          </>
        ) : (
          <>
            <p style={S.subtitle}>
              가입하신 이메일을 입력하시면 비밀번호 재설정 링크를 보내드려요.
            </p>
            <form onSubmit={handleSubmit} noValidate>
              <label style={S.label}>
                <span style={S.labelText}>이메일</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={S.input}
                  placeholder="you@example.com"
                />
              </label>

              <button
                type="submit"
                disabled={submitting || !email}
                style={{ ...S.primaryBtn, ...(submitting || !email ? S.btnDisabled : {}) }}
              >
                {submitting ? '보내는 중...' : '재설정 링크 받기'}
              </button>
            </form>

            <div style={S.footer}>
              <Link to="/login" style={S.link}>로그인</Link>
              {' · '}
              <Link to="/find-email" style={S.link}>아이디(이메일) 찾기</Link>
            </div>
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
  primaryBtn: { width: '100%', padding: `${spacing[3]} ${spacing[4]}`, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, background: colors.textOnLight, color: colors.white, border: 'none', borderRadius: radius.md, cursor: 'pointer', fontFamily: 'inherit' },
  btnDisabled: { opacity: 0.4, cursor: 'not-allowed' },
  footer: { marginTop: spacing[5], textAlign: 'center', fontSize: typography.fontSize.sm, color: colors.textOnLightDim },
  link: { color: colors.textOnLight, textDecoration: 'underline', fontWeight: typography.fontWeight.semibold, textUnderlineOffset: '3px' },
};
