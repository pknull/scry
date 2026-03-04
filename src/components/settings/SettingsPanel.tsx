import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Loader2, Save, AlertCircle, FileText, RotateCcw, ChevronDown, ChevronRight,
  Network, Clock, Shield, Webhook, Info, Server, CheckCircle, Trash2
} from 'lucide-react';
import { Card, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Toggle } from '../ui/Toggle';
import { clsx } from 'clsx';
import * as yaml from 'yaml';
import { HooksEditor } from './HooksEditor';
import { SystemdPanel } from './SystemdPanel';

interface EgregoreConfig {
  data_dir?: string;
  api_enabled?: boolean;
  mcp_enabled?: boolean;
  port?: number;
  gossip_port?: number;
  gossip_bind?: string;
  discovery_port?: number;
  network_key?: string;
  peers?: string[];
  lan_discovery?: boolean;
  mdns_discovery?: boolean;
  mdns_service?: string;
  gossip_interval_secs?: number;
  push_enabled?: boolean;
  max_persistent_connections?: number;
  reconnect_initial_secs?: number;
  reconnect_max_secs?: number;
  flow_control_enabled?: boolean;
  flow_initial_credits?: number;
  flow_rate_limit_per_second?: number;
  schema_strict?: boolean;
  retention_enabled?: boolean;
  retention_interval_secs?: number;
  tombstone_max_age_secs?: number;
  hooks?: Array<{
    name?: string;
    on_message?: string;
    webhook_url?: string;
    timeout_secs?: number;
    max_retries?: number;
    retry_delay_secs?: number;
    idempotent?: boolean;
  }>;
}

interface SettingRowProps {
  label: string;
  description: string;
  children: React.ReactNode;
  warning?: string;
}

function SettingRow({ label, description, children, warning }: SettingRowProps) {
  return (
    <div className="py-4 border-b border-border last:border-b-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-text">{label}</div>
          <div className="text-sm text-text-muted mt-0.5">{description}</div>
          {warning && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-warning">
              <AlertCircle className="w-3 h-3" />
              {warning}
            </div>
          )}
        </div>
        <div className="flex-shrink-0">{children}</div>
      </div>
    </div>
  );
}

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Section({ icon, title, description, children, defaultOpen = true }: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center gap-3 hover:bg-bg-tertiary/50 transition-colors"
      >
        <div className="text-accent">{icon}</div>
        <div className="flex-1 text-left">
          <div className="font-semibold text-text">{title}</div>
          <div className="text-sm text-text-muted">{description}</div>
        </div>
        {isOpen ? (
          <ChevronDown className="w-5 h-5 text-text-muted" />
        ) : (
          <ChevronRight className="w-5 h-5 text-text-muted" />
        )}
      </button>
      {isOpen && <div className="px-4 pb-4 border-t border-border">{children}</div>}
    </Card>
  );
}

export function SettingsPanel() {
  const [config, setConfig] = useState<EgregoreConfig>({});
  const [rawYaml, setRawYaml] = useState('');
  const [originalYaml, setOriginalYaml] = useState('');
  const [configPath, setConfigPath] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    setIsLoading(true);
    setError(null);
    try {
      const content = await invoke<string>('read_config');
      setRawYaml(content);
      setOriginalYaml(content);
      setConfig(yaml.parse(content) || {});
      const path = await invoke<string>('get_config_path_str');
      setConfigPath(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }

  function updateConfig<K extends keyof EgregoreConfig>(key: K, value: EgregoreConfig[K]) {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    setRawYaml(yaml.stringify(newConfig));
  }

  async function saveConfig() {
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);
    try {
      const content = showRaw ? rawYaml : yaml.stringify(config);
      await invoke('write_config', { content });
      setOriginalYaml(content);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  }

  const hasChanges = rawYaml !== originalYaml;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Config path */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-text-muted">
          <FileText className="w-4 h-4" />
          <span className="font-mono">{configPath}</span>
        </div>
        <button
          onClick={() => setShowRaw(!showRaw)}
          className="text-accent hover:text-accent-hover text-sm"
        >
          {showRaw ? 'Show GUI' : 'Show Raw YAML'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-error/10 border border-error/30 text-error">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {showRaw ? (
        <Card>
          <CardHeader>
            <CardTitle>Raw Configuration</CardTitle>
          </CardHeader>
          <textarea
            value={rawYaml}
            onChange={(e) => setRawYaml(e.target.value)}
            className={clsx(
              'w-full h-96 p-4 rounded-md font-mono text-sm',
              'bg-bg-tertiary text-text border border-border',
              'focus:outline-none focus:ring-2 focus:ring-accent',
              'resize-y'
            )}
            spellCheck={false}
          />
        </Card>
      ) : (
        <>
          {/* Network Settings */}
          <Section
            icon={<Network className="w-5 h-5" />}
            title="Network"
            description="Ports and network isolation"
          >
            <SettingRow
              label="HTTP API"
              description="Enable REST API server for local applications (port binding)."
            >
              <Toggle
                checked={config.api_enabled ?? true}
                onChange={(v) => updateConfig('api_enabled', v)}
              />
            </SettingRow>

            {(config.api_enabled ?? true) && (
              <>
                <SettingRow
                  label="HTTP API Port"
                  description="REST API for local applications. Only accessible from localhost for security."
                >
                  <Input
                    type="number"
                    value={config.port ?? 7654}
                    onChange={(e) => updateConfig('port', parseInt(e.target.value))}
                    className="w-24 text-center"
                  />
                </SettingRow>

                <SettingRow
                  label="MCP Endpoint"
                  description="Enable Model Context Protocol endpoint (/mcp) for AI agent integration."
                >
                  <Toggle
                    checked={config.mcp_enabled ?? true}
                    onChange={(v) => updateConfig('mcp_enabled', v)}
                  />
                </SettingRow>
              </>
            )}

            <SettingRow
              label="Gossip Port"
              description="TCP port for peer-to-peer replication."
            >
              <Input
                type="number"
                value={config.gossip_port ?? 7655}
                onChange={(e) => updateConfig('gossip_port', parseInt(e.target.value))}
                className="w-24 text-center"
              />
            </SettingRow>

            <SettingRow
              label="Gossip Bind Address"
              description="IP address for peer connections. Examples: 127.0.0.1 (local only), 0.0.0.0 (all interfaces), or a specific IP like your Tailscale address."
              warning={(config.gossip_bind ?? '127.0.0.1') === '127.0.0.1' ? 'Loopback only - external peers cannot connect' : undefined}
            >
              <Input
                type="text"
                value={config.gossip_bind ?? '127.0.0.1'}
                onChange={(e) => updateConfig('gossip_bind', e.target.value)}
                placeholder="0.0.0.0"
                className="w-40"
              />
            </SettingRow>

            <SettingRow
              label="Discovery Port"
              description="UDP port for LAN peer discovery broadcasts."
            >
              <Input
                type="number"
                value={config.discovery_port ?? 7656}
                onChange={(e) => updateConfig('discovery_port', parseInt(e.target.value))}
                className="w-24 text-center"
              />
            </SettingRow>

            <SettingRow
              label="Network Key"
              description="Nodes must share the same key to communicate. Different keys create isolated networks."
              warning={(config.network_key ?? 'CHANGE_ME') === 'CHANGE_ME' ? 'Required: Set a network key before starting the node' : undefined}
            >
              <Input
                type="text"
                value={config.network_key ?? 'CHANGE_ME'}
                onChange={(e) => updateConfig('network_key', e.target.value)}
                className="w-64"
                placeholder="my-network-name"
              />
            </SettingRow>
          </Section>

          {/* Discovery */}
          <Section
            icon={<Shield className="w-5 h-5" />}
            title="Peer Discovery"
            description="How to find other nodes on the network"
          >
            <SettingRow
              label="LAN Discovery"
              description="Broadcast UDP packets to find peers on your local network."
            >
              <Toggle
                checked={config.lan_discovery ?? false}
                onChange={(v) => updateConfig('lan_discovery', v)}
              />
            </SettingRow>

            <SettingRow
              label="mDNS Discovery"
              description="Use Bonjour/mDNS to discover peers. Works across tailnets and VPNs."
            >
              <Toggle
                checked={config.mdns_discovery ?? false}
                onChange={(v) => updateConfig('mdns_discovery', v)}
              />
            </SettingRow>

            {config.mdns_discovery && (
              <SettingRow
                label="mDNS Service Name"
                description="Service type to advertise/discover. Change to isolate from other egregore networks."
              >
                <Input
                  type="text"
                  value={config.mdns_service ?? '_egregore._tcp'}
                  onChange={(e) => updateConfig('mdns_service', e.target.value)}
                  className="w-48"
                />
              </SettingRow>
            )}
          </Section>

          {/* Schema Validation */}
          <Section
            icon={<CheckCircle className="w-5 h-5" />}
            title="Schema Validation"
            description="How to handle messages with unknown content types"
            defaultOpen={false}
          >
            <SettingRow
              label="Strict Mode"
              description="Reject messages with unknown content types or invalid schemas."
              warning={config.schema_strict ? 'Messages without registered schemas will be rejected' : undefined}
            >
              <Toggle
                checked={config.schema_strict ?? false}
                onChange={(v) => updateConfig('schema_strict', v)}
              />
            </SettingRow>
          </Section>

          {/* Data Retention */}
          <Section
            icon={<Trash2 className="w-5 h-5" />}
            title="Data Retention"
            description="Automatic cleanup of old messages"
            defaultOpen={false}
          >
            <SettingRow
              label="Enable Retention"
              description="Automatically delete messages based on retention policies."
            >
              <Toggle
                checked={config.retention_enabled ?? false}
                onChange={(v) => updateConfig('retention_enabled', v)}
              />
            </SettingRow>

            {config.retention_enabled && (
              <>
                <SettingRow
                  label="Cleanup Interval"
                  description="How often to run retention cleanup."
                >
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={Math.floor((config.retention_interval_secs ?? 3600) / 60)}
                      onChange={(e) => updateConfig('retention_interval_secs', parseInt(e.target.value) * 60)}
                      className="w-24 text-center"
                    />
                    <span className="text-sm text-text-muted">min</span>
                  </div>
                </SettingRow>

                <SettingRow
                  label="Tombstone Max Age"
                  description="How long to keep deletion markers for replication."
                >
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={Math.floor((config.tombstone_max_age_secs ?? 604800) / 86400)}
                      onChange={(e) => updateConfig('tombstone_max_age_secs', parseInt(e.target.value) * 86400)}
                      className="w-24 text-center"
                    />
                    <span className="text-sm text-text-muted">days</span>
                  </div>
                </SettingRow>
              </>
            )}
          </Section>

          {/* Gossip */}
          <Section
            icon={<Clock className="w-5 h-5" />}
            title="Gossip & Replication"
            description="How messages sync between nodes"
          >
            <SettingRow
              label="Gossip Interval"
              description="Seconds between sync cycles. Lower = faster sync, more bandwidth."
            >
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={config.gossip_interval_secs ?? 300}
                  onChange={(e) => updateConfig('gossip_interval_secs', parseInt(e.target.value))}
                  className="w-24 text-center"
                />
                <span className="text-sm text-text-muted">sec</span>
              </div>
            </SettingRow>

            <SettingRow
              label="Push Replication"
              description="Keep persistent connections open for real-time message delivery."
            >
              <Toggle
                checked={config.push_enabled ?? true}
                onChange={(v) => updateConfig('push_enabled', v)}
              />
            </SettingRow>

            <SettingRow
              label="Max Persistent Connections"
              description="Maximum simultaneous persistent connections for push replication."
            >
              <Input
                type="number"
                value={config.max_persistent_connections ?? 32}
                onChange={(e) => updateConfig('max_persistent_connections', parseInt(e.target.value))}
                className="w-24 text-center"
              />
            </SettingRow>

            <SettingRow
              label="Flow Control"
              description="Credit-based backpressure to prevent overwhelming slow peers."
            >
              <Toggle
                checked={config.flow_control_enabled ?? true}
                onChange={(v) => updateConfig('flow_control_enabled', v)}
              />
            </SettingRow>

            {config.flow_control_enabled && (
              <>
                <SettingRow
                  label="Initial Credits"
                  description="Credits granted to new connections. Higher = more messages before backpressure."
                >
                  <Input
                    type="number"
                    value={config.flow_initial_credits ?? 100}
                    onChange={(e) => updateConfig('flow_initial_credits', parseInt(e.target.value))}
                    className="w-24 text-center"
                  />
                </SettingRow>

                <SettingRow
                  label="Rate Limit"
                  description="Maximum messages per second per connection."
                >
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={config.flow_rate_limit_per_second ?? 50}
                      onChange={(e) => updateConfig('flow_rate_limit_per_second', parseInt(e.target.value))}
                      className="w-24 text-center"
                    />
                    <span className="text-sm text-text-muted">/sec</span>
                  </div>
                </SettingRow>
              </>
            )}

            <SettingRow
              label="Reconnect Initial Delay"
              description="Initial wait before reconnecting to a dropped peer."
            >
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={config.reconnect_initial_secs ?? 5}
                  onChange={(e) => updateConfig('reconnect_initial_secs', parseInt(e.target.value))}
                  className="w-24 text-center"
                />
                <span className="text-sm text-text-muted">sec</span>
              </div>
            </SettingRow>

            <SettingRow
              label="Reconnect Max Delay"
              description="Maximum wait between reconnection attempts (exponential backoff cap)."
            >
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={config.reconnect_max_secs ?? 300}
                  onChange={(e) => updateConfig('reconnect_max_secs', parseInt(e.target.value))}
                  className="w-24 text-center"
                />
                <span className="text-sm text-text-muted">sec</span>
              </div>
            </SettingRow>
          </Section>

          {/* Hooks */}
          <Section
            icon={<Webhook className="w-5 h-5" />}
            title="Hooks"
            description="Scripts or webhooks triggered on new messages"
            defaultOpen={false}
          >
            <HooksEditor
              hooks={config.hooks ?? []}
              onChange={(hooks) => updateConfig('hooks', hooks)}
            />
          </Section>

          {/* Systemd Service */}
          <Section
            icon={<Server className="w-5 h-5" />}
            title="Systemd Service"
            description="Run egregore as a background service"
            defaultOpen={false}
          >
            <SystemdPanel />
          </Section>

          {/* Info */}
          <Card className="bg-bg-tertiary/50">
            <div className="p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
              <div className="text-sm text-text-muted">
                <p><strong>Changes require a node restart.</strong></p>
                <p className="mt-1">
                  The data directory is: <code className="font-mono text-xs">{config.data_dir}</code>
                </p>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* Save actions */}
      <div className="flex items-center gap-4 pt-4 border-t border-border sticky bottom-0 bg-bg py-4">
        <Button onClick={saveConfig} disabled={!hasChanges || isSaving}>
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Changes
        </Button>

        <Button
          variant="secondary"
          onClick={() => {
            setRawYaml(originalYaml);
            setConfig(yaml.parse(originalYaml) || {});
          }}
          disabled={!hasChanges}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Discard
        </Button>

        {saveSuccess && (
          <span className="text-sm text-success">Saved! Restart node to apply.</span>
        )}
      </div>
    </div>
  );
}
