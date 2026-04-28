import { apiGetOrThrow } from './client';
import type {
  Status,
  Identity,
  PendingSummary,
  BusAuthorsSummary,
} from './types';

export async function getStatus(): Promise<Status> {
  return apiGetOrThrow<Status>('/v1/status', 'Failed to get status');
}

export async function getIdentity(): Promise<Identity> {
  return apiGetOrThrow<Identity>('/v1/identity', 'Failed to get identity');
}

// Phase 2 Wave 5 Step 26 — bridge panel data feeds (amendment §C.14).

export async function getTransportPending(
  transportId: string,
): Promise<PendingSummary> {
  return apiGetOrThrow<PendingSummary>(
    `/v1/transport/pending?transport_id=${encodeURIComponent(transportId)}`,
    'Failed to get transport pending summary',
  );
}

export async function getBusAuthors(): Promise<BusAuthorsSummary> {
  return apiGetOrThrow<BusAuthorsSummary>(
    '/v1/transport/bus/authors',
    'Failed to get bus authors summary',
  );
}
