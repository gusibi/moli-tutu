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
import { useLanguage } from "../contexts/LanguageContext";

interface CompressHistoryProps {
  onPreviewRecord?: (record: CompressRecord) => void;
}

export const CompressHistory: React.FC<CompressHistoryProps> = ({ onPreviewRecord }) => {
  const { t } = useLanguage();
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
      alert(t.compressHistory.restoreFailed);
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
          alert(`✅ ${t.compress.downloadSuccess}\n\n${t.compress.fileName}: ${filename}\n${t.compress.savedTo}: ${downloadPath}`);
        }, 100);
      } else {
        console.warn('无法恢复图片数据');
        alert(t.compressHistory.cannotRestoreData);
      }
    } catch (error) {
      console.error('下载失败:', error);
      alert(t.compress.downloadFailed);
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
          <h2 className="card-title text-2xl mb-6 text-base-content">{t.compressHistory.title}</h2>
          <div className="text-center py-12">
            <History className="w-16 h-16 mx-auto mb-4 text-base-content/40" />
            <p className="text-base-content/60">{t.compressHistory.noRecords}</p>
            <p className="text-sm text-base-content/40 mt-2">{t.compressHistory.recordsWillAppear}</p>
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
          <div className="stat-title">{t.compressHistory.totalCompressions}</div>
          <div className="stat-value text-primary">{records.length}</div>
        </div>

        <div className="stat bg-base-100 rounded-lg shadow-sm">
          <div className="stat-figure text-success">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
            </svg>
          </div>
          <div className="stat-title">{t.compressHistory.avgCompressionRate}</div>
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
          <div className="stat-title">{t.compressHistory.spaceSaved}</div>
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
            <h2 className="card-title text-base-content">{t.compressHistory.title}</h2>
            <div className="flex items-center gap-2">
              <div className="text-sm text-base-content/60">
                {records.length} {t.compressHistory.records}
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
                    title={t.common.debug}
                  >
                    {t.common.debug}
                  </button>
                  <button
                    onClick={handleClearAll}
                    className="btn btn-ghost btn-xs text-error hover:bg-error/10"
                    title={t.compressHistory.clearAll}
                  >
                    <Trash className="w-4 h-4" />
                    {t.compressHistory.clearAll}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <ul className="list bg-base-100 rounded-box shadow-md">
              <li className="p-4 pb-2 text-xs font-bold tracking-wide text-base-content/60 uppercase border-b border-base-200 flex items-center">
                <div className="w-16">{t.history.thumbnail}</div>
                <div className="flex-1 px-4">{t.history.filename}</div>
                <div className="w-24 text-right">{t.compressHistory.originalSize}</div>
                <div className="w-24 text-right">{t.compressHistory.compressedSize}</div>
                <div className="w-20 text-center">{t.compressHistory.compressionRate}</div>
                <div className="w-16 text-center">{t.compressHistory.format}</div>
                <div className="w-16 text-center">{t.compressHistory.quality}</div>
                <div className="w-32 text-right px-4">{t.compressHistory.compressTime}</div>
                <div className="w-32 text-center">{t.history.action}</div>
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
                      title={t.compressHistory.editRestore}
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handlePreview(record)}
                      className="btn btn-ghost btn-xs btn-square"
                      title={t.compressHistory.previewDetails}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDownload(record)}
                      className="btn btn-ghost btn-xs btn-square"
                      title={t.compressHistory.downloadCompressed}
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(record.id, e)}
                      className="btn btn-ghost btn-xs btn-square text-error hover:bg-error/10"
                      title={t.compressHistory.deleteRecord}
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
            <h3 className="font-bold text-lg mb-4">{t.compressHistory.confirmClear}</h3>
            <p className="mb-4">
              {t.compressHistory.confirmClearMessage}
            </p>
            <p className="text-sm text-base-content/60 mb-6">
              {t.compressHistory.clearWarning}
            </p>
            <div className="modal-action">
              <button
                onClick={confirmClearAll}
                className="btn btn-error gap-2"
              >
                <Trash className="w-4 h-4" />
                {t.compressHistory.confirmClear}
              </button>
              <button
                onClick={cancelClearAll}
                className="btn"
              >
                {t.common.cancel}
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
            <h3 className="font-bold text-lg mb-4">{t.compressHistory.confirmDelete}</h3>
            <p className="mb-4">
              {t.compressHistory.confirmDeleteMessage} <span className="font-semibold">{deleteConfirmRecord.originalName}</span>?
            </p>
            <p className="text-sm text-base-content/60 mb-6">
              {t.compressHistory.deleteWarning}
            </p>
            <div className="modal-action">
              <button
                onClick={confirmDelete}
                className="btn btn-error gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {t.compressHistory.confirmDelete}
              </button>
              <button
                onClick={cancelDelete}
                className="btn"
              >
                {t.common.cancel}
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
            <h3 className="font-bold text-lg mb-4">{t.compressHistory.compressionDetails} - {selectedRecord.originalName}</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 压缩信息 */}
              <div className="space-y-4">
                <div className="card bg-base-200">
                  <div className="card-body p-4">
                    <h4 className="font-semibold mb-2">{t.compressHistory.compressionInfo}</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>{t.compressHistory.originalSize}:</span>
                        <span>{formatFileSize(selectedRecord.originalSize)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{t.compressHistory.compressedSize}:</span>
                        <span>{formatFileSize(selectedRecord.compressedSize)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{t.compressHistory.compressionRate}:</span>
                        <span className="text-success">↓ {selectedRecord.compressionRatio.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{t.compressHistory.outputFormat}:</span>
                        <span>{selectedRecord.config.format.toUpperCase()}</span>
                      </div>
                      {selectedRecord.config.format !== 'oxipng' && (
                        <div className="flex justify-between">
                          <span>{t.compressHistory.quality}:</span>
                          <span>{selectedRecord.config.quality}%</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>{t.compressHistory.compressTime}:</span>
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
                    <h4 className="font-semibold mb-2">{t.compressHistory.imagePreview}</h4>
                    {previewImages ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4">
                          <div className="text-center">
                            <h5 className="text-sm font-medium mb-2">{t.compressHistory.originalImage}</h5>
                            <div className="bg-white rounded-lg p-2 shadow-inner">
                              <img
                                src={previewImages.originalUrl}
                                alt={t.compressHistory.originalImage}
                                className="max-w-full max-h-32 mx-auto object-contain"
                              />
                            </div>
                            <p className="text-xs text-base-content/60 mt-1">
                              {formatFileSize(selectedRecord.originalSize)}
                            </p>
                          </div>
                          <div className="text-center">
                            <h5 className="text-sm font-medium mb-2">{t.compressHistory.compressedImage}</h5>
                            <div className="bg-white rounded-lg p-2 shadow-inner">
                              <img
                                src={previewImages.compressedUrl}
                                alt={t.compressHistory.compressedImage}
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
                          <p className="text-sm">{t.compressHistory.noImageData}</p>
                          <p className="text-xs mt-1">{t.compressHistory.largeFileNoPreview}</p>
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
                {t.compressHistory.downloadCompressed}
              </button>
              <button
                onClick={() => setSelectedRecord(null)}
                className="btn"
              >
                {t.common.close}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setSelectedRecord(null)}></div>
        </div>
      )}
    </div>
  );
};