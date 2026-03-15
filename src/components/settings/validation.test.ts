import { describe, it, expect } from 'vitest';
import {
  validatePeerAddress,
  validateTopicName,
  validateGroupId,
  validateContentType,
  validatePositiveInteger,
  validateOptionalPositiveInteger,
  validateOptionalNonNegativeInteger,
  parseJsonObject,
  validateSchemaDefinition,
  validateAuthorId,
  validateHook,
} from './validation';
import type { Hook } from './HooksEditor';

describe('validatePeerAddress', () => {
  describe('valid addresses', () => {
    it('accepts hostname:port format', () => {
      expect(validatePeerAddress('localhost:7654')).toBeNull();
      expect(validatePeerAddress('example.com:8080')).toBeNull();
      expect(validatePeerAddress('peer-node.local:443')).toBeNull();
    });

    it('accepts IPv4:port format', () => {
      expect(validatePeerAddress('127.0.0.1:7654')).toBeNull();
      expect(validatePeerAddress('192.168.1.1:8080')).toBeNull();
      expect(validatePeerAddress('10.0.0.1:1')).toBeNull();
      expect(validatePeerAddress('255.255.255.255:65535')).toBeNull();
    });

    it('accepts bracketed IPv6:port format', () => {
      expect(validatePeerAddress('[::1]:7654')).toBeNull();
      expect(validatePeerAddress('[fe80::1]:8080')).toBeNull();
      expect(validatePeerAddress('[2001:db8::1]:443')).toBeNull();
      expect(validatePeerAddress('[::ffff:192.168.1.1]:7654')).toBeNull();
    });

    it('trims whitespace', () => {
      expect(validatePeerAddress('  localhost:7654  ')).toBeNull();
      expect(validatePeerAddress('\tlocalhost:7654\n')).toBeNull();
    });

    it('accepts port boundaries', () => {
      expect(validatePeerAddress('localhost:1')).toBeNull();
      expect(validatePeerAddress('localhost:65535')).toBeNull();
    });
  });

  describe('invalid addresses', () => {
    it('rejects empty input', () => {
      expect(validatePeerAddress('')).toBe('Peer address is required');
      expect(validatePeerAddress('   ')).toBe('Peer address is required');
      expect(validatePeerAddress('\t\n')).toBe('Peer address is required');
    });

    it('rejects missing port', () => {
      expect(validatePeerAddress('localhost')).toBe('Use host:port or [ipv6]:port');
      expect(validatePeerAddress('192.168.1.1')).toBe('Use host:port or [ipv6]:port');
    });

    it('rejects invalid port numbers', () => {
      expect(validatePeerAddress('localhost:0')).toBe('Peer address must include a valid TCP port');
      expect(validatePeerAddress('localhost:65536')).toBe('Peer address must include a valid TCP port');
      expect(validatePeerAddress('localhost:99999')).toBe('Peer address must include a valid TCP port');
      expect(validatePeerAddress('[::1]:0')).toBe('Peer address must include a valid TCP port');
      expect(validatePeerAddress('[::1]:65536')).toBe('Peer address must include a valid TCP port');
    });

    it('rejects non-numeric ports', () => {
      // Non-numeric ports fail the HOST_PORT_PATTERN regex match entirely
      expect(validatePeerAddress('localhost:abc')).toBe('Use host:port or [ipv6]:port');
      expect(validatePeerAddress('localhost:')).toBe('Use host:port or [ipv6]:port');
    });

    it('rejects malformed IPv6', () => {
      expect(validatePeerAddress('::1:7654')).toBe('Use host:port or [ipv6]:port');
      expect(validatePeerAddress('[::1]')).toBe('Use host:port or [ipv6]:port');
    });

    it('rejects addresses with slashes', () => {
      expect(validatePeerAddress('host/path:7654')).toBe('Use host:port or [ipv6]:port');
    });

    it('rejects addresses with spaces in host', () => {
      expect(validatePeerAddress('local host:7654')).toBe('Use host:port or [ipv6]:port');
    });
  });
});

describe('validateTopicName', () => {
  describe('valid topic names', () => {
    it('accepts alphanumeric names', () => {
      expect(validateTopicName('events')).toBeNull();
      expect(validateTopicName('Events123')).toBeNull();
      expect(validateTopicName('0events')).toBeNull();
    });

    it('accepts names with allowed special characters', () => {
      expect(validateTopicName('events.logs')).toBeNull();
      expect(validateTopicName('events/errors')).toBeNull();
      expect(validateTopicName('events:critical')).toBeNull();
      expect(validateTopicName('events_app')).toBeNull();
      expect(validateTopicName('events-app')).toBeNull();
    });

    it('accepts complex valid names', () => {
      expect(validateTopicName('app.service/logs:error_level-1')).toBeNull();
      expect(validateTopicName('A.B/C:D_E-F')).toBeNull();
    });

    it('accepts maximum length (256 chars)', () => {
      const maxName = 'a'.repeat(256);
      expect(validateTopicName(maxName)).toBeNull();
    });

    it('trims whitespace', () => {
      expect(validateTopicName('  events  ')).toBeNull();
    });
  });

  describe('invalid topic names', () => {
    it('rejects empty input', () => {
      expect(validateTopicName('')).toBe('Topic name is required');
      expect(validateTopicName('   ')).toBe('Topic name is required');
    });

    it('rejects names exceeding 256 characters', () => {
      const longName = 'a'.repeat(257);
      expect(validateTopicName(longName)).toBe('Topic name must be 256 characters or fewer');
    });

    it('rejects names starting with special characters', () => {
      expect(validateTopicName('.events')).toBe('Use letters, numbers, dots, slashes, colons, underscores, or hyphens');
      expect(validateTopicName('/events')).toBe('Use letters, numbers, dots, slashes, colons, underscores, or hyphens');
      expect(validateTopicName(':events')).toBe('Use letters, numbers, dots, slashes, colons, underscores, or hyphens');
      expect(validateTopicName('_events')).toBe('Use letters, numbers, dots, slashes, colons, underscores, or hyphens');
      expect(validateTopicName('-events')).toBe('Use letters, numbers, dots, slashes, colons, underscores, or hyphens');
    });

    it('rejects names with disallowed characters', () => {
      expect(validateTopicName('events@app')).toBe('Use letters, numbers, dots, slashes, colons, underscores, or hyphens');
      expect(validateTopicName('events#logs')).toBe('Use letters, numbers, dots, slashes, colons, underscores, or hyphens');
      expect(validateTopicName('events$test')).toBe('Use letters, numbers, dots, slashes, colons, underscores, or hyphens');
      expect(validateTopicName('events spaces')).toBe('Use letters, numbers, dots, slashes, colons, underscores, or hyphens');
    });
  });
});

describe('validateGroupId', () => {
  describe('valid group IDs', () => {
    it('accepts alphanumeric IDs', () => {
      expect(validateGroupId('consumers')).toBeNull();
      expect(validateGroupId('Consumer123')).toBeNull();
      expect(validateGroupId('123group')).toBeNull();
    });

    it('accepts IDs with underscores and hyphens', () => {
      expect(validateGroupId('consumer_group')).toBeNull();
      expect(validateGroupId('consumer-group')).toBeNull();
      expect(validateGroupId('consumer_group-1')).toBeNull();
    });

    it('accepts maximum length (64 chars)', () => {
      const maxId = 'a'.repeat(64);
      expect(validateGroupId(maxId)).toBeNull();
    });

    it('accepts single character IDs', () => {
      expect(validateGroupId('a')).toBeNull();
      expect(validateGroupId('1')).toBeNull();
    });

    it('trims whitespace', () => {
      expect(validateGroupId('  consumers  ')).toBeNull();
    });
  });

  describe('invalid group IDs', () => {
    it('rejects empty input', () => {
      expect(validateGroupId('')).toBe('Group ID is required');
      expect(validateGroupId('   ')).toBe('Group ID is required');
    });

    it('rejects IDs exceeding 64 characters', () => {
      const longId = 'a'.repeat(65);
      expect(validateGroupId(longId)).toBe('Use only letters, numbers, hyphens, and underscores');
    });

    it('rejects IDs with disallowed characters', () => {
      expect(validateGroupId('group.name')).toBe('Use only letters, numbers, hyphens, and underscores');
      expect(validateGroupId('group/name')).toBe('Use only letters, numbers, hyphens, and underscores');
      expect(validateGroupId('group:name')).toBe('Use only letters, numbers, hyphens, and underscores');
      expect(validateGroupId('group name')).toBe('Use only letters, numbers, hyphens, and underscores');
      expect(validateGroupId('group@name')).toBe('Use only letters, numbers, hyphens, and underscores');
    });
  });

  describe('duplicate detection', () => {
    it('rejects duplicate IDs (case-insensitive)', () => {
      const existing = ['group1', 'group2'];
      expect(validateGroupId('group1', existing)).toBe('A consumer group with this ID already exists');
      expect(validateGroupId('GROUP1', existing)).toBe('A consumer group with this ID already exists');
      expect(validateGroupId('Group1', existing)).toBe('A consumer group with this ID already exists');
    });

    it('allows non-duplicate IDs', () => {
      const existing = ['group1', 'group2'];
      expect(validateGroupId('group3', existing)).toBeNull();
    });

    it('handles empty existing list', () => {
      expect(validateGroupId('group1', [])).toBeNull();
    });

    it('handles iterable input', () => {
      const existing = new Set(['group1', 'group2']);
      expect(validateGroupId('group1', existing)).toBe('A consumer group with this ID already exists');
      expect(validateGroupId('group3', existing)).toBeNull();
    });
  });
});

describe('validateContentType', () => {
  describe('valid content types', () => {
    it('accepts simple type names', () => {
      expect(validateContentType('message')).toBeNull();
      expect(validateContentType('Message123')).toBeNull();
      expect(validateContentType('0type')).toBeNull();
    });

    it('accepts types with allowed special characters', () => {
      expect(validateContentType('application/json')).toBeNull();
      expect(validateContentType('text.plain')).toBeNull();
      expect(validateContentType('content_type')).toBeNull();
      expect(validateContentType('content-type')).toBeNull();
    });

    it('accepts MIME-type-like formats', () => {
      expect(validateContentType('application/vnd.api.v1')).toBeNull();
      expect(validateContentType('text/html')).toBeNull();
    });

    it('accepts maximum length (128 chars)', () => {
      const maxType = 'a'.repeat(128);
      expect(validateContentType(maxType)).toBeNull();
    });

    it('trims whitespace', () => {
      expect(validateContentType('  message  ')).toBeNull();
    });
  });

  describe('invalid content types', () => {
    it('rejects empty input', () => {
      expect(validateContentType('')).toBe('Content type is required');
      expect(validateContentType('   ')).toBe('Content type is required');
    });

    it('rejects types starting with special characters', () => {
      expect(validateContentType('.type')).toBe('Use letters, numbers, dots, slashes, underscores, or hyphens');
      expect(validateContentType('/type')).toBe('Use letters, numbers, dots, slashes, underscores, or hyphens');
      expect(validateContentType('_type')).toBe('Use letters, numbers, dots, slashes, underscores, or hyphens');
      expect(validateContentType('-type')).toBe('Use letters, numbers, dots, slashes, underscores, or hyphens');
    });

    it('rejects types exceeding 128 characters', () => {
      const longType = 'a'.repeat(129);
      expect(validateContentType(longType)).toBe('Use letters, numbers, dots, slashes, underscores, or hyphens');
    });

    it('rejects types with disallowed characters', () => {
      expect(validateContentType('type:name')).toBe('Use letters, numbers, dots, slashes, underscores, or hyphens');
      expect(validateContentType('type name')).toBe('Use letters, numbers, dots, slashes, underscores, or hyphens');
      expect(validateContentType('type@name')).toBe('Use letters, numbers, dots, slashes, underscores, or hyphens');
    });
  });
});

describe('validatePositiveInteger', () => {
  describe('valid positive integers', () => {
    it('accepts positive integers', () => {
      expect(validatePositiveInteger('1', 'Value')).toBeNull();
      expect(validatePositiveInteger('42', 'Value')).toBeNull();
      expect(validatePositiveInteger('999999', 'Value')).toBeNull();
    });

    it('trims whitespace', () => {
      expect(validatePositiveInteger('  42  ', 'Value')).toBeNull();
    });
  });

  describe('invalid inputs', () => {
    it('rejects empty input', () => {
      expect(validatePositiveInteger('', 'Timeout')).toBe('Timeout is required');
      expect(validatePositiveInteger('   ', 'Count')).toBe('Count is required');
    });

    it('rejects zero', () => {
      expect(validatePositiveInteger('0', 'Value')).toBe('Value must be a positive integer');
    });

    it('rejects negative numbers', () => {
      expect(validatePositiveInteger('-1', 'Value')).toBe('Value must be a positive integer');
      expect(validatePositiveInteger('-42', 'Value')).toBe('Value must be a positive integer');
    });

    it('rejects non-numeric input', () => {
      expect(validatePositiveInteger('abc', 'Value')).toBe('Value must be a positive integer');
      expect(validatePositiveInteger('12abc', 'Value')).toBe('Value must be a positive integer');
      expect(validatePositiveInteger('abc12', 'Value')).toBe('Value must be a positive integer');
    });

    it('rejects decimal numbers', () => {
      expect(validatePositiveInteger('1.5', 'Value')).toBe('Value must be a positive integer');
      expect(validatePositiveInteger('42.0', 'Value')).toBe('Value must be a positive integer');
    });

    it('uses custom label in error message', () => {
      expect(validatePositiveInteger('', 'Retry count')).toBe('Retry count is required');
      expect(validatePositiveInteger('-1', 'Timeout seconds')).toBe('Timeout seconds must be a positive integer');
    });
  });
});

describe('validateOptionalPositiveInteger', () => {
  describe('valid inputs', () => {
    it('accepts empty input', () => {
      expect(validateOptionalPositiveInteger('', 'Value')).toBeNull();
      expect(validateOptionalPositiveInteger('   ', 'Value')).toBeNull();
    });

    it('accepts positive integers', () => {
      expect(validateOptionalPositiveInteger('1', 'Value')).toBeNull();
      expect(validateOptionalPositiveInteger('42', 'Value')).toBeNull();
    });
  });

  describe('invalid inputs', () => {
    it('rejects zero when provided', () => {
      expect(validateOptionalPositiveInteger('0', 'Value')).toBe('Value must be a positive integer');
    });

    it('rejects negative numbers when provided', () => {
      expect(validateOptionalPositiveInteger('-1', 'Value')).toBe('Value must be a positive integer');
    });

    it('rejects non-numeric input when provided', () => {
      expect(validateOptionalPositiveInteger('abc', 'Value')).toBe('Value must be a positive integer');
    });
  });
});

describe('validateOptionalNonNegativeInteger', () => {
  describe('valid inputs', () => {
    it('accepts empty input', () => {
      expect(validateOptionalNonNegativeInteger('', 'Value')).toBeNull();
      expect(validateOptionalNonNegativeInteger('   ', 'Value')).toBeNull();
    });

    it('accepts zero', () => {
      expect(validateOptionalNonNegativeInteger('0', 'Value')).toBeNull();
    });

    it('accepts positive integers', () => {
      expect(validateOptionalNonNegativeInteger('1', 'Value')).toBeNull();
      expect(validateOptionalNonNegativeInteger('42', 'Value')).toBeNull();
    });
  });

  describe('invalid inputs', () => {
    it('rejects negative numbers', () => {
      expect(validateOptionalNonNegativeInteger('-1', 'Value')).toBe('Value must be a non-negative integer');
    });

    it('rejects non-numeric input', () => {
      expect(validateOptionalNonNegativeInteger('abc', 'Value')).toBe('Value must be a non-negative integer');
    });

    it('rejects decimal numbers', () => {
      expect(validateOptionalNonNegativeInteger('1.5', 'Value')).toBe('Value must be a non-negative integer');
    });
  });
});

describe('parseJsonObject', () => {
  describe('valid JSON objects', () => {
    it('parses simple objects', () => {
      const result = parseJsonObject('{"key": "value"}');
      expect(result.error).toBeUndefined();
      expect(result.parsed).toEqual({ key: 'value' });
    });

    it('parses nested objects', () => {
      const result = parseJsonObject('{"outer": {"inner": 123}}');
      expect(result.error).toBeUndefined();
      expect(result.parsed).toEqual({ outer: { inner: 123 } });
    });

    it('parses objects with various value types', () => {
      const json = '{"str": "text", "num": 42, "bool": true, "null": null, "arr": [1,2,3]}';
      const result = parseJsonObject(json);
      expect(result.error).toBeUndefined();
      expect(result.parsed).toEqual({
        str: 'text',
        num: 42,
        bool: true,
        null: null,
        arr: [1, 2, 3],
      });
    });

    it('trims whitespace', () => {
      const result = parseJsonObject('  {"key": "value"}  ');
      expect(result.error).toBeUndefined();
      expect(result.parsed).toEqual({ key: 'value' });
    });

    it('parses empty objects', () => {
      const result = parseJsonObject('{}');
      expect(result.error).toBeUndefined();
      expect(result.parsed).toEqual({});
    });
  });

  describe('invalid inputs', () => {
    it('rejects empty input', () => {
      expect(parseJsonObject('')).toEqual({ error: 'JSON is required' });
      expect(parseJsonObject('   ')).toEqual({ error: 'JSON is required' });
    });

    it('rejects invalid JSON syntax', () => {
      expect(parseJsonObject('{')).toEqual({ error: 'JSON is invalid' });
      expect(parseJsonObject('{"key": }')).toEqual({ error: 'JSON is invalid' });
      expect(parseJsonObject('not json')).toEqual({ error: 'JSON is invalid' });
      expect(parseJsonObject('{key: "value"}')).toEqual({ error: 'JSON is invalid' });
    });

    it('rejects arrays', () => {
      expect(parseJsonObject('[]')).toEqual({ error: 'JSON must describe an object' });
      expect(parseJsonObject('[1, 2, 3]')).toEqual({ error: 'JSON must describe an object' });
      expect(parseJsonObject('[{"key": "value"}]')).toEqual({ error: 'JSON must describe an object' });
    });

    it('rejects primitive values', () => {
      expect(parseJsonObject('"string"')).toEqual({ error: 'JSON must describe an object' });
      expect(parseJsonObject('42')).toEqual({ error: 'JSON must describe an object' });
      expect(parseJsonObject('true')).toEqual({ error: 'JSON must describe an object' });
      expect(parseJsonObject('null')).toEqual({ error: 'JSON must describe an object' });
    });
  });
});

describe('validateSchemaDefinition', () => {
  describe('valid schemas', () => {
    it('accepts valid JSON schema', () => {
      const schema = JSON.stringify({
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      });
      const result = validateSchemaDefinition(schema, 'message');
      expect(result.error).toBeUndefined();
      expect(result.parsed).toBeDefined();
    });

    it('accepts schema with matching type const', () => {
      const schema = JSON.stringify({
        type: 'object',
        properties: {
          type: { const: 'message' },
        },
      });
      const result = validateSchemaDefinition(schema, 'message');
      expect(result.error).toBeUndefined();
    });

    it('accepts schema without type property', () => {
      const schema = JSON.stringify({
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      });
      const result = validateSchemaDefinition(schema, 'message');
      expect(result.error).toBeUndefined();
    });

    it('accepts schema when content type is empty', () => {
      const schema = JSON.stringify({
        type: 'object',
        properties: {
          type: { const: 'anything' },
        },
      });
      const result = validateSchemaDefinition(schema, '');
      expect(result.error).toBeUndefined();
    });

    it('accepts schema when content type is whitespace', () => {
      const schema = JSON.stringify({
        type: 'object',
        properties: {
          type: { const: 'anything' },
        },
      });
      const result = validateSchemaDefinition(schema, '   ');
      expect(result.error).toBeUndefined();
    });
  });

  describe('invalid schemas', () => {
    it('rejects empty input', () => {
      const result = validateSchemaDefinition('', 'message');
      expect(result.error).toBe('JSON is required');
    });

    it('rejects invalid JSON', () => {
      const result = validateSchemaDefinition('{invalid', 'message');
      expect(result.error).toBe('JSON is invalid');
    });

    it('rejects non-object JSON', () => {
      const result = validateSchemaDefinition('[]', 'message');
      expect(result.error).toBe('JSON must describe an object');
    });

    it('rejects schema with mismatched type const', () => {
      const schema = JSON.stringify({
        type: 'object',
        properties: {
          type: { const: 'different-type' },
        },
      });
      const result = validateSchemaDefinition(schema, 'message');
      expect(result.error).toBe('Schema properties.type.const must match the content type');
    });

    it('allows non-string const values', () => {
      const schema = JSON.stringify({
        type: 'object',
        properties: {
          type: { const: 123 },
        },
      });
      const result = validateSchemaDefinition(schema, 'message');
      expect(result.error).toBeUndefined();
    });
  });

  describe('edge cases for properties handling', () => {
    it('handles properties as an array', () => {
      const schema = JSON.stringify({
        type: 'object',
        properties: ['not', 'an', 'object'],
      });
      const result = validateSchemaDefinition(schema, 'message');
      expect(result.error).toBeUndefined();
    });

    it('handles properties as a primitive', () => {
      const schema = JSON.stringify({
        type: 'object',
        properties: 'invalid',
      });
      const result = validateSchemaDefinition(schema, 'message');
      expect(result.error).toBeUndefined();
    });

    it('handles properties as null', () => {
      const schema = JSON.stringify({
        type: 'object',
        properties: null,
      });
      const result = validateSchemaDefinition(schema, 'message');
      expect(result.error).toBeUndefined();
    });

    it('handles missing properties field', () => {
      const schema = JSON.stringify({
        type: 'object',
      });
      const result = validateSchemaDefinition(schema, 'message');
      expect(result.error).toBeUndefined();
    });

    it('handles type property as an array', () => {
      const schema = JSON.stringify({
        type: 'object',
        properties: {
          type: ['string', 'number'],
        },
      });
      const result = validateSchemaDefinition(schema, 'message');
      expect(result.error).toBeUndefined();
    });

    it('handles type property as a primitive', () => {
      const schema = JSON.stringify({
        type: 'object',
        properties: {
          type: 'string',
        },
      });
      const result = validateSchemaDefinition(schema, 'message');
      expect(result.error).toBeUndefined();
    });
  });
});

describe('validateAuthorId', () => {
  describe('valid author IDs', () => {
    it('accepts valid ed25519 format', () => {
      expect(validateAuthorId('@abc123.ed25519')).toBeNull();
      expect(validateAuthorId('@user.ed25519')).toBeNull();
      expect(validateAuthorId('@ABCDEF123456.ed25519')).toBeNull();
    });

    it('accepts author IDs with special characters between @ and .ed25519', () => {
      expect(validateAuthorId('@user-name.ed25519')).toBeNull();
      expect(validateAuthorId('@user_name.ed25519')).toBeNull();
      expect(validateAuthorId('@user.name.ed25519')).toBeNull();
      expect(validateAuthorId('@user/name.ed25519')).toBeNull();
    });

    it('accepts single character between @ and .ed25519', () => {
      expect(validateAuthorId('@a.ed25519')).toBeNull();
    });

    it('trims whitespace', () => {
      expect(validateAuthorId('  @user.ed25519  ')).toBeNull();
    });
  });

  describe('invalid author IDs', () => {
    it('rejects empty input', () => {
      expect(validateAuthorId('')).toBe('Author ID is required');
      expect(validateAuthorId('   ')).toBe('Author ID is required');
    });

    it('rejects IDs missing @ prefix', () => {
      expect(validateAuthorId('user.ed25519')).toBe('Author ID must look like @...ed25519');
    });

    it('rejects IDs missing .ed25519 suffix', () => {
      expect(validateAuthorId('@user')).toBe('Author ID must look like @...ed25519');
      expect(validateAuthorId('@user.ed2551')).toBe('Author ID must look like @...ed25519');
      expect(validateAuthorId('@user.ed25519x')).toBe('Author ID must look like @...ed25519');
    });

    it('rejects IDs with nothing between @ and .ed25519', () => {
      expect(validateAuthorId('@.ed25519')).toBe('Author ID must look like @...ed25519');
    });

    it('rejects IDs with wrong case in suffix', () => {
      expect(validateAuthorId('@user.ED25519')).toBe('Author ID must look like @...ed25519');
      expect(validateAuthorId('@user.Ed25519')).toBe('Author ID must look like @...ed25519');
    });
  });
});

describe('validateHook', () => {
  const validHookWithScript: Hook = {
    name: 'test-hook',
    on_message: '/usr/local/bin/handler.sh',
  };

  const validHookWithWebhook: Hook = {
    name: 'test-hook',
    webhook_url: 'https://example.com/webhook',
  };

  describe('transport validation', () => {
    it('accepts hook with script path', () => {
      const errors = validateHook(validHookWithScript);
      expect(errors.transport).toBeUndefined();
    });

    it('accepts hook with webhook URL', () => {
      const errors = validateHook(validHookWithWebhook);
      expect(errors.transport).toBeUndefined();
    });

    it('accepts hook with both script and webhook', () => {
      const hook: Hook = {
        on_message: '/path/to/script',
        webhook_url: 'https://example.com/webhook',
      };
      const errors = validateHook(hook);
      expect(errors.transport).toBeUndefined();
    });

    it('rejects hook with neither script nor webhook', () => {
      const hook: Hook = { name: 'empty-hook' };
      const errors = validateHook(hook);
      expect(errors.transport).toBe('Provide either a script path or a webhook URL');
    });

    it('rejects hook with empty strings for both', () => {
      const hook: Hook = { on_message: '', webhook_url: '' };
      const errors = validateHook(hook);
      expect(errors.transport).toBe('Provide either a script path or a webhook URL');
    });

    it('rejects hook with whitespace-only values', () => {
      const hook: Hook = { on_message: '   ', webhook_url: '   ' };
      const errors = validateHook(hook);
      expect(errors.transport).toBe('Provide either a script path or a webhook URL');
    });
  });

  describe('script path validation', () => {
    it('accepts absolute paths', () => {
      const hook: Hook = { on_message: '/usr/local/bin/handler' };
      const errors = validateHook(hook);
      expect(errors.on_message).toBeUndefined();
    });

    it('accepts relative paths with ./', () => {
      const hook: Hook = { on_message: './scripts/handler.sh' };
      const errors = validateHook(hook);
      expect(errors.on_message).toBeUndefined();
    });

    it('accepts relative paths with ../', () => {
      const hook: Hook = { on_message: '../scripts/handler.sh' };
      const errors = validateHook(hook);
      expect(errors.on_message).toBeUndefined();
    });

    it('accepts simple command names', () => {
      const hook: Hook = { on_message: 'handler' };
      const errors = validateHook(hook);
      expect(errors.on_message).toBeUndefined();
    });

    it('accepts paths with underscores and hyphens', () => {
      const hook: Hook = { on_message: '/path/to/my-handler_script.sh' };
      const errors = validateHook(hook);
      expect(errors.on_message).toBeUndefined();
    });

    it('rejects paths with newlines', () => {
      const hook: Hook = { on_message: '/path/to/script\n/another/path' };
      const errors = validateHook(hook);
      expect(errors.on_message).toBe('Script path must be a single path or command');
    });

    it('rejects paths with carriage returns', () => {
      const hook: Hook = { on_message: '/path/to/script\r/another' };
      const errors = validateHook(hook);
      expect(errors.on_message).toBe('Script path must be a single path or command');
    });

    it('rejects paths starting with invalid characters', () => {
      const hook: Hook = { on_message: '@invalid/path' };
      const errors = validateHook(hook);
      expect(errors.on_message).toBe('Script path must look like a valid command path');
    });
  });

  describe('webhook URL validation', () => {
    it('accepts https URLs', () => {
      const hook: Hook = { webhook_url: 'https://example.com/webhook' };
      const errors = validateHook(hook);
      expect(errors.webhook_url).toBeUndefined();
    });

    it('accepts http URLs', () => {
      const hook: Hook = { webhook_url: 'http://localhost:8080/webhook' };
      const errors = validateHook(hook);
      expect(errors.webhook_url).toBeUndefined();
    });

    it('accepts URLs with paths and query strings', () => {
      const hook: Hook = { webhook_url: 'https://api.example.com/v1/webhooks?token=abc' };
      const errors = validateHook(hook);
      expect(errors.webhook_url).toBeUndefined();
    });

    it('rejects non-http/https protocols', () => {
      const hook: Hook = { webhook_url: 'ftp://example.com/file' };
      const errors = validateHook(hook);
      expect(errors.webhook_url).toBe('Webhook URL must start with http:// or https://');
    });

    it('rejects file:// URLs', () => {
      const hook: Hook = { webhook_url: 'file:///etc/passwd' };
      const errors = validateHook(hook);
      expect(errors.webhook_url).toBe('Webhook URL must start with http:// or https://');
    });

    it('rejects invalid URLs', () => {
      const hook: Hook = { webhook_url: 'not-a-url' };
      const errors = validateHook(hook);
      expect(errors.webhook_url).toBe('Webhook URL must be a valid absolute URL');
    });

    it('rejects relative URLs', () => {
      const hook: Hook = { webhook_url: '/webhook/endpoint' };
      const errors = validateHook(hook);
      expect(errors.webhook_url).toBe('Webhook URL must be a valid absolute URL');
    });
  });

  describe('timeout_secs validation', () => {
    it('accepts valid positive integers', () => {
      const hook: Hook = { on_message: '/script', timeout_secs: 30 };
      const errors = validateHook(hook);
      expect(errors.timeout_secs).toBeUndefined();
    });

    it('accepts timeout of 1', () => {
      const hook: Hook = { on_message: '/script', timeout_secs: 1 };
      const errors = validateHook(hook);
      expect(errors.timeout_secs).toBeUndefined();
    });

    it('accepts undefined timeout', () => {
      const hook: Hook = { on_message: '/script' };
      const errors = validateHook(hook);
      expect(errors.timeout_secs).toBeUndefined();
    });

    it('rejects zero timeout', () => {
      const hook: Hook = { on_message: '/script', timeout_secs: 0 };
      const errors = validateHook(hook);
      expect(errors.timeout_secs).toBe('Timeout must be greater than zero');
    });

    it('rejects negative timeout', () => {
      const hook: Hook = { on_message: '/script', timeout_secs: -1 };
      const errors = validateHook(hook);
      expect(errors.timeout_secs).toBe('Timeout must be greater than zero');
    });

    it('rejects non-integer timeout', () => {
      const hook: Hook = { on_message: '/script', timeout_secs: 1.5 };
      const errors = validateHook(hook);
      expect(errors.timeout_secs).toBe('Timeout must be greater than zero');
    });
  });

  describe('max_retries validation', () => {
    it('accepts zero retries', () => {
      const hook: Hook = { on_message: '/script', max_retries: 0 };
      const errors = validateHook(hook);
      expect(errors.max_retries).toBeUndefined();
    });

    it('accepts positive retries', () => {
      const hook: Hook = { on_message: '/script', max_retries: 5 };
      const errors = validateHook(hook);
      expect(errors.max_retries).toBeUndefined();
    });

    it('accepts undefined max_retries', () => {
      const hook: Hook = { on_message: '/script' };
      const errors = validateHook(hook);
      expect(errors.max_retries).toBeUndefined();
    });

    it('rejects negative retries', () => {
      const hook: Hook = { on_message: '/script', max_retries: -1 };
      const errors = validateHook(hook);
      expect(errors.max_retries).toBe('Max retries must be zero or greater');
    });

    it('rejects non-integer retries', () => {
      const hook: Hook = { on_message: '/script', max_retries: 1.5 };
      const errors = validateHook(hook);
      expect(errors.max_retries).toBe('Max retries must be zero or greater');
    });
  });

  describe('retry_delay_secs validation', () => {
    it('accepts positive delay', () => {
      const hook: Hook = { on_message: '/script', retry_delay_secs: 5 };
      const errors = validateHook(hook);
      expect(errors.retry_delay_secs).toBeUndefined();
    });

    it('accepts delay of 1', () => {
      const hook: Hook = { on_message: '/script', retry_delay_secs: 1 };
      const errors = validateHook(hook);
      expect(errors.retry_delay_secs).toBeUndefined();
    });

    it('accepts undefined delay', () => {
      const hook: Hook = { on_message: '/script' };
      const errors = validateHook(hook);
      expect(errors.retry_delay_secs).toBeUndefined();
    });

    it('rejects zero delay', () => {
      const hook: Hook = { on_message: '/script', retry_delay_secs: 0 };
      const errors = validateHook(hook);
      expect(errors.retry_delay_secs).toBe('Retry delay must be greater than zero');
    });

    it('rejects negative delay', () => {
      const hook: Hook = { on_message: '/script', retry_delay_secs: -1 };
      const errors = validateHook(hook);
      expect(errors.retry_delay_secs).toBe('Retry delay must be greater than zero');
    });

    it('rejects non-integer delay', () => {
      const hook: Hook = { on_message: '/script', retry_delay_secs: 1.5 };
      const errors = validateHook(hook);
      expect(errors.retry_delay_secs).toBe('Retry delay must be greater than zero');
    });
  });

  describe('multiple validation errors', () => {
    it('returns multiple errors when applicable', () => {
      const hook: Hook = {
        on_message: '/script\ninjection',
        webhook_url: 'invalid-url',
        timeout_secs: -1,
        max_retries: -1,
        retry_delay_secs: 0,
      };
      const errors = validateHook(hook);
      expect(errors.on_message).toBe('Script path must be a single path or command');
      expect(errors.webhook_url).toBe('Webhook URL must be a valid absolute URL');
      expect(errors.timeout_secs).toBe('Timeout must be greater than zero');
      expect(errors.max_retries).toBe('Max retries must be zero or greater');
      expect(errors.retry_delay_secs).toBe('Retry delay must be greater than zero');
    });
  });
});
