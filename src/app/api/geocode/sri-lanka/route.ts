import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface NominatimHit {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  class?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    county?: string;
  };
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('countrycodes', 'lk');
  url.searchParams.set('limit', '6');
  url.searchParams.set('q', q);

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'TWCS-TeaWitheringControlSystem/1.0 (local-dev)',
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json({ results: [], error: `Geocode ${res.status}` }, { status: 502 });
    }

    const data = (await res.json()) as NominatimHit[];
    const results = data.map((hit) => {
      const name =
        hit.address?.city ||
        hit.address?.town ||
        hit.address?.village ||
        hit.display_name.split(',')[0]?.trim() ||
        'Location';
      const region = hit.address?.state || hit.address?.county || 'Sri Lanka';
      return {
        id: `geo-${hit.place_id}`,
        name,
        region,
        lat: Number(hit.lat),
        lng: Number(hit.lon),
        note: hit.type || hit.class || undefined,
        source: 'geocode' as const,
      };
    });

    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json(
      { results: [], error: err instanceof Error ? err.message : 'Geocode failed' },
      { status: 502 },
    );
  }
}
