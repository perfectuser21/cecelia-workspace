import { WidgetManifest, WidgetCategory } from './types';

class WidgetRegistryImpl {
  private widgets = new Map<string, WidgetManifest>();

  register(manifest: WidgetManifest): void {
    this.widgets.set(manifest.id, manifest);
  }

  getAll(): WidgetManifest[] {
    return Array.from(this.widgets.values());
  }

  getById(id: string): WidgetManifest | undefined {
    return this.widgets.get(id);
  }

  getByCategory(category: WidgetCategory): WidgetManifest[] {
    return this.getAll().filter((w) => w.category === category);
  }

  clear(): void {
    this.widgets.clear();
  }
}

export const WidgetRegistry = new WidgetRegistryImpl();
