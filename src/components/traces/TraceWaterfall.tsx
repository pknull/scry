import type { Message, TraceSpanContent } from '../../api/types';
import { buildTraceRows, getTraceRange } from '../../api/traces';
import { SpanRow } from './SpanRow';

interface TraceWaterfallProps {
  spans: Message<TraceSpanContent>[];
}

function formatAxisLabel(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function TraceWaterfall({ spans }: TraceWaterfallProps) {
  const range = getTraceRange(spans);
  if (!range) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-sm text-text-muted">
        No spans found for this trace ID.
      </div>
    );
  }

  const rows = buildTraceRows(spans);
  const markers = [0, 0.25, 0.5, 0.75, 1].map((fraction) => ({
    fraction,
    label: formatAxisLabel(Math.round(range.durationMs * fraction)),
  }));

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-bg-secondary">
      <div className="grid grid-cols-[minmax(0,280px)_minmax(0,1fr)_100px] gap-4 border-b border-border px-4 py-3 text-xs uppercase tracking-wide text-text-muted">
        <div>Span</div>
        <div className="flex justify-between">
          {markers.map((marker) => (
            <span key={marker.fraction}>{marker.label}</span>
          ))}
        </div>
        <div className="text-right">Duration</div>
      </div>

      <div>
        {rows.map((row) => (
          <SpanRow
            key={`${row.span.content.span_id}-${row.span.hash}`}
            row={row}
            range={range}
          />
        ))}
      </div>
    </div>
  );
}
