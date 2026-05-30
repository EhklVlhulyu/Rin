import { path_join } from "./path";
import { buildS3ObjectUrl, createS3Client, putObject as putS3Object } from "./s3";
import { createWebDAVClient, putWebDAVObject, getWebDAVObject, headWebDAVObject } from "./webdav";

type StorageTarget =
  | {
      type: "r2";
      bucket: R2Bucket;
      folder: string;
      publicBaseUrl: string;
    }
  | {
      type: "s3";
      env: Env;
      folder: string;
      publicBaseUrl: string;
    }
  | {
      type: "webdav";
      env: Env;
      folder: string;
      publicBaseUrl: string;
    };

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function resolveStorageTarget(env: Env): StorageTarget {
  const storageType = env.STORAGE_TYPE || 's3';
  if (env.R2_BUCKET) {
    return {
      type: "r2",
      bucket: env.R2_BUCKET,
      folder: env.S3_FOLDER || "",
      publicBaseUrl: trimTrailingSlash(env.S3_ACCESS_HOST || env.S3_ENDPOINT || ""),
    };
  }
  if (storageType === 'webdav') {
    return {
      type: 'webdav',
      env,
      folder: env.WEBDAV_FOLDER || '',
      publicBaseUrl: trimTrailingSlash(env.WEBDAV_URL || ""),
    };
  }
  // 默认 S3
  if (!env.S3_ENDPOINT) {
    throw new Error("S3_ENDPOINT is not defined");
  }
  if (!env.S3_ACCESS_KEY_ID) {
    throw new Error("S3_ACCESS_KEY_ID is not defined");
  }
  if (!env.S3_SECRET_ACCESS_KEY) {
    throw new Error("S3_SECRET_ACCESS_KEY is not defined");
  }
  if (!env.S3_BUCKET) {
    throw new Error("S3_BUCKET is not defined");
  }
  return {
    type: "s3",
    env,
    folder: env.S3_FOLDER || "",
    publicBaseUrl: trimTrailingSlash(env.S3_ACCESS_HOST || env.S3_ENDPOINT || ""),
  };
}

function encodeStorageKey(key: string) {
  return key
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function buildBlobUrl(storageKey: string, baseUrl?: string) {
  const encodedKey = encodeStorageKey(storageKey);
  const path = `/api/blob/${encodedKey}`;

  if (!baseUrl) {
    return path;
  }

  return `${trimTrailingSlash(baseUrl)}${path}`;
}

function createStorageResponse(object: R2ObjectBody | R2Object, body?: BodyInit | null) {
  const headers = new Headers();
  object.writeHttpMetadata(headers);

  if (object.httpEtag) {
    headers.set("ETag", object.httpEtag);
  }

  if (!headers.has("Content-Length")) {
    headers.set("Content-Length", String(object.size));
  }

  if (!headers.has("Last-Modified")) {
    headers.set("Last-Modified", object.uploaded.toUTCString());
  }

  return new Response(body ?? null, {
    status: 200,
    headers,
  });
}

export async function getStorageObject(env: Env, storageKey: string) {
  const target = resolveStorageTarget(env);
  if (target.type === 'r2') {
    const object = await target.bucket.get(storageKey);
    if (!object) return null;
    return createStorageResponse(object, object.body);
  } else if (target.type === 'webdav') {
    const client = createWebDAVClient(env);
    const data = await getWebDAVObject(client, path_join(target.folder, storageKey));
    if (!data) return null;
    return new Response(data);
  } else {
    const client = createS3Client(env);
    const response = await client.fetch(buildS3ObjectUrl(env, storageKey), { method: "GET" });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Failed to fetch storage object: ${response.status} ${response.statusText}`);
    return response;
  }
}

export async function headStorageObject(env: Env, storageKey: string) {
  const target = resolveStorageTarget(env);
  if (target.type === 'r2') {
    const object = await target.bucket.head(storageKey);
    if (!object) return null;
    return createStorageResponse(object);
  } else if (target.type === 'webdav') {
    const client = createWebDAVClient(env);
    const stat = await headWebDAVObject(client, path_join(target.folder, storageKey));
    if (!stat) return null;
    return new Response(null, { status: 200, headers: { 'Content-Length': stat.size?.toString() || '0', 'Last-Modified': stat.lastmod || '' } });
  } else {
    const client = createS3Client(env);
    const response = await client.fetch(buildS3ObjectUrl(env, storageKey), { method: "HEAD" });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Failed to inspect storage object: ${response.status} ${response.statusText}`);
    return response;
  }
}

export function getStoragePublicUrl(env: Env, storageKey: string, baseUrl?: string) {
  if (env.S3_ACCESS_HOST) {
    return `${trimTrailingSlash(env.S3_ACCESS_HOST)}/${storageKey}`;
  }

  return buildBlobUrl(storageKey, baseUrl);
}

export async function putStorageObject(
  env: Env,
  key: string,
  body: Blob | ArrayBuffer | Uint8Array | string,
  contentType?: string,
  baseUrl?: string,
) {
  const target = resolveStorageTarget(env);
  const storageKey = path_join(target.folder, key);

  return putStorageObjectAtKey(env, storageKey, body, contentType, baseUrl);
}

export async function putStorageObjectAtKey(
  env: Env,
  storageKey: string,
  body: Blob | ArrayBuffer | Uint8Array | string,
  contentType?: string,
  baseUrl?: string,
) {
  const target = resolveStorageTarget(env);
  if (target.type === 'r2') {
    await target.bucket.put(storageKey, body, {
      httpMetadata: contentType ? { contentType } : undefined,
    });
  } else if (target.type === 'webdav') {
    const client = createWebDAVClient(env);
else if (target.type === 'webdav') {
  const client = createWebDAVClient(env);
  let data: string | Uint8Array;
  if (typeof body === 'string') {
    data = body;
  } else if (body instanceof Uint8Array) {
    data = body;
  } else if (body instanceof ArrayBuffer) {
    data = new Uint8Array(body);
  } else if (typeof Blob !== 'undefined' && body instanceof Blob) {
    data = new Uint8Array(await (body as Blob).arrayBuffer());
  } else {
    throw new Error('Unsupported body type for WebDAV upload');
  }
  await putWebDAVObject(client, path_join(target.folder, storageKey), data, contentType);
}
  } else {
    const client = createS3Client(env);
    await putS3Object(client, env, storageKey, body, contentType);
  }
  return {
    key: storageKey,
    url: getStoragePublicUrl(env, storageKey, baseUrl),
  };
}
