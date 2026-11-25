import React from 'react';
import type { NodeMetricPoint } from '../utils/api-client';
import { toPolylinePoints } from '../utils/chart';

const WIDTH = 600;
const HEIGHT = 180;
const PAD_LEFT = 36;
const PAD = 10;
const PLOT_WIDTH = WIDTH - PAD_LEFT - PAD;
const PLOT_HEIGHT = HEIGHT - PAD * 2;
const GRID_LINES = [0, 25, 50, 75, 100];

export function MetricsChart({ metrics }: { metrics: NodeMetricPoint[] }): React.ReactElement {
  if (metrics.length < 2) {
    return <p className="muted">Aún no hay suficientes métricas para graficar.</p>;
  }

  const ordered = [...metrics].reverse();
  const cpuPoints = toPolylinePoints(ordered.map((m) => m.cpuPercent), PLOT_WIDTH, PLOT_HEIGHT);
  const ramPoints = toPolylinePoints(ordered.map((m) => m.memoryPercent), PLOT_WIDTH, PLOT_HEIGHT);

  return (
    <figure className="chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`CPU y RAM de las últimas ${ordered.length} lecturas`}
      >
        <g transform={`translate(${PAD_LEFT} ${PAD})`}>
          {GRID_LINES.map((value) => {
            const y = PLOT_HEIGHT - (value / 100) * PLOT_HEIGHT;
            return (
              <g key={value}>
                <line className="chart-grid" x1={0} x2={PLOT_WIDTH} y1={y} y2={y} />
                <text className="chart-axis" x={-8} y={y} textAnchor="end" dominantBaseline="middle">
                  {value}%
                </text>
              </g>
            );
          })}
          <polyline className="chart-line chart-cpu" points={cpuPoints} />
          <polyline className="chart-line chart-ram" points={ramPoints} />
        </g>
      </svg>
      <figcaption className="chart-legend">
        <span className="chart-key chart-cpu">CPU %</span>
        <span className="chart-key chart-ram">RAM %</span>
        <span className="muted">Últimas {ordered.length} lecturas, de la más antigua a la más reciente</span>
      </figcaption>
    </figure>
  );
}
