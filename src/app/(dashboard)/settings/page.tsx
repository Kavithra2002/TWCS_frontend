'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Save } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { LANGUAGES, type Lang, type Messages } from '@/lib/i18n';
import { AlertsPanel } from '@/components/alerts/AlertsPanel';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Loading } from '@/components/ui/States';
import { api, API_URL } from '@/lib/api';
import { canPlan, roleLabel } from '@/lib/auth';
import { SENSOR_META, sortSensors } from '@/lib/sensors';
import type { Sensor, TroughWithLive } from '@/types';

export default function SettingsPage() {
  const { user } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const { data: troughs, mutate } = useSWR<TroughWithLive[]>('/troughs');
  const [troughId, setTroughId] = useState('');

  useEffect(() => {
    if (!troughId && troughs?.length) setTroughId(troughs[0].id);
  }, [troughs, troughId]);

  const trough   = troughs?.find((t) => t.id === troughId);
  const editable = canPlan(user);

  return (
    <>
      <PageHeader title={t.settings.title} description={t.settings.description} />

      {/* ── Top section: thresholds + account/device ── */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card
          title={t.settings.thresholds}
          subtitle={editable ? t.settings.thresholdsEdit : t.settings.thresholdsLocked}
          className="xl:col-span-2"
          action={
            <select className="input w-auto py-1 text-xs" value={troughId} onChange={(e) => setTroughId(e.target.value)}>
              {troughs?.map((t) => (
                <option key={t.id} value={t.id}>{t.code}</option>
              ))}
            </select>
          }
          bodyClassName="p-0"
        >
          {!trough ? (
            <Loading />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>{t.settings.sensor}</th>
                    <th>{t.settings.unit}</th>
                    <th>{t.settings.min}</th>
                    <th>{t.settings.max}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {sortSensors(trough.sensors).map((s) => (
                    <ThresholdRow key={s.id} sensor={s} editable={editable} onSaved={() => mutate()} labels={t.settings} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card title={t.settings.language} subtitle={t.settings.languageHint}>
            <div className="grid gap-2">
              {LANGUAGES.map((language) => {
                const selected = lang === language.id;
                return (
                  <button
                    key={language.id}
                    type="button"
                    onClick={() => setLang(language.id as Lang)}
                    aria-pressed={selected}
                    className={
                      selected
                        ? 'rounded-xl border border-tea-500/50 bg-tea-500/15 px-3 py-2 text-left text-sm font-medium text-slate-100'
                        : 'rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-slate-300 transition hover:bg-white/10'
                    }
                  >
                    {language.native}
                  </button>
                );
              })}
            </div>
          </Card>
          <Card title={t.settings.account}>
            <dl className="space-y-2 text-sm">
              <Row label={t.settings.name}  value={user?.name} />
              <Row label={t.settings.email} value={user?.email} />
              <Row label={t.settings.role}  value={user ? roleLabel(user.role) : undefined} />
            </dl>
          </Card>
          <Card title={t.settings.device} subtitle={t.settings.deviceHint}>
            <p className="mb-2 text-xs text-slate-400">
              <code className="text-tea-300">POST {API_URL}/telemetry/readings</code> {t.settings.deviceLead}{' '}
              <code className="text-tea-300">x-device-key</code>:
            </p>
            <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-300">
{`{
  "readings": [
    { "sensorId": "<sensor id>", "value": 28.4 },
    { "sensorId": "<sensor id>", "value": 71.2,
      "recordedAt": "2026-01-01T06:00:00Z" }
  ]
}`}
            </pre>
          </Card>
        </div>
      </div>

      {/* ── Alerts section below ── */}
      <div className="mt-6 space-y-1">
        <h2 className="text-base font-semibold text-slate-100">{t.settings.alerts}</h2>
        <p className="text-sm text-slate-500">{t.settings.alertsHint}</p>
      </div>
      <div className="mt-3">
        <AlertsPanel />
      </div>
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-200">{value ?? '—'}</dd>
    </div>
  );
}

function ThresholdRow({
  sensor,
  editable,
  onSaved,
  labels,
}: {
  sensor: Sensor;
  editable: boolean;
  onSaved: () => void;
  labels: Messages['settings'];
}) {
  const meta = SENSOR_META[sensor.type];
  const Icon = meta.icon;
  const [min, setMin] = useState(sensor.minThreshold?.toString() ?? '');
  const [max, setMax] = useState(sensor.maxThreshold?.toString() ?? '');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | string>('idle');

  useEffect(() => {
    setMin(sensor.minThreshold?.toString() ?? '');
    setMax(sensor.maxThreshold?.toString() ?? '');
  }, [sensor.minThreshold, sensor.maxThreshold]);

  const dirty = min !== (sensor.minThreshold?.toString() ?? '') || max !== (sensor.maxThreshold?.toString() ?? '');

  const save = async () => {
    setState('saving');
    try {
      await api(`/sensors/${sensor.id}`, {
        method: 'PATCH',
        json: { minThreshold: min === '' ? null : Number(min), maxThreshold: max === '' ? null : Number(max) },
      });
      setState('saved');
      onSaved();
    } catch (e) {
      setState(e instanceof Error ? e.message : labels.saveFailed);
    }
  };

  return (
    <tr>
      <td>
        <span className="flex items-center gap-2 text-slate-200">
          <Icon className="h-4 w-4" style={{ color: meta.color }} />
          {sensor.label}
        </span>
      </td>
      <td className="text-slate-400">{sensor.unit}</td>
      <td>
        <input type="number" step="any" className="input w-28 py-1" value={min} disabled={!editable} onChange={(e) => setMin(e.target.value)} />
      </td>
      <td>
        <input type="number" step="any" className="input w-28 py-1" value={max} disabled={!editable} onChange={(e) => setMax(e.target.value)} />
      </td>
      <td className="whitespace-nowrap text-right">
        {editable && (
          <Button size="sm" variant={dirty ? 'primary' : 'secondary'} disabled={!dirty || state === 'saving'} onClick={save}>
            <Save className="h-3 w-3" /> {labels.save}
          </Button>
        )}
        {state === 'saved' && !dirty && <span className="ml-2 text-xs text-emerald-400">{labels.saved}</span>}
        {state !== 'idle' && state !== 'saving' && state !== 'saved' && <span className="ml-2 text-xs text-red-400">{state}</span>}
      </td>
    </tr>
  );
}
