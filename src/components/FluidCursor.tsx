import { useEffect, useRef } from "react";

/**
 * Steppay-style fluid cursor: soft blurred color blobs that trail the pointer.
 * Pointer-events: none so it never blocks the UI. Disables on touch devices.
 */
export function FluidCursor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(hover: none)").matches) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = (canvas.width = window.innerWidth * devicePixelRatio);
    let h = (canvas.height = window.innerHeight * devicePixelRatio);
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";

    const onResize = () => {
      w = canvas.width = window.innerWidth * devicePixelRatio;
      h = canvas.height = window.innerHeight * devicePixelRatio;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
    };
    window.addEventListener("resize", onResize);

    type Blob = { x: number; y: number; vx: number; vy: number; r: number; hue: number };
    const blobs: Blob[] = [];
    const palette = [190, 155, 25, 260, 45];

    let mx = w / 2;
    let my = h / 2;
    const onMove = (e: PointerEvent) => {
      mx = e.clientX * devicePixelRatio;
      my = e.clientY * devicePixelRatio;
      // Emit a blob on movement
      if (blobs.length < 40) {
        blobs.push({
          x: mx,
          y: my,
          vx: (Math.random() - 0.5) * 2 * devicePixelRatio,
          vy: (Math.random() - 0.5) * 2 * devicePixelRatio,
          r: (60 + Math.random() * 60) * devicePixelRatio,
          hue: palette[Math.floor(Math.random() * palette.length)],
        });
      }
    };
    window.addEventListener("pointermove", onMove);

    let raf = 0;
    const tick = () => {
      // Fade previous frame
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = "lighter";
      for (let i = blobs.length - 1; i >= 0; i--) {
        const b = blobs[i];
        b.x += b.vx;
        b.y += b.vy;
        b.r *= 0.985;
        b.vx *= 0.985;
        b.vy *= 0.985;

        const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        grad.addColorStop(0, `oklch(0.75 0.18 ${b.hue} / 0.35)`);
        grad.addColorStop(1, `oklch(0.75 0.18 ${b.hue} / 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();

        if (b.r < 4) blobs.splice(i, 1);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 h-screen w-screen"
      style={{ filter: "blur(24px)" }}
    />
  );
}
