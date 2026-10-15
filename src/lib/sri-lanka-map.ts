/** Major Sri Lankan locations for the Overview live map. */

export interface SlMapPlace {
  id: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
  note?: string;
}

export const SL_MAP_PLACES: SlMapPlace[] = [
  { id: 'colombo', name: 'Colombo', region: 'Western', lat: 6.9271, lng: 79.8612 },
  { id: 'kandy', name: 'Kandy', region: 'Central', lat: 7.2906, lng: 80.6337, note: 'Mid-country' },
  { id: 'nuwara-eliya', name: 'Nuwara Eliya', region: 'Central', lat: 6.9497, lng: 80.7891, note: 'Up-country tea' },
  { id: 'hatton', name: 'Hatton', region: 'Central', lat: 6.8916, lng: 80.5956, note: 'Tea belt' },
  { id: 'badulla', name: 'Badulla', region: 'Uva', lat: 6.9934, lng: 81.055, note: 'Uva tea' },
  { id: 'ratnapura', name: 'Ratnapura', region: 'Sabaragamuwa', lat: 6.7056, lng: 80.3847 },
  { id: 'galle', name: 'Galle', region: 'Southern', lat: 6.0535, lng: 80.221 },
  { id: 'trincomalee', name: 'Trincomalee', region: 'Eastern', lat: 8.5874, lng: 81.2152 },
  { id: 'jaffna', name: 'Jaffna', region: 'Northern', lat: 9.6615, lng: 80.0255 },
  { id: 'anuradhapura', name: 'Anuradhapura', region: 'North Central', lat: 8.3114, lng: 80.4037 },
];

export const SL_MAP_CENTER = { lat: 7.8731, lng: 80.7718 };
export const SL_MAP_ZOOM = 7;

/** Leaflet maxBounds around Sri Lanka [southWest, northEast]. */
export const SL_MAP_BOUNDS: [[number, number], [number, number]] = [
  [5.5, 79.2],
  [10.2, 82.2],
];

export type SlMapViewId = 'streets' | 'satellite' | 'terrain';

export interface SlMapView {
  id: SlMapViewId;
  label: string;
  url: string;
  attribution: string;
  maxZoom?: number;
  /** Optional labels overlay (hybrid satellite). */
  labelsUrl?: string;
}

export const SL_MAP_VIEWS: SlMapView[] = [
  {
    id: 'streets',
    label: 'Streets',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap',
    maxZoom: 19,
  },
  {
    id: 'satellite',
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    // Esri place labels drawn for hybrid-style satellite.
    labelsUrl:
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri',
    maxZoom: 19,
  },
  {
    id: 'terrain',
    label: 'Terrain',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '© OpenTopoMap',
    maxZoom: 17,
  },
];

export function filterLocalPlaces(query: string): SlMapPlace[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return SL_MAP_PLACES.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.region.toLowerCase().includes(q) ||
      (p.note?.toLowerCase().includes(q) ?? false),
  );
}

export interface SlSearchHit {
  id: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
  note?: string;
  source: 'local' | 'geocode';
}

/** Search local tea/region list + Sri Lanka geocode proxy. */
export async function searchSriLankaLocations(query: string): Promise<SlSearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const local: SlSearchHit[] = filterLocalPlaces(q).map((p) => ({
    ...p,
    source: 'local' as const,
  }));

  try {
    const res = await fetch(`/api/geocode/sri-lanka?q=${encodeURIComponent(q)}`);
    if (!res.ok) return local;
    const body = (await res.json()) as { results?: SlSearchHit[] };
    const remote = (body.results ?? []).filter(
      (r) => !local.some((l) => Math.abs(l.lat - r.lat) < 0.02 && Math.abs(l.lng - r.lng) < 0.02),
    );
    return [...local, ...remote].slice(0, 8);
  } catch {
    return local;
  }
}

export function hitToPlace(hit: SlSearchHit): SlMapPlace {
  return {
    id: hit.id,
    name: hit.name,
    region: hit.region,
    lat: hit.lat,
    lng: hit.lng,
    note: hit.note,
  };
}
