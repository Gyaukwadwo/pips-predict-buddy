import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/700.css";
import { analyzePair, getSnapshot, type ForexAnalysis } from "@/lib/forex.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pipwise — AI Forex Analyst" },
      {
        name: "description",
        content:
          "Free AI-powered technical analysis of major forex pairs, gold, silver and crypto. Trend, key levels, indicators and entry signals.",
      },
      { property: "og:title", content: "Pipwise — AI Forex Analyst" },
      {
        property: "og:description",
        content: "Trend read, key levels, and AI entry signals for FX, metals and crypto.",
      },
    ],
  }),
  component: Index,
});

const PAIRS = [
  { key: "EURUSD", label: "EUR / USD", group: "Majors" },
  { key: "GBPUSD", label: "GBP / USD", group: "Majors" },
  { key: "USDJPY", label: "USD / JPY", group: "Majors" },
  { key: "USDCHF", label: "USD / CHF", group: "Majors" },
  { key: "AUDUSD", label: "AUD / USD", group: "Majors" },
  { key: "USDCAD", label: "USD / CAD", group: "Majors" },
  { key: "NZDUSD", label: "NZD / USD", group: "Majors" },
  { key: "XAUUSD", label: "XAU / USD", group: "Metals" },
  { key: "XAGUSD", label: "XAG / USD", group: "Metals" },
  { key: "BTCUSD", label: "BTC / USD", group: "Crypto" },
  { key: "ETHUSD", label: "ETH / USD", group: "Crypto" },
] as const;

type PairKey = (typeof PAIRS)[number]["key"];

function fmt(n: number | null | undefined, d = 4) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}

function Sparkline({ data, up }: { data: number[]; up: boolean }) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const w = 120, h = 32;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / span) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const color = up ? "var(--bull)" : "var(--bear)";
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function PairCard({
  pairKey,
  label,
  selected,
  onSelect,
}: {
  pairKey: PairKey;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const snapshot = useServerFn(getSnapshot);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["snap", pairKey],
    queryFn: () => snapshot({ data: { pair: pairKey } }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const change = data?.changePct1d ?? 0;
  const up = change >= 0;

  return (
    <button
      onClick={onSelect}
      className={`group relative flex flex-col gap-3 rounded-xl border bg-card p-4 text-left transition-all hover:border-primary/60 hover:-translate-y-0.5 ${
        selected ? "border-primary shadow-[0_0_0_1px_var(--glow),0_10px_40px_-10px_var(--glow)]" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{pairKey}</div>
          <div className="mt-0.5 text-sm font-medium">{label}</div>
        </div>
        <span
          className="rounded-md px-1.5 py-0.5 font-mono text-[11px] font-medium"
          style={{
            color: up ? "var(--bull)" : "var(--bear)",
            backgroundColor: up ? "oklch(0.78 0.19 155 / 0.12)" : "oklch(0.68 0.22 25 / 0.12)",
          }}
        >
          {up ? "+" : ""}
          {change.toFixed(2)}%
        </span>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="font-mono text-2xl font-semibold tracking-tight">
          {isLoading ? <span className="text-muted-foreground">…</span> : isError ? "—" : fmt(data?.price, pairKey === "USDJPY" ? 3 : pairKey.startsWith("BTC") || pairKey.startsWith("ETH") || pairKey.startsWith("XAU") || pairKey.startsWith("XAG") ? 2 : 4)}
        </div>
        {data && <Sparkline data={data.spark} up={up} />}
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="font-mono">RSI {data?.rsi14 ? data.rsi14.toFixed(0) : "—"}</span>
        <span className="font-mono">7d {data ? `${data.changePct7d >= 0 ? "+" : ""}${data.changePct7d.toFixed(1)}%` : "—"}</span>
      </div>
    </button>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "bull" | "bear" | "neutral" }) {
  const color = tone === "bull" ? "var(--bull)" : tone === "bear" ? "var(--bear)" : "var(--foreground)";
  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-base font-semibold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function AnalysisPanel({
  pairKey,
  label,
  onClose,
}: {
  pairKey: PairKey;
  label: string;
  onClose: () => void;
}) {
  const analyze = useServerFn(analyzePair);
  const mut = useMutation<ForexAnalysis, Error, void>({
    mutationFn: () => analyze({ data: { pair: pairKey } }),
  });

  const a = mut.data;
  const bias = a?.signal.bias;
  const biasTone = bias === "long" ? "bull" : bias === "short" ? "bear" : "neutral";
  const decimals = pairKey === "USDJPY" ? 3 : ["XAUUSD", "XAGUSD", "BTCUSD", "ETHUSD"].includes(pairKey) ? 2 : 4;

  return (
    <aside className="sticky top-4 flex h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card/80 backdrop-blur">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Selected</div>
          <div className="text-lg font-semibold">
            {label} <span className="text-muted-foreground">·</span>{" "}
            <span className="font-mono text-primary">{pairKey}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
        >
          Close
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        {!a && !mut.isPending && (
          <div className="rounded-xl border border-dashed border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Run an AI-powered technical read on <span className="font-mono text-foreground">{pairKey}</span>.
              Pipwise pulls the last 6 months of daily candles, computes moving averages, RSI and ATR,
              and asks the model for a structured trade evaluation.
            </p>
            <button
              onClick={() => mut.mutate()}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[0_0_20px_var(--glow)] hover:brightness-110"
            >
              <span className="h-2 w-2 rounded-full bg-primary-foreground" />
              Analyze market
            </button>
          </div>
        )}

        {mut.isPending && (
          <div className="space-y-3">
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
            <div className="h-20 animate-pulse rounded-lg bg-muted" />
            <div className="h-32 animate-pulse rounded-lg bg-muted" />
            <p className="text-xs text-muted-foreground">
              Fetching market data and reasoning through the setup…
            </p>
          </div>
        )}

        {mut.isError && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-foreground">
            <div className="font-semibold">Analysis failed</div>
            <div className="mt-1 opacity-80">{mut.error.message}</div>
            <button
              onClick={() => mut.mutate()}
              className="mt-3 rounded border border-destructive/50 px-3 py-1 text-xs"
            >
              Retry
            </button>
          </div>
        )}

        {a && (
          <>
            {/* Signal badge */}
            <div
              className="rounded-xl border p-4"
              style={{
                borderColor:
                  biasTone === "bull"
                    ? "oklch(0.78 0.19 155 / 0.4)"
                    : biasTone === "bear"
                    ? "oklch(0.68 0.22 25 / 0.4)"
                    : "var(--border)",
                background:
                  biasTone === "bull"
                    ? "oklch(0.78 0.19 155 / 0.08)"
                    : biasTone === "bear"
                    ? "oklch(0.68 0.22 25 / 0.08)"
                    : "transparent",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Signal</div>
                <div className="font-mono text-[11px] text-muted-foreground">
                  conf {a.signal.confidence}/100
                </div>
              </div>
              <div className="mt-1 flex items-baseline gap-3">
                <span
                  className="text-2xl font-bold uppercase tracking-tight"
                  style={{
                    color:
                      biasTone === "bull"
                        ? "var(--bull)"
                        : biasTone === "bear"
                        ? "var(--bear)"
                        : "var(--foreground)",
                  }}
                >
                  {bias === "no-trade" ? "No trade" : bias}
                </span>
                <span className="font-mono text-sm text-muted-foreground">
                  R:R {a.signal.riskRewardRatio ? a.signal.riskRewardRatio.toFixed(2) : "—"}
                </span>
              </div>
              {bias !== "no-trade" && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Metric label="Entry" value={fmt(a.signal.entry, decimals)} />
                  <Metric label="Stop" value={fmt(a.signal.stopLoss, decimals)} tone="bear" />
                  <Metric label="Target" value={fmt(a.signal.takeProfit, decimals)} tone="bull" />
                </div>
              )}
              <p className="mt-3 text-sm leading-relaxed text-foreground/90">{a.signal.rationale}</p>
            </div>

            {/* Trend */}
            <section>
              <h3 className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Trend</h3>
              <div className="rounded-lg border border-border bg-background/40 p-3">
                <div className="flex items-center gap-2 text-sm">
                  <span
                    className="rounded px-1.5 py-0.5 font-mono text-[11px] uppercase"
                    style={{
                      color:
                        a.trend.direction === "bullish"
                          ? "var(--bull)"
                          : a.trend.direction === "bearish"
                          ? "var(--bear)"
                          : "var(--neutral)",
                      backgroundColor: "var(--secondary)",
                    }}
                  >
                    {a.trend.direction}
                  </span>
                  <span className="text-xs text-muted-foreground">· {a.trend.strength}</span>
                </div>
                <p className="mt-2 text-sm text-foreground/90">{a.trend.summary}</p>
              </div>
            </section>

            {/* Levels */}
            <section>
              <h3 className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Key levels</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-background/40 p-3">
                  <div className="text-[10px] uppercase text-muted-foreground">Resistance</div>
                  <ul className="mt-1 space-y-0.5 font-mono text-sm" style={{ color: "var(--bear)" }}>
                    {a.keyLevels.resistance.map((v, i) => (
                      <li key={i}>{fmt(v, decimals)}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-border bg-background/40 p-3">
                  <div className="text-[10px] uppercase text-muted-foreground">Support</div>
                  <ul className="mt-1 space-y-0.5 font-mono text-sm" style={{ color: "var(--bull)" }}>
                    {a.keyLevels.support.map((v, i) => (
                      <li key={i}>{fmt(v, decimals)}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            {/* Indicators */}
            <section>
              <h3 className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Indicators</h3>
              <div className="space-y-2 text-sm">
                <div className="rounded-lg border border-border bg-background/40 p-3">
                  <div className="text-[10px] uppercase text-muted-foreground">RSI (14)</div>
                  <p className="mt-1 text-foreground/90">{a.indicators.rsiRead}</p>
                </div>
                <div className="rounded-lg border border-border bg-background/40 p-3">
                  <div className="text-[10px] uppercase text-muted-foreground">Moving averages</div>
                  <p className="mt-1 text-foreground/90">{a.indicators.maRead}</p>
                </div>
                <div className="rounded-lg border border-border bg-background/40 p-3">
                  <div className="text-[10px] uppercase text-muted-foreground">Volatility (ATR 14)</div>
                  <p className="mt-1 text-foreground/90">{a.indicators.volatilityRead}</p>
                </div>
              </div>
            </section>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Data as of {new Date(a.asOf).toLocaleDateString()}</span>
              <button
                onClick={() => mut.mutate()}
                className="rounded border border-border px-2 py-1 hover:bg-accent"
              >
                Re-analyze
              </button>
            </div>

            <p className="border-t border-border pt-3 text-[10px] leading-relaxed text-muted-foreground">
              {a.disclaimer} Pipwise is an educational tool. Not investment advice.
            </p>
          </>
        )}
      </div>
    </aside>
  );
}

function Index() {
  const router = useRouter();
  const [selected, setSelected] = useState<PairKey | null>(null);
  const groups = Array.from(new Set(PAIRS.map((p) => p.group)));
  const selectedLabel = PAIRS.find((p) => p.key === selected)?.label ?? "";

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border/60 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/40">
              <span className="absolute inset-0 rounded-lg bg-primary/10 blur-md" />
              <svg viewBox="0 0 24 24" className="relative h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--primary)" }}>
                <path d="M3 17l6-6 4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M14 7h7v7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Pipwise</h1>
              <p className="text-[11px] text-muted-foreground">AI forex analyst · daily technical read</p>
            </div>
          </div>
          <button
            onClick={() => router.invalidate()}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
          >
            Refresh prices
          </button>
        </div>
      </header>

      {/* Body */}
      <main className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[1fr_420px]">
        <div>
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-foreground">Markets</h2>
            <p className="text-xs text-muted-foreground">
              Click a pair to get an AI trade evaluation with entry, stop-loss and take-profit.
            </p>
          </div>

          <div className="space-y-6">
            {groups.map((g) => (
              <div key={g}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{g}</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {PAIRS.filter((p) => p.group === g).map((p) => (
                    <PairCard
                      key={p.key}
                      pairKey={p.key}
                      label={p.label}
                      selected={selected === p.key}
                      onSelect={() => setSelected(p.key)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:block">
          {selected ? (
            <AnalysisPanel
              key={selected}
              pairKey={selected}
              label={selectedLabel}
              onClose={() => setSelected(null)}
            />
          ) : (
            <div className="sticky top-4 flex h-[calc(100vh-2rem)] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/30 p-8 text-center">
              <div className="mb-3 h-10 w-10 rounded-full bg-primary/15 ring-1 ring-primary/40" />
              <h3 className="text-base font-semibold">Select a pair</h3>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                Pick any pair on the left to run a fresh AI-powered technical analysis and a
                structured trade idea.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
