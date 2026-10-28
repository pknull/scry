import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

const VIEWS = [
  { view: 'feed', label: 'Feed', title: 'Feed' },
  { view: 'tasks', label: 'Tasks', title: 'Task Activity' },
  { view: 'assignments', label: 'Assignments', title: 'Assignments' },
  { view: 'traces', label: 'Traces', title: 'Trace Waterfall' },
  { view: 'peers', label: 'Peers', title: 'Peers & Network' },
  { view: 'schemas', label: 'Schemas', title: 'Schema Registry' },
  { view: 'retention', label: 'Retention', title: 'Retention Policies' },
  { view: 'topics', label: 'Topics', title: 'Topic Subscriptions' },
  { view: 'settings', label: 'Settings', title: 'Settings' },
] as const;

describe('operator shell navigation', () => {
  it('offers exactly the supported views, in order', () => {
    const html = renderToStaticMarkup(
      <Sidebar currentView="feed" onViewChange={() => {}} />
    );
    const labels = [...html.matchAll(/title="([^"]+)"/g)].map((m) => m[1]);
    expect(labels).toEqual(VIEWS.map(({ label }) => label));
  });

  it.each(VIEWS)('titles the $view view', ({ view, title }) => {
    const html = renderToStaticMarkup(
      <Header currentView={view} searchQuery="" onSearchChange={() => {}} />
    );
    expect(html).toContain(`>${title.replace('&', '&amp;')}</h1>`);
  });

  it('ships no bridge or transport-health panels', () => {
    const components = Object.keys(import.meta.glob('../**/*.tsx'));
    expect(components.length).toBeGreaterThan(0);
    for (const name of ['BridgePanel', 'BridgeQueueRow', 'TransportHealthRow']) {
      expect(components.filter((path) => path.endsWith(`/${name}.tsx`))).toEqual([]);
    }
  });
});
