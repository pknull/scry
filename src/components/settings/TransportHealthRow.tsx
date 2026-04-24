// Phase 2 Wave 5 Step 26 — one row per child in a CompositeTransport,
// rendering the leaf-level `TransportHealth`. Matches RFC 0001 §12.3
// per-transport surface: backend, connected dot, last-publish age,
// unreplicated count, last_error banner.

import { clsx } from 'clsx';
import { AlertTriangle, Circle } from 'lucide-react';
import type { TransportHealth } from '../../api/types';
import { Card } from '../ui/Card';

interface TransportHealthRowProps {
  health: TransportHealth;
}

// Green: connected + fresh peer contact (<60s). Amber: connected but
// peer contact is stale (60-300s) or unknown. Red: disconnected OR
// peer contact older than 300s.
function connectionColor(health: TransportHealth): 'green' | 'amber' | 'red' {
  if (!health.connected) return 'red';
  if (!health.last_peer_contact) return 'amber';
  const ageSecs =
    (Date.now() - new Date(health.last_peer_contact).getTime()) / 1000;
  if (ageSecs > 300) return 'red';
  if (ageSecs > 60) return 'amber';
  return 'green';
}

function ageOrDash(ts?: string): string {
  if (!ts) return '—';
  const ageSecs = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (ageSecs < 0) return 'just now';
  if (ageSecs < 60) return `${ageSecs}s ago`;
  if (ageSecs < 3600) return `${Math.floor(ageSecs / 60)}m ago`;
  if (ageSecs < 86400) return `${Math.floor(ageSecs / 3600)}h ago`;
  return `${Math.floor(ageSecs / 86400)}d ago`;
}

export function TransportHealthRow({ health }: TransportHealthRowProps) {
  const color = connectionColor(health);
  const dotClass = clsx('w-3 h-3 fill-current', {
    'text-green-500': color === 'green',
    'text-amber-500': color === 'amber',
    'text-red-500': color === 'red',
  });

  return (
    <Card padding="sm" className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Circle className={dotClass} />
          <span className="font-medium text-text capitalize">
            {health.backend}
          </span>
        </div>
        <div className="text-xs text-text-muted">
          last publish: {ageOrDash(health.last_successful_publish)}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs text-text-muted">
        <div>
          <div className="text-[0.65rem] uppercase tracking-wide">
            Unreplicated
          </div>
          <div
            className={clsx('font-mono text-sm', {
              'text-red-500': health.unreplicated_count > 0,
              'text-text': health.unreplicated_count === 0,
            })}
          >
            {health.unreplicated_count}
          </div>
        </div>
        <div>
          <div className="text-[0.65rem] uppercase tracking-wide">
            In-flight
          </div>
          <div className="font-mono text-sm text-text">
            {health.inflight_publishes}
          </div>
        </div>
        <div>
          <div className="text-[0.65rem] uppercase tracking-wide">
            Last contact
          </div>
          <div className="font-mono text-sm text-text">
            {ageOrDash(health.last_peer_contact)}
          </div>
        </div>
      </div>

      {health.last_error && (
        <div className="flex items-start gap-2 rounded bg-red-950/30 border border-red-800/50 p-2 text-xs text-red-300">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div className="font-mono break-all">{health.last_error}</div>
        </div>
      )}
    </Card>
  );
}
