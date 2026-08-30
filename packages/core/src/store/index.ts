import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Task, Project, Contact, UserProfile, AnalyticsData } from '../types';
import { getWeekId, getDayId } from '../services/taskService';
import { BOARD_CREDIT_WEEK_ID } from '../lib/finance/boardCredits';

interface TasksState {
  // weekId -> dayId -> tasks
  tasksByDay: Record<string, Record<string, Task[]>>;
}

interface ProjectsState {
  projects: Project[];
}

interface ContactsState {
  contacts: Contact[];
}

interface UIState {
  currentWeekId: string;
  selectedDayId: string | null;
  analyticsOpen: boolean;
  filterProjectId: string | null;
  activeTaskId: string | null;
  detailTask: { weekId: string; dayId: string; taskId: string } | null;
}

interface AuthState {
  uid: string | null;
  profile: UserProfile | null;
  authLoading: boolean;
}

interface AnalyticsState {
  analyticsCache: Record<string, AnalyticsData>;
}

interface Actions {
  // tasks
  setDayTasks: (weekId: string, dayId: string, tasks: Task[]) => void;
  addTaskOptimistic: (weekId: string, dayId: string, task: Task) => void;
  updateTaskOptimistic: (weekId: string, dayId: string, taskId: string, patch: Partial<Task>) => void;
  /** Scan all start-day buckets and patch the first matching task id. */
  updateTaskById: (taskId: string, patch: Partial<Task>) => void;
  /** Patch every task in store that shares seriesId. */
  patchSeriesOptimistic: (seriesId: string, patch: Partial<Task>) => void;
  /** Une fichas descifradas a tareas que ya tienen financeMovementId. */
  applyLinkedFinance: (
    byMovementId: Record<string, NonNullable<Task['linkedFinance']>>
  ) => void;
  /** Reemplaza el cubo virtual de cuotas de crédito en el tablero. */
  replaceBoardCreditTasks: (byDay: Record<string, Task[]>) => void;
  removeTaskOptimistic: (weekId: string, dayId: string, taskId: string) => void;
  reorderTasks: (weekId: string, dayId: string, tasks: Task[]) => void;

  // projects
  setProjects: (projects: Project[]) => void;
  addProjectOptimistic: (project: Project) => void;
  updateProjectOptimistic: (projectId: string, patch: Partial<Project>) => void;
  removeProjectOptimistic: (projectId: string) => void;

  // contacts (Círculo)
  setContacts: (contacts: Contact[]) => void;
  addContactOptimistic: (contact: Contact) => void;
  updateContactOptimistic: (contactId: string, patch: Partial<Contact>) => void;
  removeContactOptimistic: (contactId: string) => void;

  // ui
  setCurrentWeek: (weekId: string) => void;
  setSelectedDay: (dayId: string | null) => void;
  toggleAnalytics: () => void;
  setFilterProject: (projectId: string | null) => void;
  setActiveTask: (taskId: string | null) => void;
  setDetailTask: (loc: { weekId: string; dayId: string; taskId: string } | null) => void;

  // auth
  setUid: (uid: string | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setAuthLoading: (loading: boolean) => void;

  // analytics
  setAnalytics: (weekId: string, data: AnalyticsData) => void;
}

type AppStore = TasksState &
  ProjectsState &
  ContactsState &
  UIState &
  AuthState &
  AnalyticsState &
  Actions;

const today = new Date();

export const useStore = create<AppStore>()(
  immer((set) => ({
    // tasks
    tasksByDay: {},

    // projects
    projects: [],

    // contacts
    contacts: [],

    // ui
    currentWeekId: getWeekId(today),
    selectedDayId: getDayId(today),
    analyticsOpen: false,
    filterProjectId: null,
    activeTaskId: null,
    detailTask: null,

    // auth
    uid: null,
    profile: null,
    authLoading: true,

    // analytics
    analyticsCache: {},

    // --- task actions ---
    setDayTasks: (weekId, dayId, tasks) =>
      set(state => {
        if (!state.tasksByDay[weekId]) state.tasksByDay[weekId] = {};
        state.tasksByDay[weekId][dayId] = tasks;
      }),

    addTaskOptimistic: (weekId, dayId, task) =>
      set(state => {
        if (!state.tasksByDay[weekId]) state.tasksByDay[weekId] = {};
        if (!state.tasksByDay[weekId][dayId]) state.tasksByDay[weekId][dayId] = [];
        state.tasksByDay[weekId][dayId].push(task);
      }),

    updateTaskOptimistic: (weekId, dayId, taskId, patch) =>
      set(state => {
        const tasks = state.tasksByDay[weekId]?.[dayId];
        if (!tasks) return;
        const idx = tasks.findIndex((t: Task) => t.id === taskId);
        if (idx !== -1) Object.assign(tasks[idx], patch);
      }),

    updateTaskById: (taskId, patch) =>
      set(state => {
        for (const days of Object.values(state.tasksByDay)) {
          for (const tasks of Object.values(days)) {
            const idx = tasks.findIndex((t: Task) => t.id === taskId);
            if (idx !== -1) {
              Object.assign(tasks[idx], patch);
              return;
            }
          }
        }
      }),

    patchSeriesOptimistic: (seriesId, patch) =>
      set(state => {
        for (const days of Object.values(state.tasksByDay)) {
          for (const tasks of Object.values(days)) {
            for (const task of tasks) {
              if (task.seriesId !== seriesId) continue;
              // Deep-merge de rx_meta para no pisar amount/fase al cambiar subject.
              if (patch.rx) {
                const { rx, ...rest } = patch;
                Object.assign(task, rest, {
                  rx: task.rx ? { ...task.rx, ...rx } : rx,
                });
              } else {
                Object.assign(task, patch);
              }
            }
          }
        }
      }),

    applyLinkedFinance: byMovementId =>
      set(state => {
        for (const days of Object.values(state.tasksByDay)) {
          for (const tasks of Object.values(days)) {
            for (const task of tasks) {
              if (!task.financeMovementId) continue;
              const link = byMovementId[task.financeMovementId];
              if (link) task.linkedFinance = link;
            }
          }
        }
      }),

    replaceBoardCreditTasks: byDay =>
      set(state => {
        state.tasksByDay[BOARD_CREDIT_WEEK_ID] = byDay;
      }),

    removeTaskOptimistic: (weekId, dayId, taskId) =>
      set(state => {
        const tasks = state.tasksByDay[weekId]?.[dayId];
        if (!tasks) return;
        state.tasksByDay[weekId][dayId] = tasks.filter((t: Task) => t.id !== taskId);
      }),

    reorderTasks: (weekId, dayId, tasks) =>
      set(state => {
        if (!state.tasksByDay[weekId]) state.tasksByDay[weekId] = {};
        state.tasksByDay[weekId][dayId] = tasks;
      }),

    // --- project actions ---
    setProjects: (projects) => set(state => { state.projects = projects; }),

    addProjectOptimistic: (project) =>
      set(state => { state.projects.push(project); }),

    updateProjectOptimistic: (projectId, patch) =>
      set(state => {
        const idx = state.projects.findIndex((p: Project) => p.id === projectId);
        if (idx !== -1) Object.assign(state.projects[idx], patch);
      }),

    removeProjectOptimistic: (projectId) =>
      set(state => { state.projects = state.projects.filter((p: Project) => p.id !== projectId); }),

    // --- contact actions ---
    setContacts: contacts => set(state => { state.contacts = contacts; }),

    addContactOptimistic: contact =>
      set(state => {
        // Evitar duplicados si realtime y optimistic llegan juntos
        if (state.contacts.some((c: Contact) => c.id === contact.id)) {
          state.contacts = state.contacts.map((c: Contact) =>
            c.id === contact.id ? contact : c
          );
        } else {
          state.contacts.push(contact);
        }
      }),

    updateContactOptimistic: (contactId, patch) =>
      set(state => {
        const idx = state.contacts.findIndex((c: Contact) => c.id === contactId);
        if (idx !== -1) Object.assign(state.contacts[idx], patch);
      }),

    removeContactOptimistic: contactId =>
      set(state => {
        state.contacts = state.contacts.filter((c: Contact) => c.id !== contactId);
      }),

    // --- ui actions ---
    setCurrentWeek: (weekId) => set(state => { state.currentWeekId = weekId; }),
    setSelectedDay: (dayId) => set(state => { state.selectedDayId = dayId; }),
    toggleAnalytics: () => set(state => { state.analyticsOpen = !state.analyticsOpen; }),
    setFilterProject: (projectId) => set(state => { state.filterProjectId = projectId; }),
    setActiveTask: (taskId) => set(state => { state.activeTaskId = taskId; }),
    setDetailTask: (loc) => set(state => { state.detailTask = loc; }),

    // --- auth actions ---
    setUid: (uid) => set(state => { state.uid = uid; }),
    setProfile: (profile) => set(state => { state.profile = profile; }),
    setAuthLoading: (loading) => set(state => { state.authLoading = loading; }),

    // --- analytics actions ---
    setAnalytics: (weekId, data) =>
      set(state => { state.analyticsCache[weekId] = data; }),
  }))
);

/** Busca la primera coincidencia de taskId en buckets de start-day. */
export function findTaskLocation(
  taskId: string
): { weekId: string; dayId: string; task: Task } | null {
  const { tasksByDay } = useStore.getState();
  for (const [weekId, days] of Object.entries(tasksByDay)) {
    for (const [dayId, tasks] of Object.entries(days)) {
      const task = tasks.find(t => t.id === taskId);
      if (task) return { weekId, dayId, task };
    }
  }
  return null;
}
