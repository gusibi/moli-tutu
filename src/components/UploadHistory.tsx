import React, { useState, useEffect } from "react";
import { Copy, Trash2, RefreshCw, ChevronLeft, ChevronRight, Image as ImageIcon, Download, X, ExternalLink } from "lucide-react";
import { UploadRecord } from "../types";
import { ImageHostingAPI } from "../api";
import { useLanguage } from "../contexts/LanguageContext";

interface UploadHistoryProps {
  refreshTrigger: number;
}

export const UploadHistory: React.FC<UploadHistoryProps> = ({ refreshTrigger }) => {
  const { t } = useLanguage();
  const [records, setRecords] = useState<UploadRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [previewRecord, setPreviewRecord] = useState<UploadRecord | null>(null);
  const itemsPerPage = 10;

  useEffect(() => {
    loadHistory();
  }, [refreshTrigger]);

  const loadHistory = async () => {
    try {
      setIsLoading(true);
      const history = await ImageHostingAPI.getUploadHistory();
      setRecords(history);
    } catch (error) {
      console.error("Failed to load history:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    loadHistory();
  };

  const handleClearHistory = async () => {
    if (window.confirm(t.history.confirmClearHistory)) {
      try {
        await ImageHostingAPI.clearUploadHistory();
        setRecords([]);
      } catch (error) {
        console.error("Failed to clear history:", error);
      }
    }
  };

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      // Could add toast notification here
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (window.confirm(t.history.confirmDeleteRecord)) {
      try {
        await ImageHostingAPI.deleteUploadRecord(id);
        setRecords(prev => prev.filter(record => record.id !== id));
      } catch (error) {
        console.error("Failed to delete record:", error);
      }
    }
  };

  const handlePreview = (record: UploadRecord) => {
    setPreviewRecord(record);
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
    } catch (error) {
      console.error("Failed to download:", error);
      // Fallback: open in new tab
      window.open(url, '_blank');
    }
  };

  const handleOpenInNewTab = (url: string) => {
    window.open(url, '_blank');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filter records based on search term
  const filteredHistory = records.filter(record =>
    record.original_filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination
  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedHistory = filteredHistory.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="space-y-6">
      {/* 搜索和操作栏 */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <input
              type="text"
              placeholder={t.history.searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 pl-3 pr-10 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
            />
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="absolute right-1 top-1 h-8 w-8 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <button
          onClick={handleClearHistory}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 text-sm font-medium transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          <span>{t.history.clearHistory}</span>
        </button>
      </div>

      {/* 上传历史列表 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <span className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full"></span>
              <span className="text-sm font-medium">{t.common.loading}</span>
            </div>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="text-center py-12">
            <ImageIcon className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">
              {searchTerm ? t.history.noMatchingRecords : t.history.noUploadHistory}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {searchTerm ? t.history.tryDifferentKeywords : t.history.startUploading}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-xs uppercase text-gray-500 dark:text-gray-400 font-medium">
                <tr>
                  <th className="px-4 py-3 w-20">{t.history.thumbnail}</th>
                  <th className="px-4 py-3">{t.history.filename}</th>
                  <th className="px-4 py-3 text-right w-24">{t.history.size}</th>
                  <th className="px-4 py-3 text-right w-32">{t.history.time}</th>
                  <th className="px-4 py-3 text-center w-24">{t.history.action}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedHistory.map((item) => (
                  <li key={item.id} className="table-row hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => item.url && handlePreview(item)}
                        className="w-12 h-12 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                        title={t.common.preview}
                      >
                        {item.url ? (
                          <img
                            src={item.url}
                            alt={item.original_filename}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                parent.innerHTML = '<svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>';
                              }
                            }}
                          />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-gray-400" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col justify-center">
                        <div className="font-medium truncate max-w-[200px] text-gray-900 dark:text-white" title={item.original_filename}>
                          {item.original_filename}
                        </div>
                        {item.from_cache && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 mt-1 w-fit">
                            Cached
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">
                      {formatFileSize(item.file_size)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">
                      {formatDate(item.upload_time)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleCopyUrl(item.url)}
                          className="p-1.5 rounded-md text-gray-500 hover:text-primary hover:bg-primary/10 transition-colors"
                          title={t.history.copyLink}
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1.5 rounded-md text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title={t.common.delete}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </li>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex justify-center pt-4">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${currentPage === pageNum
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 图片预览模态框 */}
      {previewRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="relative max-w-4xl w-full mx-4 bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden">
            {/* 头部 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                  {previewRecord.original_filename}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {formatFileSize(previewRecord.file_size)} • {formatDate(previewRecord.upload_time)}
                </p>
              </div>
              <button
                onClick={() => setPreviewRecord(null)}
                className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 图片预览区域 */}
            <div className="relative bg-gray-100 dark:bg-gray-900 flex items-center justify-center" style={{ minHeight: '400px', maxHeight: '60vh' }}>
              <img
                src={previewRecord.url}
                alt={previewRecord.original_filename}
                className="max-w-full max-h-[60vh] object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    parent.innerHTML = `
                      <div class="flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 py-12">
                        <svg class="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                        </svg>
                        <p class="text-sm">Failed to load image</p>
                      </div>
                    `;
                  }
                }}
              />
            </div>

            {/* 底部操作栏 */}
            <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={previewRecord.url}
                  readOnly
                  className="w-64 h-9 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 truncate"
                />
                <button
                  onClick={() => handleCopyUrl(previewRecord.url)}
                  className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-medium transition-colors"
                  title={t.history.copyLink}
                >
                  <Copy className="w-4 h-4" />
                  {t.history.copyLink}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenInNewTab(previewRecord.url)}
                  className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
                  title={t.history.openInNewTab}
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDownload(previewRecord.url, previewRecord.original_filename)}
                  className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-white hover:bg-primary/90 text-sm font-medium transition-colors"
                >
                  <Download className="w-4 h-4" />
                  {t.common.download}
                </button>
              </div>
            </div>
          </div>

          {/* 点击背景关闭 */}
          <div
            className="absolute inset-0 -z-10"
            onClick={() => setPreviewRecord(null)}
          />
        </div>
      )}
    </div>
  );
};