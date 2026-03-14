import { clsx } from 'clsx';
import { MessageSquare, Settings, Users, Radio, FileJson, UsersRound, Database, Tag } from 'lucide-react';

type View = 'feed' | 'peers' | 'schemas' | 'groups' | 'retention' | 'topics' | 'settings';

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
}

const navItems: { id: View; label: string; icon: typeof MessageSquare }[] = [
  { id: 'feed', label: 'Feed', icon: MessageSquare },
  { id: 'peers', label: 'Peers', icon: Users },
  { id: 'schemas', label: 'Schemas', icon: FileJson },
  { id: 'groups', label: 'Consumer Groups', icon: UsersRound },
  { id: 'retention', label: 'Retention', icon: Database },
  { id: 'topics', label: 'Topics', icon: Tag },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
  return (
    <aside className="w-16 bg-bg-secondary border-r border-border flex flex-col items-center py-4 gap-2">
      <div className="mb-4">
        <Radio className="w-8 h-8 text-accent" />
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onViewChange(id)}
            title={label}
            className={clsx(
              'w-12 h-12 rounded-lg flex items-center justify-center transition-colors',
              'hover:bg-bg-tertiary',
              currentView === id
                ? 'bg-bg-tertiary text-accent'
                : 'text-text-muted'
            )}
          >
            <Icon className="w-5 h-5" />
          </button>
        ))}
      </nav>
    </aside>
  );
}

export type { View };
