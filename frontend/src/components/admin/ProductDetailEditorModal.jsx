// frontend/src/components/admin/ProductDetailEditorModal.jsx
//
// P3 (5/29) — 관리자 상세정보 편집 모달.
//
// 흐름:
//   1) 열릴 때 GET /api/products/{id} → 기존 description(상대 URL) 로드
//      → prependAssetOrigins 로 표시용 절대화해서 에디터 초기값으로.
//   2) DetailEditor 에서 편집 (이미지 업로드는 에디터가 직접 처리).
//   3) 저장: stripAssetOrigins 로 상대화 → PATCH /api/admin/products/{id}/description
//      → 백엔드가 reconcile (미참조 인라인 이미지 GC).
//
// 백드롭 클릭으로는 닫지 않음 — 편집 중 실수로 내용 날아가는 것 방지 (✕ / 취소만).

import { useEffect, useState } from 'react';
import productsApi from '../../api/products';
import { adminProductApi } from '../../api/adminProduct';
import { prependAssetOrigins, stripAssetOrigins } from '../../utils/assetUrl';
import DetailEditor from './DetailEditor';

export default function ProductDetailEditorModal({ productId, onClose, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [name, setName] = useState('');
  const [initialHtml, setInitialHtml] = useState(''); // 에디터 초기값 (origin prepend 됨)
  const [html, setHtml] = useState('');               // 현재 편집 중 HTML

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await productsApi.detail(productId);
        if (!alive) return;
        setName(data?.name || '');
        const withOrigin = prependAssetOrigins(data?.description || '');
        setInitialHtml(withOrigin);
        setHtml(withOrigin);
      } catch (e) {
        if (alive) setError('상세정보를 불러오지 못했습니다.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [productId]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const canonical = stripAssetOrigins(html); // 저장은 상대 URL (prod 안전)
      await adminProductApi.updateDescription(productId, canonical);
      onSaved?.();
      onClose?.();
    } catch (e) {
      setError(e?.response?.data?.message || '저장에 실패했습니다.');
      setSaving(false);
    }
  }

  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={S.head}>
          <div>
            <h3 style={S.title}>상세정보 편집</h3>
            {name && <p style={S.sub}>{name}</p>}
          </div>
          <button type="button" onClick={onClose} style={S.x} aria-label="닫기">✕</button>
        </div>

        {loading ? (
          <div style={S.loading}>불러오는 중...</div>
        ) : (
          <>
            <p style={S.guide}>
              제목 · 굵게 · 목록 · 이미지를 자유롭게 구성하세요. 본문에서 지운 이미지는 저장 시 자동 정리됩니다.
            </p>
            <DetailEditor productId={productId} value={initialHtml} onChange={setHtml} />
          </>
        )}

        {error && <div style={S.error}>{error}</div>}

        <div style={S.foot}>
          <button type="button" onClick={onClose} disabled={saving} style={S.cancel}>
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            style={{ ...S.save, ...((saving || loading) ? S.saveDisabled : {}) }}
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

const S = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 760,
    maxHeight: '90vh',
    overflowY: 'auto',
    background: '#fff',
    borderRadius: 14,
    padding: 24,
    boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
  },
  head: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: 700, color: '#18181b', margin: 0 },
  sub: { fontSize: 13, color: '#71717a', margin: '4px 0 0' },
  x: {
    width: 32, height: 32, fontSize: 16, color: '#71717a',
    background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 8,
  },
  guide: { fontSize: 12.5, color: '#71717a', margin: '0 0 12px', lineHeight: 1.6 },
  loading: { padding: '48px 0', textAlign: 'center', color: '#a1a1aa', fontSize: 14 },
  error: {
    marginTop: 12, padding: '10px 14px', fontSize: 13,
    color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
  },
  foot: {
    display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20,
  },
  cancel: {
    padding: '10px 18px', fontSize: 14, fontWeight: 500,
    color: '#3f3f46', background: '#fff', border: '1px solid #e4e4e7',
    borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
  },
  save: {
    padding: '10px 22px', fontSize: 14, fontWeight: 600,
    color: '#fff', background: '#18181b', border: '1px solid #18181b',
    borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
  },
  saveDisabled: { opacity: 0.55, cursor: 'not-allowed' },
};
