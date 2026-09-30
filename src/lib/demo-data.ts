import type {
  Alert,
  AlertSeverity,
  Batch,
  BatchStatus,
  Schedule,
  ScheduleAction,
  SensorType,
  SeriesResponse,
  TroughStatus,
  TroughWithLive,
} from '@/types';

/**
 * In-memory stand-in for the API. Used while the UI is reviewed without
 * Postgres. Swap back by setting NEXT_PUBLIC_DATA_SOURCE=api.
 */

const FACTORY_ID = 'factory-01';
const TIME_ZONE = 'Asia/Colombo';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const SENSOR_DEFS: { type: SensorType; label: string; unit: string; min: number; max: number; decimals: number }[] = [
  { type: 'AIR_TEMPERATURE', label: 'Air temperature', unit: '°C', min: 20, max: 36, decimals: 1 },
  { type: 'LEAF_TEMPERATURE', label: 'Leaf temperature', unit: '°C', min: 20, max: 33, decimals: 1 },
  { type: 'HUMIDITY', label: 'Relative humidity', unit: '%RH', min: 55, max: 90, decimals: 1 },
  { type: 'LEAF_MOISTURE', label: 'Leaf moisture', unit: '%', min: 52, max: 82, decimals: 1 },
  { type: 'AIRFLOW', label: 'Airflow', unit: 'm³/h', min: 12000, max: 30000, decimals: 0 },
  { type: 'FAN_SPEED', label: 'Fan speed', unit: 'rpm', min: 600, max: 1500, decimals: 0 },
  { type: 'LEAF_WEIGHT', label: 'Leaf weight', unit: 'kg', min: 0, max: 1800, decimals: 0 },
];

/** Latest readings for the six troughs, matching the factory overview. */
const LIVE: Record<number, Record<SensorType, number>> = {
  1: { AIR_TEMPERATURE: 28.5, LEAF_TEMPERATURE: 27.6, HUMIDITY: 71.9, LEAF_MOISTURE: 73.4, AIRFLOW: 22100, FAN_SPEED: 1253, LEAF_WEIGHT: 1410 },
  2: { AIR_TEMPERATURE: 29.3, LEAF_TEMPERATURE: 28.2, HUMIDITY: 73.5, LEAF_MOISTURE: 74.3, AIRFLOW: 20850, FAN_SPEED: 1219, LEAF_WEIGHT: 1360 },
  3: { AIR_TEMPERATURE: 28.6, LEAF_TEMPERATURE: 27.1, HUMIDITY: 67.9, LEAF_MOISTURE: 70.9, AIRFLOW: 21834, FAN_SPEED: 1247, LEAF_WEIGHT: 1153 },
  4: { AIR_TEMPERATURE: 29.3, LEAF_TEMPERATURE: 31.1, HUMIDITY: 71.9, LEAF_MOISTURE: 76.9, AIRFLOW: 22440, FAN_SPEED: 1550, LEAF_WEIGHT: 1520 },
  5: { AIR_TEMPERATURE: 26.4, LEAF_TEMPERATURE: 25.1, HUMIDITY: 78.4, LEAF_MOISTURE: 76.2, AIRFLOW: 0, FAN_SPEED: 0, LEAF_WEIGHT: 0 },
  6: { AIR_TEMPERATURE: 24.8, LEAF_TEMPERATURE: 24.2, HUMIDITY: 81.0, LEAF_MOISTURE: 75.4, AIRFLOW: 0, FAN_SPEED: 0, LEAF_WEIGHT: 0 },
};

interface SensorRow {
  id: string;
  troughId: string;
  type: SensorType;
  label: string;
  unit: string;
  minThreshold: number | null;
  maxThreshold: number | null;
  isActive: boolean;
  value: number;
  decimals: number;
}

interface TroughRow {
  id: string;
  code: string;
  name: string;
  factoryId: string;
  capacityKg: number;
  status: TroughStatus;
  createdAt: string;
  updatedAt: string;
}

interface BatchRow {
  id: string;
  code: string;
  troughId: string;
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
}

interface ScheduleRow {
  id: string;
  troughId: string;
  name: string;
  action: ScheduleAction;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  setpoint: number | null;
  enabled: boolean;
  lastRunAt: string | null;
}

interface AlertRow {
  id: string;
  troughId: string;
  sensorId: string | null;
  severity: AlertSeverity;
  message: string;
  value: number | null;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  acknowledgedBy: { id: string; name: string } | null;
  createdAt: string;
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
const minutesAgo = (m: number) => new Date(Date.now() - m * 60 * 1000).toISOString();

function buildStore() {
  const troughs: TroughRow[] = [];
  const sensors: SensorRow[] = [];
  const batches: BatchRow[] = [];
  const schedules: ScheduleRow[] = [];

  const activeCodes = ['B-WT-01-MULENDRW', 'B-WT-02-MULENOGI', 'B-WT-03-MUL6NOTU', 'B-WT-04-MULENOTU'];
  const activeIntake = [1540, 1580, 1620, 1660];
  const activeStartedHours = [3.03, 2.2, 3.05, 0.7];

  for (let i = 1; i <= 6; i++) {
    const id = `trough-${String(i).padStart(2, '0')}`;
    const code = `WT-${String(i).padStart(2, '0')}`;
    const status: TroughStatus = i <= 4 ? 'RUNNING' : i === 5 ? 'IDLE' : 'MAINTENANCE';
    troughs.push({
      id,
      code,
      name: `Withering Trough ${i}`,
      factoryId: FACTORY_ID,
      capacityKg: 1800,
      status,
      createdAt: hoursAgo(24 * 30),
      updatedAt: hoursAgo(1),
    });

    for (const def of SENSOR_DEFS) {
      sensors.push({
        id: `sensor-${String(i).padStart(2, '0')}-${def.type}`,
        troughId: id,
        type: def.type,
        label: def.label,
        unit: def.unit,
        minThreshold: def.min,
        maxThreshold: def.max,
        isActive: true,
        value: LIVE[i][def.type],
        decimals: def.decimals,
      });
    }

    const weekday = [1, 2, 3, 4, 5, 6];
    const plan: { name: string; action: ScheduleAction; startTime: string; endTime: string; daysOfWeek: number[]; setpoint: number | null }[] = [
      { name: 'Morning wither', action: 'WITHERING_CYCLE', startTime: '06:00', endTime: '14:00', daysOfWeek: weekday, setpoint: null },
      { name: 'Hot air boost', action: 'HEATER_ON', startTime: '09:00', endTime: '11:30', daysOfWeek: weekday, setpoint: 32 },
      { name: 'Reverse airflow', action: 'REVERSE_AIRFLOW', startTime: '12:00', endTime: '12:30', daysOfWeek: weekday, setpoint: null },
      { name: 'Leaf turning', action: 'LEAF_TURNING', startTime: '10:00', endTime: '10:20', daysOfWeek: [1, 3, 5], setpoint: null },
    ];
    plan.forEach((p, idx) => {
      schedules.push({
        id: `schedule-${String(i).padStart(2, '0')}-${idx + 1}`,
        troughId: id,
        ...p,
        enabled: true,
        lastRunAt: i <= 4 && p.action === 'WITHERING_CYCLE' ? hoursAgo(8) : null,
      });
    });

    if (i <= 4) {
      batches.push({
        id: `batch-active-${i}`,
        code: activeCodes[i - 1],
        troughId: id,
        leafIntakeKg: activeIntake[i - 1],
        initialMoisture: 78,
        targetMoisture: 62,
        finalMoisture: null,
        status: 'WITHERING',
        plannedStartAt: null,
        startedAt: hoursAgo(activeStartedHours[i - 1]),
        endedAt: null,
        notes: null,
        createdAt: hoursAgo(activeStartedHours[i - 1]),
      });
      batches.push({
        id: `batch-done-${i}`,
        code: `B-${code}-PREV${i}`,
        troughId: id,
        leafIntakeKg: 1480 + i * 20,
        initialMoisture: 78,
        targetMoisture: 62,
        finalMoisture: 61.6,
        status: 'COMPLETED',
        plannedStartAt: null,
        startedAt: hoursAgo(24 * 5 + 6),
        endedAt: hoursAgo(24 * 4 + 8),
        notes: null,
        createdAt: hoursAgo(24 * 5 + 6),
      });
    }
  }

  batches.push({
    id: 'batch-planned-5',
    code: 'B-WT-05-PLAN01',
    troughId: 'trough-05',
    leafIntakeKg: 1500,
    initialMoisture: 77.5,
    targetMoisture: 62,
    finalMoisture: null,
    status: 'PLANNED',
    plannedStartAt: hoursAgo(-4),
    startedAt: null,
    endedAt: null,
    notes: 'Afternoon intake from field 12',
    createdAt: hoursAgo(2),
  });
  batches.push({
    id: 'batch-aborted-2',
    code: 'B-WT-02-ABT01',
    troughId: 'trough-02',
    leafIntakeKg: 1320,
    initialMoisture: 79,
    targetMoisture: 62,
    finalMoisture: null,
    status: 'ABORTED',
    plannedStartAt: null,
    startedAt: hoursAgo(24 * 8),
    endedAt: hoursAgo(24 * 8 - 2),
    notes: 'Aborted: uneven spread',
    createdAt: hoursAgo(24 * 8),
  });

  const fan = sensors.find((s) => s.id === 'sensor-04-FAN_SPEED')!;
  const alerts: AlertRow[] = [
    {
      id: 'alert-fan-04',
      troughId: 'trough-04',
      sensorId: fan.id,
      severity: 'WARNING',
      message: `Fan speed above maximum (1550 rpm, limit 1500 rpm)`,
      value: 1550,
      acknowledged: false,
      acknowledgedAt: null,
      acknowledgedBy: null,
      createdAt: minutesAgo(1),
    },
    {
      id: 'alert-hum-02',
      troughId: 'trough-02',
      sensorId: 'sensor-02-HUMIDITY',
      severity: 'WARNING',
      message: 'Relative humidity above maximum (91.4 %RH, limit 90 %RH)',
      value: 91.4,
      acknowledged: true,
      acknowledgedAt: hoursAgo(5),
      acknowledgedBy: { id: 'dev', name: 'System Admin' },
      createdAt: hoursAgo(6),
    },
    {
      id: 'alert-temp-01',
      troughId: 'trough-01',
      sensorId: 'sensor-01-AIR_TEMPERATURE',
      severity: 'INFO',
      message: 'Air temperature recovered inside the normal band',
      value: 28.5,
      acknowledged: true,
      acknowledgedAt: hoursAgo(20),
      acknowledgedBy: { id: 'dev', name: 'System Admin' },
      createdAt: hoursAgo(26),
    },
    {
      id: 'alert-moist-03',
      troughId: 'trough-03',
      sensorId: 'sensor-03-LEAF_MOISTURE',
      severity: 'CRITICAL',
      message: 'Leaf moisture below minimum (50.2 %, limit 52 %)',
      value: 50.2,
      acknowledged: true,
      acknowledgedAt: hoursAgo(30),
      acknowledgedBy: { id: 'dev', name: 'System Admin' },
      createdAt: hoursAgo(32),
    },
  ];

  return { troughs, sensors, batches, schedules, alerts, seq: 100 };
}

const db = buildStore();

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function troughCode(id: string) {
  return db.troughs.find((t) => t.id === id)?.code ?? null;
}

function moistureOf(troughId: string) {
  return db.sensors.find((s) => s.troughId === troughId && s.type === 'LEAF_MOISTURE')?.value ?? null;
}

function enrichBatch(b: BatchRow): Batch {
  const currentMoisture = b.status === 'WITHERING' ? moistureOf(b.troughId) : b.finalMoisture;
  const span = b.initialMoisture - b.targetMoisture;
  const progressPct =
    currentMoisture == null || span === 0 ? null : clamp(((b.initialMoisture - currentMoisture) / span) * 100, 0, 100);
  const elapsedMinutes = b.startedAt
    ? Math.round(((b.endedAt ? new Date(b.endedAt) : new Date()).getTime() - new Date(b.startedAt).getTime()) / 60000)
    : null;
  return { ...b, troughCode: troughCode(b.troughId), currentMoisture, progressPct, elapsedMinutes };
}

function toSensor(s: SensorRow) {
  return {
    id: s.id,
    troughId: s.troughId,
    type: s.type,
    label: s.label,
    unit: s.unit,
    minThreshold: s.minThreshold,
    maxThreshold: s.maxThreshold,
    isActive: s.isActive,
    latest: { value: s.value, recordedAt: new Date().toISOString() },
  };
}

function toTrough(t: TroughRow): TroughWithLive {
  return { ...t, sensors: db.sensors.filter((s) => s.troughId === t.id).map(toSensor) };
}

function toSchedule(s: ScheduleRow): Schedule {
  return { ...s, troughCode: troughCode(s.troughId) };
}

function toAlert(a: AlertRow): Alert {
  const sensor = a.sensorId ? db.sensors.find((s) => s.id === a.sensorId) : undefined;
  return { ...a, troughCode: troughCode(a.troughId), sensorType: sensor?.type ?? null };
}

function factoryNow() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { hhmm: `${get('hour')}:${get('minute')}`, weekday: WEEKDAYS.indexOf(get('weekday')) };
}

function average(type: SensorType, troughIds: string[]) {
  const values = db.sensors.filter((s) => s.type === type && troughIds.includes(s.troughId)).map((s) => s.value);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function overview() {
  const troughs = db.troughs.map(toTrough);
  const active = db.batches.filter((b) => b.status === 'WITHERING').map(enrichBatch);
  const open = db.alerts.filter((a) => !a.acknowledged);
  const runningIds = db.troughs.filter((t) => t.status === 'RUNNING').map((t) => t.id);
  const count = (status: TroughStatus) => db.troughs.filter((t) => t.status === status).length;
  return {
    generatedAt: new Date().toISOString(),
    kpis: {
      troughs: {
        total: troughs.length,
        running: count('RUNNING'),
        idle: count('IDLE'),
        maintenance: count('MAINTENANCE'),
        offline: count('OFFLINE'),
      },
      averages: {
        airTemperature: average('AIR_TEMPERATURE', runningIds),
        leafTemperature: average('LEAF_TEMPERATURE', runningIds),
        humidity: average('HUMIDITY', runningIds),
        leafMoisture: average('LEAF_MOISTURE', runningIds),
      },
      activeBatches: active.length,
      leafInProcessKg: active.reduce((sum, b) => sum + b.leafIntakeKg, 0),
      openAlerts: open.length,
    },
    troughs: troughs.map((t) => ({ ...t, activeBatch: active.find((b) => b.troughId === t.id) ?? null })),
    recentAlerts: open.slice(0, 8).map(toAlert),
  };
}

function listBatches(params: URLSearchParams) {
  const status = params.get('status');
  const troughId = params.get('troughId');
  const limit = Number(params.get('limit') ?? 200);
  return db.batches
    .filter((b) => (!status || b.status === status) && (!troughId || b.troughId === troughId))
    .map(enrichBatch)
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
    .slice(0, limit);
}

function today() {
  const { hhmm, weekday } = factoryNow();
  const items = db.schedules
    .filter((s) => s.enabled && s.daysOfWeek.includes(weekday))
    .map((s) => ({
      ...toSchedule(s),
      state: (hhmm < s.startTime ? 'UPCOMING' : hhmm >= s.endTime ? 'DONE' : 'ACTIVE') as 'UPCOMING' | 'ACTIVE' | 'DONE',
    }))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  return { now: hhmm, weekday, timeZone: TIME_ZONE, items };
}

function listAlerts(params: URLSearchParams) {
  const status = params.get('status') ?? 'all';
  const severity = params.get('severity');
  const troughId = params.get('troughId');
  const limit = Number(params.get('limit') ?? 200);
  return db.alerts
    .filter((a) => {
      if (status === 'open' && a.acknowledged) return false;
      if (status === 'acknowledged' && !a.acknowledged) return false;
      if (severity && a.severity !== severity) return false;
      if (troughId && a.troughId !== troughId) return false;
      return true;
    })
    .map(toAlert)
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
    .slice(0, limit);
}

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function series(params: URLSearchParams): SeriesResponse {
  const sensor = db.sensors.find((s) => s.id === params.get('sensorId'));
  if (!sensor) throw new Error('Unknown sensor');
  const end = Date.now();
  const start = params.get('from') ? new Date(params.get('from')!).getTime() : end - 6 * 60 * 60 * 1000;
  const count = Math.max(20, Number(params.get('points') ?? 180));
  const bucketMs = Math.max(1000, Math.ceil((end - start) / count));
  const amp =
    sensor.type === 'AIRFLOW' ? 900 : sensor.type === 'FAN_SPEED' ? 45 : sensor.type === 'LEAF_WEIGHT' ? 18 : sensor.type === 'HUMIDITY' ? 1.6 : 0.55;
  let seed = hash(sensor.id);
  const next = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const points = Array.from({ length: count }, (_, i) => {
    const phase = i / (count - 1);
    let center = sensor.value;
    if (sensor.type === 'LEAF_MOISTURE') center = 78 - (78 - sensor.value) * phase;
    else if (sensor.type === 'FAN_SPEED' && sensor.value > 1500) center = sensor.value - (1 - phase) * 180;
    else center = sensor.value + Math.sin(phase * Math.PI * 7 + next()) * amp;
    const avg = round(center + (next() - 0.5) * amp * 0.6, sensor.decimals);
    const spread = amp * (0.25 + next() * 0.2);
    return {
      t: new Date(start + i * bucketMs).toISOString(),
      avg,
      min: round(avg - spread, sensor.decimals),
      max: round(avg + spread, sensor.decimals),
    };
  });
  const samples = points.length * 8;
  return {
    sensor: {
      id: sensor.id,
      troughId: sensor.troughId,
      type: sensor.type,
      label: sensor.label,
      unit: sensor.unit,
      minThreshold: sensor.minThreshold,
      maxThreshold: sensor.maxThreshold,
    },
    from: new Date(start).toISOString(),
    to: new Date(end).toISOString(),
    bucketSeconds: Math.round(bucketMs / 1000),
    summary: {
      min: Math.min(...points.map((p) => p.min)),
      max: Math.max(...points.map((p) => p.max)),
      avg: round(points.reduce((sum, p) => sum + p.avg, 0) / points.length, sensor.decimals),
      samples,
    },
    points,
  };
}

const round = (n: number, d: number) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

type Body = Record<string, unknown>;

function requireTrough(id: string) {
  const trough = db.troughs.find((t) => t.id === id);
  if (!trough) throw new Error('Trough not found');
  return trough;
}

/** Handles the same paths the pages request from the API. */
export function demoRequest<T>(path: string, init: { method?: string; json?: unknown } = {}): T {
  const method = (init.method ?? 'GET').toUpperCase();
  const [pathname, search = ''] = path.split('?');
  const params = new URLSearchParams(search);
  const body = (init.json ?? {}) as Body;
  const parts = pathname.split('/').filter(Boolean);

  if (method === 'GET' && pathname === '/dashboard/overview') return overview() as T;
  if (method === 'GET' && pathname === '/troughs') return db.troughs.map(toTrough) as T;
  if (method === 'GET' && parts[0] === 'troughs' && parts.length === 2) {
    return toTrough(requireTrough(parts[1])) as T;
  }
  if (method === 'PATCH' && parts[0] === 'troughs' && parts[2] === 'status') {
    const trough = requireTrough(parts[1]);
    trough.status = body.status as TroughStatus;
    trough.updatedAt = new Date().toISOString();
    return toTrough(trough) as T;
  }

  if (method === 'GET' && pathname === '/batches') return listBatches(params) as T;
  if (method === 'POST' && pathname === '/batches') {
    const trough = requireTrough(String(body.troughId));
    if (body.startNow && db.batches.some((b) => b.troughId === trough.id && b.status === 'WITHERING')) {
      throw new Error(`Trough ${trough.code} already has a withering batch`);
    }
    const now = new Date().toISOString();
    const batch: BatchRow = {
      id: `batch-${++db.seq}`,
      code: `B-${trough.code}-${db.seq.toString(36).toUpperCase()}`,
      troughId: trough.id,
      leafIntakeKg: Number(body.leafIntakeKg),
      initialMoisture: Number(body.initialMoisture),
      targetMoisture: Number(body.targetMoisture),
      finalMoisture: null,
      status: body.startNow ? 'WITHERING' : 'PLANNED',
      plannedStartAt: body.plannedStartAt ? String(body.plannedStartAt) : null,
      startedAt: body.startNow ? now : null,
      endedAt: null,
      notes: body.notes ? String(body.notes) : null,
      createdAt: now,
    };
    db.batches.unshift(batch);
    if (body.startNow) trough.status = 'RUNNING';
    return enrichBatch(batch) as T;
  }
  if (method === 'POST' && parts[0] === 'batches' && parts.length === 3) {
    const batch = db.batches.find((b) => b.id === parts[1]);
    if (!batch) throw new Error('Batch not found');
    const trough = requireTrough(batch.troughId);
    const now = new Date().toISOString();
    if (parts[2] === 'start') {
      if (batch.status !== 'PLANNED') throw new Error(`Cannot start a ${batch.status.toLowerCase()} batch`);
      batch.status = 'WITHERING';
      batch.startedAt = now;
      trough.status = 'RUNNING';
    } else if (parts[2] === 'complete') {
      if (batch.status !== 'WITHERING') throw new Error('Only withering batches can be completed');
      batch.status = 'COMPLETED';
      batch.endedAt = now;
      batch.finalMoisture = moistureOf(batch.troughId);
      trough.status = 'IDLE';
    } else if (parts[2] === 'abort') {
      if (batch.status !== 'PLANNED' && batch.status !== 'WITHERING') throw new Error(`Cannot abort a ${batch.status.toLowerCase()} batch`);
      const wasWithering = batch.status === 'WITHERING';
      batch.status = 'ABORTED';
      batch.endedAt = now;
      if (wasWithering) trough.status = 'IDLE';
    }
    return enrichBatch(batch) as T;
  }

  if (method === 'GET' && pathname === '/schedules/today') return today() as T;
  if (method === 'GET' && pathname === '/schedules') {
    const troughId = params.get('troughId');
    return db.schedules.filter((s) => !troughId || s.troughId === troughId).map(toSchedule) as T;
  }
  if (method === 'POST' && pathname === '/schedules') {
    const trough = requireTrough(String(body.troughId));
    const row: ScheduleRow = {
      id: `schedule-${++db.seq}`,
      troughId: trough.id,
      name: String(body.name),
      action: body.action as ScheduleAction,
      startTime: String(body.startTime),
      endTime: String(body.endTime),
      daysOfWeek: body.daysOfWeek as number[],
      setpoint: body.setpoint == null ? null : Number(body.setpoint),
      enabled: Boolean(body.enabled),
      lastRunAt: null,
    };
    db.schedules.push(row);
    return toSchedule(row) as T;
  }
  if ((method === 'PATCH' || method === 'DELETE') && parts[0] === 'schedules' && parts.length === 2) {
    const idx = db.schedules.findIndex((s) => s.id === parts[1]);
    if (idx < 0) throw new Error('Schedule not found');
    if (method === 'DELETE') {
      db.schedules.splice(idx, 1);
      return undefined as T;
    }
    const row = db.schedules[idx];
    if ('name' in body) row.name = String(body.name);
    if ('action' in body) row.action = body.action as ScheduleAction;
    if ('startTime' in body) row.startTime = String(body.startTime);
    if ('endTime' in body) row.endTime = String(body.endTime);
    if ('daysOfWeek' in body) row.daysOfWeek = body.daysOfWeek as number[];
    if ('setpoint' in body) row.setpoint = body.setpoint == null ? null : Number(body.setpoint);
    if ('enabled' in body) row.enabled = Boolean(body.enabled);
    return toSchedule(row) as T;
  }

  if (method === 'GET' && pathname === '/alerts') return listAlerts(params) as T;
  if (method === 'POST' && parts[0] === 'alerts' && parts[2] === 'acknowledge') {
    const alert = db.alerts.find((a) => a.id === parts[1]);
    if (!alert) throw new Error('Alert not found');
    alert.acknowledged = true;
    alert.acknowledgedAt = new Date().toISOString();
    alert.acknowledgedBy = { id: 'dev', name: 'System Admin' };
    return toAlert(alert) as T;
  }

  if (method === 'PATCH' && parts[0] === 'sensors' && parts.length === 2) {
    const sensor = db.sensors.find((s) => s.id === parts[1]);
    if (!sensor) throw new Error('Sensor not found');
    sensor.minThreshold = body.minThreshold == null ? null : Number(body.minThreshold);
    sensor.maxThreshold = body.maxThreshold == null ? null : Number(body.maxThreshold);
    return toSensor(sensor) as T;
  }

  if (method === 'GET' && pathname === '/telemetry/series') return series(params) as T;

  throw new Error(`No demo data for ${method} ${pathname}`);
}
