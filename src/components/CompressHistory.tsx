import React, { useState, useEffect } from "react";
import { History, Download, Eye, Trash2, Image as ImageIcon } from "lucide-react";

interface CompressRecord {
  id: string;
  originalName: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  format: string;
  quality?: number;
  compressTime: number;
  originalUrl?: string;
  compressedUrl?: string;
}

export const CompressHistory: React.FC = () => {
  const [records, setRecords] = useState<CompressRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<CompressRecord | null>(null);

  // 模拟数据 - 实际项目中应该从本地存储或API获取
  useEffect(() => {
    const mockRecords: CompressRecord[] = [
      {
        id: '1',
        originalName: 'photo1.jpg',
        originalSize: 2048000,
        compressedSize: 512000,
        compressionRatio: 75,
        format: 'JPEG',
        quality: 80,
        compressTime: Date.now() - 3600000,
      },
      {
        id: '2',
        originalName: 'screenshot.png',
        originalSize: 1536000,
        compressedSize: 384000,
        compressionRatio: 75,
        format: 'WebP',
        quality: 85,
        compressTime: Date.now() - 7200000,
      },
      {
        id: '3',
        originalName: 'banner.png',
        originalSize: 3072000,
        compressedSize: 921600,
        compressionRatio: 70,
        format: 'AVIF',
        quality: 75,
        compressTime: Date.now() - 86400000,
      },
    ];
    setRecords(mockRecords);
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('确定要删除这条压缩记录吗？')) {
      setRecords(prev => prev.filter(record => record.id !== id));
    }
  };

  const handlePreview = (record: CompressRecord) => {
    setSelectedRecord(record);
  };

  const handleDownload = (record: CompressRecord) => {
    // 实际项目中应该从存储中获取压缩后的文件
    alert(`下载功能开发中: ${record.originalName}`);
  };

  if (records.length === 0) {
    return (
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-2xl mb-6 text-base-content">压缩记录</h2>
          <div className="text-center py-12">
            <History className="w-16 h-16 mx-auto mb-4 text-base-content/40" />
            <p className="text-base-content/60">暂无压缩记录</p>
            <p className="text-sm text-base-content/40 mt-2">压缩图片后记录将显示在这里</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 统计信息 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat bg-base-100 rounded-lg shadow-sm">
          <div className="stat-figure text-primary">
            <History className="w-8 h-8" />
          </div>
          <div className="stat-title">总压缩次数</div>
          <div className="stat-value text-primary">{records.length}</div>
        </div>
        
        <div className="stat bg-base-100 rounded-lg shadow-sm">
          <div className="stat-figure text-success">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
            </svg>
          </div>
          <div className="stat-title">平均压缩率</div>
          <div className="stat-value text-success">
            {(records.reduce((sum, record) => sum + record.compressionRatio, 0) / records.length).toFixed(1)}%
          </div>
        </div>
        
        <div className="stat bg-base-100 rounded-lg shadow-sm">
          <div className="stat-figure text-info">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"></path>
            </svg>
          </div>
          <div className="stat-title">节省空间</div>
          <div className="stat-value text-info">
            {formatFileSize(
              records.reduce((sum, record) => sum + (record.originalSize - record.compressedSize), 0)
            )}
          </div>
        </div>
      </div>

      {/* 记录列表 */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <div className="flex justify-between items-center mb-4">
            <h2 className="card-title text-base-content">压缩记录</h2>
            <div className="text-sm text-base-content/60">
              共 {records.length} 条记录
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>文件名</th>
                  <th>原始大小</th>
                  <th>压缩后大小</th>
                  <th>压缩率</th>
                  <th>格式</th>
                  <th>质量</th>
                  <th>压缩时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="avatar">
                          <div className="w-10 h-10 rounded bg-base-200 flex items-center justify-center">
                            <ImageIcon className="w-5 h-5 text-base-content/40" />
                          </div>
                        </div>
                        <div>
                          <div className="font-medium text-base-content max-w-xs truncate" title={record.originalName}>
                            {record.originalName}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="text-base-content/70">
                      {formatFileSize(record.originalSize)}
                    </td>
                    <td className="text-base-content/70">
                      {formatFileSize(record.compressedSize)}
                    </td>
                    <td>
                      <div className={`badge ${
                        record.compressionRatio >= 70 ? 'badge-success' :
                        record.compressionRatio >= 50 ? 'badge-warning' : 'badge-error'
                      } badge-sm`}>
                        ↓ {record.compressionRatio.toFixed(1)}%
                      </div>
                    </td>
                    <td>
                      <div className="badge badge-outline badge-sm">
                        {record.format}
                      </div>
                    </td>
                    <td className="text-base-content/70">
                      {record.quality ? `${record.quality}%` : '-'}
                    </td>
                    <td className="text-sm text-base-content/70">
                      {formatDate(record.compressTime)}
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handlePreview(record)}
                          className="btn btn-ghost btn-xs"
                          title="预览"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownload(record)}
                          className="btn btn-ghost btn-xs"
                          title="下载"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(record.id)}
                          className="btn btn-ghost btn-xs text-error hover:bg-error/10"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 预览模态框 */}
      {selectedRecord && (
        <div className="modal modal-open">
          <div className="modal-box max-w-4xl">
            <h3 className="font-bold text-lg mb-4">压缩详情 - {selectedRecord.originalName}</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 压缩信息 */}
              <div className="space-y-4">
                <div className="card bg-base-200">
                  <div className="card-body p-4">
                    <h4 className="font-semibold mb-2">压缩信息</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>原始大小:</span>
                        <span>{formatFileSize(selectedRecord.originalSize)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>压缩后大小:</span>
                        <span>{formatFileSize(selectedRecord.compressedSize)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>压缩率:</span>
                        <span className="text-success">↓ {selectedRecord.compressionRatio.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>输出格式:</span>
                        <span>{selectedRecord.format}</span>
                      </div>
                      {selectedRecord.quality && (
                        <div className="flex justify-between">
                          <span>质量:</span>
                          <span>{selectedRecord.quality}%</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>压缩时间:</span>
                        <span>{formatDate(selectedRecord.compressTime)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 预览区域 */}
              <div className="space-y-4">
                <div className="card bg-base-200">
                  <div className="card-body p-4">
                    <h4 className="font-semibold mb-2">图片预览</h4>
                    <div className="aspect-square bg-base-100 rounded-lg flex items-center justify-center">
                      <div className="text-center text-base-content/40">
                        <ImageIcon className="w-16 h-16 mx-auto mb-2" />
                        <p>预览功能开发中</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-action">
              <button
                onClick={() => handleDownload(selectedRecord)}
                className="btn btn-primary gap-2"
              >
                <Download className="w-4 h-4" />
                下载压缩图片
              </button>
              <button
                onClick={() => setSelectedRecord(null)}
                className="btn"
              >
                关闭
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setSelectedRecord(null)}></div>
        </div>
      )}
    </div>
  );
};