import { apiGet, apiPost, apiDelete } from './client';
import type { Peer, MeshResponse } from './types';

export async function getPeers(): Promise<Peer[]> {
  const response = await apiGet<Peer[]>('/v1/peers');
  return response.data ?? [];
}

export async function addPeer(address: string): Promise<void> {
  await apiPost('/v1/peers', { address });
}

export async function removePeer(address: string): Promise<void> {
  await apiDelete(`/v1/peers/${encodeURIComponent(address)}`);
}

export async function getMesh(): Promise<MeshResponse> {
  const response = await apiGet<MeshResponse>('/v1/mesh');
  return response.data ?? { local: {} as MeshResponse['local'], peers: [] };
}

export async function getFollows(): Promise<string[]> {
  const response = await apiGet<string[]>('/v1/follows');
  return response.data ?? [];
}

export async function follow(author: string): Promise<void> {
  await apiPost('/v1/follows', { author });
}

export async function unfollow(author: string): Promise<void> {
  await apiDelete(`/v1/follows/${encodeURIComponent(author)}`);
}
