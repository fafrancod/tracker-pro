import { es, enUS, type Locale } from 'date-fns/locale';
import type { Language } from '@core/types';

export const LOCALES: Record<Language, Locale> = {
  es,
  en: enUS,
};

export interface TranslationDict {
  // Navegacion
  nav_summary: string;
  nav_tasks: string;
  nav_projects: string;
  nav_analytics: string;
  nav_activity: string;
  nav_settings: string;
  nav_admin: string;
  nav_eisenhower: string;

  // Acciones generales
  action_add_task: string;
  action_add_reminder: string;
  action_new_project: string;
  action_save: string;
  action_cancel: string;
  action_close: string;
  action_delete: string;
  action_edit: string;
  action_today: string;
  action_sign_out: string;
  action_sign_in: string;
  action_undo: string;
  action_redo: string;
  pwa_install_title: string;
  pwa_install_desc: string;
  pwa_install_action: string;
  offline_banner: string;
  offline_pending: string;
  offline_sync_now: string;
  offline_synced: string;

  // Layout / Board
  board_week_view: string;
  board_month_view: string;
  board_continuous_view: string;
  board_day_view: string;
  board_next_week: string;
  board_prev_week: string;
  board_prev_day: string;
  board_next_day: string;
  board_add_task: string;
  layout_list: string;
  layout_schedule: string;
  schedule_all_day: string;
  board_filter_project: string;
  board_filter_urgency: string;
  board_filter_importance: string;
  board_filter_all: string;

  // Context menu tareas
  task_ctx_mark_complete: string;
  task_ctx_mark_pending: string;
  task_ctx_edit: string;
  task_ctx_delete: string;

  // Tarea
  task_title_placeholder: string;
  task_title_label: string;
  task_reminder_placeholder: string;
  task_kind_task: string;
  task_kind_reminder: string;
  task_color: string;
  task_color_auto: string;
  task_priority_low: string;
  task_priority_medium: string;
  task_priority_high: string;
  task_notes: string;
  task_no_project: string;
  task_move_to: string;
  task_move_next_week: string;
  task_duplicate: string;
  task_repeat: string;
  task_repeat_none: string;
  task_repeat_daily: string;
  task_repeat_weekly: string;
  task_repeat_monthly: string;
  task_repeat_yearly: string;
  task_repeat_every: string;
  task_repeat_unit_days: string;
  task_repeat_unit_weeks: string;
  task_repeat_unit_months: string;
  task_repeat_unit_years: string;
  task_complete_hint: string;
  task_uncomplete_hint: string;
  task_start_date: string;
  task_end_date: string;
  task_date_range: string;
  task_schedule: string;
  task_start_time: string;
  task_end_time: string;
  task_clear_time: string;
  task_continues: string;
  task_span_recurrence_hint: string;
  task_create_title: string;
  task_detail_title: string;
  task_part_of_series: string;
  task_save_this: string;
  task_save_series: string;
  task_save_scope_hint: string;
  task_saved_instance: string;
  task_saved_series: string;
  task_save_error: string;
  task_discard_changes: string;
  task_title_required: string;
  task_priority_label: string;
  task_project_label: string;
  task_tags_placeholder: string;
  task_notes_placeholder: string;
  task_duplicated: string;
  task_deleted: string;
  task_delete_confirm: string;
  task_moved: string;
  task_moved_next_week: string;
  task_moved_from: string;
  task_complete: string;
  task_uncomplete: string;
  task_completed_at: string;
  task_last_updated: string;

  // Historial / Bitácora
  history_title: string;
  history_session_hint: string;
  history_empty: string;
  history_you_are_here: string;
  history_past: string;
  history_future: string;
  history_jump: string;

  // Settings sections
  settings_account: string;
  settings_plan: string;
  settings_preferences: string;
  settings_status: string;
  settings_language: string;
  settings_language_es: string;
  settings_language_en: string;
  settings_week_starts_monday: string;
  settings_week_starts_monday_desc: string;
  settings_auto_roll: string;
  settings_auto_roll_desc: string;
  settings_default_project: string;
  settings_default_board_view: string;
  settings_default_board_view_desc: string;
  settings_none: string;
  settings_skin: string;
  settings_skin_desc: string;
  settings_skin_dark: string;
  settings_skin_light: string;
  settings_day_start_hour: string;
  settings_day_end_hour: string;
  settings_schedule_hours_desc: string;
  settings_default_schedule_layout: string;
  settings_default_schedule_layout_desc: string;

  // Urgencia / importancia
  urgency_urgent: string;
  urgency_not_urgent: string;
  importance_important: string;
  importance_not_important: string;

  // Eisenhower
  eisenhower_title: string;
  eisenhower_project: string;
  eisenhower_all_projects: string;
  eisenhower_do: string;
  eisenhower_schedule: string;
  eisenhower_delegate: string;
  eisenhower_eliminate: string;
  eisenhower_uncategorized: string;
  eisenhower_empty: string;
  eisenhower_hint: string;

  // Estados
  status_demo: string;
  status_production: string;
  status_ok: string;
  status_offline: string;
  status_checking: string;

  // Resumen / Dashboard
  dashboard_title: string;
  dashboard_today: string;
  dashboard_this_week: string;
  dashboard_streak: string;
  dashboard_completed: string;
  dashboard_pending: string;
  dashboard_completion_rate: string;
  dashboard_no_tasks_today: string;
  dashboard_jump_to_board: string;

  // Generales
  empty_no_tasks: string;
  empty_no_projects: string;
}

const es_dict: TranslationDict = {
  nav_summary: 'Resumen',
  nav_tasks: 'Tareas',
  nav_projects: 'Proyectos',
  nav_analytics: 'Analytics',
  nav_activity: 'Bitácora',
  nav_settings: 'Config',
  nav_admin: 'Admin',
  nav_eisenhower: 'Eisenhower',

  action_add_task: 'Añadir tarea',
  action_add_reminder: 'Añadir recordatorio',
  action_new_project: 'Nuevo proyecto',
  action_save: 'Guardar',
  action_cancel: 'Cancelar',
  action_close: 'Cerrar',
  action_delete: 'Eliminar',
  action_edit: 'Editar',
  action_today: 'Hoy',
  action_sign_out: 'Cerrar sesión',
  action_sign_in: 'Iniciar sesión',
  action_undo: 'Deshacer',
  action_redo: 'Rehacer',
  pwa_install_title: 'Instalar Daily Tracker',
  pwa_install_desc: 'Ábrela como app desde tu pantalla de inicio.',
  pwa_install_action: 'Instalar',
  offline_banner: 'Sin conexión. Los cambios se guardan y se envían al volver.',
  offline_pending: '{n} cambio(s) pendientes de sincronizar',
  offline_sync_now: 'Sincronizar',
  offline_synced: 'Sincronizados {n} cambio(s)',

  board_week_view: 'Semana',
  board_month_view: 'Mes',
  board_continuous_view: 'Continuo',
  board_day_view: 'Día',
  board_next_week: 'Semana siguiente',
  board_prev_week: 'Semana anterior',
  board_prev_day: 'Día anterior',
  board_next_day: 'Día siguiente',
  board_add_task: 'Añadir tarea',
  layout_list: 'Lista',
  layout_schedule: 'Horario',
  schedule_all_day: 'Sin hora',
  board_filter_project: 'Proyecto',
  board_filter_urgency: 'Urgencia',
  board_filter_importance: 'Importancia',
  board_filter_all: 'Todos',

  task_ctx_mark_complete: 'Marcar como completada',
  task_ctx_mark_pending: 'Marcar como pendiente',
  task_ctx_edit: 'Editar',
  task_ctx_delete: 'Eliminar',

  task_title_placeholder: '¿Qué quieres hacer?',
  task_title_label: 'Título',
  task_reminder_placeholder: '¿De qué quieres que te acuerdes?',
  task_kind_task: 'Tarea',
  task_kind_reminder: 'Recordatorio',
  task_color: 'Color',
  task_color_auto: 'Automático',
  task_priority_low: 'Baja',
  task_priority_medium: 'Media',
  task_priority_high: 'Alta',
  task_notes: 'Notas',
  task_no_project: 'Sin proyecto',
  task_move_to: 'Mover a',
  task_move_next_week: 'Semana siguiente →',
  task_duplicate: 'Duplicar',
  task_repeat: 'Repetición',
  task_repeat_none: 'Sin repetir',
  task_repeat_daily: 'Cada día',
  task_repeat_weekly: 'Cada semana',
  task_repeat_monthly: 'Cada mes',
  task_repeat_yearly: 'Cada año',
  task_repeat_every: 'Cada',
  task_repeat_unit_days: 'días',
  task_repeat_unit_weeks: 'semanas',
  task_repeat_unit_months: 'meses',
  task_repeat_unit_years: 'años',
  task_complete_hint: 'Clic derecho para opciones',
  task_uncomplete_hint: 'Clic derecho para opciones',
  task_start_date: 'Inicio',
  task_end_date: 'Fin',
  task_date_range: 'Rango de fechas',
  task_schedule: 'Horario',
  task_start_time: 'Hora inicio',
  task_end_time: 'Hora fin',
  task_clear_time: 'Quitar hora',
  task_continues: 'Continúa',
  task_span_recurrence_hint:
    'En rangos de varios días solo puedes repetir cada mes, cada año o no repetir.',
  task_create_title: 'Nueva entrada',
  task_detail_title: 'Detalle de tarea',
  task_part_of_series: 'serie recurrente',
  task_save_this: 'Guardar solo este',
  task_save_series: 'Guardar en toda la serie',
  task_save_scope_hint:
    'Esta tarea forma parte de una serie. Elige si los cambios aplican solo a este evento o a todos.',
  task_saved_instance: 'Cambios guardados en este evento.',
  task_saved_series: 'Cambios aplicados a toda la serie.',
  task_save_error: 'No pudimos guardar los cambios.',
  task_discard_changes: 'Descartar cambios',
  task_title_required: 'El título no puede estar vacío.',
  task_priority_label: 'Prioridad',
  task_project_label: 'Proyecto',
  task_tags_placeholder: 'Enter o , para agregar…',
  task_notes_placeholder: 'Notas, ideas, links…',
  task_duplicated: 'Tarea duplicada.',
  task_deleted: 'Tarea eliminada.',
  task_delete_confirm: '¿Eliminar',
  task_moved: 'Tarea movida.',
  task_moved_next_week: 'Movida a la próxima semana.',
  task_moved_from: 'Movida desde',
  task_complete: 'Completar',
  task_uncomplete: 'Desmarcar',
  task_completed_at: 'Completada',
  task_last_updated: 'Última actualización',

  history_title: 'Bitácora',
  history_session_hint: 'Historial de esta sesión. Se borra al recargar la página.',
  history_empty: 'Aún no hay acciones en esta sesión.',
  history_you_are_here: 'Estás aquí',
  history_past: 'Hecho',
  history_future: 'Por rehacer',
  history_jump: 'Ir a este punto',

  settings_account: 'Cuenta',
  settings_plan: 'Plan',
  settings_preferences: 'Preferencias',
  settings_status: 'Estado',
  settings_language: 'Idioma',
  settings_language_es: 'Español',
  settings_language_en: 'English',
  settings_week_starts_monday: 'La semana empieza el lunes',
  settings_week_starts_monday_desc: 'Si lo desactivas, el tablero empieza el domingo.',
  settings_auto_roll: 'Auto-roll de tareas incompletas',
  settings_auto_roll_desc: 'Los domingos a las 23:59 mueve las pendientes al lunes siguiente.',
  settings_default_project: 'Proyecto por defecto',
  settings_default_board_view: 'Vista del tablero por defecto',
  settings_default_board_view_desc: 'Cómo se abre el tablero al entrar en Tareas.',
  settings_none: 'Ninguno',
  settings_skin: 'Apariencia',
  settings_skin_desc: 'Elige un skin claro u oscuro. Se aplica de inmediato en toda la app.',
  settings_skin_dark: 'Oscuros',
  settings_skin_light: 'Claros',
  settings_day_start_hour: 'Inicio de la grilla horaria',
  settings_day_end_hour: 'Fin de la grilla horaria',
  settings_schedule_hours_desc:
    'Define desde qué hora se muestra el calendario semanal y diario en modo Horario (por defecto 7:00–22:00).',
  settings_default_schedule_layout: 'Layout lista / horario',
  settings_default_schedule_layout_desc:
    'Cómo se abren las vistas Día y Semana: lista de actividades o grilla por horas.',

  urgency_urgent: 'Urgente',
  urgency_not_urgent: 'No urgente',
  importance_important: 'Importante',
  importance_not_important: 'No importante',

  eisenhower_title: 'Matriz Eisenhower',
  eisenhower_project: 'Proyecto',
  eisenhower_all_projects: 'Todos',
  eisenhower_do: 'Urgente e importante',
  eisenhower_schedule: 'No urgente e importante',
  eisenhower_delegate: 'Urgente y no importante',
  eisenhower_eliminate: 'No urgente y no importante',
  eisenhower_uncategorized: 'Sin categorizar',
  eisenhower_empty: 'No hay tareas en este cuadrante.',
  eisenhower_hint: 'Haz clic en una tarea o mueve a un cuadrante para asignar urgencia e importancia.',

  status_demo: 'Demo',
  status_production: 'Producción',
  status_ok: 'OK',
  status_offline: 'Sin conexión',
  status_checking: 'Comprobando…',

  dashboard_title: 'Resumen',
  dashboard_today: 'Hoy',
  dashboard_this_week: 'Esta semana',
  dashboard_streak: 'Racha',
  dashboard_completed: 'Completadas',
  dashboard_pending: 'Pendientes',
  dashboard_completion_rate: 'Progreso',
  dashboard_no_tasks_today: 'No tienes tareas para hoy. Disfruta el día o crea una nueva.',
  dashboard_jump_to_board: 'Ir al tablero',

  empty_no_tasks: 'Aún no hay tareas.',
  empty_no_projects: 'Aún no hay proyectos.',
};

const en_dict: TranslationDict = {
  nav_summary: 'Summary',
  nav_tasks: 'Tasks',
  nav_projects: 'Projects',
  nav_analytics: 'Analytics',
  nav_activity: 'Activity',
  nav_settings: 'Settings',
  nav_admin: 'Admin',
  nav_eisenhower: 'Eisenhower',

  action_add_task: 'Add task',
  action_add_reminder: 'Add reminder',
  action_new_project: 'New project',
  action_save: 'Save',
  action_cancel: 'Cancel',
  action_close: 'Close',
  action_delete: 'Delete',
  action_edit: 'Edit',
  action_today: 'Today',
  action_sign_out: 'Sign out',
  action_sign_in: 'Sign in',
  action_undo: 'Undo',
  action_redo: 'Redo',
  pwa_install_title: 'Install Daily Tracker',
  pwa_install_desc: 'Open it like an app from your home screen.',
  pwa_install_action: 'Install',
  offline_banner: 'You are offline. Changes are saved and will sync when you reconnect.',
  offline_pending: '{n} change(s) waiting to sync',
  offline_sync_now: 'Sync now',
  offline_synced: 'Synced {n} change(s)',

  board_week_view: 'Week',
  board_month_view: 'Month',
  board_continuous_view: 'Continuous',
  board_day_view: 'Day',
  board_next_week: 'Next week',
  board_prev_week: 'Previous week',
  board_prev_day: 'Previous day',
  board_next_day: 'Next day',
  board_add_task: 'Add task',
  layout_list: 'List',
  layout_schedule: 'Schedule',
  schedule_all_day: 'No time',
  board_filter_project: 'Project',
  board_filter_urgency: 'Urgency',
  board_filter_importance: 'Importance',
  board_filter_all: 'All',

  task_ctx_mark_complete: 'Mark as completed',
  task_ctx_mark_pending: 'Mark as pending',
  task_ctx_edit: 'Edit',
  task_ctx_delete: 'Delete',

  task_title_placeholder: 'What do you want to do?',
  task_title_label: 'Title',
  task_reminder_placeholder: 'What should we remind you of?',
  task_kind_task: 'Task',
  task_kind_reminder: 'Reminder',
  task_color: 'Color',
  task_color_auto: 'Auto',
  task_priority_low: 'Low',
  task_priority_medium: 'Med',
  task_priority_high: 'High',
  task_notes: 'Notes',
  task_no_project: 'No project',
  task_move_to: 'Move to',
  task_move_next_week: 'Next week →',
  task_duplicate: 'Duplicate',
  task_repeat: 'Repeat',
  task_repeat_none: 'Does not repeat',
  task_repeat_daily: 'Daily',
  task_repeat_weekly: 'Weekly',
  task_repeat_monthly: 'Monthly',
  task_repeat_yearly: 'Yearly',
  task_repeat_every: 'Every',
  task_repeat_unit_days: 'days',
  task_repeat_unit_weeks: 'weeks',
  task_repeat_unit_months: 'months',
  task_repeat_unit_years: 'years',
  task_complete_hint: 'Right-click for options',
  task_uncomplete_hint: 'Right-click for options',
  task_start_date: 'Start',
  task_end_date: 'End',
  task_date_range: 'Date range',
  task_schedule: 'Schedule',
  task_start_time: 'Start time',
  task_end_time: 'End time',
  task_clear_time: 'Clear time',
  task_continues: 'Continues',
  task_span_recurrence_hint:
    'Multi-day ranges only support monthly, yearly, or no recurrence.',
  task_create_title: 'New entry',
  task_detail_title: 'Task detail',
  task_part_of_series: 'recurring series',
  task_save_this: 'Save this only',
  task_save_series: 'Save to entire series',
  task_save_scope_hint:
    'This task is part of a series. Choose whether changes apply only to this event or to all.',
  task_saved_instance: 'Changes saved on this event.',
  task_saved_series: 'Changes applied to the entire series.',
  task_save_error: 'We could not save the changes.',
  task_discard_changes: 'Discard changes',
  task_title_required: 'Title cannot be empty.',
  task_priority_label: 'Priority',
  task_project_label: 'Project',
  task_tags_placeholder: 'Enter or , to add…',
  task_notes_placeholder: 'Notes, ideas, links…',
  task_duplicated: 'Task duplicated.',
  task_deleted: 'Task deleted.',
  task_delete_confirm: 'Delete',
  task_moved: 'Task moved.',
  task_moved_next_week: 'Moved to next week.',
  task_moved_from: 'Moved from',
  task_complete: 'Complete',
  task_uncomplete: 'Mark incomplete',
  task_completed_at: 'Completed',
  task_last_updated: 'Last updated',

  history_title: 'Activity log',
  history_session_hint: 'Session history only. It clears when you reload the page.',
  history_empty: 'No actions in this session yet.',
  history_you_are_here: 'You are here',
  history_past: 'Done',
  history_future: 'Redo stack',
  history_jump: 'Jump to this point',

  settings_account: 'Account',
  settings_plan: 'Plan',
  settings_preferences: 'Preferences',
  settings_status: 'Status',
  settings_language: 'Language',
  settings_language_es: 'Spanish',
  settings_language_en: 'English',
  settings_week_starts_monday: 'Week starts on Monday',
  settings_week_starts_monday_desc: 'If disabled, the board starts on Sunday.',
  settings_auto_roll: 'Auto-roll incomplete tasks',
  settings_auto_roll_desc: 'Sundays 23:59 move pending tasks to the next Monday.',
  settings_default_project: 'Default project',
  settings_default_board_view: 'Default board view',
  settings_default_board_view_desc: 'How the board opens when you go to Tasks.',
  settings_none: 'None',
  settings_skin: 'Appearance',
  settings_skin_desc: 'Pick a light or dark skin. Applies immediately across the app.',
  settings_skin_dark: 'Dark',
  settings_skin_light: 'Light',
  settings_day_start_hour: 'Schedule grid start',
  settings_day_end_hour: 'Schedule grid end',
  settings_schedule_hours_desc:
    'Choose the hour range for week and day schedule views (default 7:00–22:00).',
  settings_default_schedule_layout: 'List / schedule layout',
  settings_default_schedule_layout_desc:
    'How Day and Week views open: activity list or hourly grid.',

  urgency_urgent: 'Urgent',
  urgency_not_urgent: 'Not urgent',
  importance_important: 'Important',
  importance_not_important: 'Not important',

  eisenhower_title: 'Eisenhower matrix',
  eisenhower_project: 'Project',
  eisenhower_all_projects: 'All',
  eisenhower_do: 'Urgent & important',
  eisenhower_schedule: 'Not urgent & important',
  eisenhower_delegate: 'Urgent & not important',
  eisenhower_eliminate: 'Not urgent & not important',
  eisenhower_uncategorized: 'Uncategorized',
  eisenhower_empty: 'No tasks in this quadrant.',
  eisenhower_hint: 'Click a task or move it into a quadrant to set urgency and importance.',

  status_demo: 'Demo',
  status_production: 'Production',
  status_ok: 'OK',
  status_offline: 'Offline',
  status_checking: 'Checking…',

  dashboard_title: 'Summary',
  dashboard_today: 'Today',
  dashboard_this_week: 'This week',
  dashboard_streak: 'Streak',
  dashboard_completed: 'Completed',
  dashboard_pending: 'Pending',
  dashboard_completion_rate: 'Progress',
  dashboard_no_tasks_today: 'No tasks for today. Enjoy your day or add one.',
  dashboard_jump_to_board: 'Go to board',

  empty_no_tasks: 'No tasks yet.',
  empty_no_projects: 'No projects yet.',
};

export const DICTS: Record<Language, TranslationDict> = {
  es: es_dict,
  en: en_dict,
};

export type TKey = keyof TranslationDict;

export function getDict(lang: Language): TranslationDict {
  return DICTS[lang] ?? DICTS.es;
}

export function getLocale(lang: Language): Locale {
  return LOCALES[lang] ?? LOCALES.es;
}

/** Capitaliza la primera letra (útil para días en español, donde date-fns devuelve minúscula). */
export function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
