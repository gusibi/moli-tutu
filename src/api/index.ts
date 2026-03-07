import { invoke } from "@tauri-apps/api/core";
import { ApiProxyStatus, StorageConfig, StorageConfigList, UploadRecord, UploadResult } from "../types";

export class ImageHostingAPI {
  static async saveStorageConfig(config: StorageConfig): Promise<void> {
    console.log('[API] Saving storage config:', {
      provider: config.provider,
      endpoint: config.endpoint || 'N/A',
      bucket: config.bucket_name || 'N/A',
    });
    try {
      // Use save_storage_config (new command) which falls through to save_r2_config
      const result = await invoke("save_storage_config", { config });
      console.log('[API] Storage config saved successfully');
      return result as void;
    } catch (error) {
      console.error('[API] Failed to save storage config:', error);
      throw error;
    }
  }

  // Backward compatible alias
  static async saveR2Config(config: StorageConfig): Promise<void> {
    return this.saveStorageConfig(config);
  }

  static async getStorageConfig(): Promise<StorageConfig | null> {
    console.log('[API] Getting storage config...');
    try {
      const result = await invoke("get_storage_config");
      console.log('[API] Storage config retrieved:', result ? 'config exists' : 'no config found');
      return result as StorageConfig | null;
    } catch (error) {
      console.error('[API] Failed to get storage config:', error);
      throw error;
    }
  }

  // Backward compatible alias
  static async getR2Config(): Promise<StorageConfig | null> {
    return this.getStorageConfig();
  }

  static async getStorageConfigList(): Promise<StorageConfigList> {
    console.log('[API] Getting storage config list...');
    try {
      const result = await invoke("get_storage_config_list");
      return result as StorageConfigList;
    } catch (error) {
      console.error('[API] Failed to get storage config list:', error);
      throw error;
    }
  }

  static async deleteStorageConfig(id: string): Promise<StorageConfigList> {
    console.log('[API] Deleting storage config:', id);
    try {
      const result = await invoke("delete_storage_config", { id });
      return result as StorageConfigList;
    } catch (error) {
      console.error('[API] Failed to delete storage config:', error);
      throw error;
    }
  }

  static async setActiveStorageConfig(id: string): Promise<StorageConfigList> {
    console.log('[API] Setting active storage config:', id);
    try {
      const result = await invoke("set_active_storage_config", { id });
      return result as StorageConfigList;
    } catch (error) {
      console.error('[API] Failed to set active storage config:', error);
      throw error;
    }
  }

  static async getApiProxyStatus(): Promise<ApiProxyStatus> {
    console.log('[API] Getting API proxy status...');
    try {
      const result = await invoke("get_api_proxy_status");
      return result as ApiProxyStatus;
    } catch (error) {
      console.error('[API] Failed to get API proxy status:', error);
      throw error;
    }
  }

  static async setApiProxyEnabled(enabled: boolean, port?: number): Promise<ApiProxyStatus> {
    console.log('[API] Setting API proxy enabled:', { enabled, port });
    try {
      const result = await invoke("set_api_proxy_enabled", { enabled, port });
      return result as ApiProxyStatus;
    } catch (error) {
      console.error('[API] Failed to set API proxy enabled:', error);
      throw error;
    }
  }

  static async uploadImage(
    fileData: Uint8Array,
    filename: string
  ): Promise<UploadResult> {
    console.log('[API] Starting upload_image invoke:', {
      filename,
      dataSize: fileData.length,
    });

    try {
      const startTime = Date.now();
      const result = await invoke("upload_image", {
        fileData: Array.from(fileData),
        filename
      });
      const endTime = Date.now();

      console.log('[API] Upload invoke completed:', {
        duration: `${endTime - startTime}ms`,
        success: (result as any).success,
        url: (result as any).url,
        error: (result as any).error,
        fromCache: (result as any).from_cache
      });

      return {
        success: (result as any).success,
        url: (result as any).url,
        error: (result as any).error,
        from_cache: (result as any).from_cache
      };
    } catch (error) {
      console.error('[API] Upload invoke failed:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
        from_cache: false
      };
    }
  }

  static async getUploadHistory(): Promise<UploadRecord[]> {
    console.log('[API] Getting upload history...');
    try {
      const result = await invoke("get_upload_history");
      const records = result as UploadRecord[] || [];
      console.log('[API] Upload history retrieved:', `${records.length} records`);
      return records;
    } catch (error) {
      console.error('[API] Failed to get upload history:', error);
      return [];
    }
  }

  static async clearUploadHistory(): Promise<void> {
    console.log('[API] Clearing upload history...');
    try {
      await invoke("clear_upload_history");
      console.log('[API] Upload history cleared successfully');
    } catch (error) {
      console.error('[API] Failed to clear upload history:', error);
      throw error;
    }
  }

  static async deleteUploadRecord(id: string): Promise<void> {
    console.log('[API] Deleting upload record:', id);
    try {
      await invoke("delete_upload_record", { id });
      console.log('[API] Upload record deleted successfully');
    } catch (error) {
      console.error('[API] Failed to delete upload record:', error);
      throw error;
    }
  }

  static async getClipboardImage(): Promise<Uint8Array | null> {
    console.log('[API] Getting clipboard image...');
    try {
      const result = await invoke<number[] | null>("get_clipboard_image");
      console.log('[API] Clipboard image result:', result ? `${result.length} bytes` : 'no image');
      return result ? new Uint8Array(result) : null;
    } catch (error) {
      console.error('[API] Failed to get clipboard image:', error);
      throw error;
    }
  }

  static async readFileFromPath(filePath: string): Promise<Uint8Array | null> {
    console.log('[API] Reading file from path:', filePath);
    try {
      const result = await invoke<number[] | null>("read_file_from_path", { filePath });
      console.log('[API] File read result:', result ? `${result.length} bytes` : 'no data');
      return result ? new Uint8Array(result) : null;
    } catch (error) {
      console.error('[API] Failed to read file from path:', error);
      throw error;
    }
  }

  static async convertFileToUint8Array(file: File): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as ArrayBuffer;
        const uint8Array = new Uint8Array(result);
        resolve(uint8Array);
      };
      reader.onerror = (error) => {
        reject(error);
      };
      reader.readAsArrayBuffer(file);
    });
  }

  static formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  static formatDate(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleString();
  }
}
