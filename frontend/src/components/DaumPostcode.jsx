// frontend/src/components/DaumPostcode.jsx
//
// 회원정보 수정 (V23) — Daum(카카오) 우편번호 검색 공통 컴포넌트.
//
// 사용자단(ProfileEditPage) + 관리자단(AdminUserEditPage) 양쪽 재사용.
//
// 동작:
//   - "주소 검색" 버튼 클릭 → Daum 우편번호 스크립트를 1회 동적 로드 후 팝업(레이어) 오픈.
//   - 사용자가 주소 선택 → onComplete({ zipcode, address }) 콜백 호출.
//     · zipcode = 우편번호 (예: "21999")
//     · address = 도로명 우선, 없으면 지번. 참고항목(건물명 등) 괄호로 부가.
//   - 상세주소는 부모가 별도 input 으로 받음 (이 컴포넌트는 우편번호+기본주소만 책임).
//
// 무료/무키: Daum 우편번호 서비스는 API 키가 필요 없음 (스크립트 임베드만).
//   스크립트: https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js
//
// 디자인: 레이어 방식(모달 내부에 임베드 가능)이 아니라 embed 컨테이너에 띄움.
//   여기서는 간단히 새 팝업(oncomplete) 대신 화면 중앙 레이어로 처리.

import { useEffect, useRef, useState } from 'react';
import { colors, typography, spacing, radius, zIndex } from '../styles/tokens';

const SCRIPT_SRC = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
const SCRIPT_ID = 'daum-postcode-script';

// 스크립트 1회 로드 (중복 삽입 방지). Promise 로 로드 완료 보장.
function loadPostcodeScript() {
  return new Promise((resolve, reject) => {
    // 이미 로드됨
    if (window.daum && window.daum.Postcode) {
      resolve();
      return;
    }
    // 이미 삽입 중인 태그가 있으면 onload 대기
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('우편번호 스크립트 로드 실패')));
      return;
    }
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('우편번호 스크립트 로드 실패'));
    document.head.appendChild(script);
  });
}

/**
 * @param {(result: {zipcode: string, address: string}) => void} onComplete
 * @param {() => void} [onClose]  레이어 닫힘 시
 * @param {boolean} open  레이어 표시 여부 (부모가 제어)
 */
export default function DaumPostcode({ open, onComplete, onClose }) {
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    setError('');
    setLoading(true);
    loadPostcodeScript()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        setLoading(false);
        // 컨테이너 비우고 임베드
        containerRef.current.innerHTML = '';
        new window.daum.Postcode({
          oncomplete: (data) => {
            // 도로명 주소 우선, 없으면 지번
            const addr = data.userSelectedType === 'R'
              ? data.roadAddress
              : (data.jibunAddress || data.autoJibunAddress || data.roadAddress);
            // 참고항목(건물명/동) — 도로명일 때만 부가
            let extra = '';
            if (data.userSelectedType === 'R') {
              const parts = [];
              if (data.bname && /[동|로|가]$/g.test(data.bname)) parts.push(data.bname);
              if (data.buildingName && data.apartment === 'Y') parts.push(data.buildingName);
              if (parts.length > 0) extra = ` (${parts.join(', ')})`;
            }
            onComplete({ zipcode: data.zonecode, address: addr + extra });
          },
          width: '100%',
          height: '100%',
        }).embed(containerRef.current);
      })
      .catch((e) => {
        if (cancelled) return;
        setLoading(false);
        setError(e.message || '우편번호 서비스를 불러오지 못했습니다.');
      });

    return () => { cancelled = true; };
  }, [open, onComplete]);

  if (!open) return null;

  return (
    <div style={S.backdrop} onClick={onClose}>
      <div style={S.panel} onClick={(e) => e.stopPropagation()}>
        <div style={S.head}>
          <span style={S.title}>주소 검색</span>
          <button type="button" onClick={onClose} style={S.closeBtn} aria-label="닫기">×</button>
        </div>
        {loading && <div style={S.notice}>우편번호 서비스를 불러오는 중…</div>}
        {error && <div style={S.error}>{error}</div>}
        <div ref={containerRef} style={S.embed} />
      </div>
    </div>
  );
}

const S = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[4],
    zIndex: zIndex.modal,
  },
  panel: {
    background: colors.white,
    borderRadius: radius.lg,
    width: '100%',
    maxWidth: 480,
    height: 520,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
  },
  head: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${spacing[3]} ${spacing[4]}`,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderLight,
  },
  title: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.textOnLight,
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    fontSize: 24,
    lineHeight: 1,
    color: colors.textOnLightDim,
    cursor: 'pointer',
    padding: 0,
    width: 32,
    height: 32,
  },
  notice: {
    padding: spacing[4],
    fontSize: typography.fontSize.sm,
    color: colors.textOnLightDim,
  },
  error: {
    margin: spacing[4],
    padding: spacing[3],
    background: '#fef2f2',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#fecaca',
    borderRadius: radius.md,
    color: '#dc2626',
    fontSize: typography.fontSize.sm,
  },
  embed: {
    flex: 1,
    width: '100%',
  },
};
