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

  // Acciones generales
  action_add_task: string;
  action_new_project: string;
  action_save: string;
  action_cancel: string;
  action_delete: string;
  action_edit: string;
  action_today: string;
  action_sign_out: string;
  action_sign_in: string;

  // Layout / Board
  board_week_view: string;
  board_month_view: string;
  board_next_week: string;
  board_prev_week: string;
  board_add_task: string;

  // Tarea
  task_title_placeholder: string;
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
  task_repeat_every: string;
  task_repeat_unit_days: string;
  task_repeat_unit_weeks: string;
  task_repeat_unit_months: string;
  task_complete_hint: string;
  task_uncomplete_hint: string;

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
  settings_none: string;

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

  action_add_task: 'Añadir tarea',
  action_new_project: 'Nuevo proyecto',
  action_save: 'Guardar',
  action_cancel: 'Cancelar',
  action_delete: 'Eliminar',
  action_edit: 'Editar',
  action_today: 'Hoy',
  action_sign_out: 'Cerrar sesión',
  action_sign_in: 'Iniciar sesión',

  board_week_view: 'Semana',
  board_month_view: 'Mes',
  board_next_week: 'Semana siguiente',
  board_prev_week: 'Semana anterior',
  board_add_task: 'Añadir tarea',

  task_title_placeholder: 'Título de la tarea…',
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
  task_repeat_every: 'Cada',
  task_repeat_unit_days: 'días',
  task_repeat_unit_weeks: 'semanas',
  task_repeat_unit_months: 'meses',
  task_complete_hint: 'Clic para marcar como completada',
  task_uncomplete_hint: 'Clic para desmarcar',

  settings_account: 'Cuenta',
  settings_plan: 'Plan',
  settings_preferences: 'Preferencias',
  settings_status: 'Estado',
  settings_language: 'Idioma',
  settings_language_es: 'Español',
  settings_language_en: 'English',
  settings_week_starts_monday: 'La semana empieza el lunes',
  settings_week_starts_monday_desc: 'Si lo desactivás, el board empieza el domingo.',
  settings_auto_roll: 'Auto-roll de tareas incompletas',
  settings_auto_roll_desc: 'Domingos 23:59 mueve las pendientes al lunes siguiente.',
  settings_default_project: 'Proyecto por defecto',
  settings_none: 'Ninguno',

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
  dashboard_no_tasks_today: 'No tenés tareas para hoy. Disfrutá el día o creá una nueva.',
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

  action_add_task: 'Add task',
  action_new_project: 'New project',
  action_save: 'Save',
  action_cancel: 'Cancel',
  action_delete: 'Delete',
  action_edit: 'Edit',
  action_today: 'Today',
  action_sign_out: 'Sign out',
  action_sign_in: 'Sign in',

  board_week_view: 'Week',
  board_month_view: 'Month',
  board_next_week: 'Next week',
  board_prev_week: 'Previous week',
  board_add_task: 'Add task',

  task_title_placeholder: 'Task title…',
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
  task_repeat_every: 'Every',
  task_repeat_unit_days: 'days',
  task_repeat_unit_weeks: 'weeks',
  task_repeat_unit_months: 'months',
  task_complete_hint: 'Click to mark as completed',
  task_uncomplete_hint: 'Click to unmark',

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
  settings_none: 'None',

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
