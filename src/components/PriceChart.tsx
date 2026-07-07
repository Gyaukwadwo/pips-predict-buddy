import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getChart } from "@/lib/forex.functions";

type Overlay = {
  entry?: number | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
  resistance?: number[];
  support?: number[];
};

export function PriceChart({
  pair,
  decimals,
  overlay,
}: {
  pair: string;
  decimals: number;
  overlay?: Overlay;
}) {
  const chart = useServerFn(getChart);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["chart", pair],
    queryFn: () => chart({ data: { pair, range: "3mo" } }),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) return <div className="h-56 animate-pulse rounded-lg bg-muted" />;
  if (isError)
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive-foreground">
        Chart failed: {(error as Error).message}
      </div>
    );
  if (!data) return null;

  const w = 640;
  const h = 220;
  const padL = 8, padR = 56, padT = 8, padB = 20;
  const iw = w - padL - padR;
  const ih = h - padT - padB;

  const candles = data.candles;
  if (!candles.length) return null;

  // y range: include overlay lines
  const extraY: number[] = [];
  const push = (v: number | null | undefined) => {
    if (v != null && Number.isFinite(v) && v > 0) extraY.push(v);
  };
  push(overlay?.entry);
  push(overlay?.stopLoss);
  push(overlay?.takeProfit);
  overlay?.resistance?.forEach(push);
  overlay?.support?.forEach(push);

  let yMin = Math.min(...candles.map((c) => c.l), ...extraY);
  let yMax = Math.max(...candles.map((c) => c.h), ...extraY);
  const pad = (yMax - yMin) * 0.08 || yMax * 0.01 || 1;
  yMin -= pad;
  yMax += pad;
  const ySpan = yMax - yMin || 1;

  const n = candles.length;
  const bw = Math.max(1.2, iw / n - 1);
  const x = (i: number) => padL + (i + 0.5) * (iw / n);
  const y = (v: number) => padT + ih - ((v - yMin) / ySpan) * ih;

  const fmt = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  // gridline ticks (5)
  const ticks: number[] = [];
  for (let i = 0; i <= 4; i++) ticks.push(yMin + (ySpan * i) / 4);

  // SMA polylines
  const line = (arr: (number | null)[], stroke: string) => {
    const pts: string[] = [];
    arr.forEach((v, i) => {
      if (v == null) return;
      pts.push(`${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    });
    if (!pts.length) return null;
    return <polyline points={pts.join(" ")} fill="none" stroke={stroke} strokeWidth="1.4" />;
  };

  const overlayLine = (v: number | null | undefined, color: string, label: string, dashed = false) => {
    if (v == null || !Number.isFinite(v) || v <= 0) return null;
    const yy = y(v);
    return (
      <g>
        <line
          x1={padL}
          x2={padL + iw}
          y1={yy}
          y2={yy}
          stroke={color}
          strokeWidth="1"
          strokeDasharray={dashed ? "3 3" : undefined}
          opacity="0.85"
        />
        <text x={padL + iw + 4} y={yy + 3} fontSize="9" fill={color} fontFamily="ui-monospace, monospace">
          {label} {fmt(v)}
        </text>
      </g>
    );
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background/40 p-2">
      <div className="mb-1 flex items-center justify-between px-1 text-[10px] text-muted-foreground">
        <span className="font-mono uppercase tracking-widest">{pair} · daily · 3M</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3" style={{ backgroundColor: "var(--primary)" }} /> SMA20</span>
          <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3" style={{ backgroundColor: "var(--neutral)" }} /> SMA50</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        {/* gridlines */}
        {ticks.map((tv, i) => (
          <g key={i}>
            <line x1={padL} x2={padL + iw} y1={y(tv)} y2={y(tv)} stroke="var(--border)" strokeWidth="0.5" opacity="0.5" />
            <text x={padL + iw + 4} y={y(tv) + 3} fontSize="9" fill="var(--muted-foreground)" fontFamily="ui-monospace, monospace">
              {fmt(tv)}
            </text>
          </g>
        ))}

        {/* candles */}
        {candles.map((c, i) => {
          const up = c.c >= c.o;
          const color = up ? "var(--bull)" : "var(--bear)";
          const xc = x(i);
          const yo = y(c.o), yc = y(c.c);
          const bodyTop = Math.min(yo, yc);
          const bodyH = Math.max(0.8, Math.abs(yc - yo));
          return (
            <g key={i}>
              <line x1={xc} x2={xc} y1={y(c.h)} y2={y(c.l)} stroke={color} strokeWidth="0.8" />
              <rect x={xc - bw / 2} y={bodyTop} width={bw} height={bodyH} fill={color} />
            </g>
          );
        })}

        {/* SMAs */}
        {line(data.sma20, "var(--primary)")}
        {line(data.sma50, "var(--neutral)")}

        {/* overlays: support/resistance faint */}
        {overlay?.resistance?.map((v, i) => (
          <g key={`r${i}`}>{overlayLine(v, "var(--bear)", "R", true)}</g>
        ))}
        {overlay?.support?.map((v, i) => (
          <g key={`s${i}`}>{overlayLine(v, "var(--bull)", "S", true)}</g>
        ))}

        {/* signal levels solid */}
        {overlayLine(overlay?.entry, "var(--foreground)", "Entry")}
        {overlayLine(overlay?.stopLoss, "var(--bear)", "SL")}
        {overlayLine(overlay?.takeProfit, "var(--bull)", "TP")}
      </svg>
    </div>
  );
}
