import { Pool, PoolClient } from 'pg';
import OpenAI from 'openai';

// PostgreSQL 연결 풀 설정
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5433/rag_db',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface Document {
  id: number;
  title?: string;
  content: string;
  content_type?: string;
  metadata?: any;
  embedding?: number[];
  created_at: Date;
  similarity?: number;
}

/**
 * 데이터베이스와 테이블의 초기화
 * pgvector 확장을 설치하고 필요한 테이블을 생성
 */
export async function initDatabase(): Promise<void> {
  const client: PoolClient = await pool.connect();
  
  try {
    console.log('🔧 데이터베이스를 초기화 중...');
    
    // pgvector 확장을 설치
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('✅ pgvector 확장을 활성화했습니다');
    
    // documents 테이블 만들기
    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        title TEXT,
        content TEXT NOT NULL,
        content_type TEXT,
        metadata JSONB DEFAULT '{}',
        embedding vector(1536),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ documents 테이블을 생성했습니다');
    
    // 벡터검색용 인덱스 생성 (HNSW)
    await client.query(`
      CREATE INDEX IF NOT EXISTS documents_embedding_hnsw_idx 
      ON documents 
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64);
    `);
    console.log('✅ 벡터 인덱스(HNSW)를 생성했습니다');
    
    // 추가 인덱스
    await client.query(`
      CREATE INDEX IF NOT EXISTS documents_content_type_idx 
      ON documents (content_type);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS documents_created_at_idx 
      ON documents (created_at);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS documents_metadata_idx 
      ON documents USING gin (metadata);
    `);
    
    console.log('✅ 추가 인덱스를 생성했습니다');
    
    // 샘플 데이터 삽입 (처음에만)
    const sampleData = [
      {
        title: 'Welcome Document',
        content: 'Welcome to our RAG system! This is a sample document to test the vector search functionality.',
        content_type: 'text/plain',
        metadata: { type: 'sample', category: 'welcome' }
      },
      {
        title: 'AI Introduction',
        content: 'Artificial Intelligence (AI) is the simulation of human intelligence in machines that are programmed to think and learn.',
        content_type: 'text/plain',
        metadata: { type: 'sample', category: 'education' }
      },
      {
        title: 'RAG Explanation',
        content: 'Retrieval-Augmented Generation (RAG) combines information retrieval with text generation to provide more accurate and contextual responses.',
        content_type: 'text/plain',
        metadata: { type: 'sample', category: 'technical' }
      }
    ];

    // 각 샘플 데이터를 벡터화하여 저장
    for (const doc of sampleData) {
      const embedding = await embedText(doc.content);
      const query = `
        INSERT INTO documents (title, content, content_type, metadata, embedding)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING
      `;
      
      await client.query(query, [
        doc.title,
        doc.content,
        doc.content_type,
        JSON.stringify(doc.metadata),
        `[${embedding.join(',')}]`
      ]);
    }
    
    console.log(`✅ 샘플 데이터를 ${sampleData.length}건 삽입했습니다`);
    
    console.log('✅ 데이터베이스 초기화가 완료되었습니다');
    
  } catch (error) {
    console.error('❌ 데이터베이스 초기화 오류:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 텍스트를 벡터화 (OpenAI Embedding)
 * @param text 벡터화할 텍스트
 * @returns 벡터 배열
 */
export async function embedText(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('임베딩 생성 오류:', error);
    throw error;
  }
}

/**
 * 문서를 데이터베이스에 저장
 * @param title 문서의 제목
 * @param content 문서의 내용
 * @param contentType 콘텐츠 타입
 * @param metadata 메타데이터
 * @returns 저장된 문서의 ID
 */
export async function saveDocument(
  title: string,
  content: string,
  contentType?: string,
  metadata: any = {}
): Promise<number> {
  const client: PoolClient = await pool.connect();
  
  try {
    // 텍스트를 벡터화
    console.log('🔄 텍스트를 벡터화 중...');
    const embedding = await embedText(content);
    
    // 데이터베이스에 저장
    const query = `
      INSERT INTO documents (title, content, content_type, metadata, embedding)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, created_at
    `;
    
    const result = await client.query(query, [
      title,
      content,
      contentType,
      JSON.stringify(metadata),
      `[${embedding.join(',')}]`, // PostgreSQL의 vector 타입으로 저장
    ]);
    
    const documentId = result.rows[0].id;
    console.log(`✅ 문서를 저장했습니다 (ID: ${documentId})`);
    
    return documentId;
    
  } catch (error) {
    console.error('문서 저장 오류:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 간단한 텍스트 등록 (후방 호환성)
 * @param id 문자열 ID (내부적으로 숫자 ID로 변환 또는 새로 생성)
 * @param text 텍스트 내용
 */
export async function upsertDocument(id: string, text: string): Promise<void> {
  const client: PoolClient = await pool.connect();
  
  try {
    // 벡터화
    const embedding = await embedText(text);
    
    // ID가 숫자인 경우는 UPSERT, 그렇지 않으면 INSERT
    const isNumericId = /^\d+$/.test(id);
    
    if (isNumericId) {
      // UPSERT 로직
      const upsertQuery = `
        INSERT INTO documents (id, title, content, embedding) 
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) 
        DO UPDATE SET 
          content = EXCLUDED.content,
          embedding = EXCLUDED.embedding,
          created_at = CURRENT_TIMESTAMP
      `;
      
      await client.query(upsertQuery, [
        parseInt(id),
        `Document ${id}`,
        text,
        `[${embedding.join(',')}]`,
      ]);
    } else {
      // 새로운 문서 생성 (문자열 ID는 무시하고 자동 할당)
      const insertQuery = `
        INSERT INTO documents (title, content, embedding)
        VALUES ($1, $2, $3)
      `;
      
      await client.query(insertQuery, [
        id, // 제목으로 사용
        text,
        `[${embedding.join(',')}]`,
      ]);
    }
    
  } catch (error) {
    console.error('upsertDocument 오류:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 메타데이터 있는 문서 저장/업데이트
 * @param id 문서 ID
 * @param text 텍스트 내용
 * @param metadata 메타데이터
 */
export async function upsertDocumentWithMetadata(
  id: string,
  text: string,
  metadata: any = {}
): Promise<void> {
  const client: PoolClient = await pool.connect();
  
  try {
    console.log('🔄 텍스트를 벡터화 중...');
    const embedding = await embedText(text);
    console.log('✅ 벡터화 완료:', embedding.length, '차원');
    
    const query = `
      INSERT INTO documents (title, content, metadata, embedding)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `;
    
    const result = await client.query(query, [
      metadata.filename || id,
      text,
      JSON.stringify(metadata),
      `[${embedding.join(',')}]`,
    ]);
    
    console.log(`✅ 문서를 저장했습니다 (ID: ${result.rows[0].id})`);
    
  } catch (error) {
    console.error('upsertDocumentWithMetadata 오류:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 유사 문서 검색
 * @param query 검색 쿼리
 * @param limit 가져올 개수
 * @param threshold 유사도 임계값
 * @returns 유사 문서의 배열
 */
export async function searchSimilarDocuments(
  query: string,
  limit: number = 5,
  threshold: number = 0.3
): Promise<Array<{ id: string; score: number; text: string }>> {
  const client: PoolClient = await pool.connect();
  
  try {
    console.log('🔍 검색 쿼리:', query);
    console.log('📊 검색 파라미터:', { limit, threshold });
    
    // 쿼리를 벡터화
    console.log('🔄 쿼리를 벡터화 중...');
    const queryEmbedding = await embedText(query);
    console.log('✅ 쿼리의 벡터화 완료:', queryEmbedding.length, '차원');
    
    // 코사인 유사도로 검색
    const searchQuery = `
      SELECT 
        id,
        title,
        content,
        metadata,
        1 - (embedding <=> $1) as similarity
      FROM documents
      WHERE 1 - (embedding <=> $1) > $2
      ORDER BY embedding <=> $1
      LIMIT $3
    `;
    
    console.log('🔍 검색 쿼리 실행 중...');
    const result = await client.query(searchQuery, [
      `[${queryEmbedding.join(',')}]`,
      threshold,
      limit,
    ]);
    
    console.log(`📊 검색 결과: ${result.rows.length}건`);
    if (result.rows.length > 0) {
      result.rows.forEach((row, index) => {
        console.log(`--- 결과 ${index + 1} (관련도: ${(row.similarity * 100).toFixed(2)}%) ---`);
        console.log(`ID: ${row.id}`);
        console.log(`텍스트: ${row.content.substring(0, 150)}...`);
      });
    } else {
      // 임계값을 낮춰서 다시 검색
      console.log('⚠️ 검색 결과 없음. 임계값을 낮춰서 다시 검색합니다...');
      const retryQuery = `
        SELECT 
          id,
          title,
          content,
          metadata,
          1 - (embedding <=> $1) as similarity
        FROM documents
        ORDER BY embedding <=> $1
        LIMIT $2
      `;
      
      const retryResult = await client.query(retryQuery, [
        `[${queryEmbedding.join(',')}]`,
        limit,
      ]);
      
      console.log(`📊 다시 검색 결과: ${retryResult.rows.length}건`);
      retryResult.rows.forEach((row, index) => {
        console.log(`--- 결과 ${index + 1} (관련도: ${(row.similarity * 100).toFixed(2)}%) ---`);
        console.log(`ID: ${row.id}`);
        console.log(`텍스트: ${row.content.substring(0, 150)}...`);
      });
      
      return retryResult.rows.map(row => ({
        id: row.id.toString(),
        score: parseFloat(row.similarity),
        text: row.content,
      }));
    }
    
    return result.rows.map(row => ({
      id: row.id.toString(),
      score: parseFloat(row.similarity),
      text: row.content,
    }));
    
  } catch (error) {
    console.error('검색 오류:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 문서 삭제
 * @param id 문서 ID
 */
export async function deleteDocument(id: string): Promise<void> {
  const client: PoolClient = await pool.connect();
  
  try {
    const query = 'DELETE FROM documents WHERE id = $1';
    await client.query(query, [parseInt(id)]);
  } catch (error) {
    console.error('삭제 오류:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 여러 문서를 일괄 삭제
 * @param ids 문서 ID의 배열
 */
export async function deleteMultipleDocuments(ids: string[]): Promise<void> {
  const client: PoolClient = await pool.connect();
  
  try {
    const numericIds = ids.map(id => parseInt(id)).filter(id => !isNaN(id));
    
    if (numericIds.length === 0) return;
    
    const query = 'DELETE FROM documents WHERE id = ANY($1)';
    await client.query(query, [numericIds]);
  } catch (error) {
    console.error('일괄 삭제 오류:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 모든 문서 가져오기
 * @param limit 가져올 개수
 * @param offset 오프셋
 * @returns 문서의 배열
 */
export async function getAllDocuments(
  limit: number = 100,
  offset: number = 0
): Promise<Array<{
  id: string | number;
  text: string;
  metadata: any;
  created_at: string;
}>> {
  const client: PoolClient = await pool.connect();
  
  try {
    const query = `
      SELECT id, title, content, metadata, created_at
      FROM documents
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;
    
    const result = await client.query(query, [limit, offset]);
    
    return result.rows.map(row => ({
      id: row.id,
      text: row.content,
      metadata: row.metadata || {},
      created_at: row.created_at.toISOString(),
    }));
    
  } catch (error) {
    console.error('모든 문서 가져오기 오류:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 데이터베이스 통계 정보 가져오기
 * @returns 통계 정보
 */
export async function getCollectionInfo(): Promise<{
  status: string;
  vectorsCount: number;
  indexedVectorsCount: number;
  pointsCount: number;
  config: any;
}> {
  const client: PoolClient = await pool.connect();
  
  try {
    // 문서 수 가져오기
    const countQuery = 'SELECT COUNT(*) as total FROM documents';
    const countResult = await client.query(countQuery);
    const totalDocs = parseInt(countResult.rows[0].total);
    
    // 벡터화된 문서 수 가져오기
    const vectorCountQuery = 'SELECT COUNT(*) as total FROM documents WHERE embedding IS NOT NULL';
    const vectorCountResult = await client.query(vectorCountQuery);
    const vectorDocs = parseInt(vectorCountResult.rows[0].total);
    
    // 인덱스 정보 가져오기
    const indexQuery = `
      SELECT schemaname, tablename, indexname 
      FROM pg_indexes 
      WHERE tablename = 'documents' AND indexname LIKE '%hnsw%'
    `;
    const indexResult = await client.query(indexQuery);
    const hasVectorIndex = indexResult.rows.length > 0;
    
    return {
      status: 'green',
      vectorsCount: vectorDocs,
      indexedVectorsCount: hasVectorIndex ? vectorDocs : 0,
      pointsCount: totalDocs,
      config: {
        database: 'PostgreSQL',
        extension: 'pgvector',
        vectorDimension: 1536,
        distanceMetric: 'cosine',
      },
    };
    
  } catch (error) {
    console.error('통계 정보 가져오기 오류:', error);
    return {
      status: 'red',
      vectorsCount: 0,
      indexedVectorsCount: 0,
      pointsCount: 0,
      config: {},
    };
  } finally {
    client.release();
  }
}

/**
 * 데이터베이스 연결 정리
 */
export async function closeDatabase(): Promise<void> {
  await pool.end();
}

// 프로세스 종료 시 연결 풀 정리
process.on('SIGINT', closeDatabase);
process.on('SIGTERM', closeDatabase);

/**
 * 데이터베이스 내의 문서 확인
 */
export async function checkDocuments(): Promise<void> {
  const client: PoolClient = await pool.connect();
  
  try {
    console.log('📊 데이터베이스 내의 문서를 확인 중...');
    
    // 모든 문서 수 가져오기
    const countQuery = 'SELECT COUNT(*) as total FROM documents';
    const countResult = await client.query(countQuery);
    console.log(`📚 전체 문서 수: ${countResult.rows[0].total}건`);
    
    // 벡터화된 문서 수 가져오기
    const vectorQuery = 'SELECT COUNT(*) as total FROM documents WHERE embedding IS NOT NULL';
    const vectorResult = await client.query(vectorQuery);
    console.log(`🔢 벡터 문서 수: ${vectorResult.rows[0].total}건`);
    
    // 최신 문서 표시
    const recentQuery = `
      SELECT id, title, content, created_at
      FROM documents
      ORDER BY created_at DESC
      LIMIT 5
    `;
    const recentResult = await client.query(recentQuery);
    
    console.log('\n📝 최신 문서:');
    recentResult.rows.forEach((row, index) => {
      console.log(`\n--- 문서 ${index + 1} ---`);
      console.log(`ID: ${row.id}`);
      console.log(`제목: ${row.title}`);
      console.log(`내용: ${row.content.substring(0, 100)}...`);
      console.log(`작성일시: ${row.created_at}`);
    });
    
  } catch (error) {
    console.error('문서 확인 오류:', error);
    throw error;
  } finally {
    client.release();
  }
}

/*

PostgreSQL + pgvector 클라이언트의 특징:

✅ **표준 SQL**: 익숙한 SQL로 데이터 조작
✅ **ACID 준수**: 트랜잭션의 신뢰성
✅ **풍부한 데이터 타입**: JSONB, 텍스트 검색, 지리 공간 데이터 등
✅ **확장성**: 대규모 데이터에도 대응
✅ **비용 효율성**: 오픈소스로 무료
✅ **에코시스템**: 풍부한 도구와 라이브러리
✅ **백업/복구**: 기업 수준의 데이터 보호
✅ **인덱스 최적화**: HNSW, IVFFlat 등의 빠른 검색

메서드 목록:
- `initDatabase()`: 데이터베이스와 테이블의 초기화
- `embedText()`: OpenAI API로 텍스트를 벡터화
- `saveDocument()`: 전체 기능을 사용하여 문서 저장
- `upsertDocument()`: 간단한 텍스트 등록
- `upsertDocumentWithMetadata()`: 메타데이터 있는 문서 저장/업데이트
- `searchSimilarDocuments()`: 벡터 유사도 검색
- `deleteDocument()`: 단일 문서 삭제
- `deleteMultipleDocuments()`: 일괄 삭제
- `getAllDocuments()`: 모든 문서 가져오기
- `getCollectionInfo()`: 통계 정보 가져오기
- `closeDatabase()`: 연결 정리
- `checkDocuments()`: 데이터베이스 내의 문서 확인

*/
