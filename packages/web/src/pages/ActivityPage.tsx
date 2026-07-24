import { format } from 'date-fns';
import { History, Redo2, Undo2 } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { useTaskHistory } from '@core/hooks/useTaskHistory';
import { useT } from '@/hooks/useT';
import { cn } from '@/lib/utils';
import type { HistoryEntry } from '@core/history/types';

export function ActivityPage() {
  const { t, locale, shortDateFormat } = useT();
  const { past, future, canUndo, canRedo, undo, redo, jumpTo } = useTaskHistory();

  const pastNewestFirst = [...past].reverse();

  return (
    <Layout title={t('history_title')} showFab={false}>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 overflow-y-auto p-4">
        <p className="rounded-md border border-border bg-surface px-3 py-2 text-xs text-text-muted">
          {t('history_session_hint')}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!canUndo}
            onClick={() => void undo()}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium',
              canUndo
                ? 'bg-surface text-text-primary hover:border-accent-teal/40'
                : 'cursor-not-allowed opacity-40'
            )}
          >
            <Undo2 className="h-3.5 w-3.5" />
            {t('action_undo')}
          </button>
          <button
            type="button"
            disabled={!canRedo}
            onClick={() => void redo()}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium',
              canRedo
                ? 'bg-surface text-text-primary hover:border-accent-teal/40'
                : 'cursor-not-allowed opacity-40'
            )}
          >
            <Redo2 className="h-3.5 w-3.5" />
            {t('action_redo')}
          </button>
        </div>

        {past.length === 0 && future.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface text-text-muted">
              <History className="h-5 w-5" />
            </div>
            <p className="text-sm text-text-muted">{t('history_empty')}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {future.length > 0 && (
              <section>
                <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-text-muted">
                  {t('history_future')}
                </h2>
                <ul className="space-y-1.5">
                  {[...future].reverse().map(entry => (
                    <HistoryNode
                      key={entry.id}
                      entry={entry}
                      locale={locale}
                      shortDateFormat={shortDateFormat}
                      variant="future"
                      onJump={() => void jumpTo(entry.id)}
                      jumpLabel={t('history_jump')}
                    />
                  ))}
                </ul>
              </section>
            )}

            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-accent-teal/40" />
              <span className="text-[11px] font-semibold text-accent-teal">
                {t('history_you_are_here')}
              </span>
              <div className="h-px flex-1 bg-accent-teal/40" />
            </div>

            {past.length > 0 && (
              <section>
                <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-text-muted">
                  {t('history_past')}
                </h2>
                <ul className="space-y-1.5">
                  {pastNewestFirst.map(entry => (
                    <HistoryNode
                      key={entry.id}
                      entry={entry}
                      locale={locale}
                      shortDateFormat={shortDateFormat}
                      variant="past"
                      onJump={() => void jumpTo(entry.id)}
                      jumpLabel={t('history_jump')}
                    />
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

function HistoryNode({
  entry,
  locale,
  shortDateFormat,
  variant,
  onJump,
  jumpLabel,
}: {
  entry: HistoryEntry;
  locale: Awaited<ReturnType<typeof useT>>['locale'];
  shortDateFormat: string;
  variant: 'past' | 'future';
  onJump: () => void;
  jumpLabel: string;
}) {
  const time = format(entry.at, `EEE ${shortDateFormat} · HH:mm:ss`, { locale });

  return (
    <li>
      <button
        type="button"
        onClick={onJump}
        title={jumpLabel}
        className={cn(
          'flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
          variant === 'past'
            ? 'border-border bg-surface hover:border-accent-teal/40'
            : 'border-dashed border-border bg-background/50 text-text-muted hover:border-accent-teal/40 hover:text-text-primary'
        )}
      >
        <span
          className={cn(
            'mt-1.5 h-2 w-2 shrink-0 rounded-full',
            variant === 'past' ? 'bg-accent-teal' : 'bg-text-muted'
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-text-primary">{entry.label}</span>
          <span className="mt-0.5 block text-[11px] text-text-muted">{time}</span>
        </span>
        <span className="shrink-0 text-[10px] uppercase tracking-wide text-text-muted">
          {entry.kind}
        </span>
      </button>
    </li>
  );
}
