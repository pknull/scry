export interface Status {
  version: string;
  identity: string;
  port: number;
  gossip_port: number;
  peer_count: number;
  message_count: number;
  feed_count: number;
  follow_count: number;
  uptime_secs: number;
}

export interface Identity {
  public_id: string;
  x25519_public: string;
}

export interface Message {
  hash: string;
  author: string;
  sequence: number;
  timestamp: string;
  previous: string | null;
  content: MessageContent;
  signature: string;
  references?: string[];
}

export interface MessageContent {
  type: string;
  text?: string;
  topic?: string;
  title?: string;
  metadata?: Record<string, unknown>;
}

export interface Peer {
  address: string;
  public_id?: string;
  source?: string;
  last_seen?: string;
  connected?: boolean;
}

export interface MeshPeer {
  peer_id: string;
  last_seen_at: string;
  last_seen_by: string;
  observation_age_secs: number;
  last_seq: number;
  generation: number;
  status: 'recent' | 'stale' | 'suspected' | 'unknown';
}

export interface MeshLocalStatus {
  version: string;
  identity: string;
  port: number;
  gossip_port: number;
  peer_count: number;
  message_count: number;
  feed_count: number;
  follow_count: number;
  uptime_secs: number;
}

export interface MeshResponse {
  local: MeshLocalStatus;
  peers: MeshPeer[];
}

export interface FeedQuery {
  limit?: number;
  offset?: number;
  author?: string;
  topic?: string;
  content_type?: string;
  after?: string;
  before?: string;
}

export interface SearchQuery {
  q: string;
  limit?: number;
  offset?: number;
}

// Schema types
export type SchemaCodec = 'json' | 'cbor';
export type SchemaCompatibility = 'none' | 'backward' | 'forward' | 'full';

export interface SchemaInfo {
  schema_id: string;
  content_type: string;
  version: number;
  codec: SchemaCodec;
  compatibility: SchemaCompatibility;
  description?: string;
}

export interface SchemaDefinition extends SchemaInfo {
  json_schema: Record<string, unknown>;
}

export interface RegisterSchemaRequest {
  content_type: string;
  version: number;
  json_schema: Record<string, unknown>;
  codec?: SchemaCodec;
  compatibility?: SchemaCompatibility;
  description?: string;
}

export interface ValidateRequest {
  content: Record<string, unknown>;
  schema_id?: string;
}

export interface ValidateResponse {
  valid: boolean;
  schema_id?: string;
  error?: string;
}

// Consumer Group types
export interface ConsumerGroup {
  group_id: string;
  generation: number;
  member_count: number;
  created_at: string;
  updated_at: string;
}

export interface GroupMember {
  member_id: string;
  joined_at: string;
  assigned_feeds: string[];
  assignment_generation: number;
}

export interface GroupOffset {
  author: string;
  committed_sequence: number;
  committed_at: string;
  committed_by: string;
}

export interface JoinGroupResponse {
  group_id: string;
  member_id: string;
  generation: number;
  assigned_feeds: string[];
  is_leader: boolean;
}

// Retention Policy types
export type RetentionScopeType = 'global' | 'topic' | 'author' | 'content_type';

export interface RetentionScope {
  type: RetentionScopeType;
  value?: string;
}

export interface RetentionPolicy {
  id: number;
  scope: string | { topic?: string; author?: string; content_type?: string };
  max_age_secs?: number;
  max_count?: number;
  max_bytes?: number;
  compact_key?: string;
}

export interface CreateRetentionPolicyRequest {
  scope: string | { topic?: string; author?: string; content_type?: string };
  max_age_secs?: number;
  max_count?: number;
  max_bytes?: number;
  compact_key?: string;
}

// Topic Subscription types
export interface TopicInfo {
  topic: string;
}

export interface KnownTopicInfo {
  topic: string;
  subscribed: boolean;
}
