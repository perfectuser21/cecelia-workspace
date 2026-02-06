import { CalendarDays, CalendarClock, ListTodo } from 'lucide-react';
import GenericHome from '../../shared/pages/GenericHome';
import type { HomeCard } from '../../shared/pages/GenericHome';

const cards: HomeCard[] = [
  { id: 'today', label: 'Today View', icon: CalendarDays, path: '/today/view', desc: 'Daily tasks & decisions' },
  { id: 'scheduler', label: 'Scheduler', icon: CalendarClock, path: '/today/scheduler', desc: 'Task queue scheduling' },
  { id: 'tasks', label: 'Tasks', icon: ListTodo, path: '/today/tasks', desc: 'Kanban & time-slot view' },
];

export default function TodayHome() {
  return <GenericHome title="Today" icon={CalendarDays} cards={cards} minCardWidth={260} />;
}
