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
  nav_documents: string;
  nav_circle: string;
  nav_analytics: string;
  nav_activity: string;
  nav_settings: string;
  nav_admin: string;
  nav_eisenhower: string;
  nav_notifications: string;
  nav_memento: string;
  nav_life_goals: string;
  nav_reflections: string;
  nav_recetario: string;
  nav_finances: string;

  // Finances
  fin_add: string;
  fin_edit: string;
  fin_this_month: string;
  fin_total_income: string;
  fin_total_expense: string;
  fin_balance: string;
  fin_income_recurring: string;
  fin_income_expected: string;
  fin_income_specific: string;
  fin_expense_recurring: string;
  fin_expense_expected: string;
  fin_expense_specific: string;
  fin_flow_income: string;
  fin_flow_expense: string;
  fin_kind_recurring: string;
  fin_kind_expected: string;
  fin_kind_specific: string;
  fin_freq_monthly: string;
  fin_freq_weekly: string;
  fin_filter_all_flows: string;
  fin_filter_all_kinds: string;
  fin_empty_title: string;
  fin_empty_hint: string;
  fin_field_title: string;
  fin_title_ph: string;
  fin_field_flow: string;
  fin_field_kind: string;
  fin_field_amount: string;
  fin_field_currency: string;
  fin_field_frequency: string;
  fin_field_monthday: string;
  fin_field_weekday: string;
  fin_field_date: string;
  fin_field_notes: string;
  fin_field_active: string;
  fin_weekday_0: string;
  fin_weekday_1: string;
  fin_weekday_2: string;
  fin_weekday_3: string;
  fin_weekday_4: string;
  fin_weekday_5: string;
  fin_weekday_6: string;
  fin_title_required: string;
  fin_amount_required: string;
  fin_saved: string;
  fin_created: string;
  fin_deleted: string;
  fin_delete_confirm: string;
  fin_delete_title: string;
  fin_save_error: string;
  fin_load_error: string;

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
  life_goal_delete_title: string;
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
  reflections_section_day: string;
  reflections_section_day_hint: string;
  reflections_section_hourly: string;
  reflections_section_hourly_hint: string;
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
  reflections_discard_confirm: string;
  reflections_discard_title: string;
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
  energy_feel_title: string;
  energy_feel_hint: string;
  energy_feel_tense: string;
  energy_feel_relaxed: string;
  energy_feel_vigorous: string;
  reflections_tab_day: string;
  reflections_tab_life: string;
  life_journal_title: string;
  life_journal_subtitle: string;
  life_journal_period_week: string;
  life_journal_period_month: string;
  life_journal_period_quarter: string;
  life_journal_mood_evolution: string;
  life_journal_energy_evolution: string;
  life_journal_entries: string;
  life_journal_empty: string;
  life_journal_no_text: string;
  life_journal_open_day: string;
  life_journal_avg_mood: string;
  life_journal_avg_energy: string;
  life_journal_days_logged: string;
  life_journal_trend_up: string;
  life_journal_trend_down: string;
  life_journal_trend_flat: string;
  life_journal_trend_unknown: string;
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
  wellbeing_kpi_feel: string;
  wellbeing_feel_none: string;
  wellbeing_days_short: string;
  wellbeing_chart_mood: string;
  wellbeing_chart_energy: string;
  wellbeing_chart_sleep: string;
  wellbeing_chart_feel: string;
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
  action_save_event: string;
  action_new_project: string;
  action_save: string;
  action_cancel: string;
  action_close: string;
  action_delete: string;
  action_confirm: string;
  action_discard: string;
  action_edit: string;
  action_today: string;
  action_sign_out: string;
  action_sign_in: string;
  action_undo: string;
  action_redo: string;
  confirm_delete_title: string;
  confirm_discard_title: string;
  confirm_reset_title: string;
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
  pwa_hard_reset_title: string;
  pwa_hard_reset_running: string;
  settings_demo_reset_title: string;
  settings_demo_reset_confirm: string;
  project_delete_title: string;
  project_delete_confirm: string;
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
  /** Ocultar / mostrar tareas terminadas en el tablero */
  board_hide_completed: string;
  board_show_completed: string;
  /** Lugar genérico (tarea / recordatorio) */
  task_location: string;
  task_location_ph: string;
  /** Menú contextual de celda en mes/continuo */
  board_ctx_view_day: string;
  board_go_today: string;
  board_go_this_week: string;
  board_go_this_month: string;
  board_next_week: string;
  board_prev_week: string;
  board_prev_day: string;
  board_next_day: string;
  board_add_task: string;
  layout_list: string;
  layout_schedule: string;
  schedule_all_day: string;
  /** Doble clic en hueco del horario */
  schedule_slot_dblclick_hint: string;
  schedule_create_at: string;
  schedule_create_pick: string;
  day_sort_label: string;
  day_sort_time: string;
  day_sort_name: string;
  day_sort_importance: string;
  day_sort_urgency: string;
  day_sort_help: string;
  day_sort_primary_hint: string;
  day_sort_secondary_hint: string;
  day_sort_add_hint: string;
  board_filter_project: string;
  board_filter_urgency: string;
  board_filter_importance: string;
  board_filter_all: string;
  board_filter_category: string;
  board_filter_category_all: string;
  board_filter_category_projects: string;
  board_filter_category_rx: string;
  board_filter_category_possible: string;
  board_category_possible_hint: string;
  board_filter_category_events: string;
  board_category_events_hint: string;
  board_filter_category_habits: string;
  board_category_habits_hint: string;
  task_kind_habit_good: string;
  task_kind_habit_quit: string;
  task_kind_finance_income: string;
  task_kind_finance_expense: string;
  task_finance_hint: string;
  task_finance_certainty: string;
  task_finance_fixed: string;
  task_finance_potential: string;
  board_filter_category_finances: string;
  board_category_finances_hint: string;
  board_filter_category_holidays: string;
  board_category_holidays_hint: string;
  empty_no_holidays: string;
  task_repeat_last_day_prompt: string;
  task_repeat_last_day_prompt_hint: string;
  task_repeat_use_last_day: string;
  task_repeat_keep_day_n: string;
  task_repeat_business_days: string;
  task_repeat_business_days_hint: string;
  task_repeat_first_business: string;
  task_repeat_last_business: string;
  task_habit_placeholder: string;
  task_habit_quit_placeholder: string;
  action_add_habit: string;
  habit_done: string;
  habit_not_done: string;
  habit_badge_good: string;
  habit_badge_quit: string;
  task_kind_possible_event: string;
  task_possible_event_placeholder: string;
  task_kind_event: string;
  task_event_placeholder: string;
  task_event_location: string;
  task_event_location_ph: string;
  task_possible_event_location: string;
  task_possible_event_location_ph: string;
  task_event_departure: string;
  task_event_departure_hint: string;
  task_involved_contacts: string;
  task_involved_contacts_hint: string;
  task_involved_none: string;
  involved_filter_label: string;
  involved_filter_all: string;
  involved_filter_family: string;
  involved_filter_partner: string;
  involved_filter_friend: string;
  involved_filter_work: string;
  involved_filter_pet: string;
  involved_filter_other: string;
  involved_filter_empty: string;
  board_category_rx_hint: string;

  // Context menu tareas
  task_ctx_mark_complete: string;
  task_ctx_mark_pending: string;
  task_ctx_edit: string;
  task_ctx_delete: string;
  task_ctx_confirm_event: string;
  task_confirm_event_done: string;
  task_kind_convert: string;
  task_kind_convert_hint: string;
  task_event_departure_draft_hint: string;

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
  rx_schedule_mode: string;
  rx_schedule_fixed: string;
  rx_schedule_interval: string;
  rx_every_hours: string;
  rx_interval_start: string;
  rx_interval_preview: string;
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
  task_category_label: string;
  task_no_category: string;
  project_edit_title: string;
  project_new_title: string;
  project_form_desc: string;
  project_name_label: string;
  project_name_ph: string;
  project_color_label: string;
  project_icon_label: string;
  project_categories_label: string;
  project_categories_hint: string;
  project_category_ph: string;
  project_category_add: string;
  project_category_remove: string;
  project_categories_max: string;
  project_unnamed: string;
  project_categories_count: string;
  action_create: string;
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
  /** Hint under dual-handle date range strip. */
  task_date_range_drag_hint: string;
  task_date_pick_start: string;
  task_date_pick_end: string;
  task_date_pick_range: string;
  task_date_single_day: string;
  task_date_n_days: string;
  task_date_make_single: string;
  task_date_add_end: string;
  task_date_today: string;
  task_date_done: string;
  task_schedule: string;
  task_start_time: string;
  task_end_time: string;
  task_clear_time: string;
  time_now: string;
  task_time_range_error: string;
  task_created_ok: string;
  /** Toast corto inmediato al guardar (create/edit). */
  task_saved_ok: string;

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
  task_delete_title: string;
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
  settings_tab_account: string;
  settings_tab_preferences: string;
  settings_tab_appearance: string;
  settings_tab_notifications: string;
  settings_tab_finances: string;
  settings_tab_system: string;
  settings_finances_title: string;
  settings_finances_intro: string;
  settings_preferred_currency: string;
  settings_preferred_currency_desc: string;
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
  settings_skin_aero: string;
  settings_skin_aero_desc: string;
  settings_skin_glass_light: string;
  settings_skin_glass_dark: string;
  settings_skin_glass_desc: string;
  settings_status_email: string;
  settings_status_email_ok: string;
  settings_status_email_off: string;
  settings_status_email_na: string;
  settings_status_email_from: string;
  settings_status_email_worker: string;
  settings_status_email_worker_off: string;
  settings_status_auth_hint: string;
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
  /** Fase N: start → end (days d) */
  rx_phase_date_range: string;
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
  eisenhower_select_all: string;
  eisenhower_deselect_all: string;
  eisenhower_no_project: string;
  eisenhower_filters: string;
  eisenhower_rx_excluded: string;
  eisenhower_do: string;
  eisenhower_schedule: string;
  eisenhower_delegate: string;
  eisenhower_eliminate: string;
  eisenhower_uncategorized: string;
  eisenhower_empty: string;
  eisenhower_hint: string;
  eisenhower_horizon: string;
  eisenhower_horizon_30d: string;
  eisenhower_horizon_month: string;
  eisenhower_horizon_3m: string;
  eisenhower_horizon_6m: string;
  eisenhower_horizon_1y: string;
  eisenhower_series_done_period: string;
  eisenhower_series_next: string;
  eisenhower_series_done_next_title: string;

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
  dashboard_rx_title: string;
  dashboard_rx_subtitle: string;
  dashboard_open_recetario: string;
  dashboard_doses_badge: string;

  recetario_title: string;
  recetario_subtitle: string;
  recetario_kpi_subjects: string;
  recetario_kpi_treatments: string;
  recetario_kpi_today: string;
  recetario_kpi_status: string;
  recetario_kpi_ready: string;
  recetario_filter_all: string;
  recetario_filter_people: string;
  recetario_filter_pets: string;
  recetario_empty: string;
  recetario_loading: string;
  recetario_new: string;
  recetario_new_hint: string;
  recetario_day_range: string;
  recetario_prev_day: string;
  recetario_next_day: string;
  recetario_no_doses_day: string;
  rx_load_error: string;
  rx_toggle_error: string;
  rx_today_doses: string;
  rx_no_doses_today_subject: string;
  rx_treatments_title: string;
  rx_treatment_one: string;
  rx_treatment_many: string;
  rx_treatment_finished: string;
  rx_progress_pct: string;
  rx_progress_phases: string;
  rx_progress_no_phases: string;
  rx_progress_days_left: string;
  rx_progress_doses: string;
  rx_progress_remaining: string;
  rx_progress_left_short: string;
  rx_phase_status_active: string;
  rx_phase_status_upcoming: string;
  rx_phase_status_done: string;
  rx_times_per_day: string;
  rx_phase_days_count: string;
  rx_subject_unnamed_person: string;
  rx_subject_unnamed_pet: string;
  rx_edit_owner_title: string;
  rx_edit_owner_desc: string;
  rx_edit_owner_kind: string;
  rx_edit_owner_hint: string;
  rx_edit_owner_action: string;
  rx_edit_owner_saved: string;
  rx_edit_owner_error: string;
  rx_delete_title: string;
  rx_delete_confirm: string;
  rx_delete_saved: string;
  rx_delete_error: string;
  rx_delete_deleting: string;
  rx_phases_ending_title: string;
  rx_phases_ending_subtitle: string;
  rx_phases_ending_empty: string;
  rx_phases_ending_on: string;

  // Generales
  empty_no_tasks: string;
  empty_no_events: string;
  empty_no_possible: string;
  empty_no_rx: string;
  empty_no_habits: string;
  empty_no_projects_cat: string;
  empty_no_finances: string;
  empty_no_projects: string;
  task_steps_label: string;
  task_steps_hint: string;
  task_steps_empty: string;
  task_steps_placeholder: string;
  task_steps_add: string;
  task_steps_progress: string;
  task_images_label: string;
  task_images_hint: string;
  task_images_drop: string;
  task_images_max: string;
  task_images_limit: string;
  task_images_not_image: string;
  task_images_error: string;
  task_images_compressing: string;
  task_images_remove: string;
  task_images_preview: string;
  task_images_preview_pdf: string;
  task_images_pdf_too_large: string;

  docs_title: string;
  docs_subtitle: string;
  docs_search: string;
  docs_filter_from: string;
  docs_filter_to: string;
  docs_filter_project: string;
  docs_filter_kind: string;
  docs_filter_type: string;
  docs_filter_all_projects: string;
  docs_filter_all_kinds: string;
  docs_no_project: string;
  docs_type_all: string;
  docs_type_image: string;
  docs_type_pdf: string;
  docs_clear_filters: string;
  docs_empty: string;
  docs_empty_filtered: string;
  docs_count: string;
  docs_load_error: string;
  docs_download: string;
  docs_open_tab: string;
  docs_open_task: string;

  // Círculo (personas y mascotas)
  circle_title: string;
  circle_subtitle: string;
  circle_new: string;
  circle_edit: string;
  circle_create: string;
  circle_form_desc: string;
  circle_kind: string;
  circle_kind_person: string;
  circle_kind_pet: string;
  circle_name: string;
  circle_name_ph_person: string;
  circle_name_ph_pet: string;
  circle_tags: string;
  circle_tags_ph: string;
  circle_tags_hint: string;
  circle_relationship: string;
  circle_relationship_none: string;
  circle_rel_father: string;
  circle_rel_mother: string;
  circle_rel_son: string;
  circle_rel_daughter: string;
  circle_rel_brother: string;
  circle_rel_sister: string;
  circle_rel_partner: string;
  circle_rel_niece: string;
  circle_rel_nephew: string;
  circle_rel_friend: string;
  circle_rel_coworker: string;
  circle_filter_all: string;
  circle_empty: string;
  circle_empty_hint: string;
  circle_created: string;
  circle_updated: string;
  circle_deleted: string;
  circle_save_error: string;
  circle_delete_error: string;
  circle_delete_confirm: string;
  circle_delete_title: string;
  circle_mention_hint: string;
  circle_pulse: string;
  circle_pulse_none: string;
  circle_pulse_hint: string;
  circle_pulse_great: string;
  circle_pulse_good: string;
  circle_pulse_neutral: string;
  circle_pulse_need_connect: string;
  circle_pulse_strained: string;
  circle_pulse_bad: string;
  circle_view_commitments: string;
  circle_commitments_title: string;
  circle_commitments_desc: string;
  circle_commitments_empty: string;
  circle_commitments_error: string;
}

const es_dict: TranslationDict = {
  nav_summary: 'Resumen',
  nav_tasks: 'Calendario',
  nav_projects: 'Proyectos',
  nav_documents: 'Documentos',
  nav_circle: 'Círculo',
  nav_analytics: 'Analytics',
  nav_activity: 'Bitácora',
  nav_settings: 'Config',
  nav_admin: 'Admin',
  nav_eisenhower: 'Matriz de Prioridades',
  nav_notifications: 'Avisos',
  nav_memento: 'Memento mori',
  nav_life_goals: 'Metas de vida',
  nav_reflections: 'Reflexiones',
  nav_recetario: 'Recetario',
  nav_finances: 'Finances',
  fin_add: 'Añadir movimiento',
  fin_edit: 'Editar movimiento',
  fin_this_month: 'Este mes',
  fin_total_income: 'Ingresos',
  fin_total_expense: 'Gastos',
  fin_balance: 'Balance',
  fin_income_recurring: 'Ingresos recurrentes',
  fin_income_expected: 'Ingresos esperados',
  fin_income_specific: 'Ingresos puntuales',
  fin_expense_recurring: 'Gastos recurrentes',
  fin_expense_expected: 'Gastos esperados',
  fin_expense_specific: 'Gastos puntuales',
  fin_flow_income: 'Ingreso',
  fin_flow_expense: 'Gasto',
  fin_kind_recurring: 'Recurrente',
  fin_kind_expected: 'Esperado',
  fin_kind_specific: 'Específico',
  fin_freq_monthly: 'Mensual',
  fin_freq_weekly: 'Semanal',
  fin_filter_all_flows: 'Todos los flujos',
  fin_filter_all_kinds: 'Todos los tipos',
  fin_empty_title: 'Sin movimientos este mes',
  fin_empty_hint:
    'Registra gastos e ingresos recurrentes, esperados o específicos para ver el balance mensual.',
  fin_field_title: 'Concepto',
  fin_title_ph: 'Ej. Alquiler, nómina, cena…',
  fin_field_flow: 'Flujo',
  fin_field_kind: 'Tipo',
  fin_field_amount: 'Importe',
  fin_field_currency: 'Moneda',
  fin_field_frequency: 'Frecuencia',
  fin_field_monthday: 'Día del mes',
  fin_field_weekday: 'Día de la semana',
  fin_field_date: 'Fecha',
  fin_field_notes: 'Notas',
  fin_field_active: 'Activo (cuenta en el resumen)',
  fin_weekday_0: 'Domingo',
  fin_weekday_1: 'Lunes',
  fin_weekday_2: 'Martes',
  fin_weekday_3: 'Miércoles',
  fin_weekday_4: 'Jueves',
  fin_weekday_5: 'Viernes',
  fin_weekday_6: 'Sábado',
  fin_title_required: 'Escribe un concepto.',
  fin_amount_required: 'Indica un importe válido.',
  fin_saved: 'Movimiento actualizado.',
  fin_created: 'Movimiento creado.',
  fin_deleted: 'Movimiento eliminado.',
  fin_delete_confirm: '¿Eliminar «{title}»?',
  fin_delete_title: 'Eliminar movimiento',
  fin_save_error: 'No pudimos guardar el movimiento.',
  fin_load_error: 'No pudimos cargar finances.',

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
  life_goal_delete_title: 'Eliminar meta de vida',
  life_goal_image_error: 'No se pudo procesar la imagen.',
  life_goal_saving: 'Guardando…',
  life_goal_need_birthdate:
    'Para ubicar las metas en el mapa de semanas, configura tu fecha de nacimiento.',
  life_goal_off_map: 'Fuera del mapa',

  reflections_title: 'Reflexiones diarias',
  reflections_subtitle:
    'Ánimo, energía y tono por hora; sueño, reflexión y gratitud del día. El diario de vida muestra tu evolución.',
  reflections_prev_day: 'Día anterior',
  reflections_next_day: 'Día siguiente',
  reflections_go_today: 'Ir a hoy',
  reflections_week_strip: 'Últimos 7 días',
  reflections_day_avg: 'Media del día',
  reflections_hours_logged: 'horas registradas',
  reflections_section_day: 'Del día',
  reflections_section_day_hint:
    'Sueño, resumen de la semana, reflexión y gratitud: lo que resume la jornada entera.',
  reflections_section_hourly: 'Por hora',
  reflections_section_hourly_hint:
    'Ánimo, energía y tono (tenso / relajado / vigoroso) en cada franja. Toca una hora y registra cómo estás.',
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
  reflections_synced: 'Todo guardado.',
  reflections_discard_confirm:
    'Tienes cambios sin guardar. ¿Descartarlos y cambiar de día?',
  reflections_discard_title: 'Cambios sin guardar',
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
  energy_feel_title: 'Cómo se siente',
  energy_feel_hint:
    'Complemento al nivel: puedes tener energía alta y estar tenso, o baja y relajado.',
  energy_feel_tense: 'Tenso',
  energy_feel_relaxed: 'Relajado',
  energy_feel_vigorous: 'Vigoroso',
  reflections_tab_day: 'Día',
  reflections_tab_life: 'Diario de vida',
  life_journal_title: 'Diario de vida',
  life_journal_subtitle:
    'Reflexiones, gratitudes y evolución del ánimo en la semana, el mes o los últimos 3 meses.',
  life_journal_period_week: 'Semana',
  life_journal_period_month: 'Mes',
  life_journal_period_quarter: '3 meses',
  life_journal_mood_evolution: 'Evolución del ánimo',
  life_journal_energy_evolution: 'Evolución de la energía',
  life_journal_entries: 'Reflexiones y gratitudes',
  life_journal_empty:
    'Aún no hay entradas en este periodo. Escribe una reflexión o gratitud en la pestaña Día.',
  life_journal_no_text: 'Sin texto ese día',
  life_journal_open_day: 'Abrir día',
  life_journal_avg_mood: 'Ánimo medio',
  life_journal_avg_energy: 'Energía media',
  life_journal_days_logged: 'días con datos',
  life_journal_trend_up: 'Al alza',
  life_journal_trend_down: 'A la baja',
  life_journal_trend_flat: 'Estable',
  life_journal_trend_unknown: 'Sin tendencia aún',
  sleep_title: 'Sueño del día',
  sleep_hint: 'Horas aproximadas que dormiste (la noche anterior a este día).',
  sleep_hours_label: 'Horas',
  sleep_not_set: 'Sin registrar',
  sleep_recorded: '{h} h de sueño',
  wellbeing_panel_title: 'Bienestar (semana)',
  wellbeing_panel_subtitle:
    'Resumen de ánimo, energía, tono (tenso/relajado/vigoroso) y sueño de los últimos 7 días, con mensajes de apoyo.',
  wellbeing_open_journal: 'Diario',
  wellbeing_kpi_mood: 'Ánimo',
  wellbeing_kpi_energy: 'Energía',
  wellbeing_kpi_sleep: 'Sueño',
  wellbeing_kpi_feel: 'Tono',
  wellbeing_feel_none: 'Sin tono',
  wellbeing_days_short: 'días',
  wellbeing_chart_mood: 'Ánimo / día',
  wellbeing_chart_energy: 'Energía / día',
  wellbeing_chart_sleep: 'Sueño / día',
  wellbeing_chart_feel: 'Tono / día',
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
  action_save_event: 'Guardar evento',
  action_new_project: 'Nuevo proyecto',
  action_save: 'Guardar',
  action_cancel: 'Cancelar',
  action_close: 'Cerrar',
  action_delete: 'Eliminar',
  action_confirm: 'Confirmar',
  action_discard: 'Descartar',
  action_edit: 'Editar',
  action_today: 'Hoy',
  action_sign_out: 'Cerrar sesión',
  action_sign_in: 'Iniciar sesión',
  action_undo: 'Deshacer',
  action_redo: 'Rehacer',
  confirm_delete_title: '¿Eliminar?',
  confirm_discard_title: '¿Descartar cambios?',
  confirm_reset_title: '¿Confirmar reinicio?',
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
  pwa_hard_reset_title: 'Reinstalar app',
  pwa_hard_reset_running: 'Reinstalando…',
  settings_demo_reset_title: 'Resetear demo',
  settings_demo_reset_confirm:
    '¿Resetear todos los datos demo? Vuelven al estado inicial sembrado.',
  project_delete_title: 'Eliminar proyecto',
  project_delete_confirm:
    '¿Eliminar «{name}»? Las tareas asociadas quedan sin proyecto.',
  pwa_installed_badge: 'Modo app instalada · v{version} · {build}',
  offline_banner: 'Sin conexión. Los cambios se guardan y se envían al volver.',
  offline_pending: '{n} cambio(s) pendientes de sincronizar',
  offline_sync_now: 'Sincronizar',
  offline_synced: 'Sincronizados {n} cambio(s)',

  board_week_view: 'Semana',
  board_month_view: 'Mes',
  board_continuous_view: 'Continuo',
  board_day_view: 'Día',
  board_hide_completed: 'Ocultar terminados',
  board_show_completed: 'Mostrar terminados',
  task_location: 'Lugar',
  task_location_ph: 'Ej. oficina, casa, Zoom…',
  board_ctx_view_day: 'Ver día',
  board_go_today: 'Ir al día de hoy',
  board_go_this_week: 'Ir a la semana de hoy',
  board_go_this_month: 'Ir al mes de hoy',
  board_next_week: 'Semana siguiente',
  board_prev_week: 'Semana anterior',
  board_prev_day: 'Día anterior',
  board_next_day: 'Día siguiente',
  board_add_task: 'Añadir tarea',
  layout_list: 'Lista',
  layout_schedule: 'Horario',
  schedule_all_day: 'Sin hora',
  schedule_slot_dblclick_hint: 'Doble clic en un hueco para crear',
  schedule_create_at: 'Crear a las {time}',
  schedule_create_pick: '¿Qué quieres crear?',
  day_sort_label: 'Ordenar',
  day_sort_time: 'Hora',
  day_sort_name: 'Nombre',
  day_sort_importance: 'Importancia',
  day_sort_urgency: 'Urgencia',
  day_sort_help: 'Clic: criterio principal. Shift+clic: sumar/quitar criterio.',
  day_sort_primary_hint: 'Clic de nuevo para invertir asc/desc',
  day_sort_secondary_hint: 'Shift+clic para quitar este criterio',
  day_sort_add_hint: 'Clic para usar como principal · Shift+clic para añadir',
  board_filter_project: 'Proyecto',
  board_filter_urgency: 'Urgencia',
  board_filter_importance: 'Importancia',
  board_filter_all: 'Todos',
  board_filter_category: 'Categoría',
  board_filter_category_all: 'Todo',
  board_filter_category_projects: 'Proyectos',
  board_filter_category_rx: 'Recetario',
  board_filter_category_possible: 'Eventos posibles',
  board_category_possible_hint:
    'Planes tentativos: un día o un rango. Asocia personas o mascotas del Círculo.',
  board_filter_category_events: 'Eventos',
  board_filter_category_habits: 'Hábitos',
  board_category_habits_hint:
    'Hábitos buenos y a dejar. Cada día aparece con casilla para marcar si lo hiciste.',
  board_category_events_hint:
    'Eventos con lugar, fechas y salida prevista (avisos según la hora de salida).',
  board_category_rx_hint:
    'Solo tomas de recetario. Los remedios no usan proyecto ni Eisenhower.',

  task_ctx_mark_complete: 'Marcar como completada',
  task_ctx_mark_pending: 'Marcar como pendiente',
  task_ctx_edit: 'Editar',
  task_ctx_delete: 'Eliminar',
  task_ctx_confirm_event: 'Convertir en evento real',
  task_confirm_event_done: 'Ahora es un evento confirmado.',
  task_kind_convert: 'Tipo de entrada',
  task_kind_convert_hint:
    'Toca el tipo para ver todas las opciones con icono. Al elegir una, se cierra la rejilla y queda el chip seleccionado.',
  task_event_departure_draft_hint:
    'La salida prevista se usa al guardar como evento real. Si dejas «evento posible», no se aplica a notificaciones.',

  task_title_placeholder: '¿Qué quieres hacer?',
  task_title_label: 'Título',
  task_reminder_placeholder: '¿De qué quieres que te acuerdes?',
  task_kind_task: 'Tarea',
  task_kind_reminder: 'Recordatorio',
  task_kind_rx_human: 'Rx humano',
  task_kind_rx_pet: 'Rx mascota',
  task_kind_possible_event: 'Evento posible',
  task_possible_event_placeholder: 'Ej. Viaje en familia, visita al veterinario…',
  task_kind_event: 'Evento',
  task_kind_habit_good: 'Hábito bueno',
  task_kind_habit_quit: 'Hábito a dejar',
  task_kind_finance_income: 'Ingreso',
  task_kind_finance_expense: 'Gasto',
  task_finance_hint:
    'Movimiento de finanzas en el calendario. Sin hora de inicio ni fin. Define si es fijo o potencial, y usa la recurrencia si se repite.',
  task_finance_certainty: 'Certeza',
  task_finance_fixed: 'Fijo (confirmado)',
  task_finance_potential: 'Potencial (esperado)',
  board_filter_category_finances: 'Finances',
  board_category_finances_hint: 'Ingresos y gastos del calendario.',
  board_filter_category_holidays: 'Feriados CL',
  board_category_holidays_hint: 'Feriados nacionales de Chile.',
  empty_no_holidays: 'No hay feriados en este rango.',
  task_repeat_last_day_prompt: '¿Repetir el último día de cada mes?',
  task_repeat_last_day_prompt_hint:
    'Elegiste el último día de este mes (p. ej. 31). No todos los meses tienen ese número. Recomendamos anclar al último día del mes.',
  task_repeat_use_last_day: 'Sí, último día del mes',
  task_repeat_keep_day_n: 'No, usar el mismo número (clamp)',
  task_repeat_business_days: 'Usar días hábiles (Chile)',
  task_repeat_business_days_hint:
    'Lunes a viernes, excluyendo feriados nacionales de Chile.',
  task_repeat_first_business: 'Primer día hábil del mes',
  task_repeat_last_business: 'Último día hábil del mes',
  task_habit_placeholder: 'Ej. Tocar guitarra, leer, ir al gym…',
  task_habit_quit_placeholder: 'Ej. Redes sociales, azúcares, procrastinar…',
  action_add_habit: 'Guardar hábito',
  habit_done: 'Hecho',
  habit_not_done: 'Pendiente',
  habit_badge_good: 'Cultivar',
  habit_badge_quit: 'Dejar',
  task_event_placeholder: 'Ej. Cena con Ana, partido, cita médica…',
  task_event_location: 'Lugar',
  task_event_location_ph: 'Ej. Casa de Ana, Teatro Colón, Zoom…',
  task_possible_event_location: 'Lugar posible',
  task_possible_event_location_ph: 'Ej. casa de Ana, parque, restaurante…',
  task_event_departure: 'Salida prevista',
  task_event_departure_hint:
    'Hora a la que sales. Los avisos «X min antes» se calculan desde esta hora.',
  task_involved_contacts: 'Involucrados (Círculo)',
  task_involved_contacts_hint:
    'Elige personas o mascotas. Quedarán asociadas al evento y a sus compromisos.',
  task_involved_none: 'Nadie seleccionado',
  involved_filter_label: 'Filtrar involucrados',
  involved_filter_all: 'Todos',
  involved_filter_family: 'Familia',
  involved_filter_partner: 'Pareja',
  involved_filter_friend: 'Amigos',
  involved_filter_work: 'Trabajo',
  involved_filter_pet: 'Mascotas',
  involved_filter_other: 'Otros',
  involved_filter_empty: 'Nadie en este filtro',
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
  rx_times: 'Horarios fijos',
  rx_add_time: 'horario',
  rx_schedule_mode: 'Cómo programar las tomas',
  rx_schedule_fixed: 'Horas fijas',
  rx_schedule_interval: 'Cada N horas',
  rx_every_hours: 'Cada (horas)',
  rx_interval_start: 'Hora de inicio',
  rx_interval_preview: 'Horarios calculados',
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
  task_category_label: 'Subcategoría',
  task_no_category: 'Sin subcategoría',
  project_edit_title: 'Editar proyecto',
  project_new_title: 'Nuevo proyecto',
  project_form_desc:
    'Los proyectos agrupan tareas por contexto. Puedes añadir subcategorías (p. ej. Trabajo → Backend).',
  project_name_label: 'Nombre',
  project_name_ph: 'Ej. Personal, Trabajo, Aprendizaje…',
  project_color_label: 'Color',
  project_icon_label: 'Ícono',
  project_categories_label: 'Subcategorías',
  project_categories_hint:
    'Opcional. Al crear una tarea podrás elegir una de estas dentro del proyecto.',
  project_category_ph: 'Ej. Backend, Marketing…',
  project_category_add: 'Añadir',
  project_category_remove: 'Quitar subcategoría',
  project_categories_max: 'Hasta {n} subcategorías por proyecto',
  project_unnamed: 'Sin nombre',
  project_categories_count: '{n} subcategorías',
  action_create: 'Crear',
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
  task_date_range_drag_hint:
    'Arrastra los extremos para definir el rango, o elige fechas exactas arriba.',
  task_date_pick_start: 'Elige el día de inicio',
  task_date_pick_end: 'Elige el día de fin del rango',
  task_date_pick_range: 'Toca inicio y luego fin del rango',
  task_date_single_day: 'Un solo día',
  task_date_n_days: '{n} días',
  task_date_make_single: 'Solo un día',
  task_date_add_end: 'Añadir fecha fin',
  task_date_today: 'Hoy',
  task_date_done: 'Listo',
  task_schedule: 'Horario',
  task_start_time: 'Hora inicio',
  task_end_time: 'Hora fin',
  task_clear_time: 'Quitar hora',
  time_now: 'Ahora',
  task_time_range_error:
    'La hora de fin debe ser posterior o igual a la de inicio (en el mismo día). En varios días se permite acabar al día siguiente (ej. 20:00 → 03:00).',
  task_created_ok: 'Tarea guardada.',
  task_saved_ok: 'Guardado.',
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
  task_delete_confirm: '¿Eliminar «{title}»?',
  task_delete_title: 'Eliminar tarea',
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
  settings_tab_account: 'Cuenta',
  settings_tab_preferences: 'Preferencias',
  settings_tab_appearance: 'Apariencia',
  settings_tab_notifications: 'Avisos',
  settings_tab_finances: 'Finances',
  settings_tab_system: 'Sistema',
  settings_finances_title: 'Finances',
  settings_finances_intro:
    'Define cómo se comportan los movimientos de dinero en la app.',
  settings_preferred_currency: 'Divisa preferida',
  settings_preferred_currency_desc:
    'Se usa por defecto en el módulo Finances y al crear ingresos o gastos en el calendario.',
  settings_language: 'Idioma',
  settings_language_es: 'Español',
  settings_language_en: 'English',
  settings_week_starts_monday: 'La semana empieza el lunes',
  settings_week_starts_monday_desc: 'Si lo desactivas, el tablero empieza el domingo.',
  settings_auto_roll: 'Auto-roll de tareas incompletas',
  settings_auto_roll_desc: 'Los domingos a las 23:59 mueve las pendientes al lunes siguiente.',
  settings_default_project: 'Proyecto por defecto',
  settings_default_board_view: 'Vista del tablero por defecto',
  settings_default_board_view_desc: 'Cómo se abre el tablero al entrar en Calendario.',
  settings_none: 'Ninguno',
  settings_skin: 'Apariencia',
  settings_skin_desc:
    'Sólidos o Liquid Glass (claro/oscuro, estilo macOS). Se aplica de inmediato en toda la app.',
  settings_skin_dark: 'Oscuros',
  settings_skin_light: 'Claros',
  settings_skin_aero: 'Liquid Glass',
  settings_skin_aero_desc:
    'Materiales Apple: wallpaper, vibrancy y blur (UIBlurEffect). Campos de formulario siempre opacos.',
  settings_skin_glass_light: 'Liquid Glass · claro',
  settings_skin_glass_dark: 'Liquid Glass · oscuro',
  settings_skin_glass_desc:
    'Como macOS: malla de fondo, chrome esmerilado (blur + saturación) y controles sólidos. 10 tonos por modo.',
  settings_status_email: 'Email (Resend)',
  settings_status_email_ok: 'Configurado',
  settings_status_email_off: 'Sin API key',
  settings_status_email_na: 'N/A demo',
  settings_status_email_from: 'Remitente',
  settings_status_email_worker: 'Worker email',
  settings_status_email_worker_off: 'Desactivado',
  settings_status_auth_hint:
    'Google OAuth y DNS de Resend se configuran fuera de la app. Guía:',
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
  rx_phase_date_range: 'Fase {n}: {start} → {end} ({days} d)',
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

  eisenhower_title: 'Matriz de Prioridades',
  eisenhower_project: 'Proyecto',
  eisenhower_all_projects: 'Todos',
  eisenhower_select_all: 'Seleccionar todos',
  eisenhower_deselect_all: 'Deseleccionar todos',
  eisenhower_no_project: 'Sin proyecto',
  eisenhower_filters: 'Filtros',
  eisenhower_rx_excluded: 'Los recetarios no se muestran en esta matriz.',
  eisenhower_do: 'Urgente e importante',
  eisenhower_schedule: 'No urgente e importante',
  eisenhower_delegate: 'Urgente y no importante',
  eisenhower_eliminate: 'No urgente y no importante',
  eisenhower_uncategorized: 'Sin categorizar',
  eisenhower_empty: 'No hay tareas en este cuadrante.',
  eisenhower_hint:
    'Haz clic en una tarea o arrástrala a un cuadrante. El horizonte filtra qué entra en la matriz.',
  eisenhower_horizon: 'Horizonte',
  eisenhower_horizon_30d: '30 días adelante',
  eisenhower_horizon_month: 'Mes actual',
  eisenhower_horizon_3m: '3 meses',
  eisenhower_horizon_6m: '6 meses',
  eisenhower_horizon_1y: '1 año',
  eisenhower_series_done_period: 'Hecho este periodo',
  eisenhower_series_next: 'Próximo',
  eisenhower_series_done_next_title:
    'Completado el {done}. La serie se repite el {next}.',

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
  dashboard_rx_title: 'Recetario',
  dashboard_rx_subtitle:
    'Por persona o mascota: tomas de hoy, % de avance, días que quedan en cada fase y tomas hechas/pendientes.',
  dashboard_open_recetario: 'Ver recetario',
  dashboard_doses_badge: '{pending}/{total} tomas hoy',

  recetario_title: 'Recetario',
  recetario_subtitle:
    'Tratamientos y tomas por persona o mascota. Marca las tomas del día y revisa el avance de cada fase.',
  recetario_kpi_subjects: 'Sujetos',
  recetario_kpi_treatments: 'Tratamientos activos',
  recetario_kpi_today: 'Tomas hoy',
  recetario_kpi_status: 'Estado',
  recetario_kpi_ready: 'Listo',
  recetario_filter_all: 'Todos',
  recetario_filter_people: 'Personas',
  recetario_filter_pets: 'Mascotas',
  recetario_empty: 'Aún no hay recetarios. Pulsa + para crear el primero.',
  recetario_loading: 'Cargando tratamientos…',
  recetario_new: 'Nuevo recetario',
  recetario_new_hint: 'Define el remedio, la persona o mascota y las fases del plan.',
  recetario_day_range: 'Rango de días',
  recetario_prev_day: 'Día anterior',
  recetario_next_day: 'Día siguiente',
  recetario_no_doses_day: 'Sin tomas este día',
  rx_load_error: 'No se pudieron cargar los recetarios.',
  rx_toggle_error: 'No se pudo actualizar la toma.',
  rx_today_doses: 'Tomas de hoy',
  rx_no_doses_today_subject: 'Sin tomas programadas para hoy.',
  rx_treatments_title: 'Tratamientos',
  rx_treatment_one: 'tratamiento',
  rx_treatment_many: 'tratamientos',
  rx_treatment_finished: 'Finalizado',
  rx_progress_pct: '{pct}% · {done}/{total} tomas · quedan {left}',
  rx_progress_phases: 'Fases del plan',
  rx_progress_no_phases: 'Sin detalle de fases en este plan.',
  rx_progress_days_left: 'Días restantes',
  rx_progress_doses: 'Tomas',
  rx_progress_remaining: 'Quedan',
  rx_progress_left_short: 'quedan',
  rx_phase_status_active: 'En curso',
  rx_phase_status_upcoming: 'Próxima',
  rx_phase_status_done: 'Hecha',
  rx_times_per_day: '{n}×/día',
  rx_phase_days_count: '{n} días',
  rx_subject_unnamed_person: 'Persona (sin nombre)',
  rx_subject_unnamed_pet: 'Mascota (sin nombre)',
  rx_edit_owner_title: 'Editar receta',
  rx_edit_owner_desc:
    'Medicamento, dueño, horarios de ingesta y fases de «{title}». Los cambios de plan regeneran las tomas pendientes desde hoy.',
  rx_edit_owner_kind: 'Tipo',
  rx_edit_owner_hint:
    'Ej. Ragnar. Si lo pasas a mascota, aparecerá en el filtro de mascotas.',
  rx_edit_owner_action: 'Editar',
  rx_edit_owner_saved: 'Recetario actualizado.',
  rx_edit_owner_error: 'No se pudo actualizar el recetario.',
  rx_delete_title: 'Eliminar recetario',
  rx_delete_confirm:
    '¿Eliminar el recetario «{title}» y sus {n} tomas? Esta acción no se puede deshacer.',
  rx_delete_saved: 'Recetario eliminado.',
  rx_delete_error: 'No se pudo eliminar el recetario.',
  rx_delete_deleting: 'Eliminando…',
  rx_phases_ending_title: 'Fases que terminan esta semana',
  rx_phases_ending_subtitle:
    'Fases de tratamiento cuyo último día cae en los próximos 7 días.',
  rx_phases_ending_empty: 'Ninguna fase termina en los próximos 7 días.',
  rx_phases_ending_on: 'Termina {date}',

  empty_no_tasks: 'Aún no hay tareas.',
  empty_no_events: 'Aún no hay eventos.',
  empty_no_possible: 'Aún no hay eventos posibles.',
  empty_no_rx: 'Aún no hay tomas de recetario.',
  empty_no_habits: 'Aún no hay hábitos.',
  empty_no_projects_cat: 'Aún no hay tareas de proyectos.',
  empty_no_finances: 'Aún no hay ingresos ni gastos en el calendario.',
  empty_no_projects: 'Aún no hay proyectos.',
  task_steps_label: 'Pasos asociados',
  task_steps_hint: 'Pulsa para desplegar y añadir una checklist.',
  task_steps_empty: 'Sin pasos. Añade el primero.',
  task_steps_placeholder: 'Ej. Comprar cuerdas, calentar 10 min…',
  task_steps_add: 'Añadir paso',
  task_steps_progress: '{done}/{total} pasos',
  task_images_label: 'Adjuntos',
  task_images_hint: 'Arrastra imágenes o PDF aquí, o haz clic para elegirlos',
  task_images_drop: 'Suelta para adjuntar',
  task_images_max: 'Hasta {n} archivos · imágenes se comprimen; PDF máx. 1,2 MB',
  task_images_limit: 'Máximo {n} adjuntos por tarea',
  task_images_not_image: 'Solo se admiten imágenes o PDF',
  task_images_error: 'No se pudo procesar el archivo',
  task_images_compressing: 'Procesando…',
  task_images_remove: 'Quitar adjunto',
  task_images_preview: 'Ver imagen',
  task_images_preview_pdf: 'Ver PDF',
  task_images_pdf_too_large: 'El PDF supera 1,2 MB. Reduce el archivo o divídelo.',

  docs_title: 'Documentos',
  docs_subtitle:
    'Imágenes y PDF adjuntos a tus entradas. Filtra por fecha, tipo de archivo, tipo de tarea o proyecto.',
  docs_search: 'Buscar por nombre o tarea…',
  docs_filter_from: 'Desde',
  docs_filter_to: 'Hasta',
  docs_filter_project: 'Proyecto',
  docs_filter_kind: 'Tipo de tarea',
  docs_filter_type: 'Archivo',
  docs_filter_all_projects: 'Todos los proyectos',
  docs_filter_all_kinds: 'Todos los tipos',
  docs_no_project: 'Sin proyecto',
  docs_type_all: 'Todos',
  docs_type_image: 'Imágenes',
  docs_type_pdf: 'PDF',
  docs_clear_filters: 'Limpiar filtros',
  docs_empty: 'Aún no hay documentos adjuntos.',
  docs_empty_filtered: 'Ningún adjunto coincide con esos filtros.',
  docs_count: '{n} adjuntos',
  docs_load_error: 'No se pudieron cargar los documentos.',
  docs_download: 'Descargar',
  docs_open_tab: 'Abrir en pestaña',
  docs_open_task: 'Ver tarea',

  circle_title: 'Círculo',
  circle_subtitle:
    'Personas y mascotas cercanas. En tareas y recetarios escribe @tag para etiquetarlas (p. ej. @Ana, @Ragnar).',
  circle_new: 'Añadir al círculo',
  circle_edit: 'Editar contacto',
  circle_create: 'Añadir',
  circle_form_desc:
    'Define un nombre y uno o más tags. En el tablero usa @tag para asociar tareas o dosis.',
  circle_kind: 'Tipo',
  circle_kind_person: 'Persona',
  circle_kind_pet: 'Mascota',
  circle_name: 'Nombre',
  circle_name_ph_person: 'Ej. Ana, Carlos…',
  circle_name_ph_pet: 'Ej. Ragnar, Luna…',
  circle_tags: 'Tags (para @)',
  circle_tags_ph: 'Ana, mamá (separados por coma)',
  circle_tags_hint:
    'Si no indicas tags, se usa la primera palabra del nombre. Escribe @tag en el título de la tarea.',
  circle_relationship: 'Relación',
  circle_relationship_none: 'Sin indicar',
  circle_rel_father: 'Padre',
  circle_rel_mother: 'Madre',
  circle_rel_son: 'Hijo',
  circle_rel_daughter: 'Hija',
  circle_rel_brother: 'Hermano',
  circle_rel_sister: 'Hermana',
  circle_rel_partner: 'Pareja',
  circle_rel_niece: 'Sobrina',
  circle_rel_nephew: 'Sobrino',
  circle_rel_friend: 'Amigo/a',
  circle_rel_coworker: 'Compañero/a de trabajo',
  circle_filter_all: 'Todos',
  circle_empty: 'Tu círculo está vacío',
  circle_empty_hint:
    'Añade personas y mascotas para etiquetarlas con @ en tareas y recetarios.',
  circle_created: 'Contacto añadido al círculo.',
  circle_updated: 'Contacto actualizado.',
  circle_deleted: 'Contacto eliminado.',
  circle_save_error: 'No pudimos guardar el contacto.',
  circle_delete_error: 'No pudimos eliminar el contacto.',
  circle_delete_confirm: '¿Eliminar a «{name}» del círculo?',
  circle_delete_title: 'Eliminar contacto',
  circle_mention_hint: 'Usa @tag para etiquetar a alguien del Círculo.',
  circle_pulse: 'Cómo está la relación',
  circle_pulse_none: 'Sin indicar',
  circle_pulse_hint:
    'Tu percepción personal del vínculo: útil para priorizar con quién conectar.',
  circle_pulse_great: 'Muy buena',
  circle_pulse_good: 'Buena',
  circle_pulse_neutral: 'Neutra',
  circle_pulse_need_connect: 'Falta conectar',
  circle_pulse_strained: 'Tensa',
  circle_pulse_bad: 'Mala',
  circle_view_commitments: 'Ver compromisos futuros',
  circle_commitments_title: 'Compromisos con {name}',
  circle_commitments_desc:
    'Tareas y citas pendientes en los próximos {days} días etiquetadas con @ de esta persona o mascota.',
  circle_commitments_empty: 'No hay compromisos futuros con este contacto.',
  circle_commitments_error: 'No pudimos cargar los compromisos.',
};

const en_dict: TranslationDict = {
  nav_summary: 'Summary',
  nav_tasks: 'Calendar',
  nav_projects: 'Projects',
  nav_documents: 'Documents',
  nav_circle: 'Circle',
  nav_analytics: 'Analytics',
  nav_activity: 'Activity',
  nav_settings: 'Settings',
  nav_admin: 'Admin',
  nav_eisenhower: 'Priority Matrix',
  nav_notifications: 'Alerts',
  nav_memento: 'Memento mori',
  nav_life_goals: 'Life goals',
  nav_reflections: 'Reflections',
  nav_recetario: 'Prescriptions',
  nav_finances: 'Finances',
  fin_add: 'Add entry',
  fin_edit: 'Edit entry',
  fin_this_month: 'This month',
  fin_total_income: 'Income',
  fin_total_expense: 'Expenses',
  fin_balance: 'Balance',
  fin_income_recurring: 'Recurring income',
  fin_income_expected: 'Expected income',
  fin_income_specific: 'One-off income',
  fin_expense_recurring: 'Recurring expenses',
  fin_expense_expected: 'Expected expenses',
  fin_expense_specific: 'One-off expenses',
  fin_flow_income: 'Income',
  fin_flow_expense: 'Expense',
  fin_kind_recurring: 'Recurring',
  fin_kind_expected: 'Expected',
  fin_kind_specific: 'Specific',
  fin_freq_monthly: 'Monthly',
  fin_freq_weekly: 'Weekly',
  fin_filter_all_flows: 'All flows',
  fin_filter_all_kinds: 'All kinds',
  fin_empty_title: 'No entries this month',
  fin_empty_hint:
    'Track recurring, expected, and specific expenses and income to see your monthly balance.',
  fin_field_title: 'Title',
  fin_title_ph: 'e.g. Rent, payroll, dinner…',
  fin_field_flow: 'Flow',
  fin_field_kind: 'Kind',
  fin_field_amount: 'Amount',
  fin_field_currency: 'Currency',
  fin_field_frequency: 'Frequency',
  fin_field_monthday: 'Day of month',
  fin_field_weekday: 'Weekday',
  fin_field_date: 'Date',
  fin_field_notes: 'Notes',
  fin_field_active: 'Active (counts in summary)',
  fin_weekday_0: 'Sunday',
  fin_weekday_1: 'Monday',
  fin_weekday_2: 'Tuesday',
  fin_weekday_3: 'Wednesday',
  fin_weekday_4: 'Thursday',
  fin_weekday_5: 'Friday',
  fin_weekday_6: 'Saturday',
  fin_title_required: 'Enter a title.',
  fin_amount_required: 'Enter a valid amount.',
  fin_saved: 'Entry updated.',
  fin_created: 'Entry created.',
  fin_deleted: 'Entry deleted.',
  fin_delete_confirm: 'Delete “{title}”?',
  fin_delete_title: 'Delete entry',
  fin_save_error: 'Could not save the entry.',
  fin_load_error: 'Could not load finances.',

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
  life_goal_delete_title: 'Delete life goal',
  life_goal_image_error: 'Could not process the image.',
  life_goal_saving: 'Saving…',
  life_goal_need_birthdate:
    'To place goals on the week map, set your birth date in Settings.',
  life_goal_off_map: 'Off map',

  reflections_title: 'Daily reflections',
  reflections_subtitle:
    'Mood, energy and body feel by hour; sleep, reflection and gratitude for the day. Life journal shows your evolution.',
  reflections_prev_day: 'Previous day',
  reflections_next_day: 'Next day',
  reflections_go_today: 'Go to today',
  reflections_week_strip: 'Last 7 days',
  reflections_day_avg: 'Day average',
  reflections_hours_logged: 'hours logged',
  reflections_section_day: 'Of the day',
  reflections_section_day_hint:
    'Sleep, week summary, reflection and gratitude — what covers the whole day.',
  reflections_section_hourly: 'By hour',
  reflections_section_hourly_hint:
    'Mood, energy level and feel (tense / relaxed / vigorous) per hour. Tap a slot and log how you are.',
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
  reflections_synced: 'All saved.',
  reflections_discard_confirm:
    'You have unsaved changes. Discard them and change day?',
  reflections_discard_title: 'Unsaved changes',
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
  energy_feel_title: 'How it feels',
  energy_feel_hint:
    'Complements the level: you can have high energy and feel tense, or low energy and feel relaxed.',
  energy_feel_tense: 'Tense',
  energy_feel_relaxed: 'Relaxed',
  energy_feel_vigorous: 'Vigorous',
  reflections_tab_day: 'Day',
  reflections_tab_life: 'Life journal',
  life_journal_title: 'Life journal',
  life_journal_subtitle:
    'Reflections, gratitudes and mood evolution over the week, month or last 3 months.',
  life_journal_period_week: 'Week',
  life_journal_period_month: 'Month',
  life_journal_period_quarter: '3 months',
  life_journal_mood_evolution: 'Mood evolution',
  life_journal_energy_evolution: 'Energy evolution',
  life_journal_entries: 'Reflections and gratitudes',
  life_journal_empty:
    'No entries in this period yet. Write a reflection or gratitude in the Day tab.',
  life_journal_no_text: 'No text that day',
  life_journal_open_day: 'Open day',
  life_journal_avg_mood: 'Avg mood',
  life_journal_avg_energy: 'Avg energy',
  life_journal_days_logged: 'days with data',
  life_journal_trend_up: 'Trending up',
  life_journal_trend_down: 'Trending down',
  life_journal_trend_flat: 'Steady',
  life_journal_trend_unknown: 'No trend yet',
  sleep_title: 'Sleep for the day',
  sleep_hint: 'Approx. hours you slept (the night before this day).',
  sleep_hours_label: 'Hours',
  sleep_not_set: 'Not set',
  sleep_recorded: '{h} h of sleep',
  wellbeing_panel_title: 'Wellbeing (week)',
  wellbeing_panel_subtitle:
    'Mood, energy, feel (tense/relaxed/vigorous) and sleep for the last 7 days, plus supportive messages.',
  wellbeing_open_journal: 'Journal',
  wellbeing_kpi_mood: 'Mood',
  wellbeing_kpi_energy: 'Energy',
  wellbeing_kpi_sleep: 'Sleep',
  wellbeing_kpi_feel: 'Feel',
  wellbeing_feel_none: 'No feel',
  wellbeing_days_short: 'days',
  wellbeing_chart_mood: 'Mood / day',
  wellbeing_chart_energy: 'Energy / day',
  wellbeing_chart_sleep: 'Sleep / day',
  wellbeing_chart_feel: 'Feel / day',
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
  action_save_event: 'Save event',
  action_new_project: 'New project',
  action_save: 'Save',
  action_cancel: 'Cancel',
  action_close: 'Close',
  action_delete: 'Delete',
  action_confirm: 'Confirm',
  action_discard: 'Discard',
  action_edit: 'Edit',
  action_today: 'Today',
  action_sign_out: 'Sign out',
  action_sign_in: 'Sign in',
  action_undo: 'Undo',
  action_redo: 'Redo',
  confirm_delete_title: 'Delete?',
  confirm_discard_title: 'Discard changes?',
  confirm_reset_title: 'Confirm reset?',
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
  pwa_hard_reset_title: 'Reinstall app',
  pwa_hard_reset_running: 'Reinstalling…',
  settings_demo_reset_title: 'Reset demo',
  settings_demo_reset_confirm:
    'Reset all demo data? It will return to the initial seeded state.',
  project_delete_title: 'Delete project',
  project_delete_confirm:
    'Delete “{name}”? Linked tasks will keep going without a project.',
  pwa_installed_badge: 'Installed app mode · v{version} · {build}',
  offline_banner: 'You are offline. Changes are saved and will sync when you reconnect.',
  offline_pending: '{n} change(s) waiting to sync',
  offline_sync_now: 'Sync now',
  offline_synced: 'Synced {n} change(s)',

  board_week_view: 'Week',
  board_month_view: 'Month',
  board_continuous_view: 'Continuous',
  board_day_view: 'Day',
  board_hide_completed: 'Hide completed',
  board_show_completed: 'Show completed',
  task_location: 'Place',
  task_location_ph: 'e.g. office, home, Zoom…',
  board_ctx_view_day: 'View day',
  board_go_today: 'Go to today',
  board_go_this_week: 'Go to this week',
  board_go_this_month: 'Go to this month',
  board_next_week: 'Next week',
  board_prev_week: 'Previous week',
  board_prev_day: 'Previous day',
  board_next_day: 'Next day',
  board_add_task: 'Add task',
  layout_list: 'List',
  layout_schedule: 'Schedule',
  schedule_all_day: 'No time',
  schedule_slot_dblclick_hint: 'Double-click an empty slot to create',
  schedule_create_at: 'Create at {time}',
  schedule_create_pick: 'What do you want to create?',
  day_sort_label: 'Sort',
  day_sort_time: 'Time',
  day_sort_name: 'Name',
  day_sort_importance: 'Importance',
  day_sort_urgency: 'Urgency',
  day_sort_help: 'Click: primary sort. Shift+click: add/remove criterion.',
  day_sort_primary_hint: 'Click again to toggle asc/desc',
  day_sort_secondary_hint: 'Shift+click to remove this criterion',
  day_sort_add_hint: 'Click as primary · Shift+click to add',
  board_filter_project: 'Project',
  board_filter_urgency: 'Urgency',
  board_filter_importance: 'Importance',
  board_filter_all: 'All',
  board_filter_category: 'Category',
  board_filter_category_all: 'All',
  board_filter_category_projects: 'Projects',
  board_filter_category_rx: 'Prescriptions',
  board_filter_category_possible: 'Possible events',
  board_category_possible_hint:
    'Tentative plans: one day or a range. Link people or pets from your Circle.',
  board_filter_category_events: 'Events',
  board_filter_category_habits: 'Habits',
  board_category_habits_hint:
    'Good habits and habits to quit. Each day shows a checkbox to mark if you did it.',
  board_category_events_hint:
    'Events with place, dates and planned departure (reminders use departure time).',
  board_category_rx_hint:
    'Prescription doses only. Remedies skip project and Eisenhower fields.',

  task_ctx_mark_complete: 'Mark as completed',
  task_ctx_mark_pending: 'Mark as pending',
  task_ctx_edit: 'Edit',
  task_ctx_delete: 'Delete',
  task_ctx_confirm_event: 'Convert to real event',
  task_confirm_event_done: 'Now it’s a confirmed event.',
  task_kind_convert: 'Entry type',
  task_kind_convert_hint:
    'Tap the type to see all options with icons. After you pick one, the grid closes and only the selected chip stays.',
  task_event_departure_draft_hint:
    'Planned departure applies when saved as a real event. As a possible event it is not used for notifications.',

  task_title_placeholder: 'What do you want to do?',
  task_title_label: 'Title',
  task_reminder_placeholder: 'What should we remind you of?',
  task_kind_task: 'Task',
  task_kind_reminder: 'Reminder',
  task_kind_rx_human: 'Rx human',
  task_kind_rx_pet: 'Rx pet',
  task_kind_possible_event: 'Possible event',
  task_possible_event_placeholder: 'e.g. Family trip, vet visit…',
  task_kind_event: 'Event',
  task_kind_habit_good: 'Good habit',
  task_kind_habit_quit: 'Habit to quit',
  task_kind_finance_income: 'Income',
  task_kind_finance_expense: 'Expense',
  task_finance_hint:
    'Calendar finance entry. No start/end time. Mark fixed or potential, and use recurrence if it repeats.',
  task_finance_certainty: 'Certainty',
  task_finance_fixed: 'Fixed (confirmed)',
  task_finance_potential: 'Potential (expected)',
  board_filter_category_finances: 'Finances',
  board_category_finances_hint: 'Calendar income and expenses.',
  board_filter_category_holidays: 'CL holidays',
  board_category_holidays_hint: 'Chile national holidays.',
  empty_no_holidays: 'No holidays in this range.',
  task_repeat_last_day_prompt: 'Repeat on the last day of each month?',
  task_repeat_last_day_prompt_hint:
    'You picked the last day of this month (e.g. 31). Not every month has that number. We recommend anchoring to the last day of the month.',
  task_repeat_use_last_day: 'Yes, last day of month',
  task_repeat_keep_day_n: 'No, keep day number (clamp)',
  task_repeat_business_days: 'Use business days (Chile)',
  task_repeat_business_days_hint:
    'Monday–Friday, excluding Chile national holidays.',
  task_repeat_first_business: 'First business day of the month',
  task_repeat_last_business: 'Last business day of the month',
  task_habit_placeholder: 'e.g. Play guitar, read, go to the gym…',
  task_habit_quit_placeholder: 'e.g. Social media, sugar, procrastinating…',
  action_add_habit: 'Save habit',
  habit_done: 'Done',
  habit_not_done: 'Pending',
  habit_badge_good: 'Build',
  habit_badge_quit: 'Quit',
  task_event_placeholder: 'e.g. Dinner with Ana, match, doctor visit…',
  task_event_location: 'Place',
  task_event_location_ph: "e.g. Ana's place, Colón Theatre, Zoom…",
  task_possible_event_location: 'Possible place',
  task_possible_event_location_ph: "e.g. Ana's place, park, restaurant…",
  task_event_departure: 'Planned departure',
  task_event_departure_hint:
    'Time you leave. “X min before” reminders are scheduled from this time.',
  task_involved_contacts: 'Involved (Circle)',
  task_involved_contacts_hint:
    'Pick people or pets. They will be linked to the event and their commitments.',
  task_involved_none: 'None selected',
  involved_filter_label: 'Filter involved',
  involved_filter_all: 'All',
  involved_filter_family: 'Family',
  involved_filter_partner: 'Partner',
  involved_filter_friend: 'Friends',
  involved_filter_work: 'Work',
  involved_filter_pet: 'Pets',
  involved_filter_other: 'Other',
  involved_filter_empty: 'No one in this filter',
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
  rx_times: 'Fixed times',
  rx_add_time: 'time',
  rx_schedule_mode: 'How to schedule doses',
  rx_schedule_fixed: 'Fixed times',
  rx_schedule_interval: 'Every N hours',
  rx_every_hours: 'Every (hours)',
  rx_interval_start: 'Start time',
  rx_interval_preview: 'Computed times',
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
  task_category_label: 'Subcategory',
  task_no_category: 'No subcategory',
  project_edit_title: 'Edit project',
  project_new_title: 'New project',
  project_form_desc:
    'Projects group tasks by context. You can add subcategories (e.g. Work → Backend).',
  project_name_label: 'Name',
  project_name_ph: 'e.g. Personal, Work, Learning…',
  project_color_label: 'Color',
  project_icon_label: 'Icon',
  project_categories_label: 'Subcategories',
  project_categories_hint:
    'Optional. When creating a task you can pick one under this project.',
  project_category_ph: 'e.g. Backend, Marketing…',
  project_category_add: 'Add',
  project_category_remove: 'Remove subcategory',
  project_categories_max: 'Up to {n} subcategories per project',
  project_unnamed: 'Untitled',
  project_categories_count: '{n} subcategories',
  action_create: 'Create',
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
  task_date_range_drag_hint:
    'Drag the ends to set the range, or pick exact dates above.',
  task_date_pick_start: 'Pick the start date',
  task_date_pick_end: 'Pick the end date of the range',
  task_date_pick_range: 'Tap start, then end of the range',
  task_date_single_day: 'Single day',
  task_date_n_days: '{n} days',
  task_date_make_single: 'Single day only',
  task_date_add_end: 'Add end date',
  task_date_today: 'Today',
  task_date_done: 'Done',
  task_schedule: 'Schedule',
  task_start_time: 'Start time',
  task_end_time: 'End time',
  task_clear_time: 'Clear time',
  time_now: 'Now',
  task_time_range_error:
    'End time must be greater than or equal to start time on the same day. Multi-day spans may end after midnight (e.g. 20:00 → 03:00).',
  task_created_ok: 'Task saved.',
  task_saved_ok: 'Saved.',
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
  task_delete_confirm: 'Delete “{title}”?',
  task_delete_title: 'Delete task',
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
  settings_tab_account: 'Account',
  settings_tab_preferences: 'Preferences',
  settings_tab_appearance: 'Appearance',
  settings_tab_notifications: 'Alerts',
  settings_tab_finances: 'Finances',
  settings_tab_system: 'System',
  settings_finances_title: 'Finances',
  settings_finances_intro:
    'How money movements behave in the app.',
  settings_preferred_currency: 'Preferred currency',
  settings_preferred_currency_desc:
    'Default for the Finances module and when creating income or expenses on the calendar.',
  settings_language: 'Language',
  settings_language_es: 'Spanish',
  settings_language_en: 'English',
  settings_week_starts_monday: 'Week starts on Monday',
  settings_week_starts_monday_desc: 'If disabled, the board starts on Sunday.',
  settings_auto_roll: 'Auto-roll incomplete tasks',
  settings_auto_roll_desc: 'Sundays 23:59 move pending tasks to the next Monday.',
  settings_default_project: 'Default project',
  settings_default_board_view: 'Default board view',
  settings_default_board_view_desc: 'How the board opens when you go to Calendar.',
  settings_none: 'None',
  settings_skin: 'Appearance',
  settings_skin_desc:
    'Solid skins or Liquid Glass (light/dark, macOS-style). Applies immediately across the app.',
  settings_skin_dark: 'Dark',
  settings_skin_light: 'Light',
  settings_skin_aero: 'Liquid Glass',
  settings_skin_aero_desc:
    'Apple materials: wallpaper, vibrancy and blur (UIBlurEffect). Form fields stay opaque.',
  settings_skin_glass_light: 'Liquid Glass · light',
  settings_skin_glass_dark: 'Liquid Glass · dark',
  settings_skin_glass_desc:
    'Like macOS: mesh wallpaper, frosted chrome (blur + saturate) and solid controls. 10 tones per mode.',
  settings_status_email: 'Email (Resend)',
  settings_status_email_ok: 'Configured',
  settings_status_email_off: 'No API key',
  settings_status_email_na: 'N/A demo',
  settings_status_email_from: 'From',
  settings_status_email_worker: 'Email worker',
  settings_status_email_worker_off: 'Off',
  settings_status_auth_hint:
    'Google OAuth and Resend DNS are configured outside the app. Guide:',
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
  rx_phase_date_range: 'Phase {n}: {start} → {end} ({days} d)',
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

  eisenhower_title: 'Priority Matrix',
  eisenhower_project: 'Project',
  eisenhower_all_projects: 'All',
  eisenhower_select_all: 'Select all',
  eisenhower_deselect_all: 'Deselect all',
  eisenhower_no_project: 'No project',
  eisenhower_filters: 'Filters',
  eisenhower_rx_excluded: 'Prescriptions are not shown in this matrix.',
  eisenhower_do: 'Urgent & important',
  eisenhower_schedule: 'Not urgent & important',
  eisenhower_delegate: 'Urgent & not important',
  eisenhower_eliminate: 'Not urgent & not important',
  eisenhower_uncategorized: 'Uncategorized',
  eisenhower_empty: 'No tasks in this quadrant.',
  eisenhower_hint:
    'Click a task or drag it into a quadrant. The horizon filters what appears in the matrix.',
  eisenhower_horizon: 'Horizon',
  eisenhower_horizon_30d: 'Next 30 days',
  eisenhower_horizon_month: 'This month',
  eisenhower_horizon_3m: '3 months',
  eisenhower_horizon_6m: '6 months',
  eisenhower_horizon_1y: '1 year',
  eisenhower_series_done_period: 'Done this period',
  eisenhower_series_next: 'Next',
  eisenhower_series_done_next_title:
    'Completed on {done}. Series repeats on {next}.',

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
  dashboard_rx_title: 'Prescriptions',
  dashboard_rx_subtitle:
    'By person or pet: today’s doses, progress %, days left per phase, and doses taken/remaining.',
  dashboard_open_recetario: 'Open prescriptions',
  dashboard_doses_badge: '{pending}/{total} doses today',

  recetario_title: 'Prescriptions',
  recetario_subtitle:
    'Treatments and doses by person or pet. Check off today’s doses and review phase progress.',
  recetario_kpi_subjects: 'Subjects',
  recetario_kpi_treatments: 'Active treatments',
  recetario_kpi_today: 'Doses today',
  recetario_kpi_status: 'Status',
  recetario_kpi_ready: 'Ready',
  recetario_filter_all: 'All',
  recetario_filter_people: 'People',
  recetario_filter_pets: 'Pets',
  recetario_empty: 'No prescriptions yet. Tap + to create the first one.',
  recetario_loading: 'Loading treatments…',
  recetario_new: 'New prescription',
  recetario_new_hint: 'Set the medicine, person or pet, and plan phases.',
  recetario_day_range: 'Day range',
  recetario_prev_day: 'Previous day',
  recetario_next_day: 'Next day',
  recetario_no_doses_day: 'No doses this day',
  rx_load_error: 'Could not load prescriptions.',
  rx_toggle_error: 'Could not update the dose.',
  rx_today_doses: 'Today’s doses',
  rx_no_doses_today_subject: 'No doses scheduled for today.',
  rx_treatments_title: 'Treatments',
  rx_treatment_one: 'treatment',
  rx_treatment_many: 'treatments',
  rx_treatment_finished: 'Finished',
  rx_progress_pct: '{pct}% · {done}/{total} doses · {left} left',
  rx_progress_phases: 'Plan phases',
  rx_progress_no_phases: 'No phase detail on this plan.',
  rx_progress_days_left: 'Days left',
  rx_progress_doses: 'Doses',
  rx_progress_remaining: 'Remaining',
  rx_progress_left_short: 'left',
  rx_phase_status_active: 'Active',
  rx_phase_status_upcoming: 'Upcoming',
  rx_phase_status_done: 'Done',
  rx_times_per_day: '{n}×/day',
  rx_phase_days_count: '{n} days',
  rx_subject_unnamed_person: 'Person (unnamed)',
  rx_subject_unnamed_pet: 'Pet (unnamed)',
  rx_edit_owner_title: 'Edit prescription',
  rx_edit_owner_desc:
    'Medicine, owner, intake times and phases for “{title}”. Plan changes regenerate pending doses from today.',
  rx_edit_owner_kind: 'Type',
  rx_edit_owner_hint:
    'e.g. Ragnar. Switch to pet to show it under the pets filter.',
  rx_edit_owner_action: 'Edit',
  rx_edit_owner_saved: 'Prescription updated.',
  rx_edit_owner_error: 'Could not update the prescription.',
  rx_delete_title: 'Delete prescription',
  rx_delete_confirm:
    'Delete prescription “{title}” and its {n} doses? This cannot be undone.',
  rx_delete_saved: 'Prescription deleted.',
  rx_delete_error: 'Could not delete the prescription.',
  rx_delete_deleting: 'Deleting…',
  rx_phases_ending_title: 'Phases ending this week',
  rx_phases_ending_subtitle:
    'Treatment phases whose last day falls in the next 7 days.',
  rx_phases_ending_empty: 'No phases end in the next 7 days.',
  rx_phases_ending_on: 'Ends {date}',

  empty_no_tasks: 'No tasks yet.',
  empty_no_events: 'No events yet.',
  empty_no_possible: 'No possible events yet.',
  empty_no_rx: 'No prescription doses yet.',
  empty_no_habits: 'No habits yet.',
  empty_no_finances: 'No calendar finance entries yet.',
  empty_no_projects_cat: 'No project tasks yet.',
  empty_no_projects: 'No projects yet.',
  task_steps_label: 'Associated steps',
  task_steps_hint: 'Click to expand and add a checklist.',
  task_steps_empty: 'No steps yet. Add the first one.',
  task_steps_placeholder: 'e.g. Buy strings, warm up 10 min…',
  task_steps_add: 'Add step',
  task_steps_progress: '{done}/{total} steps',
  task_images_label: 'Attachments',
  task_images_hint: 'Drag images or PDFs here, or click to choose files',
  task_images_drop: 'Drop to attach',
  task_images_max: 'Up to {n} files · images are compressed; PDF max 1.2 MB',
  task_images_limit: 'Maximum {n} attachments per task',
  task_images_not_image: 'Only images or PDFs are allowed',
  task_images_error: 'Could not process the file',
  task_images_compressing: 'Processing…',
  task_images_remove: 'Remove attachment',
  task_images_preview: 'View image',
  task_images_preview_pdf: 'View PDF',
  task_images_pdf_too_large: 'The PDF is larger than 1.2 MB. Shrink it or split it.',

  docs_title: 'Documents',
  docs_subtitle:
    'Images and PDFs attached to your entries. Filter by date, file type, task type or project.',
  docs_search: 'Search by name or task…',
  docs_filter_from: 'From',
  docs_filter_to: 'To',
  docs_filter_project: 'Project',
  docs_filter_kind: 'Task type',
  docs_filter_type: 'File',
  docs_filter_all_projects: 'All projects',
  docs_filter_all_kinds: 'All types',
  docs_no_project: 'No project',
  docs_type_all: 'All',
  docs_type_image: 'Images',
  docs_type_pdf: 'PDF',
  docs_clear_filters: 'Clear filters',
  docs_empty: 'No attachments yet.',
  docs_empty_filtered: 'No attachments match those filters.',
  docs_count: '{n} attachments',
  docs_load_error: 'Could not load documents.',
  docs_download: 'Download',
  docs_open_tab: 'Open in tab',
  docs_open_task: 'View task',

  circle_title: 'Circle',
  circle_subtitle:
    'People and pets close to you. In tasks and prescriptions type @tag to tag them (e.g. @Ana, @Ragnar).',
  circle_new: 'Add to circle',
  circle_edit: 'Edit contact',
  circle_create: 'Add',
  circle_form_desc:
    'Set a name and one or more tags. On the board use @tag to link tasks or doses.',
  circle_kind: 'Type',
  circle_kind_person: 'Person',
  circle_kind_pet: 'Pet',
  circle_name: 'Name',
  circle_name_ph_person: 'e.g. Ana, Carlos…',
  circle_name_ph_pet: 'e.g. Ragnar, Luna…',
  circle_tags: 'Tags (for @)',
  circle_tags_ph: 'Ana, mom (comma-separated)',
  circle_tags_hint:
    'If empty, the first word of the name is used. Type @tag in the task title.',
  circle_relationship: 'Relationship',
  circle_relationship_none: 'Not set',
  circle_rel_father: 'Father',
  circle_rel_mother: 'Mother',
  circle_rel_son: 'Son',
  circle_rel_daughter: 'Daughter',
  circle_rel_brother: 'Brother',
  circle_rel_sister: 'Sister',
  circle_rel_partner: 'Partner',
  circle_rel_niece: 'Niece',
  circle_rel_nephew: 'Nephew',
  circle_rel_friend: 'Friend',
  circle_rel_coworker: 'Coworker',
  circle_filter_all: 'All',
  circle_empty: 'Your circle is empty',
  circle_empty_hint: 'Add people and pets so you can tag them with @ in tasks and prescriptions.',
  circle_created: 'Contact added to circle.',
  circle_updated: 'Contact updated.',
  circle_deleted: 'Contact removed.',
  circle_save_error: 'Could not save the contact.',
  circle_delete_error: 'Could not delete the contact.',
  circle_delete_confirm: 'Remove “{name}” from the circle?',
  circle_delete_title: 'Remove contact',
  circle_mention_hint: 'Use @tag to mention someone in your Circle.',
  circle_pulse: 'How the relationship feels',
  circle_pulse_none: 'Not set',
  circle_pulse_hint:
    'Your personal sense of the bond — useful for deciding who to reconnect with.',
  circle_pulse_great: 'Great',
  circle_pulse_good: 'Good',
  circle_pulse_neutral: 'Neutral',
  circle_pulse_need_connect: 'Need to connect',
  circle_pulse_strained: 'Strained',
  circle_pulse_bad: 'Bad',
  circle_view_commitments: 'View future commitments',
  circle_commitments_title: 'Commitments with {name}',
  circle_commitments_desc:
    'Pending tasks and dates in the next {days} days tagged with @ for this person or pet.',
  circle_commitments_empty: 'No future commitments with this contact.',
  circle_commitments_error: 'Could not load commitments.',
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
