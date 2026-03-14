import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Send } from 'lucide-react';
import { Button } from '../ui/Button';
import { publishTaskAssign } from '../../api/tasks';

interface AssignButtonProps {
  taskId: string;
  servitor: string;
  assigner?: string;
}

export function AssignButton({ taskId, servitor, assigner }: AssignButtonProps) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => publishTaskAssign(taskId, servitor, assigner),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? (
          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        ) : (
          <Send className="mr-1 h-4 w-4" />
        )}
        Assign
      </Button>
      {mutation.error instanceof Error ? (
        <div className="max-w-48 text-right text-xs text-error">
          {mutation.error.message}
        </div>
      ) : null}
    </div>
  );
}
