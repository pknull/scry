const TOPIC_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/;
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
