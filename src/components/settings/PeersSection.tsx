import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, Loader2, AlertCircle, Wifi, WifiOff, RefreshCw,
  Info, Users, Globe, ArrowRight, UserCircle
} from 'lucide-react';
import { getPeers, addPeer, removePeer, getMesh } from '../../api/peers';
import { AuthorsSection } from './AuthorsSection';
import { Card, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ValidationMessage } from '../ui/ValidationMessage';
import { clsx } from 'clsx';
import type { MeshPeer } from '../../api/types';
import { validatePeerAddress } from './validation';

function formatAge(secs: number): string {
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function truncateId(id: string): string {
  // Remove the @...ed25519 wrapper if present
  const clean = id.replace(/^@/, '').replace(/\.ed25519$/, '');
  if (clean.length <= 16) return clean;
  return `${clean.slice(0, 8)}...${clean.slice(-6)}`;
}

function getStatusColor(status: MeshPeer['status']): string {
  switch (status) {
    case 'recent': return 'bg-success';
    case 'stale': return 'bg-warning';
    case 'suspected': return 'bg-error';
    default: return 'bg-text-faint';
  }
}

function getStatusLabel(status: MeshPeer['status']): string {
  switch (status) {
    case 'recent': return 'Healthy';
    case 'stale': return 'Stale';
    case 'suspected': return 'Suspected';
    default: return 'Unknown';
  }
}

function getStatusTextColor(status: MeshPeer['status']): string {
  switch (status) {
    case 'recent': return 'text-success';
    case 'stale': return 'text-warning';
    case 'suspected': return 'text-error';
    default: return 'text-text-faint';
  }
}

export function PeersPanel() {
  const queryClient = useQueryClient();
  const [newPeerAddress, setNewPeerAddress] = useState('');
  const [addPeerError, setAddPeerError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'mesh' | 'peers' | 'authors'>('mesh');
  const newPeerAddressError = validatePeerAddress(newPeerAddress);

  const {
    data: peers,
    isLoading: peersLoading,
    error: peersError,
    refetch: refetchPeers,
  } = useQuery({
    queryKey: ['peers'],
    queryFn: getPeers,
    refetchInterval: 10000,
  });

  const {
    data: meshData,
    isLoading: meshLoading,
    refetch: refetchMesh,
  } = useQuery({
    queryKey: ['mesh'],
    queryFn: getMesh,
    refetchInterval: 5000,
  });

  const addPeerMutation = useMutation({
    mutationFn: addPeer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['peers'] });
      setNewPeerAddress('');
    },
  });

  const removePeerMutation = useMutation({
    mutationFn: removePeer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['peers'] });
    },
  });

  const handleAddPeer = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (newPeerAddressError) {
      return;
    }
    setAddPeerError(null);
    addPeerMutation.mutate(newPeerAddress.trim(), {
      onError: (error) => {
        setAddPeerError(error instanceof Error ? error.message : 'Failed to add peer');
      },
    });
  };

  if (peersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  if (peersError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-12 h-12 text-error" />
        <p className="text-text-muted">Failed to load peers</p>
        <Button variant="secondary" onClick={() => refetchPeers()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const meshPeers = meshData?.peers ?? [];
  const localNode = meshData?.local;

  // Separate self-observed vs transitive observations
  const directObservations = meshPeers.filter(p => p.last_seen_by === 'self');
  const transitiveObservations = meshPeers.filter(p => p.last_seen_by !== 'self');

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Explanation Card */}
      <Card className="bg-bg-tertiary/50">
        <div className="p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
          <div className="text-sm text-text-muted space-y-2">
            <p>
              <strong className="text-text">Direct Peers</strong> are nodes you connect to for syncing.
              Add them manually or discover via LAN/mDNS.
            </p>
            <p>
              <strong className="text-text">Network Mesh</strong> shows all nodes across the network.
              Nodes you see directly are marked "self". Others are seen transitively through peers.
            </p>
          </div>
        </div>
      </Card>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setActiveTab('mesh')}
          className={clsx(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2',
            activeTab === 'mesh'
              ? 'border-accent text-accent'
              : 'border-transparent text-text-muted hover:text-text'
          )}
        >
          <Globe className="w-4 h-4" />
          Network Mesh
          {meshPeers && meshPeers.length > 0 && (
            <span className="text-xs bg-bg-tertiary px-1.5 py-0.5 rounded">{meshPeers.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('peers')}
          className={clsx(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2',
            activeTab === 'peers'
              ? 'border-accent text-accent'
              : 'border-transparent text-text-muted hover:text-text'
          )}
        >
          <Users className="w-4 h-4" />
          Configure Peers
          {peers && <span className="text-xs bg-bg-tertiary px-1.5 py-0.5 rounded">{peers.length}</span>}
        </button>
        <button
          onClick={() => setActiveTab('authors')}
          className={clsx(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2',
            activeTab === 'authors'
              ? 'border-accent text-accent'
              : 'border-transparent text-text-muted hover:text-text'
          )}
        >
          <UserCircle className="w-4 h-4" />
          Authors
        </button>
      </div>

      {activeTab === 'mesh' && (
        <div className="space-y-4">
          {/* Local Node */}
          {localNode && (
            <Card>
              <CardHeader>
                <CardTitle>This Node</CardTitle>
              </CardHeader>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="font-mono text-sm bg-bg-tertiary px-3 py-1.5 rounded">
                  {truncateId(localNode.identity)}
                </div>
                <div className="text-sm text-text-muted">
                  {localNode.message_count} messages
                </div>
                <div className="text-sm text-text-muted">
                  {localNode.peer_count} peers
                </div>
                <div className="text-sm text-text-muted">
                  v{localNode.version}
                </div>
              </div>
            </Card>
          )}

          {/* Direct Observations */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Direct Connections</CardTitle>
                  <p className="text-sm text-text-muted mt-1">Nodes this node sees directly</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => refetchMesh()}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>

            {meshLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 text-accent animate-spin" />
              </div>
            ) : directObservations.length === 0 ? (
              <div className="text-center py-6 text-text-muted">
                <p>No direct connections</p>
              </div>
            ) : (
              <div className="space-y-2">
                {directObservations.map((peer) => (
                  <div
                    key={peer.peer_id}
                    className="p-3 rounded-md bg-bg-tertiary flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className={clsx('w-3 h-3 rounded-full', getStatusColor(peer.status))} />
                      <div>
                        <div className="font-mono text-sm text-text">
                          {truncateId(peer.peer_id)}
                        </div>
                        <div className="text-xs text-text-muted">
                          seq {peer.last_seq} • gen {peer.generation}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={clsx('text-sm', getStatusTextColor(peer.status))}>
                        {getStatusLabel(peer.status)}
                      </div>
                      <div className="text-xs text-text-faint">
                        {formatAge(peer.observation_age_secs)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Transitive Observations */}
          {transitiveObservations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Seen Through Peers</CardTitle>
                <p className="text-sm text-text-muted mt-1">
                  Nodes visible transitively (you don't connect directly)
                </p>
              </CardHeader>
              <div className="space-y-2">
                {transitiveObservations.map((peer) => (
                  <div
                    key={peer.peer_id}
                    className="p-3 rounded-md bg-bg-tertiary"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={clsx('w-3 h-3 rounded-full', getStatusColor(peer.status))} />
                        <div>
                          <div className="font-mono text-sm text-text">
                            {truncateId(peer.peer_id)}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-text-muted mt-0.5">
                            <span>via</span>
                            <ArrowRight className="w-3 h-3" />
                            <span className="font-mono">{truncateId(peer.last_seen_by)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={clsx('text-sm', getStatusTextColor(peer.status))}>
                          {getStatusLabel(peer.status)}
                        </div>
                        <div className="text-xs text-text-faint">
                          {formatAge(peer.observation_age_secs)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Legend */}
          <div className="flex gap-4 text-xs text-text-muted p-3 bg-bg-secondary rounded-lg">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-success" />
              Healthy (recent sync)
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-warning" />
              Stale (delayed)
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-error" />
              Suspected (long delay)
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-text-faint" />
              Unknown
            </div>
          </div>
        </div>
      )}

      {activeTab === 'peers' && (
        <>
          {/* Add Peer */}
          <Card>
            <CardHeader>
              <CardTitle>Add Peer</CardTitle>
            </CardHeader>
            <form onSubmit={handleAddPeer} className="flex gap-2">
              <Input
                type="text"
                placeholder="hostname:port or IP:port"
                value={newPeerAddress}
                onChange={(e) => {
                  setNewPeerAddress(e.target.value);
                  setAddPeerError(null);
                }}
                className="flex-1"
                error={Boolean(newPeerAddressError)}
                aria-invalid={Boolean(newPeerAddressError)}
              />
              <Button
                type="submit"
                disabled={Boolean(newPeerAddressError) || addPeerMutation.isPending}
              >
                {addPeerMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                <span className="ml-2">Add</span>
              </Button>
            </form>
            <ValidationMessage message={newPeerAddressError} />
            {addPeerError && (
              <div className="mt-2 rounded-md border border-error/30 bg-error/10 p-3">
                <p className="text-sm text-error">{addPeerError}</p>
              </div>
            )}
            <p className="mt-3 text-xs text-text-faint">
              Add the gossip address (host:port) of another egregore node to sync with.
            </p>
          </Card>

          {/* Peer List */}
          <Card>
            <CardHeader>
              <CardTitle>Configured Peers</CardTitle>
            </CardHeader>
            {!peers?.length ? (
              <div className="text-center py-8 text-text-muted">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No peers configured</p>
                <p className="text-sm mt-1">Add a peer above or enable discovery in Settings</p>
              </div>
            ) : (
              <div className="space-y-2">
                {peers.map((peer) => (
                  <div
                    key={peer.address}
                    className="flex items-center justify-between p-3 rounded-md bg-bg-tertiary"
                  >
                    <div className="flex items-center gap-3">
                      <div className={clsx(
                        'w-8 h-8 rounded-full flex items-center justify-center',
                        peer.connected ? 'bg-success/20' : 'bg-bg-secondary'
                      )}>
                        {peer.connected ? (
                          <Wifi className="w-4 h-4 text-success" />
                        ) : (
                          <WifiOff className="w-4 h-4 text-text-faint" />
                        )}
                      </div>
                      <div>
                        <div className="font-mono text-sm text-text">{peer.address}</div>
                        {peer.public_id && (
                          <div className="text-xs text-text-faint font-mono">
                            {truncateId(peer.public_id)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={clsx(
                        'text-xs px-2 py-1 rounded',
                        peer.connected ? 'bg-success/20 text-success' : 'bg-bg-secondary text-text-faint'
                      )}>
                        {peer.connected ? 'Connected' : 'Disconnected'}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removePeerMutation.mutate(peer.address)}
                        disabled={removePeerMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4 text-error" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {activeTab === 'authors' && (
        <Card>
          <CardHeader>
            <CardTitle>Known Authors</CardTitle>
          </CardHeader>
          <AuthorsSection />
        </Card>
      )}
    </div>
  );
}
