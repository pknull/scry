import { apiGet } from './client';
import type {
  Status,
  Identity,
  PendingSummary,
  BusAuthorsSummary,
} from './types';

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

// Phase 2 Wave 5 Step 26 — bridge panel data feeds (amendment §C.14).

export async function getTransportPending(
  transportId: string,
): Promise<PendingSummary> {
  const response = await apiGet<PendingSummary>(
    `/v1/transport/pending?transport_id=${encodeURIComponent(transportId)}`,
  );
  if (!response.data) {
    throw new Error('Failed to get transport pending summary');
  }
  return response.data;
}

export async function getBusAuthors(): Promise<BusAuthorsSummary> {
  const response = await apiGet<BusAuthorsSummary>('/v1/transport/bus/authors');
  if (!response.data) {
    throw new Error('Failed to get bus authors summary');
  }
  return response.data;
}
