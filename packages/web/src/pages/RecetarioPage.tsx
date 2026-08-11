import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays } from 'date-fns';
import { Pill, PawPrint, User, Users } from 'lucide-react';
import { Layout } from '@/components/Layout';
import {
  MobileSheet,
  MobileSheetContent,
  MobileSheetDescription,
  MobileSheetHeader,
  MobileSheetTitle,
} from '@/components/ui/mobile-sheet';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { AddTaskForm } from '@/components/Board';
import { RxTreatmentsPanel } from '@/components/Recetario/RxTreatmentsPanel';
import { RxDayColumns } from '@/components/Recetario/RxDayColumns';
import { RxOwnerEditDialog, type RxOwnerEditResult } from '@/components/Recetario/RxOwnerEditDialog';
import { RxPhasesEndingPanel } from '@/components/Recetario/RxPhasesEndingPanel';
import { useProjects } from '@core/hooks/useProjects';
import { useTasks } from '@core/hooks/useTasks';
import { findTaskLocation, useStore } from '@core/store';
import {
  collectRxTasksFromStore,
  buildRxSubjectGroups,
  isRxKind,
  listPhasesEndingInRange,
  type RxTreatmentProgress,
} from '@core/lib/rx';
import {
  fetchAllTasks,
  getDayId,
  getWeekId,
  mergeLocatedRowsIntoStore,
} from '@core/services/taskService';
import { isDemoMode } from '@core/lib/demoMode';
import { useT } from '@/hooks/useT';
import { useToast } from '@/contexts/ToastContext';
import { cn } from '@/lib/utils';
import type { Task } from '@core/types';

type SubjectFilter = 'all' | 'human' | 'pet';

export function RecetarioPage() {
  const { t } = useT();
  const { showToast } = useToast();
  const { projects } = useProjects();
  const uid = useStore(s => s.uid);
  const tasksByDay = useStore(s => s.tasksByDay);
  const today = useMemo(() => new Date(), []);
  const todayId = getDayId(today);
  const weekId = getWeekId(today);
  const weekEndId = getDayId(addDays(today, 6));
  const { addTask, editTask, rematerializeRx, removeRxTreatment } = useTasks(
    weekId,
    todayId
  );

  const [filter, setFilter] = useState<SubjectFilter>('all');
  /** Centro de la ventana de 3 días (ayer | centro | mañana). */
  const [centerDayId, setCenterDayId] = useState(todayId);
  const [remoteRx, setRemoteRx] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RxTreatmentProgress | null>(null);
  const [savingTreatment, setSavingTreatment] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RxTreatmentProgress | null>(null);
  const [deletingTreatmentKey, setDeletingTreatmentKey] = useState<string | null>(
    null
  );

  const loadAllRx = useCallback(async () => {
    if (!uid || isDemoMode()) {
      setRemoteRx([]);
      return;
    }
    setLoading(true);
    try {
      const rows = await fetchAllTasks(uid);
      const rxRows = rows.filter(r => isRxKind(r.kind));
      mergeLocatedRowsIntoStore(rxRows);
      setRemoteRx(
        rxRows.map(r => {
          const { weekId: _w, dayId, ...task } = r;
          return { ...(task as Task), dayId };
        })
      );
    } catch (err) {
      console.error('[recetario] load failed', err);
      showToast(t('rx_load_error'), 'error');
    } finally {
      setLoading(false);
    }
  }, [uid, showToast, t]);

  useEffect(() => {
    void loadAllRx();
  }, [loadAllRx]);

  const storeRx = useMemo(() => collectRxTasksFromStore(tasksByDay), [tasksByDay]);

  const allRx = useMemo(() => {
    const byId = new Map<string, Task>();
    for (const t of remoteRx) byId.set(t.id, t);
    for (const t of storeRx) byId.set(t.id, t);
    return [...byId.values()];
  }, [remoteRx, storeRx]);

  const groups = useMemo(() => {
    const all = buildRxSubjectGroups(allRx, todayId, { includeFinished: true });
    if (filter === 'human') return all.filter(g => g.kind === 'rx_human' || g.kind === 'mixed');
    if (filter === 'pet') return all.filter(g => g.kind === 'rx_pet' || g.kind === 'mixed');
    return all;
  }, [allRx, todayId, filter]);

  const phasesEnding = useMemo(() => {
    const treatments = groups.flatMap(g => g.treatments);
    return listPhasesEndingInRange(treatments, todayId, weekEndId);
  }, [groups, todayId, weekEndId]);

  const totals = useMemo(() => {
    const activeTreatments = groups.reduce(
      (s, g) => s + g.treatments.filter(tr => tr.isActive).length,
      0
    );
    const todayPending = groups.reduce(
      (s, g) => s + g.todayDoses.filter(d => !d.completed).length,
      0
    );
    const todayTotal = groups.reduce((s, g) => s + g.todayDoses.length, 0);
    return { activeTreatments, todayPending, todayTotal, subjects: groups.length };
  }, [groups]);

  function requestTreatmentDelete(treatment: RxTreatmentProgress) {
    if (deletingTreatmentKey) return;
    setDeleteTarget(treatment);
  }

  async function confirmTreatmentDelete() {
    const treatment = deleteTarget;
    if (!treatment || deletingTreatmentKey) return;

    setDeletingTreatmentKey(treatment.key);
    try {
      await removeRxTreatment({
        seriesId: treatment.seriesId,
        tasks: treatment.tasks.map(x => ({ id: x.id })),
      });

      const seriesId = treatment.seriesId;
      const ids = new Set(treatment.tasks.map(x => x.id));
      setRemoteRx(prev =>
        prev.filter(t => {
          if (seriesId && t.seriesId === seriesId) return false;
          return !ids.has(t.id);
        })
      );

      setDeleteTarget(null);
      showToast(t('rx_delete_saved'), 'success');
      await loadAllRx();
    } catch (err) {
      console.error('[recetario] treatment delete failed', err);
      showToast(t('rx_delete_error'), 'error');
      await loadAllRx();
    } finally {
      setDeletingTreatmentKey(null);
    }
  }

  async function handleTreatmentSave(result: RxOwnerEditResult) {
    if (!editTarget) return;
    const sample = editTarget.tasks[0];
    if (!sample) return;

    setSavingTreatment(true);
    try {
      const loc = findTaskLocation(sample.id);
      // editTask usa week/day del hook; taskHistory reubica con findTaskLocation.
      void loc;
      const subject = result.subject.trim() || null;
      const title = result.title.trim() || sample.title;
      const color = result.kind === 'rx_pet' ? '#d29922' : '#a371f7';
      const seriesId = editTarget.seriesId || sample.seriesId;
      const applyTo = seriesId ? 'series' : 'instance';

      await editTask(sample.id, {
        title,
        kind: result.kind,
        rxSubject: subject,
        color,
        applyTo,
      });

      // Sin seriesId: propaga metadata a todas las tomas del tratamiento.
      if (!seriesId && editTarget.tasks.length > 1) {
        for (const task of editTarget.tasks.slice(1)) {
          await editTask(task.id, {
            title,
            kind: result.kind,
            rxSubject: subject,
            color,
            applyTo: 'instance',
          });
        }
      }

      if (result.planDirty) {
        if (!seriesId) {
          showToast(t('rx_edit_owner_error'), 'error');
        } else {
          const remat = await rematerializeRx(sample.id, {
            title,
            rxPhases: result.rxPhases,
            rxSubject: subject,
            fromDayId: todayId,
            color,
          });
          showToast(
            t('rx_plan_saved').replace('{n}', String(remat?.created ?? 0)),
            'success'
          );
        }
      } else {
        showToast(t('rx_edit_owner_saved'), 'success');
      }

      // Cache remoto: feedback inmediato
      setRemoteRx(prev =>
        prev.map(t => {
          const sameSeries = seriesId && t.seriesId === seriesId;
          const sameSolo = editTarget.tasks.some(x => x.id === t.id);
          if (!sameSeries && !sameSolo) return t;
          return {
            ...t,
            title,
            kind: result.kind,
            color,
            rx: t.rx
              ? {
                  ...t.rx,
                  subject,
                  phases: result.planDirty ? result.rxPhases : t.rx.phases,
                }
              : {
                  subject,
                  amount: 1,
                  unit: 'pills' as const,
                  phaseIndex: 0,
                  planStartDayId: todayId,
                  phases: result.rxPhases,
                },
          };
        })
      );

      setEditTarget(null);
      await loadAllRx();
    } catch (err) {
      console.error('[recetario] treatment save failed', err);
      showToast(t('rx_edit_owner_error'), 'error');
    } finally {
      setSavingTreatment(false);
    }
  }

  return (
    <Layout title={t('nav_recetario')} showFab onFabClick={() => setFabOpen(true)}>
      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="mx-auto w-full max-w-6xl space-y-5">
          <header className="space-y-1">
            <div className="flex items-center gap-2">
              <Pill className="h-5 w-5 text-accent-pink" />
              <h1 className="text-lg font-semibold text-text-primary">{t('recetario_title')}</h1>
            </div>
            <p className="text-sm text-text-muted">{t('recetario_subtitle')}</p>
          </header>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniKpi label={t('recetario_kpi_subjects')} value={totals.subjects} />
            <MiniKpi label={t('recetario_kpi_treatments')} value={totals.activeTreatments} />
            <MiniKpi
              label={t('recetario_kpi_today')}
              value={`${totals.todayPending}/${totals.todayTotal}`}
            />
            <MiniKpi
              label={t('recetario_kpi_status')}
              value={loading ? '…' : t('recetario_kpi_ready')}
            />
          </div>

          <RxPhasesEndingPanel items={phasesEnding} />

          <div className="flex flex-wrap gap-1.5 rounded-xl border border-border bg-surface p-1">
            {(
              [
                { id: 'all' as const, icon: Users, label: t('recetario_filter_all') },
                { id: 'human' as const, icon: User, label: t('recetario_filter_people') },
                { id: 'pet' as const, icon: PawPrint, label: t('recetario_filter_pets') },
              ] as const
            ).map(item => {
              const Icon = item.icon;
              const active = filter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={cn(
                    'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors',
                    active
                      ? 'bg-accent-pink text-white shadow-sm'
                      : 'text-text-muted hover:bg-background hover:text-text-primary'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>

          <RxDayColumns
            tasks={allRx}
            filter={filter}
            centerDayId={centerDayId}
            onCenterDayChange={setCenterDayId}
            onToggleDose={task => void editTask(task.id, { completed: !task.completed })}
          />

          <RxTreatmentsPanel
            groups={groups}
            onToggleDose={task => void editTask(task.id, { completed: !task.completed })}
            onEditOwner={tr => setEditTarget(tr)}
            onDeleteTreatment={tr => requestTreatmentDelete(tr)}
            deletingTreatmentKey={deletingTreatmentKey}
            emptyLabel={loading ? t('recetario_loading') : t('recetario_empty')}
            showToday={false}
          />
        </div>
      </div>

      <RxOwnerEditDialog
        open={editTarget !== null}
        treatment={editTarget}
        saving={savingTreatment}
        onOpenChange={open => {
          if (!open && !savingTreatment) setEditTarget(null);
        }}
        onSave={result => void handleTreatmentSave(result)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={open => {
          if (!open && !deletingTreatmentKey) setDeleteTarget(null);
        }}
        title={t('rx_delete_title')}
        description={t('rx_delete_confirm')
          .replace('{title}', deleteTarget?.title.trim() || t('nav_recetario'))
          .replace('{n}', String(deleteTarget?.tasks.length ?? 0))}
        onConfirm={() => void confirmTreatmentDelete()}
        loading={Boolean(deletingTreatmentKey)}
        loadingLabel={t('rx_delete_deleting')}
      />

      <MobileSheet open={fabOpen} onOpenChange={setFabOpen}>
        <MobileSheetContent className="sm:max-w-xl sm:p-8 max-h-[92vh]">
          <MobileSheetHeader className="pr-8">
            <MobileSheetTitle className="text-lg">{t('recetario_new')}</MobileSheetTitle>
            <MobileSheetDescription>{t('recetario_new_hint')}</MobileSheetDescription>
          </MobileSheetHeader>
          <AddTaskForm
            projects={projects}
            startOpen
            variant="modal"
            startDayId={todayId}
            initialKind="rx_human"
            onCancel={() => setFabOpen(false)}
            onAdd={async payload => {
              setFabOpen(false);
              await addTask(payload);
              await loadAllRx();
            }}
          />
        </MobileSheetContent>
      </MobileSheet>
    </Layout>
  );
}

function MiniKpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-text-primary">{value}</p>
    </div>
  );
}
