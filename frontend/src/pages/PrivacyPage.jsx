// frontend/src/pages/PrivacyPage.jsx
//
// 개인정보처리방침 페이지 (footer /privacy). 기존 App.jsx 인라인 PlaceholderPage 대체.
//
// 정적 콘텐츠 — 백엔드 호출 없음. swagkey 라이트 톤.
// 수집항목은 실제 도메인과 일치:
//   - 가입 시(필수): 이메일, 비밀번호, 이름, 휴대폰 번호  (SignupPage)
//   - 프로필/배송 설정 시(선택): 닉네임, 우편번호, 주소(기본/상세)  (ProfileEditPage)
//   - 카카오 로그인: 카카오 계정 식별자(providerId)  (User.Provider.KAKAO)
//   - 자동 수집: 최종 접속 시각(lastLoginAt)
// 개인정보관리책임자: 신상훈. 회사정보는 Footer 와 동일.
//
// ※ 포트폴리오 시연용 방침 — 실제 서비스 운영 시 법무 검토 후 게재해야 함.

import { Link } from 'react-router-dom';
import { colors, typography, spacing, radius } from '../styles/tokens';

const SECTIONS = [
  {
    title: '1. 수집하는 개인정보 항목',
    body: [
      '회사는 회원가입, 서비스 제공, 상품 배송을 위해 다음의 개인정보를 수집합니다.',
      '① 회원가입 시 (필수): 이메일, 비밀번호, 이름, 휴대폰 번호',
      '② 프로필 및 배송지 설정 시 (선택): 닉네임, 우편번호, 주소(기본/상세)',
      '③ 카카오 간편 로그인 이용 시: 카카오 계정 식별자',
      '④ 서비스 이용 과정에서 자동 생성·수집되는 정보: 최종 접속 일시, 주문·결제 기록',
    ],
  },
  {
    title: '2. 개인정보의 수집 및 이용 목적',
    body: [
      '① 회원 관리: 회원제 서비스 이용에 따른 본인 식별·인증, 가입 의사 확인, 부정 이용 방지, 고지사항 전달',
      '② 서비스 제공: 상품 정보 제공, 구매 및 요금 결제, 물품 배송, 빌드 저장 등 맞춤 서비스 제공',
      '③ 고충 처리: 민원인의 신원 확인, 문의·불만 처리, 처리 결과 통보',
    ],
  },
  {
    title: '3. 개인정보의 보유 및 이용기간',
    body: [
      '① 원칙적으로 개인정보는 회원 탈퇴 시까지 보유·이용합니다.',
      '② 다만 관계 법령에 따라 보존할 필요가 있는 경우 해당 기간 동안 보관합니다.',
      '  - 계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래법)',
      '  - 대금결제 및 재화 등의 공급에 관한 기록: 5년 (전자상거래법)',
      '  - 소비자의 불만 또는 분쟁처리에 관한 기록: 3년 (전자상거래법)',
    ],
  },
  {
    title: '4. 개인정보의 제3자 제공',
    body: [
      '회사는 원칙적으로 회원의 개인정보를 외부에 제공하지 않습니다. 다만 다음의 경우에는 예외로 합니다.',
      '① 회원이 사전에 동의한 경우',
      '② 상품 배송을 위해 배송업체에 배송에 필요한 최소한의 정보(수령인, 연락처, 주소)를 제공하는 경우',
      '③ 법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우',
    ],
  },
  {
    title: '5. 개인정보의 파기',
    body: [
      '① 회사는 개인정보 보유기간의 경과, 처리 목적 달성 등 개인정보가 불필요하게 되었을 때 지체 없이 파기합니다.',
      '② 전자적 파일 형태의 정보는 복구·재생할 수 없는 기술적 방법으로 삭제합니다.',
    ],
  },
  {
    title: '6. 이용자 및 법정대리인의 권리',
    body: [
      '① 이용자는 언제든지 등록된 자신의 개인정보를 조회·수정하거나 회원 탈퇴를 통해 삭제를 요청할 수 있습니다. (마이페이지 > 회원 정보 수정 / 회원 탈퇴)',
      '② 만 14세 미만 아동의 회원가입은 원칙적으로 제한되며, 부득이한 경우 법정대리인의 동의를 받아야 합니다.',
    ],
  },
  {
    title: '7. 개인정보의 안전성 확보 조치',
    body: [
      '① 비밀번호는 일방향 암호화(BCrypt)하여 저장하며, 회사도 원문을 알 수 없습니다.',
      '② 인증 토큰 기반 접근 통제 및 관리자 권한 분리를 통해 개인정보에 대한 접근을 제한합니다.',
    ],
  },
  {
    title: '8. 개인정보관리책임자',
    body: [
      '회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 관련 문의·불만 처리를 위하여 아래와 같이 개인정보관리책임자를 지정하고 있습니다.',
      '  - 개인정보관리책임자: 신상훈',
      '  - 연락처: 010-6824-7715 / popeeplus87@naver.com',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div style={S.page}>
      <div style={S.container}>
        <h1 style={S.title}>개인정보처리방침</h1>

        <div style={S.notice}>
          본 방침은 포트폴리오 프로젝트 시연용으로 작성되었으며, 실제 서비스 운영 시
          법무 검토를 거쳐 확정·게재될 예정입니다.
        </div>

        {SECTIONS.map((sec, i) => (
          <section key={i} style={S.article}>
            <h2 style={S.articleTitle}>{sec.title}</h2>
            {sec.body.map((para, j) => (
              <p key={j} style={S.para}>{para}</p>
            ))}
          </section>
        ))}

        <div style={S.effective}>공고일자: 2026년 5월 31일 · 시행일자: 2026년 5월 31일</div>

        <div style={S.backRow}>
          <Link to="/" style={S.backLink}>← 메인으로</Link>
          <Link to="/terms" style={S.backLink}>이용약관 →</Link>
        </div>
      </div>
    </div>
  );
}

const S = {
  page: {
    background: colors.surface,
    minHeight: '100vh',
    padding: `${spacing[8]} ${spacing[4]}`,
    fontFamily: typography.fontFamily.base,
  },
  container: {
    maxWidth: 820,
    margin: '0 auto',
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.lg,
    padding: `${spacing[10]} ${spacing[8]}`,
    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textOnLight,
    margin: 0,
    marginBottom: spacing[5],
    letterSpacing: typography.letterSpacing.tight,
  },
  notice: {
    background: colors.surface,
    border: `1px solid ${colors.borderLight}`,
    borderLeft: `3px solid ${colors.textOnLightDim}`,
    borderRadius: radius.md,
    padding: `${spacing[3]} ${spacing[4]}`,
    fontSize: typography.fontSize.sm,
    color: colors.textOnLightDim,
    lineHeight: 1.6,
    marginBottom: spacing[8],
  },
  article: {
    marginBottom: spacing[6],
  },
  articleTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.textOnLight,
    margin: 0,
    marginBottom: spacing[3],
  },
  para: {
    fontSize: typography.fontSize.sm,
    color: colors.textOnLight,
    lineHeight: 1.75,
    margin: 0,
    marginBottom: spacing[2],
    whiteSpace: 'pre-wrap',
  },
  effective: {
    fontSize: typography.fontSize.xs,
    color: colors.textOnLightDim,
    marginTop: spacing[5],
    textAlign: 'right',
  },
  backRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: spacing[8],
    paddingTop: spacing[5],
    borderTop: `1px solid ${colors.borderLight}`,
  },
  backLink: {
    fontSize: typography.fontSize.sm,
    color: colors.textOnLight,
    textDecoration: 'none',
    fontWeight: typography.fontWeight.medium,
  },
};
