import { CheckCircle2, ClipboardList, UserRound } from 'lucide-react';
import type { TaskRecord } from '../../api/tasks';
import { Card, CardHeader, CardTitle } from '../ui/Card';
import { TaskOffers } from './TaskOffers';

interface TaskDetailProps {
  task: TaskRecord | null;
  assigner?: string;
}

function shortId(value?: string | null): string {
  if (!value) return 'unknown';
  return value.slice(0, 16);
}

export function TaskDetail({ task, assigner }: TaskDetailProps) {
  if (!task) {
    return (
      <Card className="min-h-72" padding="lg">
        <div className="flex h-full min-h-56 flex-col items-center justify-center gap-3 text-center text-sm text-text-muted">
          <ClipboardList className="h-8 w-8 text-accent/70" />
          <div>Select a pending task to inspect its offers and assign a servitor.</div>
        </div>
      </Card>
    );
  }

  const requestText = task.task?.content.request ?? task.task?.content.prompt ?? 'No request text';
  const requiredCaps = task.task?.content.required_caps ?? [];

  return (
    <Card padding="lg" className="space-y-6">
      <CardHeader className="mb-0">
        <div>
          <CardTitle className="text-base">Task Detail</CardTitle>
          <div className="mt-1 text-sm text-text-muted">
            Task ID <span className="font-mono">{task.taskId}</span>
          </div>
        </div>
      </CardHeader>

      <div className="space-y-4">
        <div>
          <div className="mb-1 text-xs uppercase tracking-wide text-text-muted">Request</div>
          <div className="rounded-lg bg-bg p-4 text-sm text-text">
            {requestText}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          <div className="inline-flex items-center gap-2 text-text-muted">
            <UserRound className="h-4 w-4" />
            Requestor <span className="font-mono text-text">{shortId(task.task?.content.requestor ?? task.task?.author)}</span>
          </div>
          {task.assignment ? (
            <div className="inline-flex items-center gap-2 text-success">
              <CheckCircle2 className="h-4 w-4" />
              Assigned to <span className="font-mono">{shortId(task.assignment.content.servitor)}</span>
            </div>
          ) : null}
        </div>

        {requiredCaps.length > 0 ? (
          <div>
            <div className="mb-2 text-xs uppercase tracking-wide text-text-muted">Required Capabilities</div>
            <div className="flex flex-wrap gap-2">
              {requiredCaps.map((capability) => (
                <span key={capability} className="rounded-full bg-accent/10 px-2 py-1 text-xs text-accent">
                  {capability}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        <div className="text-xs uppercase tracking-wide text-text-muted">Offers</div>
        <TaskOffers task={task} assigner={assigner} />
      </div>
    </Card>
  );
}
