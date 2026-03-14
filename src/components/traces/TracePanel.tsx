import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Loader2, Search } from 'lucide-react';
import { getRecentTraceableTaskResults, getTraceSpans } from '../../api/traces';
import { useAppStore } from '../../stores/appStore';
import { Button } from '../ui/Button';
import { Card, CardHeader, CardTitle } from '../ui/Card';
import { Input } from '../ui/Input';
import { TraceWaterfall } from './TraceWaterfall';

function shortId(value: string): string {
  return value.slice(0, 16);
}

export function TracePanel() {
  const { selectedTraceId, setSelectedTraceId } = useAppStore();
  const [draftTraceId, setDraftTraceId] = useState(selectedTraceId ?? '');

  const traceQuery = useQuery({
    queryKey: ['trace', selectedTraceId],
    queryFn: () => getTraceSpans(selectedTraceId ?? ''),
    enabled: Boolean(selectedTraceId),
    refetchInterval: 5000,
  });

  const recentResultsQuery = useQuery({
    queryKey: ['traceable-task-results'],
    queryFn: () => getRecentTraceableTaskResults(100),
    refetchInterval: 5000,
  });

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col gap-4">
      <Card>
        <CardHeader className="mb-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-5 w-5 text-accent" />
              Distributed Trace Waterfall
            </CardTitle>
            <div className="mt-1 text-sm text-text-muted">
              Inspect `trace_span` messages and open traces from task results.
            </div>
          </div>
        </CardHeader>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <Input
              value={draftTraceId}
              onChange={(event) => setDraftTraceId(event.target.value)}
              placeholder="Enter a trace ID"
              className="pl-10"
            />
          </div>
          <Button
            onClick={() => setSelectedTraceId(draftTraceId.trim() || null)}
            disabled={!draftTraceId.trim()}
          >
            View Trace
          </Button>
        </div>
      </Card>

      <div className="grid min-h-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <Card padding="none" className="min-h-0">
          <CardHeader className="border-b border-border px-4 py-4">
            <CardTitle className="text-base">Recent Task Results With Traces</CardTitle>
          </CardHeader>
          <div className="divide-y divide-border">
            {recentResultsQuery.isLoading ? (
              <div className="flex items-center gap-2 px-4 py-6 text-sm text-text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading traces...
              </div>
            ) : recentResultsQuery.data && recentResultsQuery.data.length > 0 ? (
              recentResultsQuery.data.map((message) => {
                const traceId = message.content.trace_id ?? message.trace_id;
                if (!traceId) return null;

                return (
                  <button
                    key={message.hash}
                    onClick={() => {
                      setDraftTraceId(traceId);
                      setSelectedTraceId(traceId);
                    }}
                    className="w-full px-4 py-4 text-left transition-colors hover:bg-bg-tertiary/60"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-text">
                          {message.content.status} result for {message.content.task_id}
                        </div>
                        <div className="mt-1 text-xs text-text-muted">
                          trace <span className="font-mono text-text">{shortId(traceId)}</span>
                        </div>
                      </div>
                      <div className="text-xs text-text-muted">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="px-4 py-6 text-sm text-text-muted">
                No recent `task_result` messages expose a trace ID yet.
              </div>
            )}
          </div>
        </Card>

        <div className="min-h-0">
          {!selectedTraceId ? (
            <Card className="h-full">
              <div className="flex h-full min-h-64 items-center justify-center text-sm text-text-muted">
                Select a trace to render its waterfall.
              </div>
            </Card>
          ) : traceQuery.isLoading ? (
            <Card className="h-full">
              <div className="flex h-full min-h-64 items-center justify-center gap-2 text-sm text-text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading trace {selectedTraceId}...
              </div>
            </Card>
          ) : traceQuery.error instanceof Error ? (
            <Card className="h-full">
              <div className="p-4 text-sm text-error">
                Failed to load trace {selectedTraceId}: {traceQuery.error.message}
              </div>
            </Card>
          ) : (
            <TraceWaterfall spans={traceQuery.data ?? []} />
          )}
        </div>
      </div>
    </div>
  );
}
