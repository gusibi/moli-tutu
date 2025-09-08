export interface R2Config {
  access_key_id: string;
  secret_access_key: string;
  endpoint: string;
  bucket_name: string;
  public_url_base: string;
}

export interface UploadRecord {
  id: string;
  original_filename: string;
  file_hash: string;
  file_size: number;
  url: string;
  upload_time: number;
  from_cache?: boolean;
}

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
  from_cache: boolean;
}