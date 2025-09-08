import React, { useState, useEffect } from "react";
import { Copy, ExternalLink, Clock, FileImage } from "lucide-react";
import { Button } from "./ui/button";
import { UploadRecord } from "../types";
import { ImageHostingAPI } from "../api";
import { cn } from "../lib/utils";

interface UploadHistoryProps {
  refreshTrigger: number;
}

export const UploadHistory: React.FC<UploadHistoryProps> = ({ refreshTrigger }) => {
  const [records, setRecords] = useState<UploadRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [refreshTrigger]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const history = await ImageHostingAPI.getUploadHistory();
      setRecords(history);
    } catch (error) {
      console.error("Failed to load history:", error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      // You could add a toast notification here
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-3 h-3 rounded-full bg-secondary"></div>
        <h2 className="text-lg font-semibold text-base-content">
          Recent Uploads
        </h2>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center py-12 bg-base-100 rounded-box shadow-sm">
          <div className="w-8 h-8 border-2 border-secondary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : records.length === 0 ? (
        <div className="text-center p-8 bg-base-100 rounded-box shadow-sm">
          <div className="inline-flex p-4 rounded-full bg-secondary/10 mb-4">
            <FileImage className="w-12 h-12 text-secondary/70" />
          </div>
          <h3 className="text-lg font-medium text-base-content/80 mb-2">
            No uploads yet
          </h3>
          <p className="text-base-content/60 max-w-sm mx-auto">
            Your uploaded images will appear here once you start uploading
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map((record) => (
            <div
              key={record.id}
              className="card bg-base-100 border border-base-300 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden"
            >
              <div className="card-body p-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-3">
                      <FileImage className="w-4 h-4 text-base-content/60" />
                      <span className="text-sm font-medium text-base-content truncate">
                        {record.original_filename}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 text-xs text-base-content/70 mb-4">
                      <span className="flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {ImageHostingAPI.formatDate(record.upload_time)}
                      </span>
                      <span>{ImageHostingAPI.formatFileSize(record.file_size)}</span>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-2">
                      <code className="text-xs code flex-1 truncate px-3 py-2 rounded-box bg-base-200">
                        {record.url}
                      </code>
                      <div className="join join-horizontal">
                        <button
                          onClick={() => copyToClipboard(record.url)}
                          className="btn btn-outline btn-xs btn-square join-item hover:bg-base-200"
                          title="Copy URL"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => window.open(record.url, '_blank')}
                          className="btn btn-outline btn-xs btn-square join-item hover:bg-base-200"
                          title="Open in new tab"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};