import { fmtNumber } from '@/lib/format';

interface GaugeProps {
  value: number | null;
  min: number;
  max: number;
  lowThreshold?: number | null;
  highThreshold?: number | null;
  label: string;
  unit: string;
  color: string;
  decimals?: number;
}

const START_DEG = 135;
const SWEEP_DEG = 270;
const CX = 100;
const CY = 100;
const R = 78;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function point(deg: number, r = R) {
  const rad = (deg * Math.PI) / 180;
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)] as const;
}

function arc(fromFrac: number, toFrac: number, r = R) {
  const a1 = START_DEG + SWEEP_DEG * fromFrac;
  const a2 = START_DEG + SWEEP_DEG * toFrac;
  const [x1, y1] = point(a1, r);
  const [x2, y2] = point(a2, r);
  const large = a2 - a1 > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

/** 270° radial gauge with the acceptable threshold band drawn on an inner track. */
export function Gauge({ value, min, max, lowThreshold, highThreshold, label, unit, color, decimals = 1 }: GaugeProps) {
  const frac = (v: number) => clamp01((v - min) / (max - min));
  const inRange =
    value === null ||
    ((lowThreshold == null || value >= lowThreshold) && (highThreshold == null || value <= highThreshold));
  const valueColor = inRange ? color : '#ef4444';

  const bandFrom = frac(lowThreshold ?? min);
  const bandTo = frac(highThreshold ?? max);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 172" className="w-full max-w-[180px]" role="img" aria-label={`${label}: ${value ?? 'no data'} ${unit}`}>
        <path d={arc(0, 1)} fill="none" stroke="var(--chart-track)" strokeWidth={14} strokeLinecap="round" />
        <path d={arc(bandFrom, bandTo, R - 14)} fill="none" stroke="#10b98155" strokeWidth={3} strokeLinecap="round" />
        {value !== null && (
          <path
            d={arc(0, Math.max(0.005, frac(value)))}
            fill="none"
            stroke={valueColor}
            strokeWidth={14}
            strokeLinecap="round"
            style={{ transition: 'all 0.6s ease' }}
          />
        )}
        <text x={CX} y={CY + 2} textAnchor="middle" className="fill-slate-50" style={{ fontSize: 30, fontWeight: 600 }}>
          {fmtNumber(value, decimals)}
        </text>
        <text x={CX} y={CY + 24} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 13 }}>
          {unit}
        </text>
        <text x={point(START_DEG)[0] + 4} y={168} textAnchor="middle" className="fill-slate-500" style={{ fontSize: 10 }}>
          {min}
        </text>
        <text x={point(START_DEG + SWEEP_DEG)[0] - 4} y={168} textAnchor="middle" className="fill-slate-500" style={{ fontSize: 10 }}>
          {max}
        </text>
      </svg>
      <p className="-mt-2 text-xs font-medium text-slate-300">{label}</p>
    </div>
  );
}
