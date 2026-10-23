# IUX Cloud 설정 안내

여러 고객사 홈페이지의 **문의**와 **게시판**을 한 곳에서 관리하는 백엔드입니다.
한 번만 설정하면, 이후 새 고객사 사이트는 관리자 페이지에서 등록만 하면 됩니다.

```
고객사 홈페이지들 ── 문의 ──▶ inquiry 함수 ──▶ DB 저장 + 담당자 메일 알림 (Resend)
        └──── 게시글 읽기 ──▶ Supabase DB
관리자 페이지 (/admin) ──▶ 문의함 · 게시판 글쓰기 · 사이트/담당자 관리
```

| 준비물 | 용도 | 비용 |
|---|---|---|
| [Supabase](https://supabase.com) 계정 | DB · 로그인 · 이미지 저장 · 문의 함수 | 무료 플랜으로 시작 |
| [Resend](https://resend.com) 계정 | 문의 알림 메일 발송 | 무료 플랜으로 시작 |
| 도메인 (예: iux.studio) | 알림 메일 발신 주소 | 도메인 구입비 |

> 무료 사용량과 요금은 각 서비스 요금 안내에서 최신 내용을 확인하세요.

---

## 1. Supabase 프로젝트 만들기

1. https://supabase.com 가입 → **New project**
2. 이름 `iux-cloud`, 지역 **Northeast Asia (Seoul)**, DB 비밀번호는 따로 보관
3. 생성이 끝나면 **Project Settings → API** 에서 두 값을 메모합니다.
   - **Project URL** (예: `https://abcdefgh.supabase.co`)
   - **anon public** 키 (`eyJ...` 로 시작) — 공개용 키라 홈페이지 코드에 넣어도 됩니다.
   - ⚠️ **service_role** 키는 절대 코드나 채팅에 올리지 마세요.

## 2. 데이터베이스 만들기

**SQL Editor → New query** 에서 아래 파일을 **순서대로 한 번씩** 붙여넣고 **Run** 합니다.

| 순서 | 파일 | 내용 |
|---|---|---|
| 1 | `supabase/migrations/20261023000000_init.sql` | 사이트 · 문의 · 게시판 · 권한 |
| 2 | `supabase/migrations/20261024000000_admin_v2.sql` | 슈퍼 어드민 (방문 통계 · 콘텐츠 · SEO · 도메인/호스팅 · 계정) |
| 3 | `supabase/seed/faq.sql` (선택) | FAQ 게시판 + 추천 질문 |

각각 `Success` 가 나오면 완료입니다.

## 3. 관리자 계정 만들기

1. **Authentication → Users → Add user → Create new user**
   - 이메일 · 비밀번호 입력, **Auto Confirm User** 체크
2. **SQL Editor** 에서 아래를 실행 (이메일만 바꾸세요) — 이 계정을 운영자로 지정합니다.
   ```sql
   insert into admins (user_id) select id from auth.users where email = 'me@example.com';
   ```
3. **Authentication → Sign In / Providers** 에서 **Allow new users to sign up** 을 끕니다.
   (아무나 가입하지 못하게. 계정은 운영자가 직접 만들거나 초대합니다)
4. **Authentication → URL Configuration**
   - **Site URL**: `https://handgoldking1234.github.io/iux-studio/admin/`
   - **Redirect URLs** 에도 같은 주소 추가 (비밀번호 재설정 · 초대 메일 링크용)

## 4. 메일 발송 준비 (Resend)

1. https://resend.com 가입 → **Domains → Add Domain** 에 보유 도메인 입력
2. 안내되는 DNS 레코드(TXT/MX)를 도메인 관리 화면(가비아 등)에 추가 → **Verified** 될 때까지 대기
3. **API Keys → Create API Key** (권한 Sending access) → `re_...` 키 복사

> 도메인 인증 전에는 `onboarding@resend.dev` 로 **Resend 가입 메일 주소로만** 보낼 수 있습니다.
> 고객사 메일로 알림을 보내려면 도메인 인증이 필요합니다.

## 5. 문의 함수 배포

1. Supabase **Edge Functions → Deploy a new function → Via Editor**
2. 함수 이름 **`inquiry`** (정확히 이 이름)
3. 저장소의 `supabase/functions/inquiry/index.ts` 내용을 전부 붙여넣고 **Deploy**
   (코드가 바뀌면 함수 화면 **Code** 탭에서 새 내용으로 바꾸고 다시 **Deploy**)
4. 배포된 함수 상세 화면에서 **Enforce JWT Verification(Verify JWT)** 을 **끕니다**.
   (홈페이지 방문자는 로그인하지 않으므로)
5. **Edge Functions → Secrets** 에 추가
   | 이름 | 값 |
   |---|---|
   | `RESEND_API_KEY` | `re_...` |
   | `MAIL_FROM` | `IUX.STUDIO <noreply@내도메인>` |
   | `ADMIN_EMAILS` | (선택) 모든 사이트 문의를 참조로 받을 운영자 메일, 쉼표 구분 |

## 6. 코드에 연결값 넣기

`admin/config.js`
```js
supabaseUrl: 'https://abcdefgh.supabase.co',
anonKey: 'eyJ...',
```

`js/content.js` (IUX.STUDIO 홈페이지)
```js
cloud: { url: 'https://abcdefgh.supabase.co', anonKey: 'eyJ...', siteId: 'iux-studio' },
```

커밋 · 푸시하면 GitHub Pages 에 반영됩니다.

## 7. 확인

1. `https://handgoldking1234.github.io/iux-studio/admin/` 에서 로그인
2. **사이트 관리 → IUX.STUDIO** 에서 **문의 알림 메일** 입력 · 허용 도메인에 `https://handgoldking1234.github.io` 입력 → 저장
3. 홈페이지에서 견적 문의를 보내보고 → 관리자 **문의함** 과 메일함 확인
4. **게시판 → 글쓰기** 로 공지를 올리고 → 홈페이지 하단 NOTICE · `notice.html` 확인

---

## 새 고객사 사이트 추가하기 (매번)

1. 관리자 **사이트 관리 → + 새 사이트** — 이름, 사이트 ID(예: `bareun-dental`), 알림 메일, 고객사 도메인
   - 등록하면 `공지사항` 게시판이 자동으로 생깁니다. 필요한 게시판을 더 추가하세요.
2. 사이트 상세 하단 **홈페이지 설치 코드** 를 복사해 고객사 홈페이지에 넣고
   문의 폼 제출 시 `IUXCloud.sendInquiry({...})`, 게시판 화면에서 `IUXCloud.listPosts('notice')` 를 호출
   (이 저장소의 `js/main.js`, `js/board.js`, `notice.html` 을 그대로 참고/복사하면 됩니다)
3. (선택) 고객사 담당자에게 관리 권한 주기
   - Supabase **Authentication → Users → Invite user** 로 담당자 이메일 초대
   - 관리자 **사이트 관리 → 담당자 계정** 에 그 이메일 추가
   - 담당자는 초대 메일에서 비밀번호를 정하고 로그인 → 자기 사이트의 문의 · 게시판만 보입니다.

## sendInquiry 에 보낼 수 있는 항목

| 키 | 설명 |
|---|---|
| `kind` | `quote`(견적, 연락처 필수) · `email`(이메일 문의, 제목 필수) · `etc` |
| `name`, `email` | 필수 |
| `phone`, `company`, `subject`, `message`, `ref` | 선택 |
| `types` (배열), `budget`, `schedule` | 견적 문의 선택 항목 |
| `extra` (객체) | 사이트마다 다른 추가 항목. 예) `{ '진료과목': '교정', '희망일': '11/3' }` |

보안 장치: 허용 도메인 검사, 같은 IP 10분 5건 제한, 스팸봇 숨김 필드(`_gotcha`), 입력 길이 제한.

---

## 관리자 화면 안내

| 메뉴 | 하는 일 |
|---|---|
| 전체 현황 | 모든 사이트의 방문자 · 문의 · 이탈률 |
| 사이트 제작 | 새 고객 사이트 만들기, 제작중 → 검수중 → 운영중 단계 관리 |
| 도메인 · 호스팅 | 등록기관 · 만료일 · SSL · 월 비용 기록, 30일 내 만료 알림 |
| 대시보드 · 유입 · 기기 · 이탈 | 홈페이지 방문 통계 (`iux-cloud.js` 가 자동 기록, 쿠키 · 개인정보 없음) |
| 콘텐츠 관리 | 메인 슬라이드 · 포트폴리오 · 회사 정보, 서브 페이지(메뉴), 팝업 → 저장 즉시 홈페이지 반영 |
| SEO 관리 | 페이지별 제목 · 설명 · 공유 이미지, 서치콘솔 · 서치어드바이저 · GA 코드 |
| 문의 관리 | 신규 → 상담중 → 견적 발송 → 계약 / 보류, 메모, CSV |
| 게시판 | 공지사항 · FAQ 글쓰기 (이미지 끌어다 놓기) |
| 사이트 설정 | 알림 메일 · 허용 도메인 · 게시판 · 담당자 계정 · 설치 코드 |
| 고객 어드민 열기 | 고객사 담당자에게 보이는 화면 미리보기 |

고객사 담당자는 로그인하면 자기 사이트의 통계 · 콘텐츠 · SEO · 문의 · 게시판 · 내 서비스(도메인/호스팅 현황, 연장 요청)만 봅니다.

### 알아둘 점
- **검색어**: 네이버 · 구글은 자연 검색어를 사이트에 넘겨주지 않습니다. 서치어드바이저 · 서치콘솔에서 확인하고, 광고 링크에 `utm_term` 을 붙이면 관리자에서 검색어별 유입 · 문의 전환이 집계됩니다.
- **인증 코드 · GA**: 홈페이지에 스크립트로 적용됩니다. 서치콘솔 인증이 안 되면 'HTML 파일 업로드' 방식을 쓰세요.
- **사이트맵 · robots.txt · HTTPS** 항목은 설정값만 저장합니다. 실제 파일은 호스팅에 올려야 합니다.
