import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Message, MessageContent } from './types';

vi.mock('./feed', () => ({
  getFeed: vi.fn(),
}));
vi.mock('./client', () => ({
  apiPost: vi.fn(),
}));

import { apiPost } from './client';
import { getFeed } from './feed';
import {
  ASSIGNMENT_COMMAND_TTL_MS,
  ASSIGNMENT_RESULT_TIMEOUT_MS,
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
  type EmittedAssignment,
} from './assignments';

const NOW = new Date('2026-08-14T12:00:00.000Z');
const mockedGetFeed = vi.mocked(getFeed);
const mockedApiPost = vi.mocked(apiPost);

function message(
  hash: string,
  author: string,
  timestamp: string,
  content: MessageContent,
): Message {
  return {
    hash,
    author,
    sequence: 1,
    timestamp,
    previous: null,
    content,
    signature: 'signature',
  };
}

function taskAndOffer(prompt = 'Inspect the deployment and report its health.'): Message[] {
  return [
    message('task-record-hash', 'requestor-id', '2026-08-14T11:55:00.000Z', {
      type: 'task/v1',
      id: 'task-123',
      hash: 'untrusted-content-hash',
      prompt,
    }),
    message('offer-record-hash', 'servitor-id', '2026-08-14T11:56:00.000Z', {
      type: 'task_offer',
      task_id: 'task-123',
      servitor: 'servitor-id',
    }),
  ];
}

function snapshotFixture(): AssignmentCommandSnapshot {
  const pending = derivePendingAssignments(taskAndOffer())[0];
  return createAssignmentCommandSnapshot(pending, 'local-assigner', 'command-1', NOW);
}

function commandRecordWithOverrides(
  snapshot = snapshotFixture(),
  contentOverrides: Partial<MessageContent> = {},
  recordOverrides: Partial<Message> = {},
): Message {
  return {
    ...message(
      'command-record-hash',
      snapshot.assigner,
      '2026-08-14T12:00:00.500Z',
      { ...buildAssignTaskContent(snapshot, 'attempt-1'), ...contentOverrides },
    ),
    ...recordOverrides,
  };
}

function ownerResult(
  status: 'accepted' | 'rejected' | 'superseded',
  overrides: Partial<MessageContent> = {},
): Message {
  return message('owner-result-hash', 'servitor-id', '2026-08-14T12:00:01.000Z', {
    type: 'assign_task_result/v1',
    command_id: 'command-1',
    task_id: 'task-123',
    status,
    ...(status === 'accepted'
      ? { lifecycle_hash: 'command-record-hash', task_state: 'assigned' }
      : { reason: 'stale_predecessor' }),
    ...overrides,
  });
}

function emitted(): EmittedAssignment {
  return createEmittedAssignment(snapshotFixture(), 'attempt-1', NOW);
}

describe('getAssignmentFeedRecords', () => {
  beforeEach(() => {
    mockedGetFeed.mockReset();
    mockedGetFeed.mockResolvedValue([]);
  });

  it('queries only the actual base content types and clamps to the backend maximum', async () => {
    await getAssignmentFeedRecords(250);

    expect(mockedGetFeed).toHaveBeenCalledTimes(7);
    expect(mockedGetFeed.mock.calls.map(([query]) => query?.content_type)).toEqual([
      'task',
      'task_offer',
      'task_assign',
      'assign_task',
      'assign_task_result',
      'task_result',
      'task_started',
    ]);
    expect(mockedGetFeed.mock.calls.every(([query]) => query?.limit === 200)).toBe(true);
  });
});

describe('derivePendingAssignments', () => {
  it('derives an offered task as pending from captured record hashes', () => {
    expect(derivePendingAssignments(taskAndOffer())).toEqual([
      {
        taskId: 'task-123',
        taskHash: 'task-record-hash',
        taskContentHash: 'untrusted-content-hash',
        prompt: 'Inspect the deployment and report its health.',
        servitor: 'servitor-id',
        offerHash: 'offer-record-hash',
        offeredAt: '2026-08-14T11:56:00.000Z',
      },
    ]);
  });

  it('omits a task with a bare task_assign record in the same task cycle', () => {
    const records = [
      ...taskAndOffer(),
      message('legacy-assignment', 'requestor-id', '2026-08-14T11:57:00.000Z', {
        type: 'task_assign/v1',
        task_id: 'task-123',
        servitor: 'servitor-id',
      }),
    ];

    expect(derivePendingAssignments(records)).toEqual([]);
  });

  it('lets one valid legacy assignment suppress every offer in its task cycle', () => {
    const records = [
      ...taskAndOffer(),
      message('offer-b', 'servitor-b', '2026-08-14T11:56:30.000Z', {
        type: 'task_offer',
        task_id: 'task-123',
        servitor: 'servitor-b',
      }),
      message('legacy-assignment', 'requestor-id', '2026-08-14T11:57:00.000Z', {
        type: 'task_assign',
        task_id: 'task-123',
        servitor: 'servitor-id',
        assigner: 'requestor-id',
      }),
    ];

    expect(derivePendingAssignments(records)).toEqual([]);
  });

  it.each([
    {
      label: 'missing servitor',
      author: 'requestor-id',
      content: { type: 'task_assign', task_id: 'task-123' },
    },
    {
      label: 'servitor without a bound offer',
      author: 'requestor-id',
      content: { type: 'task_assign', task_id: 'task-123', servitor: 'other-servitor' },
    },
    {
      label: 'assignment author differs from task author',
      author: 'other-author',
      content: { type: 'task_assign', task_id: 'task-123', servitor: 'servitor-id' },
    },
    {
      label: 'optional assigner differs from assignment author',
      author: 'requestor-id',
      content: {
        type: 'task_assign',
        task_id: 'task-123',
        servitor: 'servitor-id',
        assigner: 'other-author',
      },
    },
  ])('does not suppress pending for a forged legacy assignment: $label', ({ author, content }) => {
    const records = [
      ...taskAndOffer(),
      message('legacy-assignment', author, '2026-08-14T11:57:00.000Z', content),
    ];

    expect(derivePendingAssignments(records)).toHaveLength(1);
  });

  it('omits an offer whose author does not match its claimed servitor', () => {
    const records = taskAndOffer();
    records[1] = message('offer-record-hash', 'spoofing-author', '2026-08-14T11:56:00.000Z', {
      type: 'task_offer',
      task_id: 'task-123',
      servitor: 'servitor-id',
    });

    expect(derivePendingAssignments(records)).toEqual([]);
  });

  it('uses the task content hash, not its envelope hash, to bind task_result', () => {
    const records = [
      ...taskAndOffer(),
      message('task-result', 'servitor-id', '2026-08-14T11:59:00.000Z', {
        type: 'task_result/v1',
        task_id: 'task-123',
        task_hash: 'untrusted-content-hash',
        servitor: 'servitor-id',
      }),
    ];

    expect(derivePendingAssignments(records)).toEqual([]);
  });

  it('lets one owner-bound task_result suppress every alternative offer in the task cycle', () => {
    const records = [
      ...taskAndOffer(),
      message('offer-b', 'servitor-b', '2026-08-14T11:56:30.000Z', {
        type: 'task_offer',
        task_id: 'task-123',
        servitor: 'servitor-b',
      }),
      message('task-result', 'servitor-id', '2026-08-14T11:59:00.000Z', {
        type: 'task_result',
        task_id: 'task-123',
        task_hash: 'untrusted-content-hash',
        servitor: 'servitor-id',
      }),
    ];

    expect(derivePendingAssignments(records)).toEqual([]);
  });

  it.each([
    { author: 'spoofing-author', servitor: 'servitor-id', taskHash: 'untrusted-content-hash' },
    { author: 'servitor-id', servitor: undefined, taskHash: 'untrusted-content-hash' },
    { author: 'servitor-id', servitor: 'servitor-id', taskHash: 'different-task-hash' },
  ])('does not suppress pending for an unbound task_result', ({ author, servitor, taskHash }) => {
    const records = [
      ...taskAndOffer(),
      message('task-result', author, '2026-08-14T11:59:00.000Z', {
        type: 'task_result',
        task_id: 'task-123',
        task_hash: taskHash,
        ...(servitor ? { servitor } : {}),
      }),
    ];

    expect(derivePendingAssignments(records)).toHaveLength(1);
  });

  it('omits a task only after a fully bound owner acceptance', () => {
    const records = [...taskAndOffer(), commandRecordWithOverrides(), ownerResult('accepted')];

    expect(derivePendingAssignments(records)).toEqual([]);
  });

  it.each([
    { result: { task_id: 'other-task' }, command: {} },
    { result: { lifecycle_hash: 'missing-command-hash' }, command: {} },
    { result: {}, command: { offer_hash: 'forged-offer-hash' } },
  ])('does not let a loosely bound acceptance suppress pending', ({ result, command }) => {
    const records = [
      ...taskAndOffer(),
      commandRecordWithOverrides(snapshotFixture(), command),
      ownerResult('accepted', result),
    ];

    expect(derivePendingAssignments(records)).toHaveLength(1);
  });

  it('pairs a reused task id with the latest task record at or before its offer', () => {
    const records = [
      message('old-task-hash', 'requestor-id', '2026-08-14T11:40:00.000Z', {
        type: 'task',
        id: 'task-123',
        hash: 'old-content-hash',
        prompt: 'Old prompt',
      }),
      message('old-offer', 'servitor-id', '2026-08-14T11:40:30.000Z', {
        type: 'task_offer',
        task_id: 'task-123',
        servitor: 'servitor-id',
      }),
      message('old-assignment', 'requestor-id', '2026-08-14T11:41:00.000Z', {
        type: 'task_assign',
        task_id: 'task-123',
        servitor: 'servitor-id',
      }),
      message('new-task-hash', 'requestor-id', '2026-08-14T11:55:00.000Z', {
        type: 'task',
        id: 'task-123',
        hash: 'new-content-hash',
        prompt: 'New prompt',
      }),
      message('new-offer-hash', 'servitor-id', '2026-08-14T11:56:00.000Z', {
        type: 'task_offer',
        task_id: 'task-123',
        servitor: 'servitor-id',
      }),
    ];

    expect(derivePendingAssignments(records)[0]).toMatchObject({
      taskHash: 'new-task-hash',
      taskContentHash: 'new-content-hash',
      prompt: 'New prompt',
      offerHash: 'new-offer-hash',
    });
  });

  it('ignores malformed feed content instead of throwing', () => {
    const malformed = [
      { ...message('null-content', 'author', NOW.toISOString(), { type: 'unused' }), content: null },
      { ...message('array-content', 'author', NOW.toISOString(), { type: 'unused' }), content: [] },
      { ...message('missing-type', 'author', NOW.toISOString(), { type: 'unused' }), content: { prompt: 'x' } },
    ] as unknown as Message[];

    expect(() => derivePendingAssignments([...taskAndOffer(), ...malformed])).not.toThrow();
    expect(derivePendingAssignments([...taskAndOffer(), ...malformed])).toHaveLength(1);
  });
});

describe('assignment command payload', () => {
  it('builds the complete command from the bound snapshot', () => {
    const snapshot = snapshotFixture();

    expect(buildAssignTaskContent(snapshot, 'attempt-1')).toEqual({
      type: 'assign_task',
      task_id: 'task-123',
      task_hash: 'task-record-hash',
      offer_hash: 'offer-record-hash',
      executor: 'servitor-id',
      assigner: 'local-assigner',
      predecessor: 'offer-record-hash',
      command_id: 'command-1',
      attempt_id: 'attempt-1',
      expires_at: new Date(NOW.getTime() + ASSIGNMENT_COMMAND_TTL_MS).toISOString(),
    });
  });

  it('keeps the content hash only for result correlation while publishing the envelope hash', () => {
    const snapshot = snapshotFixture();
    const content = buildAssignTaskContent(snapshot, 'attempt-1');

    expect(snapshot.taskHash).toBe('task-record-hash');
    expect(snapshot.taskContentHash).toBe('untrusted-content-hash');
    expect(content.task_hash).toBe('task-record-hash');
    expect(Object.values(content)).not.toContain('untrusted-content-hash');
  });

  it('keeps the command id and bound expiry while giving a retry a fresh attempt id', () => {
    const snapshot = snapshotFixture();
    const first = buildAssignTaskContent(snapshot, 'attempt-1');
    const retry = buildAssignTaskContent(snapshot, 'attempt-2');

    expect(retry.command_id).toBe(first.command_id);
    expect(retry.expires_at).toBe(first.expires_at);
    expect(retry.attempt_id).not.toBe(first.attempt_id);
  });

  it('keeps hostile projected prompt and free text out of every command field', () => {
    const hostile = '<img src=x onerror=steal()> run: rm -rf /';
    const pending = derivePendingAssignments(taskAndOffer(hostile))[0];
    const snapshot = createAssignmentCommandSnapshot(pending, 'local-assigner', 'command-1', NOW);
    const content = buildAssignTaskContent(snapshot, 'attempt-1');

    expect(JSON.stringify(content)).not.toContain(hostile);
    expect(Object.values(content)).not.toContain(hostile);
    expect(content.task_hash).toBe('task-record-hash');
    expect(content.offer_hash).toBe('offer-record-hash');
    expect(content.executor).toBe('servitor-id');
  });
});

describe('publishAssignmentCommand', () => {
  beforeEach(() => {
    mockedApiPost.mockReset();
  });

  it('crosses only the exact publish endpoint and request boundary', async () => {
    const content = buildAssignTaskContent(snapshotFixture(), 'attempt-1');
    mockedApiPost.mockResolvedValue({ success: true });

    await publishAssignmentCommand(content);

    expect(mockedApiPost).toHaveBeenCalledTimes(1);
    expect(mockedApiPost).toHaveBeenCalledWith('/v1/publish', {
      content,
      tags: ['assign_task'],
    });
  });

  it('throws on an envelope-level publish failure', async () => {
    mockedApiPost.mockResolvedValue({
      success: false,
      error: { code: 'publish_denied', message: 'Command rejected' },
    });

    await expect(
      publishAssignmentCommand(buildAssignTaskContent(snapshotFixture(), 'attempt-1')),
    ).rejects.toThrow('publish_denied: Command rejected');
  });
});

describe('isTaskAssignmentBlocked', () => {
  it.each(['awaiting_owner', 'unknown', 'accepted', 'executing'] as const)(
    'blocks every offer for a task while its command is %s',
    (status) => {
      expect(isTaskAssignmentBlocked('task-123', [{ ...emitted(), status }])).toBe(true);
    },
  );

  it.each(['rejected', 'completed'] as const)('does not block a new command after %s', (status) => {
    expect(isTaskAssignmentBlocked('task-123', [{ ...emitted(), status }])).toBe(false);
  });
});

describe('isAssignmentRetryDisabled', () => {
  it('disables retry while its delivery attempt is still sending', () => {
    expect(isAssignmentRetryDisabled(true, snapshotFixture().expiresAt, NOW.getTime())).toBe(true);
  });

  it('allows retry only when idle and unexpired', () => {
    expect(isAssignmentRetryDisabled(false, snapshotFixture().expiresAt, NOW.getTime())).toBe(false);
  });
});

describe('reconcileAssignment', () => {
  const acceptedRecords = () => [commandRecordWithOverrides(), ownerResult('accepted')];

  it('moves from awaiting owner to accepted only on the fully bound owner result', () => {
    const accepted = reconcileAssignment(
      emitted(),
      acceptedRecords(),
      new Date('2026-08-14T12:00:05.000Z'),
    );

    expect(accepted.status).toBe('accepted');
  });

  it.each([
    { label: 'wrong task', result: { task_id: 'other-task' }, command: {}, author: 'servitor-id' },
    { label: 'wrong lifecycle hash', result: { lifecycle_hash: 'missing-hash' }, command: {}, author: 'servitor-id' },
    { label: 'wrong task state', result: { task_state: 'pending' }, command: {}, author: 'servitor-id' },
    { label: 'forged command author', result: {}, command: {}, author: 'other-assigner' },
    { label: 'mismatched command field', result: {}, command: { task_hash: 'forged-task-hash' }, author: 'local-assigner' },
  ])('does not accept a result with $label', ({ result, command, author }) => {
    const records = [
      commandRecordWithOverrides(snapshotFixture(), command, { author }),
      ownerResult('accepted', result),
    ];

    expect(reconcileAssignment(emitted(), records, new Date('2026-08-14T12:00:05.000Z')).status)
      .toBe('awaiting_owner');
  });

  it('moves an accepted command through executing to completed from owner lifecycle records', () => {
    const acceptedRecordsWithLifecycle = acceptedRecords();
    const started = message('started', 'servitor-id', '2026-08-14T12:00:02.000Z', {
      type: 'task_started/v1',
      task_id: 'task-123',
      servitor: 'servitor-id',
    });
    const result = message('result', 'servitor-id', '2026-08-14T12:00:03.000Z', {
      type: 'task_result',
      task_id: 'task-123',
      task_hash: 'untrusted-content-hash',
      servitor: 'servitor-id',
    });

    const accepted = reconcileAssignment(
      emitted(),
      acceptedRecordsWithLifecycle,
      new Date('2026-08-14T12:00:05.000Z'),
    );
    const executing = reconcileAssignment(
      accepted,
      [...acceptedRecordsWithLifecycle, started],
      new Date('2026-08-14T12:00:05.000Z'),
    );
    const completed = reconcileAssignment(
      executing,
      [...acceptedRecordsWithLifecycle, started, result],
      new Date('2026-08-14T12:00:05.000Z'),
    );

    expect(accepted.status).toBe('accepted');
    expect(executing.status).toBe('executing');
    expect(completed.status).toBe('completed');
  });

  it.each(['rejected', 'superseded'] as const)(
    'maps an owner %s result to rejected with an allowlisted reason',
    (status) => {
      const reconciled = reconcileAssignment(
        emitted(),
        [ownerResult(status)],
        new Date('2026-08-14T12:00:05.000Z'),
      );

      expect(reconciled).toMatchObject({ status: 'rejected', reason: 'stale_predecessor' });
    },
  );

  it.each(['api_token=secret', 'invented_reason', '<script>alert(1)</script>'])(
    'does not display a non-allowlisted owner reason verbatim',
    (reason) => {
      const reconciled = reconcileAssignment(
        emitted(),
        [ownerResult('rejected', { reason })],
        new Date('2026-08-14T12:00:05.000Z'),
      );

      expect(reconciled).toMatchObject({ status: 'rejected', reason: 'owner_rejected' });
    },
  );

  it('does not bind a rejection for another task', () => {
    const reconciled = reconcileAssignment(
      emitted(),
      [ownerResult('rejected', { task_id: 'other-task' })],
      new Date('2026-08-14T12:00:05.000Z'),
    );

    expect(reconciled.status).toBe('awaiting_owner');
  });

  it('moves to unknown only when no matching result arrives within the poll window', () => {
    expect(reconcileAssignment(emitted(), [], new Date(NOW.getTime() + 5_000)).status)
      .toBe('awaiting_owner');
    expect(
      reconcileAssignment(
        emitted(),
        [],
        new Date(NOW.getTime() + ASSIGNMENT_RESULT_TIMEOUT_MS),
      ).status,
    ).toBe('unknown');
  });

  it('retries an unknown command as awaiting owner with the same command id and a fresh attempt', () => {
    const unknown = reconcileAssignment(
      emitted(),
      [],
      new Date(NOW.getTime() + ASSIGNMENT_RESULT_TIMEOUT_MS),
    );
    const retried = retryEmittedAssignment(
      unknown,
      'attempt-2',
      new Date('2026-08-14T12:00:20.000Z'),
    );

    expect(retried.snapshot.commandId).toBe('command-1');
    expect(retried.attemptId).toBe('attempt-2');
    expect(retried.status).toBe('awaiting_owner');
  });

  it('preserves a feed-derived state when the bounded poll no longer includes its records', () => {
    const accepted = reconcileAssignment(
      emitted(),
      acceptedRecords(),
      new Date('2026-08-14T12:00:05.000Z'),
    );

    expect(reconcileAssignment(accepted, [], new Date('2026-08-14T12:01:00.000Z')).status)
      .toBe('accepted');
  });

  it('does not trust a matching result signed by another author', () => {
    const spoof = { ...ownerResult('accepted'), author: 'other-author' };
    const records = [commandRecordWithOverrides(), spoof];

    expect(reconcileAssignment(emitted(), records, new Date('2026-08-14T12:00:05.000Z')).status)
      .toBe('awaiting_owner');
  });

  it('ignores malformed feed content during reconciliation', () => {
    const malformed = {
      ...message('malformed', 'servitor-id', '2026-08-14T12:00:01.000Z', { type: 'unused' }),
      content: null,
    } as unknown as Message;

    expect(() => reconcileAssignment(emitted(), [malformed], new Date('2026-08-14T12:00:05.000Z')))
      .not.toThrow();
  });
});
