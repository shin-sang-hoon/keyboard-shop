// frontend/src/components/admin/DetailEditor.jsx
//
// P3 (5/29) — 상품 상세정보 WYSIWYG 에디터 (TipTap v3, headless).
//
// React 19 / Vite 안전:
//   · immediatelyRender: false  — SSR/StrictMode 하이드레이션 경고 차단 (TipTap 권장 플래그).
//   · useEditorState 로 툴바 active 구독 — v3 는 editor 상태가 비반응형이라
//     일반 렌더의 editor.isActive() 는 초기값만 반환(커서 이동 반영 X) → useEditorState 필수.
//
// 인라인 이미지: 툴바 버튼 → 숨김 file input → adminProductApi.uploadDetailImage(productId,file)
//   → 반환 URL(상대) 을 assetUrl() 로 표시용 절대화해서 에디터에 삽입.
//   저장 시 모달이 stripAssetOrigins 로 다시 상대화 → DB 에는 상대 URL 보관 (prod 안전).
//
// 출력: onChange(editor.getHTML()).

import { useRef } from 'react';
import { useEditor, EditorContent, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { adminProductApi } from '../../api/adminProduct';
import { assetUrl } from '../../utils/assetUrl';

// .ProseMirror 콘텐츠 스타일 1회 주입 (ProductDetail.jsx style 주입 패턴 동일)
if (typeof document !== 'undefined' && !document.getElementById('swk-dte-style')) {
  const el = document.createElement('style');
  el.id = 'swk-dte-style';
  el.textContent = `
    .swk-dte .ProseMirror { min-height: 320px; padding: 16px; outline: none; font-size: 14px; line-height: 1.7; color: #18181b; }
    .swk-dte .ProseMirror p { margin: 0 0 12px; }
    .swk-dte .ProseMirror h2 { font-size: 22px; font-weight: 800; margin: 20px 0 12px; line-height: 1.3; }
    .swk-dte .ProseMirror h3 { font-size: 18px; font-weight: 700; margin: 18px 0 10px; line-height: 1.35; }
    .swk-dte .ProseMirror ul, .swk-dte .ProseMirror ol { margin: 0 0 12px; padding-left: 22px; }
    .swk-dte .ProseMirror li { margin: 4px 0; }
    .swk-dte .ProseMirror img { max-width: 100%; height: auto; border-radius: 8px; margin: 8px 0; display: block; }
    .swk-dte .ProseMirror strong { font-weight: 700; }
  `;
  document.head.appendChild(el);
}

const EMPTY_STATE = { h2: false, h3: false, bold: false, italic: false, bullet: false, ordered: false };

export default function DetailEditor({ productId, value, onChange }) {
  const fileInputRef = useRef(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false }),
    ],
    content: value || '',
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
  });

  // v3: 툴바 active 는 useEditorState 로 구독해야 커서 이동에 반응 (비반응형 회피)
  const state = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor) return EMPTY_STATE;
      return {
        h2: editor.isActive('heading', { level: 2 }),
        h3: editor.isActive('heading', { level: 3 }),
        bold: editor.isActive('bold'),
        italic: editor.isActive('italic'),
        bullet: editor.isActive('bulletList'),
        ordered: editor.isActive('orderedList'),
      };
    },
  }) || EMPTY_STATE;

  if (!editor) return null;

  async function handlePick(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일 재선택 허용
    if (!file) return;
    try {
      const { url } = await adminProductApi.uploadDetailImage(productId, file);
      editor.chain().focus().setImage({ src: assetUrl(url) }).run();
    } catch (err) {
      alert(err?.response?.data?.message || '이미지 업로드에 실패했습니다.');
    }
  }

  // onMouseDown preventDefault — 툴바 클릭 시 에디터 선택영역 유지 (rich-text 툴바 정석)
  const Btn = ({ active, onClick, title, children }) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      style={{ ...S.btn, ...(active ? S.btnActive : {}) }}
    >
      {children}
    </button>
  );

  return (
    <div className="swk-dte" style={S.wrap}>
      <div style={S.toolbar}>
        <Btn title="제목 2" active={state.h2}
             onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</Btn>
        <Btn title="제목 3" active={state.h3}
             onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</Btn>
        <span style={S.sep} />
        <Btn title="굵게" active={state.bold}
             onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></Btn>
        <Btn title="기울임" active={state.italic}
             onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></Btn>
        <span style={S.sep} />
        <Btn title="글머리 목록" active={state.bullet}
             onClick={() => editor.chain().focus().toggleBulletList().run()}>• 목록</Btn>
        <Btn title="번호 목록" active={state.ordered}
             onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. 목록</Btn>
        <span style={S.sep} />
        <Btn title="이미지 삽입" onClick={() => fileInputRef.current?.click()}>🖼 이미지</Btn>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          onChange={handlePick}
          style={{ display: 'none' }}
        />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

const S = {
  wrap: { border: '1px solid #e4e4e7', borderRadius: 10, overflow: 'hidden', background: '#fff' },
  toolbar: {
    display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap',
    padding: '8px 10px', borderBottom: '1px solid #e4e4e7', background: '#fafafa',
  },
  btn: {
    minWidth: 32, height: 30, padding: '0 8px', fontSize: 13, color: '#3f3f46',
    background: '#fff', border: '1px solid #e4e4e7', borderRadius: 6,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  btnActive: { color: '#fff', background: '#18181b', borderColor: '#18181b' },
  sep: { width: 1, height: 18, background: '#e4e4e7', margin: '0 2px' },
};
