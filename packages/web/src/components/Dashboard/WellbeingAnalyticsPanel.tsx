import { useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Battery, Moon, Sparkles, ArrowRight } from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';
import { useT } from '@/hooks/useT';
import {
  ENERGY_COLORS,
  MOOD_COLORS,
  computeWeekWellbeing,
  formatDayId,
  pickEncouragementMessages,
  type EncouragementTone,
} from '@/lib/dailyJournal';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { MoodLevel } from '@core/types';

function toneClasses(tone: EncouragementTone): string {
  switch (tone) {
    case 'celebrate':
      return 'border-accent-teal/40 bg-accent-teal/10 text-text-primary';
    case 'support':
      return 'border-accent-pink/40 bg-accent-pink/10 text-text-primary';
    case 'rest':
      return 'border-amber-500/40 bg-amber-500/10 text-text-primary';
    case 'nudge':
      return 'border-border bg-background text-text-muted';
    default:
      return 'border-border bg-surface text-text-primary';
  }
}

function BarRow({
  label,
  value,
  max,
  color,
  suffix,
}: {
  label: string;
  value: number | null;
  max: number;
  color: string;
  suffix?: string;
}) {
  const pct = value === null ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <span className="w-6 shrink-0 text-[10px] tabular-nums text-text-muted">{label}</span>
      <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-background">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: value === null ? '0%' : `${Math.max(pct, value > 0 ? 8 : 0)}%`,
            backgroundColor: value === null ? 'transparent' : color,
          }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-[10px] tabular-nums text-text-muted">
        {value === null ? '—' : `${value.toFixed(1)}${suffix ?? ''}`}
      </span>
    </div>
  );
}

/**
 * Panel de analytics de bienestar en Resumen: ánimo, energía, sueño + mensajes.
 */
export function WellbeingAnalyticsPanel() {
  const { settings } = useSettings();
  const { t } = useT();
  const navigate = useNavigate();
  const todayId = formatDayId(new Date());

  const summary = useMemo(
    () => computeWeekWellbeing(settings.dailyJournal, todayId, 7),
    [settings.dailyJournal, todayId]
  );

  const messages = useMemo(() => pickEncouragementMessages(summary), [summary]);

  const hasData =
    summary.daysWithMood > 0 || summary.daysWithEnergy > 0 || summary.daysWithSleep > 0;

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-accent-teal" />
          <h2 className="text-sm font-semibold text-text-primary">{t('wellbeing_panel_title')}</h2>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-[11px]"
          onClick={() => navigate('/reflections')}
        >
          {t('wellbeing_open_journal')}
          <ArrowRight className="h-3 w-3" />
        </Button>
      </div>
      <p className="mb-4 text-[11px] text-text-muted">{t('wellbeing_panel_subtitle')}</p>

      {/* KPIs semanales */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        <KpiMini
          icon={<Sparkles className="h-3.5 w-3.5" />}
          label={t('wellbeing_kpi_mood')}
          value={
            summary.avgMood === null ? '—' : `${summary.avgMood.toFixed(1)}/5`
          }
          hint={`${summary.daysWithMood}/7 ${t('wellbeing_days_short')}`}
        />
        <KpiMini
          icon={<Battery className="h-3.5 w-3.5" />}
          label={t('wellbeing_kpi_energy')}
          value={
            summary.avgEnergy === null ? '—' : `${summary.avgEnergy.toFixed(1)}/5`
          }
          hint={`${summary.daysWithEnergy}/7 ${t('wellbeing_days_short')}`}
        />
        <KpiMini
          icon={<Moon className="h-3.5 w-3.5" />}
          label={t('wellbeing_kpi_sleep')}
          value={
            summary.avgSleep === null ? '—' : `${summary.avgSleep.toFixed(1)} h`
          }
          hint={`${summary.daysWithSleep}/7 ${t('wellbeing_days_short')}`}
        />
      </div>

      {/* Barras por día */}
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5 rounded-lg border border-border bg-background p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            {t('wellbeing_chart_mood')}
          </p>
          {summary.days.map(d => (
            <BarRow
              key={`m-${d.dayId}`}
              label={d.dayId.slice(8)}
              value={d.avgMood}
              max={5}
              color={
                d.avgMood === null
                  ? MOOD_COLORS[3]
                  : MOOD_COLORS[Math.min(5, Math.max(1, Math.round(d.avgMood))) as MoodLevel]
              }
            />
          ))}
        </div>
        <div className="space-y-1.5 rounded-lg border border-border bg-background p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            {t('wellbeing_chart_energy')}
          </p>
          {summary.days.map(d => (
            <BarRow
              key={`e-${d.dayId}`}
              label={d.dayId.slice(8)}
              value={d.avgEnergy}
              max={5}
              color={
                d.avgEnergy === null
                  ? ENERGY_COLORS[3]
                  : ENERGY_COLORS[Math.min(5, Math.max(1, Math.round(d.avgEnergy))) as MoodLevel]
              }
            />
          ))}
        </div>
        <div className="space-y-1.5 rounded-lg border border-border bg-background p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            {t('wellbeing_chart_sleep')}
          </p>
          {summary.days.map(d => (
            <BarRow
              key={`s-${d.dayId}`}
              label={d.dayId.slice(8)}
              value={d.sleepHours}
              max={10}
              color="#58a6ff"
              suffix="h"
            />
          ))}
        </div>
      </div>

      {/* Mensajes de ánimo */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
          {t('wellbeing_messages_title')}
        </p>
        {messages.map(msg => (
          <div
            key={msg.key}
            className={cn('rounded-lg border px-3 py-2 text-xs leading-relaxed', toneClasses(msg.tone))}
          >
            {t(msg.key)}
          </div>
        ))}
      </div>

      {!hasData && (
        <Button
          type="button"
          size="sm"
          className="mt-3 w-full gap-1.5 sm:w-auto"
          onClick={() => navigate('/reflections')}
        >
          {t('wellbeing_start_logging')}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      )}
    </section>
  );
}

function KpiMini({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background px-2.5 py-2">
      <div className="mb-0.5 flex items-center gap-1 text-text-muted">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-sm font-semibold tabular-nums text-text-primary">{value}</p>
      <p className="text-[10px] text-text-muted">{hint}</p>
    </div>
  );
}
