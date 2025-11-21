import React, { useState, useEffect } from "react";
import { Copy, Trash2, RefreshCw, ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";
import { UploadRecord } from "../types";
import { ImageHostingAPI } from "../api";

interface UploadHistoryProps {
  refreshTrigger: number;
}

export const UploadHistory: React.FC<UploadHistoryProps> = ({ refreshTrigger }) => {
  const [records, setRecords] = useState<UploadRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
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
    if (window.confirm("确定要清空所有上传记录吗？")) {
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
    if (window.confirm("确定要删除这条记录吗？")) {
      try {
        await ImageHostingAPI.deleteUploadRecord(id);
        setRecords(prev => prev.filter(record => record.id !== id));
      } catch (error) {
        console.error("Failed to delete record:", error);
      }
    }
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
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex gap-2">
          <div className="form-control">
            <div className="input-group">
              <input
                type="text"
                placeholder="搜索文件名..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input input-bordered"
              />
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className={`btn btn-square ${isLoading ? 'loading' : ''}`}
              >
                {!isLoading && <RefreshCw className="w-4 h-4 text-base-content" />}
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={handleClearHistory}
          className="btn btn-error btn-outline btn-sm gap-2"
        >
          <Trash2 className="w-4 h-4 text-error" />
          <span className="text-error">清空记录</span>
        </button>
      </div>

      {/* 上传历史列表 */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-2 text-base-content">
                <span className="loading loading-spinner loading-sm"></span>
                <span>加载中...</span>
              </div>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-12">
              <ImageIcon className="w-16 h-16 mx-auto mb-4 text-base-content/40" />
              <h3 className="text-lg font-medium mb-2 text-base-content">
                {searchTerm ? "未找到匹配的记录" : "暂无上传记录"}
              </h3>
              <p className="text-base-content/60">
                {searchTerm ? "尝试使用不同的关键词搜索" : "开始上传您的第一张图片吧！"}
              </p>
            </div>
          ) : (
            <ul className="list bg-base-100 rounded-box shadow-md">
              <li className="p-4 pb-2 text-xs font-bold tracking-wide text-base-content/60 uppercase border-b border-base-200 flex items-center">
                <div className="w-16">缩略图</div>
                <div className="flex-1 px-4">文件名</div>
                <div className="w-24 text-right">大小</div>
                <div className="w-32 text-right px-4">上传时间</div>
                <div className="w-20 text-center">操作</div>
              </li>
              {paginatedHistory.map((item) => (
                <li key={item.id} className="list-row hover:bg-base-200 transition-colors duration-200">
                  <div className="w-16">
                    <div className="avatar">
                      <div className="w-12 h-12 rounded bg-base-300">
                        {item.url ? (
                          <img
                            src={item.url}
                            alt={item.original_filename}
                            className="object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                parent.innerHTML = '<div class="w-full h-full flex items-center justify-center"><svg class="w-6 h-6 opacity-40" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"></path></svg></div>';
                              }
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-6 h-6 text-base-content/40" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 px-4 flex flex-col justify-center min-w-0">
                    <div className="font-medium truncate text-base-content" title={item.original_filename}>
                      {item.original_filename}
                    </div>
                    {item.from_cache && (
                      <div className="badge badge-info badge-xs mt-1">缓存</div>
                    )}
                  </div>
                  <div className="w-24 text-right text-sm text-base-content/70 flex items-center justify-end">
                    {formatFileSize(item.file_size)}
                  </div>
                  <div className="w-32 text-right px-4 text-sm text-base-content/70 flex items-center justify-end">
                    {formatDate(item.upload_time)}
                  </div>
                  <div className="w-20 flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleCopyUrl(item.url)}
                      className="btn btn-ghost btn-xs btn-square"
                      title="复制链接"
                    >
                      <Copy className="w-4 h-4 text-base-content" />
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="btn btn-ghost btn-xs btn-square text-error"
                      title="删除记录"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex justify-center">
          <div className="join">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="join-item btn btn-sm"
            >
              <ChevronLeft className="w-4 h-4 text-base-content" />
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`join-item btn btn-sm ${currentPage === pageNum ? 'btn-active' : ''
                    }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="join-item btn btn-sm"
            >
              <ChevronRight className="w-4 h-4 text-base-content" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};