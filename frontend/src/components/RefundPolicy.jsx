import { useState } from 'react';

/**
 * RefundPolicy — 반품·교환 안내 (5-H C7).
 *
 * 정적 콘텐츠 컴포넌트. 백엔드 호출 없음, 마운트 비용 거의 0.
 *
 * 구성:
 *   1. 정책 요약 (반품 기간 / 비용 / 교환 사유 / 불가 사유)
 *   2. FAQ 6개 (펼침 토글)
 *   3. 고객센터 CTA (전화 / 이메일)
 *
 * 면접 포인트:
 *   - 정책/FAQ 데이터를 JSON 배열로 분리 → 추후 DB/CMS 이전 시 fetch 만 추가하면 됨
 *   - FAQ 펼침은 단일 active id 방식 (한 번에 하나만 열림, 아코디언 UX)
 *   - role=region + role=button + aria-expanded a11y
 *   - 고객센터는 tel: / mailto: 링크로 모바일에서 바로 발신/메일 가능
 */

const POLICIES = [
  {
    icon: '📅',
    title: '반품 가능 기간',
    body: '상품 수령 후 7일 이내 신청 가능. 단순 변심은 14일 이내 (전자상거래법 기준).',
  },
  {
    icon: '💰',
    title: '반품 비용',
    body: '단순 변심 → 왕복 배송비 6,000원 고객 부담. 상품 불량/오배송 → 무상.',
  },
  {
    icon: '🔄',
    title: '교환 가능 사유',
    body: '상품 불량, 오배송, 색상/사이즈 오류 시 무상 교환. 동일 상품 재고가 없으면 환불 처리.',
  },
  {
    icon: '⚠️',
    title: '반품·교환 불가',
    body: '사용 흔적 (키캡 분리 / 스위치 교체 등) · 포장 훼손 · 수령 후 7일 경과 시 불가.',
  },
];

const FAQS = [
  {
    q: '키보드를 받았는데 키 1개가 인식되지 않습니다. 교환 가능한가요?',
    a: '네, 상품 불량은 수령 후 7일 이내 무상 교환 가능합니다. 고객센터에 사진과 함께 문의 주시면 즉시 회수 → 검수 → 새 상품 발송 처리됩니다.',
  },
  {
    q: '단순 변심으로 반품하면 비용이 얼마인가요?',
    a: '왕복 배송비 6,000원 (편도 3,000원 × 2) 이 발생합니다. 회수 시 자동으로 환불 금액에서 차감됩니다.',
  },
  {
    q: '커스텀 빌드 / 핫스왑 진행한 상품도 반품 가능한가요?',
    a: '죄송하지만 키캡/스위치 교체 등 사용 흔적이 있는 상품은 반품·교환이 불가합니다. 검수 단계에서 새 제품으로 재판매할 수 없기 때문입니다.',
  },
  {
    q: '환불은 며칠 안에 처리되나요?',
    a: '회수 상품 도착 후 영업일 기준 1~3일 내 검수 완료. 검수 통과 시 결제 수단별로 즉시(카드 취소) 또는 3~5영업일(계좌 환불) 내 환불됩니다.',
  },
  {
    q: '교환 신청 후 새 상품은 언제 받을 수 있나요?',
    a: '회수 → 검수 → 재발송 순으로 평균 5~7영업일 소요됩니다. 동일 모델 재고가 없으면 환불 안내 후 동의 시 환불 처리됩니다.',
  },
  {
    q: '해외 배송 상품도 반품 가능한가요?',
    a: '해외 직배송 상품은 반품 시 국제 배송비 (약 30,000~50,000원) 가 추가 발생합니다. 신청 전 고객센터에 정확한 비용을 확인해주세요.',
  },
];

export default function RefundPolicy() {
  const [openId, setOpenId] = useState(null); // 한 번에 하나만 펼침

  const toggle = (idx) => {
    setOpenId((cur) => (cur === idx ? null : idx));
  };

  return (
    <div style={S.wrap}>
      {/* ─── 정책 요약 (4개 카드) ──────────────────────── */}
      <section style={S.section} aria-labelledby="policy-title">
        <h2 id="policy-title" style={S.h2}>반품·교환 안내</h2>
        <p style={S.subtitle}>
          공정거래위원회 「전자상거래법」 에 따라 운영됩니다.
        </p>
        <div style={S.policyGrid}>
          {POLICIES.map((p, i) => (
            <div key={i} style={S.policyCard}>
              <div style={S.policyIcon} aria-hidden="true">{p.icon}</div>
              <div>
                <h3 style={S.policyTitle}>{p.title}</h3>
                <p style={S.policyBody}>{p.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FAQ (펼침 토글, 한 번에 하나) ──────────────── */}
      <section style={S.section} aria-labelledby="faq-title">
        <h2 id="faq-title" style={S.h2}>자주 묻는 질문</h2>
        <ul style={S.faqList}>
          {FAQS.map((item, idx) => {
            const isOpen = openId === idx;
            return (
              <li key={idx} style={S.faqItem}>
                <button
                  type="button"
                  onClick={() => toggle(idx)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${idx}`}
                  style={{
                    ...S.faqQuestion,
                    background: isOpen ? '#fafafa' : '#fff',
                  }}
                >
                  <span style={S.faqQMark} aria-hidden="true">Q</span>
                  <span style={S.faqQText}>{item.q}</span>
                  <span style={{
                    ...S.faqArrow,
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  }} aria-hidden="true">
                    ⌄
                  </span>
                </button>
                {isOpen && (
                  <div
                    id={`faq-answer-${idx}`}
                    role="region"
                    style={S.faqAnswer}
                  >
                    <span style={S.faqAMark} aria-hidden="true">A</span>
                    <p style={S.faqAText}>{item.a}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* ─── 고객센터 CTA ───────────────────────────────── */}
      <section style={S.csBox} aria-labelledby="cs-title">
        <h2 id="cs-title" style={S.csTitle}>해결되지 않으셨나요?</h2>
        <p style={S.csDesc}>
          고객센터에 문의주시면 영업일 기준 24시간 이내 답변드립니다.
        </p>
        <div style={S.csActions}>
          <a href="tel:1588-0000" style={S.csBtnPrimary}>
            📞 1588-0000
          </a>
          <a href="mailto:support@keyboard-shop.com" style={S.csBtnSecondary}>
            ✉️ 이메일 문의
          </a>
        </div>
        <p style={S.csHours}>
          상담 가능 시간: 평일 09:00 ~ 18:00 (점심 12:00 ~ 13:00 제외)
        </p>
      </section>
    </div>
  );
}

/* ────────────── 스타일 (라이트 테마, ProductDetail 톤 일치) ────────────── */
const S = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 32,
    padding: '8px 0',
  },

  section: { display: 'flex', flexDirection: 'column' },
  h2: {
    fontSize: 18,
    fontWeight: 700,
    color: '#18181b',
    margin: 0,
    letterSpacing: '-0.01em',
  },
  subtitle: {
    fontSize: 13,
    color: '#71717a',
    margin: '6px 0 18px',
  },

  /* 정책 카드 */
  policyGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: 12,
  },
  policyCard: {
    display: 'flex',
    gap: 14,
    padding: '16px 18px',
    background: '#fff',
    border: '1px solid #e4e4e7',
    borderRadius: 10,
  },
  policyIcon: {
    fontSize: 24,
    lineHeight: 1.2,
    flexShrink: 0,
  },
  policyTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#18181b',
    margin: '0 0 6px',
  },
  policyBody: {
    fontSize: 13,
    color: '#52525b',
    lineHeight: 1.6,
    margin: 0,
  },

  /* FAQ */
  faqList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  faqItem: {
    background: '#fff',
    border: '1px solid #e4e4e7',
    borderRadius: 10,
    overflow: 'hidden',
    transition: 'border-color 0.15s ease',
  },
  faqQuestion: {
    width: '100%',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '14px 18px',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
    fontSize: 14,
    transition: 'background 0.15s ease',
  },
  faqQMark: {
    fontWeight: 800,
    color: '#3b6bef',
    fontSize: 14,
    flexShrink: 0,
    width: 18,
    textAlign: 'center',
  },
  faqQText: {
    flex: 1,
    color: '#18181b',
    fontWeight: 500,
    lineHeight: 1.55,
  },
  faqArrow: {
    color: '#a1a1aa',
    fontSize: 18,
    flexShrink: 0,
    transition: 'transform 0.2s ease',
    lineHeight: 1,
    marginTop: 2,
  },
  faqAnswer: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '14px 18px 18px',
    borderTop: '1px dashed #e4e4e7',
    background: '#fafafa',
  },
  faqAMark: {
    fontWeight: 800,
    color: '#10b981',
    fontSize: 14,
    flexShrink: 0,
    width: 18,
    textAlign: 'center',
  },
  faqAText: {
    flex: 1,
    fontSize: 13.5,
    color: '#27272a',
    lineHeight: 1.65,
    margin: 0,
  },

  /* 고객센터 CTA */
  csBox: {
    background: '#f4f4f5',
    border: '1px solid #e4e4e7',
    borderRadius: 12,
    padding: '24px 22px 22px',
    textAlign: 'center',
  },
  csTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#18181b',
    margin: 0,
  },
  csDesc: {
    fontSize: 13,
    color: '#52525b',
    margin: '6px 0 18px',
  },
  csActions: {
    display: 'flex',
    justifyContent: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  csBtnPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '11px 22px',
    background: '#18181b',
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    borderRadius: 8,
    textDecoration: 'none',
    transition: 'all 0.15s ease',
  },
  csBtnSecondary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '11px 22px',
    background: '#fff',
    color: '#18181b',
    fontSize: 14,
    fontWeight: 600,
    border: '1px solid #d4d4d8',
    borderRadius: 8,
    textDecoration: 'none',
    transition: 'all 0.15s ease',
  },
  csHours: {
    fontSize: 12,
    color: '#71717a',
    margin: '14px 0 0',
  },
};
