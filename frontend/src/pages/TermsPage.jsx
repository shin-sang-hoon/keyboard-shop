// frontend/src/pages/TermsPage.jsx
//
// 이용약관 페이지 (footer /terms). 기존 App.jsx 인라인 PlaceholderPage 를 대체.
//
// 정적 콘텐츠 — 백엔드 호출 없음. swagkey 라이트 톤(흰 카드 + 검정 텍스트).
// 회사정보(스웨크론/신상훈/인천 남동구/010-6824-7715/popeeplus87@naver.com)는
// Footer 와 동일하게 유지. JoinAgreePage 의 약관 동의 본문과 조항 일관.
//
// ※ 포트폴리오 시연용 약관 — 실제 서비스 운영 시 법무 검토 후 게재해야 함.

import { Link } from 'react-router-dom';
import { colors, typography, spacing, radius } from '../styles/tokens';

// 약관 조항 — 조 제목 + 본문(여러 문단). JoinAgreePage TOS_TEXT 를 정식 페이지로 확장.
const ARTICLES = [
  {
    title: '제1조 (목적)',
    body: [
      '본 약관은 스웨크론(SWACHRON, 이하 "회사")이 운영하는 온라인 쇼핑몰(이하 "사이트")에서 제공하는 인터넷 관련 서비스(이하 "서비스")를 이용함에 있어 회사와 이용자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.',
    ],
  },
  {
    title: '제2조 (용어의 정의)',
    body: [
      '① "회원"이란 본 약관에 동의하고 개인정보를 제공하여 회원등록을 한 자로서, 회사와 이용계약을 체결하고 사이트를 이용하는 이용자를 말합니다.',
      '② "이용자"란 사이트에 접속하여 본 약관에 따라 회사가 제공하는 서비스를 받는 회원 및 비회원을 말합니다.',
      '③ "가입"이란 회사가 제공하는 신청서 양식에 해당 정보를 기입하고 본 약관에 동의하여 서비스 이용계약을 완료시키는 행위를 말합니다.',
    ],
  },
  {
    title: '제3조 (약관의 효력 및 변경)',
    body: [
      '① 본 약관은 사이트를 통해 온라인으로 공시함으로써 효력을 발생합니다.',
      '② 회사는 관련 법령을 위배하지 않는 범위에서 본 약관을 개정할 수 있으며, 변경 사항은 적용일 7일 이전부터 공지합니다. 다만 이용자에게 불리한 변경의 경우 30일 이전부터 공지합니다.',
      '③ 이용자는 변경된 약관에 동의하지 않을 권리가 있으며, 동의하지 않을 경우 서비스 이용을 중단하고 회원 탈퇴를 요청할 수 있습니다.',
    ],
  },
  {
    title: '제4조 (회원가입)',
    body: [
      '① 가입은 이용자의 가입신청에 대한 회사의 승낙으로 성립됩니다.',
      '② 회사는 다음 각 호에 해당하는 가입신청에 대하여 승낙을 거부하거나 사후에 이용계약을 해지할 수 있습니다.',
      '  1. 가입 신청자가 본 약관에 의하여 이전에 회원자격을 상실한 적이 있는 경우',
      '  2. 실명이 아니거나 타인의 명의를 이용한 경우',
      '  3. 허위의 정보를 기재하거나, 회사가 제시하는 내용을 기재하지 않은 경우',
    ],
  },
  {
    title: '제5조 (서비스의 제공 및 변경)',
    body: [
      '① 회사는 회원에게 다음과 같은 서비스를 제공합니다.',
      '  1. 키보드 및 관련 상품 정보 제공 서비스',
      '  2. 상품 구매 및 결제 서비스',
      '  3. 3D 키보드 커스터마이징 및 빌드 저장 서비스',
      '  4. 기타 회사가 회원을 위하여 자체 개발하거나 제휴를 통해 제공하는 일체의 서비스',
      '② 회사는 서비스의 내용 및 제공 일정을 변경할 수 있으며, 변경 시 그 사유와 내용을 사전에 공지합니다.',
    ],
  },
  {
    title: '제6조 (회원의 의무)',
    body: [
      '① 회원은 관계 법령, 본 약관의 규정, 이용안내 및 사이트가 공지하는 사항을 준수하여야 합니다.',
      '② 회원은 자신의 계정 정보를 선량한 관리자의 주의로 관리하여야 하며, 이를 제3자에게 양도·대여할 수 없습니다.',
      '③ 회원은 타인의 정보를 도용하거나 허위 정보를 등록해서는 안 됩니다.',
    ],
  },
  {
    title: '제7조 (청약철회 및 반품·교환)',
    body: [
      '① 회원은 「전자상거래 등에서의 소비자보호에 관한 법률」에 따라 상품 수령 후 7일 이내(단순 변심의 경우 14일 이내) 청약철회를 할 수 있습니다.',
      '② 상품의 불량·오배송 등 회사의 귀책 사유로 인한 반품·교환은 무상으로 처리되며, 단순 변심의 경우 왕복 배송비가 회원 부담으로 발생합니다.',
      '③ 키캡 분리·스위치 교체 등 사용 흔적이 있거나 포장이 훼손된 상품은 반품·교환이 제한될 수 있습니다.',
    ],
  },
  {
    title: '제8조 (면책조항)',
    body: [
      '① 회사는 천재지변, 불가항력, 회원의 귀책 사유로 인한 서비스 이용 장애에 대하여 책임을 지지 않습니다.',
      '② 회사는 회원이 게재한 정보·자료의 신뢰도 및 정확성에 대하여 책임을 지지 않습니다.',
    ],
  },
];

export default function TermsPage() {
  return (
    <div style={S.page}>
      <div style={S.container}>
        <h1 style={S.title}>이용약관</h1>

        <div style={S.notice}>
          본 약관은 포트폴리오 프로젝트 시연용으로 작성되었으며, 실제 서비스 운영 시
          법무 검토를 거쳐 확정·게재될 예정입니다.
        </div>

        {ARTICLES.map((art, i) => (
          <section key={i} style={S.article}>
            <h2 style={S.articleTitle}>{art.title}</h2>
            {art.body.map((para, j) => (
              <p key={j} style={S.para}>{para}</p>
            ))}
          </section>
        ))}

        <div style={S.companyBox}>
          <div style={S.companyTitle}>사업자 정보</div>
          <div style={S.companyLine}>상호: 스웨크론(SWACHRON)</div>
          <div style={S.companyLine}>대표: 신상훈</div>
          <div style={S.companyLine}>주소: (21518) 인천광역시 남동구 백범로248번길 20 (만수동, 영풍아파트) 101동 1404호</div>
          <div style={S.companyLine}>고객센터: 010-6824-7715 / popeeplus87@naver.com</div>
        </div>

        <div style={S.effective}>공고일자: 2026년 5월 31일 · 시행일자: 2026년 5월 31일</div>

        <div style={S.backRow}>
          <Link to="/" style={S.backLink}>← 메인으로</Link>
          <Link to="/privacy" style={S.backLink}>개인정보처리방침 →</Link>
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
  companyBox: {
    background: colors.surface,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.md,
    padding: spacing[5],
    marginTop: spacing[8],
  },
  companyTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.textOnLight,
    marginBottom: spacing[2],
  },
  companyLine: {
    fontSize: typography.fontSize.xs,
    color: colors.textOnLightDim,
    lineHeight: 1.8,
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
