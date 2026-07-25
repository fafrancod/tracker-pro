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
  nav_notifications: string;
  nav_memento: string;
  nav_life_goals: string;
  nav_reflections: string;

  // Memento mori
  memento_title: string;
  memento_subtitle: string;
  memento_weeks_lived: string;
  memento_weeks_left: string;
  memento_weeks_short: string;
  memento_age: string;
  memento_years: string;
  memento_percent: string;
  memento_no_birthdate: string;
  memento_go_settings: string;
  memento_quote_title: string;
  memento_legend_lived: string;
  memento_legend_current: string;
  memento_legend_left: string;
  memento_legend_milestone: string;
  memento_legend_goal: string;
  memento_milestones_hint: string;
  memento_lifespan_note: string;
  memento_past_expectation: string;
  memento_tab_map: string;
  memento_tab_goals: string;
  memento_goals_on_map: string;
  memento_manage_goals: string;
  memento_goal_hover_hint: string;
  memento_goal_preview_title: string;
  memento_goal_preview_title_multi: string;
  memento_goal_preview_desc: string;
  memento_goal_preview_aria: string;
  memento_goal_preview_no_manifestation: string;
  life_goals_title: string;
  life_goals_subtitle: string;
  life_goals_empty: string;
  life_goals_empty_hint: string;
  life_goal_add: string;
  life_goal_new: string;
  life_goal_edit: string;
  life_goal_title_label: string;
  life_goal_title_placeholder: string;
  life_goal_manifestation: string;
  life_goal_manifestation_placeholder: string;
  life_goal_date: string;
  life_goal_color: string;
  life_goal_kind: string;
  life_goal_kind_goal: string;
  life_goal_kind_manifestation: string;
  life_goal_kind_milestone: string;
  life_goal_kind_vision: string;
  life_goal_photo: string;
  life_goal_add_photo: string;
  life_goal_change_photo: string;
  life_goal_remove_photo: string;
  life_goal_compressing: string;
  life_goal_saved: string;
  life_goal_save_error: string;
  life_goal_title_required: string;
  life_goal_date_required: string;
  life_goal_date_out_of_map: string;
  life_goal_limit: string;
  life_goal_delete_confirm: string;
  life_goal_image_error: string;
  life_goal_saving: string;
  life_goal_need_birthdate: string;
  life_goal_off_map: string;

  // Reflexiones y ánimo
  reflections_title: string;
  reflections_subtitle: string;
  reflections_prev_day: string;
  reflections_next_day: string;
  reflections_go_today: string;
  reflections_week_strip: string;
  reflections_day_avg: string;
  reflections_hours_logged: string;
  mood_hourly_title: string;
  mood_hourly_hint: string;
  mood_pick_for_hour: string;
  mood_hour_note: string;
  mood_hour_note_placeholder: string;
  mood_level_1: string;
  mood_level_2: string;
  mood_level_3: string;
  mood_level_4: string;
  mood_level_5: string;
  reflection_daily_title: string;
  reflection_daily_placeholder: string;
  reflection_gratitude_title: string;
  reflection_gratitude_placeholder: string;
  reflections_saved: string;
  reflections_save_error: string;
  reflections_unsaved: string;
  reflections_synced: string;
  metric_mood: string;
  metric_energy: string;
  energy_hourly_title: string;
  energy_hourly_hint: string;
  energy_pick_for_hour: string;
  energy_day_avg: string;
  energy_level_1: string;
  energy_level_2: string;
  energy_level_3: string;
  energy_level_4: string;
  energy_level_5: string;
  sleep_title: string;
  sleep_hint: string;
  sleep_hours_label: string;
  sleep_not_set: string;
  sleep_recorded: string;
  wellbeing_panel_title: string;
  wellbeing_panel_subtitle: string;
  wellbeing_open_journal: string;
  wellbeing_kpi_mood: string;
  wellbeing_kpi_energy: string;
  wellbeing_kpi_sleep: string;
  wellbeing_days_short: string;
  wellbeing_chart_mood: string;
  wellbeing_chart_energy: string;
  wellbeing_chart_sleep: string;
  wellbeing_messages_title: string;
  wellbeing_start_logging: string;
  wellbeing_msg_no_data: string;
  wellbeing_msg_great_mood: string;
  wellbeing_msg_mood_up: string;
  wellbeing_msg_mood_down: string;
  wellbeing_msg_energy_low: string;
  wellbeing_msg_energy_high: string;
  wellbeing_msg_sleep_low: string;
  wellbeing_msg_sleep_good: string;
  wellbeing_msg_balanced: string;
  wellbeing_msg_keep_logging: string;

  settings_birth_date: string;
  settings_birth_date_desc: string;
  settings_lifespan: string;
  settings_lifespan_desc: string;

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
  pwa_update_title: string;
  pwa_update_desc: string;
  pwa_update_action: string;
  pwa_update_applying: string;
  pwa_settings_title: string;
  pwa_settings_desc: string;
  pwa_check_updates: string;
  pwa_check_updates_ok: string;
  pwa_check_updates_found: string;
  pwa_check_updates_error: string;
  pwa_hard_reset: string;
  pwa_hard_reset_desc: string;
  pwa_hard_reset_confirm: string;
  pwa_hard_reset_running: string;
  pwa_installed_badge: string;
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
  board_filter_category: string;
  board_filter_category_all: string;
  board_filter_category_projects: string;
  board_filter_category_rx: string;
  board_category_rx_hint: string;

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
  task_kind_rx_human: string;
  task_kind_rx_pet: string;
  rx_medicine_name: string;
  rx_medicine_placeholder: string;
  rx_patient_name: string;
  rx_patient_placeholder: string;
  rx_pet_name: string;
  rx_pet_placeholder: string;
  rx_phases_hint: string;
  rx_phase: string;
  rx_amount: string;
  rx_unit: string;
  rx_unit_pills: string;
  rx_unit_ml: string;
  rx_days: string;
  rx_times: string;
  rx_add_time: string;
  rx_add_phase: string;
  rx_edit_plan: string;
  rx_this_dose: string;
  rx_apply_plan: string;
  rx_apply_plan_hint: string;
  rx_plan_saved: string;
  rx_plan_error: string;
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
  time_now: string;
  task_time_range_error: string;
  task_created_ok: string;

  // Centralizador de notificaciones
  notify_hub_title: string;
  notify_hub_intro: string;
  notify_hub_upcoming: string;
  notify_hub_reschedule: string;
  notify_hub_loading: string;
  notify_hub_empty: string;
  notify_hub_load_error: string;
  notify_hub_prefs_saved: string;
  notify_hub_program_title: string;
  notify_hub_scope: string;
  notify_hub_hint: string;
  notify_hub_filter_all: string;
  notify_hub_filter_tasks: string;
  notify_hub_filter_rx: string;
  notify_hub_filter_projects: string;
  notify_hub_any_project: string;
  notify_hub_fires_at: string;
  notify_hub_event_at: string;
  notify_mode_before: string;
  notify_mode_day_before: string;
  notify_mode_past: string;
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
  settings_notifications: string;
  settings_notify_local: string;
  settings_notify_local_desc: string;
  settings_notify_email: string;
  settings_notify_email_desc: string;
  settings_notify_minutes: string;
  settings_notify_minutes_desc: string;
  settings_notify_before_enabled: string;
  settings_notify_before_enabled_desc: string;
  settings_notify_day_before: string;
  settings_notify_day_before_desc: string;
  settings_notify_day_before_time: string;
  settings_notify_past: string;
  settings_notify_past_desc: string;
  settings_notify_past_after: string;
  settings_notify_tasks: string;
  settings_notify_tasks_desc: string;
  settings_notify_rx: string;
  settings_notify_rx_desc: string;
  settings_notify_timezone: string;
  settings_notify_timezone_desc: string;
  settings_notify_timezone_device: string;
  settings_notify_enable_device: string;
  rx_pet_tag_hint: string;
  rx_plan_start: string;
  rx_plan_duration: string;
  rx_plan_duration_value: string;
  settings_notify_permission_denied: string;
  settings_notify_test_email: string;
  settings_notify_test_email_sent: string;
  settings_notify_test_email_skipped: string;
  settings_notify_test_email_error: string;
  settings_notify_local_scheduled: string;
  settings_notify_modes_title: string;

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
  dashboard_doses_today: string;
  dashboard_no_doses_today: string;
  dashboard_dose_pending: string;
  dashboard_dose_done: string;

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
  nav_notifications: 'Avisos',
  nav_memento: 'Memento mori',
  nav_life_goals: 'Metas de vida',
  nav_reflections: 'Reflexiones',

  memento_title: 'Memento mori',
  memento_subtitle: 'Cada cuadrado es una semana de tu vida. Vive con intención.',
  memento_weeks_lived: 'Semanas vividas',
  memento_weeks_left: 'Semanas restantes',
  memento_weeks_short: 'sem.',
  memento_age: 'Edad',
  memento_years: 'años',
  memento_percent: '% vida estimada',
  memento_no_birthdate:
    'Configura tu fecha de nacimiento en Config para ver el mapa de semanas vividas y por vivir.',
  memento_go_settings: 'Ir a Config',
  memento_quote_title: 'Frase estoica del día',
  memento_legend_lived: 'Vividas',
  memento_legend_current: 'Esta semana',
  memento_legend_left: 'Por vivir',
  memento_legend_milestone: 'Cumpleaños ×5 (35, 40…)',
  memento_legend_goal: 'Meta de vida',
  memento_milestones_hint: 'Hitos marcados: {ages} años.',
  memento_lifespan_note: 'Basado en {years} años de esperanza de vida (ajustable en Config).',
  memento_past_expectation: 'Has superado la esperanza configurada: celebra cada semana extra.',
  memento_tab_map: 'Mapa de semanas',
  memento_tab_goals: 'Metas de vida',
  memento_goals_on_map: '{n} semana(s) con meta marcada en el mapa.',
  memento_manage_goals: 'Gestionar metas',
  memento_goal_hover_hint:
    'Mantén el ratón sobre un cuadrado de meta para ver el detalle; al salir se cierra.',
  memento_goal_preview_title: 'Meta de vida',
  memento_goal_preview_title_multi: '{n} metas en esta semana',
  memento_goal_preview_desc: 'Lo que definiste para este hito en el mapa de semanas.',
  memento_goal_preview_aria: 'Ver meta: {title}',
  memento_goal_preview_no_manifestation: 'Sin texto de manifestación.',
  life_goals_title: 'Metas de vida',
  life_goals_subtitle:
    'Define visiones, manifestaciones e hitos con fecha. Cada una se pinta en tu mapa de semanas.',
  life_goals_empty: 'Aún no tienes metas de vida.',
  life_goals_empty_hint:
    'Añade la casa, el viaje, el negocio o la versión de ti que estás construyendo. Con foto y fecha.',
  life_goal_add: 'Nueva meta',
  life_goal_new: 'Nueva meta de vida',
  life_goal_edit: 'Editar meta',
  life_goal_title_label: 'Título',
  life_goal_title_placeholder: 'Ej. Casa propia junto al mar',
  life_goal_manifestation: 'Manifestación / notas',
  life_goal_manifestation_placeholder:
    'Escribe en presente: cómo se siente, qué ves, por qué importa…',
  life_goal_date: 'Fecha objetivo',
  life_goal_color: 'Color en el mapa',
  life_goal_kind: 'Tipo',
  life_goal_kind_goal: 'Meta',
  life_goal_kind_manifestation: 'Manifestación',
  life_goal_kind_milestone: 'Hito',
  life_goal_kind_vision: 'Visión',
  life_goal_photo: 'Imagen',
  life_goal_add_photo: 'Añadir foto o vision board',
  life_goal_change_photo: 'Cambiar imagen',
  life_goal_remove_photo: 'Quitar imagen',
  life_goal_compressing: 'Comprimiendo…',
  life_goal_saved: 'Meta guardada.',
  life_goal_save_error: 'No se pudo guardar la meta.',
  life_goal_title_required: 'Escribe un título para la meta.',
  life_goal_date_required: 'Elige una fecha objetivo.',
  life_goal_date_out_of_map:
    'Esa fecha cae fuera del mapa (revisa nacimiento y esperanza de vida en Config).',
  life_goal_limit: 'Máximo 24 metas de vida.',
  life_goal_delete_confirm: '¿Eliminar esta meta de vida?',
  life_goal_image_error: 'No se pudo procesar la imagen.',
  life_goal_saving: 'Guardando…',
  life_goal_need_birthdate:
    'Para ubicar las metas en el mapa de semanas, configura tu fecha de nacimiento.',
  life_goal_off_map: 'Fuera del mapa',

  reflections_title: 'Reflexiones diarias',
  reflections_subtitle:
    'Ánimo y energía por hora, sueño del día, y cierra con reflexión y gratitud.',
  reflections_prev_day: 'Día anterior',
  reflections_next_day: 'Día siguiente',
  reflections_go_today: 'Ir a hoy',
  reflections_week_strip: 'Últimos 7 días',
  reflections_day_avg: 'Media del día',
  reflections_hours_logged: 'horas registradas',
  mood_hourly_title: 'Estado de ánimo por hora',
  mood_hourly_hint: 'Toca una hora y elige cómo te sientes. Vuelve a pulsar el mismo nivel para borrar.',
  mood_pick_for_hour: 'Ánimo a las {hour}',
  mood_hour_note: 'Nota de esta hora (opcional)',
  mood_hour_note_placeholder: '¿Qué estaba pasando?',
  mood_level_1: 'Muy mal',
  mood_level_2: 'Bajo',
  mood_level_3: 'Neutro',
  mood_level_4: 'Bien',
  mood_level_5: 'Excelente',
  reflection_daily_title: 'Reflexión del día',
  reflection_daily_placeholder:
    '¿Qué aprendí hoy? ¿Qué cuidé? ¿Qué soltaría? Escribe sin filtro…',
  reflection_gratitude_title: 'Gratitud',
  reflection_gratitude_placeholder: 'Tres cosas por las que das gracias hoy…',
  reflections_saved: 'Reflexión guardada.',
  reflections_save_error: 'No se pudo guardar el diario.',
  reflections_unsaved: 'Hay cambios sin guardar.',
  reflections_synced: 'Guardado.',
  metric_mood: 'Ánimo',
  metric_energy: 'Energía',
  energy_hourly_title: 'Nivel de energía por hora',
  energy_hourly_hint:
    'Registra tu energía (aparte del ánimo). Toca una hora y el nivel; otra vez el mismo para borrar.',
  energy_pick_for_hour: 'Energía a las {hour}',
  energy_day_avg: 'Energía media',
  energy_level_1: 'Agotado',
  energy_level_2: 'Bajo',
  energy_level_3: 'Estable',
  energy_level_4: 'Alto',
  energy_level_5: 'Pleno',
  sleep_title: 'Sueño del día',
  sleep_hint: 'Horas aproximadas que dormiste (la noche anterior a este día).',
  sleep_hours_label: 'Horas',
  sleep_not_set: 'Sin registrar',
  sleep_recorded: '{h} h de sueño',
  wellbeing_panel_title: 'Bienestar (semana)',
  wellbeing_panel_subtitle:
    'Resumen de ánimo, energía y sueño de los últimos 7 días, con mensajes de apoyo.',
  wellbeing_open_journal: 'Diario',
  wellbeing_kpi_mood: 'Ánimo',
  wellbeing_kpi_energy: 'Energía',
  wellbeing_kpi_sleep: 'Sueño',
  wellbeing_days_short: 'días',
  wellbeing_chart_mood: 'Ánimo / día',
  wellbeing_chart_energy: 'Energía / día',
  wellbeing_chart_sleep: 'Sueño / día',
  wellbeing_messages_title: 'Mensajes para ti',
  wellbeing_start_logging: 'Empezar a registrar en Reflexiones',
  wellbeing_msg_no_data:
    'Aún no hay datos de bienestar esta semana. Un minuto al día en Reflexiones basta para ver patrones.',
  wellbeing_msg_great_mood:
    'Tu ánimo de la semana es muy sólido. Celebra lo que está funcionando y cuídalo con la misma constancia.',
  wellbeing_msg_mood_up:
    'Tu ánimo va al alza. Sigue con lo que te sostiene: ritmo, descanso y pequeñas victorias.',
  wellbeing_msg_mood_down:
    'Esta semana el ánimo ha pesado más. No hace falta forzar la sonrisa: sé amable contigo y pide apoyo si lo necesitas.',
  wellbeing_msg_energy_low:
    'Tu energía está baja. Prioriza sueño, comida real y menos fricción: menos es más cuando el cuerpo pide recarga.',
  wellbeing_msg_energy_high:
    'Vienes con buena energía. Canalízala en lo importante y deja margen para no quemarte.',
  wellbeing_msg_sleep_low:
    'Estás durmiendo poco. Proteger el sueño es la palanca más barata para ánimo y energía.',
  wellbeing_msg_sleep_good:
    'Tu sueño ronda un rango saludable. Eso es base de todo lo demás: sigue cuidándolo.',
  wellbeing_msg_balanced:
    'Semana equilibrada. Sigue registrando: los datos te ayudan a ajustar sin juicio.',
  wellbeing_msg_keep_logging:
    'Cuantos más días registres, más útil será el resumen. No busques perfección: solo honestidad.',

  settings_birth_date: 'Fecha de nacimiento',
  settings_birth_date_desc:
    'Se usa en Memento mori para calcular las semanas que has vivido y las que quedan.',
  settings_lifespan: 'Esperanza de vida (años)',
  settings_lifespan_desc: 'Solo para dibujar el mapa de semanas (por defecto 80).',

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
  pwa_update_title: 'Nueva versión lista',
  pwa_update_desc: 'Hay actualizaciones (funciones y correcciones). Reinicia para aplicarlas.',
  pwa_update_action: 'Actualizar ahora',
  pwa_update_applying: 'Actualizando…',
  pwa_settings_title: 'App instalada (PWA)',
  pwa_settings_desc:
    'Si la app del escritorio no muestra las últimas funciones, busca actualizaciones o reinstala la caché local.',
  pwa_check_updates: 'Buscar actualizaciones',
  pwa_check_updates_ok: 'Ya tienes la última versión cargada en este dispositivo.',
  pwa_check_updates_found: 'Hay una versión nueva. Pulsa «Actualizar ahora» en el aviso.',
  pwa_check_updates_error: 'No se pudo comprobar actualizaciones. Prueba a reabrir la app.',
  pwa_hard_reset: 'Reinstalar última versión',
  pwa_hard_reset_desc:
    'Borra la caché y el service worker de este dispositivo y recarga la app. Tus datos en la nube no se pierden.',
  pwa_hard_reset_confirm:
    '¿Borrar caché local y recargar la app? Se descargará de nuevo la última versión. Tus tareas en la cuenta se mantienen.',
  pwa_hard_reset_running: 'Reinstalando…',
  pwa_installed_badge: 'Modo app instalada · v{version} · {build}',
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
  board_filter_category: 'Categoría',
  board_filter_category_all: 'Todo',
  board_filter_category_projects: 'Proyectos',
  board_filter_category_rx: 'Recetario',
  board_category_rx_hint:
    'Solo tomas de recetario. Los remedios no usan proyecto ni Eisenhower.',

  task_ctx_mark_complete: 'Marcar como completada',
  task_ctx_mark_pending: 'Marcar como pendiente',
  task_ctx_edit: 'Editar',
  task_ctx_delete: 'Eliminar',

  task_title_placeholder: '¿Qué quieres hacer?',
  task_title_label: 'Título',
  task_reminder_placeholder: '¿De qué quieres que te acuerdes?',
  task_kind_task: 'Tarea',
  task_kind_reminder: 'Recordatorio',
  task_kind_rx_human: 'Rx humano',
  task_kind_rx_pet: 'Rx mascota',
  rx_medicine_name: 'Medicamento',
  rx_medicine_placeholder: 'Ej. Amoxicilina',
  rx_patient_name: 'Paciente (opcional)',
  rx_patient_placeholder: 'Nombre o nota',
  rx_pet_name: 'Mascota',
  rx_pet_placeholder: 'Ej. Luna',
  rx_phases_hint:
    'Cada fase define dosis, horarios y días. Puedes añadir otra fase con dosis distinta (ej. 7 días a 1 pastilla y 7 a media).',
  rx_phase: 'Fase',
  rx_amount: 'Cantidad / sesión',
  rx_unit: 'Unidad',
  rx_unit_pills: 'Pastillas',
  rx_unit_ml: 'ml',
  rx_days: 'Días',
  rx_times: 'Horarios',
  rx_add_time: 'horario',
  rx_add_phase: 'Añadir fase (otra dosis)',
  rx_edit_plan: 'Recetario',
  rx_this_dose: 'Esta toma',
  rx_apply_plan: 'Aplicar plan y regenerar tomas',
  rx_apply_plan_hint:
    'Se regeneran las tomas pendientes desde este día. Las ya completadas se conservan. La hora de cada toma sale del plan de fases.',
  rx_plan_saved: 'Plan actualizado: {n} tomas regeneradas.',
  rx_plan_error: 'No se pudo actualizar el plan del recetario.',
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
  time_now: 'Ahora',
  task_time_range_error: 'La hora de fin debe ser posterior o igual a la de inicio.',
  task_created_ok: 'Tarea guardada.',
  notify_hub_title: 'Central de avisos',
  notify_hub_intro:
    'Consulta y programa recordatorios de tareas, recetarios, recordatorios y proyectos. Los avisos usan tu zona horaria y los modos de antelación, mañana y seguimiento.',
  notify_hub_upcoming: 'Próximos avisos',
  notify_hub_reschedule: 'Reprogramar en dispositivo',
  notify_hub_loading: 'Cargando avisos…',
  notify_hub_empty:
    'No hay avisos programados en los próximos días. Añade horas a tareas o tomas de recetario y activa los modos de recordatorio.',
  notify_hub_load_error: 'No se pudieron cargar las tareas para avisos.',
  notify_hub_prefs_saved: 'Preferencias de avisos guardadas.',
  notify_hub_program_title: 'Programar avisos',
  notify_hub_scope: 'Qué incluir',
  notify_hub_hint:
    'Tip: al completar una toma o tarea, sus avisos pendientes dejan de listarse. El correo se envía desde el servidor según estas preferencias.',
  notify_hub_filter_all: 'Todo',
  notify_hub_filter_tasks: 'Tareas',
  notify_hub_filter_rx: 'Recetario',
  notify_hub_filter_projects: 'Proyectos',
  notify_hub_any_project: 'Cualquier proyecto',
  notify_hub_fires_at: 'Avisa',
  notify_hub_event_at: 'evento',
  notify_mode_before: 'Antes',
  notify_mode_day_before: 'Mañana',
  notify_mode_past: 'Seguimiento',
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
  settings_notifications: 'Notificaciones',
  settings_notify_local: 'Notificaciones en el dispositivo',
  settings_notify_local_desc:
    'Android y navegador: avisos locales de tareas y tomas con hora. En el móvil se programan aunque cierres la app.',
  settings_notify_email: 'Recordatorios por correo',
  settings_notify_email_desc:
    'El servidor te envía un email a la hora (o minutos antes). Funciona en web y Android.',
  settings_notify_minutes: 'Antelación',
  settings_notify_minutes_desc: 'Cuántos minutos antes del horario programado avisar.',
  settings_notify_before_enabled: 'Recordar X minutos antes',
  settings_notify_before_enabled_desc:
    'Aviso justo antes (o en el momento) de cada tarea/toma con hora.',
  settings_notify_day_before: 'Recordar el día anterior',
  settings_notify_day_before_desc:
    '«Recuerda que mañana vas a…» la tarde/noche previa a la actividad.',
  settings_notify_day_before_time: 'Hora del aviso «mañana»',
  settings_notify_past: '¿Ya lo hiciste? (eventos pasados)',
  settings_notify_past_desc:
    'Si pasó la hora y sigue incompleto, te pregunta si ya lo hiciste.',
  settings_notify_past_after: 'Minutos después de la hora',
  settings_notify_tasks: 'Tareas y recordatorios',
  settings_notify_tasks_desc: 'Incluir entradas de proyecto (no solo recetario).',
  settings_notify_rx: 'Tomas del recetario',
  settings_notify_rx_desc: 'Incluir dosis de medicamentos (humano y mascota).',
  settings_notify_timezone: 'Zona horaria',
  settings_notify_timezone_desc:
    'Define tu horario civil para correos y recordatorios («mañana», minutos antes, seguimiento). Debe coincidir con donde vives o trabajas.',
  settings_notify_timezone_device: 'Usar zona del dispositivo',
  settings_notify_enable_device: 'Permitir notificaciones',
  rx_pet_tag_hint:
    'Se guarda como etiqueta reutilizable (también puedes escribir #Nombre en el título).',
  rx_plan_start: 'Inicio del tratamiento',
  rx_plan_duration: 'Duración (según fases)',
  rx_plan_duration_value: '{days} días · hasta {end}',
  settings_notify_permission_denied:
    'Permiso denegado. Actívalo en los ajustes del sistema o del navegador.',
  settings_notify_test_email: 'Enviar correo de prueba',
  settings_notify_test_email_sent: 'Correo de prueba enviado. Revisa tu bandeja.',
  settings_notify_test_email_skipped:
    'El servidor aún no tiene RESEND_API_KEY; no se envió el correo.',
  settings_notify_test_email_error: 'No se pudo enviar el correo de prueba.',
  settings_notify_local_scheduled: 'Recordatorios locales reprogramados: {n}.',
  settings_notify_modes_title: 'Cuándo avisar',

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
  dashboard_doses_today: 'Próximas tomas del día',
  dashboard_no_doses_today: 'No hay tomas de recetario para hoy.',
  dashboard_dose_pending: 'Marcar toma como hecha',
  dashboard_dose_done: 'Desmarcar toma',

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
  nav_notifications: 'Alerts',
  nav_memento: 'Memento mori',
  nav_life_goals: 'Life goals',
  nav_reflections: 'Reflections',

  memento_title: 'Memento mori',
  memento_subtitle: 'Each square is one week of your life. Live with intention.',
  memento_weeks_lived: 'Weeks lived',
  memento_weeks_left: 'Weeks remaining',
  memento_weeks_short: 'wk',
  memento_age: 'Age',
  memento_years: 'years',
  memento_percent: '% of estimated life',
  memento_no_birthdate:
    'Set your birth date in Settings to see the map of weeks lived and weeks left.',
  memento_go_settings: 'Go to Settings',
  memento_quote_title: 'Stoic quote of the day',
  memento_legend_lived: 'Lived',
  memento_legend_current: 'This week',
  memento_legend_left: 'Remaining',
  memento_legend_milestone: '5-year milestones (35, 40…)',
  memento_legend_goal: 'Life goal',
  memento_milestones_hint: 'Milestones marked: ages {ages}.',
  memento_lifespan_note: 'Based on {years} years of life expectancy (adjustable in Settings).',
  memento_past_expectation: 'You have passed the configured expectancy — celebrate every extra week.',
  memento_tab_map: 'Week map',
  memento_tab_goals: 'Life goals',
  memento_goals_on_map: '{n} week(s) with a goal on the map.',
  memento_manage_goals: 'Manage goals',
  memento_goal_hover_hint:
    'Keep the pointer on a goal square to preview it; move away to close.',
  memento_goal_preview_title: 'Life goal',
  memento_goal_preview_title_multi: '{n} goals in this week',
  memento_goal_preview_desc: 'What you defined for this milestone on the week map.',
  memento_goal_preview_aria: 'View goal: {title}',
  memento_goal_preview_no_manifestation: 'No manifestation text.',
  life_goals_title: 'Life goals',
  life_goals_subtitle:
    'Define visions, manifestations and milestones with a date. Each one is painted on your week map.',
  life_goals_empty: 'No life goals yet.',
  life_goals_empty_hint:
    'Add the home, trip, business or version of yourself you are building — with a photo and a date.',
  life_goal_add: 'New goal',
  life_goal_new: 'New life goal',
  life_goal_edit: 'Edit goal',
  life_goal_title_label: 'Title',
  life_goal_title_placeholder: 'e.g. Home by the sea',
  life_goal_manifestation: 'Manifestation / notes',
  life_goal_manifestation_placeholder:
    'Write in the present tense: how it feels, what you see, why it matters…',
  life_goal_date: 'Target date',
  life_goal_color: 'Map color',
  life_goal_kind: 'Type',
  life_goal_kind_goal: 'Goal',
  life_goal_kind_manifestation: 'Manifestation',
  life_goal_kind_milestone: 'Milestone',
  life_goal_kind_vision: 'Vision',
  life_goal_photo: 'Image',
  life_goal_add_photo: 'Add photo or vision board',
  life_goal_change_photo: 'Change image',
  life_goal_remove_photo: 'Remove image',
  life_goal_compressing: 'Compressing…',
  life_goal_saved: 'Goal saved.',
  life_goal_save_error: 'Could not save the goal.',
  life_goal_title_required: 'Enter a title for the goal.',
  life_goal_date_required: 'Pick a target date.',
  life_goal_date_out_of_map:
    'That date is outside the map (check birth date and life expectancy in Settings).',
  life_goal_limit: 'Maximum 24 life goals.',
  life_goal_delete_confirm: 'Delete this life goal?',
  life_goal_image_error: 'Could not process the image.',
  life_goal_saving: 'Saving…',
  life_goal_need_birthdate:
    'To place goals on the week map, set your birth date in Settings.',
  life_goal_off_map: 'Off map',

  reflections_title: 'Daily reflections',
  reflections_subtitle:
    'Mood and energy by hour, sleep for the day, then close with reflection and gratitude.',
  reflections_prev_day: 'Previous day',
  reflections_next_day: 'Next day',
  reflections_go_today: 'Go to today',
  reflections_week_strip: 'Last 7 days',
  reflections_day_avg: 'Day average',
  reflections_hours_logged: 'hours logged',
  mood_hourly_title: 'Mood by hour',
  mood_hourly_hint: 'Tap an hour and pick how you feel. Tap the same level again to clear.',
  mood_pick_for_hour: 'Mood at {hour}',
  mood_hour_note: 'Note for this hour (optional)',
  mood_hour_note_placeholder: 'What was going on?',
  mood_level_1: 'Very low',
  mood_level_2: 'Low',
  mood_level_3: 'Neutral',
  mood_level_4: 'Good',
  mood_level_5: 'Great',
  reflection_daily_title: 'Daily reflection',
  reflection_daily_placeholder:
    'What did I learn? What did I care for? What would I let go? Write freely…',
  reflection_gratitude_title: 'Gratitude',
  reflection_gratitude_placeholder: 'Three things you are grateful for today…',
  reflections_saved: 'Reflection saved.',
  reflections_save_error: 'Could not save the journal.',
  reflections_unsaved: 'Unsaved changes.',
  reflections_synced: 'Saved.',
  metric_mood: 'Mood',
  metric_energy: 'Energy',
  energy_hourly_title: 'Energy level by hour',
  energy_hourly_hint:
    'Log energy separately from mood. Tap an hour and a level; tap again to clear.',
  energy_pick_for_hour: 'Energy at {hour}',
  energy_day_avg: 'Avg energy',
  energy_level_1: 'Drained',
  energy_level_2: 'Low',
  energy_level_3: 'Steady',
  energy_level_4: 'High',
  energy_level_5: 'Full',
  sleep_title: 'Sleep for the day',
  sleep_hint: 'Approx. hours you slept (the night before this day).',
  sleep_hours_label: 'Hours',
  sleep_not_set: 'Not set',
  sleep_recorded: '{h} h of sleep',
  wellbeing_panel_title: 'Wellbeing (week)',
  wellbeing_panel_subtitle:
    'Mood, energy and sleep for the last 7 days, plus supportive messages.',
  wellbeing_open_journal: 'Journal',
  wellbeing_kpi_mood: 'Mood',
  wellbeing_kpi_energy: 'Energy',
  wellbeing_kpi_sleep: 'Sleep',
  wellbeing_days_short: 'days',
  wellbeing_chart_mood: 'Mood / day',
  wellbeing_chart_energy: 'Energy / day',
  wellbeing_chart_sleep: 'Sleep / day',
  wellbeing_messages_title: 'Messages for you',
  wellbeing_start_logging: 'Start logging in Reflections',
  wellbeing_msg_no_data:
    'No wellbeing data this week yet. A minute a day in Reflections is enough to see patterns.',
  wellbeing_msg_great_mood:
    'Your mood this week is strong. Celebrate what works and protect it with the same care.',
  wellbeing_msg_mood_up:
    'Mood is trending up. Keep what supports you: rhythm, rest and small wins.',
  wellbeing_msg_mood_down:
    'Mood has been heavier. You don’t need to force a smile — be kind to yourself and ask for support if you need it.',
  wellbeing_msg_energy_low:
    'Energy is low. Prioritize sleep, real food and less friction — less is more when your body needs recharge.',
  wellbeing_msg_energy_high:
    'Energy looks solid. Channel it into what matters and leave room so you don’t burn out.',
  wellbeing_msg_sleep_low:
    'You’re sleeping little. Protecting sleep is the cheapest lever for mood and energy.',
  wellbeing_msg_sleep_good:
    'Sleep is in a healthy range. That’s the foundation for everything else — keep guarding it.',
  wellbeing_msg_balanced:
    'A balanced week. Keep logging: the data helps you adjust without judgment.',
  wellbeing_msg_keep_logging:
    'The more days you log, the more useful the summary. Skip perfection — honesty is enough.',

  settings_birth_date: 'Birth date',
  settings_birth_date_desc:
    'Used by Memento mori to calculate weeks lived and weeks remaining.',
  settings_lifespan: 'Life expectancy (years)',
  settings_lifespan_desc: 'Only used to draw the week map (default 80).',

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
  pwa_update_title: 'New version ready',
  pwa_update_desc: 'Updates are available (features and fixes). Restart to apply them.',
  pwa_update_action: 'Update now',
  pwa_update_applying: 'Updating…',
  pwa_settings_title: 'Installed app (PWA)',
  pwa_settings_desc:
    'If the desktop app is missing the latest features, check for updates or reinstall the local cache.',
  pwa_check_updates: 'Check for updates',
  pwa_check_updates_ok: 'You already have the latest version on this device.',
  pwa_check_updates_found: 'A new version is available. Tap «Update now» on the banner.',
  pwa_check_updates_error: 'Could not check for updates. Try reopening the app.',
  pwa_hard_reset: 'Reinstall latest version',
  pwa_hard_reset_desc:
    'Clears this device’s cache and service worker, then reloads. Cloud data is kept.',
  pwa_hard_reset_confirm:
    'Clear local cache and reload? The latest version will download again. Account tasks are kept.',
  pwa_hard_reset_running: 'Reinstalling…',
  pwa_installed_badge: 'Installed app mode · v{version} · {build}',
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
  board_filter_category: 'Category',
  board_filter_category_all: 'All',
  board_filter_category_projects: 'Projects',
  board_filter_category_rx: 'Prescriptions',
  board_category_rx_hint:
    'Prescription doses only. Remedies skip project and Eisenhower fields.',

  task_ctx_mark_complete: 'Mark as completed',
  task_ctx_mark_pending: 'Mark as pending',
  task_ctx_edit: 'Edit',
  task_ctx_delete: 'Delete',

  task_title_placeholder: 'What do you want to do?',
  task_title_label: 'Title',
  task_reminder_placeholder: 'What should we remind you of?',
  task_kind_task: 'Task',
  task_kind_reminder: 'Reminder',
  task_kind_rx_human: 'Rx human',
  task_kind_rx_pet: 'Rx pet',
  rx_medicine_name: 'Medicine',
  rx_medicine_placeholder: 'e.g. Amoxicillin',
  rx_patient_name: 'Patient (optional)',
  rx_patient_placeholder: 'Name or note',
  rx_pet_name: 'Pet',
  rx_pet_placeholder: 'e.g. Luna',
  rx_phases_hint:
    'Each phase sets dose, times and days. Add another phase for a different dose (e.g. 7 days at 1 pill, then 7 at half).',
  rx_phase: 'Phase',
  rx_amount: 'Amount / session',
  rx_unit: 'Unit',
  rx_unit_pills: 'Pills',
  rx_unit_ml: 'ml',
  rx_days: 'Days',
  rx_times: 'Times',
  rx_add_time: 'time',
  rx_add_phase: 'Add phase (new dose)',
  rx_edit_plan: 'Prescription',
  rx_this_dose: 'This dose',
  rx_apply_plan: 'Apply plan and regenerate doses',
  rx_apply_plan_hint:
    'Pending doses from this day are regenerated. Completed ones are kept. Each dose time comes from the phase plan.',
  rx_plan_saved: 'Plan updated: {n} doses regenerated.',
  rx_plan_error: 'Could not update the prescription plan.',
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
  time_now: 'Now',
  task_time_range_error: 'End time must be greater than or equal to start time.',
  task_created_ok: 'Task saved.',
  notify_hub_title: 'Alerts hub',
  notify_hub_intro:
    'View and schedule reminders for tasks, prescriptions, reminders and projects. Alerts use your timezone and the before / tomorrow / follow-up modes.',
  notify_hub_upcoming: 'Upcoming alerts',
  notify_hub_reschedule: 'Reschedule on device',
  notify_hub_loading: 'Loading alerts…',
  notify_hub_empty:
    'No alerts scheduled in the next days. Add times to tasks or doses and enable reminder modes.',
  notify_hub_load_error: 'Could not load tasks for alerts.',
  notify_hub_prefs_saved: 'Alert preferences saved.',
  notify_hub_program_title: 'Schedule alerts',
  notify_hub_scope: 'What to include',
  notify_hub_hint:
    'Tip: completing a dose or task removes its pending alerts. Email is sent by the server using these preferences.',
  notify_hub_filter_all: 'All',
  notify_hub_filter_tasks: 'Tasks',
  notify_hub_filter_rx: 'Prescriptions',
  notify_hub_filter_projects: 'Projects',
  notify_hub_any_project: 'Any project',
  notify_hub_fires_at: 'Fires',
  notify_hub_event_at: 'event',
  notify_mode_before: 'Before',
  notify_mode_day_before: 'Tomorrow',
  notify_mode_past: 'Follow-up',
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
  settings_notifications: 'Notifications',
  settings_notify_local: 'Device notifications',
  settings_notify_local_desc:
    'Android and browser: local alerts for timed tasks and doses. On mobile they fire even if the app is closed.',
  settings_notify_email: 'Email reminders',
  settings_notify_email_desc:
    'The server emails you at the scheduled time (or minutes before). Works on web and Android.',
  settings_notify_minutes: 'Lead time',
  settings_notify_minutes_desc: 'How many minutes before the scheduled time to notify.',
  settings_notify_before_enabled: 'Remind X minutes before',
  settings_notify_before_enabled_desc:
    'Alert just before (or at) each timed task or dose.',
  settings_notify_day_before: 'Remind the day before',
  settings_notify_day_before_desc:
    '“Remember tomorrow you’re going to…” the evening before the activity.',
  settings_notify_day_before_time: 'Time for “tomorrow” alert',
  settings_notify_past: 'Did you do it? (past events)',
  settings_notify_past_desc:
    'If the time passed and it’s still incomplete, ask whether you did it.',
  settings_notify_past_after: 'Minutes after start time',
  settings_notify_tasks: 'Tasks and reminders',
  settings_notify_tasks_desc: 'Include project entries (not only prescriptions).',
  settings_notify_rx: 'Prescription doses',
  settings_notify_rx_desc: 'Include medication doses (human and pet).',
  settings_notify_timezone: 'Timezone',
  settings_notify_timezone_desc:
    'Your civil timezone for email and reminders (tomorrow, minutes before, follow-ups). Should match where you live or work.',
  settings_notify_timezone_device: 'Use device timezone',
  settings_notify_enable_device: 'Allow notifications',
  rx_pet_tag_hint:
    'Saved as a reusable tag (you can also type #Name in the title).',
  rx_plan_start: 'Treatment start',
  rx_plan_duration: 'Duration (from phases)',
  rx_plan_duration_value: '{days} days · until {end}',
  settings_notify_permission_denied:
    'Permission denied. Enable it in system or browser settings.',
  settings_notify_test_email: 'Send test email',
  settings_notify_test_email_sent: 'Test email sent. Check your inbox.',
  settings_notify_test_email_skipped:
    'Server has no RESEND_API_KEY yet; email was not sent.',
  settings_notify_test_email_error: 'Could not send the test email.',
  settings_notify_local_scheduled: 'Local reminders rescheduled: {n}.',
  settings_notify_modes_title: 'When to notify',

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
  dashboard_doses_today: 'Doses for today',
  dashboard_no_doses_today: 'No prescription doses for today.',
  dashboard_dose_pending: 'Mark dose as taken',
  dashboard_dose_done: 'Unmark dose',

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
