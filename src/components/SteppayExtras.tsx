import { useEffect, useState } from "react";

export function RotatingTaglines() {
  const items = [
    { k: "AI-DRIVEN MARKET ANALYST" },
    { k: "TRADE SMART" },
    { k: "TRADE SECURE" },
    { k: "TRADE AHEAD" },
  ];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % items.length), 2200);
    return () => clearInterval(t);
  }, [items.length]);
  return (
    <div className="mx-auto mt-10 flex max-w-3xl flex-wrap items-center justify-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-muted-foreground">
      {items.map((it, idx) => (
        <span
          key={it.k}
          className={`rounded-full border px-3 py-1.5 transition-all ${
            i === idx
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-card"
          }`}
        >
          {it.k}
        </span>
      ))}
    </div>
  );
}

export function StepsSection() {
  const steps = [
    {
      n: "01",
      title: "Pick a market",
      body: "Choose any forex pair, metal, crypto, index or stock — or type a custom ticker like EURJPY or SOLUSD.",
    },
    {
      n: "02",
      title: "Run the AI read",
      body: "Pipwise pulls 6 months of candles, computes RSI, moving averages and ATR, then reasons through the setup.",
    },
    {
      n: "03",
      title: "Get a structured trade",
      body: "Receive a bias, entry, stop-loss, take-profit and confidence score — with a rationale you can actually read.",
    },
    {
      n: "04",
      title: "Time your entry",
      body: "Predict the right moment to enter using hourly candles, with trigger conditions and invalidation levels.",
    },
  ];
  return (
    <section className="mx-auto max-w-7xl px-6 py-20">
      <div className="mb-10 flex items-end justify-between gap-6">
        <h2 className="max-w-2xl text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl">
          4 Simple Steps
        </h2>
        <p className="hidden max-w-sm text-sm text-muted-foreground md:block">
          From market pick to timed entry, Pipwise walks you through a
          disciplined, data-first workflow.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s) => (
          <div
            key={s.n}
            className="group flex flex-col justify-between rounded-3xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_50px_-20px_rgba(0,0,0,0.15)]"
          >
            <div className="mb-16 font-mono text-xs tracking-widest text-muted-foreground">
              {s.n}
            </div>
            <div>
              <h3 className="text-xl font-bold tracking-tight">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {s.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function FeaturesSection() {
  const features = [
    {
      title: "Multi-Market Coverage",
      body: "Forex majors, metals, crypto, indices, volatility gauges and single-stock tickers — all in one place.",
    },
    {
      title: "Artificial Intelligence",
      body: "A reasoning model reads price action, momentum and volatility to produce a structured, explainable trade idea.",
    },
    {
      title: "Real-Time Charts",
      body: "Intraday candlestick charts with SMA overlays and rendered entry, stop and target levels on top of price.",
    },
    {
      title: "Custom Tickers",
      body: "Not on the list? Paste any Yahoo-compatible ticker (EURJPY, XPTUSD, SOLUSD) and analyze it instantly.",
    },
  ];
  return (
    <section className="border-t border-border bg-secondary/40">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="max-w-3xl text-3xl font-black leading-tight tracking-tight sm:text-4xl md:text-5xl">
          No matter the market or timeframe, Pipwise helps you find the trade
          and time the entry.
        </h2>
        <p className="mt-4 max-w-2xl text-base text-muted-foreground">
          Blend real-time analytics with AI reasoning to make sharper, more
          disciplined trading decisions across every asset class.
        </p>
        <div className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-3xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="bg-card p-6">
              <div className="mb-8 h-10 w-10 rounded-full bg-foreground/90" />
              <h3 className="text-lg font-bold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function BeyondBordersSection() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
        Pipwise
      </p>
      <h2 className="mx-auto mt-4 max-w-5xl text-6xl font-black leading-[0.95] tracking-tight sm:text-7xl md:text-8xl">
        Trade <span className="italic font-serif">Beyond</span> Borders
      </h2>
      <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground">
        Global markets, one intelligent workspace. From New York opens to Tokyo
        fixes — Pipwise is on call, 24/5.
      </p>
      <a
        href="#markets"
        className="mt-10 inline-flex items-center gap-2 rounded-full bg-foreground px-8 py-4 text-sm font-semibold text-background transition hover:opacity-90"
      >
        Get Started
        <span aria-hidden>→</span>
      </a>
    </section>
  );
}

export function SiteFooter() {
  const cols: { title: string; items: string[] }[] = [
    {
      title: "Product",
      items: ["Markets", "Analyze", "Custom Tickers", "Saved Pairs", "Entry Timing"],
    },
    {
      title: "Use Cases",
      items: ["Day Trading", "Swing Trading", "Risk Management", "Market Research"],
    },
    {
      title: "Company",
      items: ["About", "Careers", "Coverage", "Contact"],
    },
    {
      title: "Legal",
      items: ["Terms of Use", "Privacy", "Disclaimer", "Cookies", "Security"],
    },
    {
      title: "Resources",
      items: ["Blog", "Documentation", "API Reference", "Partners"],
    },
  ];
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_3fr]">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-background">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M3 17l6-6 4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M14 7h7v7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="text-lg font-extrabold tracking-tight">Pipwise</span>
            </div>
            <p className="mt-4 max-w-sm text-sm text-muted-foreground">
              AI-powered technical analysis for the modern trader.
              Educational tool — not investment advice.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
            {cols.map((c) => (
              <div key={c.title}>
                <h4 className="text-xs font-semibold uppercase tracking-widest text-foreground">
                  {c.title}
                </h4>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {c.items.map((it) => (
                    <li key={it}>
                      <a href="#" className="hover:text-foreground">
                        {it}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} Pipwise. All rights reserved.</span>
          <span>Built for traders who read the tape.</span>
        </div>
      </div>
    </footer>
  );
}
