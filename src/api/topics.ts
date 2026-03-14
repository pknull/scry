import { apiGet, apiPost, apiDelete } from './client';
import type { TopicInfo, KnownTopicInfo } from './types';

export async function getTopicSubscriptions(): Promise<TopicInfo[]> {
  const response = await apiGet<TopicInfo[]>('/v1/topics');
  return response.data ?? [];
}

export async function getKnownTopics(): Promise<KnownTopicInfo[]> {
  const response = await apiGet<KnownTopicInfo[]>('/v1/topics/known');
  return response.data ?? [];
}

export async function subscribeTopic(topic: string): Promise<TopicInfo> {
  const encoded = encodeURIComponent(topic);
  const response = await apiPost<TopicInfo>(`/v1/topics/${encoded}`);
  if (!response.success && response.error) {
    throw new Error(`${response.error.code}: ${response.error.message}`);
  }
  if (!response.data) {
    throw new Error('Failed to subscribe to topic');
  }
  return response.data;
}

export async function unsubscribeTopic(topic: string): Promise<void> {
  const encoded = encodeURIComponent(topic);
  await apiDelete(`/v1/topics/${encoded}`);
}
