import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw, AlertCircle, Send, Upload, X, FileJson, Type, Paperclip, Image as ImageIcon } from 'lucide-react';
import { getFeed, searchInsights, publishMessage } from '../../api/feed';
import { getStatus } from '../../api/status';
import { ChatMessage } from './ChatMessage';
import { SchemaForm } from './SchemaForm';
import { useAppStore } from '../../stores/appStore';
import { useParsedSchemas } from '../../hooks/useSchemas';
import { Button } from '../ui/Button';
import { clsx } from 'clsx';

interface ChatFeedProps {
  searchQuery: string;
}

export function ChatFeed({ searchQuery }: ChatFeedProps) {
  const [messageType, setMessageType] = useState('message');
  const [messageTopic, setMessageTopic] = useState('');
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [showJsonMode, setShowJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<{
    name: string;
    type: string;
    size: number;
    data: string;  // base64
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Fetch schemas dynamically
  const { schemas, isLoading: schemasLoading } = useParsedSchemas();
  const currentSchema = schemas.find((s) => s.contentType === messageType);

  // Reset form values when message type changes
  useEffect(() => {
    setFormValues({});
  }, [messageType]);

  const MAX_ATTACHMENT_SIZE = 48 * 1024; // 48KB limit (egregore has ~64KB message limit)

  const isSearching = searchQuery.trim().length > 0;

  // Get local identity to highlight own messages
  const { data: status } = useQuery({
    queryKey: ['status'],
    queryFn: getStatus,
  });

  const {
    data: messages,
    isLoading,
    error: loadError,
    refetch,
  } = useQuery({
    queryKey: isSearching ? ['search', searchQuery] : ['feed'],
    queryFn: () => isSearching
      ? searchInsights({ q: searchQuery, limit: 100 })
      : getFeed({ limit: 100 }),
    refetchInterval: 5000,
  });

  const { ignoredAuthors, setView, setSelectedTraceId } = useAppStore();

  // Filter out ignored authors and sort by timestamp (oldest first for chat view)
  const sortedMessages = [...(messages || [])]
    .filter((m) => !ignoredAuthors.includes(m.author))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sortedMessages.length]);

  async function handleSend() {
    if (showJsonMode) {
      try {
        const parsed = JSON.parse(jsonText);
        if (!parsed.type) {
          setError('JSON must have a "type" field');
          return;
        }
        // Extract topic/references to top level
        const { topic, references, ...content } = parsed;
        await sendMessage({
          content,
          topic: typeof topic === 'string' ? topic : undefined,
          references: Array.isArray(references) ? references : undefined,
        });
        setJsonText('');
      } catch {
        setError('Invalid JSON');
        return;
      }
    } else {
      // Validate required fields from schema
      if (currentSchema) {
        const requiredFields = currentSchema.fields.filter((f) => f.required);
        for (const field of requiredFields) {
          const value = formValues[field.name];
          if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
            setError(`${field.label} is required`);
            return;
          }
        }
      } else {
        // Fallback for unknown types: require some content
        const hasContent = Object.values(formValues).some(
          (v) => v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)
        );
        if (!hasContent) {
          setError('Message content is required');
          return;
        }
      }

      // Build content from form values
      const content: Record<string, unknown> = { type: messageType, ...formValues };

      // Include attachment if present
      if (attachment) {
        content.attachment = {
          name: attachment.name,
          type: attachment.type,
          size: attachment.size,
          data: attachment.data,
        };
      }

      // topic and references go at top level, not in content
      await sendMessage({
        content: content as Parameters<typeof publishMessage>[0]['content'],
        topic: messageTopic.trim() || undefined,
        references: replyTo ? [replyTo] : undefined,
      });

      // Reset all fields
      setFormValues({});
      setMessageTopic('');
      setReplyTo(null);
      setAttachment(null);
    }
  }

  async function sendMessage(params: Parameters<typeof publishMessage>[0]) {
    setIsSending(true);
    setError(null);
    try {
      await publishMessage(params);
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setIsSending(false);
    }
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setJsonText(e.target?.result as string);
      setShowJsonMode(true);
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  function handleAttachmentUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_ATTACHMENT_SIZE) {
      setError(`File too large (${Math.round(file.size / 1024)}KB). Max is ${MAX_ATTACHMENT_SIZE / 1024}KB for gossip networks.`);
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      const bytes = new Uint8Array(arrayBuffer);

      // Convert to base64 using btoa (readAsDataURL had encoding issues)
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      setAttachment({
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        data: base64,
      });
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertCircle className="w-12 h-12 text-error" />
        <p className="text-text-muted">
          {loadError instanceof Error ? loadError.message : 'Failed to load messages'}
        </p>
        <Button variant="secondary" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {isSearching && (
          <div className="px-4 py-2 text-sm text-text-muted border-b border-border bg-bg-secondary">
            Found {sortedMessages.length} results for "{searchQuery}"
          </div>
        )}

        {sortedMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-muted">
            {isSearching ? 'No messages match your search' : 'No messages yet'}
          </div>
        ) : (
          <div className="py-2">
            {sortedMessages.map((msg) => (
              <ChatMessage
                key={msg.hash}
                message={msg}
                isOwn={status?.identity === msg.author}
                onReply={(hash) => setReplyTo(hash)}
                onViewTrace={(traceId) => {
                  setSelectedTraceId(traceId);
                  setView('traces');
                }}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border bg-bg-secondary p-3">
        {/* Reply indicator */}
        {replyTo && (
          <div className="flex items-center gap-2 mb-2 text-sm text-text-muted">
            <span>Replying to {replyTo.slice(0, 8)}...</span>
            <button
              onClick={() => setReplyTo(null)}
              className="text-text-muted hover:text-text"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 mb-2 text-sm text-error">
            <AlertCircle className="w-4 h-4" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {showJsonMode ? (
          /* JSON mode */
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileJson className="w-4 h-4 text-text-muted" />
              <span className="text-sm text-text-muted">JSON Mode</span>
              <button
                onClick={() => setShowJsonMode(false)}
                className="text-xs text-accent hover:text-accent-hover ml-auto"
              >
                Switch to text
              </button>
            </div>
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='{"type": "note", "text": "Your message..."}'
              className={clsx(
                'w-full h-24 px-3 py-2 rounded-md font-mono text-sm',
                'bg-bg-tertiary text-text border border-border',
                'focus:outline-none focus:ring-2 focus:ring-accent',
                'resize-none placeholder:text-text-faint'
              )}
              spellCheck={false}
            />
          </div>
        ) : (
          /* Structured text mode with dynamic schema form */
          <div className="space-y-2">
            {/* Type selector row */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Type className="w-3 h-3 text-text-faint" />
                <select
                  value={messageType}
                  onChange={(e) => setMessageType(e.target.value)}
                  disabled={schemasLoading}
                  className={clsx(
                    'px-2 py-1 rounded text-xs',
                    'bg-bg-tertiary text-text border border-border',
                    'focus:outline-none focus:ring-1 focus:ring-accent',
                    'disabled:opacity-50'
                  )}
                >
                  {schemas.length > 0 ? (
                    schemas.map((s) => (
                      <option key={s.schemaId} value={s.contentType}>
                        {s.contentType.charAt(0).toUpperCase() + s.contentType.slice(1)}
                      </option>
                    ))
                  ) : (
                    <option value="message">Message</option>
                  )}
                </select>
              </div>
              {currentSchema?.description && (
                <span className="text-xs text-text-faint truncate flex-1">
                  {currentSchema.description}
                </span>
              )}
            </div>

            {/* Dynamic schema form */}
            {currentSchema ? (
              <SchemaForm
                schema={currentSchema}
                values={formValues}
                onChange={setFormValues}
                topic={messageTopic}
                onTopicChange={setMessageTopic}
                disabled={isSending}
                onSubmit={handleSend}
              />
            ) : (
              /* Fallback for unknown types */
              <textarea
                value={typeof formValues.text === 'string' ? formValues.text : ''}
                onChange={(e) => setFormValues({ ...formValues, text: e.target.value })}
                onKeyDown={handleKeyDown}
                placeholder="Type a message... (Enter to send)"
                rows={2}
                className={clsx(
                  'w-full px-3 py-2 rounded-md text-sm',
                  'bg-bg-tertiary text-text border border-border',
                  'focus:outline-none focus:ring-2 focus:ring-accent',
                  'resize-none placeholder:text-text-faint',
                  'min-h-[60px] max-h-[120px]'
                )}
              />
            )}

            {/* Attachment preview */}
            {attachment && (
              <div className="flex items-center gap-2 p-2 bg-bg-tertiary rounded-md">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {attachment.type.startsWith('image/') ? (
                    <ImageIcon className="w-4 h-4 text-accent flex-shrink-0" />
                  ) : (
                    <Paperclip className="w-4 h-4 text-accent flex-shrink-0" />
                  )}
                  <span className="text-sm text-text truncate">{attachment.name}</span>
                  <span className="text-xs text-text-faint flex-shrink-0">
                    ({Math.round(attachment.size / 1024)}KB)
                  </span>
                </div>
                <button
                  onClick={() => setAttachment(null)}
                  className="text-text-muted hover:text-error p-1"
                  title="Remove attachment"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".json,application/json"
                className="hidden"
              />

              <input
                type="file"
                ref={attachmentInputRef}
                onChange={handleAttachmentUpload}
                accept="image/*,.pdf,.txt,.md"
                className="hidden"
              />

              <Button
                variant="secondary"
                size="sm"
                onClick={() => attachmentInputRef.current?.click()}
                title="Attach file (max 48KB)"
              >
                <Paperclip className="w-4 h-4" />
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                title="Upload JSON"
              >
                <Upload className="w-4 h-4" />
              </Button>

              <Button
                size="sm"
                onClick={handleSend}
                disabled={isSending}
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="flex items-center gap-3 mt-2 text-xs text-text-faint">
          <button
            onClick={() => refetch()}
            className="hover:text-text flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
          <button
            onClick={() => setShowJsonMode(!showJsonMode)}
            className="hover:text-text"
          >
            {showJsonMode ? 'Text mode' : 'JSON mode'}
          </button>
        </div>
      </div>
    </div>
  );
}
