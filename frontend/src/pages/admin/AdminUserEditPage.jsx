// frontend/src/pages/admin/AdminUserEditPage.jsx
//
// 회원정보 수정 (V23) — 관리자단 별도 페이지 (/admin/users/:id/edit).
// 사용자단 ProfileEditPage 와 대칭. MUREAM admin/member/edit 참고.
//
// 구성:
//   [계정 정보]  이메일(읽기전용) / 가입경로 / 권한 / 상태 / 가입일 / 최종접속 (읽기전용 표시)
//   [기본 정보]  이름(수정 가능 — 관리자 권한) / 닉네임 / 휴대폰
//   [배송 주소]  우편번호(Daum) + 기본주소 + 상세주소
//   [관리자 메모] 관리자만 보는 내부 메모
//   [비밀번호 강제 재설정] (선택, LOCAL 만) — 현재 비번 불요(관리자 권한)
//
// ★ 중요 설계 (전체 필드 전송):
//   백엔드 updateByAdmin 은 보낸 필드로 프로필 전체를 덮어쓴다(부분 PATCH 아님).
//   일부만 보내면 나머지가 NULL 로 비워지므로, 저장 시 폼의 모든 현재값을
//   항상 함께 전송한다. 그래서 폼 진입 시 getDetail 로 전체를 로드해 초기화.
//
// 범위: 권한(role)·상태(정지/해제)는 여기서 다루지 않음.
//   → 회원 목록(AdminUserPage)의 'ADMIN으로'/'정지' 버튼이 담당. 안내문으로 명시.
//
// 디자인: swagkey 화이트 톤. AdminUserPage / AdminAuditLogPage 와 동일 톤.

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminUserApi } from '../../api/adminUser';
import DaumPostcode from '../../components/DaumPostcode';
import { colors, typography, spacing, radius, shadow } from '../../styles/tokens';

const STATUS_LABEL = { ACTIVE: '정상', SUSPENDED: '정지', WITHDRAWN: '탈퇴' };

export default function AdminUserEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [detail, setDetail] = useState(null);  // 원본 Detail
  const [loadError, setLoadError] = useState('');

  // 폼 필드 (전체 전송용 — 모두 항상 채워서 보냄)
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [zipcode, setZipcode] = useState('');
  const [address, setAddress] = useState('');
  const [addressDetail, setAddressDetail] = useState('');
  const [adminMemo, setAdminMemo] = useState('');
  const [newPassword, setNewPassword] = useState('');  // 비우면 비번 안 바꿈
  const [postOpen, setPostOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const isLocal = detail?.provider === 'LOCAL';
  const isWithdrawn = detail?.status === 'WITHDRAWN';

  useEffect(() => {
    let alive = true;
    adminUserApi.getDetail(id)
      .then((d) => {
        if (!alive) return;
        setDetail(d);
        setName(d.name || '');
        setNickname(d.nickname || '');
        setPhone(d.phone || '');
        setZipcode(d.zipcode || '');
        setAddress(d.address || '');
        setAddressDetail(d.addressDetail || '');
        setAdminMemo(d.adminMemo || '');
      })
      .catch(() => { if (alive) setLoadError('회원 정보를 불러오지 못했습니다.'); });
    return () => { alive = false; };
  }, [id]);

  async function handleSave() {
    setSaving(true);
    setMsg('');
    setErr('');
    try {
      // 전체 필드 전송 (부분 PATCH 아님 — 누락 시 NULL 덮어쓰기 방지)
      const body = {
        name, nickname, phone, zipcode, address, addressDetail, adminMemo,
      };
      // 비번은 입력했을 때만 포함 (빈 값이면 백엔드가 변경 안 함)
      if (newPassword.trim()) body.newPassword = newPassword.trim();

      const updated = await adminUserApi.updateByAdmin(id, body);
      setDetail(updated);
      setNewPassword('');
      setMsg('회원 정보가 저장되었습니다.');
    } catch (e) {
      const status = e?.response?.status;
      const m = e?.response?.data?.message;
      if (status === 400) setErr(m || '입력값을 확인해 주세요.');
      else if (status === 404) setErr('회원을 찾을 수 없습니다.');
      else setErr(m || '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  const fmtDate = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  };

  if (loadError) {
    return (
      <div>
        <div style={S.errorBanner}>{loadError}</div>
        <button onClick={() => navigate('/admin/users')} style={S.secondaryBtn}>회원 목록으로</button>
      </div>
    );
  }
  if (!detail) {
    return <div style={S.notice}>불러오는 중…</div>;
  }

  return (
    <div>
      {/* 헤더 */}
      <div style={S.topbar}>
        <div>
          <h2 style={S.title}>회원 정보 수정</h2>
          <p style={S.desc}>id {detail.id} · {detail.email}</p>
        </div>
        <button onClick={() => navigate('/admin/users')} style={S.secondaryBtn}>← 회원 목록</button>
      </div>

      {/* 탈퇴 회원 경고 */}
      {isWithdrawn && (
        <div style={S.warnBanner}>
          탈퇴한 회원입니다. 정보 수정이 제한됩니다 (저장 시 백엔드에서 차단).
        </div>
      )}

      {/* === 계정 정보 (읽기전용) === */}
      <section style={S.card}>
        <h3 style={S.cardTitle}>계정 정보</h3>
        <div style={S.metaGrid}>
          <div style={S.metaItem}><span style={S.metaLabel}>이메일</span><span style={S.metaValue}>{detail.email}</span></div>
          <div style={S.metaItem}><span style={S.metaLabel}>가입 경로</span><span style={S.metaValue}>{detail.provider}</span></div>
          <div style={S.metaItem}><span style={S.metaLabel}>권한</span><span style={S.metaValue}>{detail.role}</span></div>
          <div style={S.metaItem}><span style={S.metaLabel}>상태</span><span style={S.metaValue}>{STATUS_LABEL[detail.status] ?? detail.status}</span></div>
          <div style={S.metaItem}><span style={S.metaLabel}>가입일</span><span style={S.metaValue}>{fmtDate(detail.createdAt)}</span></div>
          <div style={S.metaItem}><span style={S.metaLabel}>최종 접속</span><span style={S.metaValue}>{fmtDate(detail.lastLoginAt)}</span></div>
        </div>
        <p style={S.hint}>권한·상태(정지/해제)는 회원 목록의 버튼에서 변경합니다. 이 화면에서는 프로필만 수정합니다.</p>
      </section>

      {/* === 기본 정보 === */}
      <section style={S.card}>
        <h3 style={S.cardTitle}>기본 정보</h3>

        <label style={S.label}>이름</label>
        <input value={name} onChange={(e) => setName(e.target.value)}
               placeholder="이름" maxLength={50} style={S.input} disabled={isWithdrawn} />

        <label style={S.label}>닉네임</label>
        <input value={nickname} onChange={(e) => setNickname(e.target.value)}
               placeholder="닉네임 (미설정 시 이름만 표시)" maxLength={50} style={S.input} disabled={isWithdrawn} />

        <label style={S.label}>휴대폰 번호</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)}
               placeholder="010-0000-0000" maxLength={20} style={S.input} disabled={isWithdrawn} />
      </section>

      {/* === 배송 주소 === */}
      <section style={S.card}>
        <h3 style={S.cardTitle}>배송 주소</h3>

        <label style={S.label}>우편번호</label>
        <div style={S.zipRow}>
          <input value={zipcode} readOnly placeholder="우편번호"
                 style={{ ...S.input, ...S.readonly, flex: '0 0 140px' }} />
          <button type="button" onClick={() => setPostOpen(true)} style={S.searchBtn} disabled={isWithdrawn}>
            주소 검색
          </button>
        </div>

        <label style={S.label}>기본 주소</label>
        <input value={address} readOnly placeholder="주소 검색 후 자동 입력"
               style={{ ...S.input, ...S.readonly }} />

        <label style={S.label}>상세 주소</label>
        <input value={addressDetail} onChange={(e) => setAddressDetail(e.target.value)}
               placeholder="동/호수/층 등" maxLength={255} style={S.input} disabled={isWithdrawn} />
      </section>

      {/* === 관리자 메모 === */}
      <section style={S.card}>
        <h3 style={S.cardTitle}>관리자 메모</h3>
        <p style={S.hint}>관리자만 보는 내부 메모입니다. (회원에게 노출되지 않음)</p>
        <textarea value={adminMemo} onChange={(e) => setAdminMemo(e.target.value)}
                  placeholder="예: VIP 고객 / 반복 환불 주의 등" maxLength={500} rows={3}
                  style={S.textarea} disabled={isWithdrawn} />
      </section>

      {/* === 비밀번호 강제 재설정 === */}
      <section style={S.card}>
        <h3 style={S.cardTitle}>비밀번호 강제 재설정</h3>
        {isLocal ? (
          <>
            <p style={S.hint}>
              입력 시에만 변경됩니다 (비워두면 기존 비번 유지). 현재 비번 확인 없이
              관리자 권한으로 재설정합니다. 4자 이상.
            </p>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                   placeholder="새 비밀번호 (비우면 변경 안 함)" style={S.input}
                   autoComplete="new-password" disabled={isWithdrawn} />
          </>
        ) : (
          <p style={S.hint}>카카오(소셜) 계정은 비밀번호가 없어 재설정할 수 없습니다.</p>
        )}
      </section>

      {/* 저장 */}
      {err && <div style={S.errorBanner}>{err}</div>}
      {msg && <div style={S.successBanner}>{msg}</div>}
      <button onClick={handleSave} disabled={saving || isWithdrawn} style={{
        ...S.primaryBtn,
        ...((saving || isWithdrawn) ? S.primaryBtnDisabled : {}),
      }}>
        {saving ? '저장 중…' : '회원 정보 저장'}
      </button>

      {/* Daum 우편번호 */}
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
  topbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[5],
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textOnLight,
    margin: 0,
    marginBottom: spacing[2],
  },
  desc: {
    fontSize: typography.fontSize.sm,
    color: colors.textOnLightDim,
    margin: 0,
    fontFamily: typography.fontFamily.mono,
  },
  card: {
    background: colors.white,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: colors.borderLight,
    borderRadius: radius.lg,
    padding: spacing[6],
    marginBottom: spacing[4],
    boxShadow: shadow.card,
    maxWidth: 640,
  },
  cardTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.textOnLight,
    margin: 0,
    marginBottom: spacing[4],
  },
  metaGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: spacing[3],
  },
  metaItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  metaLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.textOnLightDim,
  },
  metaValue: {
    fontSize: typography.fontSize.sm,
    color: colors.textOnLight,
    fontWeight: typography.fontWeight.medium,
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
  textarea: {
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
    resize: 'vertical',
  },
  readonly: {
    background: colors.surfaceMuted,
    color: colors.textOnLightDim,
    cursor: 'not-allowed',
  },
  hint: {
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
    maxWidth: 640,
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
  primaryBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
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
  errorBanner: {
    background: '#fef2f2',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#fecaca',
    color: '#dc2626',
    borderRadius: radius.md,
    padding: `${spacing[3]} ${spacing[4]}`,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing[4],
    maxWidth: 640,
  },
  successBanner: {
    background: colors.successSoft,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(16,185,129,0.3)',
    color: '#047857',
    borderRadius: radius.md,
    padding: `${spacing[3]} ${spacing[4]}`,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing[4],
    maxWidth: 640,
  },
  warnBanner: {
    background: 'rgba(245, 158, 11, 0.1)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(245, 158, 11, 0.35)',
    color: '#b45309',
    borderRadius: radius.md,
    padding: `${spacing[3]} ${spacing[4]}`,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing[4],
    maxWidth: 640,
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
    maxWidth: 640,
  },
};
