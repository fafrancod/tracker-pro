import { HeartPulse } from 'lucide-react';
import { useT } from '@/hooks/useT';
import {
  buildHealthSnapshot,
  detectAntExpenses,
  evaluateFinancialHealth,
  generateHealthRecommendations,
  getHealthLabel,
  FINANCE_CATEGORIES,
  type FinanceCategory,
  type FinanceCredit,
  type FinanceMovement,
} from '@core/lib/finance';

function money(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'EUR',
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${n.toFixed(0)} ${currency}`;
  }
}

export function HealthPanel({
  movements,
  credits,
  monthId,
  reportingCurrency,
}: {
  movements: FinanceMovement[];
  credits: FinanceCredit[];
  monthId: string;
  reportingCurrency: string;
}) {
  const { t } = useT();
  const snapshot = buildHealthSnapshot({
    movements,
    credits,
    monthId,
    reportingCurrency,
  });
  const ants = detectAntExpenses(movements, monthId);
  const recs = generateHealthRecommendations(snapshot, ants);
  const score = evaluateFinancialHealth(snapshot);
  const label = getHealthLabel(score);

  function labelOf(cat: FinanceCategory): string {
    return t(`fin_cat_${cat}` as 'fin_cat_other');
  }

  function recTitle(id: (typeof recs)[number]['id']): string {
    if (id === 'rec_deficit') return t('fin_health_rec_deficit');
    if (id === 'rec_high_dti') return t('fin_health_rec_dti');
    if (id === 'rec_ants') return t('fin_health_rec_ants');
    return t('fin_health_rec_savings');
  }

  function recBody(id: (typeof recs)[number]['id']): string {
    if (id === 'rec_deficit') return t('fin_health_rec_deficit_hint');
    if (id === 'rec_high_dti') return t('fin_health_rec_dti_hint');
    if (id === 'rec_ants') return t('fin_health_rec_ants_hint');
    return t('fin_health_rec_savings_hint');
  }

  function healthLabel(): string {
    if (label === 'critical') return t('fin_health_critical');
    if (label === 'at_risk') return t('fin_health_at_risk');
    if (label === 'stable') return t('fin_health_stable');
    if (label === 'healthy') return t('fin_health_healthy');
    return t('fin_health_excellent');
  }

  const cats = FINANCE_CATEGORIES.filter(c => snapshot.byCategory[c] > 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-3">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <HeartPulse className="h-3.5 w-3.5" />
            {t('fin_health_score')}
          </div>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-text-primary">
            {score}
          </p>
          <p className="text-[11px] text-text-muted">{healthLabel()}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-3">
          <p className="text-xs text-text-muted">{t('fin_health_savings')}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-text-primary">
            {snapshot.savingsRate.toFixed(0)}%
          </p>
          <p className="text-[11px] text-text-muted">
            {money(snapshot.balance, snapshot.currency)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-3">
          <p className="text-xs text-text-muted">{t('fin_health_dti')}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-text-primary">
            {snapshot.debtToIncomeRatio.toFixed(0)}%
          </p>
          <p className="text-[11px] text-text-muted">
            {money(snapshot.monthlyDebt, snapshot.currency)} / {t('fin_this_month')}
          </p>
        </div>
      </div>

      {recs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <HeartPulse className="h-5 w-5 text-text-muted" />
          <p className="text-sm font-medium text-text-primary">
            {t('fin_health_empty')}
          </p>
          <p className="max-w-sm text-xs text-text-muted">
            {t('fin_health_empty_hint')}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {recs.map(rec => (
            <li
              key={rec.id}
              className={
                rec.severity === 'strong'
                  ? 'rounded-xl border border-accent-red/40 bg-accent-red/5 p-3'
                  : 'rounded-xl border border-border bg-surface p-3'
              }
            >
              <p className="text-sm font-semibold text-text-primary">
                {recTitle(rec.id)}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">{recBody(rec.id)}</p>
            </li>
          ))}
        </ul>
      )}

      {cats.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-3">
          <p className="mb-2 text-xs font-medium text-text-muted">
            {t('fin_health_by_category')}
          </p>
          <ul className="flex flex-col gap-1">
            {cats.map(cat => (
              <li
                key={cat}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-text-muted">{labelOf(cat)}</span>
                <span className="tabular-nums text-text-primary">
                  {money(snapshot.byCategory[cat], snapshot.currency)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
