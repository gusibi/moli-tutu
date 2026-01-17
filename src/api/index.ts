import { invoke } from "@tauri-apps/api/core";
import { ApiProxyStatus, R2Config, UploadRecord, UploadResult } from "../types";

export class ImageHostingAPI {
  static async saveR2Config(config: R2Config): Promise<void> {
    console.log('[API] Saving R2 config:', {
      accessKeyId: config.access_key_id ? `${config.access_key_id.substring(0, 6)}...` : 'not set',
      secretAccessKey: config.secret_access_key ? 'set' : 'not set',
      endpoint: config.endpoint,
      bucket: config.bucket_name,
      publicUrl: config.public_url_base
    });
    try {
      const result = await invoke("save_r2_config", { config });
      console.log('[API] R2 config saved successfully');
      return result as void;
    } catch (error) {
      console.error('[API] Failed to save R2 config:', error);
      throw error;
    }
  }

  static async getR2Config(): Promise<R2Config | null> {
    console.log('[API] Getting R2 config...');
    try {
      const result = await invoke("get_r2_config");
      console.log('[API] R2 config retrieved:', result ? 'config exists' : 'no config found');
      return result as R2Config | null;
    } catch (error) {
      console.error('[API] Failed to get R2 config:', error);
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
      arrayLength: Array.from(fileData).length
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
        stack: error instanceof Error ? error.stack : undefined
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
    console.log('[API] Converting file to Uint8Array:', {
      name: file.name,
      size: file.size,
      type: file.type
    });
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as ArrayBuffer;
        const uint8Array = new Uint8Array(result);
        console.log('[API] File conversion successful:', {
          arrayBufferSize: result.byteLength,
          uint8ArrayLength: uint8Array.length
        });
        resolve(uint8Array);
      };
      reader.onerror = (error) => {
        console.error('[API] File conversion failed:', error);
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
