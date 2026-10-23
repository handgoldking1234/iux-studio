# IUX.STUDIO 홈페이지

Claude Design 시안(`AIOX Lab Site.dc.html`)을 빌드 도구 없이 바로 배포할 수 있는 정적 사이트(HTML/CSS/JS)로 구현했습니다.

## 구조
```
index.html        페이지 마크업
css/style.css     스타일 (반응형, 다크 테마)
js/content.js     ★ 텍스트·이미지·연락처·팝업·포트폴리오 데이터 (여기만 수정)
js/main.js        동작 (히어로 슬라이더, 메뉴, 포트폴리오 필터, 문의 모달, 팝업)
assets/img/       이미지
```

## 로컬 미리보기
```
python3 -m http.server 8000   # http://localhost:8000
```

## 콘텐츠 수정 (js/content.js)
- `company` : 대표번호, 이메일, 주소, 사업자번호 (푸터·모바일 메뉴에 반영)
- `hero.slides` : 메인 슬라이드 문구·배경 이미지
- `works` : 포트폴리오. `img` 없으면 플레이스홀더, `link` 를 넣으면 클릭 시 새 창으로 사이트 열림
- `popups` : 공지 팝업 (노출 기간 `from`/`to`, `on:false` 로 끄기)
- `formEndpoint` : 문의 폼 전송 주소

## 문의 폼
- `formEndpoint` 가 비어 있으면 작성 내용이 채워진 메일 작성 창(mailto)이 열립니다.
- [Formspree](https://formspree.io) 같은 폼 수신 서비스 주소를 넣으면 페이지에서 바로 전송됩니다.

## 배포
GitHub Pages: 저장소 Settings → Pages → Branch `main` / root 선택. Netlify·Vercel 은 폴더를 그대로 올리면 됩니다.
