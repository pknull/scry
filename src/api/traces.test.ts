import { describe, it, expect } from 'vitest';
import { buildTraceRows, getTraceRange } from './traces';
import type { Message, TraceSpanContent } from './types';

// Helper to create a span message
function createSpanMessage(
  spanId: string,
  name: string,
  startTs: string,
  endTs: string,
  parentSpanId?: string,
  overrides: Partial<Message<TraceSpanContent>> = {}
): Message<TraceSpanContent> {
  return {
    hash: `hash-${spanId}`,
    author: 'author-1',
    sequence: 1,
    timestamp: startTs,
    previous: null,
    content: {
      type: 'trace_span',
      trace_id: 'trace-1',
      span_id: spanId,
      parent_span_id: parentSpanId,
      name,
      service: 'test-service',
      start_ts: startTs,
      end_ts: endTs,
    },
    signature: 'sig',
    ...overrides,
  };
}

describe('buildTraceRows', () => {
  describe('basic tree building', () => {
    it('returns empty array for empty input', () => {
      const result = buildTraceRows([]);
      expect(result).toEqual([]);
    });

    it('builds a single root span with depth 0', () => {
      const spans = [
        createSpanMessage('span-1', 'root', '2024-01-01T10:00:00Z', '2024-01-01T10:01:00Z'),
      ];

      const result = buildTraceRows(spans);

      expect(result).toHaveLength(1);
      expect(result[0].span.content.span_id).toBe('span-1');
      expect(result[0].depth).toBe(0);
    });

    it('builds multiple root spans when no parent relationships', () => {
      const spans = [
        createSpanMessage('span-1', 'root-1', '2024-01-01T10:00:00Z', '2024-01-01T10:01:00Z'),
        createSpanMessage('span-2', 'root-2', '2024-01-01T10:02:00Z', '2024-01-01T10:03:00Z'),
      ];

      const result = buildTraceRows(spans);

      expect(result).toHaveLength(2);
      expect(result.every((r) => r.depth === 0)).toBe(true);
    });

    it('builds parent-child relationship with correct depths', () => {
      const spans = [
        createSpanMessage('parent', 'parent-op', '2024-01-01T10:00:00Z', '2024-01-01T10:05:00Z'),
        createSpanMessage(
          'child',
          'child-op',
          '2024-01-01T10:01:00Z',
          '2024-01-01T10:02:00Z',
          'parent'
        ),
      ];

      const result = buildTraceRows(spans);

      expect(result).toHaveLength(2);
      expect(result[0].span.content.span_id).toBe('parent');
      expect(result[0].depth).toBe(0);
      expect(result[1].span.content.span_id).toBe('child');
      expect(result[1].depth).toBe(1);
    });

    it('builds three-level hierarchy', () => {
      const spans = [
        createSpanMessage('root', 'root', '2024-01-01T10:00:00Z', '2024-01-01T10:10:00Z'),
        createSpanMessage('child', 'child', '2024-01-01T10:01:00Z', '2024-01-01T10:05:00Z', 'root'),
        createSpanMessage(
          'grandchild',
          'grandchild',
          '2024-01-01T10:02:00Z',
          '2024-01-01T10:03:00Z',
          'child'
        ),
      ];

      const result = buildTraceRows(spans);

      expect(result).toHaveLength(3);
      expect(result[0].span.content.span_id).toBe('root');
      expect(result[0].depth).toBe(0);
      expect(result[1].span.content.span_id).toBe('child');
      expect(result[1].depth).toBe(1);
      expect(result[2].span.content.span_id).toBe('grandchild');
      expect(result[2].depth).toBe(2);
    });
  });

  describe('sorting behavior', () => {
    it('sorts root spans by start time ascending', () => {
      const spans = [
        createSpanMessage('span-2', 'later', '2024-01-01T10:05:00Z', '2024-01-01T10:06:00Z'),
        createSpanMessage('span-1', 'earlier', '2024-01-01T10:00:00Z', '2024-01-01T10:01:00Z'),
        createSpanMessage('span-3', 'middle', '2024-01-01T10:02:00Z', '2024-01-01T10:03:00Z'),
      ];

      const result = buildTraceRows(spans);

      expect(result[0].span.content.span_id).toBe('span-1'); // earliest
      expect(result[1].span.content.span_id).toBe('span-3'); // middle
      expect(result[2].span.content.span_id).toBe('span-2'); // latest
    });

    it('sorts sibling children by start time ascending', () => {
      const spans = [
        createSpanMessage('root', 'root', '2024-01-01T10:00:00Z', '2024-01-01T10:10:00Z'),
        createSpanMessage(
          'child-late',
          'late-child',
          '2024-01-01T10:05:00Z',
          '2024-01-01T10:06:00Z',
          'root'
        ),
        createSpanMessage(
          'child-early',
          'early-child',
          '2024-01-01T10:01:00Z',
          '2024-01-01T10:02:00Z',
          'root'
        ),
      ];

      const result = buildTraceRows(spans);

      expect(result[0].span.content.span_id).toBe('root');
      expect(result[1].span.content.span_id).toBe('child-early');
      expect(result[2].span.content.span_id).toBe('child-late');
    });

    it('maintains depth-first traversal order after sorting', () => {
      // Complex tree:
      // root (10:00)
      //   child-b (10:05)
      //     grandchild-b (10:06)
      //   child-a (10:01)
      //     grandchild-a (10:02)
      const spans = [
        createSpanMessage('root', 'root', '2024-01-01T10:00:00Z', '2024-01-01T10:30:00Z'),
        createSpanMessage(
          'child-b',
          'child-b',
          '2024-01-01T10:05:00Z',
          '2024-01-01T10:10:00Z',
          'root'
        ),
        createSpanMessage(
          'grandchild-b',
          'gc-b',
          '2024-01-01T10:06:00Z',
          '2024-01-01T10:07:00Z',
          'child-b'
        ),
        createSpanMessage(
          'child-a',
          'child-a',
          '2024-01-01T10:01:00Z',
          '2024-01-01T10:04:00Z',
          'root'
        ),
        createSpanMessage(
          'grandchild-a',
          'gc-a',
          '2024-01-01T10:02:00Z',
          '2024-01-01T10:03:00Z',
          'child-a'
        ),
      ];

      const result = buildTraceRows(spans);

      // Expected order (depth-first, sorted by start time at each level):
      // root (depth 0)
      // child-a (depth 1) - sorted before child-b
      // grandchild-a (depth 2)
      // child-b (depth 1)
      // grandchild-b (depth 2)
      expect(result.map((r) => r.span.content.span_id)).toEqual([
        'root',
        'child-a',
        'grandchild-a',
        'child-b',
        'grandchild-b',
      ]);
      expect(result.map((r) => r.depth)).toEqual([0, 1, 2, 1, 2]);
    });
  });

  describe('edge cases', () => {
    it('handles orphaned child spans (missing parent) as roots', () => {
      const spans = [
        createSpanMessage(
          'orphan',
          'orphan-span',
          '2024-01-01T10:00:00Z',
          '2024-01-01T10:01:00Z',
          'missing-parent'
        ),
      ];

      const result = buildTraceRows(spans);

      expect(result).toHaveLength(1);
      expect(result[0].depth).toBe(0); // Treated as root since parent not found
    });

    it('handles duplicate span IDs by keeping last occurrence in node map', () => {
      // When two spans have the same span_id, the second overwrites in the nodes Map
      // Both iterations push to roots (since neither finds a parent), resulting in 2 entries
      // The second entry uses the node from the Map (which was overwritten by the second span)
      const spans = [
        createSpanMessage('dup', 'first', '2024-01-01T10:00:00Z', '2024-01-01T10:01:00Z'),
        createSpanMessage('dup', 'second', '2024-01-01T10:02:00Z', '2024-01-01T10:03:00Z'),
      ];

      const result = buildTraceRows(spans);

      // Both spans trigger roots.push since neither has a valid parent
      // But both reference the same node (the second span's data)
      expect(result).toHaveLength(2);
      // Both rows reference the same node which contains the second span's data
      expect(result[0].span.content.name).toBe('second');
      expect(result[1].span.content.name).toBe('second');
    });

    it('prevents self-referential spans from causing cycles', () => {
      // A span that references itself as parent
      const spans = [
        createSpanMessage(
          'self-ref',
          'self-referential',
          '2024-01-01T10:00:00Z',
          '2024-01-01T10:01:00Z',
          'self-ref'
        ),
      ];

      const result = buildTraceRows(spans);

      // Should be treated as root (parent check prevents self-reference)
      expect(result).toHaveLength(1);
      expect(result[0].depth).toBe(0);
    });

    it('handles complex multi-branch tree correctly', () => {
      // Tree structure:
      // root
      //   |- child-1
      //   |    |- grandchild-1a
      //   |    |- grandchild-1b
      //   |- child-2
      //        |- grandchild-2a
      const spans = [
        createSpanMessage('root', 'root', '2024-01-01T10:00:00Z', '2024-01-01T10:30:00Z'),
        createSpanMessage(
          'child-1',
          'c1',
          '2024-01-01T10:01:00Z',
          '2024-01-01T10:10:00Z',
          'root'
        ),
        createSpanMessage(
          'child-2',
          'c2',
          '2024-01-01T10:11:00Z',
          '2024-01-01T10:20:00Z',
          'root'
        ),
        createSpanMessage(
          'gc-1a',
          'gc1a',
          '2024-01-01T10:02:00Z',
          '2024-01-01T10:03:00Z',
          'child-1'
        ),
        createSpanMessage(
          'gc-1b',
          'gc1b',
          '2024-01-01T10:04:00Z',
          '2024-01-01T10:05:00Z',
          'child-1'
        ),
        createSpanMessage(
          'gc-2a',
          'gc2a',
          '2024-01-01T10:12:00Z',
          '2024-01-01T10:13:00Z',
          'child-2'
        ),
      ];

      const result = buildTraceRows(spans);

      expect(result).toHaveLength(6);
      expect(result.map((r) => r.span.content.span_id)).toEqual([
        'root',
        'child-1',
        'gc-1a',
        'gc-1b',
        'child-2',
        'gc-2a',
      ]);
      expect(result.map((r) => r.depth)).toEqual([0, 1, 2, 2, 1, 2]);
    });

    it('handles spans arriving out of order', () => {
      // Child arrives before parent in the array
      const spans = [
        createSpanMessage(
          'child',
          'child-op',
          '2024-01-01T10:01:00Z',
          '2024-01-01T10:02:00Z',
          'parent'
        ),
        createSpanMessage('parent', 'parent-op', '2024-01-01T10:00:00Z', '2024-01-01T10:05:00Z'),
      ];

      const result = buildTraceRows(spans);

      // Should still build correct hierarchy
      expect(result).toHaveLength(2);
      expect(result[0].span.content.span_id).toBe('parent');
      expect(result[0].depth).toBe(0);
      expect(result[1].span.content.span_id).toBe('child');
      expect(result[1].depth).toBe(1);
    });

    it('handles multiple independent trees', () => {
      const spans = [
        createSpanMessage('tree1-root', 't1-root', '2024-01-01T10:00:00Z', '2024-01-01T10:10:00Z'),
        createSpanMessage(
          'tree1-child',
          't1-child',
          '2024-01-01T10:01:00Z',
          '2024-01-01T10:02:00Z',
          'tree1-root'
        ),
        createSpanMessage('tree2-root', 't2-root', '2024-01-01T10:05:00Z', '2024-01-01T10:15:00Z'),
        createSpanMessage(
          'tree2-child',
          't2-child',
          '2024-01-01T10:06:00Z',
          '2024-01-01T10:07:00Z',
          'tree2-root'
        ),
      ];

      const result = buildTraceRows(spans);

      expect(result).toHaveLength(4);
      // tree1-root starts earlier, so it comes first
      expect(result[0].span.content.span_id).toBe('tree1-root');
      expect(result[0].depth).toBe(0);
      expect(result[1].span.content.span_id).toBe('tree1-child');
      expect(result[1].depth).toBe(1);
      expect(result[2].span.content.span_id).toBe('tree2-root');
      expect(result[2].depth).toBe(0);
      expect(result[3].span.content.span_id).toBe('tree2-child');
      expect(result[3].depth).toBe(1);
    });

    it('handles deeply nested spans (5 levels)', () => {
      const spans = [
        createSpanMessage('l0', 'level-0', '2024-01-01T10:00:00Z', '2024-01-01T10:30:00Z'),
        createSpanMessage('l1', 'level-1', '2024-01-01T10:01:00Z', '2024-01-01T10:25:00Z', 'l0'),
        createSpanMessage('l2', 'level-2', '2024-01-01T10:02:00Z', '2024-01-01T10:20:00Z', 'l1'),
        createSpanMessage('l3', 'level-3', '2024-01-01T10:03:00Z', '2024-01-01T10:15:00Z', 'l2'),
        createSpanMessage('l4', 'level-4', '2024-01-01T10:04:00Z', '2024-01-01T10:10:00Z', 'l3'),
      ];

      const result = buildTraceRows(spans);

      expect(result).toHaveLength(5);
      expect(result.map((r) => r.depth)).toEqual([0, 1, 2, 3, 4]);
    });
  });
});

describe('getTraceRange', () => {
  it('returns null for empty spans array', () => {
    const result = getTraceRange([]);

    expect(result).toBeNull();
  });

  it('calculates range for a single span', () => {
    const spans = [
      createSpanMessage('span-1', 'op', '2024-01-01T10:00:00Z', '2024-01-01T10:01:00Z'),
    ];

    const result = getTraceRange(spans);

    expect(result).not.toBeNull();
    expect(result!.startMs).toBe(new Date('2024-01-01T10:00:00Z').getTime());
    expect(result!.endMs).toBe(new Date('2024-01-01T10:01:00Z').getTime());
    expect(result!.durationMs).toBe(60000); // 1 minute
  });

  it('calculates range across multiple spans', () => {
    const spans = [
      createSpanMessage('span-1', 'first', '2024-01-01T10:00:00Z', '2024-01-01T10:05:00Z'),
      createSpanMessage('span-2', 'second', '2024-01-01T10:02:00Z', '2024-01-01T10:10:00Z'),
      createSpanMessage('span-3', 'third', '2024-01-01T10:01:00Z', '2024-01-01T10:03:00Z'),
    ];

    const result = getTraceRange(spans);

    // Start should be earliest start_ts (span-1: 10:00)
    // End should be latest end_ts (span-2: 10:10)
    expect(result).not.toBeNull();
    expect(result!.startMs).toBe(new Date('2024-01-01T10:00:00Z').getTime());
    expect(result!.endMs).toBe(new Date('2024-01-01T10:10:00Z').getTime());
    expect(result!.durationMs).toBe(600000); // 10 minutes
  });

  it('handles spans with same start and end time', () => {
    const spans = [
      createSpanMessage('span-1', 'instant', '2024-01-01T10:00:00Z', '2024-01-01T10:00:00Z'),
    ];

    const result = getTraceRange(spans);

    expect(result).not.toBeNull();
    expect(result!.startMs).toBe(result!.endMs);
    // Duration should be at least 1ms (clamped)
    expect(result!.durationMs).toBe(1);
  });

  it('handles overlapping spans correctly', () => {
    const spans = [
      createSpanMessage('span-1', 'first', '2024-01-01T10:00:00Z', '2024-01-01T10:30:00Z'),
      createSpanMessage('span-2', 'overlapping', '2024-01-01T10:15:00Z', '2024-01-01T10:45:00Z'),
    ];

    const result = getTraceRange(spans);

    expect(result!.startMs).toBe(new Date('2024-01-01T10:00:00Z').getTime());
    expect(result!.endMs).toBe(new Date('2024-01-01T10:45:00Z').getTime());
    expect(result!.durationMs).toBe(45 * 60 * 1000); // 45 minutes
  });

  it('handles non-overlapping spans correctly', () => {
    const spans = [
      createSpanMessage('span-1', 'first', '2024-01-01T10:00:00Z', '2024-01-01T10:10:00Z'),
      createSpanMessage('span-2', 'second', '2024-01-01T10:20:00Z', '2024-01-01T10:30:00Z'),
    ];

    const result = getTraceRange(spans);

    expect(result!.startMs).toBe(new Date('2024-01-01T10:00:00Z').getTime());
    expect(result!.endMs).toBe(new Date('2024-01-01T10:30:00Z').getTime());
    // Includes the gap between spans
    expect(result!.durationMs).toBe(30 * 60 * 1000); // 30 minutes
  });

  it('handles spans in millisecond precision', () => {
    const spans = [
      createSpanMessage(
        'span-1',
        'fast',
        '2024-01-01T10:00:00.000Z',
        '2024-01-01T10:00:00.100Z'
      ),
      createSpanMessage(
        'span-2',
        'faster',
        '2024-01-01T10:00:00.050Z',
        '2024-01-01T10:00:00.200Z'
      ),
    ];

    const result = getTraceRange(spans);

    expect(result!.startMs).toBe(new Date('2024-01-01T10:00:00.000Z').getTime());
    expect(result!.endMs).toBe(new Date('2024-01-01T10:00:00.200Z').getTime());
    expect(result!.durationMs).toBe(200); // 200ms
  });
});
