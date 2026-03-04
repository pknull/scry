import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Send, Upload, X, ChevronDown, ChevronRight, AlertCircle,
  CheckCircle, FileJson, Loader2
} from 'lucide-react';
import { publishMessage } from '../../api/feed';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { clsx } from 'clsx';

interface MessageContent {
  type: string;
  text?: string;
  title?: string;
  [key: string]: unknown;
}

interface FormState {
  type: string;
  text: string;
  topic: string;
  title: string;
  references: string[];
}

interface MessageComposerProps {
  replyTo?: string;
  onClose?: () => void;
}

export function MessageComposer({ replyTo, onClose }: MessageComposerProps) {
  const [mode, setMode] = useState<'form' | 'json'>('form');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successHash, setSuccessHash] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Form mode state
  const [formData, setFormData] = useState<FormState>({
    type: 'message',
    text: '',
    topic: '',
    title: '',
    references: replyTo ? [replyTo] : [],
  });

  // JSON mode state
  const [jsonText, setJsonText] = useState('');
  const [jsonValid, setJsonValid] = useState<boolean | null>(null);

  const mutation = useMutation({
    mutationFn: publishMessage,
    onSuccess: (data) => {
      console.log('[Publish] Success:', data);
      setSuccessHash(data.hash);
      setTimeout(() => setSuccessHash(null), 5000);
      // Reset form
      setFormData({
        type: 'message',
        text: '',
        topic: '',
        title: '',
        references: replyTo ? [replyTo] : [],
      });
      setJsonText('');
      setJsonValid(null);
      // Refresh feed immediately
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
    onError: (err) => {
      console.error('[Publish] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to publish message');
    },
  });

  function validateJson(text: string): MessageContent | null {
    try {
      const parsed = JSON.parse(text);
      if (!parsed.type) {
        setJsonValid(false);
        return null;
      }
      setJsonValid(true);
      return parsed;
    } catch {
      setJsonValid(false);
      return null;
    }
  }

  function handleJsonChange(text: string) {
    setJsonText(text);
    if (text.trim()) {
      validateJson(text);
    } else {
      setJsonValid(null);
    }
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setJsonText(text);
      validateJson(text);
      setMode('json');
    };
    reader.readAsText(file);

    // Reset input so same file can be selected again
    event.target.value = '';
  }

  function handleSubmit() {
    setError(null);

    if (mode === 'json') {
      const parsed = validateJson(jsonText);
      if (!parsed) {
        setError('Invalid JSON: must be an object with at least a "type" field');
        return;
      }
      // For JSON mode, extract topic/references from content if present
      const { topic, references, ...content } = parsed;
      mutation.mutate({
        content,
        topic: typeof topic === 'string' ? topic : undefined,
        references: Array.isArray(references) ? references : undefined,
      });
    } else {
      if (!formData.text.trim()) {
        setError('Message text is required');
        return;
      }
      // Build content without topic/references (those go at top level)
      const content: MessageContent = {
        type: formData.type || 'message',
        text: formData.text.trim(),
      };
      if (formData.title.trim()) content.title = formData.title.trim();

      mutation.mutate({
        content,
        topic: formData.topic.trim() || undefined,
        references: formData.references.length ? formData.references : undefined,
      });
    }
  }

  return (
    <div className="rounded-lg border border-border bg-bg-secondary p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-text">
            {replyTo ? 'Reply' : 'New Message'}
          </h3>
          {replyTo && (
            <span className="text-xs text-text-faint font-mono">
              re: {replyTo.slice(0, 8)}...
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Mode toggle */}
          <div className="flex rounded-md border border-border overflow-hidden text-sm">
            <button
              onClick={() => setMode('form')}
              className={clsx(
                'px-3 py-1 transition-colors',
                mode === 'form'
                  ? 'bg-accent text-white'
                  : 'bg-bg-tertiary text-text-muted hover:text-text'
              )}
            >
              Form
            </button>
            <button
              onClick={() => setMode('json')}
              className={clsx(
                'px-3 py-1 transition-colors',
                mode === 'json'
                  ? 'bg-accent text-white'
                  : 'bg-bg-tertiary text-text-muted hover:text-text'
              )}
            >
              JSON
            </button>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-text-muted hover:text-text"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-2 rounded bg-error/10 border border-error/30 text-error text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Success */}
      {successHash && (
        <div className="flex items-center gap-2 p-2 rounded bg-success/10 border border-success/30 text-success text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>
            Published! Hash: <code className="font-mono text-xs">{successHash.slice(0, 12)}...</code>
          </span>
        </div>
      )}

      {mode === 'form' ? (
        /* Form mode */
        <div className="space-y-3">
          {/* Message text */}
          <div>
            <textarea
              value={formData.text}
              onChange={(e) => setFormData({ ...formData, text: e.target.value })}
              placeholder="Write your message..."
              className={clsx(
                'w-full h-24 p-3 rounded-md font-sans text-sm',
                'bg-bg-tertiary text-text border border-border',
                'focus:outline-none focus:ring-2 focus:ring-accent',
                'resize-y placeholder:text-text-faint'
              )}
            />
          </div>

          {/* Advanced options toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-sm text-text-muted hover:text-text"
          >
            {showAdvanced ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            Advanced options
          </button>

          {showAdvanced && (
            <div className="space-y-3 pl-4 border-l-2 border-border">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className={clsx(
                      'w-full px-3 py-2 rounded-md text-sm',
                      'bg-bg-tertiary text-text border border-border',
                      'focus:outline-none focus:ring-2 focus:ring-accent'
                    )}
                  >
                    <option value="message">Message</option>
                    <option value="insight">Insight</option>
                    <option value="query">Query</option>
                    <option value="response">Response</option>
                    <option value="endorsement">Endorsement</option>
                    <option value="dispute">Dispute</option>
                    <option value="profile">Profile</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Topic</label>
                  <Input
                    value={formData.topic}
                    onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                    placeholder="e.g., programming"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-text-muted mb-1">Title (optional)</label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Optional title for your message"
                />
              </div>

              <div>
                <label className="block text-xs text-text-muted mb-1">References (message hashes)</label>
                <Input
                  value={formData.references.join(', ')}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      references: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="hash1, hash2, ..."
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        /* JSON mode */
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".json,application/json"
              className="hidden"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload JSON
            </Button>
            {jsonValid !== null && (
              <span className={clsx(
                'text-sm flex items-center gap-1',
                jsonValid ? 'text-success' : 'text-error'
              )}>
                {jsonValid ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Valid JSON
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4" />
                    Invalid JSON
                  </>
                )}
              </span>
            )}
          </div>

          <div className="relative">
            <FileJson className="absolute left-3 top-3 w-4 h-4 text-text-faint" />
            <textarea
              value={jsonText}
              onChange={(e) => handleJsonChange(e.target.value)}
              placeholder='{"type": "insight", "text": "Your message...", "topic": "optional"}'
              className={clsx(
                'w-full h-48 p-3 pl-9 rounded-md font-mono text-sm',
                'bg-bg-tertiary text-text border',
                jsonValid === false ? 'border-error' : 'border-border',
                'focus:outline-none focus:ring-2 focus:ring-accent',
                'resize-y placeholder:text-text-faint'
              )}
              spellCheck={false}
            />
          </div>

          <div className="text-xs text-text-faint">
            Required: <code className="bg-bg-tertiary px-1 rounded">type</code>.
            Optional: <code className="bg-bg-tertiary px-1 rounded">text</code>,{' '}
            <code className="bg-bg-tertiary px-1 rounded">topic</code>,{' '}
            <code className="bg-bg-tertiary px-1 rounded">title</code>,{' '}
            <code className="bg-bg-tertiary px-1 rounded">references</code>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
        {onClose && (
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={mutation.isPending || (mode === 'json' && !jsonValid)}
        >
          {mutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Send className="w-4 h-4 mr-2" />
          )}
          Publish
        </Button>
      </div>
    </div>
  );
}
