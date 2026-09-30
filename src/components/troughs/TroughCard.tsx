'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { MoistureProgress } from '@/components/indicators/MoistureProgress';
import { SensorTile } from '@/components/indicators/SensorTile';
import { useLiveReading } from '@/components/providers/RealtimeProvider';
import { TroughStatusBadge } from '@/components/ui/Badge';
import { sortSensors } from '@/lib/sensors';
import type { Batch, SensorType, TroughWithLive } from '@/types';

const DEFAULT_TYPES: SensorType[] = ['AIR_TEMPERATURE', 'HUMIDITY', 'LEAF_MOISTURE', 'FAN_SPEED'];

interface Props {
  trough: TroughWithLive;
  activeBatch?: Batch | null;
  sensorTypes?: SensorType[];
}

export function TroughCard({ trough, activeBatch, sensorTypes = DEFAULT_TYPES }: Props) {
  const sensors = sortSensors(trough.sensors.filter((s) => sensorTypes.includes(s.type)));
  const moistureSensor = trough.sensors.find((s) => s.type === 'LEAF_MOISTURE');
  const liveMoisture = useLiveReading(moistureSensor?.id, moistureSensor?.latest);

  return (
    <Link
      href={`/troughs/${trough.id}`}
      className="group block h-full rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition hover:border-tea-600/60 hover:bg-slate-900"
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-50">{trough.code}</p>
          <p className="text-xs text-slate-500">
            {trough.name} · {trough.capacityKg.toLocaleString()} kg
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TroughStatusBadge status={trough.status} />
          <ChevronRight className="h-4 w-4 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-slate-300" />
        </div>
      </div>

      <div className={`grid gap-2 ${sensors.length > 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'}`}>
        {sensors.map((s) => (
          <SensorTile key={s.id} sensor={s} compact />
        ))}
      </div>

      {activeBatch && (
        <div className="mt-3 border-t border-slate-800 pt-3">
          <MoistureProgress batch={activeBatch} currentMoisture={liveMoisture?.value} />
        </div>
      )}
    </Link>
  );
}
