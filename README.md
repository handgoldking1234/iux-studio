# IUX.STUDIO 홈페이지 + IUX Cloud

- **홈페이지**: Claude Design 시안(`AIOX Lab Site`)을 구현한 정적 사이트 (GitHub Pages)
- **IUX Cloud**: 여러 고객사 홈페이지가 함께 쓰는 문의 · 게시판 백엔드 (Supabase + Resend)
- **관리자 페이지**: `/admin` — 문의함, 게시판 글쓰기, 사이트 · 담당자 관리

👉 처음 설정은 [docs/SETUP.md](docs/SETUP.md) 를 따라 하세요.

## 구조
```
index.html            홈페이지
notice.html           공지사항 게시판 (목록 · 검색 · 상세)
css/style.css         홈페이지 스타일
js/content.js         ★ 홈페이지 텍스트 · 이미지 · 연락처 · 팝업 · 연결 설정
js/main.js            홈페이지 동작 (슬라이더, 메뉴, 포트폴리오, 문의 모달, 팝업)
js/board.js           게시판 페이지 동작
js/iux-cloud.js       ★ 모든 고객사 사이트에 넣는 공용 스크립트 (문의 보내기 · 게시글 읽기)
admin/                관리자 페이지 (config.js 에 연결값)
supabase/migrations/  DB 테이블 · 권한(RLS) — SQL Editor 에서 실행
supabase/functions/inquiry/  문의 수신 함수 (저장 + 메일 알림 + 스팸/도배 방지)
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
