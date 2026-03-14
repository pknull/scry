import { getFeed, publishMessage } from './feed';
import type {
  Message,
  MessageContent,
  TaskAssignContent,
  TaskContent,
  TaskFailedContent,
  TaskOfferContent,
  TaskOfferWithdrawContent,
  TaskResultContent,
  TaskStartedContent,
  TaskStatusContent,
} from './types';

type TaskLifecycleContent =
  | TaskContent
  | TaskOfferContent
  | TaskAssignContent
  | TaskStartedContent
  | TaskStatusContent
  | TaskFailedContent
  | TaskOfferWithdrawContent
  | TaskResultContent;

type TaskEventMessage<T extends TaskLifecycleContent> = Message<T>;

interface TaskAccumulator {
  taskId: string;
  taskHash: string;
  createdAt: string;
  task?: TaskEventMessage<TaskContent>;
  offerMap: Map<string, TaskEventMessage<TaskOfferContent>>;
  assignment?: TaskEventMessage<TaskAssignContent>;
  started?: TaskEventMessage<TaskStartedContent>;
  latestStatus?: TaskEventMessage<TaskStatusContent>;
  failure?: TaskEventMessage<TaskFailedContent>;
  result?: TaskEventMessage<TaskResultContent>;
}

export interface TaskRecord {
  taskId: string;
  taskHash: string;
  createdAt: string;
  task?: TaskEventMessage<TaskContent>;
  offers: TaskEventMessage<TaskOfferContent>[];
  assignment?: TaskEventMessage<TaskAssignContent>;
  started?: TaskEventMessage<TaskStartedContent>;
  latestStatus?: TaskEventMessage<TaskStatusContent>;
  failure?: TaskEventMessage<TaskFailedContent>;
  result?: TaskEventMessage<TaskResultContent>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isTaskContent(content: MessageContent): content is TaskContent {
  return content.type === 'task' && typeof content.hash === 'string' && typeof content.prompt === 'string';
}

function isTaskOfferContent(content: MessageContent): content is TaskOfferContent {
  return content.type === 'task_offer' && typeof content.task_id === 'string' && typeof content.servitor === 'string';
}

function isTaskAssignContent(content: MessageContent): content is TaskAssignContent {
  return content.type === 'task_assign' && typeof content.task_id === 'string' && typeof content.servitor === 'string';
}

function isTaskStartedContent(content: MessageContent): content is TaskStartedContent {
  return content.type === 'task_started' && typeof content.task_id === 'string' && typeof content.servitor === 'string';
}

function isTaskStatusContent(content: MessageContent): content is TaskStatusContent {
  return content.type === 'task_status' && typeof content.task_id === 'string' && typeof content.servitor === 'string';
}

function isTaskFailedContent(content: MessageContent): content is TaskFailedContent {
  return content.type === 'task_failed' && typeof content.task_id === 'string' && typeof content.servitor === 'string';
}

function isTaskOfferWithdrawContent(content: MessageContent): content is TaskOfferWithdrawContent {
  return content.type === 'task_offer_withdraw' && typeof content.task_id === 'string' && typeof content.servitor === 'string';
}

function isTaskResultContent(content: MessageContent): content is TaskResultContent {
  return (
    content.type === 'task_result' &&
    typeof content.task_id === 'string' &&
    typeof content.servitor === 'string' &&
    typeof content.task_hash === 'string'
  );
}

function getOrCreateTask(accumulators: Map<string, TaskAccumulator>, taskId: string, fallbackHash?: string, createdAt?: string) {
  let accumulator = accumulators.get(taskId);
  if (!accumulator) {
    accumulator = {
      taskId,
      taskHash: fallbackHash ?? taskId,
      createdAt: createdAt ?? new Date(0).toISOString(),
      offerMap: new Map(),
    };
    accumulators.set(taskId, accumulator);
  }

  if (fallbackHash && accumulator.taskHash === accumulator.taskId) {
    accumulator.taskHash = fallbackHash;
  }
  if (createdAt && (accumulator.createdAt === new Date(0).toISOString() || createdAt < accumulator.createdAt)) {
    accumulator.createdAt = createdAt;
  }

  return accumulator;
}

export async function getTaskRecords(limit = 500): Promise<TaskRecord[]> {
  const messages = await getFeed({ include_self: true, limit });
  const taskMessages = messages
    .filter((message) => isObject(message.content))
    .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());

  const accumulators = new Map<string, TaskAccumulator>();

  for (const message of taskMessages) {
    const content = message.content;

    if (isTaskContent(content)) {
      const taskId = content.id ?? content.hash ?? message.hash;
      const accumulator = getOrCreateTask(accumulators, taskId, content.hash ?? message.hash, message.timestamp);
      accumulator.task = message as TaskEventMessage<TaskContent>;
      accumulator.taskHash = content.hash ?? message.hash;
      accumulator.createdAt = message.timestamp;
      continue;
    }

    if (isTaskOfferContent(content)) {
      const accumulator = getOrCreateTask(accumulators, content.task_id, undefined, message.timestamp);
      accumulator.offerMap.set(content.servitor, message as TaskEventMessage<TaskOfferContent>);
      continue;
    }

    if (isTaskOfferWithdrawContent(content)) {
      const accumulator = getOrCreateTask(accumulators, content.task_id, undefined, message.timestamp);
      accumulator.offerMap.delete(content.servitor);
      continue;
    }

    if (isTaskAssignContent(content)) {
      const accumulator = getOrCreateTask(accumulators, content.task_id, undefined, message.timestamp);
      accumulator.assignment = message as TaskEventMessage<TaskAssignContent>;
      continue;
    }

    if (isTaskStartedContent(content)) {
      const accumulator = getOrCreateTask(accumulators, content.task_id, undefined, message.timestamp);
      accumulator.started = message as TaskEventMessage<TaskStartedContent>;
      continue;
    }

    if (isTaskStatusContent(content)) {
      const accumulator = getOrCreateTask(accumulators, content.task_id, undefined, message.timestamp);
      accumulator.latestStatus = message as TaskEventMessage<TaskStatusContent>;
      continue;
    }

    if (isTaskFailedContent(content)) {
      const accumulator = getOrCreateTask(accumulators, content.task_id, undefined, message.timestamp);
      accumulator.failure = message as TaskEventMessage<TaskFailedContent>;
      continue;
    }

    if (isTaskResultContent(content)) {
      const accumulator = getOrCreateTask(accumulators, content.task_id, content.task_hash, message.timestamp);
      accumulator.result = message as TaskEventMessage<TaskResultContent>;
    }
  }

  return Array.from(accumulators.values())
    .map((accumulator) => ({
      taskId: accumulator.taskId,
      taskHash: accumulator.taskHash,
      createdAt: accumulator.createdAt,
      task: accumulator.task,
      offers: Array.from(accumulator.offerMap.values()).sort(
        (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
      ),
      assignment: accumulator.assignment,
      started: accumulator.started,
      latestStatus: accumulator.latestStatus,
      failure: accumulator.failure,
      result: accumulator.result,
    }))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

export function getPendingTasks(tasks: TaskRecord[]): TaskRecord[] {
  return tasks.filter((task) => task.task && !task.assignment && !task.result && !task.failure);
}

export function getActiveTasks(tasks: TaskRecord[]): TaskRecord[] {
  return tasks.filter((task) => !task.result && !task.failure && (task.assignment || task.started));
}

export function getTaskEtaSeconds(task: TaskRecord): number | null {
  return task.latestStatus?.content.revised_eta_seconds ?? task.started?.content.eta_seconds ?? null;
}

export function getTaskProgress(task: TaskRecord): number | null {
  return task.latestStatus?.content.progress_pct ?? null;
}

export function getTaskStatusMessage(task: TaskRecord): string | null {
  return task.latestStatus?.content.message ?? null;
}

export async function publishTaskAssign(taskId: string, servitor: string, assigner?: string) {
  return publishMessage({
    content: {
      type: 'task_assign',
      task_id: taskId,
      servitor,
      ...(assigner ? { assigner } : {}),
    },
  });
}
