# RAG 응용프로그램 시작 절차

## 전제조건 확인

### 1. postgres시작
```bash
# Docker를 사용하는 경우
docker compose up 

### 3. 백엔드 서버 시작
```bash
cd backend

# 종속성 설치 (처음에만)
npm install

# 서버 시작 
npm start
```

### 4. 프론트엔드 서버 시작
새 터미널창에서：
```bash
cd frontend

# 종속성 설치 (처음에만)
npm install

# 개발서버 시작
npm run dev
```

## 액세스

- **프론트엔드**: http://localhost:5173
- **백엔드 API**: http://localhost:5001
- **Qdrant Dashboard**: http://localhost:5432/dashboard
>

### 환경변수 확인 
backend/.env 파일이 올바르게 설정되었는지 확인：
```env
OPENAI_API_KEY=your_actual_api_key_here
DATABASE_URL=postgresql://postgres:password@localhost:5433/rag_db
PORT=5001
```

### 연결 테스트
백엔드가 시작되면 다음 URL에서 테스트：
- http://localhost:5001/api/stats
- http://localhost:6333/collections
