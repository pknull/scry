import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, ChevronDown, ChevronRight, Plus, Trash2, X,
  AlertCircle, Loader2, RefreshCw, UserPlus, Clock
} from 'lucide-react';
import {
  getGroups, getGroupMembers, getGroupOffsets,
  createGroup, deleteGroup
} from '../../api/groups';
import { Card, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ValidationMessage } from '../ui/ValidationMessage';
import type { ConsumerGroup, GroupMember, GroupOffset } from '../../api/types';
import { validateGroupId } from './validation';

export function ConsumerGroupsPanel() {
  const queryClient = useQueryClient();
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: groups, isLoading, refetch } = useQuery({
    queryKey: ['groups'],
    queryFn: getGroups,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });

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
          <h2 className="text-lg font-semibold text-text">Consumer Groups</h2>
          <p className="text-sm text-text-muted">
            Coordinate message consumption across processes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
            <Plus className="w-4 h-4 mr-1" />
            Create
          </Button>
        </div>
      </div>

      {/* Security warning */}
      <div className="flex items-start gap-2 p-3 rounded-md bg-warning/10 border border-warning/30 text-warning">
        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <strong>Localhost only.</strong> Consumer groups are designed for coordination between
          processes on the same machine. Do not expose over a network without authentication.
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <CreateGroupForm
          existingGroupIds={groups?.map((group) => group.group_id) ?? []}
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            queryClient.invalidateQueries({ queryKey: ['groups'] });
          }}
        />
      )}

      {/* Group list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Groups ({groups?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <div className="divide-y divide-border">
          {groups?.map((group) => (
            <GroupRow
              key={group.group_id}
              group={group}
              isExpanded={expandedGroup === group.group_id}
              onToggle={() => setExpandedGroup(
                expandedGroup === group.group_id ? null : group.group_id
              )}
              onDelete={() => {
                if (confirm(`Delete group "${group.group_id}"?`)) {
                  deleteMutation.mutate(group.group_id);
                }
              }}
            />
          ))}
          {(!groups || groups.length === 0) && (
            <div className="p-4 text-center text-text-muted">
              No consumer groups configured
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function GroupRow({
  group,
  isExpanded,
  onToggle,
  onDelete,
}: {
  group: ConsumerGroup;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['group-members', group.group_id],
    queryFn: () => getGroupMembers(group.group_id),
    enabled: isExpanded,
  });

  const { data: offsets, isLoading: offsetsLoading } = useQuery({
    queryKey: ['group-offsets', group.group_id],
    queryFn: () => getGroupOffsets(group.group_id),
    enabled: isExpanded,
  });

  return (
    <div>
      <div className="flex items-center gap-3 p-3 hover:bg-bg-tertiary/50 transition-colors">
        <button onClick={onToggle} className="flex-1 flex items-center gap-3 text-left">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-text-muted flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-text">{group.group_id}</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-accent/20 text-accent">
                gen {group.generation}
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-bg-tertiary text-text-muted">
                {group.member_count} member{group.member_count !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="text-xs text-text-muted mt-0.5">
              Created {new Date(group.created_at).toLocaleString()}
            </div>
          </div>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1.5 hover:bg-error/20 rounded text-text-muted hover:text-error transition-colors"
          title="Delete group"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 pl-10 space-y-4">
          {/* Members */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <UserPlus className="w-4 h-4 text-text-muted" />
              <span className="text-sm font-medium text-text">Members</span>
            </div>
            {membersLoading ? (
              <div className="flex items-center gap-2 text-text-muted text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </div>
            ) : members && members.length > 0 ? (
              <div className="space-y-2">
                {members.map((member) => (
                  <MemberRow key={member.member_id} member={member} />
                ))}
              </div>
            ) : (
              <div className="text-sm text-text-muted">No members</div>
            )}
          </div>

          {/* Offsets */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-text-muted" />
              <span className="text-sm font-medium text-text">Committed Offsets</span>
            </div>
            {offsetsLoading ? (
              <div className="flex items-center gap-2 text-text-muted text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </div>
            ) : offsets && offsets.length > 0 ? (
              <div className="space-y-1">
                {offsets.map((offset) => (
                  <OffsetRow key={offset.author} offset={offset} />
                ))}
              </div>
            ) : (
              <div className="text-sm text-text-muted">No offsets committed</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MemberRow({ member }: { member: GroupMember }) {
  return (
    <div className="text-xs bg-bg-tertiary p-2 rounded">
      <div className="font-mono text-text truncate">{member.member_id}</div>
      <div className="text-text-muted mt-1">
        Joined {new Date(member.joined_at).toLocaleString()} •
        {member.assigned_feeds.length} feed{member.assigned_feeds.length !== 1 ? 's' : ''} assigned
      </div>
      {member.assigned_feeds.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {member.assigned_feeds.map((feed) => (
            <span key={feed} className="px-1.5 py-0.5 bg-bg rounded text-text-muted truncate max-w-[200px]">
              {feed}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function OffsetRow({ offset }: { offset: GroupOffset }) {
  return (
    <div className="text-xs flex items-center gap-2 bg-bg-tertiary p-2 rounded">
      <span className="font-mono text-text truncate flex-1">{offset.author}</span>
      <span className="text-accent font-medium">seq {offset.committed_sequence}</span>
    </div>
  );
}

function CreateGroupForm({
  existingGroupIds,
  onClose,
  onSuccess,
}: {
  existingGroupIds: string[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [groupId, setGroupId] = useState('');
  const [apiError, setApiError] = useState<string | null>(null);
  const groupIdError = validateGroupId(groupId, existingGroupIds);

  const mutation = useMutation({
    mutationFn: createGroup,
    onSuccess,
    onError: (err) => setApiError(err instanceof Error ? err.message : 'Failed to create'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (groupIdError) {
      return;
    }
    setApiError(null);
    mutation.mutate(groupId.trim());
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Create Consumer Group</CardTitle>
          <button onClick={onClose} className="p-1 hover:bg-bg-tertiary rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit} className="p-4 pt-0 space-y-4">
        <div>
          <label className="block text-sm font-medium text-text mb-1">
            Group ID
          </label>
          <Input
            type="text"
            value={groupId}
            onChange={(e) => {
              setGroupId(e.target.value);
              setApiError(null);
            }}
            placeholder="my-consumer-group"
            maxLength={64}
            className="font-mono"
            error={Boolean(groupIdError)}
            aria-invalid={Boolean(groupIdError)}
          />
          <ValidationMessage message={groupIdError} />
          <p className="text-xs text-text-muted mt-1">
            Alphanumeric, hyphens, underscores. Max 64 characters.
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
          <Button type="submit" disabled={mutation.isPending || Boolean(groupIdError)}>
            {mutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : (
              <Plus className="w-4 h-4 mr-1" />
            )}
            Create
          </Button>
        </div>
      </form>
    </Card>
  );
}
