import { loadAllSimData } from '@/lib/sim-data';

export const dynamic = 'force-dynamic';

export function GET() {
  try {
    const data = loadAllSimData();
    return Response.json(data);
  } catch (err) {
    console.error('[sim-data] Failed to load trough data:', err);
    return Response.json([], { status: 500 });
  }
}
