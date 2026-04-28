import { apiGet, apiPostOrThrow } from './client';
import type {
  SchemaInfo,
  SchemaDefinition,
  RegisterSchemaRequest,
  ValidateRequest,
  ValidateResponse,
} from './types';

export async function getSchemas(): Promise<SchemaInfo[]> {
  const response = await apiGet<{ schemas: SchemaInfo[] }>('/v1/schemas');
  return response.data?.schemas ?? [];
}

export async function getSchema(schemaId: string): Promise<SchemaDefinition | null> {
  const encoded = encodeURIComponent(schemaId);
  const response = await apiGet<SchemaDefinition>(`/v1/schemas/${encoded}`);
  return response.data ?? null;
}

export async function registerSchema(request: RegisterSchemaRequest): Promise<SchemaInfo> {
  return apiPostOrThrow<SchemaInfo>('/v1/schemas', request, 'Failed to register schema');
}

export async function validateContent(request: ValidateRequest): Promise<ValidateResponse> {
  // Note: previously ignored envelope-level success/error and only checked
  // for missing data. Now propagates envelope errors via apiPostOrThrow,
  // which is a behavior improvement — surface the real failure to callers
  // instead of conflating a daemon-side validation refusal with "no data".
  return apiPostOrThrow<ValidateResponse>(
    '/v1/schemas/validate',
    request,
    'Failed to validate content',
  );
}
