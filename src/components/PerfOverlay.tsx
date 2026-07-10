import { useEffect, useRef, useState } from "react";

/**
 * Lightweight FPS + long-task overlay.
 *
 * Enable with `?perf=1` in the URL, or press "P" to toggle.
 * - FPS: rolling average over the last ~1s using requestAnimationFrame.
 * - Long tasks: counts PerformanceObserver "longtask" entries (>50ms on main thread)
 *   over the last 5 seconds, plus the worst duration seen.
 * - INP-ish: worst event processing duration ("event" entries) over the last 5s.
 *
 * Zero deps, fixed-position, non-interactive with the page (pointer-events: none).
 */
export function PerfOverlay() {
  const [enabled, setEnabled] = useState(false);
  const [fps, setFps] = useState(0);
  const [minFps, setMinFps] = useState(60);
  const [longTasks, setLongTasks] = useState(0);
  const [worstLongMs, setWorstLongMs] = useState(0);
  const [worstEventMs, setWorstEventMs] = useState(0);

  // Enable via ?perf=1 or press "P"
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("perf") === "1") setEnabled(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "p" || e.key === "P") {
        if (e.target instanceof HTMLElement) {
          const tag = e.target.tagName;
          if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable) return;
        }
        setEnabled((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // FPS meter
  const rafRef = useRef<number | null>(null);
  const framesRef = useRef<number[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const loop = (t: number) => {
      if (cancelled) return;
      const arr = framesRef.current;
      arr.push(t);
      // keep only last 1000ms
      while (arr.length && t - arr[0] > 1000) arr.shift();
      const currentFps = arr.length;
      setFps(currentFps);
      setMinFps((m) => (currentFps > 0 && currentFps < m ? currentFps : m));
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      framesRef.current = [];
    };
  }, [enabled]);

  // Long-task + event observers
  useEffect(() => {
    if (!enabled || typeof PerformanceObserver === "undefined") return;
    const recent: { time: number; dur: number }[] = [];

    let longObs: PerformanceObserver | null = null;
    try {
      longObs = new PerformanceObserver((list) => {
        const now = performance.now();
        for (const entry of list.getEntries()) {
          recent.push({ time: now, dur: entry.duration });
        }
        // trim to 5s
        while (recent.length && now - recent[0].time > 5000) recent.shift();
        setLongTasks(recent.length);
        setWorstLongMs(recent.reduce((m, r) => (r.dur > m ? r.dur : m), 0));
      });
      longObs.observe({ type: "longtask", buffered: true });
    } catch {
      /* longtask not supported */
    }

    let eventObs: PerformanceObserver | null = null;
    try {
      eventObs = new PerformanceObserver((list) => {
        let worst = 0;
        for (const entry of list.getEntries()) {
          if (entry.duration > worst) worst = entry.duration;
        }
        setWorstEventMs((m) => (worst > m ? worst : m));
      });
      // durationThreshold reports events slower than N ms
      eventObs.observe({ type: "event", buffered: true, durationThreshold: 40 } as PerformanceObserverInit);
    } catch {
      /* event timing not supported */
    }

    return () => {
      longObs?.disconnect();
      eventObs?.disconnect();
    };
  }, [enabled]);

  if (!enabled) return null;

  const fpsColor = fps >= 55 ? "#4ade80" : fps >= 40 ? "#fbbf24" : "#f87171";

  const reset = () => {
    setMinFps(60);
    setWorstLongMs(0);
    setWorstEventMs(0);
    setLongTasks(0);
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 12,
        right: 12,
        zIndex: 99999,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 11,
        lineHeight: 1.4,
        color: "#e5e7eb",
        background: "rgba(15, 23, 42, 0.85)",
        border: "1px solid rgba(148, 163, 184, 0.25)",
        borderRadius: 8,
        padding: "8px 10px",
        pointerEvents: "auto",
        backdropFilter: "blur(6px)",
        minWidth: 180,
      }}
      aria-label="Performance overlay"
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <strong style={{ letterSpacing: 0.5 }}>PERF</strong>
        <button
          onClick={reset}
          style={{
            background: "transparent",
            border: "1px solid rgba(148,163,184,0.3)",
            borderRadius: 4,
            color: "#cbd5e1",
            fontSize: 10,
            padding: "1px 6px",
            cursor: "pointer",
          }}
        >
          reset
        </button>
      </div>
      <div>
        FPS <span style={{ color: fpsColor, fontWeight: 600 }}>{fps}</span>{" "}
        <span style={{ color: "#94a3b8" }}>min {minFps}</span>
      </div>
      <div>
        LongTasks/5s <span style={{ color: longTasks > 0 ? "#fbbf24" : "#4ade80" }}>{longTasks}</span>{" "}
        <span style={{ color: "#94a3b8" }}>worst {worstLongMs.toFixed(0)}ms</span>
      </div>
      <div>
        Event worst <span style={{ color: worstEventMs > 100 ? "#f87171" : worstEventMs > 40 ? "#fbbf24" : "#4ade80" }}>
          {worstEventMs.toFixed(0)}ms
        </span>
      </div>
      <div style={{ marginTop: 4, color: "#64748b", fontSize: 10 }}>Press P to toggle</div>
    </div>
  );
}
