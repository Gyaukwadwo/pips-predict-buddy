import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Wraps an AI-endpoint handler so any internal failure is logged server-side
 * but the client only sees a generic, safe message. Prevents leaking env-var
 * names, upstream HTTP status codes, or internal thresholds to the UI.
 */
function safeAiHandler<T>(label: string, fn: () => Promise<T>): Promise<T> {
  return fn().catch((err) => {
    console.error(`[${label}] internal error:`, err);
    // Preserve auth-gate rejections so the UI can prompt sign-in.
    const msg = err instanceof Error ? err.message : String(err);
    if (/^Unauthorized/i.test(msg)) {
      throw new Error("Please sign in to run AI analysis.");
    }
    throw new Error("Analysis unavailable right now. Please try again in a moment.");
  });
}

const PairInput = z
  .string()
  .trim()
  .min(3)
  .max(15)
  .regex(/^[A-Za-z0-9.\-=^]+$/, "Invalid ticker")
  .transform((s) => s.toUpperCase());


function extractJson(text: string): unknown {
  let s = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = s.search(/[\{\[]/);
  const end = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
  if (start === -1 || end === -1) throw new Error("No JSON in AI response");
  s = s.substring(start, end + 1);
  try { return JSON.parse(s); } catch {
    return JSON.parse(s.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]").replace(/[\x00-\x1F\x7F]/g, ""));
  }
}

const AnalysisSchema = z.object({
  trend: z.object({
    direction: z.enum(["bullish", "bearish", "neutral"]),
    strength: z.enum(["weak", "moderate", "strong"]),
    summary: z.string().describe("One-sentence trend read from moving averages and price action."),
  }),
  keyLevels: z.object({
    resistance: z.array(z.number()).describe("1-3 nearby resistance prices, nearest first."),
    support: z.array(z.number()).describe("1-3 nearby support prices, nearest first."),
  }),
  indicators: z.object({
    rsiRead: z.string().describe("Interpretation of the RSI value (overbought/oversold/neutral, momentum)."),
    maRead: z.string().describe("What SMA20/50/200 alignment says about trend."),
    volatilityRead: z.string().describe("What the ATR value implies for stop/target sizing."),
  }),
  signal: z.object({
    bias: z.enum(["long", "short", "no-trade"]),
    entry: z.number().describe("Recommended entry price. Use current price if 0."),
    stopLoss: z.number().describe("Stop-loss price. Use 0 if no-trade."),
    takeProfit: z.number().describe("Take-profit price. Use 0 if no-trade."),
    riskRewardRatio: z.number().describe("Absolute value of (TP-entry)/(entry-SL). 0 if no-trade."),
    confidence: z.number().describe("Confidence 0-100."),
    rationale: z.string().describe("2-3 sentences justifying the trade idea."),
  }),
  disclaimer: z.string(),
});

export type ForexAnalysis = z.infer<typeof AnalysisSchema> & {
  pair: string;
  price: number;
  asOf: string;
};

export const analyzePair = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ pair: PairInput }).parse(raw))
  .handler(({ data }): Promise<ForexAnalysis> => safeAiHandler("analyzePair", async () => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const { fetchCandles, summarize } = await import("./market.server");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");

    const candles = await fetchCandles(data.pair, "6mo");
    if (candles.length < 30) throw new Error("Not enough market data");
    const s = summarize(data.pair, candles);

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const fmt = (n: number | null, d = 5) => (n == null ? "n/a" : n.toFixed(d));
    const context = [
      `Pair: ${data.pair}`,
      `As of: ${s.asOf}`,
      `Price: ${fmt(s.price)}`,
      `Change 1d: ${s.changePct1d.toFixed(2)}%  7d: ${s.changePct7d.toFixed(2)}%  30d: ${s.changePct30d.toFixed(2)}%`,
      `SMA20: ${fmt(s.sma20)}  SMA50: ${fmt(s.sma50)}  SMA200: ${fmt(s.sma200)}`,
      `RSI14: ${fmt(s.rsi14, 2)}  ATR14: ${fmt(s.atr14)}`,
      `20d high/low: ${fmt(s.high20)} / ${fmt(s.low20)}`,
      `60d high/low: ${fmt(s.high60)} / ${fmt(s.low60)}`,
      `Last 20 closes: ${candles.slice(-20).map((c) => c.c.toFixed(5)).join(", ")}`,
    ].join("\n");

    const prompt = `You are a disciplined technical forex analyst.
Analyze the market data below and produce a structured trade evaluation as JSON.

Rules:
- Use ONLY the numbers provided. Do not invent news or fundamentals.
- Anchor entry/SL/TP to nearby structure (recent highs/lows, SMAs) and size stops using ATR.
- Prefer "no-trade" when trend and momentum disagree or price is mid-range.
- Prices must use the same scale/decimals as the data.
- Keep rationale concise and specific.

Return ONLY valid JSON (no markdown, no prose) matching exactly this shape:
{
  "trend": { "direction": "bullish"|"bearish"|"neutral", "strength": "weak"|"moderate"|"strong", "summary": string },
  "keyLevels": { "resistance": number[], "support": number[] },
  "indicators": { "rsiRead": string, "maRead": string, "volatilityRead": string },
  "signal": {
    "bias": "long"|"short"|"no-trade",
    "entry": number, "stopLoss": number, "takeProfit": number,
    "riskRewardRatio": number, "confidence": number, "rationale": string
  },
  "disclaimer": string
}

MARKET DATA
${context}`;

    const { text } = await generateText({ model, prompt });
    const analysis = AnalysisSchema.parse(extractJson(text));

    return {
      ...analysis,
      pair: data.pair,
      price: s.price,
      asOf: s.asOf,
    };
  });

export const getSnapshot = createServerFn({ method: "GET" })
  .inputValidator((raw: unknown) => z.object({ pair: PairInput }).parse(raw))
  .handler(async ({ data }) => {
    const { fetchCandles, summarize } = await import("./market.server");
    const candles = await fetchCandles(data.pair, "3mo");
    if (!candles.length) throw new Error("No data");
    const s = summarize(data.pair, candles);
    return {
      pair: data.pair,
      price: s.price,
      changePct1d: s.changePct1d,
      changePct7d: s.changePct7d,
      rsi14: s.rsi14,
      spark: candles.slice(-30).map((c) => c.c),
      asOf: s.asOf,
    };
  });

export const getChart = createServerFn({ method: "GET" })
  .inputValidator((raw: unknown) =>
    z.object({
      pair: PairInput,
      range: z.enum(["1mo", "3mo", "6mo", "1y"]).optional(),
    }).parse(raw),
  )
  .handler(async ({ data }) => {
    const { fetchCandles } = await import("./market.server");
    const candles = await fetchCandles(data.pair, data.range ?? "3mo");
    if (!candles.length) throw new Error("No data");
    // SMA helpers
    const closes = candles.map((c) => c.c);
    const smaSeries = (period: number): (number | null)[] =>
      closes.map((_, i) => {
        if (i + 1 < period) return null;
        let s = 0;
        for (let k = i + 1 - period; k <= i; k++) s += closes[k];
        return s / period;
      });
    return {
      pair: data.pair,
      candles: candles.map((c) => ({ t: c.t, o: c.o, h: c.h, l: c.l, c: c.c })),
      sma20: smaSeries(20),
      sma50: smaSeries(50),
    };
  });

const TimingSchema = z.object({
  action: z.enum(["enter_now", "wait_pullback", "wait_breakout", "wait_confirmation", "avoid"]),
  bias: z.enum(["long", "short", "no-trade"]),
  triggerPrice: z.number().describe("Price that triggers entry. Use current price when action is enter_now, 0 when avoid."),
  triggerCondition: z.string().describe("Precise condition to wait for, e.g. 'Close above 1.0850 on 1h' or 'Pullback to SMA20 near 1.0810'."),
  window: z.string().describe("Expected time window, e.g. 'next 4-12 hours', 'today's US session', '1-3 days'."),
  invalidation: z.string().describe("What would invalidate this timing setup."),
  confidence: z.number().describe("Confidence 0-100."),
  reasoning: z.string().describe("2-3 sentences explaining the timing call using the intraday context."),
});

export type EntryTiming = z.infer<typeof TimingSchema> & {
  pair: string;
  price: number;
  asOf: string;
};

export const predictEntryTiming = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => z.object({ pair: PairInput }).parse(raw))
  .handler(async ({ data }): Promise<EntryTiming> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const { fetchCandles, fetchIntraday, summarize } = await import("./market.server");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");

    const [daily, intraday] = await Promise.all([
      fetchCandles(data.pair, "3mo"),
      fetchIntraday(data.pair, "60m", "1mo"),
    ]);
    if (daily.length < 30 || intraday.length < 30) throw new Error("Not enough market data");

    const s = summarize(data.pair, daily);
    const last = intraday[intraday.length - 1];
    const recent = intraday.slice(-24);
    const hi24 = Math.max(...recent.map((c) => c.h));
    const lo24 = Math.min(...recent.map((c) => c.l));
    const closes = intraday.slice(-40).map((c) => c.c);

    const fmt = (n: number | null, d = 5) => (n == null ? "n/a" : n.toFixed(d));
    const context = [
      `Pair: ${data.pair}`,
      `As of: ${new Date(last.t).toISOString()}`,
      `Current price: ${fmt(last.c)}`,
      `Daily trend — SMA20 ${fmt(s.sma20)} / SMA50 ${fmt(s.sma50)} / SMA200 ${fmt(s.sma200)}, RSI14 ${fmt(s.rsi14, 2)}, ATR14 ${fmt(s.atr14)}`,
      `Daily 20d range: ${fmt(s.low20)} — ${fmt(s.high20)}`,
      `Intraday last 24h: high ${fmt(hi24)}, low ${fmt(lo24)}`,
      `Last 40 hourly closes: ${closes.map((c) => c.toFixed(5)).join(", ")}`,
    ].join("\n");

    const prompt = `You are a short-term forex timing analyst. Given the daily context and hourly price action below, predict WHEN to enter.

Rules:
- Choose exactly one action: enter_now, wait_pullback, wait_breakout, wait_confirmation, or avoid.
- Anchor triggerPrice to real hourly structure (recent swing high/low, SMA, session extreme).
- If momentum, trend, and intraday structure disagree, prefer wait_confirmation or avoid.
- Window must be realistic for hourly data (hours to a few days).
- Prices must match the data's decimal scale.

Return ONLY valid JSON (no markdown) with this exact shape:
{
  "action": "enter_now"|"wait_pullback"|"wait_breakout"|"wait_confirmation"|"avoid",
  "bias": "long"|"short"|"no-trade",
  "triggerPrice": number,
  "triggerCondition": string,
  "window": string,
  "invalidation": string,
  "confidence": number,
  "reasoning": string
}

MARKET DATA
${context}`;

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");
    const { text } = await generateText({ model, prompt });
    const timing = TimingSchema.parse(extractJson(text));

    return {
      ...timing,
      pair: data.pair,
      price: last.c,
      asOf: new Date(last.t).toISOString(),
    };
  });
