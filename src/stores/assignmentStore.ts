import { create } from 'zustand';
import type { EmittedAssignment } from '../api/assignments';

interface AssignmentState {
  emitted: EmittedAssignment[];
  sendingAttemptIds: Set<string>;
  updateEmitted: (update: (current: EmittedAssignment[]) => EmittedAssignment[]) => void;
  beginAttempt: (attemptId: string) => void;
  endAttempt: (attemptId: string) => void;
}

export const useAssignmentStore = create<AssignmentState>((set) => ({
  emitted: [],
  sendingAttemptIds: new Set(),
  updateEmitted: (update) => set((state) => ({ emitted: update(state.emitted) })),
  beginAttempt: (attemptId) =>
    set((state) => ({ sendingAttemptIds: new Set(state.sendingAttemptIds).add(attemptId) })),
  endAttempt: (attemptId) =>
    set((state) => {
      const sendingAttemptIds = new Set(state.sendingAttemptIds);
      sendingAttemptIds.delete(attemptId);
      return { sendingAttemptIds };
    }),
}));
