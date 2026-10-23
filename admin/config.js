/* 관리자 페이지 연결 설정
   Supabase 대시보드 > Project Settings > API 에서 복사하세요.
   anon public key 는 공개용 키라 여기 넣어도 안전합니다. (service_role 키는 절대 넣지 마세요) */
window.ADMIN_CONFIG = {
  supabaseUrl: '',   // 예) 'https://abcdefgh.supabase.co'
  anonKey: '',       // 예) 'eyJhbGciOi...'
  brand: 'IUX.STUDIO',
  // 고객사 홈페이지에 넣을 공용 스크립트 주소 (사이트 관리 > 설치 코드에 표시)
  clientScript: 'https://handgoldking1234.github.io/iux-studio/js/iux-cloud.js'
};
