'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

interface Slice {
  name: string;
  value: number;
  color: string;
}

interface Props {
  slices: Slice[];
  centerLabel: string;
  centerValue: string;
  legend?: boolean;
}

export function StatusDonut({ slices, centerLabel, centerValue, legend = false }: Props) {
  const data = slices.filter((s) => s.value > 0);
  const all  = slices; // keep all for legend even if 0

  return (
    <div>
      <div className="relative h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data.length > 0 ? data : [{ name: 'Empty', value: 1, color: '#1e293b' }]}
              dataKey="value"
              nameKey="name"
              innerRadius="68%"
              outerRadius="95%"
              paddingAngle={2}
              stroke="none"
            >
              {(data.length > 0 ? data : [{ name: 'Empty', value: 1, color: '#1e293b' }]).map((s) => (
                <Cell key={s.name} fill={s.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: 'var(--chart-tooltip-bg)',
                color: 'var(--chart-tooltip-fg)',
                border: '1px solid var(--chart-tooltip-border)',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Center label */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-slate-50">{centerValue}</span>
          <span className="text-[11px] uppercase tracking-wide text-slate-500">{centerLabel}</span>
        </div>
      </div>

      {/* Legend row */}
      {legend && (
        <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2 border-t border-slate-800 pt-3">
          {all.map((s) => (
            <span key={s.name} className="flex items-center gap-1.5 text-xs text-slate-400">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="font-medium" style={{ color: s.color }}>{s.value}</span>
              <span className="text-slate-500">{s.name}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
