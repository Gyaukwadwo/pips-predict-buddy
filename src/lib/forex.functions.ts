import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";

const PairEnum = z.enum([
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
]);

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
  .inputValidator((raw: unknown) => z.object({ pair: PairEnum }).parse(raw))
  .handler(async ({ data }): Promise<ForexAnalysis> => {
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
Analyze the market data below and produce a structured trade evaluation.

Rules:
- Use ONLY the numbers provided. Do not invent news or fundamentals.
- Anchor entry/SL/TP to nearby structure (recent highs/lows, SMAs) and size stops using ATR.
- Prefer "no-trade" when trend and momentum disagree or price is mid-range.
- Prices must use the same scale/decimals as the data.
- Keep rationale concise and specific.

MARKET DATA
${context}`;

    const { output } = await generateText({
      model,
      output: Output.object({ schema: AnalysisSchema }),
      prompt,
    });
    const analysis = output;

    return {
      ...experimental_output,
      pair: data.pair,
      price: s.price,
      asOf: s.asOf,
    };
  });

export const getSnapshot = createServerFn({ method: "GET" })
  .inputValidator((raw: unknown) => z.object({ pair: PairEnum }).parse(raw))
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
