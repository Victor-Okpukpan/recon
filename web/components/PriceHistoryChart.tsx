"use client";

import { useMemo, useRef, useState } from "react";

interface PricePoint {
  t: number;
  p: number;
}

export interface PriceSeries {
  label: string;
  color: "emerald" | "rose";
  points: PricePoint[];
}

const SERIES_COLOR: Record<PriceSeries["color"], string> = {
  emerald: "oklch(0.72 0.19 155)",
  rose: "oklch(0.65 0.22 25)",
};

const CHART_W = 600;
const CHART_H = 180;
const PAD_TOP = 12;
const PAD_BOTTOM = 24;
const PAD_LEFT = 4;
const PAD_RIGHT = 4;

/** Collapses raw CLOB samples down to the points where price actually changed by more
 * than a rounding-noise epsilon, dropping the runs of near-identical ticks in between.
 * Paired with step interpolation below, this renders as a genuine staircase — flat
 * while a price held, a sharp vertical jump exactly where it moved — instead of a
 * fuzzy diagonal ramp through hundreds of sub-percent bid/ask flickers. */
function toSteps(points: PricePoint[], epsilon = 0.005): PricePoint[] {
  if (points.length === 0) return points;
  const steps: PricePoint[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    if (Math.abs(points[i].p - steps[steps.length - 1].p) > epsilon) {
      steps.push(points[i]);
    }
  }
  const last = points[points.length - 1];
  if (steps[steps.length - 1] !== last) steps.push(last);
  return steps;
}

/** "Step-after" path: hold the previous value flat until the new sample's timestamp, then jump. */
function stepPath(points: PricePoint[], scaleX: (t: number) => number, scaleY: (p: number) => number): string {
  if (points.length === 0) return "";
  let d = `M${scaleX(points[0].t).toFixed(2)},${scaleY(points[0].p).toFixed(2)}`;
  for (let i = 1; i < points.length; i++) {
    const x = scaleX(points[i].t).toFixed(2);
    const yPrev = scaleY(points[i - 1].p).toFixed(2);
    const y = scaleY(points[i].p).toFixed(2);
    d += ` L${x},${yPrev} L${x},${y}`;
  }
  return d;
}

function nearestPoint(points: PricePoint[], t: number): PricePoint | null {
  if (points.length === 0) return null;
  let closest = points[0];
  let bestDelta = Math.abs(points[0].t - t);
  for (const pt of points) {
    const delta = Math.abs(pt.t - t);
    if (delta < bestDelta) {
      bestDelta = delta;
      closest = pt;
    }
  }
  return closest;
}

export function PriceHistoryChart({ series }: { series: PriceSeries[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverT, setHoverT] = useState<number | null>(null);

  const nonEmpty = series.filter((s) => s.points.length > 0).map((s) => ({ ...s, points: toSteps(s.points) }));

  // Price axis is fixed to 0–100%, not auto-zoomed to the data's actual range. Yes/No are
  // complementary (Yes + No ≈ 1), so an auto-zoomed axis can make them look like two
  // unrelated bands that never approach each other — a fixed axis renders any real
  // crossing at its true position, with a 50% line falling out for free as the midpoint.
  const minP = 0;
  const maxP = 1;

  const { scaleX, scaleY, minT, maxT } = useMemo(() => {
    const allPoints = nonEmpty.flatMap((s) => s.points);
    if (allPoints.length === 0) {
      return { scaleX: (_t: number) => 0, scaleY: (_p: number) => 0, minT: 0, maxT: 1 };
    }
    const times = allPoints.map((pt) => pt.t);
    const minT = Math.min(...times);
    const maxT = Math.max(...times);
    const timeRange = maxT - minT || 1;

    const innerW = CHART_W - PAD_LEFT - PAD_RIGHT;
    const innerH = CHART_H - PAD_TOP - PAD_BOTTOM;

    const scaleX = (t: number) => PAD_LEFT + ((t - minT) / timeRange) * innerW;
    const scaleY = (p: number) => PAD_TOP + innerH - ((p - minP) / (maxP - minP)) * innerH;

    return { scaleX, scaleY, minT, maxT };
  }, [nonEmpty]);

  if (nonEmpty.length === 0) {
    return <p className="text-sm text-muted-foreground">No price history available yet.</p>;
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverT(minT + relX * (maxT - minT));
  }

  const gridLines = [minP, (minP + maxP) / 2, maxP];
  const hoveredPerSeries = hoverT !== null ? nonEmpty.map((s) => ({ series: s, point: nearestPoint(s.points, hoverT) })) : [];

  return (
    <div className="space-y-2">
      {nonEmpty.length > 1 && (
        <div className="flex gap-4 text-xs">
          {nonEmpty.map((s) => (
            <span key={s.label} className="flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: SERIES_COLOR[s.color] }} />
              <span className="text-muted-foreground">{s.label}</span>
            </span>
          ))}
        </div>
      )}

      <div ref={containerRef} className="relative w-full" onPointerMove={handlePointerMove} onPointerLeave={() => setHoverT(null)}>
        <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full" preserveAspectRatio="none" role="img" aria-label="Outcome price history">
          {gridLines.map((g) => (
            <line
              key={g}
              x1={PAD_LEFT}
              x2={CHART_W - PAD_RIGHT}
              y1={scaleY(g)}
              y2={scaleY(g)}
              stroke={g === 0.5 && nonEmpty.length > 1 ? "oklch(1 0 0 / 18%)" : "oklch(1 0 0 / 8%)"}
              strokeDasharray={g === 0.5 && nonEmpty.length > 1 ? "3 3" : undefined}
              strokeWidth={1}
            />
          ))}

          {nonEmpty.map((s) => (
            <path
              key={s.label}
              d={stepPath(s.points, scaleX, scaleY)}
              fill="none"
              stroke={SERIES_COLOR[s.color]}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {hoverT !== null && (
            <>
              <line x1={scaleX(hoverT)} x2={scaleX(hoverT)} y1={PAD_TOP} y2={CHART_H - PAD_BOTTOM} stroke="oklch(1 0 0 / 20%)" strokeWidth={1} />
              {hoveredPerSeries.map(
                ({ series: s, point }) =>
                  point && (
                    <circle
                      key={s.label}
                      cx={scaleX(point.t)}
                      cy={scaleY(point.p)}
                      r={4}
                      fill={SERIES_COLOR[s.color]}
                      stroke="var(--card)"
                      strokeWidth={2}
                    />
                  )
              )}
            </>
          )}
        </svg>

        {hoverT !== null && hoveredPerSeries.some((h) => h.point) && (
          <div
            className="pointer-events-none absolute top-0 space-y-0.5 rounded-md border border-white/10 bg-popover px-2 py-1 text-xs shadow-lg"
            style={{
              left: `${(scaleX(hoverT) / CHART_W) * 100}%`,
              transform: scaleX(hoverT) > CHART_W / 2 ? "translateX(-100%)" : undefined,
            }}
          >
            {hoveredPerSeries.map(
              ({ series: s, point }) =>
                point && (
                  <div key={s.label} className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="h-0.5 w-2.5 rounded-full" style={{ backgroundColor: SERIES_COLOR[s.color] }} />
                    <span className="font-mono font-semibold text-foreground">{Math.round(point.p * 100)}%</span>
                    <span className="text-muted-foreground">{s.label}</span>
                  </div>
                )
            )}
            <div className="text-muted-foreground">{new Date(hoverT * 1000).toLocaleDateString()}</div>
          </div>
        )}
      </div>

      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{new Date(minT * 1000).toLocaleDateString()}</span>
        <div className="flex gap-3 font-mono">
          {nonEmpty.map((s) => {
            const last = s.points[s.points.length - 1];
            return (
              <span key={s.label}>
                {s.label} now: <span className="font-semibold text-foreground">{Math.round(last.p * 100)}%</span>
              </span>
            );
          })}
        </div>
        <span>{new Date(maxT * 1000).toLocaleDateString()}</span>
      </div>
    </div>
  );
}
