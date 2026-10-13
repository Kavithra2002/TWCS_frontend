/** Major Sri Lankan locations for Google Weather + Maps markers. */

export interface SlWeatherPlace {
  id: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
  note?: string;
}

export const SL_WEATHER_PLACES: SlWeatherPlace[] = [
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

export interface SlPlaceWeather {
  place: SlWeatherPlace;
  temperatureC: number | null;
  feelsLikeC: number | null;
  humidityPct: number | null;
  windKmh: number | null;
  precipitationMm: number | null;
  condition: string | null;
  conditionType: string | null;
  iconUri: string | null;
  observedAt: string | null;
  error?: string;
}

export interface SlWeatherSnapshot {
  fetchedAt: string;
  source: 'google-weather';
  places: SlPlaceWeather[];
}

export function tempMarkerColor(tempC: number | null): string {
  if (tempC == null) return '#94a3b8';
  if (tempC < 18) return '#38bdf8';
  if (tempC < 24) return '#34d399';
  if (tempC < 29) return '#fbbf24';
  return '#f97316';
}

/** Client: load snapshot from our Next.js proxy (keeps Google Weather key server-side). */
export async function fetchSriLankaWeather(): Promise<SlWeatherSnapshot> {
  const res = await fetch('/api/weather/sri-lanka');
  const body = (await res.json()) as SlWeatherSnapshot & { error?: string };
  if (!res.ok) {
    throw new Error(body.error || `Google Weather ${res.status}`);
  }
  return body;
}
