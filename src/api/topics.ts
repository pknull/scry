import { apiGet, apiPostOrThrow, apiDelete } from './client';
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
  return apiPostOrThrow<TopicInfo>(
    `/v1/topics/${encoded}`,
    undefined,
    'Failed to subscribe to topic',
  );
}

export async function unsubscribeTopic(topic: string): Promise<void> {
  const encoded = encodeURIComponent(topic);
  await apiDelete(`/v1/topics/${encoded}`);
}
