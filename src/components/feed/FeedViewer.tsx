import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, RefreshCw, AlertCircle, Plus } from 'lucide-react';
import { getFeed, searchInsights } from '../../api/feed';
import { MessageCard } from './MessageCard';
import { MessageComposer } from './MessageComposer';
import { Button } from '../ui/Button';
import type { Message } from '../../api/types';

interface FeedViewerProps {
  searchQuery: string;
}

interface ThreadedMessage extends Message {
  replies: ThreadedMessage[];
}

function buildThreads(messages: Message[]): ThreadedMessage[] {
  const messageMap = new Map<string, ThreadedMessage>();
  const roots: ThreadedMessage[] = [];

  // First pass: create threaded message objects
  for (const msg of messages) {
    messageMap.set(msg.hash, { ...msg, replies: [] });
  }

  // Second pass: link replies to parents
  for (const msg of messages) {
    const threadedMsg = messageMap.get(msg.hash)!;
    const parentRef = msg.references?.[0];

    if (parentRef && messageMap.has(parentRef)) {
      messageMap.get(parentRef)!.replies.push(threadedMsg);
    } else {
      roots.push(threadedMsg);
    }
  }

  // Sort roots by timestamp (newest first)
  roots.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return roots;
}

export function FeedViewer({ searchQuery }: FeedViewerProps) {
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [showComposer, setShowComposer] = useState(false);

  const isSearching = searchQuery.trim().length > 0;

  const {
    data: feedMessages,
    isLoading: feedLoading,
    error: feedError,
    refetch: refetchFeed,
  } = useQuery({
    queryKey: ['feed'],
    queryFn: () => getFeed({ limit: 100 }),
    enabled: !isSearching,
    refetchInterval: 5000,  // 5 seconds
  });

  const {
    data: searchResults,
    isLoading: searchLoading,
    error: searchError,
  } = useQuery({
    queryKey: ['search', searchQuery],
    queryFn: () => searchInsights({ q: searchQuery, limit: 50 }),
    enabled: isSearching,
  });

  const messages = isSearching ? searchResults : feedMessages;
  const isLoading = isSearching ? searchLoading : feedLoading;
  const error = isSearching ? searchError : feedError;

  const threads = useMemo(() => {
    if (!messages) return [];
    return buildThreads(messages);
  }, [messages]);

  const toggleThread = (hash: string) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(hash)) {
        next.delete(hash);
      } else {
        next.add(hash);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-12 h-12 text-error" />
        <p className="text-text-muted">
          {error instanceof Error ? error.message : 'Failed to load messages'}
        </p>
        <Button variant="secondary" onClick={() => refetchFeed()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (!threads.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <p className="text-text-muted">
          {isSearching ? 'No messages match your search' : 'No messages yet'}
        </p>
        {isSearching && (
          <p className="text-text-faint text-sm">Try a different search term</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* New message button / composer */}
      {showComposer ? (
        <MessageComposer onClose={() => setShowComposer(false)} />
      ) : (
        <div className="flex gap-2">
          <Button onClick={() => setShowComposer(true)} className="flex-1">
            <Plus className="w-4 h-4 mr-2" />
            New Message
          </Button>
          <Button variant="secondary" onClick={() => refetchFeed()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      )}

      {isSearching && (
        <p className="text-sm text-text-muted">
          Found {threads.length} {threads.length === 1 ? 'result' : 'results'} for "{searchQuery}"
        </p>
      )}

      {threads.map((thread) => (
        <MessageCard
          key={thread.hash}
          message={thread}
          replies={thread.replies}
          isExpanded={expandedThreads.has(thread.hash)}
          onToggleExpand={() => toggleThread(thread.hash)}
        />
      ))}
    </div>
  );
}
