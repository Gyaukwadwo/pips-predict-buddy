import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/700.css";
import { analyzePair, getSnapshot, predictEntryTiming, type ForexAnalysis, type EntryTiming } from "@/lib/forex.functions";
import { useSession } from "@/lib/use-session";
import { supabase } from "@/integrations/supabase/client";
import { PriceChart } from "@/components/PriceChart";
import { FluidCursor } from "@/components/FluidCursor";
import chromeMascot from "@/assets/chrome-mascot.png";
import {
  RotatingTaglines,
  StepsSection,
  FeaturesSection,
  BeyondBordersSection,
  SiteFooter,
} from "@/components/SteppayExtras";

function pairDecimals(pair: string): number {
  const p = pair.toUpperCase();
  if (p === "USDJPY" || p.endsWith("JPY=X") || p === "JPY=X") return 3;
  // FX 6-letter pairs
  if (/^[A-Z]{6}$/.test(p) && !["BTCUSD", "ETHUSD", "XAUUSD", "XAGUSD", "XPTUSD", "XPDUSD"].includes(p)) return 4;
  return 2;
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Forexhavmercy — AI Forex Analyst" },
      {
        name: "description",
        content:
          "Free AI-powered technical analysis of major forex pairs, gold, silver and crypto. Trend, key levels, indicators and entry signals.",
      },
      { property: "og:title", content: "Forexhavmercy — AI Forex Analyst" },
      {
        property: "og:description",
        content: "Free AI-powered technical analysis of major forex pairs, gold, silver and crypto. Trend, key levels, indicators and entry signals.",
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
  { key: "VIX", label: "VIX · CBOE Volatility", group: "Indices & Volatility" },
  { key: "SPX500", label: "S&P 500", group: "Indices & Volatility" },
  { key: "NAS100", label: "Nasdaq 100", group: "Indices & Volatility" },
  { key: "US30", label: "Dow 30", group: "Indices & Volatility" },
  { key: "DXY", label: "US Dollar Index", group: "Indices & Volatility" },
  { key: "GER40", label: "DAX 40", group: "Indices & Volatility" },
  { key: "AAPL", label: "Apple", group: "Stocks" },
  { key: "MSFT", label: "Microsoft", group: "Stocks" },
  { key: "NVDA", label: "NVIDIA", group: "Stocks" },
  { key: "TSLA", label: "Tesla", group: "Stocks" },
  { key: "AMZN", label: "Amazon", group: "Stocks" },
  { key: "GOOGL", label: "Alphabet", group: "Stocks" },
  { key: "META", label: "Meta", group: "Stocks" },
] as const;

type PairKey = string;

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
          {isLoading ? <span className="text-muted-foreground">…</span> : isError ? "—" : fmt(data?.price, pairDecimals(pairKey))}
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
  const predictTiming = useServerFn(predictEntryTiming);
  const qc = useQueryClient();
  const { session } = useSession();
  const mut = useMutation<ForexAnalysis, Error, void>({
    mutationFn: () => analyze({ data: { pair: pairKey } }),
  });
  const timingMut = useMutation<EntryTiming, Error, void>({
    mutationFn: () => predictTiming({ data: { pair: pairKey } }),
  });
  const saveMut = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error("Sign in to save pairs");
      const { error } = await supabase.from("user_pairs").insert({
        user_id: session.user.id,
        pair: pairKey,
        label,
      });
      if (error && error.code !== "23505") throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-pairs", session?.user.id] }),
  });


  const a = mut.data;
  const bias = a?.signal.bias;
  const biasTone = bias === "long" ? "bull" : bias === "short" ? "bear" : "neutral";
  const decimals = pairDecimals(pairKey);

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
        <div className="flex items-center gap-2">
          {session && (
            <button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending || saveMut.isSuccess}
              className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/15 disabled:opacity-60"
              title="Save this pair to your list"
            >
              {saveMut.isSuccess ? "Saved" : saveMut.isPending ? "…" : "★ Save"}
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
          >
            Close
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        {/* Chart is always visible; overlays populate after analysis */}
        <PriceChart
          pair={pairKey}
          decimals={decimals}
          overlay={
            a
              ? {
                  entry: a.signal.bias !== "no-trade" ? a.signal.entry : null,
                  stopLoss: a.signal.bias !== "no-trade" ? a.signal.stopLoss : null,
                  takeProfit: a.signal.bias !== "no-trade" ? a.signal.takeProfit : null,
                  resistance: a.keyLevels.resistance,
                  support: a.keyLevels.support,
                }
              : undefined
          }
        />

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

            {/* Entry timing predictor */}
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground">Entry timing</h3>
                {timingMut.data && (
                  <button
                    onClick={() => timingMut.mutate()}
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    Re-predict
                  </button>
                )}
              </div>

              {!timingMut.data && !timingMut.isPending && !timingMut.isError && (
                <button
                  onClick={() => timingMut.mutate()}
                  className="w-full rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground hover:border-primary/60 hover:text-foreground"
                >
                  Predict the right time to enter (uses hourly candles)
                </button>
              )}

              {timingMut.isPending && (
                <div className="h-24 animate-pulse rounded-lg bg-muted" />
              )}

              {timingMut.isError && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive-foreground">
                  Timing prediction failed: {timingMut.error.message}
                  <button
                    onClick={() => timingMut.mutate()}
                    className="ml-2 rounded border border-destructive/50 px-2 py-0.5"
                  >
                    Retry
                  </button>
                </div>
              )}

              {timingMut.data && (() => {
                const t = timingMut.data;
                const tone = t.bias === "long" ? "bull" : t.bias === "short" ? "bear" : "neutral";
                const color =
                  tone === "bull" ? "var(--bull)" : tone === "bear" ? "var(--bear)" : "var(--foreground)";
                const label: Record<typeof t.action, string> = {
                  enter_now: "Enter now",
                  wait_pullback: "Wait for pullback",
                  wait_breakout: "Wait for breakout",
                  wait_confirmation: "Wait for confirmation",
                  avoid: "Avoid",
                };
                return (
                  <div className="rounded-lg border border-border bg-background/40 p-3">
                    <div className="flex items-center justify-between">
                      <span
                        className="rounded px-2 py-0.5 font-mono text-[11px] uppercase"
                        style={{ color, backgroundColor: "var(--secondary)" }}
                      >
                        {label[t.action]}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        conf {t.confidence}/100
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Metric label="Trigger" value={fmt(t.triggerPrice, decimals)} tone={tone} />
                      <Metric label="Window" value={t.window} />
                    </div>
                    <div className="mt-3 space-y-2 text-sm">
                      <div>
                        <div className="text-[10px] uppercase text-muted-foreground">Condition</div>
                        <p className="text-foreground/90">{t.triggerCondition}</p>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-muted-foreground">Invalidation</div>
                        <p className="text-foreground/90">{t.invalidation}</p>
                      </div>
                      <p className="text-foreground/80">{t.reasoning}</p>
                    </div>
                  </div>
                );
              })()}
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

type SavedPair = { id: string; pair: string; label: string | null };

function AuthSlot() {
  const { session } = useSession();
  if (!session) {
    return (
      <Link
        to="/auth"
        className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/15"
      >
        Sign in
      </Link>
    );
  }
  const email = session.user.email ?? "Account";
  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-xs text-muted-foreground sm:inline">{email}</span>
      <button
        onClick={async () => {
          await supabase.auth.signOut();
        }}
        className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
      >
        Sign out
      </button>
    </div>
  );
}

function CustomPairSlot({ onOpen }: { onOpen: (pair: string) => void }) {
  const [value, setValue] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = value.trim().toUpperCase();
    if (!/^[A-Z0-9.\-=^]{3,15}$/.test(v)) {
      setErr("Use a ticker like EURJPY, SOLUSD, XPTUSD.");
      return;
    }
    setErr(null);
    onOpen(v);
  }

  return (
    <form
      onSubmit={submit}
      className="mb-6 rounded-xl border border-border bg-card/50 p-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Analyze any pair</h3>
          <p className="text-[11px] text-muted-foreground">
            Type any Yahoo-compatible ticker (e.g. EURJPY, CHFJPY, SOLUSD, XPTUSD).
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          placeholder="EURJPY"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm uppercase outline-none focus:border-primary"
          maxLength={15}
        />
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[0_0_20px_var(--glow)] hover:brightness-110"
        >
          Analyze
        </button>
      </div>
      {err && <p className="mt-2 text-xs text-destructive-foreground">{err}</p>}
    </form>
  );
}

function SavedPairsSection({
  selected,
  onSelect,
}: {
  selected: PairKey | null;
  onSelect: (p: string) => void;
}) {
  const { session, ready } = useSession();
  const qc = useQueryClient();
  const userId = session?.user.id;

  const { data: saved } = useQuery({
    queryKey: ["saved-pairs", userId],
    queryFn: async (): Promise<SavedPair[]> => {
      const { data, error } = await supabase
        .from("user_pairs")
        .select("id, pair, label")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SavedPair[];
    },
    enabled: !!userId,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_pairs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-pairs", userId] }),
  });

  if (!ready) return null;
  if (!session) return null;
  if (!saved || saved.length === 0) {
    return (
      <div className="mb-6 rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
        Your saved pairs will appear here. Open any pair and hit “Save”.
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Your pairs</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {saved.map((s) => (
          <div
            key={s.id}
            className={`group relative flex items-center justify-between rounded-xl border bg-card p-3 ${
              selected === s.pair ? "border-primary" : "border-border"
            }`}
          >
            <button
              onClick={() => onSelect(s.pair)}
              className="flex-1 text-left"
            >
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Saved</div>
              <div className="font-mono text-sm font-semibold">{s.pair}</div>
              {s.label && <div className="text-[11px] text-muted-foreground">{s.label}</div>}
            </button>
            <button
              onClick={() => remove.mutate(s.id)}
              title="Remove"
              className="rounded border border-border px-2 py-1 text-[10px] text-muted-foreground opacity-0 hover:bg-accent group-hover:opacity-100"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Index() {
  const router = useRouter();
  const [selected, setSelected] = useState<PairKey | null>(null);
  const groups = Array.from(new Set(PAIRS.map((p) => p.group)));
  const selectedLabel =
    PAIRS.find((p) => p.key === selected)?.label ?? (selected ? "Custom pair" : "");

  return (
    <div className="relative min-h-screen">
      <FluidCursor />
      <div className="relative z-10">
      <header className="px-6 pt-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-background">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M3 17l6-6 4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M14 7h7v7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-lg font-extrabold tracking-tight">Pipwise</span>
          </div>
          <nav className="hidden items-center gap-2 rounded-full border border-border bg-card px-2 py-1.5 shadow-sm md:flex">
            <a href="#markets" className="rounded-full px-3 py-1.5 text-sm font-medium text-foreground/80 hover:bg-accent">Markets</a>
            <a href="#analyze" className="rounded-full px-3 py-1.5 text-sm font-medium text-foreground/80 hover:bg-accent">Analyze</a>
            <a href="#saved" className="rounded-full px-3 py-1.5 text-sm font-medium text-foreground/80 hover:bg-accent">Saved</a>
          </nav>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.invalidate()}
              className="hidden rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground/80 shadow-sm hover:bg-accent sm:inline-flex"
            >
              Refresh
            </button>
            <AuthSlot />
          </div>
        </div>
      </header>

      <section className="px-6 pt-12 pb-10 text-center">
        <div className="mx-auto mb-6 w-40 sm:w-56 md:w-64 mascot-float">
          <img
            src={chromeMascot}
            alt="Pipwise chrome mascot waving hello"
            width={1024}
            height={1024}
            className="h-auto w-full drop-shadow-[0_20px_40px_rgba(0,0,0,0.15)]"
          />
        </div>
        <h1 className="mx-auto max-w-4xl text-5xl font-black tracking-tight sm:text-6xl md:text-7xl">
          Trade Smarter
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
          Step up your trading with AI-powered technical analysis. Make data-driven
          decisions with Pipwise's prescriptive market intelligence.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <a
            href="#markets"
            className="rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background shadow-sm transition hover:opacity-90"
          >
            Get Started
          </a>
          <a
            href="#analyze"
            className="rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground shadow-sm hover:bg-accent"
          >
            Analyze a pair
          </a>
        </div>
        <RotatingTaglines />
      </section>



      <main className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[1fr_420px]">
        <div>
          <div id="analyze">
            <CustomPairSlot onOpen={(p) => setSelected(p)} />
          </div>
          <div id="saved">
            <SavedPairsSection selected={selected} onSelect={(p) => setSelected(p)} />
          </div>

          <div id="markets" className="mb-4 scroll-mt-6">
            <h2 className="text-2xl font-extrabold tracking-tight">Markets</h2>
            <p className="text-sm text-muted-foreground">
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
                Pick any pair, or type your own ticker above, to run a fresh AI-powered technical
                analysis and a structured trade idea.
              </p>
            </div>
          )}
        </div>
      </main>

      <StepsSection />
      <FeaturesSection />
      <BeyondBordersSection />
      <SiteFooter />
      </div>
    </div>


  );
}
