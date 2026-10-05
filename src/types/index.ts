// Mirrors the backend DTOs. Keep in sync with backend/src/modules/*.

export type TroughStatus = 'IDLE' | 'RUNNING' | 'MAINTENANCE' | 'OFFLINE';
export type SensorType =
  | 'AIR_TEMPERATURE'
  | 'LEAF_TEMPERATURE'
  | 'HUMIDITY'
  | 'LEAF_MOISTURE'
  | 'AIRFLOW'
  | 'FAN_SPEED'
  | 'LEAF_WEIGHT';
export type BatchStatus = 'PLANNED' | 'WITHERING' | 'COMPLETED' | 'ABORTED';
export type ScheduleAction =
  | 'WITHERING_CYCLE'
  | 'FAN_ON'
  | 'HEATER_ON'
  | 'REVERSE_AIRFLOW'
  | 'LEAF_TURNING'
  | 'MAINTENANCE';
export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ScreenView {
  id: string;
  screenId: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScreenAssignee {
  id: string;
  name: string;
  email: string;
}

export interface MasterScreen {
  id: string;
  code: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  views: ScreenView[];
  assignedUsers: ScreenAssignee[];
}

export interface LatestReading {
  value: number;
  recordedAt: string;
}

export interface Sensor {
  id: string;
  troughId: string;
  type: SensorType;
  label: string;
  unit: string;
  minThreshold: number | null;
  maxThreshold: number | null;
  isActive: boolean;
}

export interface SensorWithLatest extends Sensor {
  latest: LatestReading | null;
}

export interface Trough {
  id: string;
  code: string;
  name: string;
  factoryId: string;
  capacityKg: number;
  status: TroughStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TroughWithLive extends Trough {
  sensors: SensorWithLatest[];
}

export interface Batch {
  id: string;
  code: string;
  troughId: string;
  troughCode: string | null;
  leafIntakeKg: number;
  initialMoisture: number;
  targetMoisture: number;
  finalMoisture: number | null;
  status: BatchStatus;
  plannedStartAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  notes: string | null;
  createdAt: string;
  currentMoisture: number | null;
  progressPct: number | null;
  elapsedMinutes: number | null;
}

export interface Schedule {
  id: string;
  troughId: string;
  troughCode: string | null;
  name: string;
  action: ScheduleAction;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  setpoint: number | null;
  enabled: boolean;
  lastRunAt: string | null;
}

export interface TodaySchedules {
  now: string;
  weekday: number;
  timeZone: string;
  items: (Schedule & { state: 'UPCOMING' | 'ACTIVE' | 'DONE' })[];
}

export interface Alert {
  id: string;
  troughId: string;
  troughCode: string | null;
  sensorId: string | null;
  sensorType: SensorType | null;
  severity: AlertSeverity;
  message: string;
  value: number | null;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  acknowledgedBy: { id: string; name: string } | null;
  createdAt: string;
}

export interface DashboardOverview {
  generatedAt: string;
  kpis: {
    troughs: { total: number; running: number; idle: number; maintenance: number; offline: number };
    averages: {
      airTemperature: number | null;
      leafTemperature: number | null;
      humidity: number | null;
      leafMoisture: number | null;
    };
    activeBatches: number;
    leafInProcessKg: number;
    openAlerts: number;
  };
  troughs: (TroughWithLive & { activeBatch: Batch | null })[];
  recentAlerts: Alert[];
}

export interface SeriesPoint {
  t: string;
  avg: number;
  min: number;
  max: number;
}

export interface SeriesResponse {
  sensor: Pick<Sensor, 'id' | 'troughId' | 'type' | 'label' | 'unit' | 'minThreshold' | 'maxThreshold'>;
  from: string;
  to: string;
  bucketSeconds: number;
  summary: { min: number; max: number; avg: number; samples: number } | null;
  points: SeriesPoint[];
}

// Socket.IO payloads
export interface ReadingEvent {
  sensorId: string;
  troughId: string;
  type: SensorType;
  unit: string;
  value: number;
  recordedAt: string;
}

export interface AlertEvent {
  id: string;
  troughId: string;
  sensorId: string | null;
  severity: AlertSeverity;
  message: string;
  value: number | null;
  createdAt: string;
}
