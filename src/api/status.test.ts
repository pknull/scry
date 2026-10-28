import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./client', () => ({
  apiGetOrThrow: vi.fn(),
}));

import * as statusApi from './status';
import { apiGetOrThrow } from './client';

const mockedGet = vi.mocked(apiGetOrThrow);

describe('status API', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('exposes only the node status and identity reads', () => {
    expect(Object.keys(statusApi).sort()).toEqual(['getIdentity', 'getStatus']);
  });

  it('reads status and identity from their daemon endpoints', async () => {
    mockedGet.mockResolvedValue({});
    await statusApi.getStatus();
    await statusApi.getIdentity();
    expect(mockedGet.mock.calls.map(([endpoint]) => endpoint)).toEqual([
      '/v1/status',
      '/v1/identity',
    ]);
  });
});
