import React, { useState, useEffect } from "react";
import { History, Download, Eye, Trash2, Image as ImageIcon, Edit3, Trash } from "lucide-react";
import { CompressRecord } from "../types/compress";
import {
  getCompressRecords,
  deleteCompressRecord,
  restoreImagesFromRecord,
  clearAllCompressRecords,
  testLocalStorage
} from "../utils/compressStorage";

interface CompressHistoryProps {
  onPreviewRecord?: (record: CompressRecord) => void;
}

export const CompressHistory: React.FC<CompressHistoryProps> = ({ onPreviewRecord }) => {
  const [records, setRecords] = useState<CompressRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<CompressRecord | null>(null);
  const [previewImages, setPreviewImages] = useState<{
    originalUrl: string;
    compressedUrl: string;
  } | null>(null);
  const [deleteConfirmRecord, setDeleteConfirmRecord] = useState<CompressRecord | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);

  // 从本地存储加载压缩记录
  useEffect(() => {
    const loadRecords = () => {
      // 测试 localStorage
      const isStorageWorking = testLocalStorage();
      if (!isStorageWorking) {
        console.error('localStorage 不可用！');
        alert('localStorage 不可用，请检查浏览器设置');
        return;
      }

      const storedRecords = getCompressRecords();
      console.log('加载压缩记录:', storedRecords.length, '条记录');
      setRecords(storedRecords);
    };

    loadRecords();

    // 监听存储变化
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'compress_history') {
        console.log('检测到存储变化，重新加载记录');
        loadRecords();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
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

  const handleDelete = async (id: string, event?: React.MouseEvent) => {
    console.log('用户点击删除按钮，记录ID:', id);

    // 防止事件冒泡
    event?.preventDefault();
    event?.stopPropagation();

    // 找到要删除的记录
    const recordToDelete = records.find(record => record.id === id);
    if (!recordToDelete) {
      console.error('未找到要删除的记录:', id);
      alert('记录不存在');
      return;
    }

    // 显示确认对话框
    setDeleteConfirmRecord(recordToDelete);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmRecord) return;

    const id = deleteConfirmRecord.id;
    console.log('用户确认删除，开始执行删除操作...');

    try {
      await deleteCompressRecord(id);

      console.log('更新React状态...');
      setRecords(prev => {
        const newRecords = prev.filter(record => record.id !== id);
        console.log('记录删除成功:', id, '剩余记录数:', newRecords.length);
        return newRecords;
      });

      // 如果删除的是当前预览的记录，关闭预览
      if (selectedRecord && selectedRecord.id === id) {
        console.log('关闭当前预览的记录');
        setSelectedRecord(null);
        if (previewImages) {
          URL.revokeObjectURL(previewImages.originalUrl);
          URL.revokeObjectURL(previewImages.compressedUrl);
          setPreviewImages(null);
        }
      }

      console.log('删除操作完成');
    } catch (error) {
      console.error('删除记录失败:', error);
      alert(`删除失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setDeleteConfirmRecord(null);
    }
  };

  const cancelDelete = () => {
    console.log('用户取消了删除操作');
    setDeleteConfirmRecord(null);
  };

  const handleClearAll = async () => {
    console.log('用户点击清空按钮');
    setShowClearAllConfirm(true);
  };

  const confirmClearAll = async () => {
    console.log('用户确认清空所有记录');
    try {
      await clearAllCompressRecords();
      setRecords([]);
      // 关闭预览窗口
      if (selectedRecord) {
        setSelectedRecord(null);
        if (previewImages) {
          URL.revokeObjectURL(previewImages.originalUrl);
          URL.revokeObjectURL(previewImages.compressedUrl);
          setPreviewImages(null);
        }
      }
      console.log('清空操作完成');
    } catch (error) {
      console.error('清空记录失败:', error);
      alert('清空失败，请重试');
    } finally {
      setShowClearAllConfirm(false);
    }
  };

  const cancelClearAll = () => {
    console.log('用户取消清空操作');
    setShowClearAllConfirm(false);
  };

  const handlePreview = async (record: CompressRecord) => {
    console.log('开始预览记录:', record.id, record.originalName);
    setSelectedRecord(record);

    // 先清理之前的图片URL
    if (previewImages) {
      URL.revokeObjectURL(previewImages.originalUrl);
      URL.revokeObjectURL(previewImages.compressedUrl);
      setPreviewImages(null);
    }

    // 恢复图片数据用于预览
    try {
      const images = await restoreImagesFromRecord(record);
      if (images) {
        const originalUrl = URL.createObjectURL(images.originalFile);
        const compressedUrl = URL.createObjectURL(images.compressedBlob);
        setPreviewImages({ originalUrl, compressedUrl });
        console.log('图片预览数据恢复成功');
      } else {
        console.warn('无法恢复图片数据 - 可能是大文件或数据损坏');
        setPreviewImages(null);
      }
    } catch (error) {
      console.error('恢复图片数据时发生错误:', error);
      setPreviewImages(null);
    }
  };

  const handleEditRecord = (record: CompressRecord) => {
    console.log('尝试编辑记录:', record.id, record.originalName);
    // 调用父组件的回调，跳转到编辑页面
    if (onPreviewRecord) {
      console.log('调用父组件回调');
      onPreviewRecord(record);
    } else {
      console.warn('父组件回调函数不存在');
      alert('编辑功能不可用，请检查父组件配置');
    }
  };

  const handleDownload = async (record: CompressRecord) => {
    console.log('尝试下载压缩图片:', record.originalName);
    try {
      const images = await restoreImagesFromRecord(record);
      if (images) {
        const extension = record.config.format === 'mozjpeg' ? 'jpg' :
          record.config.format === 'oxipng' ? 'png' :
            record.config.format;
        const filename = `${record.originalName.split('.')[0]}_compressed.${extension}`;

        const blobUrl = URL.createObjectURL(images.compressedBlob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();

        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(blobUrl);

          const downloadPath = navigator.userAgent.includes('Mac') ? '~/Downloads' :
            navigator.userAgent.includes('Windows') ? '%USERPROFILE%\\Downloads' :
              '~/Downloads';

          console.log('下载成功:', filename);
          alert(`✅ 下载成功！\n\n文件名: ${filename}\n存储位置: ${downloadPath}`);
        }, 100);
      } else {
        console.warn('无法恢复图片数据');
        alert('无法恢复图片数据，请重新压缩');
      }
    } catch (error) {
      console.error('下载失败:', error);
      alert('下载失败，请重试');
    }
  };

  // 清理预览图片URL
  useEffect(() => {
    return () => {
      if (previewImages) {
        URL.revokeObjectURL(previewImages.originalUrl);
        URL.revokeObjectURL(previewImages.compressedUrl);
      }
    };
  }, [previewImages]);

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
            <div className="flex items-center gap-2">
              <div className="text-sm text-base-content/60">
                共 {records.length} 条记录
              </div>
              {records.length > 0 && (
                <>
                  <button
                    onClick={() => {
                      console.log('调试信息:');
                      console.log('- 当前记录数:', records.length);
                      console.log('- localStorage 测试:', testLocalStorage());
                      const rawData = localStorage.getItem('compress_history');
                      console.log('- localStorage 原始数据:', rawData);
                      if (rawData) {
                        try {
                          const parsed = JSON.parse(rawData);
                          console.log('- 解析后的数据:', parsed);
                        } catch (e) {
                          console.log('- 解析错误:', e);
                        }
                      }
                    }}
                    className="btn btn-ghost btn-xs text-info"
                    title="调试信息"
                  >
                    调试
                  </button>
                  <button
                    onClick={handleClearAll}
                    className="btn btn-ghost btn-xs text-error hover:bg-error/10"
                    title="清空所有记录"
                  >
                    <Trash className="w-4 h-4" />
                    清空
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <ul className="list bg-base-100 rounded-box shadow-md">
              <li className="p-4 pb-2 text-xs font-bold tracking-wide text-base-content/60 uppercase border-b border-base-200 flex items-center">
                <div className="w-16">缩略图</div>
                <div className="flex-1 px-4">文件名</div>
                <div className="w-24 text-right">原始大小</div>
                <div className="w-24 text-right">压缩后</div>
                <div className="w-20 text-center">压缩率</div>
                <div className="w-16 text-center">格式</div>
                <div className="w-16 text-center">质量</div>
                <div className="w-32 text-right px-4">压缩时间</div>
                <div className="w-32 text-center">操作</div>
              </li>
              {records.map((record) => (
                <li key={record.id} className="list-row hover:bg-base-200 transition-colors duration-200">
                  <div className="w-16">
                    <div className="avatar">
                      <div className="w-12 h-12 rounded bg-base-200 flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-base-content/40" />
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 px-4 flex flex-col justify-center min-w-0">
                    <div className="font-medium text-base-content truncate" title={record.originalName}>
                      {record.originalName}
                    </div>
                  </div>
                  <div className="w-24 text-right text-sm text-base-content/70 flex items-center justify-end">
                    {formatFileSize(record.originalSize)}
                  </div>
                  <div className="w-24 text-right text-sm text-base-content/70 flex items-center justify-end">
                    {formatFileSize(record.compressedSize)}
                  </div>
                  <div className="w-20 flex items-center justify-center">
                    <div className={`badge ${record.compressionRatio >= 70 ? 'badge-success' :
                      record.compressionRatio >= 50 ? 'badge-warning' : 'badge-error'
                      } badge-sm`}>
                      ↓ {record.compressionRatio.toFixed(1)}%
                    </div>
                  </div>
                  <div className="w-16 flex items-center justify-center">
                    <div className="badge badge-outline badge-xs">
                      {record.config.format.toUpperCase()}
                    </div>
                  </div>
                  <div className="w-16 text-center text-sm text-base-content/70 flex items-center justify-center">
                    {record.config.format !== 'oxipng' ? `${record.config.quality}%` : '-'}
                  </div>
                  <div className="w-32 text-right px-4 text-sm text-base-content/70 flex items-center justify-end">
                    {formatDate(record.compressTime)}
                  </div>
                  <div className="w-32 flex items-center justify-center gap-1">
                    <button
                      onClick={() => handleEditRecord(record)}
                      className="btn btn-ghost btn-xs btn-square text-primary hover:bg-primary/10"
                      title="编辑 - 恢复到编辑器"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handlePreview(record)}
                      className="btn btn-ghost btn-xs btn-square"
                      title="预览详情"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDownload(record)}
                      className="btn btn-ghost btn-xs btn-square"
                      title="下载压缩图片"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(record.id, e)}
                      className="btn btn-ghost btn-xs btn-square text-error hover:bg-error/10"
                      title="删除记录"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* 清空确认模态框 */}
      {showClearAllConfirm && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">确认清空</h3>
            <p className="mb-4">
              确定要清空所有压缩记录吗？
            </p>
            <p className="text-sm text-base-content/60 mb-6">
              此操作不可恢复，所有记录和相关的临时文件都将被删除。
            </p>
            <div className="modal-action">
              <button
                onClick={confirmClearAll}
                className="btn btn-error gap-2"
              >
                <Trash className="w-4 h-4" />
                确认清空
              </button>
              <button
                onClick={cancelClearAll}
                className="btn"
              >
                取消
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={cancelClearAll}></div>
        </div>
      )}

      {/* 删除确认模态框 */}
      {deleteConfirmRecord && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">确认删除</h3>
            <p className="mb-4">
              确定要删除压缩记录 <span className="font-semibold">{deleteConfirmRecord.originalName}</span> 吗？
            </p>
            <p className="text-sm text-base-content/60 mb-6">
              此操作不可恢复，相关的临时文件也将被删除。
            </p>
            <div className="modal-action">
              <button
                onClick={confirmDelete}
                className="btn btn-error gap-2"
              >
                <Trash2 className="w-4 h-4" />
                确认删除
              </button>
              <button
                onClick={cancelDelete}
                className="btn"
              >
                取消
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={cancelDelete}></div>
        </div>
      )}

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
                        <span>{selectedRecord.config.format.toUpperCase()}</span>
                      </div>
                      {selectedRecord.config.format !== 'oxipng' && (
                        <div className="flex justify-between">
                          <span>质量:</span>
                          <span>{selectedRecord.config.quality}%</span>
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
                    {previewImages ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4">
                          <div className="text-center">
                            <h5 className="text-sm font-medium mb-2">原始图片</h5>
                            <div className="bg-white rounded-lg p-2 shadow-inner">
                              <img
                                src={previewImages.originalUrl}
                                alt="原始图片"
                                className="max-w-full max-h-32 mx-auto object-contain"
                              />
                            </div>
                            <p className="text-xs text-base-content/60 mt-1">
                              {formatFileSize(selectedRecord.originalSize)}
                            </p>
                          </div>
                          <div className="text-center">
                            <h5 className="text-sm font-medium mb-2">压缩后</h5>
                            <div className="bg-white rounded-lg p-2 shadow-inner">
                              <img
                                src={previewImages.compressedUrl}
                                alt="压缩后图片"
                                className="max-w-full max-h-32 mx-auto object-contain"
                              />
                            </div>
                            <p className="text-xs text-base-content/60 mt-1">
                              {formatFileSize(selectedRecord.compressedSize)}
                              <span className="text-success ml-1">(-{selectedRecord.compressionRatio.toFixed(1)}%)</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="aspect-square bg-base-100 rounded-lg flex items-center justify-center">
                        <div className="text-center text-base-content/40">
                          <ImageIcon className="w-12 h-12 mx-auto mb-2" />
                          <p className="text-sm">无图片数据</p>
                          <p className="text-xs mt-1">大文件不保存预览数据</p>
                        </div>
                      </div>
                    )}
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