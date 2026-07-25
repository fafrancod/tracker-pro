export type Plan = 'free' | 'pro';
export type Priority = 'low' | 'medium' | 'high';
export type RecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
/** task/reminder = proyectos y pendientes; rx_* = recetario. */
export type TaskKind = 'task' | 'reminder' | 'rx_human' | 'rx_pet';
export type Urgency = 'urgent' | 'not_urgent';
export type Importance = 'important' | 'not_important';
export type BoardViewMode = 'week' | 'month' | 'continuous' | 'day';
/** Lista de actividades vs grilla horaria (semana / día). */
export type ScheduleLayout = 'list' | 'schedule';
/** Unidad de dosis por sesión. */
export type DoseUnit = 'pills' | 'ml';
/** Filtro de categoría en el tablero: todo / solo proyectos / solo recetarios. */
export type BoardCategoryFilter = 'all' | 'projects' | 'rx';

/**
 * Una fase del plan de medicación.
 * Ejemplo: 1 pastilla 2×/día durante 7 días, luego 0.5 pastilla 1×/día 7 días.
 */
export interface RxPhase {
  /** Cantidad por sesión (toma). */
  amount: number;
  unit: DoseUnit;
  /** Días consecutivos de esta fase (≥ 1). */
  days: number;
  /** Horarios locales HH:mm de cada sesión del día. */
  times: string[];
}

/** Metadatos de recetario en cada toma materializada. */
export interface RxMeta {
  /** Nombre del paciente / mascota (opcional en humano). */
  subject: string | null;
  /** Dosis de ESTA toma. */
  amount: number;
  unit: DoseUnit;
  phaseIndex: number;
  planStartDayId: string;
  /** Plan completo (snapshot) para mostrar contexto. */
  phases: RxPhase[];
}

export interface Recurrence {
  frequency: RecurrenceFrequency;
  /** Cada N días / semanas / meses (mínimo 1). */
  interval: number;
}

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
  /** Vista por defecto del tablero al abrir /board. */
  defaultBoardView: BoardViewMode;
  /**
   * Skin visual (id de skins del cliente).
   * Ej. dark-github, light-paper. Default: dark-github.
   */
  skinId: string;
  /** Hora de inicio de la grilla horaria (0–23). Default 7. */
  dayStartHour: number;
  /** Hora de fin de la grilla (1–24, exclusiva del último slot visual). Default 22. */
  dayEndHour: number;
  /** Layout por defecto en vista semana/día: lista o horario. */
  defaultScheduleLayout: ScheduleLayout;
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
  /** Serie de repetición; null si es tarea única. */
  seriesId: string | null;
  recurrence: Recurrence;
  /**
   * Inclusive end day (YYYY-MM-DD). Always present; equals the start day for
   * single-day tasks. Location in the store uses the start day bucket.
   */
  endDayId: string;
  /** Matriz Eisenhower; null = sin categorizar. */
  urgency: Urgency | null;
  /** Matriz Eisenhower; null = sin categorizar. */
  importance: Importance | null;
  /** Tarea, recordatorio o toma de recetario (humano / mascota). */
  kind: TaskKind;
  /** Color propio (hex). null = usar color del proyecto o default. */
  color: string | null;
  /**
   * Hora de inicio local HH:mm (24h). null = sin horario (solo en lista / "todo el día").
   */
  startTime: string | null;
  /** Hora de fin local HH:mm. Si falta y hay start, la UI asume +1h. */
  endTime: string | null;
  /**
   * Presente en tomas de recetario (kind rx_human | rx_pet).
   * null en tareas normales.
   */
  rx: RxMeta | null;
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
  /** Inclusive end day; defaults to start day when omitted. */
  endDayId?: string;
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceInterval?: number;
  urgency?: Urgency | null;
  importance?: Importance | null;
  kind?: TaskKind;
  color?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  /**
   * Solo al crear kind rx_human | rx_pet: plan por fases.
   * El API materializa una tarea por (día × horario).
   */
  rxPhases?: RxPhase[];
  /** Paciente / nombre de mascota (recetario). */
  rxSubject?: string | null;
}

export type TaskApplyTo = 'instance' | 'series';

export interface UpdateTaskPayload {
  title?: string;
  completed?: boolean;
  projectId?: string | null;
  priority?: Priority;
  notes?: string;
  tags?: string[];
  order?: number;
  movedFrom?: string | null;
  /** Inclusive end day (must be >= start day). */
  endDayId?: string;
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceInterval?: number;
  urgency?: Urgency | null;
  importance?: Importance | null;
  kind?: TaskKind;
  color?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  /**
   * instance = solo esta ocurrencia (default).
   * series = propaga metadata (título, color, …) a toda la serie.
   * completed / fechas / order nunca se propagan a la serie.
   */
  applyTo?: TaskApplyTo;
}

/** Campos de metadata que sí se propagan con applyTo=series. */
export type SeriesSharedTaskFields = Pick<
  Task,
  | 'title'
  | 'notes'
  | 'tags'
  | 'projectId'
  | 'priority'
  | 'urgency'
  | 'importance'
  | 'kind'
  | 'color'
  | 'startTime'
  | 'endTime'
>;

/** Filtros del tablero (week / month / continuous / day). */
export interface BoardTaskFilters {
  projectId?: string | null | 'all';
  urgency?: Urgency | 'all';
  importance?: Importance | 'all';
  /**
   * all = todo;
   * projects = tareas/recordatorios (no recetario);
   * rx = solo recetarios (humano + mascota).
   */
  category?: BoardCategoryFilter;
}

export function taskMatchesFilters(
  task: Pick<Task, 'projectId' | 'urgency' | 'importance' | 'kind'>,
  filters: BoardTaskFilters
): boolean {
  if (filters.category && filters.category !== 'all') {
    const kind = task.kind ?? 'task';
    if (filters.category === 'projects') {
      if (kind === 'rx_human' || kind === 'rx_pet') return false;
    } else if (filters.category === 'rx') {
      if (kind !== 'rx_human' && kind !== 'rx_pet') return false;
    }
  }
  if (filters.projectId && filters.projectId !== 'all') {
    if (task.projectId !== filters.projectId) return false;
  }
  if (filters.urgency && filters.urgency !== 'all') {
    if (task.urgency !== filters.urgency) return false;
  }
  if (filters.importance && filters.importance !== 'all') {
    if (task.importance !== filters.importance) return false;
  }
  return true;
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
