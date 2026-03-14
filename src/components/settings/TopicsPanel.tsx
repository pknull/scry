import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Tag, Plus, X, AlertCircle, Loader2, RefreshCw, Check, Search, Filter
} from 'lucide-react';
import { getKnownTopics, subscribeTopic, unsubscribeTopic } from '../../api/topics';
import { Card, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ValidationMessage } from '../ui/ValidationMessage';
import { clsx } from 'clsx';
import type { KnownTopicInfo } from '../../api/types';
import { validateTopicName } from './validation';

export function TopicsPanel() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');

  const { data: topics, isLoading, refetch } = useQuery({
    queryKey: ['known-topics'],
    queryFn: getKnownTopics,
  });

  const subscribeMutation = useMutation({
    mutationFn: subscribeTopic,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['known-topics'] });
    },
  });

  const unsubscribeMutation = useMutation({
    mutationFn: unsubscribeTopic,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['known-topics'] });
    },
  });

  const filteredTopics = topics?.filter((t) => {
    if (!filterQuery.trim()) return true;
    return t.topic.toLowerCase().includes(filterQuery.toLowerCase());
  });

  const subscribedCount = topics?.filter((t) => t.subscribed).length ?? 0;
  const isFiltering = filterQuery.trim().length > 0;

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
          <h2 className="text-lg font-semibold text-text">Topic Subscriptions</h2>
          <p className="text-sm text-text-muted">
            Control which topics are replicated from peers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="w-4 h-4 mr-1" />
            Subscribe
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="text-sm text-text-muted bg-bg-tertiary/50 p-3 rounded-md">
        <strong>Selective replication:</strong> When you subscribe to topics, only messages
        with matching tags will be replicated from peers. If no topics are subscribed,
        all messages are replicated.
      </div>

      {/* Add form */}
      {showAdd && (
        <AddTopicForm
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            setShowAdd(false);
            queryClient.invalidateQueries({ queryKey: ['known-topics'] });
          }}
        />
      )}

      {/* Topic list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5" />
              Topics ({topics?.length ?? 0})
              {subscribedCount > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-accent/20 text-accent">
                  {subscribedCount} subscribed
                </span>
              )}
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filter topics..."
                className="pl-9 pr-8 py-1.5 text-sm rounded-md bg-bg-tertiary text-text border border-border focus:outline-none focus:ring-2 focus:ring-accent w-48"
              />
              {filterQuery && (
                <button
                  onClick={() => setFilterQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-bg rounded"
                >
                  <X className="w-3.5 h-3.5 text-text-muted" />
                </button>
              )}
            </div>
          </div>
        </CardHeader>

        {/* Filter indicator */}
        {isFiltering && (
          <div className="mx-4 mb-2 px-3 py-2 rounded-md bg-accent/10 border border-accent/30 flex items-center justify-between">
            <div className="flex items-center gap-2 text-accent">
              <Filter className="w-4 h-4" />
              <span className="text-sm font-medium">
                Showing {filteredTopics?.length ?? 0} of {topics?.length ?? 0} topics
              </span>
            </div>
            <button
              onClick={() => setFilterQuery('')}
              className="text-xs text-accent hover:text-accent/80 underline"
            >
              Clear filter
            </button>
          </div>
        )}

        <div className="divide-y divide-border">
          {filteredTopics?.map((topic) => (
            <TopicRow
              key={topic.topic}
              topic={topic}
              onToggle={() => {
                if (topic.subscribed) {
                  unsubscribeMutation.mutate(topic.topic);
                } else {
                  subscribeMutation.mutate(topic.topic);
                }
              }}
              isLoading={
                subscribeMutation.isPending || unsubscribeMutation.isPending
              }
            />
          ))}
          {isFiltering && filteredTopics?.length === 0 && (
            <div className="p-4 text-center text-text-muted">
              No topics match "{filterQuery}"
            </div>
          )}
          {!isFiltering && (!topics || topics.length === 0) && (
            <div className="p-4 text-center text-text-muted">
              No topics discovered yet. Topics appear when messages with tags are received.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function TopicRow({
  topic,
  onToggle,
  isLoading,
}: {
  topic: KnownTopicInfo;
  onToggle: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="flex items-center gap-3 p-3 hover:bg-bg-tertiary/50 transition-colors">
      <button
        onClick={onToggle}
        disabled={isLoading}
        className={clsx(
          'w-6 h-6 rounded flex items-center justify-center transition-colors',
          topic.subscribed
            ? 'bg-accent text-white'
            : 'bg-bg-tertiary text-text-muted hover:bg-bg-tertiary/80'
        )}
      >
        {topic.subscribed && <Check className="w-4 h-4" />}
      </button>
      <div className="flex-1 min-w-0">
        <span className="text-sm text-text">{topic.topic}</span>
      </div>
      <span className={clsx(
        'text-xs px-1.5 py-0.5 rounded',
        topic.subscribed
          ? 'bg-accent/20 text-accent'
          : 'bg-bg-tertiary text-text-muted'
      )}>
        {topic.subscribed ? 'Subscribed' : 'Not subscribed'}
      </span>
    </div>
  );
}

function AddTopicForm({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [topic, setTopic] = useState('');
  const [apiError, setApiError] = useState<string | null>(null);
  const topicError = validateTopicName(topic);

  const mutation = useMutation({
    mutationFn: subscribeTopic,
    onSuccess,
    onError: (err) => setApiError(err instanceof Error ? err.message : 'Failed to subscribe'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (topicError) {
      return;
    }
    setApiError(null);
    mutation.mutate(topic.trim());
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Subscribe to Topic</CardTitle>
          <button onClick={onClose} className="p-1 hover:bg-bg-tertiary rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit} className="p-4 pt-0 space-y-4">
        <div>
          <label className="block text-sm font-medium text-text mb-1">
            Topic Name
          </label>
          <Input
            type="text"
            value={topic}
            onChange={(e) => {
              setTopic(e.target.value);
              setApiError(null);
            }}
            placeholder="e.g., llm-insights"
            maxLength={256}
            error={Boolean(topicError)}
            aria-invalid={Boolean(topicError)}
          />
          <ValidationMessage message={topicError} />
          <p className="text-xs text-text-muted mt-1">
            1-256 characters. Messages tagged with this topic will be replicated.
          </p>
        </div>
        {apiError && (
          <div className="rounded-md border border-error/30 bg-error/10 p-3">
            <div className="flex items-center gap-2 text-error text-sm">
              <AlertCircle className="w-4 h-4" />
              {apiError}
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending || Boolean(topicError)}>
            {mutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : (
              <Plus className="w-4 h-4 mr-1" />
            )}
            Subscribe
          </Button>
        </div>
      </form>
    </Card>
  );
}
