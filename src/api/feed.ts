import { apiGet, apiPost } from './client';
import type { Message, FeedQuery, SearchQuery } from './types';

export async function getFeed(query?: FeedQuery): Promise<Message[]> {
  const params = new URLSearchParams();
  // Always include our own messages
  params.set('include_self', String(query?.include_self ?? true));
  if (query?.limit) params.set('limit', String(query.limit));
  if (query?.offset) params.set('offset', String(query.offset));
  if (query?.author) params.set('author', query.author);
  if (query?.topic) params.set('topic', query.topic);
  if (query?.content_type) params.set('content_type', query.content_type);
  if (query?.tag) params.set('tag', query.tag);
  if (query?.relates) params.set('relates', query.relates);
  if (query?.trace_id) params.set('trace_id', query.trace_id);
  if (query?.after) params.set('after', query.after);
  if (query?.before) params.set('before', query.before);

  const endpoint = `/v1/feed?${params.toString()}`;
  const response = await apiGet<Message[]>(endpoint);
  return response.data ?? [];
}

export async function getInsights(query?: FeedQuery): Promise<Message[]> {
  const params = new URLSearchParams();
  if (query?.limit) params.set('limit', String(query.limit));
  if (query?.offset) params.set('offset', String(query.offset));

  const queryString = params.toString();
  const endpoint = queryString ? `/v1/insights?${queryString}` : '/v1/insights';
  const response = await apiGet<Message[]>(endpoint);
  return response.data ?? [];
}

export async function searchInsights(query: SearchQuery): Promise<Message[]> {
  const params = new URLSearchParams();
  params.set('q', query.q);
  if (query.limit) params.set('limit', String(query.limit));
  if (query.offset) params.set('offset', String(query.offset));

  const response = await apiGet<Message[]>(`/v1/insights/search?${params.toString()}`);
  return response.data ?? [];
}

export async function getMessage(hash: string): Promise<Message | null> {
  const response = await apiGet<Message>(`/v1/message/${hash}`);
  return response.data ?? null;
}

export async function getAuthors(): Promise<string[]> {
  // Get a large batch of messages and extract unique authors
  const messages = await getFeed({ limit: 500 });
  const authors = new Set(messages.map((m) => m.author));
  return Array.from(authors).sort();
}

export async function publishMessage(params: {
  content: {
    type: string;
    text?: string;
    title?: string;
    [key: string]: unknown;
  };
  topic?: string;
  references?: string[];
  relates?: string;
  tags?: string[];
  trace_id?: string;
  span_id?: string;
}): Promise<Message> {
  // topic and references are top-level, content is the validated payload
  const body: Record<string, unknown> = { content: params.content };
  if (params.topic) body.topic = params.topic;
  if (params.references?.length) body.references = params.references;
  if (params.relates) body.relates = params.relates;
  if (params.tags?.length) body.tags = params.tags;
  if (params.trace_id) body.trace_id = params.trace_id;
  if (params.span_id) body.span_id = params.span_id;

  const response = await apiPost<Message>('/v1/publish', body);
  if (!response.success && response.error) {
    throw new Error(`${response.error.code}: ${response.error.message}`);
  }
  if (!response.data) {
    throw new Error('Failed to publish message - no data returned');
  }
  return response.data;
}
