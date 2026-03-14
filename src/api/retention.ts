import { apiGet, apiPost, apiDelete } from './client';
import type { RetentionPolicy, CreateRetentionPolicyRequest } from './types';

export async function getRetentionPolicies(): Promise<RetentionPolicy[]> {
  const response = await apiGet<RetentionPolicy[]>('/v1/retention/policies');
  return response.data ?? [];
}

export async function createRetentionPolicy(
  request: CreateRetentionPolicyRequest
): Promise<RetentionPolicy> {
  const response = await apiPost<RetentionPolicy>('/v1/retention/policies', request);
  if (!response.success && response.error) {
    throw new Error(`${response.error.code}: ${response.error.message}`);
  }
  if (!response.data) {
    throw new Error('Failed to create retention policy');
  }
  return response.data;
}

export async function deleteRetentionPolicy(id: number): Promise<void> {
  await apiDelete(`/v1/retention/policies/${id}`);
}
