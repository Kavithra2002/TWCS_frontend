import {
  Droplets,
  Fan,
  Leaf,
  Thermometer,
  ThermometerSun,
  Weight,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import type { AlertSeverity, BatchStatus, ScheduleAction, Sensor, SensorType, TroughStatus } from '@/types';

export interface SensorMeta {
  label: string;
  short: string;
  unit: string;
  color: string;
  icon: LucideIcon;
  decimals: number;
  /** Display range for gauges */
  range: [number, number];
}

/** Single source of truth for how each sensor type looks in the UI. */
export const SENSOR_META: Record<SensorType, SensorMeta> = {
  AIR_TEMPERATURE: { label: 'Air temperature', short: 'Air temp', unit: '°C', color: '#f97316', icon: Thermometer, decimals: 1, range: [10, 45] },
  LEAF_TEMPERATURE: { label: 'Leaf temperature', short: 'Leaf temp', unit: '°C', color: '#fb7185', icon: ThermometerSun, decimals: 1, range: [10, 45] },
  HUMIDITY: { label: 'Relative humidity', short: 'Humidity', unit: '%RH', color: '#38bdf8', icon: Droplets, decimals: 1, range: [0, 100] },
  LEAF_MOISTURE: { label: 'Leaf moisture', short: 'Moisture', unit: '%', color: '#22c55e', icon: Leaf, decimals: 1, range: [40, 90] },
  AIRFLOW: { label: 'Airflow', short: 'Airflow', unit: 'm³/h', color: '#a78bfa', icon: Wind, decimals: 0, range: [0, 35000] },
  FAN_SPEED: { label: 'Fan speed', short: 'Fan', unit: 'rpm', color: '#facc15', icon: Fan, decimals: 0, range: [0, 1600] },
  LEAF_WEIGHT: { label: 'Leaf weight', short: 'Weight', unit: 'kg', color: '#94a3b8', icon: Weight, decimals: 0, range: [0, 2000] },
};

export const SENSOR_ORDER: SensorType[] = [
  'AIR_TEMPERATURE',
  'LEAF_TEMPERATURE',
  'HUMIDITY',
  'LEAF_MOISTURE',
  'AIRFLOW',
  'FAN_SPEED',
  'LEAF_WEIGHT',
];

export const sortSensors = <T extends Pick<Sensor, 'type'>>(sensors: T[]) =>
  [...sensors].sort((a, b) => SENSOR_ORDER.indexOf(a.type) - SENSOR_ORDER.indexOf(b.type));

export type RangeState = 'ok' | 'low' | 'high' | 'unknown';

export function rangeState(value: number | null | undefined, sensor: Pick<Sensor, 'minThreshold' | 'maxThreshold'>): RangeState {
  if (value === null || value === undefined) return 'unknown';
  if (sensor.minThreshold !== null && value < sensor.minThreshold) return 'low';
  if (sensor.maxThreshold !== null && value > sensor.maxThreshold) return 'high';
  return 'ok';
}

export const TROUGH_STATUS_STYLE: Record<TroughStatus, { label: string; className: string; color: string }> = {
  RUNNING: { label: 'Running', className: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30', color: '#10b981' },
  IDLE: { label: 'Idle', className: 'bg-slate-500/15 text-slate-300 ring-slate-500/30', color: '#64748b' },
  MAINTENANCE: { label: 'Maintenance', className: 'bg-amber-500/15 text-amber-300 ring-amber-500/30', color: '#f59e0b' },
  OFFLINE: { label: 'Offline', className: 'bg-red-500/15 text-red-300 ring-red-500/30', color: '#ef4444' },
};

export const BATCH_STATUS_STYLE: Record<BatchStatus, { label: string; className: string }> = {
  PLANNED: { label: 'Planned', className: 'bg-sky-500/15 text-sky-300 ring-sky-500/30' },
  WITHERING: { label: 'Withering', className: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30' },
  COMPLETED: { label: 'Completed', className: 'bg-slate-500/15 text-slate-300 ring-slate-500/30' },
  ABORTED: { label: 'Aborted', className: 'bg-red-500/15 text-red-300 ring-red-500/30' },
};

export const SEVERITY_STYLE: Record<AlertSeverity, { label: string; className: string }> = {
  INFO: { label: 'Info', className: 'bg-sky-500/15 text-sky-300 ring-sky-500/30' },
  WARNING: { label: 'Warning', className: 'bg-amber-500/15 text-amber-300 ring-amber-500/30' },
  CRITICAL: { label: 'Critical', className: 'bg-red-500/15 text-red-300 ring-red-500/30' },
};

export const SCHEDULE_ACTION_STYLE: Record<ScheduleAction, { label: string; color: string }> = {
  WITHERING_CYCLE: { label: 'Withering cycle', color: '#2e9862' },
  FAN_ON: { label: 'Fans on', color: '#eab308' },
  HEATER_ON: { label: 'Hot air', color: '#f97316' },
  REVERSE_AIRFLOW: { label: 'Reverse airflow', color: '#8b5cf6' },
  LEAF_TURNING: { label: 'Leaf turning', color: '#06b6d4' },
  MAINTENANCE: { label: 'Maintenance', color: '#64748b' },
};
