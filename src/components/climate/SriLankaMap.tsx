'use client';

import { useEffect, useId, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Compass, Loader2, MapPin, Mountain, Satellite, Search, Map as MapIcon, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/States';
import {
  hitToPlace,
  searchSriLankaLocations,
  SL_MAP_PLACES,
  SL_MAP_VIEWS,
  type SlMapPlace,
  type SlMapViewId,
  type SlSearchHit,
} from '@/lib/sri-lanka-map';

const MARKER_COLOR = '#0d9488';
/** Keep map + side panel the same height. */
const MAP_FRAME = 'h-[360px] sm:h-[420px]';

const LeafletLiveMap = dynamic(
  () => import('./SriLankaLeafletMap').then((m) => m.SriLankaLeafletMap),
  {
    ssr: false,
    loading: () => (
      <div className={`${MAP_FRAME} flex items-center justify-center rounded-xl bg-white/40 ring-1 ring-black/10`}>
        <Loading label="Loading map…" />
      </div>
    ),
  },
);

const VIEW_ICONS: Record<SlMapViewId, typeof MapIcon> = {
  streets: MapIcon,
  satellite: Satellite,
  terrain: Mountain,
};

function PlaceList({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (place: SlMapPlace) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-white/40 ring-1 ring-inset ring-white/60">
      <div className="shrink-0 border-b border-black/5 px-3 py-2 text-[10px] font-medium uppercase tracking-widest text-slate-500">
        Key locations
      </div>
      <ul className="min-h-0 flex-1 divide-y divide-black/5 overflow-y-auto overscroll-contain">
        {SL_MAP_PLACES.map((place) => {
          const active = selectedId === place.id;
          return (
            <li key={place.id}>
              <button
                type="button"
                onClick={() => onSelect(place)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-white/50 ${
                  active ? 'bg-white/60' : ''
                }`}
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-1 ring-black/10"
                  style={{ backgroundColor: active ? MARKER_COLOR : '#cbd5e1' }}
                >
                  <MapPin className="h-3 w-3 text-white" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-[#111827]">{place.name}</span>
                  <span className="block truncate text-[11px] text-slate-600">
                    {place.region}
                    {place.note ? ` · ${place.note}` : ''}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MapViewSwitcher({
  active,
  onChange,
}: {
  active: SlMapViewId;
  onChange: (id: SlMapViewId) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-white/95 p-1 shadow-md ring-1 ring-black/10 backdrop-blur-sm">
      {SL_MAP_VIEWS.map((view) => {
        const Icon = VIEW_ICONS[view.id];
        const selected = active === view.id;
        return (
          <button
            key={view.id}
            type="button"
            onClick={() => onChange(view.id)}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition ${
              selected
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
            aria-pressed={selected}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {view.label}
          </button>
        );
      })}
    </div>
  );
}

function MapLocationSearch({ onPick }: { onPick: (place: SlMapPlace) => void }) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SlSearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void searchSriLankaLocations(q).then((results) => {
        if (cancelled) return;
        setHits(results);
        setLoading(false);
        setOpen(true);
      });
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div ref={wrapRef} className="relative w-full max-w-[260px]">
      <label className="sr-only" htmlFor={listId}>
        Search locations
      </label>
      <div className="flex items-center gap-2 rounded-lg bg-white/95 px-2.5 py-2 shadow-md ring-1 ring-black/10 backdrop-blur-sm">
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-teal-600" aria-hidden />
        ) : (
          <Search className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
        )}
        <input
          id={listId}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => hits.length > 0 && setOpen(true)}
          placeholder="Search Sri Lanka…"
          className="min-w-0 flex-1 bg-transparent text-xs font-medium text-[#111827] outline-none placeholder:text-slate-400"
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setHits([]);
              setOpen(false);
            }}
            className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && query.trim().length >= 2 && (
        <ul className="absolute left-0 right-0 top-[calc(100%+6px)] z-[1100] max-h-52 overflow-y-auto rounded-lg bg-white py-1 shadow-lg ring-1 ring-black/10">
          {hits.length === 0 && !loading ? (
            <li className="px-3 py-2 text-xs text-slate-500">No locations found</li>
          ) : (
            hits.map((hit) => (
              <li key={hit.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(hitToPlace(hit));
                    setQuery(hit.name);
                    setOpen(false);
                  }}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-teal-50"
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-[#111827]">{hit.name}</span>
                    <span className="block truncate text-[10px] text-slate-500">
                      {hit.region}
                      {hit.note ? ` · ${hit.note}` : ''}
                      {hit.source === 'geocode' ? ' · map' : ''}
                    </span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

/** Interactive live map of Sri Lanka with key tea / regional locations. */
export function SriLankaMap() {
  const [selected, setSelected] = useState<SlMapPlace>(SL_MAP_PLACES[2] ?? SL_MAP_PLACES[0]);
  const [extraPlace, setExtraPlace] = useState<SlMapPlace | null>(null);
  const [mapView, setMapView] = useState<SlMapViewId>('streets');
  const activeView = SL_MAP_VIEWS.find((v) => v.id === mapView) ?? SL_MAP_VIEWS[0];

  function selectPlace(place: SlMapPlace) {
    setSelected(place);
    if (!SL_MAP_PLACES.some((p) => p.id === place.id)) {
      setExtraPlace(place);
    }
  }

  return (
    <Card
      title="Sri Lanka live map"
      subtitle={activeView.label}
      action={
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/50 px-2 py-1 text-[10px] font-medium text-[#111827]/70 ring-1 ring-inset ring-black/5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          Live
        </span>
      }
    >
      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.85fr)]">
        <div className={`${MAP_FRAME} relative overflow-hidden rounded-xl ring-1 ring-black/10`}>
          <LeafletLiveMap
            selected={selected}
            mapView={mapView}
            onSelect={selectPlace}
            extraPlace={extraPlace}
            className="h-full w-full"
          />
          <div className="pointer-events-none absolute left-3 top-3 z-[1000] flex flex-col gap-2">
            <div className="pointer-events-auto">
              <MapLocationSearch onPick={selectPlace} />
            </div>
            <div className="pointer-events-auto">
              <MapViewSwitcher active={mapView} onChange={setMapView} />
            </div>
          </div>
        </div>

        <div className={`${MAP_FRAME} flex min-h-0 flex-col gap-2`}>
          {selected && (
            <div className="shrink-0 rounded-xl bg-white/90 p-3 shadow-sm ring-1 ring-black/10">
              <div className="flex items-start gap-2.5">
                <span
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: MARKER_COLOR }}
                >
                  <MapPin className="h-4 w-4 text-white" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold tracking-tight text-[#111827]">
                    {selected.name}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-800 ring-1 ring-inset ring-teal-600/20">
                      {selected.region}
                    </span>
                    {selected.note && (
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 ring-1 ring-inset ring-slate-500/15">
                        {selected.note}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-medium tabular-nums text-slate-600">
                    <Compass className="h-3.5 w-3.5 shrink-0 text-teal-600" aria-hidden />
                    <span>
                      {selected.lat.toFixed(4)}°N
                      <span className="mx-1 text-slate-300">·</span>
                      {selected.lng.toFixed(4)}°E
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}
          <PlaceList selectedId={selected?.id ?? null} onSelect={selectPlace} />
        </div>
      </div>
    </Card>
  );
}

/** @deprecated Prefer SriLankaMap — kept for existing imports. */
export const SriLankaWeatherMap = SriLankaMap;
