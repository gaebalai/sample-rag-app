import dotenv from 'dotenv';
// 환경 변수를 먼저 읽습니다.
dotenv.config();

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { 
    initDatabase, 
    upsertDocument, 
    upsertDocumentWithMetadata,
    searchSimilarDocuments, 
    deleteDocument,
    deleteMultipleDocuments,
    getAllDocuments,
    getCollectionInfo
} from './pgClient';
import { processUploadedFile, isSupportedFileType } from './fileProcessor';
import { generateRAGAnswer, validateQuestion } from './ragService';

// 디버깅용: 환경 변수의 값 확인
console.log('Environment variables:', {
    DATABASE_URL: process.env.DATABASE_URL?.replace(/:\/\/.*@/, '://***@'), // 비밀번호 숨기기
    PORT: process.env.PORT
});

// 환경 변수가 설정되어 있는지 확인
function envCheck(){
    const requiredEnvVars = ['DATABASE_URL', 'OPENAI_API_KEY'];
    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    if(missingEnvVars.length > 0){
        console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
        process.exit(1);
    }
}

// 환경 변수 검사를 먼저 실행
envCheck();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 업로드 디렉토리 만들기
import fs from 'fs';
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer 설정
const upload = multer({
    dest: uploadDir,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    },
    fileFilter: (req, file, cb) => {
        if (isSupportedFileType(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`지원되지 않는 파일 형식입니다: ${file.mimetype}`));
        }
    }
});


// 애플리케이션 시작 시 데이터베이스 초기화(존재하지 않으면 항상 생성)
(async () => {
    try{
        await initDatabase();
        console.log('PostgreSQL 데이터베이스를 초기화했습니다');
    } catch (error){
        console.error('데이터베이스 초기화에 실패했습니다:', error);
    }
})();

// 문서 등록 엔드포인트
app.post('/api/upsert', async (req, res) => {
  const { id, text } = req.body;
  if (!id || !text) return res.status(400).json({ error: 'id and text are required' });
  try {
    await upsertDocument(id, text);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to upsert' });
  }
});


// 유사 문서 검색 엔드포인트
app.get('/api/search', async( req,res ) => {
    const { query, k = 5 } = req.query;
    if(!query) return res.status(400).json({ error: 'query is required' });
    try{
        const results = await searchSimilarDocuments(query as string, parseInt(k as string));
        return res.json(results);
    } catch (err){
        console.error(err);
        return res.status(500).json({ error: 'Failed to search' });
    }
})

// 파일 업로드 엔드포인트
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: '파일이 업로드되지 않았습니다' });
        }

        console.log(`📁 파일 처리 시작: ${file.originalname}`);
        
        // 파일을 처리하고 청크로 분할
        const processedFile = await processUploadedFile(
            file.path,
            file.originalname,
            file.mimetype
        );

        // 각 청크를 벡터 DB에 저장
        const savedChunks = [];
        for (let i = 0; i < processedFile.chunks.length; i++) {
            const chunkId = `${processedFile.filename}_chunk_${i + 1}`;
            const chunkMetadata = {
                ...processedFile.metadata,
                chunkIndex: i + 1,
                sourceFile: processedFile.filename
            };
            
            await upsertDocumentWithMetadata(
                chunkId,
                processedFile.chunks[i],
                chunkMetadata
            );
            
            savedChunks.push({
                id: chunkId,
                text: processedFile.chunks[i],
                metadata: chunkMetadata
            });
        }

        console.log(`✅ 파일 처리 완료: ${processedFile.chunks.length} 청크를 저장`);

        res.json({
            success: true,
            filename: processedFile.filename,
            totalChunks: processedFile.chunks.length,
            chunks: savedChunks,
            metadata: processedFile.metadata
        });
    } catch (error) {
        console.error('파일 업로드 오류:', error);
        res.status(500).json({ 
            error: '파일 처리에 실패했습니다',
            details: (error as Error).message
        });
    }
});

// RAG 답변 생성 엔드포인트
app.post('/api/ask', async (req, res) => {
    try {
        const { question } = req.body;
        
        // 질문 검증
        const validation = validateQuestion(question);
        if (!validation.isValid) {
            return res.status(400).json({ error: validation.message });
        }

        console.log(`❓ RAG 질문: ${question}`);
        
        // RAG 답변을 생성
        const ragResponse = await generateRAGAnswer(question);
        
        res.json(ragResponse);
    } catch (error) {
        console.error('RAG 답변 생성 오류:', error);
        res.status(500).json({
            error: '답변 생성에 실패했습니다',
            details: (error as Error).message
        });
    }
});

// 문서 목록 가져오기 엔드포인트
app.get('/api/documents', async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        const documents = await getAllDocuments(
            parseInt(limit as string),
            parseInt(offset as string)
        );
        
        res.json({
            documents,
            total: documents.length
        });
    } catch (error) {
        console.error('문서 가져오기 오류:', error);
        res.status(500).json({ error: '문서 가져오기에 실패했습니다' });
    }
});

// 시스템 통계 정보 엔드포인트
app.get('/api/stats', async (req, res) => {
    try {
        const collectionInfo = await getCollectionInfo();
        const documents = await getAllDocuments(1000); // 최대 1000개 가져오고 통계 계산
        
        // 파일 유형 통계
        const fileTypes = documents.reduce((acc: any, doc: any) => {
            const fileType = doc.metadata?.fileType || 'unknown';
            acc[fileType] = (acc[fileType] || 0) + 1;
            return acc;
        }, {});
        
        res.json({
            totalDocuments: collectionInfo.pointsCount,
            vectorsCount: collectionInfo.vectorsCount,
            indexedVectorsCount: collectionInfo.indexedVectorsCount,
            collectionStatus: collectionInfo.status,
            fileTypes,
            lastUpdate: new Date().toISOString()
        });
    } catch (error) {
        console.error('통계 정보 가져오기 오류:', error);
        res.status(500).json({ error: '통계 정보 가져오기에 실패했습니다' });
    }
});

// 문서 삭제 엔드포인트
app.delete('/api/documents/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await deleteDocument(id);
        
        res.json({ success: true, message: '문서를 삭제했습니다' });
    } catch (error) {
        console.error('문서 삭제 오류:', error);
        res.status(500).json({ error: '문서 삭제에 실패했습니다' });
    }
});

// 여러 문서 일괄 삭제 엔드포인트
app.delete('/api/documents', async (req, res) => {
    try {
        const { ids } = req.body;
        
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: '삭제할 문서 ID를 지정해주세요' });
        }
        
        await deleteMultipleDocuments(ids);
        
        res.json({ 
            success: true, 
            message: `${ids.length}개의 문서를 삭제했습니다` 
        });
    } catch (error) {
        console.error('일괄 삭제 오류:', error);
        res.status(500).json({ error: '문서 일괄 삭제에 실패했습니다' });
    }
});

// 에러 처리 미들웨어
app.use((err: any, req: any, res: any, next: any) => {
    console.error('Error occurred:', err);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

// 404 처리
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});