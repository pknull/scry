import { Cpu, ShieldCheck } from 'lucide-react';
import type { TaskRecord } from '../../api/tasks';

interface TaskOffersProps {
  task: TaskRecord;
}

function shortId(value: string): string {
  return value.slice(0, 18);
}

export function TaskOffers({ task }: TaskOffersProps) {
  if (task.offers.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-sm text-text-muted">
        No offers yet. Servitors that match the task capabilities will appear here.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {task.offers.map((offer) => (
        <div
          key={`${offer.content.servitor}-${offer.hash}`}
          className="flex flex-col gap-3 rounded-lg border border-border bg-bg p-4 lg:flex-row lg:items-start lg:justify-between"
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-text">
              <ShieldCheck className="h-4 w-4 text-accent" />
              <span className="font-mono">{shortId(offer.content.servitor)}</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {offer.content.capabilities.map((capability) => (
                <span
                  key={capability}
                  className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-1 text-xs text-accent"
                >
                  <Cpu className="h-3 w-3" />
                  {capability}
                </span>
              ))}
            </div>

            <div className="text-xs text-text-muted">
              Offer TTL: {offer.content.ttl_seconds}s
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
