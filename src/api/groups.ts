import { apiGet, apiPost, apiDelete } from './client';
import type {
  ConsumerGroup,
  GroupMember,
  GroupOffset,
  JoinGroupResponse,
} from './types';

export async function getGroups(): Promise<ConsumerGroup[]> {
  const response = await apiGet<ConsumerGroup[]>('/v1/groups');
  return response.data ?? [];
}

export async function getGroup(groupId: string): Promise<ConsumerGroup | null> {
  const encoded = encodeURIComponent(groupId);
  const response = await apiGet<ConsumerGroup>(`/v1/groups/${encoded}`);
  return response.data ?? null;
}

export async function createGroup(groupId: string): Promise<ConsumerGroup> {
  const response = await apiPost<ConsumerGroup>('/v1/groups', { group_id: groupId });
  if (!response.success && response.error) {
    throw new Error(`${response.error.code}: ${response.error.message}`);
  }
  if (!response.data) {
    throw new Error('Failed to create group');
  }
  return response.data;
}

export async function deleteGroup(groupId: string): Promise<void> {
  const encoded = encodeURIComponent(groupId);
  await apiDelete(`/v1/groups/${encoded}`);
}

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const encoded = encodeURIComponent(groupId);
  const response = await apiGet<GroupMember[]>(`/v1/groups/${encoded}/members`);
  return response.data ?? [];
}

export async function joinGroup(groupId: string, memberId: string): Promise<JoinGroupResponse> {
  const encoded = encodeURIComponent(groupId);
  const response = await apiPost<JoinGroupResponse>(`/v1/groups/${encoded}/join`, {
    member_id: memberId,
  });
  if (!response.success && response.error) {
    throw new Error(`${response.error.code}: ${response.error.message}`);
  }
  if (!response.data) {
    throw new Error('Failed to join group');
  }
  return response.data;
}

export async function leaveGroup(groupId: string, memberId: string): Promise<void> {
  const encoded = encodeURIComponent(groupId);
  await apiPost(`/v1/groups/${encoded}/leave`, { member_id: memberId });
}

export async function getGroupOffsets(groupId: string): Promise<GroupOffset[]> {
  const encoded = encodeURIComponent(groupId);
  const response = await apiGet<GroupOffset[]>(`/v1/groups/${encoded}/offsets`);
  return response.data ?? [];
}

export async function commitOffset(
  groupId: string,
  author: string,
  sequence: number,
  committedBy: string
): Promise<GroupOffset> {
  const encoded = encodeURIComponent(groupId);
  const response = await apiPost<GroupOffset>(`/v1/groups/${encoded}/offsets`, {
    author,
    sequence,
    committed_by: committedBy,
  });
  if (!response.success && response.error) {
    throw new Error(`${response.error.code}: ${response.error.message}`);
  }
  if (!response.data) {
    throw new Error('Failed to commit offset');
  }
  return response.data;
}
