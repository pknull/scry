import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Loader2, Wifi, RefreshCw,
  Eye, EyeOff, Cloud, Trash2, X, Info, Settings
} from 'lucide-react';
import { getPeers, addPeer, removePeer, getMesh } from '../../api/peers';
import { getAuthors } from '../../api/feed';
import { getStatus } from '../../api/status';
import { useAppStore } from '../../stores/appStore';
import { Card, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { clsx } from 'clsx';
import type { MeshPeer, Peer } from '../../api/types';

interface UnifiedIdentity {
  id: string;  // The public key
  name: string;
  color: string;
  isMe: boolean;
  isOnMesh: boolean;
  isDirect: boolean;  // Direct connection (last_seen_by === 'self')
  meshPeer?: MeshPeer;
  configuredPeer?: Peer;
  hasMessages: boolean;  // We have messages from this identity
}

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

function formatAge(secs: number): string {
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}

function getStatusInfo(status: MeshPeer['status']): { color: string; label: string } {
  switch (status) {
    case 'recent': return { color: 'text-success', label: 'Healthy' };
    case 'stale': return { color: 'text-warning', label: 'Stale' };
    case 'suspected': return { color: 'text-error', label: 'Suspected' };
    default: return { color: 'text-text-faint', label: 'Unknown' };
  }
}

export function UnifiedPeersPanel() {
  const queryClient = useQueryClient();
  const [newPeerAddress, setNewPeerAddress] = useState('');
  const [showAddPeer, setShowAddPeer] = useState(false);
  const { ignoredAuthors, ignoreAuthor, unignoreAuthor } = useAppStore();

  // Fetch all data
  const { data: status } = useQuery({
    queryKey: ['status'],
    queryFn: getStatus,
  });

  const { data: meshData, isLoading: meshLoading, refetch: refetchMesh } = useQuery({
    queryKey: ['mesh'],
    queryFn: getMesh,
    refetchInterval: 5000,
  });

  const { data: peers, refetch: refetchPeers } = useQuery({
    queryKey: ['peers'],
    queryFn: getPeers,
    refetchInterval: 10000,
  });

  const { data: authors } = useQuery({
    queryKey: ['authors'],
    queryFn: getAuthors,
    refetchInterval: 30000,
  });

  const addPeerMutation = useMutation({
    mutationFn: addPeer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['peers'] });
      queryClient.invalidateQueries({ queryKey: ['mesh'] });
      setNewPeerAddress('');
      setShowAddPeer(false);
    },
  });

  const removePeerMutation = useMutation({
    mutationFn: removePeer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['peers'] });
      queryClient.invalidateQueries({ queryKey: ['mesh'] });
    },
  });

  const myIdentity = status?.identity;
  const localNode = meshData?.local;

  // Build unified identity list
  const identities = useMemo(() => {
    const idMap = new Map<string, UnifiedIdentity>();

    // Always include local identity first
    if (myIdentity) {
      idMap.set(myIdentity, {
        id: myIdentity,
        name: getAuthorName(myIdentity),
        color: getAuthorColor(myIdentity),
        isMe: true,
        isOnMesh: true,  // We're always on our own mesh
        isDirect: false,
        hasMessages: false,
      });
    }

    // Add mesh peers (skip self - that's how others see us, not relevant)
    meshData?.peers?.forEach((meshPeer) => {
      const id = meshPeer.peer_id;
      if (id === myIdentity) {
        // Skip - this is how other peers see US, not useful to display
        return;
      }
      idMap.set(id, {
        id,
        name: getAuthorName(id),
        color: getAuthorColor(id),
        isMe: false,
        isOnMesh: true,
        isDirect: meshPeer.last_seen_by === 'self',
        meshPeer,
        hasMessages: false,
      });
    });

    // Add/update with configured peers
    peers?.forEach((peer) => {
      if (peer.public_id) {
        const existing = idMap.get(peer.public_id);
        if (existing) {
          existing.configuredPeer = peer;
        } else {
          idMap.set(peer.public_id, {
            id: peer.public_id,
            name: getAuthorName(peer.public_id),
            color: getAuthorColor(peer.public_id),
            isMe: peer.public_id === myIdentity,
            isOnMesh: false,
            isDirect: false,
            configuredPeer: peer,
            hasMessages: false,
          });
        }
      } else {
        // Configured peer without public_id (not yet connected)
        // Use address as temporary ID
        const tempId = `addr:${peer.address}`;
        if (!idMap.has(tempId)) {
          idMap.set(tempId, {
            id: tempId,
            name: peer.address.split(':')[0].slice(-4),  // Last 4 chars of host
            color: getAuthorColor(peer.address),
            isMe: false,
            isOnMesh: false,
            isDirect: false,
            configuredPeer: peer,
            hasMessages: false,
          });
        }
      }
    });

    // Add authors (message sources)
    authors?.forEach((author) => {
      const existing = idMap.get(author);
      if (existing) {
        existing.hasMessages = true;
      } else {
        idMap.set(author, {
          id: author,
          name: getAuthorName(author),
          color: getAuthorColor(author),
          isMe: author === myIdentity,
          isOnMesh: false,
          isDirect: false,
          hasMessages: true,
        });
      }
    });

    // Convert to array and sort
    const list = Array.from(idMap.values());
    list.sort((a, b) => {
      // Self first
      if (a.isMe) return -1;
      if (b.isMe) return 1;
      // Ignored last
      const aIgnored = ignoredAuthors.includes(a.id);
      const bIgnored = ignoredAuthors.includes(b.id);
      if (aIgnored && !bIgnored) return 1;
      if (!aIgnored && bIgnored) return -1;
      // Direct connections first
      if (a.isDirect && !b.isDirect) return -1;
      if (!a.isDirect && b.isDirect) return 1;
      // On mesh before replicated
      if (a.isOnMesh && !b.isOnMesh) return -1;
      if (!a.isOnMesh && b.isOnMesh) return 1;
      // Alphabetical
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [meshData, peers, authors, myIdentity, ignoredAuthors]);

  // Stats
  const stats = useMemo(() => ({
    direct: identities.filter(i => i.isDirect && !i.isMe).length,
    transitive: identities.filter(i => i.isOnMesh && !i.isDirect && !i.isMe).length,
    replicated: identities.filter(i => !i.isOnMesh && i.hasMessages && !i.isMe).length,
    ignored: ignoredAuthors.length,
  }), [identities, ignoredAuthors]);

  function handleAddPeer(e: React.FormEvent) {
    e.preventDefault();
    if (newPeerAddress.trim()) {
      addPeerMutation.mutate(newPeerAddress.trim());
    }
  }

  if (meshLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header with local node info */}
      {localNode && (
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-text-muted">This Node</div>
              <div className="font-mono text-sm text-text">{getAuthorName(localNode.identity)}</div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="text-center">
                <div className="text-lg font-semibold text-text">{localNode.peer_count}</div>
                <div className="text-xs text-text-muted">Peers</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-text">{localNode.message_count}</div>
                <div className="text-xs text-text-muted">Messages</div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => { refetchMesh(); refetchPeers(); }}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Add peer */}
      {showAddPeer ? (
        <Card>
          <form onSubmit={handleAddPeer} className="flex gap-2">
            <Input
              type="text"
              placeholder="hostname:port or IP:port"
              value={newPeerAddress}
              onChange={(e) => setNewPeerAddress(e.target.value)}
              className="flex-1"
              autoFocus
            />
            <Button type="submit" disabled={!newPeerAddress.trim() || addPeerMutation.isPending}>
              {addPeerMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span className="ml-2">Add</span>
            </Button>
            <Button variant="secondary" onClick={() => setShowAddPeer(false)}>
              <X className="w-4 h-4" />
            </Button>
          </form>
          {addPeerMutation.isError && (
            <p className="mt-2 text-sm text-error">
              {addPeerMutation.error instanceof Error ? addPeerMutation.error.message : 'Failed to add peer'}
            </p>
          )}
        </Card>
      ) : (
        <Button variant="secondary" onClick={() => setShowAddPeer(true)} className="w-full">
          <Plus className="w-4 h-4 mr-2" />
          Add Peer
        </Button>
      )}

      {/* Stats bar */}
      <div className="flex flex-wrap gap-3 text-xs text-text-muted">
        <span className="flex items-center gap-1">
          <Wifi className="w-3 h-3 text-success" /> {stats.direct} direct
        </span>
        <span className="flex items-center gap-1">
          <Wifi className="w-3 h-3 text-accent" /> {stats.transitive} transitive
        </span>
        <span className="flex items-center gap-1">
          <Cloud className="w-3 h-3" /> {stats.replicated} replicated
        </span>
        {stats.ignored > 0 && (
          <span className="flex items-center gap-1 text-warning">
            <EyeOff className="w-3 h-3" /> {stats.ignored} ignored
          </span>
        )}
      </div>

      {/* Identity list */}
      <Card>
        <CardHeader>
          <CardTitle>Known Identities</CardTitle>
        </CardHeader>
        <div className="space-y-1">
          {identities.map((identity) => {
            const isIgnored = ignoredAuthors.includes(identity.id);
            const statusInfo = identity.meshPeer ? getStatusInfo(identity.meshPeer.status) : null;

            return (
              <div
                key={identity.id}
                className={clsx(
                  'flex items-center gap-3 p-3 rounded-md',
                  isIgnored ? 'opacity-50 bg-bg-tertiary/30' : 'hover:bg-bg-tertiary/50'
                )}
              >
                {/* Avatar */}
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: identity.color }}
                >
                  {identity.name}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm" style={{ color: isIgnored ? undefined : identity.color }}>
                      {identity.name}
                    </span>

                    {/* Badges */}
                    {identity.isMe && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-accent/20 text-accent">You</span>
                    )}
                    {identity.configuredPeer && !identity.isMe && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 flex items-center gap-1">
                        <Settings className="w-3 h-3" /> Configured
                      </span>
                    )}
                    {identity.isDirect && !identity.isMe && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-success/20 text-success flex items-center gap-1">
                        <Wifi className="w-3 h-3" /> Direct
                      </span>
                    )}
                    {identity.isOnMesh && !identity.isDirect && !identity.isMe && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-accent/20 text-accent flex items-center gap-1">
                        <Wifi className="w-3 h-3" /> Transitive
                      </span>
                    )}
                    {!identity.isOnMesh && identity.hasMessages && !identity.isMe && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-bg-tertiary text-text-faint flex items-center gap-1">
                        <Cloud className="w-3 h-3" /> Replicated
                      </span>
                    )}
                    {statusInfo && statusInfo.label !== 'Healthy' && (
                      <span className={clsx('text-xs', statusInfo.color)}>({statusInfo.label})</span>
                    )}
                    {isIgnored && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-warning/20 text-warning">Ignored</span>
                    )}
                  </div>

                  {/* Details - hide for address-only entries */}
                  {!identity.id.startsWith('addr:') && (
                    <div className="text-xs text-text-faint font-mono truncate" title={identity.id}>
                      {identity.id}
                    </div>
                  )}

                  {/* Connection info */}
                  {identity.configuredPeer && (
                    <div className="text-xs mt-0.5 flex items-center gap-2">
                      <span className="font-mono text-text bg-bg-tertiary px-1.5 py-0.5 rounded">
                        {identity.configuredPeer.address}
                      </span>
                      {identity.configuredPeer.connected ? (
                        <span className="text-success flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                          Connected
                        </span>
                      ) : (
                        <span className="text-text-faint">Disconnected</span>
                      )}
                    </div>
                  )}
                  {identity.meshPeer && !identity.isDirect && (
                    <div className="text-xs text-text-muted mt-0.5">
                      via {getAuthorName(identity.meshPeer.last_seen_by)} · {formatAge(identity.meshPeer.observation_age_secs)} ago
                    </div>
                  )}
                  {identity.meshPeer && identity.isDirect && !identity.configuredPeer && (
                    <div className="text-xs text-text-muted mt-0.5">
                      Last sync: {formatAge(identity.meshPeer.observation_age_secs)} ago · seq {identity.meshPeer.last_seq}
                    </div>
                  )}
                  {identity.meshPeer && identity.isDirect && identity.configuredPeer && (
                    <div className="text-xs text-text-muted mt-0.5">
                      seq {identity.meshPeer.last_seq} · synced {formatAge(identity.meshPeer.observation_age_secs)} ago
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {identity.configuredPeer && (
                    <button
                      onClick={() => removePeerMutation.mutate(identity.configuredPeer!.address)}
                      disabled={removePeerMutation.isPending}
                      className="p-2 rounded-md text-text-muted hover:text-error hover:bg-error/10 transition-colors"
                      title="Remove peer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  {!identity.isMe && (
                    <button
                      onClick={() => isIgnored ? unignoreAuthor(identity.id) : ignoreAuthor(identity.id)}
                      className={clsx(
                        'p-2 rounded-md transition-colors',
                        isIgnored
                          ? 'text-warning hover:bg-warning/10'
                          : 'text-text-muted hover:bg-bg-tertiary hover:text-text'
                      )}
                      title={isIgnored ? 'Show messages' : 'Hide messages'}
                    >
                      {isIgnored ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Legend */}
      <div className="flex items-start gap-2 p-3 bg-bg-secondary rounded-lg text-xs text-text-muted">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div>
          <strong className="text-text">Direct</strong> = you connect to them.{' '}
          <strong className="text-text">Transitive</strong> = seen through another peer.{' '}
          <strong className="text-text">Replicated</strong> = messages only, no network visibility.
        </div>
      </div>
    </div>
  );
}
