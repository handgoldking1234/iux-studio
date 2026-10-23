# IUX.STUDIO 홈페이지 + IUX Cloud

- **홈페이지**: Claude Design 시안(`AIOX Lab Site`)을 구현한 정적 사이트 (GitHub Pages)
- **IUX Cloud**: 여러 고객사 홈페이지가 함께 쓰는 문의 · 게시판 백엔드 (Supabase + Resend)
- **관리자 페이지**: `/admin` — Claude Design 'IUXSTUDIO Admin' 시안 기준 슈퍼 어드민 (전체 현황 · 사이트 제작 · 도메인/호스팅 · 방문 통계 · 콘텐츠 · SEO · 문의 · 게시판 · 계정)

👉 처음 설정은 [docs/SETUP.md](docs/SETUP.md) 를 따라 하세요.

## 구조
```
index.html            홈페이지
notice.html           공지사항 게시판 (목록 · 검색 · 상세)
faq.html              자주 묻는 질문 (펼침형)
page.html             서브 페이지 (관리자 '콘텐츠 관리 > 서브 페이지')
css/style.css         홈페이지 스타일
js/content.js         ★ 홈페이지 텍스트 · 이미지 · 연락처 · 팝업 · 연결 설정
js/main.js            홈페이지 동작 (슬라이더, 메뉴, 포트폴리오, 문의 모달, 팝업)
js/board.js           게시판 페이지 동작
js/iux-cloud.js       ★ 모든 고객사 사이트에 넣는 공용 스크립트 (방문 통계 · 문의 · 게시글 · 콘텐츠)
js/site-content.js    관리자에서 저장한 콘텐츠 · SEO 를 홈페이지에 적용
admin/                관리자 페이지 (config.js 연결값, js/ 화면별 코드)
supabase/migrations/  DB 테이블 · 권한(RLS) · 통계 함수 — SQL Editor 에서 순서대로 실행
supabase/functions/inquiry/  문의 수신 함수 (저장 + 메일 알림 + 스팸/도배 방지)
supabase/seed/faq.sql FAQ 게시판 + 추천 질문 12개 (SQL Editor 에서 실행, 기존 FAQ 는 교체됨)
docs/SETUP.md         설정 안내
```

## 로컬 미리보기
```
python3 -m http.server 8000   # http://localhost:8000, 관리자: /admin/
```

## 콘텐츠 수정 (js/content.js)
- `company` : 대표번호, 이메일, 주소, 사업자번호
- `cloud` : IUX Cloud 연결값 (설정하면 문의가 관리자 문의함으로, 공지가 홈페이지에 표시)
- `hero.slides`, `works`, `popups` : 메인 슬라이드 · 포트폴리오 · 공지 팝업

## 문의 전송 우선순위
1. `cloud` 설정됨 → IUX Cloud 문의함 + 담당자 메일
2. `web3formsKey` → Web3Forms
3. `formEndpoint` → Formspree 등
4. 모두 비어 있음 → 메일 앱(mailto)
