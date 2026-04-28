import { invoke } from '@tauri-apps/api/core';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  metadata?: {
    total: number;
    offset: number;
    limit: number;
  };
}

export async function apiGet<T>(endpoint: string): Promise<ApiResponse<T>> {
  try {
    const response = await invoke<string>('api_get', { endpoint });
    return JSON.parse(response);
  } catch (e) {
    console.error('[API] GET failed:', endpoint, e);
    throw new ApiError(0, String(e));
  }
}

export async function apiPost<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
  try {
    const body = data ? JSON.stringify(data) : '{}';
    const response = await invoke<string>('api_post', { endpoint, body });
    return JSON.parse(response);
  } catch (e) {
    console.error('[API] POST failed:', endpoint, e);
    throw new ApiError(0, String(e));
  }
}

export async function apiDelete(endpoint: string): Promise<void> {
  try {
    await invoke<string>('api_delete', { endpoint });
  } catch (e) {
    console.error('[API] DELETE failed:', endpoint, e);
    throw new ApiError(0, String(e));
  }
}

/**
 * Strict variants that throw on either:
 * - envelope-level failure (`success: false` with an `error` body) — propagated
 *   verbatim as `<code>: <message>`,
 * - missing `data` — propagated with the caller-supplied `errMsg`.
 *
 * Use when the callsite *requires* a value; modules that prefer to coerce a
 * missing payload to a default (`?? []`, `?? null`) should keep using the
 * lower-level `apiGet` / `apiPost` and inspect the envelope themselves.
 *
 * Presence is checked as `data == null`, NOT truthiness, so valid falsy
 * payloads like `false`, `0`, or `""` are returned to the caller as-is.
 */
function unwrap<T>(response: ApiResponse<T>, errMsg: string): T {
  if (!response.success) {
    if (response.error) {
      throw new Error(`${response.error.code}: ${response.error.message}`);
    }
    throw new Error(errMsg);
  }
  if (response.data == null) {
    throw new Error(errMsg);
  }
  return response.data;
}

export async function apiGetOrThrow<T>(endpoint: string, errMsg: string): Promise<T> {
  return unwrap(await apiGet<T>(endpoint), errMsg);
}

export async function apiPostOrThrow<T>(
  endpoint: string,
  data: unknown,
  errMsg: string,
): Promise<T> {
  return unwrap(await apiPost<T>(endpoint, data), errMsg);
}
