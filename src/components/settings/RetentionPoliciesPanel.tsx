import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import {
  Database, Plus, Trash2, X, AlertCircle, Loader2, RefreshCw,
  Clock, Hash, HardDrive, Key, Settings
} from 'lucide-react';
import { getRetentionPolicies, createRetentionPolicy, deleteRetentionPolicy } from '../../api/retention';
import { Card, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Toggle } from '../ui/Toggle';
import { Input } from '../ui/Input';
import * as yaml from 'yaml';
import type { RetentionPolicy, CreateRetentionPolicyRequest } from '../../api/types';

interface RetentionConfig {
  retention_enabled: boolean;
  retention_interval_secs: number;
  tombstone_max_age_secs: number;
  rawYaml: string;
}

export function RetentionPoliciesPanel() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [config, setConfig] = useState<RetentionConfig>({
    retention_enabled: false,
    retention_interval_secs: 3600,
    tombstone_max_age_secs: 604800,
    rawYaml: '',
  });
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Load config on mount
  useEffect(() => {
    async function loadConfig() {
      try {
        const content = await invoke<string>('read_config');
        const parsed = yaml.parse(content) || {};
        setConfig({
          retention_enabled: parsed.retention_enabled ?? false,
          retention_interval_secs: parsed.retention_interval_secs ?? 3600,
          tombstone_max_age_secs: parsed.tombstone_max_age_secs ?? 604800,
          rawYaml: content,
        });
      } catch (err) {
        console.error('Failed to load config:', err);
      }
    }
    loadConfig();
  }, []);

  async function updateConfig<K extends keyof RetentionConfig>(key: K, value: RetentionConfig[K]) {
    if (key === 'rawYaml') return;
    setIsSavingConfig(true);
    try {
      const parsed = yaml.parse(config.rawYaml) || {};
      parsed[key] = value;
      const newYaml = yaml.stringify(parsed);
      await invoke('write_config', { content: newYaml });
      setConfig(prev => ({ ...prev, [key]: value, rawYaml: newYaml }));
    } catch (err) {
      console.error('Failed to save config:', err);
    } finally {
      setIsSavingConfig(false);
    }
  }

  const { data: policies, isLoading, refetch } = useQuery({
    queryKey: ['retention-policies'],
    queryFn: getRetentionPolicies,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRetentionPolicy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retention-policies'] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text">Retention Policies</h2>
          <p className="text-sm text-text-muted">
            Configure automatic cleanup rules for messages
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
            <Plus className="w-4 h-4 mr-1" />
            Add Policy
          </Button>
        </div>
      </div>

      {/* Global Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Global Settings
          </CardTitle>
        </CardHeader>
        <div className="px-4 pb-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-text">Enable Retention</div>
              <div className="text-sm text-text-muted">
                Automatically clean up old messages based on policies
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isSavingConfig && <Loader2 className="w-4 h-4 animate-spin text-text-muted" />}
              <Toggle
                checked={config.retention_enabled}
                onChange={(v) => updateConfig('retention_enabled', v)}
                disabled={isSavingConfig}
              />
            </div>
          </div>

          {config.retention_enabled && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-text">Cleanup Interval</div>
                  <div className="text-sm text-text-muted">
                    How often to run retention cleanup
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={Math.floor(config.retention_interval_secs / 60)}
                    onChange={(e) => updateConfig('retention_interval_secs', parseInt(e.target.value) * 60)}
                    className="w-20 text-center"
                    min={1}
                  />
                  <span className="text-sm text-text-muted">min</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-text">Tombstone Max Age</div>
                  <div className="text-sm text-text-muted">
                    How long to keep deletion markers
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={Math.floor(config.tombstone_max_age_secs / 86400)}
                    onChange={(e) => updateConfig('tombstone_max_age_secs', parseInt(e.target.value) * 86400)}
                    className="w-20 text-center"
                    min={1}
                  />
                  <span className="text-sm text-text-muted">days</span>
                </div>
              </div>

              <div className="text-xs text-text-muted bg-bg-tertiary p-2 rounded">
                Restart node to apply changes.
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Create form */}
      {showCreate && (
        <CreatePolicyForm
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            queryClient.invalidateQueries({ queryKey: ['retention-policies'] });
          }}
        />
      )}

      {/* Policy list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Policies ({policies?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <div className="divide-y divide-border">
          {policies?.map((policy) => (
            <PolicyRow
              key={policy.id}
              policy={policy}
              onDelete={() => {
                if (confirm('Delete this retention policy?')) {
                  deleteMutation.mutate(policy.id);
                }
              }}
            />
          ))}
          {(!policies || policies.length === 0) && (
            <div className="p-4 text-center text-text-muted">
              No retention policies configured
            </div>
          )}
        </div>
      </Card>

      {/* Info */}
      <div className="text-sm text-text-muted bg-bg-tertiary/50 p-3 rounded-md">
        <strong>How it works:</strong> When retention is enabled, policies are evaluated during each
        cleanup cycle. Messages matching a policy's scope are deleted when any criterion is exceeded.
      </div>
    </div>
  );
}

function PolicyRow({
  policy,
  onDelete,
}: {
  policy: RetentionPolicy;
  onDelete: () => void;
}) {
  const scopeLabel = getScopeLabel(policy.scope);

  return (
    <div className="flex items-center gap-3 p-3 hover:bg-bg-tertiary/50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-text">{scopeLabel}</span>
          {policy.max_age_secs && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuration(policy.max_age_secs)}
            </span>
          )}
          {policy.max_count && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 flex items-center gap-1">
              <Hash className="w-3 h-3" />
              {policy.max_count} msgs
            </span>
          )}
          {policy.max_bytes && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 flex items-center gap-1">
              <HardDrive className="w-3 h-3" />
              {formatBytes(policy.max_bytes)}
            </span>
          )}
          {policy.compact_key && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 flex items-center gap-1">
              <Key className="w-3 h-3" />
              {policy.compact_key}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={onDelete}
        className="p-1.5 hover:bg-error/20 rounded text-text-muted hover:text-error transition-colors"
        title="Delete policy"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function getScopeLabel(scope: RetentionPolicy['scope']): string {
  if (typeof scope === 'string') {
    return scope === 'global' ? 'Global' : scope;
  }
  if (scope.topic) return `Topic: ${scope.topic}`;
  if (scope.author) return `Author: ${scope.author}`;
  if (scope.content_type) return `Type: ${scope.content_type}`;
  return 'Unknown';
}

function formatDuration(secs: number): string {
  if (secs >= 86400) return `${Math.floor(secs / 86400)}d`;
  if (secs >= 3600) return `${Math.floor(secs / 3600)}h`;
  if (secs >= 60) return `${Math.floor(secs / 60)}m`;
  return `${secs}s`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)}GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)}MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${bytes}B`;
}

function CreatePolicyForm({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [scopeType, setScopeType] = useState<'global' | 'topic' | 'author' | 'content_type'>('global');
  const [scopeValue, setScopeValue] = useState('');
  const [maxAgeDays, setMaxAgeDays] = useState('');
  const [maxCount, setMaxCount] = useState('');
  const [maxBytesMB, setMaxBytesMB] = useState('');
  const [compactKey, setCompactKey] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createRetentionPolicy,
    onSuccess,
    onError: (err) => setError(err instanceof Error ? err.message : 'Failed to create'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Build scope
    let scope: CreateRetentionPolicyRequest['scope'];
    if (scopeType === 'global') {
      scope = 'global';
    } else {
      if (!scopeValue.trim()) {
        setError(`${scopeType} value is required`);
        return;
      }
      scope = { [scopeType]: scopeValue.trim() };
    }

    // Build request
    const request: CreateRetentionPolicyRequest = { scope };
    if (maxAgeDays) request.max_age_secs = parseInt(maxAgeDays) * 86400;
    if (maxCount) request.max_count = parseInt(maxCount);
    if (maxBytesMB) request.max_bytes = parseInt(maxBytesMB) * 1048576;
    if (compactKey.trim()) request.compact_key = compactKey.trim();

    // Require at least one criterion
    if (!request.max_age_secs && !request.max_count && !request.max_bytes && !request.compact_key) {
      setError('At least one retention criterion is required');
      return;
    }

    mutation.mutate(request);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Create Retention Policy</CardTitle>
          <button onClick={onClose} className="p-1 hover:bg-bg-tertiary rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit} className="p-4 pt-0 space-y-4">
        {/* Scope */}
        <div>
          <label className="block text-sm font-medium text-text mb-1">Scope</label>
          <div className="flex gap-2">
            <select
              value={scopeType}
              onChange={(e) => setScopeType(e.target.value as typeof scopeType)}
              className="px-3 py-2 rounded-md bg-bg-tertiary text-text border border-border focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="global">Global</option>
              <option value="topic">Topic</option>
              <option value="author">Author</option>
              <option value="content_type">Content Type</option>
            </select>
            {scopeType !== 'global' && (
              <input
                type="text"
                value={scopeValue}
                onChange={(e) => setScopeValue(e.target.value)}
                placeholder={scopeType === 'author' ? '@xxx.ed25519' : scopeType}
                className="flex-1 px-3 py-2 rounded-md bg-bg-tertiary text-text border border-border focus:outline-none focus:ring-2 focus:ring-accent font-mono"
              />
            )}
          </div>
        </div>

        {/* Criteria */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text mb-1">
              Max Age (days)
            </label>
            <input
              type="number"
              value={maxAgeDays}
              onChange={(e) => setMaxAgeDays(e.target.value)}
              min="1"
              placeholder="e.g., 30"
              className="w-full px-3 py-2 rounded-md bg-bg-tertiary text-text border border-border focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">
              Max Count
            </label>
            <input
              type="number"
              value={maxCount}
              onChange={(e) => setMaxCount(e.target.value)}
              min="1"
              placeholder="e.g., 1000"
              className="w-full px-3 py-2 rounded-md bg-bg-tertiary text-text border border-border focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">
              Max Size (MB)
            </label>
            <input
              type="number"
              value={maxBytesMB}
              onChange={(e) => setMaxBytesMB(e.target.value)}
              min="1"
              placeholder="e.g., 100"
              className="w-full px-3 py-2 rounded-md bg-bg-tertiary text-text border border-border focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">
              Compact Key (JSON path)
            </label>
            <input
              type="text"
              value={compactKey}
              onChange={(e) => setCompactKey(e.target.value)}
              placeholder="e.g., $.profile.id"
              className="w-full px-3 py-2 rounded-md bg-bg-tertiary text-text border border-border focus:outline-none focus:ring-2 focus:ring-accent font-mono"
            />
          </div>
        </div>

        <p className="text-xs text-text-muted">
          At least one criterion required. Messages matching the scope will be deleted when
          any criterion is exceeded.
        </p>

        {error && (
          <div className="flex items-center gap-2 text-error text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : (
              <Plus className="w-4 h-4 mr-1" />
            )}
            Create
          </Button>
        </div>
      </form>
    </Card>
  );
}
