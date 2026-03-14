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

export interface Message<TContent extends MessageContent = MessageContent> {
  hash: string;
  author: string;
  sequence: number;
  timestamp: string;
  previous: string | null;
  content: TContent;
  schema_id?: string | null;
  relates?: string | null;
  tags?: string[];
  trace_id?: string | null;
  span_id?: string | null;
  expires_at?: string | null;
  signature: string;
  references?: string[];
}

export interface MessageContent {
  type: string;
  text?: string;
  topic?: string;
  title?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
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
  tag?: string;
  relates?: string;
  trace_id?: string;
  after?: string;
  before?: string;
  include_self?: boolean;
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

export interface TaskContent extends MessageContent {
  type: 'task';
  id?: string;
  hash: string;
  task_type?: string;
  request?: string;
  requestor?: string;
  prompt: string;
  required_caps?: string[];
  parent_id?: string;
  context?: Record<string, unknown>;
  priority?: number;
  timeout_secs?: number;
  author?: string;
  keeper?: string;
}

export interface TaskOfferContent extends MessageContent {
  type: 'task_offer';
  task_id: string;
  servitor: string;
  capabilities: string[];
  ttl_seconds: number;
  timestamp: string;
}

export interface TaskAssignContent extends MessageContent {
  type: 'task_assign';
  task_id: string;
  servitor: string;
  assigner?: string;
}

export interface TaskStartedContent extends MessageContent {
  type: 'task_started';
  task_id: string;
  servitor: string;
  eta_seconds: number;
  timestamp: string;
}

export interface TaskStatusContent extends MessageContent {
  type: 'task_status';
  task_id: string;
  servitor: string;
  progress_pct?: number;
  revised_eta_seconds?: number;
  message?: string;
  timestamp: string;
}

export interface TaskFailedContent extends MessageContent {
  type: 'task_failed';
  task_id: string;
  servitor: string;
  reason: 'no_response' | 'execution_error' | 'timeout';
  details?: string;
  timestamp: string;
}

export interface TaskOfferWithdrawContent extends MessageContent {
  type: 'task_offer_withdraw';
  task_id: string;
  servitor: string;
  reason?: string;
  timestamp: string;
}

export interface TaskResultContent extends MessageContent {
  type: 'task_result';
  task_id: string;
  servitor: string;
  correlation_id: string;
  task_hash: string;
  result_hash: string;
  status: 'success' | 'error' | 'timeout';
  result?: Record<string, unknown>;
  error?: string;
  duration_seconds?: number;
  plan_hash?: string;
  trace_id?: string;
  attestation: {
    servitor_id: string;
    signature: string;
    timestamp: string;
  };
}

export interface TraceSpanContent extends MessageContent {
  type: 'trace_span';
  trace_id: string;
  span_id: string;
  parent_span_id?: string;
  name: string;
  service: string;
  start_ts: string;
  end_ts: string;
  status?: 'ok' | 'error' | 'timeout';
  attributes?: Record<string, unknown>;
  error?: string;
}
