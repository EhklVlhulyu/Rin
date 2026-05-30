import { createClient } from 'webdav';

export function createWebDAVClient(env: Env) {
	const url = env.WEBDAV_URL;
	const username = env.WEBDAV_USERNAME;
	const password = env.WEBDAV_PASSWORD;
	if (!url) throw new Error('WEBDAV_URL is not defined');
	return createClient(url, { username, password });
}

export async function putWebDAVObject(
  client: any,
  key: string,
  body: string | Uint8Array,
  contentType?: string
) {
  await client.putFileContents(key, body, { overwrite: true, headers: contentType ? { 'Content-Type': contentType } : undefined });
}

export async function getWebDAVObject(client: any, key: string) {
	try {
		return await client.getFileContents(key, { format: 'binary' });
	} catch (e: any) {
		if (e.response && e.response.status === 404) return null;
		throw e;
	}
}

export async function headWebDAVObject(client: any, key: string) {
	try {
		const stat = await client.stat(key);
		return stat;
	} catch (e: any) {
		if (e.response && e.response.status === 404) return null;
		throw e;
	}
}
