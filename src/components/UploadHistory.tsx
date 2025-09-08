import React, { useState, useEffect } from "react";
import { Copy, Trash2, Search, RefreshCw, ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";
// import { Button } from "./ui/button";
import { UploadRecord } from "../types";
import { ImageHostingAPI } from "../api";
import { cn } from "../lib/utils";

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
    <div className="space-y-4">
      {/* Search and Actions */}
      <div className="mb-4 flex justify-between items-center">
        <div className="flex space-x-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="搜索文件名..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={handleClearHistory}
          className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
        >
          <Trash2 className="w-4 h-4 mr-2 inline" />
          清空记录
        </button>
      </div>

      {/* Upload History Table */}
      <div className="overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2 text-gray-600">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>加载中...</span>
            </div>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="text-center py-8">
            <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm ? "未找到匹配的记录" : "暂无上传记录"}
            </h3>
            <p className="text-gray-500">
              {searchTerm ? "尝试使用不同的关键词搜索" : "开始上传您的第一张图片吧！"}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">缩略图</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">文件名</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">大小</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">上传时间</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">操作</th>
              </tr>
            </thead>
            <tbody>
              {paginatedHistory.map((item) => (
                <tr 
                  key={item.id} 
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="py-3 px-4">
                    <div className="w-12 h-12 rounded overflow-hidden bg-gray-100 flex items-center justify-center">
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
                              parent.innerHTML = '<svg class="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"></path></svg>';
                            }
                          }}
                        />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-900">
                    <div className="truncate max-w-xs" title={item.original_filename}>
                      {item.original_filename}
                    </div>
                    {item.from_cache && (
                      <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded mt-1">
                        缓存
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {formatFileSize(item.file_size)}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {formatDate(item.upload_time)}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleCopyUrl(item.url)}
                        className="text-indigo-600 hover:text-indigo-800"
                        title="复制链接"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="text-red-600 hover:text-red-800"
                        title="删除记录"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex justify-center">
          <nav className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={cn(
                    "px-3 py-2 rounded",
                    currentPage === pageNum 
                      ? "bg-indigo-600 text-white" 
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  {pageNum}
                </button>
              );
            })}
            
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </nav>
        </div>
      )}
    </div>
  );
};