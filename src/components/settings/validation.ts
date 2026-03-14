import type { Hook } from './HooksEditor';

const TOPIC_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/;
const GROUP_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const CONTENT_TYPE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/;
const BRACKETED_IPV6_PATTERN = /^\[([0-9A-Fa-f:.]+)\]:(\d{1,5})$/;
const HOST_PORT_PATTERN = /^([^/\s:]+):(\d{1,5})$/;
const AUTHOR_ID_PATTERN = /^@.+\.ed25519$/;

function isValidPort(port: string): boolean {
  const parsed = Number.parseInt(port, 10);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535;
}

export function validatePeerAddress(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Peer address is required';
  }

  const ipv6Match = BRACKETED_IPV6_PATTERN.exec(trimmed);
  if (ipv6Match) {
    return isValidPort(ipv6Match[2]) ? null : 'Peer address must include a valid TCP port';
  }

  const hostPortMatch = HOST_PORT_PATTERN.exec(trimmed);
  if (!hostPortMatch) {
    return 'Use host:port or [ipv6]:port';
  }

  return isValidPort(hostPortMatch[2]) ? null : 'Peer address must include a valid TCP port';
}

export function validateTopicName(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Topic name is required';
  }
  if (trimmed.length > 256) {
    return 'Topic name must be 256 characters or fewer';
  }
  if (!TOPIC_PATTERN.test(trimmed)) {
    return 'Use letters, numbers, dots, slashes, colons, underscores, or hyphens';
  }
  return null;
}

export function validateGroupId(value: string, existingGroupIds: Iterable<string> = []): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Group ID is required';
  }
  if (!GROUP_ID_PATTERN.test(trimmed)) {
    return 'Use only letters, numbers, hyphens, and underscores';
  }
  const existing = new Set(Array.from(existingGroupIds, (groupId) => groupId.toLowerCase()));
  if (existing.has(trimmed.toLowerCase())) {
    return 'A consumer group with this ID already exists';
  }
  return null;
}

export function validateContentType(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Content type is required';
  }
  if (!CONTENT_TYPE_PATTERN.test(trimmed)) {
    return 'Use letters, numbers, dots, slashes, underscores, or hyphens';
  }
  return null;
}

export function validatePositiveInteger(value: string, label: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return `${label} is required`;
  }
  if (!/^\d+$/.test(trimmed) || Number.parseInt(trimmed, 10) <= 0) {
    return `${label} must be a positive integer`;
  }
  return null;
}

export function validateOptionalPositiveInteger(value: string, label: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return validatePositiveInteger(trimmed, label);
}

export function validateOptionalNonNegativeInteger(value: string, label: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (!/^\d+$/.test(trimmed)) {
    return `${label} must be a non-negative integer`;
  }
  return null;
}

export function parseJsonObject(value: string): { parsed?: Record<string, unknown>; error?: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { error: 'JSON is required' };
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      return { error: 'JSON must describe an object' };
    }
    return { parsed: parsed as Record<string, unknown> };
  } catch {
    return { error: 'JSON is invalid' };
  }
}

export function validateSchemaDefinition(
  value: string,
  contentType: string
): { parsed?: Record<string, unknown>; error?: string } {
  const result = parseJsonObject(value);
  if (result.error || !result.parsed) {
    return result;
  }

  const properties = result.parsed.properties;
  const typeProperty =
    properties && typeof properties === 'object' && !Array.isArray(properties)
      ? (properties as Record<string, unknown>).type
      : undefined;
  const constValue =
    typeProperty && typeof typeProperty === 'object' && !Array.isArray(typeProperty)
      ? (typeProperty as Record<string, unknown>).const
      : undefined;
  if (typeof constValue === 'string' && contentType.trim() && constValue !== contentType.trim()) {
    return { error: 'Schema properties.type.const must match the content type' };
  }

  return result;
}

export function validateAuthorId(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Author ID is required';
  }
  if (!AUTHOR_ID_PATTERN.test(trimmed)) {
    return 'Author ID must look like @...ed25519';
  }
  return null;
}

export type HookFieldErrors = Partial<Record<'name' | 'on_message' | 'webhook_url' | 'timeout_secs' | 'max_retries' | 'retry_delay_secs' | 'transport', string>>;

export function validateHook(hook: Hook): HookFieldErrors {
  const errors: HookFieldErrors = {};
  const scriptPath = hook.on_message?.trim() ?? '';
  const webhookUrl = hook.webhook_url?.trim() ?? '';

  if (!scriptPath && !webhookUrl) {
    errors.transport = 'Provide either a script path or a webhook URL';
  }

  if (scriptPath) {
    if (/[\r\n]/.test(scriptPath)) {
      errors.on_message = 'Script path must be a single path or command';
    } else if (!/^(\/|\.{1,2}\/|[A-Za-z0-9_./-])/.test(scriptPath)) {
      errors.on_message = 'Script path must look like a valid command path';
    }
  }

  if (webhookUrl) {
    try {
      const url = new URL(webhookUrl);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        errors.webhook_url = 'Webhook URL must start with http:// or https://';
      }
    } catch {
      errors.webhook_url = 'Webhook URL must be a valid absolute URL';
    }
  }

  if (hook.timeout_secs !== undefined && (!Number.isInteger(hook.timeout_secs) || hook.timeout_secs <= 0)) {
    errors.timeout_secs = 'Timeout must be greater than zero';
  }

  if (hook.max_retries !== undefined && (!Number.isInteger(hook.max_retries) || hook.max_retries < 0)) {
    errors.max_retries = 'Max retries must be zero or greater';
  }

  if (hook.retry_delay_secs !== undefined && (!Number.isInteger(hook.retry_delay_secs) || hook.retry_delay_secs <= 0)) {
    errors.retry_delay_secs = 'Retry delay must be greater than zero';
  }

  return errors;
}
