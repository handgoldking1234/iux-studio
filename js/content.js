/* =========================================================
   IUX.STUDIO 사이트 콘텐츠
   텍스트·이미지·팝업·연락처는 이 파일만 수정하면 됩니다.
   ========================================================= */
window.SITE = {
  company: {
    name: 'IUX.STUDIO',
    tel: '02-0000-0000',          // TODO: 실제 대표번호
    email: 'hello@iux.studio',    // TODO: 실제 문의 메일
    address: '',                  // 예: '서울특별시 ○○구 ○○로 00'
    bizNo: ''                     // 예: '000-00-00000'
  },

  /* IUX Cloud (Supabase) 연결 — 문의함 · 게시판
     docs/SETUP.md 대로 설정한 뒤 Project URL 과 anon public key 를 넣으세요.
     (anon key 는 공개용 키라 홈페이지 코드에 넣어도 안전합니다) */
  cloud: {
    url: 'https://flrdiplgoeyuvffwxvhq.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZscmRpcGxnb2V5dXZmZnd4dmhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3NTgzNTgsImV4cCI6MjEwODMzNDM1OH0.yNLMwIgvr-f-TwU3fAHuSEC5QjvPp9K3I2T1jkC5UQk',
    siteId: 'iux-studio'
  },

  /* 문의 폼 수신 설정 (cloud 가 설정되어 있으면 cloud 가 우선)
     1순위 web3formsKey : https://web3forms.com 에서 받는 Access Key.
                          키를 발급받은 이메일로 문의 내용이 바로 도착합니다.
     2순위 formEndpoint : Formspree 등 다른 폼 서비스 주소 (예: 'https://formspree.io/f/xxxxxxx')
     둘 다 비워두면 작성 내용이 담긴 메일 작성 창(mailto)이 열립니다. */
  web3formsKey: '',
  formEndpoint: '',

  hero: {
    autoplay: true,
    interval: 6, // 초
    slides: [
      { cat: '기업 홈페이지', title: '첫인상으로\n신뢰를 얻는 얼굴', desc: '회사 소개를 나열하지 않고, 고객이 찾는 강점을 첫 화면에 세웁니다.', img: 'assets/img/work-iux-holdings.jpg' },
      { cat: '브랜드 사이트', title: '브랜드의 분위기를\n온전히 담는 공간', desc: '컬러, 모션, 문장까지 브랜드의 톤으로 맞춰 기억에 남게 만듭니다.', img: 'assets/img/work-gyeongseong.jpg' },
      { cat: '반응형 리뉴얼', title: '낡은 사이트에\n새 숨을 불어넣다', desc: 'PC부터 모바일까지, 가볍고 빠르게 열리는 구조로 다시 설계합니다.', img: 'assets/img/work-iux-system.jpg' }
    ]
  },

  /* 메인 페이지 섹션 문구 (관리자 '콘텐츠 관리 > 메인 페이지 > 섹션 문구'에서 저장하면 그 내용이 우선) */
  sections: {
    services: [
      { t: '기업 홈페이지', d: '첫인상으로 신뢰를 얻는 얼굴' },
      { t: '브랜드 사이트', d: '브랜드의 분위기를 온전히 담는 공간' },
      { t: '쇼핑몰 · 랜딩', d: '둘러보다 문의·구매까지 이어지는 흐름' },
      { t: '리뉴얼 · 유지보수', d: '오픈 다음 날부터 시작되는 관리' }
    ],
    process: {
      eyebrow: 'PROCESS', title: '보기 좋은 화면보다\n움직이는 결과를 봅니다.', lead: '디자인에 앞서 고객이 어디서 멈추고 클릭하는지를 설계합니다.',
      steps: [{ t: '기획 · 구조 설계', d: '방문자의 동선을 먼저 그립니다' }, { t: 'UI · UX 디자인', d: '첫 화면에서 브랜드가 읽히게' }, { t: '개발 · 오픈 · 운영', d: '어떤 기기에서도 매끄럽게 오픈' }]
    },
    about: {
      eyebrow: 'WHY IUX.STUDIO', title: '결과가 다른 데는\n이유가 있습니다.',
      items: [
        { t: '정리가 안 돼도\n시작할 수 있습니다.', d: '흩어진 정보를 모아 사이트 구조로 엮어드립니다.' },
        { t: '한 팀이\n끝까지 만듭니다.', d: '담당이 바뀌지 않아 처음 의도가 흐려지지 않습니다.' },
        { t: '어떤 화면에서도\n가볍게 열립니다.', d: 'PC부터 모바일까지 속도와 사용성을 함께 챙깁니다.' },
        { t: '오픈은 끝이 아니라\n시작입니다.', d: '업데이트와 유지보수로 계속 함께 운영합니다.' }
      ]
    },
    cta: { title: 'IUX.STUDIO와 함께\n프로젝트를 시작해보세요' }
  },

  marquee: ['기업 홈페이지', '브랜드 사이트', '병원 홈페이지', '랜딩페이지', '쇼핑몰', '반응형 리뉴얼', '유지보수', 'UI · UX', 'SEO'],

  workCats: ['전체', '기업', '브랜드', '병원', '쇼핑몰', '랜딩'],
  worksPerPage: 8, // 처음 보여줄 개수 (VIEW ALL 누르면 전체)

  /* 포트폴리오: img 가 없으면 플레이스홀더로 표시됩니다.
     link 를 넣으면 클릭 시 해당 사이트가 새 창으로 열리고, 없으면 이미지 미리보기가 열립니다. */
  works: [
    { name: '암갈색의 경성', cat: '브랜드', img: 'assets/img/work-gyeongseong.jpg' },
    { name: 'IUX SYSTEM', cat: '기업', img: 'assets/img/work-iux-system.jpg' },
    { name: 'IUX Holdings', cat: '기업', img: 'assets/img/work-iux-holdings.jpg', link: 'samples/iux-holdings/' },
    { name: 'IUX성형외과', cat: '병원', img: 'assets/img/work-iux-plastic-surgery.jpg', link: 'samples/iux-plastic-surgery/' },
    { name: '미소치과의원', cat: '병원', img: 'assets/img/work-miso-dental.jpg', link: 'samples/miso-dental/' },
    { name: '샘플 06', cat: '브랜드' },
    { name: '샘플 07', cat: '기업' },
    { name: '샘플 08', cat: '쇼핑몰' },
    { name: '샘플 09', cat: '병원' },
    { name: '샘플 10', cat: '병원' }
  ],

  /* 공지 팝업 (on:false 로 끄기, from/to 기간 동안만 노출) */
  popupRoll: { on: false, sec: 5 }, // 팝업이 2개 이상일 때 자동 롤링
  popups: [
    {
      key: 'p1', on: true, from: '2026-10-20', to: '2026-11-30', pos: 'center', // center | bl | br
      img: 'assets/img/popup-promo.webp',
      title: '연말 홈페이지 제작 15% 할인',
      body: '11월 30일까지 상담을 신청하시면\n제작비를 15% 할인해 드립니다.',
      btn: '상담 신청하기', link: '#contact', hideToday: true
    }
  ],

  form: {
    types: ['기업 홈페이지', '브랜드 사이트', '병원', '쇼핑몰', '랜딩페이지', '리뉴얼·유지보수'],
    budgets: ['100만원 미만', '300만원 미만', '500만원 미만', '1천만원 미만', '1천~3천만원', '3천~5천만원', '5천만원 이상', '미정'],
    schedules: ['1개월 이내', '2~3개월', '3개월 이후', '미정']
  }
};
