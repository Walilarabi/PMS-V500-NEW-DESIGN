/**
 * FLOWTYM — Trend Chart (line / area)
 *
 * Wrapper Recharts pour les courbes d'évolution avec optionnellement
 * une série de comparaison (N-1, budget, forecast).
 */

import React from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, AreaChart, Area,
} from 'recharts';

export interface TrendSeries {
  key: string;
  label: string;
  color: string;
  area?: boolean;
  dashed?: boolean;
}

export interface TrendChartProps {
  data: Array<Record<string, number | string>>;
  xKey: string;
  series: TrendSeries[];
  yTickFormatter?: (value: number) => string;
  xTickFormatter?: (value: string) => string;
  height?: number;
  variant?: 'line' | 'area';
}

export const TrendChart: React.FC<TrendChartProps> = ({
  data, xKey, series, yTickFormatter, xTickFormatter, height = 280, variant = 'line',
}) => {
  if (variant === 'area') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            {series.map(s => (
              <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis dataKey={xKey} stroke="#94A3B8" fontSize={11} tickFormatter={xTickFormatter} />
          <YAxis stroke="#94A3B8" fontSize={11} tickFormatter={yTickFormatter} width={50} />
          <Tooltip
            contentStyle={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 12 }}
            formatter={(v: number) => yTickFormatter ? yTickFormatter(v) : v}
          />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" />
          {series.map(s => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray={s.dashed ? '4 3' : undefined}
              fill={`url(#grad-${s.key})`}
              activeDot={{ r: 4 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
        <XAxis dataKey={xKey} stroke="#94A3B8" fontSize={11} tickFormatter={xTickFormatter} />
        <YAxis stroke="#94A3B8" fontSize={11} tickFormatter={yTickFormatter} width={50} />
        <Tooltip
          contentStyle={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 12 }}
          formatter={(v: number) => yTickFormatter ? yTickFormatter(v) : v}
        />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" />
        {series.map(s => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={s.dashed ? 1.5 : 2.5}
            strokeDasharray={s.dashed ? '5 3' : undefined}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
};
