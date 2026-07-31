import { useEffect, useState } from 'react';
import { PawPrint, User, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DecimalInput } from '@/components/ui/decimal-input';
import { TimeInput } from '@/components/ui/time-input';
import { useT } from '@/hooks/useT';
import { cn } from '@/lib/utils';
import {
  expandIntervalTimes,
  resolvePhaseScheduleMode,
  validateRxPhases,
  type RxTreatmentProgress,
} from '@core/lib/rx';
import type { DoseUnit, RxPhase, RxScheduleMode } from '@core/types';

const DEFAULT_RX_PHASE: RxPhase = {
  amount: 1,
  unit: 'pills',
  days: 7,
  scheduleMode: 'fixed',
  times: ['08:00'],
  everyHours: null,
  startTime: null,
};

function clonePhases(phases: RxPhase[] | undefined | null): RxPhase[] {
  if (!phases?.length) return [{ ...DEFAULT_RX_PHASE, times: ['08:00'] }];
  return phases.map(p => ({
    amount: p.amount,
    unit: p.unit,
    days: p.days,
    scheduleMode: resolvePhaseScheduleMode(p),
    times: [...(p.times ?? [])],
    everyHours: p.everyHours ?? null,
    startTime: p.startTime ?? null,
  }));
}

export function phasesEqual(a: RxPhase[], b: RxPhase[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export interface RxOwnerEditResult {
  kind: 'rx_human' | 'rx_pet';
  subject: string;
  title: string;
  rxPhases: RxPhase[];
  /** true si el plan de fases/horarios cambió (hay que rematerializar). */
  planDirty: boolean;
}

interface RxOwnerEditDialogProps {
  open: boolean;
  treatment: RxTreatmentProgress | null;
  saving?: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (result: RxOwnerEditResult) => void;
}

export function RxOwnerEditDialog({
  open,
  treatment,
  saving,
  onOpenChange,
  onSave,
}: RxOwnerEditDialogProps) {
  const { t } = useT();
  const [kind, setKind] = useState<'rx_human' | 'rx_pet'>('rx_human');
  const [subject, setSubject] = useState('');
  const [title, setTitle] = useState('');
  const [rxPhases, setRxPhases] = useState<RxPhase[]>([
    { ...DEFAULT_RX_PHASE, times: ['08:00'] },
  ]);
  const [phaseError, setPhaseError] = useState<string | null>(null);

  useEffect(() => {
    if (!treatment || !open) return;
    setKind(treatment.kind);
    setSubject(treatment.subject ?? '');
    setTitle(treatment.title);
    setRxPhases(clonePhases(treatment.phases));
    setPhaseError(null);
  }, [treatment, open]);

  function updatePhase(index: number, patch: Partial<RxPhase>) {
    setRxPhases(prev => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
    setPhaseError(null);
  }

  function addPhase() {
    setRxPhases(prev => [
      ...prev,
      {
        ...DEFAULT_RX_PHASE,
        times: ['08:00'],
      },
    ]);
  }

  function removePhase(index: number) {
    setRxPhases(prev => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  function setPhaseScheduleMode(index: number, mode: RxScheduleMode) {
    const phase = rxPhases[index];
    if (!phase) return;
    if (mode === 'interval') {
      const everyHours =
        phase.everyHours && phase.everyHours >= 1 ? phase.everyHours : 8;
      const startTime = phase.startTime || phase.times[0] || '08:00';
      updatePhase(index, {
        scheduleMode: 'interval',
        everyHours,
        startTime,
        times: expandIntervalTimes(startTime, everyHours),
      });
    } else {
      updatePhase(index, {
        scheduleMode: 'fixed',
        everyHours: null,
        startTime: null,
        times: phase.times.length ? phase.times : ['08:00'],
      });
    }
  }

  function setPhaseTime(phaseIndex: number, timeIndex: number, value: string) {
    setRxPhases(prev =>
      prev.map((p, i) => {
        if (i !== phaseIndex) return p;
        const times = [...p.times];
        times[timeIndex] = value;
        return { ...p, times, scheduleMode: 'fixed' as const };
      })
    );
    setPhaseError(null);
  }

  function addTimeToPhase(phaseIndex: number) {
    setRxPhases(prev =>
      prev.map((p, i) => {
        if (i !== phaseIndex) return p;
        if (p.times.length >= 12) return p;
        return {
          ...p,
          scheduleMode: 'fixed' as const,
          times: [...p.times, '20:00'],
        };
      })
    );
  }

  function removePhaseTime(phaseIndex: number, timeIndex: number) {
    setRxPhases(prev =>
      prev.map((p, i) => {
        if (i !== phaseIndex) return p;
        if (p.times.length <= 1) return p;
        return {
          ...p,
          times: p.times.filter((_, ti) => ti !== timeIndex),
        };
      })
    );
  }

  function handleSave() {
    if (!treatment) return;
    const err = validateRxPhases(rxPhases);
    if (err) {
      setPhaseError(err);
      return;
    }
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setPhaseError(t('rx_medicine_placeholder'));
      return;
    }
    onSave({
      kind,
      subject: subject.trim(),
      title: trimmedTitle,
      rxPhases,
      planDirty: !phasesEqual(rxPhases, clonePhases(treatment.phases)),
    });
  }

  if (!treatment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
          <DialogTitle>{t('rx_edit_owner_title')}</DialogTitle>
          <DialogDescription>
            {t('rx_edit_owner_desc').replace('{title}', treatment.title)}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {/* Medicamento */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">
              {t('rx_medicine_name')}
            </label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={t('rx_medicine_placeholder')}
              maxLength={200}
              autoFocus
            />
          </div>

          {/* Tipo */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-text-muted">
              {t('rx_edit_owner_kind')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setKind('rx_human')}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-colors',
                  kind === 'rx_human'
                    ? 'border-accent-teal bg-accent-teal/15 text-accent-teal'
                    : 'border-border text-text-muted hover:bg-background'
                )}
              >
                <User className="h-3.5 w-3.5" />
                {t('task_kind_rx_human')}
              </button>
              <button
                type="button"
                onClick={() => setKind('rx_pet')}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-colors',
                  kind === 'rx_pet'
                    ? 'border-accent-pink bg-accent-pink/15 text-accent-pink'
                    : 'border-border text-text-muted hover:bg-background'
                )}
              >
                <PawPrint className="h-3.5 w-3.5" />
                {t('task_kind_rx_pet')}
              </button>
            </div>
          </div>

          {/* Dueño / paciente */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">
              {kind === 'rx_pet' ? t('rx_pet_name') : t('rx_patient_name')}
            </label>
            <Input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder={
                kind === 'rx_pet' ? t('rx_pet_placeholder') : t('rx_patient_placeholder')
              }
              maxLength={120}
            />
            <p className="mt-1 text-[11px] text-text-muted">{t('rx_edit_owner_hint')}</p>
          </div>

          {/* Fases e ingesta */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-text-muted">{t('rx_phases_hint')}</p>
            </div>
            <p className="text-[11px] text-text-muted">{t('rx_apply_plan_hint')}</p>

            {rxPhases.map((phase, pi) => (
              <div
                key={pi}
                className="space-y-2 rounded-lg border border-border bg-background p-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-text-primary">
                    {t('rx_phase')} {pi + 1}
                  </span>
                  {rxPhases.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePhase(pi)}
                      className="text-[11px] text-accent-red hover:underline"
                    >
                      {t('action_delete')}
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex flex-col gap-0.5 text-[10px] text-text-muted">
                    <span>{t('rx_amount')}</span>
                    <DecimalInput
                      value={phase.amount}
                      min={0.01}
                      onChange={amount => updatePhase(pi, { amount })}
                      className="w-20 rounded border border-border bg-surface px-2 py-1.5 text-xs text-text-primary"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5 text-[10px] text-text-muted">
                    <span>{t('rx_unit')}</span>
                    <select
                      value={phase.unit}
                      onChange={e =>
                        updatePhase(pi, { unit: e.target.value as DoseUnit })
                      }
                      className="rounded border border-border bg-surface px-2 py-1.5 text-xs text-text-primary"
                    >
                      <option value="pills">{t('rx_unit_pills')}</option>
                      <option value="ml">{t('rx_unit_ml')}</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-0.5 text-[10px] text-text-muted">
                    <span>{t('rx_days')}</span>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={phase.days}
                      onChange={e =>
                        updatePhase(pi, {
                          days: Math.max(
                            1,
                            Math.min(365, Number(e.target.value) || 1)
                          ),
                        })
                      }
                      className="w-16 rounded border border-border bg-surface px-2 py-1.5 text-xs text-text-primary"
                    />
                  </label>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-medium uppercase text-text-muted">
                    {t('rx_schedule_mode')}
                  </span>
                  <div className="inline-flex rounded-lg border border-border bg-surface p-0.5">
                    {(['fixed', 'interval'] as RxScheduleMode[]).map(mode => {
                      const active = resolvePhaseScheduleMode(phase) === mode;
                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setPhaseScheduleMode(pi, mode)}
                          className={cn(
                            'rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                            active
                              ? 'bg-accent-teal/15 text-accent-teal'
                              : 'text-text-muted hover:text-text-primary'
                          )}
                        >
                          {mode === 'fixed'
                            ? t('rx_schedule_fixed')
                            : t('rx_schedule_interval')}
                        </button>
                      );
                    })}
                  </div>

                  {resolvePhaseScheduleMode(phase) === 'interval' ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-end gap-2">
                        <label className="flex flex-col gap-0.5 text-[10px] text-text-muted">
                          <span>{t('rx_every_hours')}</span>
                          <input
                            type="number"
                            min={1}
                            max={24}
                            value={phase.everyHours ?? 8}
                            onChange={e => {
                              const everyHours = Math.max(
                                1,
                                Math.min(24, Math.floor(Number(e.target.value) || 8))
                              );
                              const startTime = phase.startTime || '08:00';
                              updatePhase(pi, {
                                scheduleMode: 'interval',
                                everyHours,
                                startTime,
                                times: expandIntervalTimes(startTime, everyHours),
                              });
                            }}
                            className="w-20 rounded border border-border bg-surface px-2 py-1.5 text-xs text-text-primary"
                          />
                        </label>
                        <label className="flex flex-col gap-0.5 text-[10px] text-text-muted">
                          <span>{t('rx_interval_start')}</span>
                          <TimeInput
                            value={phase.startTime || '08:00'}
                            onChange={v => {
                              const startTime = v || '08:00';
                              const everyHours =
                                phase.everyHours && phase.everyHours >= 1
                                  ? phase.everyHours
                                  : 8;
                              updatePhase(pi, {
                                scheduleMode: 'interval',
                                startTime,
                                everyHours,
                                times: expandIntervalTimes(startTime, everyHours),
                              });
                            }}
                            showNow={false}
                          />
                        </label>
                      </div>
                      <p className="text-[10px] text-text-muted">
                        {t('rx_interval_preview')}:{' '}
                        <span className="font-medium text-text-primary">
                          {(phase.times ?? []).join(' · ') || '—'}
                        </span>
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <span className="text-[10px] font-medium uppercase text-text-muted">
                        {t('rx_times')}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {phase.times.map((tm, ti) => (
                          <div key={ti} className="flex items-center gap-0.5">
                            <TimeInput
                              value={tm}
                              onChange={v => setPhaseTime(pi, ti, v || '08:00')}
                              showNow={false}
                              clearLabel={t('action_delete')}
                            />
                            {phase.times.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removePhaseTime(pi, ti)}
                                className="text-text-muted hover:text-accent-red"
                                aria-label={t('action_delete')}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addTimeToPhase(pi)}
                          className="rounded border border-dashed border-border px-2 py-1 text-[10px] text-text-muted hover:text-text-primary"
                        >
                          + {t('rx_add_time')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addPhase}
              className="w-full rounded-lg border border-dashed border-border py-2 text-[11px] font-medium text-text-muted hover:border-accent-teal/40 hover:text-accent-teal"
            >
              + {t('rx_phase')}
            </button>

            {phaseError && (
              <p className="text-[11px] text-accent-red" role="alert">
                {phaseError}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-border px-6 py-3 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            {t('action_cancel')}
          </Button>
          <Button type="button" size="sm" disabled={saving} onClick={handleSave}>
            {saving ? t('life_goal_saving') : t('action_save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
