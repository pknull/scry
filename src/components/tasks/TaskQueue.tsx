import { Clock3, Inbox, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';
import type { TaskRecord } from '../../api/tasks';
import { Card, CardHeader, CardTitle } from '../ui/Card';

interface TaskQueueProps {
  tasks: TaskRecord[];
  selectedTaskId: string | null;
  onSelect: (taskId: string) => void;
}

function shortId(value?: string | null): string {
  if (!value) return 'unknown';
  return value.slice(0, 16);
}

function getTaskLabel(task: TaskRecord): string {
  return task.task?.content.task_type ?? 'general';
}

function getTaskRequest(task: TaskRecord): string {
  return task.task?.content.request ?? task.task?.content.prompt ?? 'No task request text';
}

export function TaskQueue({ tasks, selectedTaskId, onSelect }: TaskQueueProps) {
  return (
    <Card className="h-full" padding="none">
      <CardHeader className="border-b border-border px-4 py-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Inbox className="h-5 w-5 text-accent" />
          Pending Tasks ({tasks.length})
        </CardTitle>
      </CardHeader>

      {tasks.length === 0 ? (
        <div className="flex h-full min-h-64 flex-col items-center justify-center gap-3 px-6 text-center text-sm text-text-muted">
          <Sparkles className="h-8 w-8 text-accent/70" />
          <div>No tasks are awaiting assignment right now.</div>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {tasks.map((task) => (
            <button
              key={task.taskId}
              onClick={() => onSelect(task.taskId)}
              className={clsx(
                'w-full px-4 py-4 text-left transition-colors hover:bg-bg-tertiary/60',
                task.taskId === selectedTaskId && 'bg-accent/10'
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-bg px-2 py-1 text-xs font-medium text-accent">
                      {getTaskLabel(task)}
                    </span>
                    <span className="text-xs text-text-muted">
                      requestor {shortId(task.task?.content.requestor ?? task.task?.author)}
                    </span>
                  </div>

                  <div className="line-clamp-2 text-sm text-text">
                    {getTaskRequest(task)}
                  </div>
                </div>

                <div className="space-y-2 text-right">
                  <div className="text-sm font-medium text-text">
                    {task.offers.length} offer{task.offers.length === 1 ? '' : 's'}
                  </div>
                  <div className="inline-flex items-center gap-1 text-xs text-text-muted">
                    <Clock3 className="h-3.5 w-3.5" />
                    {new Date(task.createdAt).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
