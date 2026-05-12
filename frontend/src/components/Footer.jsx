// frontend/src/components/Footer.jsx
// 5-B 라운드 3-R - Help Center 운영 시간 텍스트 정밀 업데이트.
//
// 변경 사항 (3-Q → 3-R):
//   AM9 - PM6, Lunch AM11:30 - PM12:30
//   → AM9:30 - PM6:20, Lunch PM1:20 - PM2:30
//
// 그 외 swagkey 톤 배치는 라운드 3-P 그대로 유지.

import { Link } from 'react-router-dom';
import { colors, typography, spacing } from '../styles/tokens';

export default function Footer() {
  return (
    <footer style={styles.footer}>
      <div style={styles.inner}>
        {/* 회사 정보 (swagkey 순서: 상호 / 주소 / 사업자 / 대표 / Help / 이메일) */}
        <div style={styles.infoStack}>
          <div style={styles.infoLine}>
            <span style={styles.label}>상호:</span>
            <span style={styles.value}>스웨크론(SWACHRON)</span>
          </div>

          <div style={styles.infoLine}>
            <span style={styles.label}>주소 :</span>
            <span style={styles.value}>인천광역시 (포트폴리오 프로젝트, 실주소 미공개)</span>
          </div>

          <div style={styles.infoLine}>
            <span style={styles.label}>사업자등록번호 :</span>
            <span style={styles.value}>000-00-00000 (시연용)</span>
            <span style={styles.sep}>|</span>
            <span style={styles.label}>통신판매업신고 :</span>
            <span style={styles.value}>제2026-000호</span>
          </div>

          <div style={styles.infoLine}>
            <span style={styles.label}>대표 :</span>
            <span style={styles.value}>신상훈</span>
            <span style={styles.sep}>|</span>
            <span style={styles.label}>개인정보관리책임자 :</span>
            <span style={styles.value}>신상훈</span>
          </div>

          <div style={styles.infoLine}>
            <span style={styles.label}>Help Center:</span>
            <span style={styles.value}>010-6824-7715 (AM9:30 - PM6:20, Lunch PM1:20 - PM2:30, Weekend and Holiday Off)</span>
          </div>

          <div style={styles.infoLine}>
            <span style={styles.label}>이메일:</span>
            <span style={styles.value}>popeeplus87@gmail.com</span>
          </div>
        </div>

        {/* 약관 링크 */}
        <div style={styles.policyRow}>
          <Link to="/terms" style={styles.policyLink}>이용약관</Link>
          <Link to="/privacy" style={{ ...styles.policyLink, fontWeight: typography.fontWeight.bold }}>
            개인정보처리방침
          </Link>
        </div>

        {/* Copyright */}
        <div style={styles.copyright}>
          Copyright © 2026 스웨크론(SWACHRON) 포트폴리오 프로젝트. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

const styles = {
  footer: {
    background: colors.white,
    borderTop: `1px solid ${colors.borderLight}`,
    padding: `${spacing[10]} ${spacing[8]} ${spacing[6]}`,
    fontFamily: typography.fontFamily.base,
    color: colors.textOnLight,
  },
  inner: {
    maxWidth: 1600,
    margin: '0 auto',
  },
  infoStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing[1],
    paddingBottom: spacing[6],
  },
  infoLine: {
    fontSize: 12,
    color: colors.textOnLight,
    lineHeight: 1.7,
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: 4,
  },
  label: {
    color: colors.textOnLight,
    fontWeight: typography.fontWeight.medium,
  },
  value: {
    color: colors.textOnLight,
    fontWeight: typography.fontWeight.regular || 400,
    marginRight: spacing[1],
  },
  sep: {
    color: colors.borderLight,
    margin: `0 ${spacing[2]}`,
  },
  policyRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: spacing[8],
    paddingTop: spacing[5],
    paddingBottom: spacing[3],
    borderTop: `1px solid ${colors.borderLight}`,
  },
  policyLink: {
    fontSize: 12,
    color: colors.textOnLight,
    textDecoration: 'none',
    fontWeight: typography.fontWeight.medium,
    letterSpacing: '0.02em',
  },
  copyright: {
    textAlign: 'center',
    fontSize: 11,
    color: colors.textOnLightDim,
    letterSpacing: '0.02em',
    paddingTop: spacing[2],
  },
};
