// Phase 2 Wave 5 Step 26 — the BridgePanel renders only when the node
// is operating as a CompositeTransport (children.length >= 2).
// Otherwise the panel body explains the single-transport state and
// points operators at /v1/status.
//
// Amendment §C.14 expands scope beyond base plan: broker reachability,
// per-stream lag (via /v1/transport/pending), per-group consumer health
// (pointer to existing Groups panel), last-ack-per-author (via
// /v1/transport/bus/authors), and a chain-gap metric pointer (the
// actual metric lives in Prometheus — Step 27).

import { useQuery } from '@tanstack/react-query';
import { Loader2, RefreshCw, Info } from 'lucide-react';
import { getStatus, getTransportPending, getBusAuthors } from '../../api/status';
import { Card, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { TransportHealthRow } from './TransportHealthRow';
import { BridgeQueueRow } from './BridgeQueueRow';
import type {
  BusAuthorRowDto,
  PendingRowDto,
  TransportHealth,
} from '../../api/types';

// TanStack Query keys.
const STATUS_KEY = ['status'];
const PENDING_KEY = (tid: string) => ['transport', 'pending', tid];
const BUS_AUTHORS_KEY = ['transport', 'bus', 'authors'];

export function BridgePanel() {
  const {
    data: status,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: STATUS_KEY,
    queryFn: getStatus,
    refetchInterval: 10_000, // 10s
  });

  // Pending-forwarding count for the bus transport (if any).
  const { data: pending } = useQuery({
    queryKey: PENDING_KEY('bus'),
    queryFn: () => getTransportPending('bus'),
    refetchInterval: 10_000,
    // Only poll when the daemon reports at least one transport; the
    // endpoint is harmless but polling adds noise in single-transport
    // deployments.
    enabled: !!status?.transport,
  });

  // Per-author bus activity.
  const { data: busAuthors } = useQuery({
    queryKey: BUS_AUTHORS_KEY,
    queryFn: getBusAuthors,
    refetchInterval: 30_000, // 30s
    enabled: !!status?.transport,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  const children: TransportHealth[] = status?.transport?.children ?? [];
  const isComposite = children.length >= 2;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text">
            Bridge Transport
          </h2>
          <p className="text-sm text-text-muted">
            Composite transport health, queue depths, and per-author bus
            activity (RFC 0001 §12.3, RFC 0002 §8.4)
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {!status?.transport && (
        <Card padding="md" className="flex items-start gap-3">
          <Info className="w-5 h-5 text-text-muted flex-shrink-0 mt-0.5" />
          <div className="text-sm text-text-muted">
            No transport is attached on this daemon. The bridge panel
            activates only on composite nodes.
          </div>
        </Card>
      )}

      {status?.transport && !isComposite && (
        <Card padding="md" className="flex items-start gap-3">
          <Info className="w-5 h-5 text-text-muted flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="text-text mb-1">
              Single-transport deployment ({status.transport.backend}).
            </div>
            <div className="text-text-muted">
              BridgePanel surfaces composite-specific queue metrics only
              when two or more transports are attached.
            </div>
          </div>
        </Card>
      )}

      {/* Root composite health (single row). */}
      {isComposite && status?.transport && (
        <Card padding="md">
          <CardHeader>
            <CardTitle>Composite root</CardTitle>
          </CardHeader>
          <TransportHealthRow health={status.transport} />
        </Card>
      )}

      {/* Per-child rows + their bridge_queues (if any). */}
      {isComposite && (
        <Card padding="md">
          <CardHeader>
            <CardTitle>Children</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            {children.map((child, idx) => (
              <div
                key={`${child.backend}-${idx}`}
                className="space-y-2"
              >
                <TransportHealthRow health={child} />
                {child.bridge_queues && (
                  <BridgeQueueRow queues={child.bridge_queues} />
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Pending-forwarding (bus only). Displayed regardless of
          composite state so single-bus deployments can still monitor it. */}
      {status?.transport && pending && (
        <Card padding="md">
          <CardHeader>
            <CardTitle>Pending forwarding — {pending.transport_id}</CardTitle>
          </CardHeader>
          <div className="text-sm text-text-muted mb-2">
            {pending.count} message(s) pending bus publish
          </div>
          {pending.rows.length > 0 && (
            <ul className="text-xs font-mono text-text-muted space-y-1 max-h-48 overflow-auto">
              {pending.rows.slice(0, 20).map((r: PendingRowDto) => (
                <li
                  key={r.message_hash}
                  className="flex justify-between border-b border-border py-1"
                >
                  <span className="truncate">
                    {r.author}#{r.sequence}
                  </span>
                  <span className="text-text-muted">
                    attempts: {r.attempt_count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* Per-author bus activity. */}
      {status?.transport && busAuthors && (
        <Card padding="md">
          <CardHeader>
            <CardTitle>Bus authors</CardTitle>
          </CardHeader>
          {busAuthors.rows.length === 0 ? (
            <div className="text-sm text-text-muted">
              No authors indexed on the bus yet.
            </div>
          ) : (
            <ul className="text-xs font-mono text-text space-y-1 max-h-48 overflow-auto">
              {busAuthors.rows.map((r: BusAuthorRowDto) => (
                <li
                  key={r.author}
                  className="grid grid-cols-4 gap-2 py-1 border-b border-border"
                >
                  <span className="col-span-2 truncate" title={r.author}>
                    {r.author}
                  </span>
                  <span className="text-text-muted">
                    seq: {r.author_seq}
                  </span>
                  <span className="text-text-muted">
                    stream: {r.stream_seq}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
