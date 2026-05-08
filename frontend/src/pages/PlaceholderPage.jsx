// frontend/src/pages/PlaceholderPage.jsx
// 아직 본격 구현 전인 페이지 공통 컴포넌트.
// /login, /signup, /cart, /mypage 등에 재사용.
// 향후 각 페이지를 본격 구현할 때, App.jsx 의 element 만 교체하면 됨.

import { Link } from 'react-router-dom';
import {
  colors,
  spacing,
  radius,
  typography,
  shadow,
} from '../styles/tokens';

export default function PlaceholderPage({
  title,
  subtitle,
  plannedPhase, // 예: "5-B 인증/회원"
  links = [], // [{ to, label }]
}) {
  return (
    <div
      style={{
        maxWidth: 480,
        margin: '120px auto',
        padding: `${spacing[8]} ${spacing[6]}`,
        textAlign: 'center',
        background: colors.white,
        border: `1px solid ${colors.borderLight}`,
        borderRadius: radius.xl,
        boxShadow: shadow.card,
        fontFamily: typography.fontFamily.base,
      }}
    >
      <h1
        style={{
          fontSize: typography.fontSize['2xl'],
          fontWeight: typography.fontWeight.bold,
          color: colors.textOnLight,
          marginBottom: spacing[3],
          letterSpacing: typography.letterSpacing.tight,
        }}
      >
        {title}
      </h1>

      {subtitle && (
        <p
          style={{
            color: colors.textOnLightDim,
            fontSize: typography.fontSize.md,
            lineHeight: typography.lineHeight.relaxed,
            marginBottom: spacing[6],
          }}
        >
          {subtitle}
        </p>
      )}

      {plannedPhase && (
        <div
          style={{
            display: 'inline-block',
            background: colors.accentSoft,
            color: colors.accent,
            padding: `${spacing[2]} ${spacing[4]}`,
            borderRadius: radius.pill,
            marginBottom: spacing[6],
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.medium,
          }}
        >
          🚧 {plannedPhase} 단계에서 본격 작업 예정
        </div>
      )}

      {links.length > 0 && (
        <div
          style={{
            fontSize: typography.fontSize.sm,
            marginTop: plannedPhase ? 0 : spacing[6],
          }}
        >
          {links.map((link, i) => (
            <span key={link.to}>
              {i > 0 && (
                <span
                  style={{
                    color: colors.borderLight,
                    margin: `0 ${spacing[3]}`,
                  }}
                >
                  ·
                </span>
              )}
              <Link
                to={link.to}
                style={{
                  color: colors.accent,
                  textDecoration: 'none',
                  fontWeight: typography.fontWeight.medium,
                }}
              >
                {link.label}
              </Link>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
