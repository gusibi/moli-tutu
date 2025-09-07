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

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <FileImage className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No uploads yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold mb-4">Recent Uploads</h2>
      {records.map((record) => (
        <div
          key={record.id}
          className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-2">
                <FileImage className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-900 truncate">
                  {record.original_filename}
                </span>
              </div>
              
              <div className="flex items-center space-x-4 text-xs text-gray-500 mb-2">
                <span className="flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  {ImageHostingAPI.formatDate(record.upload_time)}
                </span>
                <span>{ImageHostingAPI.formatFileSize(record.file_size)}</span>
              </div>
              
              <div className="flex items-center space-x-2">
                <code className="text-xs bg-gray-100 px-2 py-1 rounded flex-1 truncate">
                  {record.url}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(record.url)}
                  className="flex-shrink-0"
                >
                  <Copy className="w-3 h-3" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(record.url, '_blank')}
                  className="flex-shrink-0"
                >
                  <ExternalLink className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};