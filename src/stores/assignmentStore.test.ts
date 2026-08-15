import { beforeEach, describe, expect, it } from 'vitest';
import {
  createAssignmentCommandSnapshot,
  createEmittedAssignment,
  isAssignmentRetryDisabled,
} from '../api/assignments';
import { useAssignmentStore } from './assignmentStore';

function emittedFixture() {
  const snapshot = createAssignmentCommandSnapshot(
    {
      taskId: 'task-1',
      taskHash: 'task-hash',
      taskContentHash: 'task-content-hash',
      prompt: 'Prompt',
      servitor: 'servitor-id',
      offerHash: 'offer-hash',
      offeredAt: '2026-08-14T12:00:00.000Z',
    },
    'assigner-id',
    'command-id',
    new Date('2026-08-14T12:00:00.000Z'),
  );
  return createEmittedAssignment(
    snapshot,
    'attempt-id',
    new Date('2026-08-14T12:00:00.000Z'),
  );
}

describe('assignment UI store', () => {
  beforeEach(() => {
    useAssignmentStore.setState({ emitted: [], sendingAttemptIds: new Set() });
  });

  it('keeps emitted commands in module state for later panel mounts', () => {
    const emitted = emittedFixture();

    useAssignmentStore.getState().updateEmitted(() => [emitted]);

    expect(useAssignmentStore.getState().emitted).toEqual([emitted]);
  });

  it('keeps in-flight attempts across panel mounts and tracks fresh attempts independently', () => {
    const firstMount = useAssignmentStore.getState();
    const unknown = { ...emittedFixture(), status: 'unknown' as const };
    firstMount.updateEmitted(() => [unknown]);
    firstMount.beginAttempt(unknown.attemptId);

    const laterMount = useAssignmentStore.getState();
    expect(laterMount.sendingAttemptIds.has(unknown.attemptId)).toBe(true);
    expect(laterMount.emitted[0].status).toBe('unknown');
    expect(
      isAssignmentRetryDisabled(
        laterMount.sendingAttemptIds.has(unknown.attemptId),
        laterMount.emitted[0].snapshot.expiresAt,
        Date.parse(laterMount.emitted[0].lastSentAt),
      ),
    ).toBe(true);

    laterMount.beginAttempt('attempt-2');
    laterMount.endAttempt(unknown.attemptId);

    const afterFirstSettles = useAssignmentStore.getState().sendingAttemptIds;
    expect(afterFirstSettles.has(unknown.attemptId)).toBe(false);
    expect(afterFirstSettles.has('attempt-2')).toBe(true);

    useAssignmentStore.getState().endAttempt('attempt-2');
    expect(useAssignmentStore.getState().sendingAttemptIds.size).toBe(0);
  });
});
