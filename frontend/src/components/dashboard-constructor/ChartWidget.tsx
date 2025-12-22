'use client';

import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { ChartType, ChartWidgetConfig } from '@/types/dashboard';

interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number;
}

interface ChartWidgetProps {
  data: ChartDataPoint[];
  config: ChartWidgetConfig;
  dataKey?: string;
}

// Default color palette
const DEFAULT_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
];

/**
 * Chart widget supporting line, bar, pie, and area charts
 */
export function ChartWidget({ data, config, dataKey = 'value' }: ChartWidgetProps) {
  const colors = config.colors || DEFAULT_COLORS;

  const commonProps = {
    data,
    margin: { top: 10, right: 30, left: 0, bottom: 0 },
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      {renderChart(config.chart_type, commonProps, config, colors, dataKey)}
    </ResponsiveContainer>
  );
}

function renderChart(
  type: ChartType,
  commonProps: { data: ChartDataPoint[]; margin: object },
  config: ChartWidgetConfig,
  colors: string[],
  dataKey: string
) {
  switch (type) {
    case 'line':
      return (
        <LineChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            label={
              config.x_axis_label ? { value: config.x_axis_label, position: 'bottom' } : undefined
            }
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            label={
              config.y_axis_label
                ? { value: config.y_axis_label, angle: -90, position: 'left' }
                : undefined
            }
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
            }}
          />
          {config.show_legend && <Legend />}
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={colors[0]}
            strokeWidth={2}
            dot={config.show_labels}
          />
        </LineChart>
      );

    case 'bar':
      return (
        <BarChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
            }}
          />
          {config.show_legend && <Legend />}
          <Bar dataKey={dataKey} fill={colors[0]} radius={[4, 4, 0, 0]}>
            {commonProps.data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      );

    case 'pie':
      return (
        <PieChart>
          <Pie
            data={commonProps.data}
            cx="50%"
            cy="50%"
            labelLine={config.show_labels}
            label={config.show_labels ? renderPieLabel : undefined}
            outerRadius={80}
            fill="#8884d8"
            dataKey={dataKey}
          >
            {commonProps.data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
            }}
          />
          {config.show_legend && <Legend />}
        </PieChart>
      );

    case 'area':
      return (
        <AreaChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
            }}
          />
          {config.show_legend && <Legend />}
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={colors[0]}
            fill={colors[0]}
            fillOpacity={0.3}
          />
        </AreaChart>
      );

    default:
      return (
        <BarChart {...commonProps}>
          <Bar dataKey={dataKey} fill={colors[0]} />
        </BarChart>
      );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderPieLabel(props: any) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;

  if (
    typeof cx !== 'number' ||
    typeof cy !== 'number' ||
    typeof midAngle !== 'number' ||
    typeof innerRadius !== 'number' ||
    typeof outerRadius !== 'number' ||
    typeof percent !== 'number'
  ) {
    return null;
  }

  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      fontSize={12}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export default ChartWidget;
