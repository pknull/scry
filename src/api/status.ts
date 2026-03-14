import { apiGet } from './client';
import type { Status, Identity } from './types';

export async function getStatus(): Promise<Status> {
  const response = await apiGet<Status>('/v1/status');
  if (!response.data) {
    throw new Error('Failed to get status');
  }
  return response.data;
}

export async function getIdentity(): Promise<Identity> {
  const response = await apiGet<Identity>('/v1/identity');
  if (!response.data) {
    throw new Error('Failed to get identity');
  }
  return response.data;
}
