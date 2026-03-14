import { Activity, Clock3, TimerReset } from 'lucide-react';
import { getTaskEtaSeconds, getTaskProgress, getTaskStatusMessage, type TaskRecord } from '../../api/tasks';
import { Card, CardHeader, CardTitle } from '../ui/Card';

interface ActiveTasksProps {
  tasks: TaskRecord[];
}

function shortId(value?: string | null): string {
  if (!value) return 'unknown';
  return value.slice(0, 16);
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || Number.isNaN(seconds)) return 'Unknown';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

function getElapsedSeconds(task: TaskRecord): number | null {
  const startedAt = task.started?.timestamp ?? task.assignment?.timestamp;
  if (!startedAt) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
}

export function ActiveTasks({ tasks }: ActiveTasksProps) {
  return (
    <Card padding="none">
      <CardHeader className="border-b border-border px-4 py-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-5 w-5 text-accent" />
          Active Tasks ({tasks.length})
        </CardTitle>
      </CardHeader>

      {tasks.length === 0 ? (
        <div className="px-4 py-6 text-sm text-text-muted">
          No tasks are currently assigned or running.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {tasks.map((task) => {
            const eta = getTaskEtaSeconds(task);
            const progress = getTaskProgress(task);
            const elapsed = getElapsedSeconds(task);
            const statusText = getTaskStatusMessage(task);
            const assignedServitor =
              task.started?.content.servitor ??
              task.assignment?.content.servitor ??
              task.result?.content.servitor ??
              task.failure?.content.servitor;

            return (
              <div key={task.taskId} className="space-y-3 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-text">
                      {task.task?.content.request ?? task.task?.content.prompt ?? task.taskId}
                    </div>
                    <div className="mt-1 text-xs text-text-muted">
                      Servitor <span className="font-mono text-text">{shortId(assignedServitor)}</span>
                    </div>
                  </div>

                  <div className="space-y-1 text-right text-xs text-text-muted">
                    <div className="inline-flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5" />
                      ETA {formatDuration(eta)}
                    </div>
                    <div className="inline-flex items-center gap-1">
                      <TimerReset className="h-3.5 w-3.5" />
                      Elapsed {formatDuration(elapsed)}
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-text-muted">
                    <span>Progress</span>
                    <span>{progress === null ? 'In progress' : `${progress}%`}</span>
                  </div>
                  <div className="h-2 rounded-full bg-bg">
                    <div
                      className="h-2 rounded-full bg-accent transition-all"
                      style={{ width: `${progress ?? 15}%` }}
                    />
                  </div>
                </div>

                {statusText ? (
                  <div className="text-xs text-text-muted">
                    {statusText}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
