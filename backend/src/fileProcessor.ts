import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';

export interface ProcessedFile {
  filename: string;
  chunks: string[];
  metadata: {
    fileType: string;
    originalSize: number;
    processedAt: string;
    totalChunks: number;
  };
}

/**
 * 텍스트를 의미 있는 단위로 청크로 분할
 * @param text 분할할 텍스트
 * @param chunkSize 각 청크의 최대 문자 수
 * @param overlapSize 청크 간 오버랩 문자 수
 * @returns 분할된 청크의 배열
 */
export function chunkText(text: string, chunkSize: number = 1000, overlapSize: number = 100): string[] {
  const startTime = Date.now();
  console.log(`\n📝 청크 처리 시작: ${text.length}자`);

  if (!text || text.trim().length === 0) {
    console.log('❌ 빈 텍스트');
    return [];
  }

  // 단락으로 분할(빈 줄로 구분된 부분)
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  console.log(`📊 단락 수: ${paragraphs.length}`);
  
  const chunks: string[] = [];
  let currentChunk = '';
  let totalTokens = 0;

  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim();
    
    // 현재 청크에 단락을 추가해도 제한을 초과하지 않는 경우
    if ((currentChunk + '\n\n' + trimmedParagraph).length <= chunkSize) {
      currentChunk = currentChunk ? currentChunk + '\n\n' + trimmedParagraph : trimmedParagraph;
    } else {
      // 현재 청크가 비어있지 않은 경우 저장
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        totalTokens += currentChunk.length;
      }

      // 단락이 단독으로 제한을 초과하는 경우 문장 단위로 분할
      if (trimmedParagraph.length > chunkSize) {
        const sentences = splitIntoSentences(trimmedParagraph);
        let sentenceChunk = '';

        for (const sentence of sentences) {
          if ((sentenceChunk + ' ' + sentence).length <= chunkSize) {
            sentenceChunk = sentenceChunk ? sentenceChunk + ' ' + sentence : sentence;
          } else {
            if (sentenceChunk.trim()) {
              chunks.push(sentenceChunk.trim());
              totalTokens += sentenceChunk.length;
            }
            sentenceChunk = sentence;
          }
        }

        if (sentenceChunk.trim()) {
          currentChunk = sentenceChunk.trim();
        } else {
          currentChunk = '';
        }
      } else {
        // 새로운 단락을 새로운 청크로 시작
        currentChunk = trimmedParagraph;
      }
    }
  }

  // 마지막 청크 추가
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
    totalTokens += currentChunk.length;
  }

  // 오버랩 처리 추가(인접한 청크 간에 일부 중복 허용)
  const finalChunks = overlapSize > 0 && chunks.length > 1
    ? addOverlapToChunks(chunks, overlapSize)
    : chunks.filter(chunk => chunk.trim().length > 0);

  const processingTime = Date.now() - startTime;
  console.log(`\n📊 청크 처리 결과:`);
  console.log(`- 청크 수: ${finalChunks.length}`);
  console.log(`- 평균 청크 크기: ${Math.round(totalTokens / finalChunks.length)}자`);
  console.log(`- 처리 시간: ${processingTime}ms`);

  return finalChunks;
}

/**
 * 텍스트를 문장으로 분할
 */
function splitIntoSentences(text: string): string[] {
  // 일본어와 영어의 문장 종결 기호 고려
  const sentences: string[] = text.match(/[^.!?。！？]+[.!?。！？]+/g) || [];
  
  // 매칭되지 않은 나머지 텍스트도 포함
  const matchedLength = sentences.join('').length;
  if (matchedLength < text.length) {
    const remaining = text.substring(matchedLength).trim();
    if (remaining) {
      sentences.push(remaining);
    }
  }
  
  return sentences.map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * 청크 간 오버랩 추가
 */
function addOverlapToChunks(chunks: string[], overlapSize: number): string[] {
  const overlappedChunks: string[] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    let chunk = chunks[i];
    
    // 이전 청크에서 오버랩 추가
    if (i > 0) {
      const prevChunk = chunks[i - 1];
      const overlap = prevChunk.substring(Math.max(0, prevChunk.length - overlapSize));
      chunk = overlap + '\n\n' + chunk;
    }
    
    overlappedChunks.push(chunk);
  }
  
  return overlappedChunks;
}

/**
 * PDF 파일에서 텍스트를 추출
 * @param filePath PDF 파일의 경로
 * @returns 추출된 텍스트
 */
export async function extractTextFromPDF(filePath: string): Promise<string> {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`PDF 파일이 없습니다: ${filePath}`);
    }

    const dataBuffer = fs.readFileSync(filePath);
    if (dataBuffer.length === 0) {
      throw new Error('PDF 파일이 비어있습니다');
    }

    const pdfData = await pdfParse(dataBuffer);
    if (!pdfData || !pdfData.text) {
      throw new Error('PDF에서 텍스트를 추출할 수 없습니다');
    }

    console.log(`📄 PDF 처리: ${pdfData.numpages}페이지, ${pdfData.text.length}자`);
    return pdfData.text;
  } catch (error) {
    console.error('PDF processing error:', error);
    throw new Error(`PDF 처리에 실패했습니다: ${error}`);
  }
}

/**
 * 텍스트 파일에서 텍스트를 읽어오기
 * @param filePath 텍스트 파일의 경로
 * @returns 파일의 내용
 */
export async function extractTextFromTextFile(filePath: string): Promise<string> {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`텍스트 파일이 없습니다: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    if (!content || content.trim().length === 0) {
      throw new Error('텍스트 파일이 비어있습니다');
    }

    console.log(`📄 텍스트 처리: ${content.length}자`);
    return content;
  } catch (error) {
    console.error('Text file processing error:', error);
    throw new Error(`텍스트 파일 처리에 실패했습니다: ${error}`);
  }
}

/**
 * 파일의 종류에 따라 텍스트를 추출하고 청크로 분할
 * @param filePath 업로드된 파일의 경로
 * @param originalName 원본 파일 이름
 * @param mimetype 파일의 MIME 타입
 * @returns 처리 결과
 */
export async function processUploadedFile(
  filePath: string, 
  originalName: string, 
  mimetype: string
): Promise<ProcessedFile> {
  console.log(`\n📁 파일 처리 시작: ${originalName} (${mimetype})`);
  
  if (!filePath || !originalName || !mimetype) {
    throw new Error('필요한 파라미터가 부족합니다');
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`파일이 없습니다: ${filePath}`);
  }

  const fileStats = fs.statSync(filePath);
  if (fileStats.size === 0) {
    throw new Error('파일이 비어있습니다');
  }

  let extractedText = '';

  try {
    // 파일 유형에 따라 텍스트를 추출
    switch (mimetype) {
      case 'application/pdf':
        extractedText = await extractTextFromPDF(filePath);
        break;
      case 'text/plain':
      case 'text/markdown':
        extractedText = await extractTextFromTextFile(filePath);
        break;
      default:
        throw new Error(`지원되지 않는 파일 형식입니다: ${mimetype}`);
    }

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('파일에서 텍스트를 추출할 수 없습니다');
    }

    // 텍스트를 청크로 분할
    const chunks = chunkText(extractedText, 1500, 150);

    if (chunks.length === 0) {
      throw new Error('청크 생성에 실패했습니다');
    }

    // 메타데이터 생성
    const metadata = {
      fileType: mimetype,
      originalSize: fileStats.size,
      processedAt: new Date().toISOString(),
      totalChunks: chunks.length
    };

    console.log(`✅ 파일 처리 완료: ${chunks.length} 청크`);

    return {
      filename: originalName,
      chunks,
      metadata
    };

  } catch (error) {
    console.error('File processing error:', error);
    throw error;
  } finally {
    // 임시 파일 삭제
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('🗑️ 임시 파일을 삭제했습니다');
      }
    } catch (unlinkError) {
      console.warn('Failed to delete temporary file:', unlinkError);
    }
  }
}

/**
 * 지원되는 파일 형식인지 확인
 * @param mimetype 파일의 MIME 타입
 * @returns 지원되는 경우 true
 */
export function isSupportedFileType(mimetype: string): boolean {
  const supportedTypes = [
    'application/pdf',
    'text/plain',
    'text/markdown'
  ];
  
  return supportedTypes.includes(mimetype);
}
