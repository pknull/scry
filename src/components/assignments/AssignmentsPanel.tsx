import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Loader2, RefreshCw, RotateCcw, ShieldCheck } from 'lucide-react';
import {
  ASSIGNMENT_POLL_INTERVAL_MS,
  buildAssignTaskContent,
  createAssignmentCommandSnapshot,
  createEmittedAssignment,
  derivePendingAssignments,
  getAssignmentFeedRecords,
  isAssignmentRetryDisabled,
  isTaskAssignmentBlocked,
  publishAssignmentCommand,
  reconcileAssignment,
  retryEmittedAssignment,
  type AssignmentCommandSnapshot,
  type AssignmentStatus,
  type EmittedAssignment,
  type PendingAssignment,
} from '../../api/assignments';
import { getIdentity } from '../../api/status';
import type { Message } from '../../api/types';
import { useAssignmentStore } from '../../stores/assignmentStore';
import { Button } from '../ui/Button';
import { Card, CardHeader, CardTitle } from '../ui/Card';

const EMPTY_MESSAGES: Message[] = [];

interface Confirmation {
  snapshot: AssignmentCommandSnapshot;
}

const STATUS_LABELS: Record<AssignmentStatus, string> = {
  awaiting_owner: 'Awaiting owner',
  accepted: 'Accepted',
  executing: 'Executing',
  completed: 'Completed',
  rejected: 'Rejected',
  unknown: 'Unknown',
};

function truncate(value: string, length: number): string {
  if (value.length <= length) return value;
  return `${value.slice(0, length - 1)}…`;
}

function formatAge(timestamp: string, nowMs: number): string {
  const timestampMs = Date.parse(timestamp);
  if (!Number.isFinite(timestampMs)) return 'unknown age';
  const seconds = Math.max(0, Math.floor((nowMs - timestampMs) / 1_000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function statusClasses(status: AssignmentStatus): string {
  if (status === 'completed' || status === 'accepted') return 'text-success';
  if (status === 'rejected') return 'text-error';
  if (status === 'unknown') return 'text-warning';
  if (status === 'executing') return 'text-accent';
  return 'text-text-muted';
}

export function AssignmentsPanel() {
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const emitted = useAssignmentStore((state) => state.emitted);
  const updateEmitted = useAssignmentStore((state) => state.updateEmitted);
  const sendingAttemptIds = useAssignmentStore((state) => state.sendingAttemptIds);
  const beginAttempt = useAssignmentStore((state) => state.beginAttempt);
  const endAttempt = useAssignmentStore((state) => state.endAttempt);
  const [nowMs, setNowMs] = useState(Date.now());
  const usedConfirmations = useRef(new Set<string>());

  const identityQuery = useQuery({
    queryKey: ['identity'],
    queryFn: getIdentity,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  const feedQuery = useQuery({
    queryKey: ['assignment-feed'],
    queryFn: () => getAssignmentFeedRecords(200),
    refetchInterval: ASSIGNMENT_POLL_INTERVAL_MS,
  });

  const records = feedQuery.data ?? EMPTY_MESSAGES;
  const pending = derivePendingAssignments(records);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), ASSIGNMENT_POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const now = new Date(nowMs);
    updateEmitted((current) =>
      current.map((assignment) => reconcileAssignment(assignment, records, now)),
    );
  }, [nowMs, records, updateEmitted]);

  const openConfirmation = (assignment: PendingAssignment) => {
    const identity = identityQuery.data?.public_id;
    if (!identity) return;

    const snapshot = createAssignmentCommandSnapshot(
      assignment,
      identity,
      crypto.randomUUID(),
      new Date(),
    );
    setConfirmation({ snapshot });
  };

  const publishAttempt = async (assignment: EmittedAssignment) => {
    const attemptId = assignment.attemptId;
    beginAttempt(attemptId);

    try {
      await publishAssignmentCommand(
        buildAssignTaskContent(assignment.snapshot, assignment.attemptId),
      );
      void feedQuery.refetch();
    } catch {
      void feedQuery.refetch();
    } finally {
      endAttempt(attemptId);
    }
  };

  const confirmAssignment = () => {
    if (!confirmation) return;
    const { snapshot } = confirmation;
    if (usedConfirmations.current.has(snapshot.commandId)) return;

    usedConfirmations.current.add(snapshot.commandId);
    setConfirmation(null);

    const sentAt = new Date();
    if (sentAt.getTime() >= Date.parse(snapshot.expiresAt)) return;

    const assignment = createEmittedAssignment(snapshot, crypto.randomUUID(), sentAt);
    updateEmitted((current) => [assignment, ...current]);
    void publishAttempt(assignment);
  };

  const retryAssignment = (assignment: EmittedAssignment) => {
    const now = new Date();
    if (now.getTime() >= Date.parse(assignment.snapshot.expiresAt)) return;

    const retry = retryEmittedAssignment(assignment, crypto.randomUUID(), now);
    updateEmitted((current) =>
      current.map((item) =>
        item.snapshot.commandId === retry.snapshot.commandId ? retry : item,
      ),
    );
    void publishAttempt(retry);
  };

  if (feedQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center" aria-label="Loading assignments">
        <Loader2 className="h-8 w-8 animate-spin text-accent" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      {(feedQuery.isError || identityQuery.isError) && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-error/30 bg-error/10 p-4" role="alert">
          <div className="flex items-center gap-3 text-sm text-error">
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>
              {feedQuery.isError
                ? 'Assignment records could not be loaded.'
                : 'Local assigner identity could not be loaded; assignment is disabled.'}
            </span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (feedQuery.isError) void feedQuery.refetch();
              if (identityQuery.isError) void identityQuery.refetch();
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Retry
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Awaiting assignment</CardTitle>
            <p className="mt-1 text-sm text-text-muted">
              Identity-bound offers with no owner-accepted assignment or task result.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void feedQuery.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
        </CardHeader>

        {pending.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-text-muted">
            No tasks are awaiting assignment.
          </p>
        ) : (
          <ul className="divide-y divide-border" aria-label="Tasks awaiting assignment">
            {pending.map((assignment) => {
              const hasOutstandingCommand = isTaskAssignmentBlocked(assignment.taskId, emitted);
              return (
                <li key={assignment.offerHash} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-mono text-sm font-medium text-text">{assignment.taskId}</span>
                      <span className="text-xs text-text-muted">Offered {formatAge(assignment.offeredAt, nowMs)}</span>
                    </div>
                    <p className="mt-1 text-sm text-text">
                      {truncate(assignment.prompt || 'No prompt provided', 140)}
                    </p>
                    <p className="mt-1 break-all font-mono text-xs text-text-muted">
                      Servitor: {assignment.servitor}
                    </p>
                  </div>
                  <Button
                    onClick={() => openConfirmation(assignment)}
                    disabled={!identityQuery.data?.public_id || hasOutstandingCommand}
                    aria-label={`Assign task ${assignment.taskId} to ${assignment.servitor}`}
                  >
                    {hasOutstandingCommand ? 'Assignment pending' : 'Assign'}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Emitted commands</CardTitle>
            <p className="mt-1 text-sm text-text-muted">
              Ephemeral status reconciled from owner-signed feed records.
            </p>
          </div>
        </CardHeader>

        {emitted.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-text-muted">
            No assignment commands emitted in this session.
          </p>
        ) : (
          <ul className="divide-y divide-border" aria-label="Emitted assignment commands">
            {emitted.map((assignment) => {
              const sending = sendingAttemptIds.has(assignment.attemptId);
              const expired = nowMs >= Date.parse(assignment.snapshot.expiresAt);
              return (
                <li key={assignment.snapshot.commandId} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-mono text-sm text-text">{assignment.snapshot.taskId}</span>
                      <strong className={`text-sm ${statusClasses(assignment.status)}`}>
                        {STATUS_LABELS[assignment.status]}
                      </strong>
                    </div>
                    <p className="mt-1 break-all font-mono text-xs text-text-muted">
                      Executor: {assignment.snapshot.executor}
                    </p>
                    <p className="mt-1 font-mono text-xs text-text-faint" title={assignment.snapshot.commandId}>
                      Command: {truncate(assignment.snapshot.commandId, 24)}
                    </p>
                    {assignment.reason && (
                      <p className="mt-1 text-sm text-error">Reason: {assignment.reason}</p>
                    )}
                  </div>
                  {assignment.status === 'unknown' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => retryAssignment(assignment)}
                      disabled={isAssignmentRetryDisabled(sending, assignment.snapshot.expiresAt, nowMs)}
                    >
                      {sending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                      )}
                      {expired ? 'Expired' : 'Retry'}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {confirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="assignment-confirmation-title"
            aria-describedby="assignment-confirmation-consequence"
            className="w-full max-w-lg rounded-lg border border-border bg-bg p-6 shadow-xl"
          >
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-6 w-6 text-warning" aria-hidden="true" />
              <h2 id="assignment-confirmation-title" className="text-lg font-semibold text-text">
                Confirm task assignment
              </h2>
            </div>

            <dl className="mt-5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm">
              <dt className="text-text-muted">Task ID</dt>
              <dd className="break-all font-mono text-text">{confirmation.snapshot.taskId}</dd>
              <dt className="text-text-muted">Executor</dt>
              <dd className="break-all font-mono text-text">{confirmation.snapshot.executor}</dd>
              <dt className="text-text-muted">Expiry</dt>
              <dd className="text-text">
                <time dateTime={confirmation.snapshot.expiresAt}>
                  {new Date(confirmation.snapshot.expiresAt).toLocaleString()}
                </time>
              </dd>
              <dt className="text-text-muted">Consequence</dt>
              <dd id="assignment-confirmation-consequence" className="text-text">
                executes this task's tool calls under the executor's authority
              </dd>
            </dl>

            <p className="mt-5 text-sm text-text-muted">
              Confirmation is bound to this task, offer, assigner, executor, command, and expiry, and can be used once.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setConfirmation(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={confirmAssignment}
                disabled={nowMs >= Date.parse(confirmation.snapshot.expiresAt)}
                autoFocus
              >
                Confirm assignment
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
