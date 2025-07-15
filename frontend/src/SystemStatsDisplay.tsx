import React, { useState, useEffect } from 'react';
import { getSystemStats, SystemStats } from './api';

interface SystemStatsDisplayProps {
  refreshTrigger: number;
}

const SystemStatsDisplay: React.FC<SystemStatsDisplayProps> = ({ refreshTrigger }) => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const loadStats = async () => {
    setLoading(true);
    setError('');
    try {
      const systemStats = await getSystemStats();
      setStats(systemStats);
    } catch (error: any) {
      console.error('Failed to load stats:', error);
      setError('통계 정보 로드에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [refreshTrigger]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '20px' }}>
        📊 통계 정보를 읽는 중...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '16px',
        backgroundColor: '#ffebee',
        borderRadius: '8px',
        color: '#c62828',
        margin: '16px 0'
      }}>
        ❌ {error}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div style={{ 
      background: '#f5f5f5', 
      padding: '20px', 
      borderRadius: '8px',
      margin: '16px 0',
      border: '1px solid #e0e0e0'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <h3 style={{ margin: 0 }}>📊 시스템 통계</h3>
        <button
          onClick={loadStats}
          style={{
            padding: '6px 12px',
            backgroundColor: '#fff',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          🔄 更新
        </button>
      </div>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '16px',
        marginBottom: '16px'
      }}>
        <div style={{
          padding: '16px',
          backgroundColor: '#fff',
          borderRadius: '8px',
          textAlign: 'center',
          border: '1px solid #e0e0e0'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1976d2' }}>
            {stats.totalDocuments}
          </div>
          <div style={{ fontSize: '14px', color: '#666' }}>
            📄 등록 문서 수
          </div>
        </div>
        
        <div style={{
          padding: '16px',
          backgroundColor: '#fff',
          borderRadius: '8px',
          textAlign: 'center',
          border: '1px solid #e0e0e0'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#388e3c' }}>
            {stats.vectorsCount}
          </div>
          <div style={{ fontSize: '14px', color: '#666' }}>
            🔢 벡터수
          </div>
        </div>
        
        <div style={{
          padding: '16px',
          backgroundColor: '#fff',
          borderRadius: '8px',
          textAlign: 'center',
          border: '1px solid #e0e0e0'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f57c00' }}>
            {stats.indexedVectorsCount}
          </div>
          <div style={{ fontSize: '14px', color: '#666' }}>
            🏷️ 인덱스됨
          </div>
        </div>
        
        <div style={{
          padding: '16px',
          backgroundColor: '#fff',
          borderRadius: '8px',
          textAlign: 'center',
          border: '1px solid #e0e0e0'
        }}>
          <div style={{ 
            fontSize: '16px', 
            fontWeight: 'bold', 
            color: stats.collectionStatus === 'green' ? '#388e3c' : '#d32f2f'
          }}>
            {stats.collectionStatus === 'green' ? '✅ 정상' : '⚠️ 비정상'}
          </div>
          <div style={{ fontSize: '14px', color: '#666' }}>
            🔧 시스템 상태
          </div>
        </div>
      </div>

      {/* 파일 종류의 통계 */}
      {Object.keys(stats.fileTypes).length > 0 && (
        <div style={{
          padding: '16px',
          backgroundColor: '#fff',
          borderRadius: '8px',
          border: '1px solid #e0e0e0'
        }}>
          <h4 style={{ margin: '0 0 12px 0', color: '#333' }}>📂 파일 종류</h4>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
            gap: '8px'
          }}>
            {Object.entries(stats.fileTypes).map(([fileType, count]) => (
              <div key={fileType} style={{
                padding: '8px 12px',
                backgroundColor: '#f5f5f5',
                borderRadius: '4px',
                fontSize: '13px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>{getFileTypeIcon(fileType)} {getFileTypeName(fileType)}</span>
                <span style={{ fontWeight: 'bold', color: '#1976d2' }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ 
        fontSize: '12px', 
        color: '#666', 
        textAlign: 'center',
        marginTop: '16px'
      }}>
        최종업데이트: {new Date(stats.lastUpdate).toLocaleString('ko-KR')}
      </div>
    </div>
  );
};

// 헬퍼 함수
function getFileTypeIcon(fileType: string): string {
  switch (fileType) {
    case 'application/pdf':
      return '📕';
    case 'text/plain':
      return '📄';
    case 'text/markdown':
      return '📝';
    default:
      return '📄';
  }
}

function getFileTypeName(fileType: string): string {
  switch (fileType) {
    case 'application/pdf':
      return 'PDF';
    case 'text/plain':
      return '텍스트';
    case 'text/markdown':
      return 'Markdown';
    default:
      return fileType;
  }
}

export default SystemStatsDisplay;
