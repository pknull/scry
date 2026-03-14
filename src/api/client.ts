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
