import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { View } from '../components/layout/Sidebar';

interface AppState {
  currentView: View;
  searchQuery: string;
  ignoredAuthors: string[];
  selectedTaskId: string | null;
  selectedTraceId: string | null;
  setView: (view: View) => void;
  setSearchQuery: (query: string) => void;
  setSelectedTaskId: (taskId: string | null) => void;
  setSelectedTraceId: (traceId: string | null) => void;
  ignoreAuthor: (author: string) => void;
  unignoreAuthor: (author: string) => void;
  isIgnored: (author: string) => boolean;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentView: 'feed',
      searchQuery: '',
      ignoredAuthors: [],
      selectedTaskId: null,
      selectedTraceId: null,
      setView: (view) => set({ currentView: view }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setSelectedTaskId: (taskId) => set({ selectedTaskId: taskId }),
      setSelectedTraceId: (traceId) => set({ selectedTraceId: traceId }),
      ignoreAuthor: (author) =>
        set((state) => ({
          ignoredAuthors: state.ignoredAuthors.includes(author)
            ? state.ignoredAuthors
            : [...state.ignoredAuthors, author],
        })),
      unignoreAuthor: (author) =>
        set((state) => ({
          ignoredAuthors: state.ignoredAuthors.filter((a) => a !== author),
        })),
      isIgnored: (author) => get().ignoredAuthors.includes(author),
    }),
    {
      name: 'egregore-app-store',
      partialize: (state) => ({ ignoredAuthors: state.ignoredAuthors }),
    }
  )
);
