import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Loader2, Play, Square, RotateCcw, Power, PowerOff,
  Download, Trash2, CheckCircle, XCircle, AlertCircle,
  Server, FolderOpen, Info
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { clsx } from 'clsx';

interface SystemdState {
  installed: boolean;
  active: boolean;
  enabled: boolean;
  status: string;
}

export function SystemdPanel() {
  const [state, setState] = useState<SystemdState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Install form state
  const [showInstall, setShowInstall] = useState(false);
  const [binaryPath, setBinaryPath] = useState('');
  const [dataDir, setDataDir] = useState('');
  const [detectedBinary, setDetectedBinary] = useState<string | null>(null);

  useEffect(() => {
    loadState();
    detectBinary();
  }, []);

  async function detectBinary() {
    try {
      const path = await invoke<string | null>('find_egregore_binary');
      if (path) {
        setDetectedBinary(path);
        setBinaryPath(path);
      }
    } catch {
      // Binary not found, that's okay
    }
  }

  async function loadState() {
    setIsLoading(true);
    setError(null);
    try {
      const [installed, active, enabled, status] = await Promise.all([
        invoke<boolean>('systemd_is_installed'),
        invoke<boolean>('systemd_is_active').catch(() => false),
        invoke<boolean>('systemd_is_enabled').catch(() => false),
        invoke<string>('systemd_status').catch(() => 'Service not installed'),
      ]);
      setState({ installed, active, enabled, status });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }

  async function runAction(action: string, fn: () => Promise<string>) {
    setActionLoading(action);
    setError(null);
    setSuccess(null);
    try {
      const result = await fn();
      setSuccess(result);
      setTimeout(() => setSuccess(null), 3000);
      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleStart() {
    await runAction('start', () => invoke<string>('systemd_start'));
  }

  async function handleStop() {
    await runAction('stop', () => invoke<string>('systemd_stop'));
  }

  async function handleRestart() {
    await runAction('restart', () => invoke<string>('systemd_restart'));
  }

  async function handleEnable() {
    await runAction('enable', () => invoke<string>('systemd_enable'));
  }

  async function handleDisable() {
    await runAction('disable', () => invoke<string>('systemd_disable'));
  }

  async function handleInstall() {
    if (!binaryPath || !dataDir) {
      setError('Both binary path and data directory are required');
      return;
    }
    await runAction('install', () =>
      invoke<string>('systemd_install', { egregorePath: binaryPath, dataDir })
    );
    setShowInstall(false);
  }

  async function handleUninstall() {
    if (!confirm('Are you sure you want to uninstall the systemd service?')) {
      return;
    }
    await runAction('uninstall', () => invoke<string>('systemd_uninstall'));
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Info box */}
      <div className="p-3 rounded bg-bg-tertiary text-sm text-text-muted flex items-start gap-3">
        <Info className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
        <div>
          <p>
            <strong className="text-text">Systemd Service</strong> runs your egregore node
            as a background service, starting automatically on login.
          </p>
          <p className="mt-1">
            This creates a user-level systemd service (no root required).
          </p>
        </div>
      </div>

      {/* Status */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-error/10 border border-error/30 text-error">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-success/10 border border-success/30 text-success">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{success}</span>
        </div>
      )}

      {/* Service Status Card */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={clsx(
              'w-10 h-10 rounded-full flex items-center justify-center',
              state?.active ? 'bg-success/20' : state?.installed ? 'bg-warning/20' : 'bg-bg-tertiary'
            )}>
              <Server className={clsx(
                'w-5 h-5',
                state?.active ? 'text-success' : state?.installed ? 'text-warning' : 'text-text-muted'
              )} />
            </div>
            <div>
              <div className="font-medium text-text">
                {state?.installed ? 'egregore.service' : 'Service Not Installed'}
              </div>
              <div className="text-sm text-text-muted flex items-center gap-2">
                {state?.installed ? (
                  <>
                    <span className={clsx(
                      'inline-flex items-center gap-1',
                      state?.active ? 'text-success' : 'text-text-muted'
                    )}>
                      {state?.active ? (
                        <CheckCircle className="w-3 h-3" />
                      ) : (
                        <XCircle className="w-3 h-3" />
                      )}
                      {state?.active ? 'Running' : 'Stopped'}
                    </span>
                    <span className="text-text-faint">|</span>
                    <span className={state?.enabled ? 'text-accent' : 'text-text-muted'}>
                      {state?.enabled ? 'Enabled at boot' : 'Disabled'}
                    </span>
                  </>
                ) : (
                  'Install to run egregore as a background service'
                )}
              </div>
            </div>
          </div>

          {/* Quick actions */}
          {state?.installed && (
            <div className="flex items-center gap-2">
              {state.active ? (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleStop}
                    disabled={actionLoading !== null}
                  >
                    {actionLoading === 'stop' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleRestart}
                    disabled={actionLoading !== null}
                  >
                    {actionLoading === 'restart' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RotateCcw className="w-4 h-4" />
                    )}
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={handleStart}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === 'start' ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  Start
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Actions */}
      {state?.installed ? (
        <div className="flex flex-wrap gap-2">
          {state.enabled ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDisable}
              disabled={actionLoading !== null}
            >
              {actionLoading === 'disable' ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <PowerOff className="w-4 h-4 mr-2" />
              )}
              Disable Auto-Start
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleEnable}
              disabled={actionLoading !== null}
            >
              {actionLoading === 'enable' ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Power className="w-4 h-4 mr-2" />
              )}
              Enable Auto-Start
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={handleUninstall}
            disabled={actionLoading !== null}
            className="text-error hover:text-error"
          >
            {actionLoading === 'uninstall' ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Trash2 className="w-4 h-4 mr-2" />
            )}
            Uninstall Service
          </Button>
        </div>
      ) : showInstall ? (
        <Card className="p-4 space-y-4">
          <h4 className="font-medium text-text">Install Systemd Service</h4>

          <div>
            <label className="block text-sm font-medium text-text mb-1">
              Egregore Binary Path
            </label>
            <Input
              value={binaryPath}
              onChange={(e) => setBinaryPath(e.target.value)}
              placeholder="/usr/local/bin/egregore"
            />
            {detectedBinary && binaryPath !== detectedBinary && (
              <button
                onClick={() => setBinaryPath(detectedBinary)}
                className="text-xs text-accent hover:text-accent-hover mt-1"
              >
                Use detected: {detectedBinary}
              </button>
            )}
            <p className="text-xs text-text-faint mt-1">
              Path to the egregore executable
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">
              Data Directory
            </label>
            <div className="flex gap-2">
              <Input
                value={dataDir}
                onChange={(e) => setDataDir(e.target.value)}
                placeholder="~/egregore-data"
                className="flex-1"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDataDir('~/egregore-data')}
              >
                <FolderOpen className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-text-faint mt-1">
              Where egregore stores its database and config
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleInstall}
              disabled={actionLoading !== null || !binaryPath || !dataDir}
            >
              {actionLoading === 'install' ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Install Service
            </Button>
            <Button variant="secondary" onClick={() => setShowInstall(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : (
        <Button onClick={() => setShowInstall(true)}>
          <Download className="w-4 h-4 mr-2" />
          Install Systemd Service
        </Button>
      )}

      {/* Status output */}
      {state?.installed && state.status && (
        <details className="group">
          <summary className="cursor-pointer text-sm text-text-muted hover:text-text">
            Show service status details
          </summary>
          <pre className="mt-2 p-3 rounded bg-bg-tertiary text-xs font-mono text-text-muted overflow-x-auto whitespace-pre-wrap">
            {state.status}
          </pre>
        </details>
      )}
    </div>
  );
}
