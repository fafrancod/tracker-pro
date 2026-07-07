export type Plan = 'free' | 'pro';
export type Priority = 'low' | 'medium' | 'high';

export interface UserProfile {
  name: string;
  email: string;
  plan: Plan;
  createdAt: string;
  settings: UserSettings;
}

export type Language = 'es' | 'en';

export interface UserSettings {
  autoRollIncomplete: boolean;
  defaultProjectId: string | null;
  weekStartsOnMonday: boolean;
  language: Language;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  icon: string;
  createdAt: string;
  order: number;
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  completedAt: string | null;
  projectId: string | null;
  priority: Priority;
  notes: string;
  order: number;
  tags: string[];
  movedFrom: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DayData {
  id: string;
  tasks: Task[];
}

export interface WeekData {
  id: string;
  days: Record<string, DayData>;
}

export interface AnalyticsData {
  weekId: string;
  completionsByDay: Record<string, number>;
  completionsByProject: Record<string, number>;
  streakCount: number;
}

export interface CreateTaskPayload {
  title: string;
  projectId?: string | null;
  priority?: Priority;
  notes?: string;
  tags?: string[];
}

export interface UpdateTaskPayload {
  title?: string;
  completed?: boolean;
  projectId?: string | null;
  priority?: Priority;
  notes?: string;
  tags?: string[];
  order?: number;
  movedFrom?: string | null;
}

export interface CreateProjectPayload {
  name: string;
  color: string;
  icon: string;
}

export interface UpdateProjectPayload {
  name?: string;
  color?: string;
  icon?: string;
  order?: number;
}

// weekId: "2026-W22", dayId: "2026-05-27"
export interface TaskLocation {
  userId: string;
  weekId: string;
  dayId: string;
  taskId: string;
}
