import { apiGet, apiPost } from './client';
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
  const response = await apiPost<SchemaInfo>('/v1/schemas', request);
  if (!response.success && response.error) {
    throw new Error(`${response.error.code}: ${response.error.message}`);
  }
  if (!response.data) {
    throw new Error('Failed to register schema');
  }
  return response.data;
}

export async function validateContent(request: ValidateRequest): Promise<ValidateResponse> {
  const response = await apiPost<ValidateResponse>('/v1/schemas/validate', request);
  if (!response.data) {
    throw new Error('Failed to validate content');
  }
  return response.data;
}
