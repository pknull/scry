import { useState } from 'react';
import { Plus, Trash2, Edit2, X, Check, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Toggle } from '../ui/Toggle';

export interface Hook {
  name?: string;
  on_message?: string;
  webhook_url?: string;
  timeout_secs?: number;
  max_retries?: number;
  retry_delay_secs?: number;
  idempotent?: boolean;
}

interface HooksEditorProps {
  hooks: Hook[];
  onChange: (hooks: Hook[]) => void;
}

interface HookFormProps {
  hook: Hook;
  onSave: (hook: Hook) => void;
  onCancel: () => void;
  isNew?: boolean;
}

function HookForm({ hook, onSave, onCancel, isNew }: HookFormProps) {
  const [form, setForm] = useState<Hook>({ ...hook });
  const [errors, setErrors] = useState<string[]>([]);

  const validate = (): boolean => {
    const errs: string[] = [];
    if (!form.on_message && !form.webhook_url) {
      errs.push('Must specify either a script path or webhook URL');
    }
    if (form.webhook_url && !form.webhook_url.startsWith('http://') && !form.webhook_url.startsWith('https://')) {
      errs.push('Webhook URL must start with http:// or https://');
    }
    setErrors(errs);
    return errs.length === 0;
  };

  const handleSave = () => {
    if (validate()) {
      onSave(form);
    }
  };

  return (
    <div className="p-4 rounded-lg border border-accent/50 bg-bg-secondary space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-text">{isNew ? 'Add Hook' : 'Edit Hook'}</h4>
        <button onClick={onCancel} className="text-text-muted hover:text-text">
          <X className="w-4 h-4" />
        </button>
      </div>

      {errors.length > 0 && (
        <div className="p-3 rounded bg-error/10 border border-error/30">
          {errors.map((err, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-error">
              <AlertCircle className="w-4 h-4" />
              {err}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-text mb-1">Name</label>
          <Input
            placeholder="my-hook (optional, for logging)"
            value={form.name ?? ''}
            onChange={(e) => setForm({ ...form, name: e.target.value || undefined })}
          />
          <p className="text-xs text-text-faint mt-1">A friendly name for this hook (shown in logs)</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-1">Script Path</label>
          <Input
            placeholder="/path/to/script.sh"
            value={form.on_message ?? ''}
            onChange={(e) => setForm({ ...form, on_message: e.target.value || undefined })}
          />
          <p className="text-xs text-text-faint mt-1">
            Executable to run when a message arrives. Message JSON is passed on stdin.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-1">Webhook URL</label>
          <Input
            placeholder="https://example.com/webhook"
            value={form.webhook_url ?? ''}
            onChange={(e) => setForm({ ...form, webhook_url: e.target.value || undefined })}
          />
          <p className="text-xs text-text-faint mt-1">
            HTTP endpoint to POST message JSON to. Can be used with or instead of script.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-text mb-1">Timeout</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={form.timeout_secs ?? 30}
                onChange={(e) => setForm({ ...form, timeout_secs: parseInt(e.target.value) || 30 })}
                className="w-20 text-center"
              />
              <span className="text-sm text-text-muted">sec</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">Max Retries</label>
            <Input
              type="number"
              value={form.max_retries ?? 0}
              onChange={(e) => setForm({ ...form, max_retries: parseInt(e.target.value) || 0 })}
              className="w-20 text-center"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">Retry Delay</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={form.retry_delay_secs ?? 5}
                onChange={(e) => setForm({ ...form, retry_delay_secs: parseInt(e.target.value) || 5 })}
                className="w-20 text-center"
              />
              <span className="text-sm text-text-muted">sec</span>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <Toggle
            checked={form.idempotent ?? false}
            onChange={(v) => setForm({ ...form, idempotent: v })}
            label="Idempotent"
          />
          <p className="text-xs text-text-faint mt-1 ml-14">
            Track execution state to skip duplicates on message replay or node restart.
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave}>
          <Check className="w-4 h-4 mr-1" />
          {isNew ? 'Add Hook' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

export function HooksEditor({ hooks, onChange }: HooksEditorProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = (hook: Hook) => {
    onChange([...hooks, hook]);
    setIsAdding(false);
  };

  const handleEdit = (index: number, hook: Hook) => {
    const newHooks = [...hooks];
    newHooks[index] = hook;
    onChange(newHooks);
    setEditingIndex(null);
  };

  const handleDelete = (index: number) => {
    onChange(hooks.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3 pt-4">
      {/* Info box */}
      <div className="p-3 rounded bg-bg-tertiary text-sm text-text-muted">
        <p>
          <strong className="text-text">Hooks</strong> run when new messages are received.
          You can run a local script, call a webhook, or both.
        </p>
        <p className="mt-2">
          Scripts receive message JSON on stdin. Webhooks receive a POST with JSON body.
          Exit code 0 or HTTP 2xx = success.
        </p>
      </div>

      {/* Existing hooks */}
      {hooks.map((hook, i) => (
        <div key={i}>
          {editingIndex === i ? (
            <HookForm
              hook={hook}
              onSave={(h) => handleEdit(i, h)}
              onCancel={() => setEditingIndex(null)}
            />
          ) : (
            <div className="p-3 rounded-md bg-bg-tertiary">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-text">{hook.name || `Hook ${i + 1}`}</div>
                  {hook.on_message && (
                    <div className="text-sm text-text-muted mt-1 font-mono truncate">
                      📜 {hook.on_message}
                    </div>
                  )}
                  {hook.webhook_url && (
                    <div className="text-sm text-text-muted mt-1 font-mono truncate">
                      🌐 {hook.webhook_url}
                    </div>
                  )}
                  <div className="flex gap-4 mt-2 text-xs text-text-faint">
                    <span>Timeout: {hook.timeout_secs ?? 30}s</span>
                    <span>Retries: {hook.max_retries ?? 0}</span>
                    {hook.idempotent && <span className="text-accent">Idempotent</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={() => setEditingIndex(i)}
                    className="p-1.5 rounded hover:bg-bg-secondary text-text-muted hover:text-text"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(i)}
                    className="p-1.5 rounded hover:bg-bg-secondary text-text-muted hover:text-error"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Add form */}
      {isAdding ? (
        <HookForm
          hook={{}}
          onSave={handleAdd}
          onCancel={() => setIsAdding(false)}
          isNew
        />
      ) : (
        <Button variant="secondary" onClick={() => setIsAdding(true)} className="w-full">
          <Plus className="w-4 h-4 mr-2" />
          Add Hook
        </Button>
      )}
    </div>
  );
}
