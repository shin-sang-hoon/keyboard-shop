// frontend/src/pages/FindEmailPage.jsx
//
// 아이디(이메일) 찾기 (5/29). 이름 입력 → 마스킹된 이메일 목록 표시.
//
// 흐름:
//   1) 이름 입력 → authApi.findEmail(name)
//   2) { emails: [...] } 수신 → 마스킹 이메일 목록 렌더 (동명이인이면 여러 개)
//   3) 빈 배열이면 "일치하는 계정 없음" 안내
//   - 백엔드가 ACTIVE 계정만 조회 + 이메일 마스킹 (po*****@gmail.com).

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/auth';
import { colors, typography, spacing, radius } from '../styles/tokens';

export default function FindEmailPage() {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // null=미조회, []=없음, [..]=있음

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
              required
              style={S.input}
              placeholder="홍길동"
            />
          </label>

          <button
            type="submit"
            disabled={submitting || !name}
            style={{ ...S.primaryBtn, ...(submitting || !name ? S.btnDisabled : {}) }}
          >
            {submitting ? '찾는 중...' : '아이디 찾기'}
          </button>
        </form>

        {result !== null && (
          <div style={S.resultBox}>
            {result.length > 0 ? (
              <>
                <div style={S.resultLabel}>찾은 이메일</div>
                <ul style={S.resultList}>
                  {result.map((em, i) => (
                    <li key={i} style={S.resultItem}>{em}</li>
                  ))}
                </ul>
              </>
            ) : (
              <div style={S.resultEmpty}>입력하신 이름과 일치하는 계정을 찾을 수 없어요.</div>
            )}
          </div>
        )}

        <div style={S.footer}>
          <Link to="/login" style={S.link}>로그인</Link>
          {' · '}
          <Link to="/forgot-password" style={S.link}>비밀번호 찾기</Link>
        </div>
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
  resultBox: { marginTop: spacing[5], padding: spacing[4], background: colors.surface, border: `1px solid ${colors.borderLight}`, borderRadius: radius.md },
  resultLabel: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textOnLightDim, marginBottom: spacing[2] },
  resultList: { listStyle: 'none', padding: 0, margin: 0 },
  resultItem: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, color: colors.textOnLight, padding: `${spacing[1]} 0`, fontFamily: 'monospace' },
  resultEmpty: { fontSize: typography.fontSize.sm, color: colors.textOnLightDim },
  footer: { marginTop: spacing[5], textAlign: 'center', fontSize: typography.fontSize.sm, color: colors.textOnLightDim },
  link: { color: colors.textOnLight, textDecoration: 'underline', fontWeight: typography.fontWeight.semibold, textUnderlineOffset: '3px' },
};
