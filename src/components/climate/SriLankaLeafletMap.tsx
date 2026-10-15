'use client';

import { useEffect } from 'react';
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  ZoomControl,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  SL_MAP_BOUNDS,
  SL_MAP_CENTER,
  SL_MAP_PLACES,
  SL_MAP_VIEWS,
  SL_MAP_ZOOM,
  type SlMapPlace,
  type SlMapViewId,
} from '@/lib/sri-lanka-map';

const MARKER_COLOR = '#0d9488';

function FlyToSelected({ place }: { place: SlMapPlace | null }) {
  const map = useMap();

  useEffect(() => {
    if (!place) return;
    map.flyTo([place.lat, place.lng], Math.max(map.getZoom(), 10), { duration: 0.55 });
  }, [map, place]);

  return null;
}

function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const id = window.setTimeout(() => map.invalidateSize(), 80);
    return () => window.clearTimeout(id);
  }, [map]);
  return null;
}

/** Dedicated pane so label tiles sit above satellite imagery. */
function LabelsTileLayer({ url, maxZoom }: { url: string; maxZoom?: number }) {
  const map = useMap();

  useEffect(() => {
    if (!map.getPane('placeLabels')) {
      const pane = map.createPane('placeLabels');
      pane.style.zIndex = '450';
      pane.style.pointerEvents = 'none';
    }
  }, [map]);

  return <TileLayer key={url} url={url} maxZoom={maxZoom} pane="placeLabels" opacity={1} />;
}

export function SriLankaLeafletMap({
  selected,
  mapView,
  onSelect,
  extraPlace,
  className,
}: {
  selected: SlMapPlace | null;
  mapView: SlMapViewId;
  onSelect: (place: SlMapPlace) => void;
  /** Search hit not in the fixed key-locations list. */
  extraPlace?: SlMapPlace | null;
  className?: string;
}) {
  const view = SL_MAP_VIEWS.find((v) => v.id === mapView) ?? SL_MAP_VIEWS[0];
  const places = extraPlace && !SL_MAP_PLACES.some((p) => p.id === extraPlace.id)
    ? [...SL_MAP_PLACES, extraPlace]
    : SL_MAP_PLACES;

  return (
    <MapContainer
      center={[SL_MAP_CENTER.lat, SL_MAP_CENTER.lng]}
      zoom={SL_MAP_ZOOM}
      className={className}
      style={{ height: '100%', width: '100%', background: '#e2e8f0' }}
      maxBounds={SL_MAP_BOUNDS}
      maxBoundsViscosity={0.85}
      scrollWheelZoom
      attributionControl={false}
      zoomControl={false}
    >
      <TileLayer key={`${view.id}-base`} url={view.url} attribution={view.attribution} maxZoom={view.maxZoom} />
      {view.labelsUrl && <LabelsTileLayer url={view.labelsUrl} maxZoom={view.maxZoom} />}
      <ZoomControl position="bottomright" />
      <InvalidateSize />
      <FlyToSelected place={selected} />

      {places.map((place) => {
        const active = selected?.id === place.id;
        return (
          <CircleMarker
            key={place.id}
            center={[place.lat, place.lng]}
            radius={active ? 9 : 6}
            pathOptions={{
              color: '#ffffff',
              weight: 2,
              fillColor: MARKER_COLOR,
              fillOpacity: 0.95,
            }}
            eventHandlers={{ click: () => onSelect(place) }}
          >
            <Tooltip
              direction="top"
              offset={[0, -10]}
              permanent
              className={`sl-map-label${active ? ' sl-map-label-active' : ''}`}
            >
              {place.name}
            </Tooltip>
            {active && (
              <Popup>
                <div className="min-w-[110px]">
                  <p className="text-xs font-semibold text-[#111827]">{place.name}</p>
                  <p className="text-[11px] text-slate-600">
                    {place.region}
                    {place.note ? ` · ${place.note}` : ''}
                  </p>
                </div>
              </Popup>
            )}
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
