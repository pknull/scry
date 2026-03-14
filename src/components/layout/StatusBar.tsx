import { useQuery } from '@tanstack/react-query';
import { Circle, Users, Database, Clock } from 'lucide-react';
import { getStatus } from '../../api/status';
import { clsx } from 'clsx';

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function truncateKey(key: string): string {
  if (key.length <= 16) return key;
  return `${key.slice(0, 8)}...${key.slice(-8)}`;
}

export function StatusBar() {
  const { data: status, isLoading, isError, error } = useQuery({
    queryKey: ['status'],
    queryFn: getStatus,
    refetchInterval: 5000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <footer className="h-8 bg-bg-secondary border-t border-border px-4 flex items-center gap-4 text-xs text-text-muted">
        <span>Connecting...</span>
      </footer>
    );
  }

  if (isError) {
    const errorMsg = error instanceof Error
      ? `${error.name}: ${error.message}`
      : String(error);
    console.error('[StatusBar] Connection error:', error);
    return (
      <footer className="h-8 bg-bg-secondary border-t border-border px-4 flex items-center gap-4 text-xs">
        <Circle className="w-3 h-3 fill-error text-error" />
        <span className="text-error truncate max-w-full" title={errorMsg}>
          Disconnected: {errorMsg}
        </span>
      </footer>
    );
  }

  return (
    <footer className="h-8 bg-bg-secondary border-t border-border px-4 flex items-center gap-6 text-xs text-text-muted">
      <div className="flex items-center gap-1.5">
        <Circle className={clsx('w-3 h-3', 'fill-success text-success')} />
        <span className="text-text">Connected</span>
      </div>

      <div className="flex items-center gap-1.5" title={status?.identity}>
        <span className="font-mono">{truncateKey(status?.identity ?? '')}</span>
      </div>

      <div className="flex items-center gap-1.5">
        <Users className="w-3 h-3" />
        <span>{status?.peer_count ?? 0} peers</span>
      </div>

      <div className="flex items-center gap-1.5">
        <Database className="w-3 h-3" />
        <span>{status?.message_count ?? 0} messages</span>
      </div>

      <div className="flex items-center gap-1.5">
        <Clock className="w-3 h-3" />
        <span>{formatUptime(status?.uptime_secs ?? 0)}</span>
      </div>

      <div className="ml-auto text-text-faint">
        v{status?.version ?? '?'}
      </div>
    </footer>
  );
}
