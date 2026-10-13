import { SL_WEATHER_PLACES, type SlPlaceWeather, type SlWeatherSnapshot } from '@/lib/sri-lanka-weather';

export const dynamic = 'force-dynamic';

interface GoogleWeatherResponse {
  currentTime?: string;
  weatherCondition?: {
    iconBaseUri?: string;
    description?: { text?: string };
    type?: string;
  };
  temperature?: { degrees?: number };
  feelsLikeTemperature?: { degrees?: number };
  relativeHumidity?: number;
  precipitation?: { qpf?: { quantity?: number } };
  wind?: { speed?: { value?: number } };
  error?: { message?: string; status?: string };
}

function googleWeatherKey(): string | undefined {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
}

async function lookupPlace(lat: number, lng: number, key: string): Promise<GoogleWeatherResponse> {
  const url = new URL('https://weather.googleapis.com/v1/currentConditions:lookup');
  url.searchParams.set('key', key);
  url.searchParams.set('location.latitude', String(lat));
  url.searchParams.set('location.longitude', String(lng));
  url.searchParams.set('unitsSystem', 'METRIC');

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  const data = (await res.json()) as GoogleWeatherResponse;
  if (!res.ok) {
    throw new Error(data.error?.message || `Google Weather HTTP ${res.status}`);
  }
  return data;
}

export async function GET() {
  const key = googleWeatherKey();
  if (!key) {
    return Response.json(
      {
        error:
          'Missing Google Maps API key. Set GOOGLE_MAPS_API_KEY (server) or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in frontend/.env.local',
      },
      { status: 503 },
    );
  }

  const places: SlPlaceWeather[] = await Promise.all(
    SL_WEATHER_PLACES.map(async (place) => {
      try {
        const data = await lookupPlace(place.lat, place.lng, key);
        return {
          place,
          temperatureC: data.temperature?.degrees ?? null,
          feelsLikeC: data.feelsLikeTemperature?.degrees ?? null,
          humidityPct: data.relativeHumidity ?? null,
          windKmh: data.wind?.speed?.value ?? null,
          precipitationMm: data.precipitation?.qpf?.quantity ?? null,
          condition: data.weatherCondition?.description?.text ?? null,
          conditionType: data.weatherCondition?.type ?? null,
          iconUri: data.weatherCondition?.iconBaseUri
            ? `${data.weatherCondition.iconBaseUri}.png`
            : null,
          observedAt: data.currentTime ?? null,
        } satisfies SlPlaceWeather;
      } catch (err) {
        return {
          place,
          temperatureC: null,
          feelsLikeC: null,
          humidityPct: null,
          windKmh: null,
          precipitationMm: null,
          condition: null,
          conditionType: null,
          iconUri: null,
          observedAt: null,
          error: err instanceof Error ? err.message : 'Weather lookup failed',
        } satisfies SlPlaceWeather;
      }
    }),
  );

  const failed = places.filter((p) => p.error).length;
  if (failed === places.length) {
    return Response.json(
      {
        error:
          places[0]?.error ||
          'Google Weather failed for all locations. Enable Weather API on your Google Cloud key.',
      },
      { status: 502 },
    );
  }

  const body: SlWeatherSnapshot = {
    fetchedAt: new Date().toISOString(),
    source: 'google-weather',
    places,
  };
  return Response.json(body);
}
