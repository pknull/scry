import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  Message,
  TaskContent,
  TaskOfferContent,
  TaskAssignContent,
  TaskStartedContent,
  TaskStatusContent,
  TaskFailedContent,
  TaskOfferWithdrawContent,
  TaskResultContent,
} from './types';

// We need to mock the feed module before importing the tasks module
vi.mock('./feed', () => ({
  getFeed: vi.fn(),
  publishMessage: vi.fn(),
}));

// Import after mocking
import {
  getTaskRecords,
  getPendingTasks,
  getActiveTasks,
  getTaskEtaSeconds,
  getTaskProgress,
  getTaskStatusMessage,
  type TaskRecord,
} from './tasks';
import { getFeed } from './feed';

const mockedGetFeed = vi.mocked(getFeed);

// Helper to create base message structure
function createMessage<T extends { type: string }>(
  content: T,
  overrides: Partial<Message<T>> = {}
): Message<T> {
  return {
    hash: `hash-${Math.random().toString(36).slice(2)}`,
    author: 'author-1',
    sequence: 1,
    timestamp: new Date().toISOString(),
    previous: null,
    content,
    signature: 'sig',
    ...overrides,
  };
}

function createTaskContent(overrides: Partial<TaskContent> = {}): TaskContent {
  return {
    type: 'task',
    hash: 'task-hash-1',
    prompt: 'Do something',
    ...overrides,
  };
}

function createTaskOfferContent(
  taskId: string,
  servitor: string,
  overrides: Partial<TaskOfferContent> = {}
): TaskOfferContent {
  return {
    type: 'task_offer',
    task_id: taskId,
    servitor,
    capabilities: ['cap1'],
    ttl_seconds: 300,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function createTaskAssignContent(
  taskId: string,
  servitor: string,
  overrides: Partial<TaskAssignContent> = {}
): TaskAssignContent {
  return {
    type: 'task_assign',
    task_id: taskId,
    servitor,
    ...overrides,
  };
}

function createTaskStartedContent(
  taskId: string,
  servitor: string,
  overrides: Partial<TaskStartedContent> = {}
): TaskStartedContent {
  return {
    type: 'task_started',
    task_id: taskId,
    servitor,
    eta_seconds: 60,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function createTaskStatusContent(
  taskId: string,
  servitor: string,
  overrides: Partial<TaskStatusContent> = {}
): TaskStatusContent {
  return {
    type: 'task_status',
    task_id: taskId,
    servitor,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function createTaskFailedContent(
  taskId: string,
  servitor: string,
  overrides: Partial<TaskFailedContent> = {}
): TaskFailedContent {
  return {
    type: 'task_failed',
    task_id: taskId,
    servitor,
    reason: 'execution_error',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function createTaskOfferWithdrawContent(
  taskId: string,
  servitor: string,
  overrides: Partial<TaskOfferWithdrawContent> = {}
): TaskOfferWithdrawContent {
  return {
    type: 'task_offer_withdraw',
    task_id: taskId,
    servitor,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function createTaskResultContent(
  taskId: string,
  servitor: string,
  taskHash: string,
  overrides: Partial<TaskResultContent> = {}
): TaskResultContent {
  return {
    type: 'task_result',
    task_id: taskId,
    servitor,
    correlation_id: 'corr-1',
    task_hash: taskHash,
    result_hash: 'result-hash-1',
    status: 'success',
    attestation: {
      servitor_id: servitor,
      signature: 'sig',
      timestamp: new Date().toISOString(),
    },
    ...overrides,
  };
}

describe('getTaskRecords', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when no messages exist', async () => {
    mockedGetFeed.mockResolvedValue([]);

    const result = await getTaskRecords();

    expect(result).toEqual([]);
  });

  it('aggregates a single task with no lifecycle events', async () => {
    const taskContent = createTaskContent({ id: 'task-1', hash: 'task-hash-1' });
    const taskMessage = createMessage(taskContent, {
      hash: 'msg-1',
      timestamp: '2024-01-01T10:00:00Z',
    });

    mockedGetFeed.mockImplementation(async (params) => {
      if (params?.content_type === 'task') return [taskMessage];
      return [];
    });

    const result = await getTaskRecords();

    expect(result).toHaveLength(1);
    expect(result[0].taskId).toBe('task-1');
    expect(result[0].taskHash).toBe('task-hash-1');
    expect(result[0].task).toBeDefined();
    expect(result[0].offers).toEqual([]);
    expect(result[0].assignment).toBeUndefined();
    expect(result[0].result).toBeUndefined();
  });

  it('aggregates task with multiple offers', async () => {
    const taskContent = createTaskContent({ id: 'task-1', hash: 'hash-1' });
    const offer1 = createTaskOfferContent('task-1', 'servitor-a');
    const offer2 = createTaskOfferContent('task-1', 'servitor-b');

    mockedGetFeed.mockImplementation(async (params) => {
      if (params?.content_type === 'task')
        return [createMessage(taskContent, { timestamp: '2024-01-01T10:00:00Z' })];
      if (params?.content_type === 'task_offer')
        return [
          createMessage(offer1, { timestamp: '2024-01-01T10:01:00Z' }),
          createMessage(offer2, { timestamp: '2024-01-01T10:02:00Z' }),
        ];
      return [];
    });

    const result = await getTaskRecords();

    expect(result).toHaveLength(1);
    expect(result[0].offers).toHaveLength(2);
  });

  it('removes offer when withdraw is received', async () => {
    const taskContent = createTaskContent({ id: 'task-1', hash: 'hash-1' });
    const offer = createTaskOfferContent('task-1', 'servitor-a');
    const withdraw = createTaskOfferWithdrawContent('task-1', 'servitor-a');

    mockedGetFeed.mockImplementation(async (params) => {
      if (params?.content_type === 'task')
        return [createMessage(taskContent, { timestamp: '2024-01-01T10:00:00Z' })];
      if (params?.content_type === 'task_offer')
        return [createMessage(offer, { timestamp: '2024-01-01T10:01:00Z' })];
      if (params?.content_type === 'task_offer_withdraw')
        return [createMessage(withdraw, { timestamp: '2024-01-01T10:02:00Z' })];
      return [];
    });

    const result = await getTaskRecords();

    expect(result).toHaveLength(1);
    expect(result[0].offers).toHaveLength(0);
  });

  it('tracks assignment', async () => {
    const taskContent = createTaskContent({ id: 'task-1', hash: 'hash-1' });
    const assign = createTaskAssignContent('task-1', 'servitor-a');

    mockedGetFeed.mockImplementation(async (params) => {
      if (params?.content_type === 'task')
        return [createMessage(taskContent, { timestamp: '2024-01-01T10:00:00Z' })];
      if (params?.content_type === 'task_assign')
        return [createMessage(assign, { timestamp: '2024-01-01T10:01:00Z' })];
      return [];
    });

    const result = await getTaskRecords();

    expect(result).toHaveLength(1);
    expect(result[0].assignment).toBeDefined();
    expect(result[0].assignment?.content.servitor).toBe('servitor-a');
  });

  it('tracks started event', async () => {
    const taskContent = createTaskContent({ id: 'task-1', hash: 'hash-1' });
    const started = createTaskStartedContent('task-1', 'servitor-a', { eta_seconds: 120 });

    mockedGetFeed.mockImplementation(async (params) => {
      if (params?.content_type === 'task')
        return [createMessage(taskContent, { timestamp: '2024-01-01T10:00:00Z' })];
      if (params?.content_type === 'task_started')
        return [createMessage(started, { timestamp: '2024-01-01T10:01:00Z' })];
      return [];
    });

    const result = await getTaskRecords();

    expect(result).toHaveLength(1);
    expect(result[0].started).toBeDefined();
    expect(result[0].started?.content.eta_seconds).toBe(120);
  });

  it('tracks latest status update', async () => {
    const taskContent = createTaskContent({ id: 'task-1', hash: 'hash-1' });
    const status1 = createTaskStatusContent('task-1', 'servitor-a', {
      progress_pct: 25,
      message: 'Starting...',
    });
    const status2 = createTaskStatusContent('task-1', 'servitor-a', {
      progress_pct: 75,
      message: 'Almost done...',
    });

    mockedGetFeed.mockImplementation(async (params) => {
      if (params?.content_type === 'task')
        return [createMessage(taskContent, { timestamp: '2024-01-01T10:00:00Z' })];
      if (params?.content_type === 'task_status')
        return [
          createMessage(status1, { timestamp: '2024-01-01T10:01:00Z' }),
          createMessage(status2, { timestamp: '2024-01-01T10:02:00Z' }),
        ];
      return [];
    });

    const result = await getTaskRecords();

    expect(result).toHaveLength(1);
    // Latest status should be status2 (processed second)
    expect(result[0].latestStatus?.content.progress_pct).toBe(75);
    expect(result[0].latestStatus?.content.message).toBe('Almost done...');
  });

  it('tracks failure event', async () => {
    const taskContent = createTaskContent({ id: 'task-1', hash: 'hash-1' });
    const failed = createTaskFailedContent('task-1', 'servitor-a', {
      reason: 'timeout',
      details: 'Timed out after 60 seconds',
    });

    mockedGetFeed.mockImplementation(async (params) => {
      if (params?.content_type === 'task')
        return [createMessage(taskContent, { timestamp: '2024-01-01T10:00:00Z' })];
      if (params?.content_type === 'task_failed')
        return [createMessage(failed, { timestamp: '2024-01-01T10:01:00Z' })];
      return [];
    });

    const result = await getTaskRecords();

    expect(result).toHaveLength(1);
    expect(result[0].failure).toBeDefined();
    expect(result[0].failure?.content.reason).toBe('timeout');
  });

  it('tracks result event', async () => {
    const taskContent = createTaskContent({ id: 'task-1', hash: 'task-hash-1' });
    const taskResult = createTaskResultContent('task-1', 'servitor-a', 'task-hash-1', {
      status: 'success',
      result: { data: 'some result' },
    });

    mockedGetFeed.mockImplementation(async (params) => {
      if (params?.content_type === 'task')
        return [createMessage(taskContent, { timestamp: '2024-01-01T10:00:00Z' })];
      if (params?.content_type === 'task_result')
        return [createMessage(taskResult, { timestamp: '2024-01-01T10:01:00Z' })];
      return [];
    });

    const result = await getTaskRecords();

    expect(result).toHaveLength(1);
    expect(result[0].result).toBeDefined();
    expect(result[0].result?.content.status).toBe('success');
  });

  it('deduplicates messages by hash', async () => {
    const taskContent = createTaskContent({ id: 'task-1', hash: 'hash-1' });
    const taskMessage = createMessage(taskContent, {
      hash: 'duplicate-hash',
      timestamp: '2024-01-01T10:00:00Z',
    });

    // Same message returned from multiple content type queries
    mockedGetFeed.mockImplementation(async (params) => {
      if (params?.content_type === 'task') return [taskMessage, taskMessage];
      return [];
    });

    const result = await getTaskRecords();

    expect(result).toHaveLength(1);
  });

  it('sorts tasks by createdAt descending (newest first)', async () => {
    const task1 = createTaskContent({ id: 'task-1', hash: 'hash-1' });
    const task2 = createTaskContent({ id: 'task-2', hash: 'hash-2' });

    mockedGetFeed.mockImplementation(async (params) => {
      if (params?.content_type === 'task')
        return [
          createMessage(task1, { timestamp: '2024-01-01T10:00:00Z' }),
          createMessage(task2, { timestamp: '2024-01-02T10:00:00Z' }),
        ];
      return [];
    });

    const result = await getTaskRecords();

    expect(result).toHaveLength(2);
    expect(result[0].taskId).toBe('task-2'); // newer
    expect(result[1].taskId).toBe('task-1'); // older
  });

  it('creates task accumulator from lifecycle event when task message not present', async () => {
    // Only an assignment exists, no task message
    const assign = createTaskAssignContent('orphan-task', 'servitor-a');

    mockedGetFeed.mockImplementation(async (params) => {
      if (params?.content_type === 'task_assign')
        return [createMessage(assign, { timestamp: '2024-01-01T10:00:00Z' })];
      return [];
    });

    const result = await getTaskRecords();

    expect(result).toHaveLength(1);
    expect(result[0].taskId).toBe('orphan-task');
    expect(result[0].task).toBeUndefined();
    expect(result[0].assignment).toBeDefined();
  });

  it('uses task id from content.id when available', async () => {
    const taskContent = createTaskContent({ id: 'explicit-id', hash: 'hash-1' });

    mockedGetFeed.mockImplementation(async (params) => {
      if (params?.content_type === 'task')
        return [createMessage(taskContent, { timestamp: '2024-01-01T10:00:00Z' })];
      return [];
    });

    const result = await getTaskRecords();

    expect(result[0].taskId).toBe('explicit-id');
  });

  it('falls back to content.hash when id is not present', async () => {
    const taskContent = createTaskContent({ hash: 'content-hash' });
    // Remove the id field
    delete (taskContent as Partial<TaskContent>).id;

    mockedGetFeed.mockImplementation(async (params) => {
      if (params?.content_type === 'task')
        return [createMessage(taskContent, { timestamp: '2024-01-01T10:00:00Z' })];
      return [];
    });

    const result = await getTaskRecords();

    expect(result[0].taskId).toBe('content-hash');
  });

  it('updates taskHash from task_result event', async () => {
    // Task result arrives referencing a task we haven't seen yet
    const taskResult = createTaskResultContent('task-1', 'servitor-a', 'actual-task-hash');

    mockedGetFeed.mockImplementation(async (params) => {
      if (params?.content_type === 'task_result')
        return [createMessage(taskResult, { timestamp: '2024-01-01T10:00:00Z' })];
      return [];
    });

    const result = await getTaskRecords();

    expect(result[0].taskHash).toBe('actual-task-hash');
  });

  it('sorts offers by timestamp descending (newest first)', async () => {
    const taskContent = createTaskContent({ id: 'task-1', hash: 'hash-1' });
    const offer1 = createTaskOfferContent('task-1', 'servitor-a');
    const offer2 = createTaskOfferContent('task-1', 'servitor-b');

    mockedGetFeed.mockImplementation(async (params) => {
      if (params?.content_type === 'task')
        return [createMessage(taskContent, { timestamp: '2024-01-01T10:00:00Z' })];
      if (params?.content_type === 'task_offer')
        return [
          createMessage(offer1, { timestamp: '2024-01-01T10:01:00Z' }),
          createMessage(offer2, { timestamp: '2024-01-01T10:05:00Z' }),
        ];
      return [];
    });

    const result = await getTaskRecords();

    // servitor-b's offer is newer, should be first
    expect(result[0].offers[0].content.servitor).toBe('servitor-b');
    expect(result[0].offers[1].content.servitor).toBe('servitor-a');
  });

  it('handles complete task lifecycle', async () => {
    const taskId = 'full-lifecycle-task';
    const servitor = 'servitor-a';
    const taskHash = 'task-hash-full';

    const task = createTaskContent({ id: taskId, hash: taskHash });
    const offer = createTaskOfferContent(taskId, servitor);
    const assign = createTaskAssignContent(taskId, servitor);
    const started = createTaskStartedContent(taskId, servitor, { eta_seconds: 60 });
    const status = createTaskStatusContent(taskId, servitor, { progress_pct: 50 });
    const result = createTaskResultContent(taskId, servitor, taskHash);

    mockedGetFeed.mockImplementation(async (params) => {
      if (params?.content_type === 'task')
        return [createMessage(task, { timestamp: '2024-01-01T10:00:00Z' })];
      if (params?.content_type === 'task_offer')
        return [createMessage(offer, { timestamp: '2024-01-01T10:01:00Z' })];
      if (params?.content_type === 'task_assign')
        return [createMessage(assign, { timestamp: '2024-01-01T10:02:00Z' })];
      if (params?.content_type === 'task_started')
        return [createMessage(started, { timestamp: '2024-01-01T10:03:00Z' })];
      if (params?.content_type === 'task_status')
        return [createMessage(status, { timestamp: '2024-01-01T10:04:00Z' })];
      if (params?.content_type === 'task_result')
        return [createMessage(result, { timestamp: '2024-01-01T10:05:00Z' })];
      return [];
    });

    const records = await getTaskRecords();

    expect(records).toHaveLength(1);
    const record = records[0];
    expect(record.taskId).toBe(taskId);
    expect(record.taskHash).toBe(taskHash);
    expect(record.task).toBeDefined();
    expect(record.offers).toHaveLength(1);
    expect(record.assignment).toBeDefined();
    expect(record.started).toBeDefined();
    expect(record.latestStatus).toBeDefined();
    expect(record.result).toBeDefined();
    expect(record.failure).toBeUndefined();
  });
});

describe('getPendingTasks', () => {
  it('returns tasks with task message but no assignment or terminal state', () => {
    const tasks: TaskRecord[] = [
      {
        taskId: 'pending-1',
        taskHash: 'hash-1',
        createdAt: '2024-01-01T10:00:00Z',
        task: createMessage(createTaskContent({ id: 'pending-1' })),
        offers: [],
      },
      {
        taskId: 'assigned-1',
        taskHash: 'hash-2',
        createdAt: '2024-01-01T10:00:00Z',
        task: createMessage(createTaskContent({ id: 'assigned-1' })),
        offers: [],
        assignment: createMessage(createTaskAssignContent('assigned-1', 'servitor-a')),
      },
      {
        taskId: 'completed-1',
        taskHash: 'hash-3',
        createdAt: '2024-01-01T10:00:00Z',
        task: createMessage(createTaskContent({ id: 'completed-1' })),
        offers: [],
        result: createMessage(
          createTaskResultContent('completed-1', 'servitor-a', 'hash-3')
        ),
      },
    ];

    const result = getPendingTasks(tasks);

    expect(result).toHaveLength(1);
    expect(result[0].taskId).toBe('pending-1');
  });

  it('excludes tasks without task message', () => {
    const tasks: TaskRecord[] = [
      {
        taskId: 'orphan-1',
        taskHash: 'hash-1',
        createdAt: '2024-01-01T10:00:00Z',
        offers: [],
        // No task message
      },
    ];

    const result = getPendingTasks(tasks);

    expect(result).toHaveLength(0);
  });

  it('excludes failed tasks', () => {
    const tasks: TaskRecord[] = [
      {
        taskId: 'failed-1',
        taskHash: 'hash-1',
        createdAt: '2024-01-01T10:00:00Z',
        task: createMessage(createTaskContent({ id: 'failed-1' })),
        offers: [],
        failure: createMessage(createTaskFailedContent('failed-1', 'servitor-a')),
      },
    ];

    const result = getPendingTasks(tasks);

    expect(result).toHaveLength(0);
  });
});

describe('getActiveTasks', () => {
  it('returns tasks that are assigned but not completed', () => {
    const tasks: TaskRecord[] = [
      {
        taskId: 'active-1',
        taskHash: 'hash-1',
        createdAt: '2024-01-01T10:00:00Z',
        task: createMessage(createTaskContent({ id: 'active-1' })),
        offers: [],
        assignment: createMessage(createTaskAssignContent('active-1', 'servitor-a')),
      },
      {
        taskId: 'pending-1',
        taskHash: 'hash-2',
        createdAt: '2024-01-01T10:00:00Z',
        task: createMessage(createTaskContent({ id: 'pending-1' })),
        offers: [],
      },
    ];

    const result = getActiveTasks(tasks);

    expect(result).toHaveLength(1);
    expect(result[0].taskId).toBe('active-1');
  });

  it('returns tasks that are started but not assigned explicitly', () => {
    const tasks: TaskRecord[] = [
      {
        taskId: 'started-1',
        taskHash: 'hash-1',
        createdAt: '2024-01-01T10:00:00Z',
        task: createMessage(createTaskContent({ id: 'started-1' })),
        offers: [],
        started: createMessage(createTaskStartedContent('started-1', 'servitor-a')),
      },
    ];

    const result = getActiveTasks(tasks);

    expect(result).toHaveLength(1);
    expect(result[0].taskId).toBe('started-1');
  });

  it('excludes completed tasks', () => {
    const tasks: TaskRecord[] = [
      {
        taskId: 'completed-1',
        taskHash: 'hash-1',
        createdAt: '2024-01-01T10:00:00Z',
        task: createMessage(createTaskContent({ id: 'completed-1' })),
        offers: [],
        assignment: createMessage(createTaskAssignContent('completed-1', 'servitor-a')),
        result: createMessage(
          createTaskResultContent('completed-1', 'servitor-a', 'hash-1')
        ),
      },
    ];

    const result = getActiveTasks(tasks);

    expect(result).toHaveLength(0);
  });

  it('excludes failed tasks', () => {
    const tasks: TaskRecord[] = [
      {
        taskId: 'failed-1',
        taskHash: 'hash-1',
        createdAt: '2024-01-01T10:00:00Z',
        task: createMessage(createTaskContent({ id: 'failed-1' })),
        offers: [],
        assignment: createMessage(createTaskAssignContent('failed-1', 'servitor-a')),
        failure: createMessage(createTaskFailedContent('failed-1', 'servitor-a')),
      },
    ];

    const result = getActiveTasks(tasks);

    expect(result).toHaveLength(0);
  });
});

describe('getTaskEtaSeconds', () => {
  it('returns revised ETA from latest status when available', () => {
    const task: TaskRecord = {
      taskId: 'task-1',
      taskHash: 'hash-1',
      createdAt: '2024-01-01T10:00:00Z',
      offers: [],
      started: createMessage(
        createTaskStartedContent('task-1', 'servitor-a', { eta_seconds: 60 })
      ),
      latestStatus: createMessage(
        createTaskStatusContent('task-1', 'servitor-a', { revised_eta_seconds: 30 })
      ),
    };

    const result = getTaskEtaSeconds(task);

    expect(result).toBe(30);
  });

  it('returns started ETA when no status update', () => {
    const task: TaskRecord = {
      taskId: 'task-1',
      taskHash: 'hash-1',
      createdAt: '2024-01-01T10:00:00Z',
      offers: [],
      started: createMessage(
        createTaskStartedContent('task-1', 'servitor-a', { eta_seconds: 120 })
      ),
    };

    const result = getTaskEtaSeconds(task);

    expect(result).toBe(120);
  });

  it('returns null when no ETA information', () => {
    const task: TaskRecord = {
      taskId: 'task-1',
      taskHash: 'hash-1',
      createdAt: '2024-01-01T10:00:00Z',
      offers: [],
    };

    const result = getTaskEtaSeconds(task);

    expect(result).toBeNull();
  });

  it('returns started ETA when status has no revised ETA', () => {
    const task: TaskRecord = {
      taskId: 'task-1',
      taskHash: 'hash-1',
      createdAt: '2024-01-01T10:00:00Z',
      offers: [],
      started: createMessage(
        createTaskStartedContent('task-1', 'servitor-a', { eta_seconds: 60 })
      ),
      latestStatus: createMessage(
        createTaskStatusContent('task-1', 'servitor-a', { progress_pct: 50 })
      ),
    };

    const result = getTaskEtaSeconds(task);

    expect(result).toBe(60);
  });
});

describe('getTaskProgress', () => {
  it('returns progress from latest status', () => {
    const task: TaskRecord = {
      taskId: 'task-1',
      taskHash: 'hash-1',
      createdAt: '2024-01-01T10:00:00Z',
      offers: [],
      latestStatus: createMessage(
        createTaskStatusContent('task-1', 'servitor-a', { progress_pct: 75 })
      ),
    };

    const result = getTaskProgress(task);

    expect(result).toBe(75);
  });

  it('returns null when no status', () => {
    const task: TaskRecord = {
      taskId: 'task-1',
      taskHash: 'hash-1',
      createdAt: '2024-01-01T10:00:00Z',
      offers: [],
    };

    const result = getTaskProgress(task);

    expect(result).toBeNull();
  });

  it('returns null when status has no progress', () => {
    const task: TaskRecord = {
      taskId: 'task-1',
      taskHash: 'hash-1',
      createdAt: '2024-01-01T10:00:00Z',
      offers: [],
      latestStatus: createMessage(
        createTaskStatusContent('task-1', 'servitor-a', { message: 'Working...' })
      ),
    };

    const result = getTaskProgress(task);

    expect(result).toBeNull();
  });
});

describe('getTaskStatusMessage', () => {
  it('returns message from latest status', () => {
    const task: TaskRecord = {
      taskId: 'task-1',
      taskHash: 'hash-1',
      createdAt: '2024-01-01T10:00:00Z',
      offers: [],
      latestStatus: createMessage(
        createTaskStatusContent('task-1', 'servitor-a', { message: 'Processing data...' })
      ),
    };

    const result = getTaskStatusMessage(task);

    expect(result).toBe('Processing data...');
  });

  it('returns null when no status', () => {
    const task: TaskRecord = {
      taskId: 'task-1',
      taskHash: 'hash-1',
      createdAt: '2024-01-01T10:00:00Z',
      offers: [],
    };

    const result = getTaskStatusMessage(task);

    expect(result).toBeNull();
  });

  it('returns null when status has no message', () => {
    const task: TaskRecord = {
      taskId: 'task-1',
      taskHash: 'hash-1',
      createdAt: '2024-01-01T10:00:00Z',
      offers: [],
      latestStatus: createMessage(
        createTaskStatusContent('task-1', 'servitor-a', { progress_pct: 50 })
      ),
    };

    const result = getTaskStatusMessage(task);

    expect(result).toBeNull();
  });
});
