import { invoke } from "@tauri-apps/api/core";
import { R2Config, UploadRecord, UploadResult } from "../types";

export class ImageHostingAPI {
  static async saveR2Config(config: R2Config): Promise<void> {
    console.log('[API] Saving R2 config:', {
      accessKeyId: config.access_key_id ? `${config.access_key_id.substring(0, 6)}...` : 'not set',
      secretAccessKey: config.secret_access_key ? 'set' : 'not set',
      endpoint: config.endpoint,
      bucket: config.bucket,
      publicUrl: config.public_url
    });
    try {
      const result = await invoke("save_r2_config", { config });
      console.log('[API] R2 config saved successfully');
      return result;
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
      return result;
    } catch (error) {
      console.error('[API] Failed to get R2 config:', error);
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
        success: result.success,
        url: result.url,
        error: result.error,
        fromCache: result.from_cache
      });
      
      return result;
    } catch (error) {
      console.error('[API] Upload invoke failed:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  static async getUploadHistory(): Promise<UploadRecord[]> {
    console.log('[API] Getting upload history...');
    try {
      const result = await invoke("get_upload_history");
      console.log('[API] Upload history retrieved:', result ? `${result.length} records` : 'no records');
      return result;
    } catch (error) {
      console.error('[API] Failed to get upload history:', error);
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