// Phase 2 Wave 5 Step 26 — per-direction queue metrics for a
// CompositeTransport's child-as-destination (RFC 0002 §8.4).

import { clsx } from 'clsx';
import { AlertTriangle } from 'lucide-react';
import type { BridgeQueuesHealth } from '../../api/types';
import { Card } from '../ui/Card';

interface BridgeQueueRowProps {
  queues: BridgeQueuesHealth;
}

// Amber > 60s, red > 300s for queue-age and publish-in-flight-age
// (aligned with operator-visible thresholds in RFC 0002 §8.4).
function ageColor(
  ageSecs: number | undefined,
  amberAtSecs: number,
  redAtSecs: number,
): string {
  if (ageSecs === undefined) return 'text-text-muted';
  if (ageSecs > redAtSecs) return 'text-red-500';
  if (ageSecs > amberAtSecs) return 'text-amber-500';
  return 'text-text';
}

function renderAgeSecs(ageSecs?: number): string {
  if (ageSecs === undefined) return '—';
  if (ageSecs < 60) return `${ageSecs}s`;
  if (ageSecs < 3600) return `${Math.floor(ageSecs / 60)}m`;
  return `${Math.floor(ageSecs / 3600)}h`;
}

export function BridgeQueueRow({ queues }: BridgeQueueRowProps) {
  const backpressured = queues.authors_backpressured > 0;

  return (
    <Card padding="sm" className="space-y-2 border-l-2 border-l-blue-500">
      <div className="flex items-center justify-between">
        <div className="text-xs text-text-muted uppercase tracking-wide">
          Queues → {queues.destination}
        </div>
        <div className="font-mono text-sm text-text">
          depth: {queues.depth_total}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-[0.65rem] uppercase tracking-wide text-text-muted">
            Authors active
          </div>
          <div className="font-mono text-sm text-text">
            {queues.authors_active}
          </div>
        </div>
        <div>
          <div className="text-[0.65rem] uppercase tracking-wide text-text-muted">
            Backpressured
          </div>
          <div
            className={clsx('font-mono text-sm', {
              'text-red-500': backpressured,
              'text-text': !backpressured,
            })}
          >
            {queues.authors_backpressured}
          </div>
        </div>
        <div>
          <div className="text-[0.65rem] uppercase tracking-wide text-text-muted">
            Oldest queued
          </div>
          <div
            className={clsx(
              'font-mono text-sm',
              ageColor(queues.oldest_queued_age_secs, 60, 300),
            )}
          >
            {renderAgeSecs(queues.oldest_queued_age_secs)}
          </div>
        </div>
        <div>
          <div className="text-[0.65rem] uppercase tracking-wide text-text-muted">
            Publish in-flight
          </div>
          <div
            className={clsx(
              'font-mono text-sm',
              ageColor(queues.publish_in_flight_age_secs, 10, 30),
            )}
          >
            {renderAgeSecs(queues.publish_in_flight_age_secs)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t border-border">
        <div>
          <div className="text-[0.65rem] uppercase tracking-wide text-text-muted">
            Ack-on-error
          </div>
          <div className="font-mono text-sm text-text">
            {queues.ack_on_error_total}
          </div>
        </div>
        <div>
          <div className="text-[0.65rem] uppercase tracking-wide text-text-muted">
            NATS redelivery
          </div>
          <div className="font-mono text-sm text-text">
            {queues.nats_redelivery_total}
          </div>
        </div>
        <div>
          <div className="text-[0.65rem] uppercase tracking-wide text-text-muted">
            Self-echo
          </div>
          <div className="font-mono text-sm text-text">
            {queues.self_echo_total}
          </div>
        </div>
      </div>

      {queues.last_error && (
        <div className="flex items-start gap-2 rounded bg-red-950/30 border border-red-800/50 p-2 text-xs text-red-300">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div className="font-mono break-all">{queues.last_error}</div>
        </div>
      )}
    </Card>
  );
}
