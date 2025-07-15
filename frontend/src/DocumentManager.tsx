import React, { useState, useEffect } from 'react';
import { getDocuments, deleteDocument, Document } from './api';

interface DocumentManagerProps {
  refreshTrigger: number;
}

const DocumentManager: React.FC<DocumentManagerProps> = ({ refreshTrigger }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());

  const loadDocuments = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getDocuments(100, 0);
      setDocuments(result.documents);
    } catch (error: any) {
      console.error('Failed to load documents:', error);
      setError('문서 로드에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [refreshTrigger]);

  const handleDeleteDocument = async (id: string) => {
    if (!confirm('이 문서를 삭제하시겠습니까?')) return;

    try {
      await deleteDocument(id);
      setDocuments(docs => docs.filter(doc => doc.id !== id));
      setSelectedDocs(selected => {
        const newSelected = new Set(selected);
        newSelected.delete(id);
        return newSelected;
      });
    } catch (error: any) {
      console.error('Delete error:', error);
      setError(`삭제에 실패했습니다: ${error.response?.data?.error || error.message}`);
    }
  };

  const toggleDocSelection = (id: string) => {
    setSelectedDocs(selected => {
      const newSelected = new Set(selected);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      return newSelected;
    });
  };

  const groupedDocuments = documents.reduce((groups: Record<string, Document[]>, doc) => {
    const sourceFile = doc.metadata?.sourceFile || '기타';
    if (!groups[sourceFile]) {
      groups[sourceFile] = [];
    }
    groups[sourceFile].push(doc);
    return groups;
  }, {});

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '20px' }}>
        📚 문서를 읽는 중...
      </div>
    );
  }

  return (
    <div style={{ 
      border: '1px solid #ddd', 
      borderRadius: '8px', 
      padding: '20px', 
      margin: '16px 0',
      backgroundColor: '#fff'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <h3 style={{ margin: 0 }}>📚 등록된 문서 ({documents.length}건)</h3>
        <button
          onClick={loadDocuments}
          style={{
            padding: '6px 12px',
            backgroundColor: '#f5f5f5',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          🔄 업데이트
        </button>
      </div>

      {error && (
        <div style={{
          padding: '12px',
          backgroundColor: '#ffebee',
          borderRadius: '4px',
          color: '#c62828',
          marginBottom: '16px'
        }}>
          {error}
        </div>
      )}

      {documents.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px 20px',
          color: '#666',
          backgroundColor: '#f9f9f9',
          borderRadius: '4px'
        }}>
          📄 아직 문서가 등록되지 않았습니다
          <br />
          <small>위의 파일 업로드 기능을 사용하여 문서를 추가하세요</small>
        </div>
      ) : (
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {Object.entries(groupedDocuments).map(([sourceFile, docs]) => (
            <div key={sourceFile} style={{ marginBottom: '20px' }}>
              <h4 style={{ 
                margin: '0 0 8px 0', 
                color: '#333',
                padding: '8px',
                backgroundColor: '#f0f0f0',
                borderRadius: '4px',
                fontSize: '14px'
              }}>
                📁 {sourceFile} ({docs.length}청크)
              </h4>
              
              {docs.map((doc) => (
                <div key={doc.id} style={{ 
                  border: '1px solid #eee', 
                  margin: '4px 0', 
                  padding: '12px',
                  borderRadius: '4px',
                  backgroundColor: selectedDocs.has(doc.id) ? '#e3f2fd' : '#fafafa'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '8px'
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        marginBottom: '4px'
                      }}>
                        <input
                          type="checkbox"
                          checked={selectedDocs.has(doc.id)}
                          onChange={() => toggleDocSelection(doc.id)}
                          style={{ marginRight: '8px' }}
                        />
                        <strong style={{ fontSize: '13px', color: '#333' }}>
                          {doc.id}
                        </strong>
                      </div>
                      
                      {doc.metadata && (
                        <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>
                          {doc.metadata.fileType && (
                            <span style={{ marginRight: '12px' }}>
                              📄 {doc.metadata.fileType}
                            </span>
                          )}
                          {doc.metadata.chunkIndex && (
                            <span style={{ marginRight: '12px' }}>
                              🔢 청크 {doc.metadata.chunkIndex}
                            </span>
                          )}
                          {doc.created_at && (
                            <span>
                              📅 {new Date(doc.created_at).toLocaleString('ko-KR')}
                            </span>
                          )}
                        </div>
                      )}
                      
                      <div style={{ 
                        fontSize: '12px', 
                        color: '#555',
                        lineHeight: '1.4',
                        maxHeight: '60px',
                        overflow: 'hidden'
                      }}>
                        {doc.text.length > 150 
                          ? doc.text.substring(0, 150) + '...' 
                          : doc.text}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleDeleteDocument(doc.id)}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#ffebee',
                        color: '#c62828',
                        border: '1px solid #ffcdd2',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        marginLeft: '8px'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = '#ffcdd2';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = '#ffebee';
                      }}
                    >
                      🗑️ 삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DocumentManager;
