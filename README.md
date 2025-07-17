# 벡터검색 및 RAG생성 샘플 앱

## 시스템구성

```mermaid
flowchart LR
    FE[프론트엔드<br/>React + TypeScript + Vite]
    BE[벡엔드<br/>Node.js + Express.js + TypeScript]
    DB[(PostgreSQL16＋pgvector<br/>HNSW인덱스)]
    OA((OpenAI<br/>Embeddings & GPT-4))
    FE --> BE
    BE --> DB
    BE --> OA
```

## 🚀 시작순서

> **전제조건**: Docker（Compose）、Node.js、OpenAI API 키를 준비합니다.

1. **리파지토리 복제**

   ```bash
   git clone <repository-url>
   cd sample-rag-app
   ```

2. **환경변수 설정**

   * **백엔드**

     ```bash
     cd backend
     cat > .env << EOF
     DATABASE_URL=postgresql://postgres:password@localhost:5433/rag_db
     OPENAI_API_KEY=your_openai_api_key
     PORT=5001
     EOF
     ```

3. **PostgreSQL＋pgvector 시작**

   ```bash
   cd ..
   docker-compose up -d
   docker-compose ps   # 정상시작 확인 
   ```

4. **벡엔드 시작**

   ```bash
   cd backend
   npm install
   npm start           # 또는 npm run dev
   ```

5. **프론트엔드시작**

   ```bash
   # 다른 터미널에서
   cd frontend
   npm install
   npm run dev
   ```

6. **브라우저에서 접속**

   * 프론트엔드 → [http://localhost:5173](http://localhost:5173)
   * 백엔드 API → [http://localhost:5001](http://localhost:5001)

---

## 📑 설계서(개요)

### 1. 전체시스템구성

```
[프론트엔드] ←→ [백엔드 API] ←→ [PostgreSQL＋pgvector]
                         ↓
                    [OpenAI API]
```

* **프론트엔드**

  * React + TypeScript + Vite
  * Axios의 API 호출
* **백엔드**

  * Node.js + TypeScript + Express.js
  * 파일수신 → 청크화 → pgvector 등록
  * RAG 질문 → 벡터검색 → OpenAI 호출
* **데이터베이스**

  * PostgreSQL 16
  * pgvector 확장（HNSW 인덱스）
* **외부서비스**

  * OpenAI Embedding（text-embedding-3-small）
  * OpenAI GPT-4（응답생성）

---

### 2. 주요기능 및 데이터흐름

| 기능         | 설명                                                     | 흐름개요                                 |
| ---------- | ------------------------------------------------------ | -------------------------------------- |
| 파일업로드 | PDF/TXT/MD를 받고 자동으로 의미있는 청크로 나누고 메타데이터와 함께 JSONB로 저장 | 클라이언트 → `/api/upload` → DB등록          |
| 벡터검색     | 청크문장 본문을 포함하고 pgvector에서 유사도 검색                         | `/api/search?query=` → pgvector → 결과검색 |
| RAG 질문     | 질문문장 포함 → 유사한 청크검색 → GPT-4로 프롬프트 보내기 → 근거응답 반환      | `/api/ask` → 검색 → GPT-4 → 답변표시         |
| 문서관리   | 등록된 문서 일람 표시 및 개별/일괄 삭제                                  | `/api/documents` → 표시/삭제               |
| 시스템 통계    | 등록건수, 벡터수, 검색속도 등 실시간 통계                             | `/api/stats` → 대시보드에 표시              |

---

### 3. 기술스택

* **백엔드**

  * Node.js 18+ / TypeScript / Express.js
  * pdf-parse, multer（파일처리）
* **프론트엔드**

  * React / TypeScript / Vite
  * Inline CSS, Axios
* **DB 및 검색**

  * PostgreSQL 16 + pgvector
  * HNSW 인덱스, Cosine 유사도
* **AI**

  * OpenAI text-embedding-3-small, GPT-4

---

### ⚙️ 사용자 정의 포인트

* **청크 설정**
  `backend/src/fileProcessor.ts` 의 `chunkText(text, size, overlap)` 를 조정
* **검색건수**
  API 요청시 `k` 파라미터로 변경가능
* **프롬프트편집**
  `backend/src/ragService.ts` 의 `generateRAGAnswer` 함수편집
