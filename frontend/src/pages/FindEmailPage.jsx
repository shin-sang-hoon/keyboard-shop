// frontend/src/pages/FindEmailPage.jsx
//
// 아이디(이메일) 찾기 (5/29, 5/30 UI 정돈). 이름 입력 → 마스킹된 이메일 목록 표시.
//   - 백엔드가 ACTIVE 계정만 조회 + 이메일 마스킹 (po*****@gmail.com). 동명이인이면 여러 개.
// 디자인: 사이트 공통 톤(흰 배경 + 검정 포인트) 유지.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/auth';
import { colors, typography, spacing, radius, shadow, transition } from '../styles/tokens';

export default function FindEmailPage() {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // null=미조회, []=없음, [..]=있음
  const [focused, setFocused] = useState(false);
  const [hover, setHover] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const data = await authApi.findEmail(name.trim());
      setResult(Array.isArray(data?.emails) ? data.emails : []);
    } catch {
      setResult([]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <h1 style={S.title}>아이디 찾기</h1>
        <p style={S.subtitle}>
          가입 시 입력한 이름으로 이메일을 찾아드려요. (일부 가려서 표시됩니다)
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <label style={S.label}>
            <span style={S.labelText}>이름</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              required
              style={{ ...S.input, ...(focused ? S.inputFocus : {}) }}
              placeholder="홍길동"
            />
          </label>

          <button
            type="submit"
            disabled={submitting || !name}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
              ...S.primaryBtn,
              ...(hover && !(submitting || !name) ? S.primaryBtnHover : {}),
              ...(submitting || !name ? S.btnDisabled : {}),
            }}
          >
            {submitting ? '찾는 중...' : '아이디 찾기'}
          </button>
        </form>

        {result !== null && (
          <div style={S.resultBox}>
            {result.length > 0 ? (
              <>
                <div style={S.resultLabel}>찾은 이메일</div>
                {result.map((em, i) => (
                  <div key={i} style={S.resultItem}>{em}</div>
                ))}
              </>
            ) : (
              <div style={S.resultEmpty}>입력하신 이름과 일치하는 계정을 찾을 수 없어요.</div>
            )}
          </div>
        )}

        <div style={S.footer}>
          <Link to="/forgot-password" style={S.link}>비밀번호 찾기</Link>
          <span style={S.footerDivider}>·</span>
          <Link to="/login" style={S.link}>로그인</Link>
        </div>
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
  btnDisabled: { opacity: 0.4, cursor: 'not-allowed' },
  resultBox: { marginTop: spacing[5], padding: `${spacing[4]} ${spacing[5]}`, background: colors.surfaceMuted, border: `1px solid ${colors.borderLight}`, borderRadius: radius.lg, textAlign: 'left' },
  resultLabel: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, color: colors.textOnLightDim, marginBottom: spacing[2], letterSpacing: typography.letterSpacing.wide, textTransform: 'uppercase' },
  resultItem: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textOnLight, padding: `${spacing[1]} 0`, fontFamily: typography.fontFamily.mono, letterSpacing: typography.letterSpacing.base },
  resultEmpty: { fontSize: typography.fontSize.base, color: colors.textOnLightDim, lineHeight: typography.lineHeight.base },
  footer: { marginTop: spacing[6], textAlign: 'center', fontSize: typography.fontSize.base, color: colors.textOnLightDim },
  footerDivider: { margin: `0 ${spacing[3]}`, color: colors.borderLight },
  link: { color: colors.textOnLight, textDecoration: 'none', fontWeight: typography.fontWeight.semibold },
};
