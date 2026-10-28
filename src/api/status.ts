import { apiGetOrThrow } from './client';
import type { Status, Identity } from './types';

export async function getStatus(): Promise<Status> {
  return apiGetOrThrow<Status>('/v1/status', 'Failed to get status');
}

export async function getIdentity(): Promise<Identity> {
  return apiGetOrThrow<Identity>('/v1/identity', 'Failed to get identity');
}
