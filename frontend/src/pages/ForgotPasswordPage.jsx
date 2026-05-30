// frontend/src/pages/ForgotPasswordPage.jsx
//
// 비밀번호 찾기 (5/29, 5/30 UI 정돈). 이메일 입력 → 재설정 메일 발송 요청.
//
// 보안:
//   - 백엔드 forgot 은 enumeration 방지를 위해 이메일 존재 여부와 무관하게 항상 200.
//     따라서 프론트도 "계정이 있다면 메일을 보냈다"는 동일 안내만 노출.
//   - 카카오 등 소셜 계정은 비밀번호가 없어 재설정 대상이 아님(백엔드 provider 가드).
//     사용자 혼란 방지를 위해 안내 박스로 명시.
//
// 디자인: 사이트 공통 톤(흰 배경 + 검정 포인트) 유지. 별도 색 포인트 없음.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/auth';
import { colors, typography, spacing, radius, shadow, transition } from '../styles/tokens';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hover, setHover] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await authApi.forgotPassword(email.trim());
      setSent(true);
    } catch {
      setSent(true); // 동일 안내로 수렴 (정보 노출 최소화)
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        {sent ? (
          <>
            <h1 style={S.title}>메일을 보냈어요</h1>
            <p style={S.subtitle}>
              입력하신 이메일로 가입된 계정이 있다면, 비밀번호 재설정 링크를 보내드렸어요.
              메일함(스팸함 포함)을 확인해 주세요. 링크는 30분간 유효합니다.
            </p>
            <Link to="/login" style={S.primaryLink}>로그인으로 돌아가기</Link>
          </>
        ) : (
          <>
            <h1 style={S.title}>비밀번호 찾기</h1>
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
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  required
                  style={{ ...S.input, ...(focused ? S.inputFocus : {}) }}
                  placeholder="you@example.com"
                />
              </label>

              <button
                type="submit"
                disabled={submitting || !email}
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
                style={{
                  ...S.primaryBtn,
                  ...(hover && !(submitting || !email) ? S.primaryBtnHover : {}),
                  ...(submitting || !email ? S.btnDisabled : {}),
                }}
              >
                {submitting ? '보내는 중...' : '재설정 링크 받기'}
              </button>
            </form>

            <div style={S.infoBox}>
              카카오 등 소셜 로그인으로 가입한 계정은 비밀번호가 없어 재설정 대상이 아니에요.
              소셜 로그인으로 다시 시도해 주세요.
            </div>

            <div style={S.footer}>
              <Link to="/find-email" style={S.link}>아이디 찾기</Link>
              <span style={S.footerDivider}>·</span>
              <Link to="/login" style={S.link}>로그인</Link>
            </div>
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
  primaryBtn: { width: '100%', padding: `${spacing[3]} ${spacing[4]}`, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, background: colors.textOnLight, color: colors.white, border: 'none', borderRadius: radius.lg, cursor: 'pointer', fontFamily: 'inherit', transition: transition.base },
  primaryBtnHover: { opacity: 0.88 },
  primaryLink: { display: 'block', width: '100%', padding: `${spacing[3]} ${spacing[4]}`, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, background: colors.textOnLight, color: colors.white, border: 'none', borderRadius: radius.lg, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', boxSizing: 'border-box', transition: transition.base },
  btnDisabled: { opacity: 0.4, cursor: 'not-allowed' },
  infoBox: { marginTop: spacing[5], padding: `${spacing[3]} ${spacing[4]}`, background: colors.surfaceMuted, borderRadius: radius.lg, fontSize: typography.fontSize.sm, color: colors.textOnLightDim, lineHeight: typography.lineHeight.base, textAlign: 'left' },
  footer: { marginTop: spacing[6], textAlign: 'center', fontSize: typography.fontSize.base, color: colors.textOnLightDim },
  footerDivider: { margin: `0 ${spacing[3]}`, color: colors.borderLight },
  link: { color: colors.textOnLight, textDecoration: 'none', fontWeight: typography.fontWeight.semibold },
};
