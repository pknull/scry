import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { getFeed, searchInsights } from '../../api/feed';
import { getStatus } from '../../api/status';
import { ChatMessage } from './ChatMessage';
import { useAppStore } from '../../stores/appStore';
import { Button } from '../ui/Button';

interface ChatFeedProps {
  searchQuery: string;
}

export function ChatFeed({ searchQuery }: ChatFeedProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

      <div className="border-t border-border bg-bg-secondary px-3 py-2">
        <div className="flex items-center justify-end">
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>
    </div>
  );
}
