import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { StatusBar } from './components/layout/StatusBar';
import { ChatFeed } from './components/feed/ChatFeed';
import { UnifiedPeersPanel } from './components/settings/UnifiedPeersPanel';
import { SchemaPanel } from './components/settings/SchemaPanel';
import { ConsumerGroupsPanel } from './components/settings/ConsumerGroupsPanel';
import { RetentionPoliciesPanel } from './components/settings/RetentionPoliciesPanel';
import { TopicsPanel } from './components/settings/TopicsPanel';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { useAppStore } from './stores/appStore';

function App() {
  const { currentView, setView, searchQuery, setSearchQuery } = useAppStore();

  return (
    <div className="h-screen flex flex-col bg-bg">
      <div className="flex-1 flex overflow-hidden">
        <Sidebar currentView={currentView} onViewChange={setView} />

        <div className="flex-1 flex flex-col overflow-hidden">
          <Header
            currentView={currentView}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />

          <main className="flex-1 overflow-hidden">
            {currentView === 'feed' && <ChatFeed searchQuery={searchQuery} />}
            {currentView === 'peers' && <div className="h-full overflow-auto p-4"><UnifiedPeersPanel /></div>}
            {currentView === 'schemas' && <div className="h-full overflow-auto p-4"><SchemaPanel /></div>}
            {currentView === 'groups' && <div className="h-full overflow-auto p-4"><ConsumerGroupsPanel /></div>}
            {currentView === 'retention' && <div className="h-full overflow-auto p-4"><RetentionPoliciesPanel /></div>}
            {currentView === 'topics' && <div className="h-full overflow-auto p-4"><TopicsPanel /></div>}
            {currentView === 'settings' && <div className="h-full overflow-auto p-4"><SettingsPanel /></div>}
          </main>
        </div>
      </div>

      <StatusBar />
    </div>
  );
}

export default App;
