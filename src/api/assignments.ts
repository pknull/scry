import { apiPost } from './client';
import { getFeed } from './feed';
import type { Message, MessageContent } from './types';

export const ASSIGNMENT_POLL_INTERVAL_MS = 5_000;
export const ASSIGNMENT_RESULT_TIMEOUT_MS = 15_000;
export const ASSIGNMENT_COMMAND_TTL_MS = 5 * 60_000;

const ASSIGNMENT_FEED_LIMIT = 200;
const ASSIGNMENT_FEED_TYPES = [
  'task',
  'task_offer',
  'task_assign',
  'assign_task',
  'assign_task_result',
  'task_result',
  'task_started',
] as const;

const BLOCKING_STATUSES = new Set<AssignmentStatus>([
  'awaiting_owner',
  'unknown',
  'accepted',
  'executing',
]);

const REJECTION_REASONS = new Set([
  'assigner_mismatch',
  'expired',
  'task_resolved',
  'offer_unavailable',
  'task_mismatch',
  'stale_predecessor',
  'unauthorized',
]);

export interface PendingAssignment {
  taskId: string;
  /** Signed feed envelope hash used by AssignTaskV1.task_hash. */
  taskHash: string;
  /** Task content's hash field used by Servitor task_result.task_hash. */
  taskContentHash: string;
  prompt: string;
  servitor: string;
  offerHash: string;
  offeredAt: string;
}

export interface AssignmentCommandSnapshot {
  taskId: string;
  taskHash: string;
  taskContentHash: string;
  offerHash: string;
  executor: string;
  assigner: string;
  commandId: string;
  expiresAt: string;
}

export interface AssignTaskContent extends MessageContent {
  type: 'assign_task';
  task_id: string;
  task_hash: string;
  offer_hash: string;
  executor: string;
  assigner: string;
  predecessor: string;
  command_id: string;
  attempt_id: string;
  expires_at: string;
}

export type AssignmentStatus =
  | 'awaiting_owner'
  | 'accepted'
  | 'executing'
  | 'completed'
  | 'rejected'
  | 'unknown';

export interface EmittedAssignment {
  snapshot: AssignmentCommandSnapshot;
  attemptId: string;
  lastSentAt: string;
  status: AssignmentStatus;
  reason?: string;
}

interface CapturedTask {
  message: Message;
  taskId: string;
  taskHash: string;
  taskContentHash: string;
  prompt: string;
}

interface CapturedOffer {
  message: Message;
  taskId: string;
  servitor: string;
}

interface CapturedCommand {
  message: Message;
  content: AssignTaskContent;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function contentOf(message: Message): MessageContent | null {
  const content: unknown = message.content;
  if (!isObject(content) || typeof content.type !== 'string') return null;
  return content as MessageContent;
}

function normalizedType(content: MessageContent): string {
  return content.type.endsWith('/v1') ? content.type.slice(0, -3) : content.type;
}

function stringField(content: MessageContent, field: string): string | null {
  const value = content[field];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function taskIdForTask(content: MessageContent): string | null {
  return stringField(content, 'id') ?? stringField(content, 'task_id') ?? stringField(content, 'hash');
}

function taskPrompt(content: MessageContent): string {
  return (
    stringField(content, 'prompt') ??
    stringField(content, 'request') ??
    stringField(content, 'title') ??
    stringField(content, 'text') ??
    ''
  );
}

function timestampMs(message: Message): number {
  const timestamp = Date.parse(message.timestamp);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function compareMessages(left: Message, right: Message): number {
  const timestampDifference = timestampMs(left) - timestampMs(right);
  if (timestampDifference !== 0) return timestampDifference;
  return left.author === right.author ? left.sequence - right.sequence : 0;
}

function latestByTimestamp(messages: Message[]): Message | undefined {
  return messages.reduce<Message | undefined>((latest, message) => {
    if (!latest || compareMessages(message, latest) >= 0) return message;
    return latest;
  }, undefined);
}

function atOrAfter(message: Message, predecessor: Message): boolean {
  return compareMessages(message, predecessor) >= 0;
}

function rejectionReason(content: MessageContent): string {
  const reason = stringField(content, 'reason');
  return reason && REJECTION_REASONS.has(reason) ? reason : 'owner_rejected';
}

function capturedCommand(message: Message): CapturedCommand | null {
  const content = contentOf(message);
  if (!content || normalizedType(content) !== 'assign_task') return null;

  const taskId = stringField(content, 'task_id');
  const taskHash = stringField(content, 'task_hash');
  const offerHash = stringField(content, 'offer_hash');
  const executor = stringField(content, 'executor');
  const assigner = stringField(content, 'assigner');
  const predecessor = stringField(content, 'predecessor');
  const commandId = stringField(content, 'command_id');
  const attemptId = stringField(content, 'attempt_id');
  const expiresAt = stringField(content, 'expires_at');

  if (
    !taskId ||
    !taskHash ||
    !offerHash ||
    !executor ||
    !assigner ||
    !predecessor ||
    !commandId ||
    !attemptId ||
    !expiresAt ||
    message.author !== assigner
  ) {
    return null;
  }

  return {
    message,
    content: {
      type: 'assign_task',
      task_id: taskId,
      task_hash: taskHash,
      offer_hash: offerHash,
      executor,
      assigner,
      predecessor,
      command_id: commandId,
      attempt_id: attemptId,
      expires_at: expiresAt,
    },
  };
}

function commandMatchesSnapshot(command: CapturedCommand, snapshot: AssignmentCommandSnapshot): boolean {
  const content = command.content;
  return (
    command.message.author === snapshot.assigner &&
    content.command_id === snapshot.commandId &&
    content.task_id === snapshot.taskId &&
    content.task_hash === snapshot.taskHash &&
    content.offer_hash === snapshot.offerHash &&
    content.executor === snapshot.executor &&
    content.assigner === snapshot.assigner &&
    content.predecessor === snapshot.offerHash &&
    content.expires_at === snapshot.expiresAt
  );
}

function ownerLifecycleRecord(
  message: Message,
  expectedType: 'task_started' | 'task_result',
  snapshot: AssignmentCommandSnapshot,
): boolean {
  const content = contentOf(message);
  if (!content) return false;
  if (
    normalizedType(content) !== expectedType ||
    stringField(content, 'task_id') !== snapshot.taskId ||
    message.author !== snapshot.executor ||
    stringField(content, 'servitor') !== snapshot.executor
  ) {
    return false;
  }

  return (
    expectedType !== 'task_result' ||
    stringField(content, 'task_hash') === snapshot.taskContentHash
  );
}

function findTaskForOffer(tasks: CapturedTask[], offer: CapturedOffer): CapturedTask | null {
  const offerContent = contentOf(offer.message);
  if (!offerContent) return null;
  const linkedTaskHash = stringField(offerContent, 'task_hash');
  const eligible = tasks.filter((task) => compareMessages(task.message, offer.message) <= 0);

  if (linkedTaskHash) {
    return eligible.find((task) => task.taskHash === linkedTaskHash) ?? null;
  }

  return eligible.reduce<CapturedTask | null>((latest, task) => {
    if (!latest || compareMessages(task.message, latest.message) >= 0) return task;
    return latest;
  }, null);
}

function taskCycleKey(task: CapturedTask): string {
  return `${task.taskId}\u0000${task.taskHash}`;
}

export async function getAssignmentFeedRecords(limit = ASSIGNMENT_FEED_LIMIT): Promise<Message[]> {
  const effectiveLimit = Math.min(ASSIGNMENT_FEED_LIMIT, Math.max(1, Math.trunc(limit)));
  const messageSets = await Promise.all(
    ASSIGNMENT_FEED_TYPES.map((contentType) =>
      getFeed({ include_self: true, content_type: contentType, limit: effectiveLimit }),
    ),
  );

  return Array.from(
    new Map(messageSets.flat().map((message) => [message.hash, message])).values(),
  );
}

export function derivePendingAssignments(messages: Message[]): PendingAssignment[] {
  const chronologically = [...messages].sort(compareMessages);
  const tasksById = new Map<string, CapturedTask[]>();
  const tasksByHash = new Map<string, CapturedTask>();
  const offersByKey = new Map<string, CapturedOffer>();
  const offersByHash = new Map<string, CapturedOffer>();
  const bareAssignments: Message[] = [];
  const taskResults: Message[] = [];
  const commandsByHash = new Map<string, CapturedCommand>();

  for (const message of chronologically) {
    const content = contentOf(message);
    if (!content) continue;
    const type = normalizedType(content);

    if (type === 'task') {
      const taskId = taskIdForTask(content);
      const taskContentHash = stringField(content, 'hash');
      if (!taskId || !taskContentHash) continue;
      const task = {
        message,
        taskId,
        taskHash: message.hash,
        taskContentHash,
        prompt: taskPrompt(content),
      };
      const existing = tasksById.get(taskId) ?? [];
      existing.push(task);
      tasksById.set(taskId, existing);
      tasksByHash.set(message.hash, task);
      continue;
    }

    const taskId = stringField(content, 'task_id');
    if (type === 'task_offer') {
      const servitor = stringField(content, 'servitor');
      if (!taskId || !servitor || message.author !== servitor) continue;
      const offer = { message, taskId, servitor };
      offersByKey.set(`${taskId}\u0000${servitor}`, offer);
      offersByHash.set(message.hash, offer);
      continue;
    }

    if (type === 'task_assign' && taskId) {
      bareAssignments.push(message);
      continue;
    }

    if (type === 'task_result' && taskId) {
      taskResults.push(message);
      continue;
    }

    const command = capturedCommand(message);
    if (command) commandsByHash.set(message.hash, command);
  }

  const legacyAssignedTaskCycles = new Set<string>();
  for (const assignmentMessage of bareAssignments) {
    const assignment = contentOf(assignmentMessage);
    if (!assignment) continue;
    const taskId = stringField(assignment, 'task_id');
    const servitor = stringField(assignment, 'servitor');
    const assignerValue = assignment.assigner;
    if (
      !taskId ||
      !servitor ||
      (assignerValue !== undefined &&
        (typeof assignerValue !== 'string' || assignerValue !== assignmentMessage.author))
    ) {
      continue;
    }

    for (const offer of offersByHash.values()) {
      if (
        offer.taskId !== taskId ||
        offer.servitor !== servitor ||
        !atOrAfter(assignmentMessage, offer.message)
      ) {
        continue;
      }
      const task = findTaskForOffer(tasksById.get(taskId) ?? [], offer);
      if (task && assignmentMessage.author === task.message.author) {
        legacyAssignedTaskCycles.add(taskCycleKey(task));
      }
    }
  }

  const completedTaskCycles = new Set<string>();
  for (const resultMessage of taskResults) {
    const result = contentOf(resultMessage);
    if (!result) continue;
    const taskId = stringField(result, 'task_id');
    const taskContentHash = stringField(result, 'task_hash');
    const servitor = stringField(result, 'servitor');
    if (!taskId || !taskContentHash || !servitor || resultMessage.author !== servitor) continue;

    for (const offer of offersByHash.values()) {
      if (
        offer.taskId !== taskId ||
        offer.servitor !== servitor ||
        !atOrAfter(resultMessage, offer.message)
      ) {
        continue;
      }
      const task = findTaskForOffer(tasksById.get(taskId) ?? [], offer);
      if (task && task.taskContentHash === taskContentHash) {
        completedTaskCycles.add(taskCycleKey(task));
      }
    }
  }

  const acceptedTaskCycles = new Set<string>();
  for (const resultMessage of chronologically) {
    const result = contentOf(resultMessage);
    if (
      !result ||
      normalizedType(result) !== 'assign_task_result' ||
      stringField(result, 'status') !== 'accepted' ||
      stringField(result, 'task_state') !== 'assigned'
    ) {
      continue;
    }

    const lifecycleHash = stringField(result, 'lifecycle_hash');
    const command = lifecycleHash ? commandsByHash.get(lifecycleHash) : undefined;
    if (!command) continue;
    const commandContent = command.content;
    const task = tasksByHash.get(commandContent.task_hash);
    const offer = offersByHash.get(commandContent.offer_hash);
    if (
      resultMessage.author !== commandContent.executor ||
      stringField(result, 'command_id') !== commandContent.command_id ||
      stringField(result, 'task_id') !== commandContent.task_id ||
      commandContent.predecessor !== commandContent.offer_hash ||
      !task ||
      task.taskId !== commandContent.task_id ||
      !offer ||
      offer.taskId !== commandContent.task_id ||
      offer.servitor !== commandContent.executor ||
      compareMessages(task.message, offer.message) > 0
    ) {
      continue;
    }

    acceptedTaskCycles.add(taskCycleKey(task));
  }

  return Array.from(offersByKey.values())
    .flatMap((offer): PendingAssignment[] => {
      const task = findTaskForOffer(tasksById.get(offer.taskId) ?? [], offer);
      if (!task) return [];
      const cycleKey = taskCycleKey(task);
      if (
        legacyAssignedTaskCycles.has(cycleKey) ||
        completedTaskCycles.has(cycleKey) ||
        acceptedTaskCycles.has(cycleKey)
      ) {
        return [];
      }

      return [{
        taskId: task.taskId,
        taskHash: task.taskHash,
        taskContentHash: task.taskContentHash,
        prompt: task.prompt,
        servitor: offer.servitor,
        offerHash: offer.message.hash,
        offeredAt: offer.message.timestamp,
      }];
    })
    .sort((left, right) => Date.parse(right.offeredAt) - Date.parse(left.offeredAt));
}

export function createAssignmentCommandSnapshot(
  pending: PendingAssignment,
  assigner: string,
  commandId: string,
  confirmedAt: Date,
): AssignmentCommandSnapshot {
  return {
    taskId: pending.taskId,
    taskHash: pending.taskHash,
    taskContentHash: pending.taskContentHash,
    offerHash: pending.offerHash,
    executor: pending.servitor,
    assigner,
    commandId,
    expiresAt: new Date(confirmedAt.getTime() + ASSIGNMENT_COMMAND_TTL_MS).toISOString(),
  };
}

export function buildAssignTaskContent(
  snapshot: AssignmentCommandSnapshot,
  attemptId: string,
): AssignTaskContent {
  return {
    type: 'assign_task',
    task_id: snapshot.taskId,
    task_hash: snapshot.taskHash,
    offer_hash: snapshot.offerHash,
    executor: snapshot.executor,
    assigner: snapshot.assigner,
    predecessor: snapshot.offerHash,
    command_id: snapshot.commandId,
    attempt_id: attemptId,
    expires_at: snapshot.expiresAt,
  };
}

export async function publishAssignmentCommand(content: AssignTaskContent): Promise<void> {
  const response = await apiPost<unknown>('/v1/publish', {
    content,
    tags: ['assign_task'],
  });

  if (!response.success) {
    const error = response.error;
    throw new Error(error ? `${error.code}: ${error.message}` : 'Failed to publish assignment command');
  }
}

export function createEmittedAssignment(
  snapshot: AssignmentCommandSnapshot,
  attemptId: string,
  sentAt: Date,
): EmittedAssignment {
  return {
    snapshot,
    attemptId,
    lastSentAt: sentAt.toISOString(),
    status: 'awaiting_owner',
  };
}

export function retryEmittedAssignment(
  assignment: EmittedAssignment,
  attemptId: string,
  sentAt: Date,
): EmittedAssignment {
  return {
    ...assignment,
    attemptId,
    lastSentAt: sentAt.toISOString(),
    status: 'awaiting_owner',
    reason: undefined,
  };
}

export function isTaskAssignmentBlocked(
  taskId: string,
  assignments: EmittedAssignment[],
): boolean {
  return assignments.some(
    (assignment) =>
      assignment.snapshot.taskId === taskId && BLOCKING_STATUSES.has(assignment.status),
  );
}

export function isAssignmentRetryDisabled(
  sending: boolean,
  expiresAt: string,
  nowMs: number,
): boolean {
  return sending || nowMs >= Date.parse(expiresAt);
}

export function reconcileAssignment(
  assignment: EmittedAssignment,
  messages: Message[],
  now: Date,
): EmittedAssignment {
  if (assignment.status === 'completed' || assignment.status === 'rejected') {
    return assignment;
  }

  const commandsByHash = new Map<string, CapturedCommand>();
  for (const message of messages) {
    const command = capturedCommand(message);
    if (command) commandsByHash.set(message.hash, command);
  }

  const ownerResults = messages.filter((message) => {
    const content = contentOf(message);
    if (
      !content ||
      normalizedType(content) !== 'assign_task_result' ||
      stringField(content, 'command_id') !== assignment.snapshot.commandId ||
      stringField(content, 'task_id') !== assignment.snapshot.taskId ||
      message.author !== assignment.snapshot.executor
    ) {
      return false;
    }

    const status = stringField(content, 'status');
    if (status === 'rejected' || status === 'superseded') return true;
    if (status !== 'accepted' || stringField(content, 'task_state') !== 'assigned') return false;

    const lifecycleHash = stringField(content, 'lifecycle_hash');
    const command = lifecycleHash ? commandsByHash.get(lifecycleHash) : undefined;
    return command !== undefined && commandMatchesSnapshot(command, assignment.snapshot);
  });
  const ownerResult = latestByTimestamp(ownerResults);

  if (ownerResult) {
    const content = contentOf(ownerResult);
    if (content) {
      const resultStatus = stringField(content, 'status');
      if (resultStatus === 'rejected' || resultStatus === 'superseded') {
        return {
          ...assignment,
          status: 'rejected',
          reason: rejectionReason(content),
        };
      }

      if (resultStatus === 'accepted') {
        const completed = messages.some(
          (message) =>
            ownerLifecycleRecord(message, 'task_result', assignment.snapshot) &&
            atOrAfter(message, ownerResult),
        );
        if (completed) {
          return { ...assignment, status: 'completed', reason: undefined };
        }

        const started = messages.some(
          (message) =>
            ownerLifecycleRecord(message, 'task_started', assignment.snapshot) &&
            atOrAfter(message, ownerResult),
        );
        return {
          ...assignment,
          status: started || assignment.status === 'executing' ? 'executing' : 'accepted',
          reason: undefined,
        };
      }
    }
  }

  if (assignment.status === 'accepted' || assignment.status === 'executing') {
    return assignment;
  }

  const lastSentAt = Date.parse(assignment.lastSentAt);
  if (Number.isFinite(lastSentAt) && now.getTime() - lastSentAt >= ASSIGNMENT_RESULT_TIMEOUT_MS) {
    return { ...assignment, status: 'unknown', reason: undefined };
  }

  return assignment;
}
