// API 설정 중앙화 - URL 정규화 문제 해결
export const API_CONFIG = {
  // 하드코딩된 URL 사용 (개발 환경)
  BASE_URL: 'http://localhost:3001',
  
  // URL 정규화 방지
  getApiUrl: (endpoint: string) => {
    // endpoint가 이미 /로 시작하는지 확인
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const fullUrl = `${API_CONFIG.BASE_URL}${normalizedEndpoint}`;
    
    console.log('🔧 URL 생성 과정:', {
      originalEndpoint: endpoint,
      normalizedEndpoint,
      baseUrl: API_CONFIG.BASE_URL,
      fullUrl,
      // URL 객체로 파싱해서 확인
      urlObject: new URL(fullUrl)
    });
    
    return fullUrl;
  },
  
  // 간단한 헤더 설정
  getHeaders: (token?: string) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    console.log('🔧 Headers:', headers);
    return headers;
  },
  
  // 직접적인 fetch 호출 (정규화 방지)
  async fetch(endpoint: string, token?: string) {
    const url = this.getApiUrl(endpoint);
    const headers = this.getHeaders(token);
    
    console.log('🔧 Fetch 시작:', { 
      endpoint,
      url,
      headers,
      // URL 검증
      urlIsValid: this.isValidUrl(url),
      urlProtocol: new URL(url).protocol,
      urlHost: new URL(url).host,
      urlPathname: new URL(url).pathname
    });
    
    try {
      // 직접 fetch 호출 (API_CONFIG.fetch 대신)
      console.log('🔧 직접 fetch 호출 시작...');
      const response = await fetch(url, { 
        method: 'GET',
        headers,
        // 추가 옵션
        mode: 'cors',
        credentials: 'same-origin'
      });
      
      console.log('🔧 Fetch 응답:', { 
        status: response.status, 
        ok: response.ok,
        statusText: response.statusText,
        url: response.url, // 실제 요청된 URL
        headers: Object.fromEntries(response.headers.entries())
      });
      
      // 404 오류 시 추가 디버깅
      if (response.status === 404) {
        console.error('🔧 404 오류 발생!');
        console.error('🔧 요청 URL:', url);
        console.error('🔧 응답 URL:', response.url);
        console.error('🔧 응답 상태:', response.status, response.statusText);
        
        // 백엔드 서버 상태 확인
        try {
          const healthResponse = await fetch(`${this.BASE_URL}/health`);
          console.log('🔧 백엔드 서버 상태:', healthResponse.status, healthResponse.ok);
        } catch (healthError) {
          console.error('🔧 백엔드 서버 연결 실패:', healthError);
        }
      }
      
      return response;
    } catch (error) {
      console.error('🔧 Fetch 오류:', error);
      throw error;
    }
  },
  
  // URL 유효성 검사
  isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },
  
  // 브라우저에서 직접 테스트 (정규화 확인)
  testConnection() {
    console.log('🧪 API 연결 테스트 시작...');
    
    // 1. Health check
    const healthUrl = `${this.BASE_URL}/health`;
    console.log('🧪 Health URL:', healthUrl);
    
    fetch(healthUrl)
      .then(response => {
        console.log('✅ Health check:', {
          status: response.status, 
          ok: response.ok,
          url: response.url
        });
        return response.json();
      })
      .then(data => console.log('✅ Health data:', data))
      .catch(error => console.error('❌ Health check failed:', error));
    
    // 2. Auth endpoint (without token)
    const authUrl = `${this.BASE_URL}/api/auth/me`;
    console.log('🧪 Auth URL:', authUrl);
    
    fetch(authUrl)
      .then(response => {
        console.log('✅ Auth endpoint:', {
          status: response.status, 
          ok: response.ok,
          url: response.url
        });
        return response.json();
      })
      .then(data => console.log('✅ Auth response:', data))
      .catch(error => console.error('❌ Auth endpoint failed:', error));
  }
};

console.log('🔧 API Config loaded');

// 브라우저에서 직접 테스트 실행
if (typeof window !== 'undefined') {
  setTimeout(() => {
    API_CONFIG.testConnection();
  }, 1000);
}
