import { ComponentType } from 'react';

export type WidgetSize = {
  /** Grid columns to span (1-4) */
  cols: number;
  /** Grid rows to span (1-3) */
  rows: number;
};

export type WidgetCategory = 'overview' | 'tasks' | 'system' | 'analytics' | 'custom';

export interface WidgetManifest {
  id: string;
  title: string;
  description: string;
  category: WidgetCategory;
  defaultSize: WidgetSize;
  component: ComponentType;
}

export interface WidgetLayout {
  widgetId: string;
  col: number;
  row: number;
  size?: Partial<WidgetSize>;
}
