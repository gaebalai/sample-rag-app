import React, { useState } from 'react';
import { askQuestion, RAGResponse } from './api';

interface RAGChatProps {
  onQuestionAsked: () => void;
}

const RAGChat: React.FC<RAGChatProps> = ({ onQuestionAsked }) => {
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState<RAGResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleAskQuestion = async () => {
    if (!question.trim()) {
      setError('질문을 입력해주세요');
      return;
    }

    if (question.length < 5) {
      setError('질문은 5자 이상으로 입력해주세요');
      return;
    }

    setLoading(true);
    setError('');
    setResponse(null);

    try {
      console.log('🤖 RAG 질문을 보내는 중:', question);
      const ragResponse = await askQuestion(question);
      setResponse(ragResponse);
      onQuestionAsked();
    } catch (error: any) {
      console.error('RAG error:', error);
      setError(
        `❌ 응답의 생성에 실패했습니다: ${error.response?.data?.error || error.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleAskQuestion();
    }
  };

  return (
    <div style={{ 
      border: '1px solid #ddd', 
      borderRadius: '8px', 
      padding: '20px', 
      margin: '16px 0',
      backgroundColor: '#fff'
    }}>
      <h3 style={{ margin: '0 0 16px 0' }}>🤖 RAG 질문 시스템</h3>
      
      <div style={{ marginBottom: '16px' }}>
        <textarea
          placeholder="질문을 입력해주세요（예: 업로드한 문서에 대해 질문）"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyPress}
          rows={3}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '4px',
            border: '1px solid #ccc',
            fontSize: '14px',
            resize: 'vertical',
            boxSizing: 'border-box'
          }}
        />
        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
          Ctrl+Enter (Mac: Cmd+Enter) 로 전송
        </div>
      </div>

      <button
        onClick={handleAskQuestion}
        disabled={loading || !question.trim()}
        style={{
          padding: '10px 20px',
          backgroundColor: loading ? '#ccc' : '#2196f3',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: '14px'
        }}
      >
        {loading ? '🤔 응답생성중...' : '📤 질문하기'}
      </button>

      {error && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          backgroundColor: '#ffebee',
          borderRadius: '4px',
          color: '#c62828',
          border: '1px solid #ffcdd2'
        }}>
          {error}
        </div>
      )}

      {response && (
        <div style={{
          marginTop: '20px',
          padding: '16px',
          backgroundColor: '#f5f5f5',
          borderRadius: '8px',
          border: '1px solid #e0e0e0'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '12px'
          }}>
            <h4 style={{ margin: 0, color: '#333' }}>💡 응답</h4>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {response.responseTime}ms
              {response.tokensUsed && ` • ${response.tokensUsed} tokens`}
            </div>
          </div>
          
          <div style={{
            padding: '12px',
            backgroundColor: '#fff',
            borderRadius: '4px',
            marginBottom: '16px',
            lineHeight: '1.6',
            whiteSpace: 'pre-wrap'
          }}>
            {response.answer}
          </div>

          {response.sources.length > 0 && (
            <div>
              <h5 style={{ margin: '0 0 8px 0', color: '#555' }}>
                📚 참고 소스 ({response.sources.length}건)
              </h5>
              {response.sources.map((source, index) => (
                <div
                  key={source.id}
                  style={{
                    padding: '8px',
                    margin: '4px 0',
                    backgroundColor: '#fff',
                    borderLeft: '3px solid #2196f3',
                    borderRadius: '0 4px 4px 0',
                    fontSize: '13px'
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    marginBottom: '4px'
                  }}>
                    <strong>ソース {index + 1}: {source.id}</strong>
                    <span style={{ color: '#666' }}>
                      유사도: {(source.score * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ color: '#666' }}>
                    {source.chunk_preview}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RAGChat;
