import { useState } from 'react';
import { search, upsert } from './api';
import FileUpload from './FileUpload';
import RAGChat from './RAGChat';
import DocumentManager from './DocumentManager';
import SystemStatsDisplay from './SystemStatsDisplay';

function App() {
  // UI 상태 관리
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ id: string; score: number; text: string }>>([]);
  const [docText, setDocText] = useState('');
  const [docId, setDocId] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState<'search' | 'rag' | 'upload' | 'documents'>('upload');
  const [searchLoading, setSearchLoading] = useState(false);
  const [upsertLoading, setUpsertLoading] = useState(false);

  // 검색버튼 클릭시
  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearchLoading(true);
    try {
      const res = await search(query);
      setResults(res);
    } catch (error) {
      console.error('Search error:', error);
      alert('검색에 실패했습니다');
    } finally {
      setSearchLoading(false);
    }
  };

  // 문서등록버튼클릭시(데모용)
  const handleUpsert = async () => {
    if (!docId.trim() || !docText.trim()) return;
    setUpsertLoading(true);
    try {
      await upsert(docId, docText);
      alert('문서를 등록했습니다!');
      setDocId('');
      setDocText('');
      // 문서 목록 업데이트
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Upsert error:', error);
      alert('등록에 실패했습니다');
    } finally {
      setUpsertLoading(false);
    }
  };

  // 파일 업로드 성공 시 콜백
  const handleUploadSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // RAG 질문 실행 시 콜백
  const handleQuestionAsked = () => {
    // 필요에 따라 통계 정보 업데이트
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div style={{ maxWidth: 1200, margin: 'auto', padding: 20, fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ textAlign: 'center', marginBottom: 30 }}>
        <h1 style={{ color: '#333', margin: '0 0 8px 0' }}>🔍 확장 RAG 데모 앱</h1>
        <p style={{ color: '#666', margin: 0 }}>
          파일 업로드 → 청크 생성 → 벡터 검색 → RAG 답변
        </p>
      </header>

      {/* 시스템 통계 */}
      <SystemStatsDisplay refreshTrigger={refreshTrigger} />

      {/* 탭 네비게이션 */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #ddd',
        marginBottom: 20
      }}>
        {[
          { key: 'upload', label: '📁 파일 업로드' }, 
          { key: 'rag', label: '🤖 RAG 질문' }, 
          { key: 'search', label: '🔍 벡터 검색' }, 
          { key: 'documents', label: '📚 문서 관리' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              padding: '12px 20px',
              border: 'none',
              backgroundColor: activeTab === tab.key ? '#2196f3' : 'transparent',
              color: activeTab === tab.key ? 'white' : '#666',
              cursor: 'pointer',
              borderRadius: '4px 4px 0 0',
              marginRight: '4px',
              fontSize: '14px'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === 'upload' && (
        <FileUpload onUploadSuccess={handleUploadSuccess} />
      )}

      {activeTab === 'rag' && (
        <RAGChat onQuestionAsked={handleQuestionAsked} />
      )}

      {activeTab === 'search' && (
        <div style={{ 
          border: '1px solid #ddd', 
          borderRadius: '8px', 
          padding: '20px', 
          backgroundColor: '#fff'
        }}>
          <h3 style={{ margin: '0 0 16px 0' }}>🔍 벡터검색 데모</h3>
          <div style={{ marginBottom: 24 }}>
            <input
              type="text"
              placeholder="검색 쿼리를 입력..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              style={{ 
                width: '70%', 
                padding: 12, 
                borderRadius: '4px',
                border: '1px solid #ccc',
                fontSize: '14px'
              }}
            />
            <button 
              onClick={handleSearch} 
              disabled={searchLoading || !query.trim()}
              style={{ 
                padding: '12px 20px', 
                marginLeft: 8,
                backgroundColor: searchLoading ? '#ccc' : '#2196f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: searchLoading ? 'not-allowed' : 'pointer',
                fontSize: '14px'
              }}
            >
              {searchLoading ? '검색중...' : '검색'}
            </button>
          </div>
          
          {results.length > 0 && (
            <div>
              <h4 style={{ color: '#333', marginBottom: '12px' }}>
                검색결과 ({results.length}건)
              </h4>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {results.map((r) => (
                  <div key={r.id} style={{ 
                    marginBottom: 16, 
                    padding: 16,
                    border: '1px solid #eee',
                    borderRadius: '4px',
                    backgroundColor: '#fafafa'
                  }}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      marginBottom: 8
                    }}>
                      <strong style={{ color: '#333' }}>ID: {r.id}</strong>
                      <span style={{ 
                        padding: '2px 8px',
                        backgroundColor: '#e3f2fd',
                        borderRadius: '12px',
                        fontSize: '12px',
                        color: '#1976d2'
                      }}>
                        유사도: {(r.score * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div style={{ 
                      fontSize: '14px', 
                      lineHeight: '1.5',
                      color: '#555'
                    }}>
                      {r.text.length > 300 ? r.text.substring(0, 300) + '...' : r.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'documents' && (
        <DocumentManager refreshTrigger={refreshTrigger} />
      )}

      {/* 데모용 수동등록기능 */}
      <div style={{
        marginTop: 40,
        padding: 20,
        backgroundColor: '#f9f9f9',
        borderRadius: '8px',
        border: '1px solid #e0e0e0'
      }}>
        <h3 style={{ margin: '0 0 16px 0' }}>📝 수동 텍스트 등록 (데모용)</h3>
        <div style={{ marginBottom: 12 }}>
          <input
            type="text"
            placeholder="ID를 입력 (예: demo_text_1)"
            value={docId}
            onChange={(e) => setDocId(e.target.value)}
            style={{ 
              width: '30%', 
              padding: 8, 
              marginRight: 8,
              border: '1px solid #ccc',
              borderRadius: '4px'
            }}
          />
          <input
            type="text"
            placeholder="텍스트를 입력..."
            value={docText}
            onChange={(e) => setDocText(e.target.value)}
            style={{ 
              width: '50%', 
              padding: 8, 
              marginRight: 8,
              border: '1px solid #ccc',
              borderRadius: '4px'
            }}
          />
          <button 
            onClick={handleUpsert}
            disabled={upsertLoading || !docId.trim() || !docText.trim()}
            style={{ 
              padding: '8px 16px',
              backgroundColor: upsertLoading ? '#ccc' : '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: upsertLoading ? 'not-allowed' : 'pointer'
            }}
          >
            {upsertLoading ? '등록중...' : '등록'}
          </button>
        </div>
        <p style={{ fontSize: 12, color: '#666', margin: 0 }}>
          * 등록한 문서는 즉시 검색에 반영됩니다.
        </p>
      </div>

      {/* 사용방법 가이드 */}
      <div style={{
        marginTop: 30,
        padding: 20,
        backgroundColor: '#e8f5e9',
        borderRadius: '8px',
        border: '1px solid #c8e6c9'
      }}>
        <h3 style={{ margin: '0 0 12px 0', color: '#2e7d32' }}>📖 사용방법 가이드</h3>
        <ol style={{ margin: 0, paddingLeft: 20, color: '#1b5e20' }}>
          <li style={{ marginBottom: 8 }}>
            <strong>파일 업로드:</strong> PDF, 텍스트, Markdown 파일을 업로드하고 자동으로 청크로 분할
          </li>
          <li style={{ marginBottom: 8 }}>
            <strong>RAG 질문:</strong> 업로드한 문서의 내용에 대해 자연어로 질문
          </li>
          <li style={{ marginBottom: 8 }}>
            <strong>벡터검색:</strong> 의미적 유사성에 기반한 검색 경험
          </li>
          <li style={{ marginBottom: 8 }}>
            <strong>문서관리:</strong> 등록된 문서의 확인 및 삭제
          </li>
        </ol>
      </div>
    </div>
  );
}

export default App;