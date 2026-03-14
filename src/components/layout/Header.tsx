import { Search } from 'lucide-react';
import { Input } from '../ui/Input';
import type { View } from './Sidebar';

interface HeaderProps {
  currentView: View;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const viewTitles: Record<View, string> = {
  feed: 'Feed',
  tasks: 'Task Assignment',
  peers: 'Peers & Network',
  schemas: 'Schema Registry',
  groups: 'Consumer Groups',
  retention: 'Retention Policies',
  topics: 'Topic Subscriptions',
  settings: 'Settings',
};

export function Header({ currentView, searchQuery, onSearchChange }: HeaderProps) {
  return (
    <header className="h-14 bg-bg border-b border-border px-4 flex items-center gap-4">
      <h1 className="text-lg font-semibold text-text">
        {viewTitles[currentView]}
      </h1>

      {currentView === 'feed' && (
        <div className="flex-1 max-w-md ml-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <Input
              type="search"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      )}
    </header>
  );
}
