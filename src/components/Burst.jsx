import React, { useEffect, useRef } from "react";
import { burstLength, burstOf, seasonFor } from "@/lib/seasons";
import { drawShape, pieceAt, piecesFor } from "@/lib/season-shapes";

/** A number from a burst's id, so its pieces fall the same way if it is drawn twice. */
const seedOf = (id) => {
  let seed = 0;
  for (const ch of String(id)) seed = (seed * 31 + ch.charCodeAt(0)) % 100000;
  return seed;
};
const randomFrom = (start) => {
  let seed = start;
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
};

/**
 * The month's pieces, on one canvas over the screen: the Practice app's own
 * seasonal celebration (November leaves, December ornaments), drawn the same
 * way here. Decoration, so it is hidden from assistive tech and cannot be
 * tapped; it respects reduced motion by not drawing at all.
 *
 * @param {{ burst: { id: string, bigger?: boolean } | null, onDone?: () => void }} props
 */
export default function Burst({ burst, onDone }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!burst) return undefined;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const season = seasonFor();
    const canvas = canvasRef.current;
    const context = canvas?.getContext?.("2d");
    if (reduced || !canvas || !context) {
      const soon = setTimeout(() => onDone?.(), 10);
      return () => clearTimeout(soon);
    }
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const pieces = piecesFor(season, burstOf(Boolean(burst.bigger)), width, height, randomFrom(seedOf(burst.id)));
    const start = performance.now();
    let frame = 0;
    const tick = (now) => {
      const frames = (now - start) / (1000 / 60);
      context.clearRect(0, 0, width, height);
      let showing = 0;
      for (const piece of pieces) {
        const at = pieceAt(piece, frames);
        if (at.alpha <= 0) continue;
        showing += 1;
        context.save();
        context.globalAlpha = at.alpha;
        context.translate(at.x, at.y);
        context.rotate(at.turn);
        const flap = season.shape === "butterfly" ? 0.6 + 0.4 * Math.abs(Math.sin(now / 140 + piece.size)) : 1;
        drawShape(context, season.shape, piece.size, piece.color, flap);
        context.restore();
      }
      frame = showing ? requestAnimationFrame(tick) : 0;
    };
    frame = requestAnimationFrame(tick);
    const over = setTimeout(() => onDone?.(), burstLength(Boolean(burst.bigger), season) + 300);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(over);
    };
  }, [burst, onDone]);
  if (!burst) return null;
  return <canvas ref={canvasRef} className="fixed inset-0 z-[60] w-full h-full pointer-events-none" aria-hidden="true" />;
}
