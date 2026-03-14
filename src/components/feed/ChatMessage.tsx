import { clsx } from 'clsx';
import { Reply, Download, Paperclip, Activity } from 'lucide-react';
import type { Message } from '../../api/types';

interface Attachment {
  name: string;
  type: string;
  size: number;
  data: string;  // base64
}

interface ChatMessageProps {
  message: Message;
  isOwn?: boolean;
  onReply?: (hash: string) => void;
  onViewTrace?: (traceId: string) => void;
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getAuthorName(author: string): string {
  // Extract a short identifier from the public key
  const match = author.match(/@([A-Za-z0-9+/]{4})/);
  return match ? match[1] : author.slice(1, 5);
}

function getAuthorColor(author: string): string {
  // Generate a consistent color from the author key
  let hash = 0;
  for (let i = 0; i < author.length; i++) {
    hash = author.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 45%)`;
}

function getDisplayText(content: Record<string, unknown>): string {
  const type = content.type as string;

  switch (type) {
    case 'profile':
      const name = content.name as string;
      const desc = content.description as string;
      return name ? `${name}${desc ? ` - ${desc}` : ''}` : desc || '';
    case 'query':
      return content.question as string || '';
    case 'insight':
      return (content.observation || content.body || content.text || content.summary) as string || '';
    case 'response':
      return (content.answer || content.text || content.body) as string || '';
    case 'task':
      return (content.request as string || content.prompt as string || '') as string;
    case 'task_offer': {
      const servitor = content.servitor as string || '';
      const caps = Array.isArray(content.capabilities) ? content.capabilities.join(', ') : '';
      return `Offer from ${servitor.slice(1, 9)}...${caps ? ` for ${caps}` : ''}`;
    }
    case 'task_assign': {
      const servitor = content.servitor as string || '';
      return `Assigned to ${servitor.slice(1, 9)}...`;
    }
    case 'task_started': {
      const eta = content.eta_seconds as number | undefined;
      return eta ? `Execution started, ETA ${eta}s` : 'Execution started';
    }
    case 'task_status': {
      const progress = content.progress_pct as number | undefined;
      const message = content.message as string | undefined;
      if (typeof progress === 'number' && message) return `${progress}% - ${message}`;
      if (typeof progress === 'number') return `${progress}% complete`;
      return message || 'Task status updated';
    }
    case 'task_failed':
      return (content.details as string || content.reason as string || 'Task failed') as string;
    case 'task_result': {
      const result = content.result as Record<string, unknown> | undefined;
      const status = content.status as string || '';
      const resultText = result?.text as string || '';
      const error = content.error as string | undefined;
      if (resultText) return `[${status}] ${resultText}`;
      if (error) return `[${status}] ${error}`;
      return `[${status}]`;
    }
    case 'task_claim': {
      const servitorId = content.servitor_id as string || '';
      const shortId = servitorId.slice(1, 9);
      return `Claimed by ${shortId}...`;
    }
    case 'servitor_profile': {
      const servitorId = content.servitor_id as string || '';
      const shortId = servitorId.slice(1, 9);
      const resources = content.resource_limits as Record<string, unknown> | undefined;
      const cpu = resources?.cpu || '?';
      const mem = resources?.memory_mb || '?';
      return `Heartbeat: ${shortId}... (${cpu} CPU, ${mem}MB)`;
    }
    default:
      return (content.text || content.body || content.message || content.description || content.question || content.observation || content.prompt) as string || '';
  }
}

export function ChatMessage({ message, isOwn, onReply, onViewTrace }: ChatMessageProps) {
  const content = message.content as unknown as Record<string, unknown>;
  const text = getDisplayText(content);
  const authorName = getAuthorName(message.author);
  const authorColor = getAuthorColor(message.author);
  const title = (content.title as string) || '';
  const topic = (content.topic as string) || '';
  const type = (content.type as string) || 'unknown';
  const traceId =
    (typeof message.trace_id === 'string' && message.trace_id) ||
    (typeof content.trace_id === 'string' ? content.trace_id : null);

  if (!text && !title) {
    return null; // Skip empty messages
  }

  return (
    <div
      className={clsx(
        'group flex gap-3 px-4 py-2 hover:bg-bg-tertiary/50 transition-colors',
        isOwn && 'bg-accent/5'
      )}
    >
      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
        style={{ backgroundColor: authorColor }}
        title={message.author}
      >
        {authorName}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-baseline gap-2">
          <span
            className="font-semibold text-sm"
            style={{ color: authorColor }}
            title={message.author}
          >
            {authorName}
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-bg-tertiary text-text-muted">
            {type}
          </span>
          {topic && (
            <span className="text-xs text-accent">#{topic}</span>
          )}
          <span className="text-xs text-text-faint" title={message.timestamp}>
            {formatTime(message.timestamp)}
          </span>
        </div>

        {/* Title */}
        {title.length > 0 && (
          <div className="font-medium text-text mt-0.5">{title}</div>
        )}

        {/* Message text */}
        {text && (
          <div className="text-text text-sm mt-0.5 whitespace-pre-wrap break-words">
            {text}
          </div>
        )}

        {/* Attachment */}
        {content.attachment ? (() => {
          const att = content.attachment as Attachment;
          const dataUrl = `data:${att.type};base64,${att.data}`;

          if (att.type.startsWith('image/')) {
            return (
              <div className="mt-2">
                <img
                  src={dataUrl}
                  alt={att.name}
                  className="max-w-xs max-h-64 rounded-md border border-border"
                />
                <div className="text-xs text-text-faint mt-1">{att.name}</div>
              </div>
            );
          }

          return (
            <div className="mt-2 inline-flex items-center gap-2 p-2 bg-bg-tertiary rounded-md">
              <Paperclip className="w-4 h-4 text-accent" />
              <span className="text-sm text-text">{att.name}</span>
              <span className="text-xs text-text-faint">({Math.round(att.size / 1024)}KB)</span>
              <a
                href={dataUrl}
                download={att.name}
                className="p-1 rounded hover:bg-bg-secondary text-text-muted hover:text-accent"
                title="Download"
              >
                <Download className="w-4 h-4" />
              </a>
            </div>
          );
        })() : null}

        {/* References */}
        {message.references && message.references.length > 0 && (
          <div className="text-xs text-text-faint mt-1">
            replying to {message.references[0].slice(0, 8)}...
          </div>
        )}
        {type === 'task_result' && traceId && onViewTrace ? (
          <button
            onClick={() => onViewTrace(traceId)}
            className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover"
          >
            <Activity className="h-3.5 w-3.5" />
            View Trace
          </button>
        ) : null}
      </div>

      {/* Actions */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-start gap-1">
        {onReply && (
          <button
            onClick={() => onReply(message.hash)}
            className="p-1 rounded hover:bg-bg-tertiary text-text-muted hover:text-text"
            title="Reply"
          >
            <Reply className="w-4 h-4" />
          </button>
        )}
        {traceId && onViewTrace ? (
          <button
            onClick={() => onViewTrace(traceId)}
            className="p-1 rounded hover:bg-bg-tertiary text-text-muted hover:text-accent"
            title="View trace"
          >
            <Activity className="w-4 h-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
