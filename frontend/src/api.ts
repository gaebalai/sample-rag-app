import axios from 'axios';

const API_BASE = 'http://localhost:5001/api';

// 에러핸들링을 포함한 axios 인스턴스
const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

// 응답인터셉터
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export interface Document {
  id: string;
  text: string;
  metadata?: {
    filename?: string;
    fileType?: string;
    chunkIndex?: number;
    sourceFile?: string;
    created_at?: string;
  };
  created_at?: string;
}

export interface SearchResult extends Document {
  score: number;
}

export interface RAGResponse {
  answer: string;
  sources: Array<{
    id: string;
    score: number;
    text: string;
    chunk_preview: string;
  }>;
  responseTime: number;
  tokensUsed?: number;
}

export interface SystemStats {
  totalDocuments: number;
  vectorsCount: number;
  indexedVectorsCount: number;
  collectionStatus: string;
  fileTypes: Record<string, number>;
  lastUpdate: string;
}

/**
 * 문서등록(UI에서 동적으로 추가할 때 사용)
 */
export async function upsert(id: string, text: string) {
  const response = await api.post('/upsert', { id, text });
  return response.data;
}

/**
 * 검색 쿼리에 대한 유사 문서 가져오기
 */
export async function search(query: string, k: number = 5): Promise<SearchResult[]> {
  const response = await api.get('/search', { params: { query, k } });
  return response.data;
}

/**
 * 파일 업로드
 */
export async function uploadFile(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  
  return response.data;
}

/**
 * RAG 질문 답변
 */
export async function askQuestion(question: string): Promise<RAGResponse> {
  const response = await api.post('/ask', { question });
  return response.data;
}

/**
 * 문서 목록 가져오기
 */
export async function getDocuments(limit: number = 50, offset: number = 0): Promise<{
  documents: Document[];
  total: number;
}> {
  const response = await api.get('/documents', { params: { limit, offset } });
  return response.data;
}

/**
 * 시스템 통계 정보 가져오기
 */
export async function getSystemStats(): Promise<SystemStats> {
  const response = await api.get('/stats');
  return response.data;
}

/**
 * 문서삭제
 */
export async function deleteDocument(id: string) {
  const response = await api.delete(`/documents/${id}`);
  return response.data;
}

/**
 * 여러 문서 일괄 삭제
 */
export async function deleteMultipleDocuments(ids: string[]) {
  const response = await api.delete('/documents', { data: { ids } });
  return response.data;
}