import { apiGet, apiPostOrThrow, apiDelete } from './client';
import type { RetentionPolicy, CreateRetentionPolicyRequest } from './types';

export async function getRetentionPolicies(): Promise<RetentionPolicy[]> {
  const response = await apiGet<RetentionPolicy[]>('/v1/retention/policies');
  return response.data ?? [];
}

export async function createRetentionPolicy(
  request: CreateRetentionPolicyRequest
): Promise<RetentionPolicy> {
  return apiPostOrThrow<RetentionPolicy>(
    '/v1/retention/policies',
    request,
    'Failed to create retention policy',
  );
}

export async function deleteRetentionPolicy(id: number): Promise<void> {
  await apiDelete(`/v1/retention/policies/${id}`);
}
