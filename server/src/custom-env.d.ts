import type { QueueTask } from "./queue";

declare global {
  interface Env {
    TASK_QUEUE?: Queue<QueueTask>;
    R2_BUCKET?: R2Bucket;
    // S3
    S3_ENDPOINT?: string;
    S3_ACCESS_KEY_ID?: string;
    S3_SECRET_ACCESS_KEY?: string;
    S3_BUCKET?: string;
    S3_FORCE_PATH_STYLE?: string;
    S3_FOLDER?: string;
    S3_ACCESS_HOST?: string;
    // WebDAV
    WEBDAV_URL?: string;
    WEBDAV_USERNAME?: string;
    WEBDAV_PASSWORD?: string;
    WEBDAV_FOLDER?: string;
    // 通用
    STORAGE_TYPE?: 's3' | 'webdav';
  }
}

export {};
