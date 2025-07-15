import React, { useState } from 'react';
import { uploadFile } from './api';

interface FileUploadProps {
  onUploadSuccess: (result: any) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onUploadSuccess }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 지원되는 파일 형식 확인
    const supportedTypes = ['application/pdf', 'text/plain', 'text/markdown'];
    if (!supportedTypes.includes(file.type)) {
      setError('지원되지 않는 파일 형식입니다. PDF, 텍스트 파일, Markdown 파일만 지원합니다.');
      return;
    }

    // 파일 크기 확인 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('파일 크기가 너무 큽니다. 10MB 이하의 파일을 선택해주세요.');
      return;
    }

    setUploading(true);
    setError('');
    setUploadResult('');

    try {
      console.log('📤 파일을 업로드 중...', file.name);
      const result = await uploadFile(file);
      
      setUploadResult(
        `✅ ${result.filename} 을 ${result.totalChunks} 청크로 나누어 등록했습니다`
      );
      
      onUploadSuccess(result);
      
      // 파일 입력을 리셋
      event.target.value = '';
    } catch (error: any) {
      console.error('Upload error:', error);
      setError(
        `❌ 업로드에 실패했습니다: ${error.response?.data?.error || error.message}`
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ 
      border: '2px dashed #ccc', 
      borderRadius: '8px', 
      padding: '20px', 
      margin: '16px 0',
      textAlign: 'center',
      backgroundColor: '#fafafa'
    }}>
      <h3 style={{ margin: '0 0 16px 0' }}>📁 파일 업로드</h3>
      
      <input
        type="file"
        accept=".pdf,.txt,.md"
        onChange={handleFileUpload}
        disabled={uploading}
        style={{
          margin: '8px',
          padding: '8px',
          borderRadius: '4px',
          border: '1px solid #ccc'
        }}
      />
      
      <div style={{ marginTop: '12px', fontSize: '14px', color: '#666' }}>
        지원형식: PDF, 텍스트 (.txt), Markdown (.md)
        <br />
        최대파일크기: 10MB
      </div>
      
      {uploading && (
        <div style={{ 
          marginTop: '12px', 
          padding: '8px', 
          backgroundColor: '#e3f2fd',
          borderRadius: '4px',
          color: '#1976d2'
        }}>
          📤 처리중... 파일을 읽고 청크로 나누는 중입니다
        </div>
      )}
      
      {uploadResult && (
        <div style={{ 
          marginTop: '12px', 
          padding: '8px', 
          backgroundColor: '#e8f5e8',
          borderRadius: '4px',
          color: '#2e7d32'
        }}>
          {uploadResult}
        </div>
      )}
      
      {error && (
        <div style={{ 
          marginTop: '12px', 
          padding: '8px', 
          backgroundColor: '#ffebee',
          borderRadius: '4px',
          color: '#c62828'
        }}>
          {error}
        </div>
      )}
    </div>
  );
};

export default FileUpload;
