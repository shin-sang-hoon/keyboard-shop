// frontend/src/pages/ProfileEditPage.jsx
//
// 회원정보 수정 (V23) — 사용자단 별도 페이지 (/mypage/edit). 라이트 톤.
//
// 구성 (MUREAM 회원 수정 화면 참고, 우리 도메인에 맞춰 정제):
//   [기본 정보]  이메일(읽기전용) / 이름(읽기전용) / 닉네임 / 휴대폰
//   [배송 주소]  우편번호(Daum 검색) + 기본주소(자동) + 상세주소(직접)
//   [비밀번호]   LOCAL 계정만 — 현재/새/확인. KAKAO 는 섹션 자체를 숨김(안내).
//
// 저장:
//   - 프로필(닉/휴대폰/주소) 저장 → userApi.updateProfile → applyUser 로 헤더 즉시 갱신.
//   - 비밀번호 변경은 별도 버튼(독립 요청) → userApi.changePassword.
//     (프로필과 분리: 비번은 현재비번 검증이 필요하고 실패 케이스가 달라서 별도 처리)
//
// 보호: App.jsx 에서 ProtectedRoute 로 감쌈 (비로그인 진입 불가).
// 디자인: 닉네임 표시 규칙 안내 — "이름(닉네임)" 형태로 사이트에 노출.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import userApi from '../api/user';
import DaumPostcode from '../components/DaumPostcode';
import { colors, typography, spacing, radius } from '../styles/tokens';

export default function ProfileEditPage() {
  const { applyUser } = useAuth();
  const navigate = useNavigate();

  // 원본 로드
  const [me, setMe] = useState(null);
  const [loadError, setLoadError] = useState('');

  // 프로필 폼
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [zipcode, setZipcode] = useState('');
  const [address, setAddress] = useState('');
  const [addressDetail, setAddressDetail] = useState('');
  const [postOpen, setPostOpen] = useState(false);

  // 프로필 저장 상태
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');

  // 비밀번호 폼 (LOCAL 만)
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');

  const isLocal = me?.provider === 'LOCAL';

  // 초기 로드
  useEffect(() => {
    let alive = true;
    userApi.getMe()
      .then((data) => {
        if (!alive) return;
        setMe(data);
        setNickname(data.nickname || '');
        setPhone(data.phone || '');
        setZipcode(data.zipcode || '');
        setAddress(data.address || '');
        setAddressDetail(data.addressDetail || '');
      })
      .catch(() => { if (alive) setLoadError('내 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'); });
    return () => { alive = false; };
  }, []);

  async function handleSaveProfile() {
    setSavingProfile(true);
    setProfileMsg('');
    setProfileErr('');
    try {
      const updated = await userApi.updateProfile({
        nickname, phone, zipcode, address, addressDetail,
      });
      // 헤더 displayName 즉시 갱신 (이름(닉네임))
      applyUser({ name: updated.name, displayName: updated.displayName });
      setProfileMsg('회원 정보가 저장되었습니다.');
    } catch (err) {
      const msg = err?.response?.data?.message;
      setProfileErr(msg || '저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword() {
    setPwMsg('');
    setPwErr('');
    // 프론트 1차 검증
    if (!curPw) { setPwErr('현재 비밀번호를 입력해 주세요.'); return; }
    if (newPw.length < 4) { setPwErr('새 비밀번호는 4자 이상이어야 합니다.'); return; }
    if (newPw !== newPw2) { setPwErr('새 비밀번호가 일치하지 않습니다.'); return; }

    setSavingPw(true);
    try {
      await userApi.changePassword(curPw, newPw);
      setPwMsg('비밀번호가 변경되었습니다.');
      setCurPw(''); setNewPw(''); setNewPw2('');
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message;
      if (status === 401) setPwErr('현재 비밀번호가 일치하지 않습니다.');
      else if (status === 400) setPwErr(msg && msg.includes('different')
        ? '새 비밀번호가 기존 비밀번호와 같습니다.'
        : (msg && msg.includes('Social')
          ? '소셜 계정은 비밀번호를 변경할 수 없습니다.'
          : '입력값을 확인해 주세요. (새 비밀번호 4자 이상)'));
      else setPwErr(msg || '비밀번호 변경 중 오류가 발생했습니다.');
    } finally {
      setSavingPw(false);
    }
  }

  if (loadError) {
    return (
      <div style={S.page}><div style={S.container}>
        <div style={S.error}>{loadError}</div>
        <button onClick={() => navigate('/mypage')} style={S.secondaryBtn}>마이페이지로</button>
      </div></div>
    );
  }
  if (!me) {
    return <div style={S.page}><div style={S.container}><div style={S.notice}>불러오는 중…</div></div></div>;
  }

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* 상단 */}
        <div style={S.topbar}>
          <div>
            <h1 style={S.h1}>회원 정보 수정</h1>
            <p style={S.sub}>내 정보를 수정합니다. 닉네임을 설정하면 사이트에 “이름(닉네임)” 형태로 표시됩니다.</p>
          </div>
          <button onClick={() => navigate('/mypage')} style={S.secondaryBtn}>마이페이지</button>
        </div>

        {/* === 기본 정보 === */}
        <section style={S.card}>
          <h2 style={S.cardTitle}>기본 정보</h2>

          <label style={S.label}>이메일</label>
          <input value={me.email} readOnly style={{ ...S.input, ...S.readonly }} />

          <label style={S.label}>이름</label>
          <input value={me.name} readOnly style={{ ...S.input, ...S.readonly }} />
          <p style={S.fieldHint}>이름은 변경할 수 없습니다. 표시 이름을 바꾸려면 닉네임을 설정하세요.</p>

          <label style={S.label}>닉네임</label>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="예: 코알라 (미설정 시 이름만 표시)"
            maxLength={50}
            style={S.input}
          />

          <label style={S.label}>휴대폰 번호</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="010-0000-0000"
            maxLength={20}
            style={S.input}
          />
        </section>

        {/* === 배송 주소 === */}
        <section style={S.card}>
          <h2 style={S.cardTitle}>배송 주소</h2>

          <label style={S.label}>우편번호</label>
          <div style={S.zipRow}>
            <input value={zipcode} readOnly placeholder="우편번호" style={{ ...S.input, ...S.readonly, flex: '0 0 140px' }} />
            <button type="button" onClick={() => setPostOpen(true)} style={S.searchBtn}>주소 검색</button>
          </div>

          <label style={S.label}>기본 주소</label>
          <input value={address} readOnly placeholder="주소 검색 후 자동 입력" style={{ ...S.input, ...S.readonly }} />

          <label style={S.label}>상세 주소</label>
          <input
            value={addressDetail}
            onChange={(e) => setAddressDetail(e.target.value)}
            placeholder="동/호수/층 등 상세 주소"
            maxLength={255}
            style={S.input}
          />
        </section>

        {/* 프로필 저장 */}
        {profileErr && <div style={S.error}>{profileErr}</div>}
        {profileMsg && <div style={S.success}>{profileMsg}</div>}
        <button onClick={handleSaveProfile} disabled={savingProfile} style={S.primaryBtn}>
          {savingProfile ? '저장 중…' : '회원 정보 저장'}
        </button>

        {/* === 비밀번호 === */}
        <section style={{ ...S.card, marginTop: spacing[6] }}>
          <h2 style={S.cardTitle}>비밀번호 변경</h2>
          {isLocal ? (
            <>
              <p style={S.fieldHint}>현재 비밀번호 확인 후 변경됩니다. 새 비밀번호는 4자 이상이어야 합니다.</p>

              <label style={S.label}>현재 비밀번호</label>
              <input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)}
                     placeholder="현재 비밀번호" style={S.input} autoComplete="current-password" />

              <label style={S.label}>새 비밀번호</label>
              <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)}
                     placeholder="새 비밀번호 (4자 이상)" style={S.input} autoComplete="new-password" />

              <label style={S.label}>새 비밀번호 확인</label>
              <input type="password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)}
                     placeholder="새 비밀번호 다시 입력" style={S.input} autoComplete="new-password" />

              {pwErr && <div style={S.error}>{pwErr}</div>}
              {pwMsg && <div style={S.success}>{pwMsg}</div>}
              <button onClick={handleChangePassword} disabled={savingPw} style={S.primaryBtn}>
                {savingPw ? '변경 중…' : '비밀번호 변경'}
              </button>
            </>
          ) : (
            <p style={S.fieldHint}>
              카카오 로그인으로 가입한 계정은 비밀번호가 없어 변경할 수 없습니다.
              로그인은 카카오를 통해 진행됩니다.
            </p>
          )}
        </section>
      </div>

      {/* Daum 우편번호 레이어 */}
      <DaumPostcode
        open={postOpen}
        onClose={() => setPostOpen(false)}
        onComplete={({ zipcode: z, address: a }) => {
          setZipcode(z);
          setAddress(a);
          setPostOpen(false);
        }}
      />
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: colors.surface,
    fontFamily: typography.fontFamily.base,
    padding: `${spacing[6]} ${spacing[4]}`,
  },
  container: { maxWidth: 680, margin: '0 auto' },
  topbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[5],
  },
  h1: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textOnLight,
    margin: 0,
  },
  sub: {
    fontSize: typography.fontSize.sm,
    color: colors.textOnLightDim,
    margin: 0,
    marginTop: spacing[2],
  },
  card: {
    background: colors.white,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: colors.borderLight,
    borderRadius: radius.lg,
    padding: spacing[6],
    marginBottom: spacing[4],
    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
  },
  cardTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textOnLight,
    margin: 0,
    marginBottom: spacing[4],
  },
  label: {
    display: 'block',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textOnLight,
    marginTop: spacing[4],
    marginBottom: spacing[2],
  },
  input: {
    display: 'block',
    width: '100%',
    padding: spacing[3],
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    fontSize: typography.fontSize.base,
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    color: colors.textOnLight,
    background: colors.white,
  },
  readonly: {
    background: colors.surfaceMuted,
    color: colors.textOnLightDim,
    cursor: 'not-allowed',
  },
  fieldHint: {
    fontSize: typography.fontSize.xs,
    color: '#94a3b8',
    margin: 0,
    marginTop: spacing[2],
  },
  zipRow: {
    display: 'flex',
    gap: spacing[2],
    alignItems: 'center',
  },
  searchBtn: {
    flex: 1,
    padding: spacing[3],
    background: colors.white,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: colors.textOnLight,
    borderRadius: radius.md,
    color: colors.textOnLight,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  primaryBtn: {
    width: '100%',
    padding: spacing[4],
    background: colors.textOnLight,
    border: 'none',
    borderRadius: radius.md,
    color: colors.white,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginTop: spacing[2],
  },
  secondaryBtn: {
    padding: `${spacing[2]} ${spacing[4]}`,
    background: 'transparent',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    color: colors.textOnLightDim,
    fontSize: typography.fontSize.sm,
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  error: {
    background: '#fef2f2',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#fecaca',
    color: '#dc2626',
    fontSize: typography.fontSize.sm,
    padding: spacing[3],
    borderRadius: radius.md,
    marginBottom: spacing[3],
  },
  success: {
    background: colors.successSoft,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(16,185,129,0.3)',
    color: '#0f766e',
    fontSize: typography.fontSize.sm,
    padding: spacing[3],
    borderRadius: radius.md,
    marginBottom: spacing[3],
  },
  notice: {
    background: colors.white,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: colors.borderLight,
    borderRadius: radius.lg,
    padding: spacing[8],
    textAlign: 'center',
    color: colors.textOnLightDim,
    fontSize: typography.fontSize.sm,
  },
};
