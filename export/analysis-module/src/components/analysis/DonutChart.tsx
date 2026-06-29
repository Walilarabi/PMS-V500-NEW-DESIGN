/**
 * FLOWTYM — Donut / Pie chart
 */

import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

export interface DonutChartProps {
  data: DonutSlice[];
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  centerLabel?: string;
  centerValue?: string;
  unitFormatter?: (value: number) => string;
  variant?: 'donut' | 'pie';
}

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

export const DonutChart: React.FC<DonutChartProps> = ({
  data, height = 260, innerRadius = 60, outerRadius = 90,
  centerLabel, centerValue, unitFormatter, variant = 'donut',
}) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  const fmt = unitFormatter ?? ((v: number) => `${v}`);

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={variant === 'pie' ? 0 : innerRadius}
            outerRadius={outerRadius}
            paddingAngle={variant === 'pie' ? 0 : 2}
            strokeWidth={1}
            stroke="#FFFFFF"
          >
            {data.map((d) => (
              <Cell key={d.key} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 12 }}
            formatter={(value: number, name: string) => {
              const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
              return [`${fmt(value)} (${pct}%)`, name];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            iconType="circle"
            layout="vertical"
            align="right"
            verticalAlign="middle"
          />
        </PieChart>
      </ResponsiveContainer>
      {variant === 'donut' && (centerLabel || centerValue) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {centerValue && <div className="text-xl font-extrabold text-gray-900 tabular-nums">{centerValue}</div>}
          {centerLabel && <div className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">{centerLabel}</div>}
        </div>
      )}
    </div>
  );
};
