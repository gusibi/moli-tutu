export type StorageProvider =
  | 'cloudflare_r2'
  | 'aws_s3'
  | 'backblaze_b2'
  | 'digitalocean_spaces'
  | 'min_io'
  | 'wasabi'
  | 'aliyun_oss'
  | 'tencent_cos'
  | 'qiniu_kodo'
  | 'upyun'
  | 'custom_s3'
  | 'imgur'
  | 'sm_ms'
  | 'git_hub';

export interface StorageConfigList {
  configs: StorageConfig[];
  active_id: string;
}

export interface StorageConfig {
  id: string;
  name: string;
  provider: StorageProvider;

  // S3-compatible fields
  access_key_id: string;
  secret_access_key: string;
  endpoint: string;
  bucket_name: string;
  public_url_base: string;
  region: string;
  path_prefix: string;

  // Imgur
  imgur_client_id: string;

  // SM.MS
  smms_api_token: string;

  // GitHub
  github_token: string;
  github_owner: string;
  github_repo: string;
  github_branch: string;
  github_path: string;
  github_cdn_url: string;

  // Upyun
  upyun_bucket: string;
  upyun_operator: string;
  upyun_password: string;
  upyun_domain: string;
}

// Legacy R2Config kept for backward compatibility
export interface R2Config {
  access_key_id: string;
  secret_access_key: string;
  endpoint: string;
  bucket_name: string;
  public_url_base: string;
}

export interface ApiProxyStatus {
  enabled: boolean;
  running: boolean;
  port: number;
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

export const PROVIDER_LABELS: Record<StorageProvider, string> = {
  cloudflare_r2: 'Cloudflare R2',
  aws_s3: 'AWS S3',
  backblaze_b2: 'Backblaze B2',
  digitalocean_spaces: 'DigitalOcean Spaces',
  min_io: 'MinIO',
  wasabi: 'Wasabi',
  aliyun_oss: '阿里云 OSS',
  tencent_cos: '腾讯云 COS',
  qiniu_kodo: '七牛云 Kodo',
  upyun: '又拍云',
  custom_s3: 'Custom S3',
  imgur: 'Imgur',
  sm_ms: 'SM.MS',
  git_hub: 'GitHub',
};

export const S3_PROVIDERS: StorageProvider[] = [
  'cloudflare_r2',
  'aws_s3',
  'backblaze_b2',
  'digitalocean_spaces',
  'min_io',
  'wasabi',
  'aliyun_oss',
  'tencent_cos',
  'qiniu_kodo',
  'custom_s3',
];

export const PROVIDER_ENDPOINT_HINTS: Partial<Record<StorageProvider, string>> = {
  cloudflare_r2: 'https://<account-id>.r2.cloudflarestorage.com',
  aws_s3: 'https://s3.<region>.amazonaws.com',
  backblaze_b2: 'https://s3.<region>.backblazeb2.com',
  digitalocean_spaces: 'https://<region>.digitaloceanspaces.com',
  min_io: 'http(s)://<host>:<port>',
  wasabi: 'https://s3.<region>.wasabisys.com',
  aliyun_oss: 'https://oss-<region>.aliyuncs.com',
  tencent_cos: 'https://cos.<region>.myqcloud.com',
  qiniu_kodo: 'https://s3-<region>.qiniucs.com',
  custom_s3: 'https://your-s3-endpoint.com',
};

/// Create a default empty StorageConfig
export function createDefaultStorageConfig(provider: StorageProvider = 'cloudflare_r2'): StorageConfig {
  return {
    id: crypto.randomUUID(),
    name: '',
    provider,
    access_key_id: '',
    secret_access_key: '',
    endpoint: '',
    bucket_name: '',
    public_url_base: '',
    region: '',
    path_prefix: '',
    imgur_client_id: '',
    smms_api_token: '',
    github_token: '',
    github_owner: '',
    github_repo: '',
    github_branch: 'main',
    github_path: 'images',
    github_cdn_url: '',
    upyun_bucket: '',
    upyun_operator: '',
    upyun_password: '',
    upyun_domain: '',
  };
}
