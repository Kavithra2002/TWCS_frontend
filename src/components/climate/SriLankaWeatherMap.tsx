'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import useSWR from 'swr';
import { GoogleMap, InfoWindowF, MarkerF, useJsApiLoader } from '@react-google-maps/api';
import { CloudRain, Droplets, KeyRound, Thermometer, Wind } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, Loading } from '@/components/ui/States';
import { fmtNumber } from '@/lib/format';
import {
  fetchSriLankaWeather,
  SL_MAP_CENTER,
  SL_MAP_ZOOM,
  tempMarkerColor,
  type SlPlaceWeather,
} from '@/lib/sri-lanka-weather';

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

const MAP_CONTAINER: CSSProperties = {
  width: '100%',
  height: '100%',
  borderRadius: '0.75rem',
};

const MAP_OPTIONS = {
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: true,
  gestureHandling: 'greedy' as const,
  restriction: {
    latLngBounds: { north: 10.2, south: 5.5, west: 79.2, east: 82.2 },
    strictBounds: false,
  },
};

function DetailPanel({ row }: { row: SlPlaceWeather }) {
  return (
    <div className="rounded-xl bg-white/55 p-3 ring-1 ring-inset ring-white/70">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          {row.iconUri && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.iconUri} alt="" className="h-8 w-8" width={32} height={32} />
          )}
          <div>
            <p className="text-sm font-semibold text-[#111827]">{row.place.name}</p>
            <p className="text-[11px] text-[#111827]/50">
              {row.place.region}
              {row.place.note ? ` · ${row.place.note}` : ''}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-medium text-[#111827]/70 ring-1 ring-inset ring-black/5">
          {row.condition ?? '—'}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric icon={Thermometer} label="Temp" value={fmtNumber(row.temperatureC)} unit="°C" color="#f97316" />
        <Metric icon={Droplets} label="Humidity" value={fmtNumber(row.humidityPct, 0)} unit="%RH" color="#38bdf8" />
        <Metric icon={Wind} label="Wind" value={fmtNumber(row.windKmh, 0)} unit="km/h" color="#a78bfa" />
        <Metric icon={CloudRain} label="Rain" value={fmtNumber(row.precipitationMm, 1)} unit="mm" color="#22c55e" />
      </div>
      {row.feelsLikeC != null && (
        <p className="mt-2 text-[10px] text-[#111827]/45">Feels like {fmtNumber(row.feelsLikeC)} °C</p>
      )}
      {row.error && <p className="mt-2 text-[10px] text-red-600">{row.error}</p>}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  unit,
  color,
}: {
  icon: typeof Thermometer;
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <div className="rounded-lg bg-white/50 px-2 py-1.5 ring-1 ring-inset ring-white/60">
      <div className="flex items-center gap-1 text-[10px] text-[#111827]/50">
        <Icon className="h-3 w-3" style={{ color }} aria-hidden />
        {label}
      </div>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-[#111827]">
        {value}
        <span className="ml-0.5 text-[10px] font-normal text-[#111827]/45">{unit}</span>
      </p>
    </div>
  );
}

function MissingKeyState() {
  return (
    <div className="rounded-xl border border-dashed border-amber-500/40 bg-amber-50/60 px-4 py-6 text-sm text-[#111827]/80">
      <div className="mb-2 flex items-center gap-2 font-semibold text-[#111827]">
        <KeyRound className="h-4 w-4 text-amber-600" />
        Google Maps API key required
      </div>
      <ol className="list-decimal space-y-1 pl-5 text-xs text-[#111827]/70">
        <li>
          In Google Cloud, enable <strong>Maps JavaScript API</strong> and <strong>Weather API</strong>.
        </li>
        <li>
          Create an API key and add to <code className="rounded bg-white/80 px-1">frontend/.env.local</code>:
        </li>
      </ol>
      <pre className="mt-3 overflow-x-auto rounded-lg bg-[#111827] px-3 py-2 text-[11px] text-emerald-300">
        {`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here
GOOGLE_MAPS_API_KEY=your_key_here`}
      </pre>
      <p className="mt-2 text-[11px] text-[#111827]/55">Restart <code>npm run dev</code> after saving.</p>
    </div>
  );
}

function LiveGoogleMap({
  places,
  selectedId,
  onSelect,
}: {
  places: SlPlaceWeather[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'twcs-google-maps',
    googleMapsApiKey: MAPS_KEY,
  });

  const selected = places.find((p) => p.place.id === selectedId) ?? null;

  const markers = useMemo(
    () =>
      places.map((row) => ({
        row,
        label: row.temperatureC != null ? `${Math.round(row.temperatureC)}°` : '—',
        color: tempMarkerColor(row.temperatureC),
      })),
    [places],
  );

  if (loadError) {
    return (
      <ErrorState
        error={
          new Error(
            'Failed to load Google Maps. Check NEXT_PUBLIC_GOOGLE_MAPS_API_KEY and Maps JavaScript API enablement.',
          )
        }
      />
    );
  }

  if (!isLoaded) return <Loading label="Loading Google Maps…" />;

  return (
    <div className="h-[360px] overflow-hidden rounded-xl ring-1 ring-black/10 sm:h-[420px]">
      <GoogleMap
        mapContainerStyle={MAP_CONTAINER}
        center={SL_MAP_CENTER}
        zoom={SL_MAP_ZOOM}
        options={MAP_OPTIONS}
      >
        {markers.map(({ row, label, color }) => (
          <MarkerF
            key={row.place.id}
            position={{ lat: row.place.lat, lng: row.place.lng }}
            onClick={() => onSelect(row.place.id)}
            label={{
              text: label,
              color: '#111827',
              fontSize: '11px',
              fontWeight: '700',
            }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 14,
              fillColor: color,
              fillOpacity: 0.95,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            }}
            title={`${row.place.name}: ${label}`}
          />
        ))}

        {selected && (
          <InfoWindowF
            position={{ lat: selected.place.lat, lng: selected.place.lng }}
            onCloseClick={() => onSelect(selected.place.id)}
          >
            <div className="min-w-[140px] p-0.5 text-[#111827]">
              <p className="text-xs font-semibold">{selected.place.name}</p>
              <p className="text-[11px] text-slate-600">{selected.condition ?? '—'}</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums">
                {fmtNumber(selected.temperatureC)} °C
                <span className="ml-1 text-[11px] font-normal text-slate-500">
                  {fmtNumber(selected.humidityPct, 0)}%RH
                </span>
              </p>
            </div>
          </InfoWindowF>
        )}
      </GoogleMap>
    </div>
  );
}

/** Live Sri Lanka map via Google Maps + Google Weather. */
export function SriLankaWeatherMap() {
  const hasMapsKey = Boolean(MAPS_KEY);
  const { data, error, isLoading } = useSWR(hasMapsKey ? 'sl-google-weather' : null, fetchSriLankaWeather, {
    refreshInterval: 5 * 60_000,
    revalidateOnFocus: true,
  });
  const [selectedId, setSelectedId] = useState<string | null>('nuwara-eliya');

  const selected =
    data?.places.find((p) => p.place.id === selectedId) ?? data?.places[0] ?? null;

  return (
    <Card
      title="Sri Lanka live weather"
      subtitle="Google Maps · Google Weather API"
      action={
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/50 px-2 py-1 text-[10px] font-medium text-[#111827]/70 ring-1 ring-inset ring-black/5">
          <span className={`h-1.5 w-1.5 rounded-full ${data ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
          {data ? 'Live' : hasMapsKey ? 'Connecting' : 'Needs key'}
        </span>
      }
    >
      {!hasMapsKey ? (
        <MissingKeyState />
      ) : error ? (
        <div className="space-y-3">
          <ErrorState error={error} />
          <MissingKeyState />
        </div>
      ) : isLoading && !data ? (
        <Loading label="Loading Google Weather…" />
      ) : !data ? (
        <EmptyState title="No weather data" />
      ) : (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <LiveGoogleMap places={data.places} selectedId={selected?.place.id ?? null} onSelect={setSelectedId} />

          <div className="flex min-h-0 flex-col gap-3">
            {selected && <DetailPanel row={selected} />}

            <div className="min-h-0 flex-1 overflow-hidden rounded-xl bg-white/40 ring-1 ring-inset ring-white/60">
              <div className="border-b border-black/5 px-3 py-2 text-[10px] font-medium uppercase tracking-widest text-[#111827]/40">
                All regions
              </div>
              <ul className="max-h-[220px] divide-y divide-black/5 overflow-y-auto lg:max-h-[260px]">
                {data.places.map((row) => {
                  const active = selected?.place.id === row.place.id;
                  return (
                    <li key={row.place.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(row.place.id)}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-white/50 ${
                          active ? 'bg-white/60' : ''
                        }`}
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10"
                          style={{ backgroundColor: tempMarkerColor(row.temperatureC) }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium text-[#111827]">
                            {row.place.name}
                          </span>
                          <span className="block truncate text-[10px] text-[#111827]/45">
                            {row.condition ?? row.error ?? '—'} · {fmtNumber(row.humidityPct, 0)}%RH
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-[#111827]">
                          {fmtNumber(row.temperatureC, 0)}°
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <p className="px-1 text-[10px] text-[#111827]/40">
              Google Weather · refreshes every 5 min · pan/zoom the map
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
