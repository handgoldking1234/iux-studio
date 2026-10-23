-- IUX.STUDIO FAQ 게시판 + 기본 질문
-- Supabase > SQL Editor 에 붙여넣고 Run (한 번만 실행)
-- 답변 내용은 관리자 페이지 > 게시판 > FAQ 에서 언제든 수정할 수 있습니다.
-- FAQ 는 먼저 등록한 질문이 위에 나옵니다. (상단 고정한 질문은 맨 위)

insert into boards (site_id, slug, name, kind, sort)
values ('iux-studio', 'faq', '자주 묻는 질문', 'faq', 1)
on conflict (site_id, slug) do nothing;

insert into posts (site_id, board, title, body, created_at)
select 'iux-studio', 'faq', q.title, q.body, now() + (q.n || ' seconds')::interval
from (values
  (1, '홈페이지 제작 기간은 얼마나 걸리나요?',
      '페이지 수와 필요한 기능에 따라 달라집니다.
상담 후 **기획 · 디자인 · 개발 · 오픈** 단계별 일정을 함께 정해 드립니다.'),
  (2, '제작 비용은 어떻게 정해지나요?',
      '페이지 수, 디자인 범위, 필요한 기능(게시판, 문의 폼, 쇼핑몰 등)에 따라 견적이 달라집니다.
견적 문의에 **예상 예산과 필요한 내용**을 남겨주시면 맞춤 견적을 안내해 드립니다.'),
  (3, '자료가 정리되어 있지 않아도 시작할 수 있나요?',
      '네, 가능합니다. 흩어진 회사 소개, 사진, 문서를 모아 사이트 구조로 엮어드립니다.'),
  (4, '모바일에서도 잘 보이나요?',
      'PC부터 태블릿, 모바일까지 화면 크기에 맞춰 보이는 **반응형**으로 제작합니다.'),
  (5, '공지사항이나 게시글을 직접 올릴 수 있나요?',
      '네. 관리자 페이지에서 공지사항 · FAQ 같은 게시글을 직접 작성하고, 홈페이지로 들어온 문의도 한곳에서 확인할 수 있습니다.'),
  (6, '기존 홈페이지 리뉴얼도 하나요?',
      '네. 지금 사이트를 분석해 구조와 디자인을 다시 설계하고, 모바일에서도 가볍게 열리도록 개선합니다.'),
  (7, '오픈 후 수정이나 유지보수도 가능한가요?',
      '네. 오픈은 끝이 아니라 시작입니다. 콘텐츠 업데이트와 유지보수를 계속 함께 운영합니다.
범위와 비용은 상담 시 안내해 드립니다.')
) as q(n, title, body)
where not exists (select 1 from posts where site_id = 'iux-studio' and board = 'faq');
