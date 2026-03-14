import { AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import type { TraceRange, TraceRow } from '../../api/traces';

interface SpanRowProps {
  row: TraceRow;
  range: TraceRange;
}

function formatRelative(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function SpanRow({ row, range }: SpanRowProps) {
  const startMs = new Date(row.span.content.start_ts).getTime();
  const endMs = new Date(row.span.content.end_ts).getTime();
  const offsetMs = Math.max(0, startMs - range.startMs);
  const durationMs = Math.max(1, endMs - startMs);
  const leftPct = (offsetMs / range.durationMs) * 100;
  const widthPct = Math.max((durationMs / range.durationMs) * 100, 1.5);
  const isError = row.span.content.status === 'error' || row.span.content.status === 'timeout';

  return (
    <div className="grid grid-cols-[minmax(0,280px)_minmax(0,1fr)_100px] items-center gap-4 border-t border-border/70 px-4 py-3 text-sm">
      <div
        className="truncate text-text"
        style={{ paddingLeft: `${row.depth * 16}px` }}
        title={row.span.content.name}
      >
        <span className={clsx('font-medium', isError && 'text-error')}>
          {row.span.content.name}
        </span>
        <span className="ml-2 text-xs text-text-muted">{row.span.content.service}</span>
      </div>

      <div className="relative h-8 rounded bg-bg">
        <div
          className={clsx(
            'absolute top-1/2 h-4 -translate-y-1/2 rounded',
            isError ? 'bg-error/80' : 'bg-accent'
          )}
          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
          title={`${formatRelative(offsetMs)} -> ${formatRelative(offsetMs + durationMs)}`}
        />
      </div>

      <div className="flex items-center justify-end gap-2 text-xs text-text-muted">
        {isError ? <AlertTriangle className="h-3.5 w-3.5 text-error" /> : null}
        <span>{formatRelative(durationMs)}</span>
      </div>
    </div>
  );
}
