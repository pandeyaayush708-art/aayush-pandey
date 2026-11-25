import React, { useState } from 'react';
import { motion } from 'motion/react';

export interface ChartPoint {
  label: string;
  value: number;
}

export const TrendAreaChart: React.FC<{
  data: ChartPoint[];
  unit?: string;
  height?: number;
  strokeColor?: string;
  fillColor?: string;
}> = ({ data, unit = 'L', height = 210, strokeColor = '#2D6A4F', fillColor = '#2D6A4F' }) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex h-44 items-center justify-center text-xs text-[#7A827E]">
        No chart data available for selected range.
      </div>
    );
  }

  const width = 640;
  const padL = 42;
  const padR = 16;
  const padT = 18;
  const padB = 30;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const maxVal = Math.max(...data.map((d) => d.value), 1) * 1.15;
  const minVal = 0;

  const getX = (i: number) =>
    data.length === 1 ? padL + plotW / 2 : padL + (i / (data.length - 1)) * plotW;
  const getY = (v: number) => padT + plotH - ((v - minVal) / (maxVal - minVal || 1)) * plotH;

  const points = data.map((d, i) => ({ x: getX(i), y: getY(d.value), ...d }));
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padT + plotH} L ${points[0].x} ${
    padT + plotH
  } Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    val: Math.round(maxVal * f * 10) / 10,
    y: padT + plotH - f * plotH,
  }));

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={padL}
              y1={t.y}
              x2={width - padR}
              y2={t.y}
              stroke="#ECE8DF"
              strokeDasharray="3 3"
            />
            <text
              x={padL - 8}
              y={t.y + 3}
              textAnchor="end"
              className="fill-[#7A827E] text-[10px] tabular-nums"
            >
              {t.val}
            </text>
          </g>
        ))}

        <path d={areaPath} fill={fillColor} fillOpacity={0.09} />
        <motion.path
          d={linePath}
          fill="none"
          stroke={strokeColor}
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        />

        {points.map((p, i) => {
          const showLabel =
            data.length <= 8 ||
            i === 0 ||
            i === data.length - 1 ||
            i % Math.ceil(data.length / 6) === 0;
          return (
            <g key={i}>
              {showLabel && (
                <text
                  x={p.x}
                  y={height - 8}
                  textAnchor="middle"
                  className="fill-[#7A827E] text-[10px]"
                >
                  {p.label}
                </text>
              )}
              <circle
                cx={p.x}
                cy={p.y}
                r={hoverIdx === i ? 5 : 3.2}
                fill={hoverIdx === i ? '#1B4332' : '#FFFFFF'}
                stroke={strokeColor}
                strokeWidth={2}
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
              />
            </g>
          );
        })}

        {hoverIdx !== null && points[hoverIdx] && (
          <g>
            <rect
              x={Math.min(Math.max(points[hoverIdx].x - 52, 8), width - 114)}
              y={Math.max(points[hoverIdx].y - 42, 4)}
              width={106}
              height={32}
              rx={5}
              fill="#1F2421"
            />
            <text
              x={Math.min(Math.max(points[hoverIdx].x - 52, 8), width - 114) + 53}
              y={Math.max(points[hoverIdx].y - 42, 4) + 14}
              textAnchor="middle"
              className="fill-[#B7C99C] text-[9.5px] font-medium"
            >
              {points[hoverIdx].label}
            </text>
            <text
              x={Math.min(Math.max(points[hoverIdx].x - 52, 8), width - 114) + 53}
              y={Math.max(points[hoverIdx].y - 42, 4) + 26}
              textAnchor="middle"
              className="fill-white text-[11px] font-bold tabular-nums"
            >
              {points[hoverIdx].value} {unit}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};

export const BarComparisonChart: React.FC<{
  data: { label: string; value: number; highlight?: boolean }[];
  unit?: string;
  height?: number;
}> = ({ data, unit = 'L', height = 200 }) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-xs text-[#7A827E]">
        No data to display.
      </div>
    );
  }
  const width = 620;
  const padL = 36;
  const padR = 14;
  const padT = 18;
  const padB = 34;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const maxVal = Math.max(...data.map((d) => d.value), 1) * 1.15;
  const barGap = 8;
  const barW = Math.max(12, Math.min(44, plotW / data.length - barGap));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
      <line x1={padL} y1={padT + plotH} x2={width - padR} y2={padT + plotH} stroke="#E4E1D8" />
      {data.map((d, i) => {
        const slotW = plotW / data.length;
        const x = padL + i * slotW + (slotW - barW) / 2;
        const barH = (d.value / maxVal) * plotH;
        const y = padT + plotH - barH;
        const fill = d.highlight ? '#B45309' : hoverIdx === i ? '#1B4332' : '#2D6A4F';
        return (
          <g
            key={d.label}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
            className="cursor-pointer"
          >
            <motion.rect
              x={x}
              width={barW}
              rx={3}
              fill={fill}
              initial={{ y: padT + plotH, height: 0 }}
              animate={{ y, height: barH }}
              transition={{ duration: 0.3, delay: i * 0.02 }}
            />
            <text
              x={x + barW / 2}
              y={y - 5}
              textAnchor="middle"
              className="fill-[#3F4742] text-[10px] font-medium tabular-nums"
            >
              {d.value}
            </text>
            <text
              x={x + barW / 2}
              y={height - 12}
              textAnchor="middle"
              className="fill-[#5C6660] text-[10px]"
            >
              {d.label}
            </text>
            {hoverIdx === i && (
              <title>
                {d.label}: {d.value} {unit}
              </title>
            )}
          </g>
        );
      })}
    </svg>
  );
};
