import { SimpleSelect } from '@/components/ui/select';
import { useT } from '@/hooks/useT';
import {
  formatTimezoneLabel,
  getDeviceTimezone,
  listTimezoneOptions,
} from '@/lib/timezones';

interface TimezoneFieldProps {
  value: string;
  onChange: (timezone: string) => void;
}

export function TimezoneField({ value, onChange }: TimezoneFieldProps) {
  const { t } = useT();
  const current = value || getDeviceTimezone();
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-text-primary">
        {t('settings_timezone')}
      </label>
      <p className="mb-2 text-[11px] text-text-muted">{t('settings_timezone_desc')}</p>
      <SimpleSelect
        aria-label={t('settings_timezone')}
        value={current}
        onChange={onChange}
        className="w-full max-w-lg text-sm"
        options={listTimezoneOptions().map(tz => ({
          value: tz,
          label: formatTimezoneLabel(tz),
        }))}
      />
      <button
        type="button"
        className="mt-2 text-[11px] text-accent-teal hover:underline"
        onClick={() => onChange(getDeviceTimezone())}
      >
        {t('settings_notify_timezone_device')}
      </button>
    </div>
  );
}
