// frontend/src/pages/JoinAgreePage.jsx
//
// 5-B Round 3 (2026-05-13) - 스웨그키 가입 2단계 약관 동의 복제.
//
// 동작:
//   - 전체 동의 체크박스 (필수 3 + 선택 2 일괄 토글)
//   - 필수 3종: 이용약관, 개인정보 수집/이용, 만 14세 이상
//   - 선택 2종: SMS 수신, E-Mail 수신
//   - 필수 3종 모두 체크되어야 [가입하기] 활성화
//   - 가입하기 → /signup 으로 동의 상태를 location.state 로 전달
//
// 면접 자산:
//   - 전체동의 ↔ 개별 동의 양방향 동기화 (controlled checkbox 패턴).
//   - location.state 로 동의 정보 전달, 새로고침 시 step1 으로 가드 리다이렉트
//     (PII 가 store/sessionStorage 에 영구 잔존 안 함, 보안 측면).
//   - 선택 동의는 마케팅 정보 수신 기록용 (Phase 8 user marketing prefs 컬럼 확장 예정).

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, typography, spacing, radius } from '../styles/tokens';

// 약관 본문 - 스웨그키 화면 참고. 사이트명만 우리 것으로.
const TOS_TEXT = `제1조 (목적)

본 이용약관은 "스웨크론"(이하 "사이트")의 서비스의 이용조건과 운영에 관한 제반 사항 규정을 목적으로 합니다.

제2조 (용어의 정의)

본 약관에서 사용되는 주요한 용어의 정의는 다음과 같습니다.

① 회원 : 사이트의 약관에 동의하고 개인정보를 제공하여 회원등록을 한 자로서, 사이트와의 이용계약을 체결하고 사이트를 이용하는 이용자를 말합니다.

② 이용자 : 사이트에 접속하여 본 약관에 따라 사이트가 제공하는 서비스를 받는 회원 및 비회원을 말합니다.

③ 가입 : 사이트가 제공하는 신청서 양식에 해당 정보를 기입하고, 본 약관에 동의하여 서비스 이용계약을 완료시키는 행위를 말합니다.

제3조 (약관의 효력 및 변경)

① 본 약관은 사이트를 통해 온라인으로 공시함으로써 효력을 발생합니다.
② 사이트는 필요한 경우 관련 법령을 위배하지 않는 범위에서 본 약관을 개정할 수 있으며, 변경 사항은 변경 전 7일 이전부터 공지합니다.
③ 이용자는 변경된 약관에 동의하지 않을 권리가 있으며, 변경된 약관에 동의하지 않을 경우 서비스 이용을 중단하고 회원 탈퇴를 요청할 수 있습니다.

제4조 (회원가입)

① 가입은 이용자의 가입신청에 대한 사이트의 승낙으로 성립됩니다.
② 사이트는 다음 각호에 해당하는 가입신청에 대하여는 승낙을 거부할 수 있습니다.
   1. 가입 신청자가 본 약관에 의하여 이전에 회원자격을 상실한 적이 있는 경우
   2. 실명이 아니거나 타인의 명의를 이용한 경우
   3. 허위의 정보를 기재하거나, 사이트가 제시하는 내용을 기재하지 않은 경우

제5조 (서비스의 제공 및 변경)

① 사이트는 회원에게 아래와 같은 서비스를 제공합니다.
   1. 키보드 및 관련 상품 정보 제공 서비스
   2. 상품 구매 및 결제 서비스
   3. 기타 사이트가 회원을 위하여 자체 개발하거나 다른 회사와의 협력 계약 등을 통해 회원들에게 제공하는 일체의 서비스`;

const PRIVACY_TEXT = `1. 개인정보의 수집 및 이용 목적

(1) 회원 관리
회원제 서비스 이용, 개인식별, 불량회원의 부정 이용방지와 비인가 사용방지, 가입의사 확인, 분쟁 조정을 위한 기록보존, 불만 처리 등 민원 처리, 고지사항 전달

(2) 서비스 제공에 관한 계약 이행 및 서비스 제공에 따른 요금 정산
컨텐츠 제공, 구매 및 요금 결제, 물품 배송 또는 청구지 등 발송

(3) 고충 처리
민원인의 신원 확인, 민원사항 확인, 사실조사를 위한 연락·통지, 처리 결과 통보 등

2. 수집하는 개인정보 항목

ID, 성명, 비밀번호, 주소, 휴대폰 번호, 이메일, 14세 미만 가입자의 경우 법정대리인 정보

3. 개인정보 보유 및 이용기간

회원탈퇴 시까지 (단, 관계 법령에 보존 근거가 있는 경우 해당 기간 시까지 보유, 개인정보처리방침에서 확인 가능)

4. 개인정보 제3자 제공

원칙적으로 회원의 개인정보를 외부에 제공하지 않습니다. 다만, 다음의 경우에는 예외로 합니다.
- 회원이 사전에 동의한 경우
- 법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우`;

const MARKETING_TEXT = `서비스와 관련된 신상품 소식, 이벤트 안내, 고객 혜택 등 다양한 정보를 제공합니다.`;

export default function JoinAgreePage() {
  const navigate = useNavigate();

  const [tos, setTos] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [marketingSms, setMarketingSms] = useState(false);
  const [marketingEmail, setMarketingEmail] = useState(false);
  const [age14, setAge14] = useState(false);

  // 전체 동의 상태 = 5개 모두 체크 여부 (파생)
  const allAgreed = tos && privacy && marketingSms && marketingEmail && age14;

  // 필수 3종 통과 = 가입하기 활성화 조건
  const canProceed = useMemo(
    () => tos && privacy && age14,
    [tos, privacy, age14]
  );

  function handleToggleAll(e) {
    const v = e.target.checked;
    setTos(v);
    setPrivacy(v);
    setMarketingSms(v);
    setMarketingEmail(v);
    setAge14(v);
  }

  function handleCancel() {
    navigate('/signup/type', { replace: true });
  }

  function handleProceed() {
    if (!canProceed) return;
    // location.state 로 동의 정보 전달.
    // 새로고침 시 사라지므로 SignupPage 에서 가드 → /signup/type 리다이렉트.
    navigate('/signup', {
      state: {
        agreedAt: Date.now(),
        marketing: { sms: marketingSms, email: marketingEmail },
      },
    });
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <h1 style={S.title}>약관 동의</h1>
        <p style={S.subtitle}>서비스 이용을 위한 약관에 동의해주세요</p>

        {/* 전체 동의 */}
        <label style={S.allAgreeRow}>
          <input
            type="checkbox"
            checked={allAgreed}
            onChange={handleToggleAll}
            style={S.checkbox}
          />
          <span style={S.allAgreeText}>
            이용약관, 개인정보 수집 및 이용에 모두 동의합니다.
          </span>
        </label>

        <div style={S.separator} />

        {/* 이용약관 (필수) */}
        <label style={S.agreeRow}>
          <input
            type="checkbox"
            checked={tos}
            onChange={(e) => setTos(e.target.checked)}
            style={S.checkbox}
          />
          <span style={S.agreeText}>
            이용약관 동의 <span style={S.required}>(필수)</span>
          </span>
        </label>
        <textarea
          readOnly
          value={TOS_TEXT}
          style={S.termsBox}
        />

        {/* 개인정보 수집 (필수) */}
        <label style={S.agreeRow}>
          <input
            type="checkbox"
            checked={privacy}
            onChange={(e) => setPrivacy(e.target.checked)}
            style={S.checkbox}
          />
          <span style={S.agreeText}>
            개인정보 수집 및 이용 동의 <span style={S.required}>(필수)</span>
          </span>
        </label>
        <textarea
          readOnly
          value={PRIVACY_TEXT}
          style={S.termsBox}
        />

        {/* 마케팅 활용 동의 섹션 */}
        <div style={S.marketingHeader}>마케팅 활용 동의 및 광고 수신 동의</div>
        <textarea
          readOnly
          value={MARKETING_TEXT}
          style={S.marketingBox}
        />

        <label style={S.agreeRow}>
          <input
            type="checkbox"
            checked={marketingSms}
            onChange={(e) => setMarketingSms(e.target.checked)}
            style={S.checkbox}
          />
          <span style={S.agreeText}>
            메시지(SMS, 카카오톡 등) 수신 동의 <span style={S.optional}>(선택)</span>
          </span>
        </label>

        <label style={S.agreeRow}>
          <input
            type="checkbox"
            checked={marketingEmail}
            onChange={(e) => setMarketingEmail(e.target.checked)}
            style={S.checkbox}
          />
          <span style={S.agreeText}>
            E-Mail 수신 동의 <span style={S.optional}>(선택)</span>
          </span>
        </label>

        <div style={S.separator} />

        {/* 만 14세 이상 (필수) */}
        <label style={S.agreeRow}>
          <input
            type="checkbox"
            checked={age14}
            onChange={(e) => setAge14(e.target.checked)}
            style={S.checkbox}
          />
          <span style={S.agreeText}>
            만 14세 이상입니다. <span style={S.required}>(필수)</span>
          </span>
        </label>

        {/* 하단 버튼 */}
        <div style={S.btnRow}>
          <button
            type="button"
            onClick={handleCancel}
            style={S.cancelBtn}
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleProceed}
            disabled={!canProceed}
            style={{
              ...S.proceedBtn,
              ...(!canProceed ? S.btnDisabled : {}),
            }}
          >
            가입하기
          </button>
        </div>
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: `${spacing[10]} ${spacing[4]}`,
    background: colors.surface,
    fontFamily: typography.fontFamily.base,
  },
  card: {
    width: '100%',
    maxWidth: 720,
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
  allAgreeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    background: colors.surface,
    borderRadius: radius.md,
    cursor: 'pointer',
    marginBottom: spacing[4],
  },
  allAgreeText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textOnLight,
  },
  agreeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[3],
    padding: `${spacing[3]} 0`,
    cursor: 'pointer',
  },
  agreeText: {
    fontSize: typography.fontSize.sm,
    color: colors.textOnLight,
  },
  required: {
    color: '#dc2626',
    fontSize: typography.fontSize.sm,
    marginLeft: spacing[1],
  },
  optional: {
    color: '#94a3b8',
    fontSize: typography.fontSize.sm,
    marginLeft: spacing[1],
  },
  checkbox: {
    width: 18,
    height: 18,
    cursor: 'pointer',
    accentColor: colors.textOnLight,
  },
  termsBox: {
    width: '100%',
    height: 180,
    padding: spacing[3],
    fontSize: typography.fontSize.xs,
    background: colors.surface,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.md,
    color: colors.textOnLightDim,
    fontFamily: 'inherit',
    resize: 'vertical',
    boxSizing: 'border-box',
    marginBottom: spacing[4],
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
  },
  marketingHeader: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textOnLight,
    marginTop: spacing[4],
    marginBottom: spacing[2],
  },
  marketingBox: {
    width: '100%',
    height: 100,
    padding: spacing[3],
    fontSize: typography.fontSize.xs,
    background: colors.surface,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.md,
    color: colors.textOnLightDim,
    fontFamily: 'inherit',
    resize: 'vertical',
    boxSizing: 'border-box',
    marginBottom: spacing[2],
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
  },
  separator: {
    height: 1,
    background: colors.borderLight,
    margin: `${spacing[5]} 0`,
  },
  btnRow: {
    display: 'flex',
    gap: spacing[3],
    marginTop: spacing[8],
  },
  cancelBtn: {
    flex: 1,
    padding: `${spacing[4]} ${spacing[4]}`,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    background: colors.white,
    color: colors.textOnLight,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.md,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  proceedBtn: {
    flex: 2,
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
  btnDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
};
