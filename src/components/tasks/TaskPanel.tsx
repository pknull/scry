import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { getActiveTasks, getPendingTasks, getTaskRecords } from '../../api/tasks';
import { getStatus } from '../../api/status';
import { useAppStore } from '../../stores/appStore';
import { ActiveTasks } from './ActiveTasks';
import { TaskDetail } from './TaskDetail';
import { TaskQueue } from './TaskQueue';

export function TaskPanel() {
  const { selectedTaskId, setSelectedTaskId } = useAppStore();

  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => getTaskRecords(500),
    refetchInterval: 5000,
  });

  const { data: status } = useQuery({
    queryKey: ['status'],
    queryFn: getStatus,
  });

  const pendingTasks = getPendingTasks(tasks);
  const activeTasks = getActiveTasks(tasks);
  const selectedTask = pendingTasks.find((task) => task.taskId === selectedTaskId) ?? pendingTasks[0] ?? null;

  useEffect(() => {
    if (selectedTask?.taskId && selectedTask.taskId !== selectedTaskId) {
      setSelectedTaskId(selectedTask.taskId);
    }

    if (!selectedTask && selectedTaskId) {
      setSelectedTaskId(null);
    }
  }, [selectedTask, selectedTaskId, setSelectedTaskId]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (error instanceof Error) {
    return (
      <div className="rounded-lg border border-error/30 bg-error/10 p-4 text-sm text-error">
        Failed to load task activity: {error.message}
      </div>
    );
  }

  return (
    <div className="grid h-full grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="min-h-0">
        <TaskQueue
          tasks={pendingTasks}
          selectedTaskId={selectedTask?.taskId ?? null}
          onSelect={setSelectedTaskId}
        />
      </div>

      <div className="grid min-h-0 grid-cols-1 gap-4">
        <TaskDetail task={selectedTask} assigner={status?.identity} />
        <ActiveTasks tasks={activeTasks} />
      </div>
    </div>
  );
}
