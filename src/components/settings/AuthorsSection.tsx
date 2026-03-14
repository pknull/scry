import { useQuery } from '@tanstack/react-query';
import { Loader2, EyeOff, Eye, Wifi, Cloud } from 'lucide-react';
import { getAuthors } from '../../api/feed';
import { getStatus } from '../../api/status';
import { getMesh, getPeers } from '../../api/peers';
import { useAppStore } from '../../stores/appStore';
import { clsx } from 'clsx';
import type { MeshPeer, Peer } from '../../api/types';

function getAuthorName(author: string): string {
  const match = author.match(/@([A-Za-z0-9+/]{4})/);
  return match ? match[1] : author.slice(1, 5);
}

function getAuthorColor(author: string): string {
  let hash = 0;
  for (let i = 0; i < author.length; i++) {
    hash = author.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 45%)`;
}

interface AuthorInfo {
  author: string;
  meshPeer?: MeshPeer;
  configuredPeer?: Peer;
  isOnMesh: boolean;
}

export function AuthorsSection() {
  const { ignoredAuthors, ignoreAuthor, unignoreAuthor } = useAppStore();

  const { data: authors, isLoading: authorsLoading } = useQuery({
    queryKey: ['authors'],
    queryFn: getAuthors,
    refetchInterval: 30000,
  });

  const { data: status } = useQuery({
    queryKey: ['status'],
    queryFn: getStatus,
  });

  const { data: meshData } = useQuery({
    queryKey: ['mesh'],
    queryFn: getMesh,
    refetchInterval: 10000,
  });

  const { data: peers } = useQuery({
    queryKey: ['peers'],
    queryFn: getPeers,
    refetchInterval: 10000,
  });

  const myIdentity = status?.identity;

  if (authorsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    );
  }

  // Build a map of mesh peers by their peer_id
  const meshPeerMap = new Map<string, MeshPeer>();
  meshData?.peers?.forEach((peer) => {
    meshPeerMap.set(peer.peer_id, peer);
  });

  // Build a map of configured peers by their public_key (if available)
  const configuredPeerMap = new Map<string, Peer>();
  peers?.forEach((peer) => {
    if (peer.public_id) {
      configuredPeerMap.set(peer.public_id, peer);
    }
  });

  // Enrich authors with mesh/peer info
  const authorInfos: AuthorInfo[] = (authors || []).map((author) => ({
    author,
    meshPeer: meshPeerMap.get(author),
    configuredPeer: configuredPeerMap.get(author),
    isOnMesh: meshPeerMap.has(author),
  }));

  // Sort: self first, then on-mesh, then replicated, then ignored last
  const sortedAuthors = authorInfos.sort((a, b) => {
    if (a.author === myIdentity) return -1;
    if (b.author === myIdentity) return 1;
    const aIgnored = ignoredAuthors.includes(a.author);
    const bIgnored = ignoredAuthors.includes(b.author);
    if (aIgnored && !bIgnored) return 1;
    if (!aIgnored && bIgnored) return -1;
    // On-mesh before replicated
    if (a.isOnMesh && !b.isOnMesh) return -1;
    if (!a.isOnMesh && b.isOnMesh) return 1;
    return a.author.localeCompare(b.author);
  });

  return (
    <div className="space-y-3">
      <div className="text-sm text-text-muted">
        Authors whose messages appear in your feed. Ignore authors to hide their messages.
      </div>

      {sortedAuthors.length === 0 ? (
        <div className="text-center py-4 text-text-muted">
          No authors found
        </div>
      ) : (
        <div className="space-y-1">
          {sortedAuthors.map((info) => {
            const { author, meshPeer, configuredPeer, isOnMesh } = info;
            const isMe = author === myIdentity;
            const isIgnored = ignoredAuthors.includes(author);
            const name = getAuthorName(author);
            const color = getAuthorColor(author);

            return (
              <div
                key={author}
                className={clsx(
                  'flex items-center gap-3 p-2 rounded-md',
                  isIgnored ? 'opacity-50 bg-bg-tertiary/50' : 'hover:bg-bg-tertiary/50'
                )}
              >
                {/* Avatar */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                  style={{ backgroundColor: color }}
                >
                  {name}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="font-medium text-sm"
                      style={{ color: isIgnored ? undefined : color }}
                    >
                      {name}
                    </span>
                    {isMe && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-accent/20 text-accent">
                        You
                      </span>
                    )}
                    {isOnMesh && !isMe && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-success/20 text-success flex items-center gap-1">
                        <Wifi className="w-3 h-3" />
                        On Mesh
                      </span>
                    )}
                    {!isOnMesh && !isMe && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-bg-tertiary text-text-faint flex items-center gap-1">
                        <Cloud className="w-3 h-3" />
                        Replicated
                      </span>
                    )}
                    {isIgnored && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-warning/20 text-warning">
                        Ignored
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-text-faint font-mono truncate" title={author}>
                    {author}
                  </div>
                  {/* Show mesh/peer details */}
                  {meshPeer && (
                    <div className="text-xs text-text-muted mt-0.5">
                      {meshPeer.last_seen_by === 'self' ? 'Direct connection' : `via ${getAuthorName(meshPeer.last_seen_by)}`}
                      {meshPeer.status !== 'recent' && (
                        <span className={clsx(
                          'ml-2',
                          meshPeer.status === 'stale' && 'text-warning',
                          meshPeer.status === 'suspected' && 'text-error',
                          meshPeer.status === 'unknown' && 'text-text-faint'
                        )}>
                          ({meshPeer.status})
                        </span>
                      )}
                    </div>
                  )}
                  {configuredPeer && (
                    <div className="text-xs text-accent font-mono mt-0.5">
                      {configuredPeer.address}
                    </div>
                  )}
                </div>

                {/* Actions */}
                {!isMe && (
                  <button
                    onClick={() => isIgnored ? unignoreAuthor(author) : ignoreAuthor(author)}
                    className={clsx(
                      'p-2 rounded-md transition-colors',
                      isIgnored
                        ? 'text-warning hover:bg-warning/10'
                        : 'text-text-muted hover:bg-bg-tertiary hover:text-text'
                    )}
                    title={isIgnored ? 'Show messages from this author' : 'Hide messages from this author'}
                  >
                    {isIgnored ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Stats */}
      <div className="pt-2 border-t border-border text-xs text-text-faint flex flex-wrap gap-3">
        <span>{sortedAuthors.filter(a => a.isOnMesh).length} on mesh</span>
        <span>{sortedAuthors.filter(a => !a.isOnMesh && a.author !== myIdentity).length} replicated</span>
        {ignoredAuthors.length > 0 && (
          <span className="text-warning">{ignoredAuthors.length} ignored</span>
        )}
      </div>
    </div>
  );
}
