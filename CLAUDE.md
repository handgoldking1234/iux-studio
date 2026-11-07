# IUX.STUDIO + IUX Cloud — 작업 안내서

## 한 줄 요약
홈페이지 제작 스튜디오 IUX.STUDIO의 홈페이지와, 여러 고객사 사이트가 함께 쓰는 문의·게시판·방문 통계 백엔드(IUX Cloud), 슈퍼 관리자.

- 주소: https://studio.iux.kr (관리자 `/admin/`)
- 처음 설정: `docs/SETUP.md`

## 확정된 결정
| 항목 | 결정 |
|---|---|
| 백엔드 | Supabase(`iux-cloud` 프로젝트) + Resend(메일). 다른 서비스(IUX ART, 가계도, 게임 대전)도 이 프로젝트를 같이 씀 → **스키마 변경 시 다른 서비스 영향 확인** |
| 고객사 연동 | 고객사 사이트에 `https://studio.iux.kr/js/iux-cloud.js` 한 줄 → 방문 통계·문의·게시글·콘텐츠 |
| 디자인 | Claude Design 시안(AIOX Lab Site, IUXSTUDIO Admin) 기준 |
| 잠듦 방지 | `.github/workflows/supabase-keepalive.yml` |

## 파일
```
index.html, notice.html, faq.html, board.html, page.html   홈페이지
css/style.css
js/content.js        ★ 홈페이지 텍스트·이미지·연락처·팝업·연결 설정
js/main.js           홈페이지 동작   · js/board*.js 게시판
js/iux-cloud.js      ★ 모든 고객사 사이트에 넣는 공용 스크립트
js/site-content.js   관리자에서 저장한 콘텐츠·SEO 적용
admin/               관리자 (config.js = Supabase URL·anon 키, js/views-*.js 화면별)
supabase/migrations/ DB·RLS·통계 함수 (날짜순으로 SQL Editor에서 실행)
supabase/functions/inquiry, board   문의·게시판 Edge Function (Turnstile 로봇 방지)
supabase/seed/faq.sql
samples/             제작 사례 시안(빅트리소프트·이북·병원 등, 일부 대용량 단일 HTML)
docs/SETUP.md
```

## 자주 하는 수정
- 문구·연락처: `js/content.js`
- DB 변경: `supabase/migrations/`에 **새 날짜 파일**을 추가 (기존 파일 수정 금지) → SQL Editor 실행
- 로컬: `python3 -m http.server 8000` → `/`, `/admin/`

## 브랜치
- `iux-art-app` — IUX ART 연결(사이트 등록 SQL, '운영 앱' 메뉴). **main에 아직 미반영으로 보임**
- `claude/iux-kr-domains` — 도메인 변경, main에 반영된 것으로 보임

---

## 공통 작업 원칙 (IUX 프로젝트 전체)
- **언어:** 화면 문구·문서·커밋 메시지는 한국어. 쉬운 말, 기술 용어 최소화.
- **퍼블리싱 시안:** 순수 HTML/CSS + 간단한 스크립트만 넣는다. 서버·DB 연동 코드는 개발 단계에서 따로 붙인다.
- **아이콘:** Lucide. 디자인 시스템을 따로 정하지 않았으면 스포티파이 스타일(다크/화이트 + 포인트 컬러)을 기본으로 쓴다.
- **배포:** GitHub `main` → Vercel 자동 배포. 도메인은 가비아 `iux.kr`의 서브도메인(`*.iux.kr` CNAME → Vercel)을 쓴다.
- **DB:** Supabase 무료 플랜은 활성 프로젝트 2개까지라, 새 프로젝트를 만들지 말고 기존 `iux-cloud`(studio) 프로젝트에 테이블을 얹는 것을 먼저 검토한다.
- **비밀값:** 공개 저장소다. 서비스 키·AI 키·비밀번호는 절대 커밋하지 않는다. 키는 Vercel 환경 변수나 Supabase secrets에 둔다. Supabase anon(public) 키만 코드에 넣을 수 있다.
- **확인:** 고친 뒤에는 브라우저 콘솔 오류 0개, 모바일(390px)과 PC 화면을 눈으로 확인하고 나서 완료라고 한다.
- **브랜치:** `main`은 배포 중인 상태. 큰 작업이나 검증 전 작업은 브랜치(`wip/…`, `claude/…`)에 올리고, `main`을 강제 푸시(-f)로 덮어쓰지 않는다.
- **전체 프로젝트 목록:** https://github.com/handgoldking1234/iux-app/blob/main/docs/PROJECTS.md
