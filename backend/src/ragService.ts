import OpenAI from 'openai';
import { searchSimilarDocuments } from './pgClient';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

/**
 * RAG를 사용하여 질문에 대한 답변을 생성합니다
 * @param question 사용자의 질문
 * @param maxSources 참조할 문서의 최대 수
 * @returns RAG 답변 결과
 */
export async function generateRAGAnswer(question: string, maxSources: number = 3): Promise<RAGResponse> {
  const startTime = Date.now();
  
  try {
    // 1. 관련 문서 검색
    console.log('\n🔍 검색 쿼리:', question);
    console.log('📊 최대 검색 수:', maxSources);
    
    const searchResults = await searchSimilarDocuments(question, maxSources);
    
    console.log('\n📚 검색결과 (상위5건):');
    searchResults.slice(0, 5).forEach((result, index) => {
      console.log(`\n--- 결과 ${index + 1} (관련도: ${(result.score * 100).toFixed(2)}%) ---`);
      console.log(`ID: ${result.id}`);
      console.log(`텍스트: ${result.text.substring(0, 150)}...`);
    });
    
    if (searchResults.length === 0) {
      console.log('\n❌ 검색결과 없음');
      return {
        answer: '죄송합니다. 관련 정보를 찾을 수 없습니다. 질문을 변경하여 다시 시도해주세요.',
        sources: [],
        responseTime: Date.now() - startTime
      };
    }

    // 2. 컨텍스트 구축
    console.log('\n📝 컨텍스트 구축중...');
    const context = searchResults
      .map((doc: { text: string; score: number }, index: number) => {
        const preview = doc.text.length > 100 
          ? doc.text.substring(0, 100) + '...' 
          : doc.text;
        
        return `[소스${index + 1}] (관련도: ${(doc.score * 100).toFixed(1)}%)\n${doc.text}`;
      })
      .join('\n\n---\n\n');

    // 3. 프롬프트 구축
    console.log('\n🤖 AI 답변 생성 중...');
    const systemPrompt = `당신은 제공된 정보에 기반하여 답변하는 전문 어시스턴트입니다.

다음 규칙에 따라 답변하세요:
1. 제공된 정보를 우선적으로 사용
2. 제공된 정보에 부족한 경우에는 지식을 보완적으로 사용하여 답변을 충실히 하십시오
3. 정보의 출처를 명확히하십시오 : 
- 제공된 정보로부터의 경우는 '소스 X에 의하면...'라고 명기 
- 당신의 지식으로부터의 경우는 '일반적으로...'나 '알고 있는 곳에서는...'라고 명기
4. 추측이나 추측은 피해, 사실에 근거해 회답해 주세요
5. 답변은 이해하기 쉽고 구조화하여 제공하십시오.`;

    const userPrompt = `다음 정보를 참고하여 질문에 답변하세요.
필요한 경우 당신의 지식을 활용하여 답변을 완벽하게 하세요.

[참고 정보]
${context}

[질문]
${question}

[답변]`;

    // 4. OpenAI API로 답변 생성
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 1500,
    });

    const answer = response.choices[0].message.content || '에러가 발생했습니다';
    const tokensUsed = response.usage?.total_tokens;

    // 5. 응답을 구축
    const sources = searchResults.map((doc: { id: string; score: number; text: string }) => ({
      id: doc.id,
      score: doc.score,
      text: doc.text,
      chunk_preview: doc.text.length > 150 
        ? doc.text.substring(0, 150) + '...' 
        : doc.text
    }));

    const responseTime = Date.now() - startTime;

    console.log('\n✅ 답변 생성 완료');
    console.log(`⏱️ 처리 시간: ${responseTime}ms`);
    console.log(`📊 사용 토큰 수: ${tokensUsed}`);
    console.log('\n📝 생성된 답변:');
    console.log(answer);

    return {
      answer,
      sources,
      responseTime,
      tokensUsed
    };

  } catch (error) {
    console.error('\n❌ RAG 답변 생성 오류:', error);
    throw new Error(`답변 생성에 실패했습니다: ${error}`);
  }
}

/**
 * 질문의 품질을 확인합니다
 * @param question 확인할 질문
 * @returns 품질 확인 결과
 */
export function validateQuestion(question: string): { isValid: boolean; message?: string } {
  if (!question || question.trim().length === 0) {
    return { isValid: false, message: '질문이 입력되지 않았습니다' };
  }

  if (question.trim().length < 5) {
    return { isValid: false, message: '질문이 너무 짧습니다 (5자 이상 입력해주세요)' };
  }

  if (question.length > 1000) {
    return { isValid: false, message: '질문이 너무 깁니다 (1000자 이내로 입력해주세요)' };
  }

  return { isValid: true };
}

/**
 * 간단한 질문 분해 기능 (나중에 확장용)
 * @param question 분해할 질문
 * @returns 분해된 하위 질문의 리스트
 */
export async function decomposeQuestion(question: string): Promise<string[]> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: '복잡한 질문을, 검색에 적합한 여러 개의 작은 쿼리로 분해해주세요. 각 쿼리는 독립적으로 검색 가능해야 합니다.'
        },
        {
          role: 'user',
          content: `다음 질문을 검색 쿼리로 분해해주세요 (JSON 배열 형식으로 반환해주세요):\n${question}`
        }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0].message.content || '{"queries": []}');
    return result.queries || [question];
  } catch (error) {
    console.warn('질문 분해에 실패했습니다:', error);
    return [question]; // 폴백: 원래 질문 그대로 사용
  }
}
