import { getFeed } from './feed';
import type { Message, TaskResultContent, TraceSpanContent } from './types';

export interface TraceRow {
  span: Message<TraceSpanContent>;
  depth: number;
}

export interface TraceRange {
  startMs: number;
  endMs: number;
  durationMs: number;
}

interface TraceNode {
  span: Message<TraceSpanContent>;
  children: TraceNode[];
}

export async function getTraceSpans(traceId: string, limit = 500): Promise<Message<TraceSpanContent>[]> {
  const messages = await getFeed({
    include_self: true,
    content_type: 'trace_span',
    trace_id: traceId,
    limit,
  });

  return messages
    .filter((message): message is Message<TraceSpanContent> => {
      const content = message.content as TraceSpanContent;
      return content.type === 'trace_span' && (content.trace_id === traceId || message.trace_id === traceId);
    })
    .sort(
      (left, right) =>
        new Date(left.content.start_ts).getTime() - new Date(right.content.start_ts).getTime()
    );
}

export async function getRecentTraceableTaskResults(limit = 100): Promise<Message<TaskResultContent>[]> {
  const messages = await getFeed({ include_self: true, content_type: 'task_result', limit });

  return messages
    .filter((message): message is Message<TaskResultContent> => {
      const content = message.content as TaskResultContent;
      return content.type === 'task_result' && typeof (content.trace_id ?? message.trace_id) === 'string';
    })
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
}

export function buildTraceRows(spans: Message<TraceSpanContent>[]): TraceRow[] {
  const nodes = new Map<string, TraceNode>();
  const roots: TraceNode[] = [];

  for (const span of spans) {
    nodes.set(span.content.span_id, { span, children: [] });
  }

  for (const span of spans) {
    const node = nodes.get(span.content.span_id);
    if (!node) continue;

    const parentId = span.content.parent_span_id;
    if (parentId) {
      const parent = nodes.get(parentId);
      if (parent && parent !== node) {
        parent.children.push(node);
        continue;
      }
    }

    roots.push(node);
  }

  const sortNodes = (items: TraceNode[]) => {
    items.sort(
      (left, right) =>
        new Date(left.span.content.start_ts).getTime() - new Date(right.span.content.start_ts).getTime()
    );
    items.forEach((item) => sortNodes(item.children));
  };
  sortNodes(roots);

  const rows: TraceRow[] = [];
  const visit = (node: TraceNode, depth: number) => {
    rows.push({ span: node.span, depth });
    node.children.forEach((child) => visit(child, depth + 1));
  };
  roots.forEach((root) => visit(root, 0));

  return rows;
}

export function getTraceRange(spans: Message<TraceSpanContent>[]): TraceRange | null {
  if (spans.length === 0) {
    return null;
  }

  const startMs = Math.min(...spans.map((span) => new Date(span.content.start_ts).getTime()));
  const endMs = Math.max(...spans.map((span) => new Date(span.content.end_ts).getTime()));

  return {
    startMs,
    endMs,
    durationMs: Math.max(endMs - startMs, 1),
  };
}
