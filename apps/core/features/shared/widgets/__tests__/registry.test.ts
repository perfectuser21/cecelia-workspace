import { describe, it, expect, beforeEach } from 'vitest';
import { WidgetRegistry } from '../registry';
import { WidgetManifest } from '../types';

const makeWidget = (overrides: Partial<WidgetManifest> = {}): WidgetManifest => ({
  id: 'test-widget',
  title: 'Test Widget',
  description: 'A test widget',
  category: 'overview',
  defaultSize: { cols: 1, rows: 1 },
  component: () => null,
  ...overrides,
});

describe('WidgetRegistry', () => {
  beforeEach(() => {
    WidgetRegistry.clear();
  });

  it('registers and retrieves widgets via getAll', () => {
    WidgetRegistry.register(makeWidget({ id: 'a' }));
    WidgetRegistry.register(makeWidget({ id: 'b' }));
    expect(WidgetRegistry.getAll()).toHaveLength(2);
  });

  it('getById returns correct widget', () => {
    WidgetRegistry.register(makeWidget({ id: 'x', title: 'X' }));
    expect(WidgetRegistry.getById('x')?.title).toBe('X');
    expect(WidgetRegistry.getById('missing')).toBeUndefined();
  });

  it('getByCategory filters correctly', () => {
    WidgetRegistry.register(makeWidget({ id: 'a', category: 'system' }));
    WidgetRegistry.register(makeWidget({ id: 'b', category: 'tasks' }));
    WidgetRegistry.register(makeWidget({ id: 'c', category: 'system' }));
    expect(WidgetRegistry.getByCategory('system')).toHaveLength(2);
    expect(WidgetRegistry.getByCategory('tasks')).toHaveLength(1);
    expect(WidgetRegistry.getByCategory('analytics')).toHaveLength(0);
  });

  it('clear removes all widgets', () => {
    WidgetRegistry.register(makeWidget({ id: 'a' }));
    WidgetRegistry.clear();
    expect(WidgetRegistry.getAll()).toHaveLength(0);
  });

  it('re-registering same id overwrites', () => {
    WidgetRegistry.register(makeWidget({ id: 'a', title: 'Old' }));
    WidgetRegistry.register(makeWidget({ id: 'a', title: 'New' }));
    expect(WidgetRegistry.getAll()).toHaveLength(1);
    expect(WidgetRegistry.getById('a')?.title).toBe('New');
  });
});
