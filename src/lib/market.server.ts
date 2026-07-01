// Fetches daily OHLC candles from Yahoo Finance and computes indicators.

export type Candle = { t: number; o: number; h: number; l: number; c: number };

export type PairKey =
  | "EURUSD"
  | "GBPUSD"
  | "USDJPY"
  | "USDCHF"
  | "AUDUSD"
  | "USDCAD"
  | "NZDUSD"
  | "XAUUSD"
  | "XAGUSD"
  | "BTCUSD"
  | "ETHUSD";

const YAHOO_SYMBOL: Record<PairKey, string> = {
  EURUSD: "EURUSD=X",
  GBPUSD: "GBPUSD=X",
  USDJPY: "JPY=X",
  USDCHF: "CHF=X",
  AUDUSD: "AUDUSD=X",
  USDCAD: "CAD=X",
  NZDUSD: "NZDUSD=X",
  XAUUSD: "GC=F",
  XAGUSD: "SI=F",
  BTCUSD: "BTC-USD",
  ETHUSD: "ETH-USD",
};

export const ALL_PAIRS: PairKey[] = [
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "USDCHF",
  "AUDUSD",
  "USDCAD",
  "NZDUSD",
  "XAUUSD",
  "XAGUSD",
  "BTCUSD",
  "ETHUSD",
];

export async function fetchCandles(pair: PairKey, range = "6mo"): Promise<Candle[]> {
  const sym = YAHOO_SYMBOL[pair];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    sym,
  )}?interval=1d&range=${range}`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`Market data failed for ${pair}: ${res.status}`);
  const json = (await res.json()) as {
    chart: {
      result: {
        timestamp: number[];
        indicators: {
          quote: { open: (number | null)[]; high: (number | null)[]; low: (number | null)[]; close: (number | null)[] }[];
        };
      }[];
    };
  };
  const r = json.chart.result[0];
  const q = r.indicators.quote[0];
  const out: Candle[] = [];
  for (let i = 0; i < r.timestamp.length; i++) {
    const o = q.open[i], h = q.high[i], l = q.low[i], c = q.close[i];
    if (o == null || h == null || l == null || c == null) continue;
    out.push({ t: r.timestamp[i] * 1000, o, h, l, c });
  }
  return out;
}

export async function fetchIntraday(
  pair: PairKey,
  interval: "60m" | "30m" | "15m" = "60m",
  range = "1mo",
): Promise<Candle[]> {
  const sym = YAHOO_SYMBOL[pair];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    sym,
  )}?interval=${interval}&range=${range}`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`Intraday data failed for ${pair}: ${res.status}`);
  const json = (await res.json()) as {
    chart: {
      result: {
        timestamp: number[];
        indicators: {
          quote: { open: (number | null)[]; high: (number | null)[]; low: (number | null)[]; close: (number | null)[] }[];
        };
      }[];
    };
  };
  const r = json.chart.result[0];
  const q = r.indicators.quote[0];
  const out: Candle[] = [];
  for (let i = 0; i < r.timestamp.length; i++) {
    const o = q.open[i], h = q.high[i], l = q.low[i], c = q.close[i];
    if (o == null || h == null || l == null || c == null) continue;
    out.push({ t: r.timestamp[i] * 1000, o, h, l, c });
  }
  return out;
}

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  let s = 0;
  for (let i = values.length - period; i < values.length; i++) s += values[i];
  return s / period;
}

function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgG = gains / period;
  const avgL = losses / period;
  if (avgL === 0) return 100;
  const rs = avgG / avgL;
  return 100 - 100 / (1 + rs);
}

function atr(candles: Candle[], period = 14): number | null {
  if (candles.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = candles.length - period; i < candles.length; i++) {
    const c = candles[i], p = candles[i - 1];
    trs.push(Math.max(c.h - c.l, Math.abs(c.h - p.c), Math.abs(c.l - p.c)));
  }
  return trs.reduce((a, b) => a + b, 0) / period;
}

export type Analysis = {
  pair: PairKey;
  price: number;
  changePct1d: number;
  changePct7d: number;
  changePct30d: number;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
  atr14: number | null;
  high20: number;
  low20: number;
  high60: number;
  low60: number;
  asOf: string;
};

export function summarize(pair: PairKey, candles: Candle[]): Analysis {
  const closes = candles.map((c) => c.c);
  const last = candles[candles.length - 1];
  const back = (n: number) => candles[Math.max(0, candles.length - 1 - n)]?.c ?? last.c;
  const slice = (n: number) => candles.slice(-n);
  const s20 = slice(20), s60 = slice(60);
  return {
    pair,
    price: last.c,
    changePct1d: ((last.c - back(1)) / back(1)) * 100,
    changePct7d: ((last.c - back(7)) / back(7)) * 100,
    changePct30d: ((last.c - back(30)) / back(30)) * 100,
    sma20: sma(closes, 20),
    sma50: sma(closes, 50),
    sma200: sma(closes, 200),
    rsi14: rsi(closes, 14),
    atr14: atr(candles, 14),
    high20: Math.max(...s20.map((x) => x.h)),
    low20: Math.min(...s20.map((x) => x.l)),
    high60: Math.max(...s60.map((x) => x.h)),
    low60: Math.min(...s60.map((x) => x.l)),
    asOf: new Date(last.t).toISOString(),
  };
}
