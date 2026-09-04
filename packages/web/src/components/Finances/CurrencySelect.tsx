import { useMemo, useState } from 'react';
import { Check, ChevronDown, Star } from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';
import { useT } from '@/hooks/useT';
import { cn } from '@/lib/utils';
import {
  groupCurrenciesForPicker,
  isSupportedCurrency,
  normalizeFavoriteCurrencies,
  resolveDefaultCurrency,
  toggleFavoriteCurrency,
  type CurrencyOption,
} from '@core/lib/currencies';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function useCurrencyPrefs() {
  const { settings, updateSettings } = useSettings();
  const preferred = resolveDefaultCurrency({
    stored: settings.preferredCurrency,
    timezone: settings.timezone,
    locale: settings.language === 'en' ? 'en-US' : 'es-CL',
  });
  const favorites = useMemo(
    () => normalizeFavoriteCurrencies(settings.favoriteCurrencies),
    [settings.favoriteCurrencies]
  );
  const groups = useMemo(
    () => groupCurrenciesForPicker({ preferred, favorites }),
    [preferred, favorites]
  );
  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);

  function toggleFavorite(code: string) {
    void updateSettings({
      favoriteCurrencies: toggleFavoriteCurrency(favorites, code),
    });
  }

  return { preferred, favorites, groups, favoriteSet, toggleFavorite };
}

function StarButton({
  code,
  starred,
  onToggle,
}: {
  code: string;
  starred: boolean;
  onToggle: (code: string) => void;
}) {
  const { t } = useT();
  return (
    <button
      type="button"
      aria-label={
        starred ? t('fin_currency_unstar') : t('fin_currency_star')
      }
      aria-pressed={starred}
      className={cn(
        'ml-auto inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
        'text-text-muted hover:bg-background hover:text-amber-400',
        starred && 'text-amber-400'
      )}
      onPointerDown={event => event.preventDefault()}
      onClick={event => {
        event.preventDefault();
        event.stopPropagation();
        onToggle(code);
      }}
    >
      <Star className={cn('h-3.5 w-3.5', starred && 'fill-amber-400')} />
    </button>
  );
}

function CurrencyRow({
  option,
  selected,
  starred,
  onSelect,
  onToggleFavorite,
}: {
  option: CurrencyOption;
  selected: boolean;
  starred: boolean;
  onSelect: (code: string) => void;
  onToggleFavorite: (code: string) => void;
}) {
  return (
    <DropdownMenuItem
      className="flex cursor-pointer items-center gap-2 py-1.5 pr-1"
      onSelect={() => onSelect(option.code)}
    >
      <Check
        className={cn(
          'h-3.5 w-3.5 shrink-0 text-accent-teal',
          selected ? 'opacity-100' : 'opacity-0'
        )}
      />
      <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
        {option.label}
      </span>
      <StarButton
        code={option.code}
        starred={starred}
        onToggle={onToggleFavorite}
      />
    </DropdownMenuItem>
  );
}

export function CurrencySelect({
  value,
  onChange,
  className,
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (code: string) => void;
  className?: string;
  'aria-label'?: string;
}) {
  const { t } = useT();
  const { groups, favoriteSet, toggleFavorite } = useCurrencyPrefs();
  const [showOthers, setShowOthers] = useState(groups.favorites.length === 0);
  const selected = isSupportedCurrency(value) ? value.toUpperCase() : groups.primary.code;

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel ?? t('fin_field_currency')}
          className={cn(
            'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-2 text-left text-sm text-text-primary',
            'hover:border-accent-teal/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal/20',
            className
          )}
        >
          <span className="truncate">{selected}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={4}
        className="z-[80] w-[min(18rem,calc(100vw-2rem))] overflow-hidden p-1"
      >
        <div className="max-h-72 overflow-y-auto">
          <DropdownMenuLabel className="py-1 text-[10px] uppercase tracking-wide text-text-muted">
            {t('fin_currency_primary')}
          </DropdownMenuLabel>
          <CurrencyRow
            option={groups.primary}
            selected={selected === groups.primary.code}
            starred={favoriteSet.has(groups.primary.code)}
            onSelect={onChange}
            onToggleFavorite={toggleFavorite}
          />
          {groups.favorites.length > 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="py-1 text-[10px] uppercase tracking-wide text-text-muted">
                {t('fin_currency_favorites')}
              </DropdownMenuLabel>
              {groups.favorites.map(option => (
                <CurrencyRow
                  key={option.code}
                  option={option}
                  selected={selected === option.code}
                  starred
                  onSelect={onChange}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </>
          ) : null}
          {groups.others.length > 0 ? (
            <>
              <DropdownMenuSeparator />
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted hover:bg-accent"
                onPointerDown={event => event.preventDefault()}
                onClick={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  setShowOthers(open => !open);
                }}
              >
                <span>{t('fin_currency_other')}</span>
                <ChevronDown
                  className={cn(
                    'h-3.5 w-3.5 transition-transform',
                    showOthers && 'rotate-180'
                  )}
                />
              </button>
              {showOthers
                ? groups.others.map(option => (
                    <CurrencyRow
                      key={option.code}
                      option={option}
                      selected={selected === option.code}
                      starred={favoriteSet.has(option.code)}
                      onSelect={onChange}
                      onToggleFavorite={toggleFavorite}
                    />
                  ))
                : null}
            </>
          ) : null}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CurrencyFavoriteList({ className }: { className?: string }) {
  const { t } = useT();
  const { groups, favoriteSet, toggleFavorite } = useCurrencyPrefs();
  const rows: Array<{ option: CurrencyOption; section: 'primary' | 'favorites' | 'others' }> = [
    { option: groups.primary, section: 'primary' },
    ...groups.favorites.map(option => ({ option, section: 'favorites' as const })),
    ...groups.others.map(option => ({ option, section: 'others' as const })),
  ];

  return (
    <div className={cn('max-h-64 overflow-y-auto rounded-lg border border-border', className)}>
      {rows.map(({ option, section }, index) => {
        const prev = rows[index - 1];
        const showHeader = !prev || prev.section !== section;
        const starred =
          section === 'favorites' || favoriteSet.has(option.code);
        return (
          <div key={option.code}>
            {showHeader ? (
              <p className="bg-background/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                {section === 'primary'
                  ? t('fin_currency_primary')
                  : section === 'favorites'
                    ? t('fin_currency_favorites')
                    : t('fin_currency_other')}
              </p>
            ) : null}
            <div className="flex items-center gap-2 px-2 py-0.5">
              <span className="min-w-0 flex-1 truncate px-1 text-sm text-text-primary">
                {option.label}
              </span>
              <StarButton
                code={option.code}
                starred={starred}
                onToggle={toggleFavorite}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
