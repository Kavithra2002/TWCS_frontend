// Mirrors the backend DTOs. Keep in sync with backend/src/modules/*.

// ── Enums (match Prisma) ────────────────────────────────────────────────────

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

// ── Users & master data ─────────────────────────────────────────────────────

/** Executive stays role=executive; designation selects Normal vs General Manager. */
export type ExecutiveDesignation = 'standard' | 'general_manager';

export interface ExecutiveConfig {
  designation: ExecutiveDesignation;
  troughIds: string[];
  canViewLiveMonitoring: boolean;
  canExportReports: boolean;
  receiveAlertDigest: boolean;
  notes?: string | null;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive?: boolean;
  executiveConfig?: ExecutiveConfig | null;
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

export interface MasterScreenAssignee {
  id: string;
  name: string;
  email: string;
}

/** Screen definition with nested views and users assigned via UserScreen. */
export interface MasterScreen {
  id: string;
  code: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  views: ScreenView[];
  assignedUsers: MasterScreenAssignee[];
}

// ── Factories & troughs ───────────────────────────────────────────────────────

export interface Factory {
  id: string;
  code: string;
  name: string;
  location: string | null;
  createdAt: string;
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
  createdAt?: string;
}

export interface SensorWithLatest extends Sensor {
  latest: LatestReading | null;
}

export interface TroughWithLive extends Trough {
  sensors: SensorWithLatest[];
}

// ── Batches ───────────────────────────────────────────────────────────────────

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
  updatedAt?: string;
  /** Live leaf moisture while WITHERING; otherwise same as finalMoisture when completed. */
  currentMoisture: number | null;
  progressPct: number | null;
  elapsedMinutes: number | null;
}

// ── Schedules ───────────────────────────────────────────────────────────────────

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
  createdAt: string;
  updatedAt: string;
}

export type ScheduleDayState = 'UPCOMING' | 'ACTIVE' | 'DONE';

export interface ScheduleTodayItem extends Schedule {
  state: ScheduleDayState;
}

export interface TodaySchedules {
  now: string;
  weekday: number;
  timeZone: string;
  items: ScheduleTodayItem[];
}

// ── Alerts ────────────────────────────────────────────────────────────────────

export interface AlertAcknowledgedBy {
  id: string;
  name: string;
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
  acknowledgedBy: AlertAcknowledgedBy | null;
  createdAt: string;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface DashboardOverview {
  generatedAt: string;
  kpis: {
    troughs: {
      total: number;
      running: number;
      idle: number;
      maintenance: number;
      offline: number;
    };
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

// ── Telemetry / charts ────────────────────────────────────────────────────────

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
  summary: {
    min: number;
    max: number;
    avg: number;
    samples: number;
  } | null;
  points: SeriesPoint[];
}

// ── Realtime (Socket.IO) ──────────────────────────────────────────────────────

/** Payload of the `reading` socket event (`telemetry.reading.recorded`). */
export interface ReadingEvent {
  sensorId: string;
  troughId: string;
  type: SensorType;
  unit: string;
  value: number;
  recordedAt: string;
}

/** Payload of the `alert` socket event (`alert.raised`). */
export interface AlertEvent {
  id: string;
  troughId: string;
  sensorId: string | null;
  severity: AlertSeverity;
  message: string;
  value: number | null;
  createdAt: string;
}

// ── Test Version (MQTT publisher + VBox DB poll) ─────────────────────────────
// Mirrors backend/src/modules/test-version/test-version.service.ts

export type TestVersionPublishKind = 'session' | 'events' | 'timeseries';

export interface TestVersionLogEntry {
  at: string;
  kind: TestVersionPublishKind;
  topic: string;
  sampleId?: string;
  index?: number;
  total?: number;
  ok: boolean;
  error?: string;
  payload?: unknown;
}

export interface DbLiveSnapshotCounts {
  sessions: number;
  events: number;
  time_series: number;
}

/** Rows returned from VBox Postgres (`SELECT *` / explicit column lists). */
export type DbLiveSnapshotRow = Record<string, unknown>;

export interface DbLiveSnapshot {
  polledAt: string | null;
  ok: boolean;
  error: string | null;
  session: DbLiveSnapshotRow | null;
  events: DbLiveSnapshotRow[];
  timeSeries: DbLiveSnapshotRow[];
  counts: DbLiveSnapshotCounts;
}

/** One droplet `raw_vbox_data` row (VNet sample stored by the subscriber). */
export interface RawVboxRow {
  id: number;
  receivedAt: string;
  payload: Record<string, unknown>;
}

export interface FeedStatusEvent {
  at: string;
  state: 'connected' | 'disconnected';
  reason: string;
}

export interface RawLiveFeed {
  polledAt: string | null;
  /** True only after Trough 6 Run, until Stop. */
  watching: boolean;
  dbConnected: boolean;
  feedConnected: boolean;
  error: string | null;
  lastReceivedAt: string | null;
  ageMs: number | null;
  count: number;
  rows: RawVboxRow[];
  statusLog: FeedStatusEvent[];
}

export interface TestVersionStatus {
  running: boolean;
  connected: boolean;
  brokerUrl: string;
  clientId: string;
  topics: { session: string; events: string; timeseries: string };
  intervalMs: number;
  troughId: string | null;
  witheringId: string | null;
  sampleIndex: number;
  sampleTotal: number;
  startedAt: string | null;
  lastError: string | null;
  lastSent: { at: string; kind: TestVersionPublishKind; topic: string; payload: unknown } | null;
  recentSent: TestVersionLogEntry[];
  db: DbLiveSnapshot;
  live: RawLiveFeed;
  log: TestVersionLogEntry[];
  tunnelHint: string;
}

export interface TestVersionTrough {
  id: string;
  available: boolean;
}

export type IntakeCell = string | number | boolean | null;
export type IntakeTableName = 'sessions' | 'events' | 'time_series';

/** One droplet table as shown on Test Version 2. Mirrors the backend intake snapshot. */
export interface IntakeTableSnapshot {
  columns: string[];
  rows: Record<string, IntakeCell>[];
  count: number;
  latestAt: string | null;
}

export interface IntakeSnapshot {
  polledAt: string;
  ok: boolean;
  dbConnected: boolean;
  updating: boolean;
  error: string | null;
  ageMs: number | null;
  tunnelHint: string;
  tables: Record<IntakeTableName, IntakeTableSnapshot>;
}
