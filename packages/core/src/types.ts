export type Plan = 'free' | 'pro';
export type Priority = 'low' | 'medium' | 'high';
export type RecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
/**
 * Ancla para recurrencia mensual (y anual cuando aplique día-del-mes).
 * - day_of_month: mismo N del mes (clamp si el mes es más corto)
 * - last_day: último día calendario del mes
 * - first_business / last_business: primer/último día hábil (Chile: lun–vie sin feriado)
 */
export type MonthlyAnchor =
  | 'day_of_month'
  | 'last_day'
  | 'first_business'
  | 'last_business';
/**
 * task/reminder = proyectos y pendientes;
 * rx_* = recetario;
 * possible_event = evento posible (día o rango, con personas/mascotas);
 * event = evento confirmado (lugar, fechas, horario, salida prevista);
 * habit_good = hábito a cultivar (checkbox diario);
 * habit_quit = hábito a dejar (checkbox diario);
 * finance_income / finance_expense = movimiento en calendario (sin horario).
 */
export type TaskKind =
  | 'task'
  | 'reminder'
  | 'rx_human'
  | 'rx_pet'
  | 'possible_event'
  | 'event'
  | 'habit_good'
  | 'habit_quit'
  | 'finance_income'
  | 'finance_expense';
export type Urgency = 'urgent' | 'not_urgent';
export type Importance = 'important' | 'not_important';
export type BoardViewMode = 'week' | 'month' | 'continuous' | 'day';
/** Lista de actividades vs grilla horaria (semana / día). */
export type ScheduleLayout = 'list' | 'schedule';
/** Unidad de dosis por sesión. */
export type DoseUnit = 'pills' | 'ml';
/** Fijo (confirmado) vs potencial (esperado / no seguro). */
export type FinanceCertainty = 'fixed' | 'potential';
/** Meta de un movimiento de finanzas en el calendario. */
export interface FinanceMeta {
  amount: number;
  currency: string;
  certainty: FinanceCertainty;
}
/**
 * Filtro de categoría en el tablero:
 * all | projects | rx | possible | events | habits | finances.
 */
export type BoardCategoryFilter =
  | 'all'
  | 'projects'
  | 'rx'
  | 'possible'
  | 'events'
  | 'habits'
  | 'finances'
  | 'holidays';

/**
 * Cómo se definen los horarios de la fase:
 * - fixed: lista de horas del día (times[])
 * - interval: cada N horas a partir de startTime → se expanden a times[]
 */
export type RxScheduleMode = 'fixed' | 'interval';

/**
 * Una fase del plan de medicación.
 * Ejemplo: 1 pastilla 2×/día durante 7 días, luego 0.5 pastilla 1×/día 7 días.
 * O: 1 pastilla cada 8 h desde las 08:00 durante 7 días.
 */
export interface RxPhase {
  /** Cantidad por sesión (toma). */
  amount: number;
  unit: DoseUnit;
  /** Días consecutivos de esta fase (≥ 1). */
  days: number;
  /**
   * fixed = horarios fijos (times).
   * interval = cada everyHours desde startTime (times se calcula).
   * Default implícito: fixed si no viene (planes antiguos).
   */
  scheduleMode?: RxScheduleMode;
  /**
   * Horarios locales HH:mm de cada sesión del día.
   * En modo interval se rellenan al validar/materializar.
   */
  times: string[];
  /** Intervalo en horas (1–24). Solo modo interval. */
  everyHours?: number | null;
  /** Hora de partida HH:mm. Solo modo interval. */
  startTime?: string | null;
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
  /**
   * Solo relevante si frequency === 'monthly'.
   * Default implícito: day_of_month.
   */
  monthlyAnchor?: MonthlyAnchor;
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
  /**
   * Notificaciones locales en dispositivo (Android Capacitor + web si hay permiso).
   * Default true en nativo; el cliente pide permiso al activar.
   */
  notifyLocal: boolean;
  /** Recordatorios por correo (servidor). Requiere RESEND_API_KEY en API. */
  notifyEmail: boolean;
  /**
   * Modo “X minutos antes” (o en el momento si notifyMinutesBefore=0).
   * Default true.
   */
  notifyBeforeEnabled: boolean;
  /** Minutos de antelación (0 = en el momento). */
  notifyMinutesBefore: number;
  /**
   * Modo “Recuerda que mañana vas a…”.
   * Dispara el día anterior a `notifyDayBeforeTime`.
   */
  notifyDayBefore: boolean;
  /** Hora local HH:mm del aviso del día anterior. Default 20:00. */
  notifyDayBeforeTime: string;
  /**
   * Modo “¿Ya hiciste esto?” para eventos pasados incompletos.
   * Dispara `notifyPastAfterMinutes` después de la hora de inicio.
   */
  notifyPastIncomplete: boolean;
  /** Minutos después de la hora de inicio para el seguimiento. Default 30. */
  notifyPastAfterMinutes: number;
  /** Incluir tareas / recordatorios con hora. */
  notifyTasks: boolean;
  /** Incluir tomas de recetario. */
  notifyRx: boolean;
  /**
   * IANA timezone del usuario (ej. America/Santiago).
   * Usado por el worker de email; el dispositivo nativo usa su reloj local.
   */
  timezone: string;
  /**
   * Fecha de nacimiento (YYYY-MM-DD) para el mapa Memento mori.
   * null = no configurada.
   */
  birthDate: string | null;
  /**
   * Esperanza de vida en años para dibujar semanas restantes.
   * Default 80 (calendario clásico de semanas de vida).
   */
  expectedLifespanYears: number;
  /**
   * Metas de vida / manifestaciones (Memento mori).
   * Se marcan en la matriz semanal por `targetDate`.
   */
  lifeGoals: LifeGoal[];
  /**
   * Diario: reflexiones diarias + estado de ánimo por hora.
   * Se poda en cliente a los últimos ~90 días.
   */
  dailyJournal: DailyJournalEntry[];
  /**
   * Divisa preferida (ISO 4217, ej. CLP, EUR, USD).
   * Default del módulo Finances y de ingresos/gastos en calendario.
   */
  preferredCurrency: string;
  /**
   * Ocultar tareas completadas en el tablero (día/semana/mes/continuo).
   * Default false (se muestran al final de cada lista del día).
   */
  hideCompletedTasks: boolean;
  /**
   * Tour de bienvenida visto o saltado.
   * Ausente en cuentas antiguas (no mostrar). false = pendiente (alta nueva).
   */
  onboardingTourCompleted?: boolean;
}

/** 1 = muy bajo … 5 = excelente (ánimo o energía). */
export type MoodLevel = 1 | 2 | 3 | 4 | 5;
export type EnergyLevel = MoodLevel;

/**
 * Calidad / tono corporal de la energía (complemento al nivel 1–5).
 * Ejemplo: energía alta + tenso, o energía baja + relajado.
 */
export type EnergyFeel = 'tense' | 'relaxed' | 'vigorous';

export interface HourlyMoodEntry {
  /** Hora local 0–23 */
  hour: number;
  mood: MoodLevel;
  /** Nota breve opcional de esa hora */
  note: string;
}

export interface HourlyEnergyEntry {
  /** Hora local 0–23 */
  hour: number;
  /**
   * Nivel de energía (cantidad). null = solo se registró el tono (`feel`).
   */
  energy: EnergyLevel | null;
  /**
   * Tono corporal: tenso / relajado / vigoroso.
   * Complemento independiente del nivel numérico.
   */
  feel: EnergyFeel | null;
  note: string;
}

/** Un día del diario de ánimo / energía / sueño / reflexión. */
export interface DailyJournalEntry {
  /** YYYY-MM-DD */
  dayId: string;
  reflection: string;
  gratitude: string;
  moods: HourlyMoodEntry[];
  /** Nivel de energía por hora (categoría aparte del ánimo). */
  energies: HourlyEnergyEntry[];
  /**
   * Horas de sueño aproximadas del día (0–24).
   * null = no registrado.
   */
  sleepHours: number | null;
  updatedAt: string;
}

/** Tipo de meta de vida (visión / manifestación / hito). */
export type LifeGoalKind = 'goal' | 'manifestation' | 'milestone' | 'vision';

/**
 * Meta o manifestación con fecha objetivo.
 * `imageDataUrl` es opcional (JPEG comprimido en cliente) para no depender de storage.
 */
export interface LifeGoal {
  id: string;
  title: string;
  description: string;
  /** Fecha objetivo YYYY-MM-DD. */
  targetDate: string;
  kind: LifeGoalKind;
  /** Data URL de imagen (recomendado ≤ ~200KB). null = sin foto. */
  imageDataUrl: string | null;
  /** Color de marcador en la matriz (#RRGGBB). */
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Subcategoría dentro de un proyecto (p. ej. Trabajo → Backend). */
export interface ProjectCategory {
  id: string;
  name: string;
  order: number;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  icon: string;
  /** Subcategorías del proyecto (ordenadas). Vacío = sin subdivisión. */
  categories: ProjectCategory[];
  createdAt: string;
  order: number;
}

/** Persona o mascota del Círculo (mencionable con @tag en tareas). */
export type ContactKind = 'person' | 'pet';

/** Relación solo para personas. */
export type PersonRelationship =
  | 'father'
  | 'mother'
  | 'son'
  | 'daughter'
  | 'brother'
  | 'sister'
  | 'partner'
  | 'niece'
  | 'nephew'
  | 'friend'
  | 'coworker';

/**
 * Percepción personal de cómo está el vínculo (principalmente personas).
 * great → very good; need_connect → hace falta conectar; strained → tensa; bad → mala.
 */
export type RelationPulse =
  | 'great'
  | 'good'
  | 'neutral'
  | 'need_connect'
  | 'strained'
  | 'bad';

export interface Contact {
  id: string;
  kind: ContactKind;
  name: string;
  /** Handles sin @ (p. ej. Ana, Ragnar). Se usan como @Ana en títulos/notas. */
  tags: string[];
  /** Solo personas; null en mascotas o si no se indica. */
  relationship: PersonRelationship | null;
  /** Cómo sientes que está la relación ahora. */
  relationPulse: RelationPulse | null;
  order: number;
  createdAt: string;
}

/** Paso de checklist asociado a tarea / evento / evento posible. */
export interface TaskStep {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  completedAt: string | null;
  projectId: string | null;
  /**
   * Subcategoría del proyecto (id dentro de `project.categories`).
   * null = solo el proyecto (o sin proyecto).
   */
  projectCategoryId: string | null;
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
  /**
   * Contactos del Círculo involucrados (ids).
   * Especialmente útil en possible_event / event; también se reflejan en tags.
   */
  involvedContactIds: string[];
  /**
   * Lugar (tarea, recordatorio, evento o evento posible).
   * null en hábitos, finanzas y recetario.
   */
  location: string | null;
  /**
   * Hora de salida prevista HH:mm (kind event).
   * Ancla de notificaciones «X min antes» si está definida.
   */
  departureTime: string | null;
  /**
   * Pasos asociados (checklist). Solo aplica a task / reminder / event / possible_event.
   */
  steps: TaskStep[];
  /**
   * Adjuntos (imágenes JPEG comprimidas o PDF) como data URLs.
   * Sin depender de storage externo; tope en normalización (máx. 4).
   * El nombre del archivo va en el parámetro `name` del data URL.
   */
  images: string[];
  /**
   * Movimiento de finanzas en calendario (kind finance_income | finance_expense).
   * null en el resto de kinds.
   */
  finance: FinanceMeta | null;
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
  /** Subcategoría del proyecto seleccionado. */
  projectCategoryId?: string | null;
  priority?: Priority;
  notes?: string;
  tags?: string[];
  /**
   * Optional start day override (YYYY-MM-DD). When set, the client creates the
   * task on this day instead of the board column / sheet day context.
   * Stripped before the API body if unused by the server schema.
   */
  startDayId?: string;
  /** Inclusive end day; defaults to start day when omitted. */
  endDayId?: string;
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceInterval?: number;
  /** Ancla mensual (solo monthly). */
  recurrenceMonthlyAnchor?: MonthlyAnchor;
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
  /** Personas/mascotas del Círculo involucradas (p. ej. evento posible / evento). */
  involvedContactIds?: string[];
  /** Lugar (eventos). */
  location?: string | null;
  /** Hora de salida prevista HH:mm (eventos → notificaciones). */
  departureTime?: string | null;
  /** Pasos asociados (tarea / recordatorio / evento / posible). */
  steps?: TaskStep[];
  /** Adjuntos (imágenes o PDF como data URLs). */
  images?: string[];
  /** Meta finanzas (kind finance_income | finance_expense). */
  finance?: FinanceMeta | null;
  financeAmount?: number;
  financeCurrency?: string;
  financeCertainty?: FinanceCertainty;
}

export type TaskApplyTo = 'instance' | 'series';

export interface UpdateTaskPayload {
  title?: string;
  completed?: boolean;
  projectId?: string | null;
  projectCategoryId?: string | null;
  priority?: Priority;
  notes?: string;
  tags?: string[];
  order?: number;
  movedFrom?: string | null;
  /** Inclusive end day (must be >= start day). */
  endDayId?: string;
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceInterval?: number;
  recurrenceMonthlyAnchor?: MonthlyAnchor | null;
  urgency?: Urgency | null;
  importance?: Importance | null;
  kind?: TaskKind;
  color?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  /** Ajuste de dosis de esta toma (recetario). */
  rxAmount?: number;
  rxUnit?: DoseUnit;
  rxSubject?: string | null;
  involvedContactIds?: string[];
  location?: string | null;
  departureTime?: string | null;
  steps?: TaskStep[];
  /** Adjuntos (imágenes o PDF). Solo instancia (como steps). */
  images?: string[];
  finance?: FinanceMeta | null;
  financeAmount?: number;
  financeCurrency?: string;
  financeCertainty?: FinanceCertainty;
  /**
   * instance = solo esta ocurrencia (default).
   * series = propaga metadata (título, color, …) a toda la serie.
   * completed / fechas / order nunca se propagan a la serie.
   */
  applyTo?: TaskApplyTo;
}

export interface RematerializeRxPayload {
  title?: string;
  rxPhases: RxPhase[];
  rxSubject?: string | null;
  fromDayId?: string;
  color?: string | null;
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
  | 'involvedContactIds'
  | 'location'
  | 'departureTime'
>;

/** Filtros del tablero (week / month / continuous / day). */
export interface BoardTaskFilters {
  projectId?: string | null | 'all';
  urgency?: Urgency | 'all';
  importance?: Importance | 'all';
  /**
   * all = calendario sin recetario (vive en /recetario);
   * projects = tareas/recordatorios (no recetario, eventos ni hábitos);
   * rx = legacy: solo recetarios (el board ya no expone esta pestaña);
   * possible = solo eventos posibles;
   * events = eventos confirmados;
   * habits = hábitos buenos y a dejar;
   * finances = ingresos/gastos de calendario;
   * holidays = feriados (capa aparte; no filtra tasks del store).
   */
  category?: BoardCategoryFilter;
  /** Si true, oculta tareas completadas en la lista del tablero. */
  hideCompleted?: boolean;
}

export function taskMatchesFilters(
  task: Pick<Task, 'projectId' | 'urgency' | 'importance' | 'kind' | 'completed'>,
  filters: BoardTaskFilters
): boolean {
  const kind = task.kind ?? 'task';
  const isRx = kind === 'rx_human' || kind === 'rx_pet';
  const isFinance = kind === 'finance_income' || kind === 'finance_expense';

  if (filters.hideCompleted && task.completed) {
    return false;
  }

  // El calendario no muestra tomas de recetario salvo filtro legacy `rx`.
  if (isRx && filters.category !== 'rx') {
    return false;
  }

  if (filters.category && filters.category !== 'all') {
    if (filters.category === 'projects') {
      if (
        isRx ||
        isFinance ||
        kind === 'possible_event' ||
        kind === 'event' ||
        kind === 'habit_good' ||
        kind === 'habit_quit'
      ) {
        return false;
      }
    } else if (filters.category === 'rx') {
      if (!isRx) return false;
    } else if (filters.category === 'possible') {
      if (kind !== 'possible_event') return false;
    } else if (filters.category === 'events') {
      if (kind !== 'event') return false;
    } else if (filters.category === 'habits') {
      if (kind !== 'habit_good' && kind !== 'habit_quit') return false;
    } else if (filters.category === 'finances') {
      if (!isFinance) return false;
    } else if (filters.category === 'holidays') {
      // Las tareas no son feriados; se ocultan en este filtro.
      return false;
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
  categories?: ProjectCategory[];
}

export interface UpdateProjectPayload {
  name?: string;
  color?: string;
  icon?: string;
  order?: number;
  categories?: ProjectCategory[];
}

export interface CreateContactPayload {
  kind: ContactKind;
  name: string;
  tags: string[];
  relationship?: PersonRelationship | null;
  relationPulse?: RelationPulse | null;
}

export interface UpdateContactPayload {
  kind?: ContactKind;
  name?: string;
  tags?: string[];
  relationship?: PersonRelationship | null;
  relationPulse?: RelationPulse | null;
  order?: number;
}

// weekId: "2026-W22", dayId: "2026-05-27"
export interface TaskLocation {
  userId: string;
  weekId: string;
  dayId: string;
  taskId: string;
}

// ��� Finances ���
export type FinanceFlow = 'expense' | 'income';
export type FinanceKind = 'recurring' | 'expected' | 'specific';
export type FinanceFrequency = 'monthly' | 'weekly';

export interface FinanceEntry {
  id: string;
  title: string;
  amount: number;
  currency: string;
  flow: FinanceFlow;
  kind: FinanceKind;
  frequency: FinanceFrequency | null;
  /** monthly: 1�31; weekly: 0�6 (Sun�Sat) */
  recurrenceDay: number | null;
  entryDate: string | null;
  notes: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFinanceEntryPayload {
  title: string;
  amount: number;
  currency?: string;
  flow: FinanceFlow;
  kind: FinanceKind;
  frequency?: FinanceFrequency | null;
  recurrenceDay?: number | null;
  entryDate?: string | null;
  notes?: string;
  active?: boolean;
}

export interface UpdateFinanceEntryPayload {
  title?: string;
  amount?: number;
  currency?: string;
  flow?: FinanceFlow;
  kind?: FinanceKind;
  frequency?: FinanceFrequency | null;
  recurrenceDay?: number | null;
  entryDate?: string | null;
  notes?: string;
  active?: boolean;
}

export interface FinanceMonthSummary {
  monthId: string;
  currency: string;
  incomeRecurring: number;
  incomeExpected: number;
  incomeSpecific: number;
  expenseRecurring: number;
  expenseExpected: number;
  expenseSpecific: number;
  totalIncome: number;
  totalExpense: number;
  balance: number;
}
