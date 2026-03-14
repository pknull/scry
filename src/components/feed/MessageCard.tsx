import { clsx } from 'clsx';
import { ChevronDown, ChevronRight, MessageSquare, Clock, User } from 'lucide-react';
import type { Message } from '../../api/types';

interface MessageCardProps {
  message: Message;
  replies?: Message[];
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  depth?: number;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function truncateKey(key: string): string {
  if (key.length <= 12) return key;
  return `${key.slice(0, 6)}...${key.slice(-6)}`;
}

// Extract displayable text from various content types
function getDisplayContent(content: Record<string, unknown>): {
  title?: string;
  text?: string;
  meta?: string;
} {
  const type = content.type as string;

  switch (type) {
    case 'profile':
      return {
        title: content.name as string,
        text: content.description as string,
        meta: Array.isArray(content.capabilities)
          ? (content.capabilities as string[]).join(', ')
          : undefined,
      };
    case 'query':
      return {
        text: content.question as string,
      };
    case 'insight':
      return {
        title: content.title as string,
        text: (content.observation || content.body || content.text || content.summary) as string,
      };
    case 'response':
      return {
        text: (content.answer || content.text || content.body) as string,
      };
    default:
      // Generic fallback - try common fields
      return {
        title: content.title as string,
        text: (content.text || content.body || content.message || content.description || content.observation || content.question) as string,
      };
  }
}

export function MessageCard({
  message,
  replies = [],
  isExpanded = false,
  onToggleExpand,
  depth = 0,
}: MessageCardProps) {
  const hasReplies = replies.length > 0;
  const content = message.content;
  const display = getDisplayContent(content as unknown as Record<string, unknown>);

  return (
    <div
      className={clsx(
        'rounded-lg border border-border bg-bg-secondary',
        depth > 0 && 'ml-6 border-l-2 border-l-accent/30'
      )}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2 text-sm">
          <User className="w-4 h-4 text-text-muted" />
          <span className="font-mono text-text-muted" title={message.author}>
            {truncateKey(message.author)}
          </span>
          {content.topic && (
            <>
              <span className="text-text-faint">in</span>
              <span className="text-accent font-medium">#{content.topic}</span>
            </>
          )}
          <div className="flex items-center gap-1 ml-auto text-text-faint">
            <Clock className="w-3 h-3" />
            <span>{formatTimestamp(message.timestamp)}</span>
          </div>
        </div>

        {/* Title */}
        {display.title && (
          <h3 className="font-semibold text-text mb-2">{display.title}</h3>
        )}

        {/* Content */}
        {display.text && (
          <p className="text-text whitespace-pre-wrap">{display.text}</p>
        )}

        {/* Meta info (e.g., capabilities for profile) */}
        {display.meta && (
          <p className="text-sm text-text-muted mt-1 italic">{display.meta}</p>
        )}

        {/* Type badge */}
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded bg-bg-tertiary text-text-muted">
            {content.type}
          </span>
          <span className="text-xs text-text-faint font-mono" title={message.hash}>
            {message.hash.slice(0, 8)}
          </span>
        </div>

        {/* Replies toggle */}
        {hasReplies && (
          <button
            onClick={onToggleExpand}
            className="mt-3 flex items-center gap-1 text-sm text-accent hover:text-accent-hover transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            <MessageSquare className="w-4 h-4" />
            <span>{replies.length} {replies.length === 1 ? 'reply' : 'replies'}</span>
          </button>
        )}
      </div>

      {/* Nested replies */}
      {hasReplies && isExpanded && (
        <div className="border-t border-border p-4 space-y-3">
          {replies.map((reply) => (
            <MessageCard
              key={reply.hash}
              message={reply}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
