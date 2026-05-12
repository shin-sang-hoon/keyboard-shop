// frontend/src/data/notices.js
// 공지사항 더미 데이터 - HomePage NoticeBoard 와 NoticeDetailPage 양쪽에서 공유.
//
// Phase 7 에서 Notice CRUD API 연동 시 이 파일은 제거 또는 fallback 으로 전환.
// 지금은 시연용 정적 더미 데이터.

const NOTICE_TITLES = [
  '5-B 인증 페이지 + 헤더 라운드 3-P 오픈 안내',
  '5-J 카테고리 재편 (KEYBOARD 104 / KEYCAP 93 / SWITCH_PART 1 / ACCESSORY 24)',
  'Redis @Cacheable PageImpl 직렬화 fix 안내',
  '키크론 16종 · swagkey 114종 메인 페이지 노출',
  'Keychron GLB 542개 STEP→GLB 변환 완료',
  'swagkey 데이터 품질 V3 SQL 263 INACTIVE / 114 ACTIVE 분류',
  'ProductDetail v2 디자인 결정 (단일 이미지 + 스펙 칩 + ♥좋아요/⭐찜 분리)',
  'KeyboardBuilder 새 창 모드 오픈 (/builder/:id)',
  '5-H 도메인 확장 — ProductImage / Review / QnA 엔티티 추가',
  '리뷰 / Q&A 별점 분포 차트 적용',
  'KoBERT 챗봇 PoC 진행 안내',
  '결제 / 배송 정책 업데이트',
  '신규 회원 가입 시 즉시 로그인 처리',
  '입고 알림 신청 기능 추가',
  '커스텀 빌드 서비스 베타 오픈',
  'CS 운영 시간 변경 안내 (AM 9 - PM 6)',
  '브랜드 입점 문의 채널 안내',
  '도메인 정보 안내',
  '쿠키 정책 업데이트',
  '서비스 정기 점검 안내 (매주 화요일 03:00)',
];

const TOTAL_NOTICES = 52;
const BASE_DATE = new Date('2026-05-09');

function generateContent(notice) {
  return `안녕하세요, 스웨크론(SWACHRON) 운영팀입니다.

${notice.title} 관련하여 안내 드립니다.

본 공지는 포트폴리오 시연용 더미 게시글입니다.
실제 운영 환경에서는 관리자 페이지에서 작성된 본문이 이 자리에 표시됩니다.

진행 내용 요약:
- 발행일: ${notice.date}
- 카테고리: 공지사항
- 조회수: ${notice.viewCount}

문의 사항은 Help Center(popeeplus87@gmail.com) 으로 연락 부탁드립니다.

감사합니다.`;
}

function generateNotices() {
  const list = [];
  for (let i = 0; i < TOTAL_NOTICES; i++) {
    const id = TOTAL_NOTICES - i;
    const title = NOTICE_TITLES[i % NOTICE_TITLES.length];
    const date = new Date(BASE_DATE);
    date.setDate(date.getDate() - i * 2);
    const dateStr = date.toISOString().split('T')[0];
    // 조회수: 최신글일수록 적게, 오래된 글이 더 많이 본 패턴 (실제 트래픽 흉내)
    const viewCount = 100 + ((i * 73) % 2900);
    const notice = { id, title, date: dateStr, isNew: i < 2, viewCount };
    notice.content = generateContent(notice);
    list.push(notice);
  }
  return list;
}

export const ALL_NOTICES = generateNotices();

export function findNoticeById(id) {
  const numId = Number(id);
  return ALL_NOTICES.find((n) => n.id === numId) || null;
}

export function findAdjacent(id) {
  const numId = Number(id);
  const idx = ALL_NOTICES.findIndex((n) => n.id === numId);
  if (idx === -1) return { prev: null, next: null };
  return {
    // 목록은 최신이 위 (id 큰 것) → "이전 글" = 위쪽 (더 최신, idx-1) / "다음 글" = 아래쪽 (더 오래된, idx+1)
    prev: ALL_NOTICES[idx - 1] || null,
    next: ALL_NOTICES[idx + 1] || null,
  };
}
