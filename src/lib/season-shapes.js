import { MOST_FRAMES, SEASON_INK } from "./seasons.js";

/**
 * The twelve months' shapes, and the classic confetti's, drawn on a canvas.
 *
 * The seasonal celebrations spec's working reference, shape for shape: each is
 * a few vector strokes centred on the origin, `size` across, in the colour
 * already set on the context. "Michelle can redraw the twelve shapes in the
 * brand style; the timing and settings stay the same." A redrawn one replaces
 * its function here and nothing else changes.
 *
  * Copied as is from the Practice app (`src/lib/season-shapes.js`).
 * Plain, importing nothing with an alias, so the suite can hold it.
 */

const TAU = Math.PI * 2;

/** @type {Record<string, (c: CanvasRenderingContext2D, s: number, flap?: number) => void>} */
export const SHAPES = {
  snow(c, s) {
    c.lineWidth = s * 0.11;
    c.lineCap = "round";
    for (let i = 0; i < 6; i += 1) {
      c.rotate(Math.PI / 3);
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(0, -s);
      c.moveTo(0, -s * 0.55);
      c.lineTo(s * 0.22, -s * 0.78);
      c.moveTo(0, -s * 0.55);
      c.lineTo(-s * 0.22, -s * 0.78);
      c.stroke();
    }
  },
  heart(c, s) {
    c.beginPath();
    c.moveTo(0, s * 0.35);
    c.bezierCurveTo(-s * 1.1, -s * 0.35, -s * 0.45, -s * 1.05, 0, -s * 0.45);
    c.bezierCurveTo(s * 0.45, -s * 1.05, s * 1.1, -s * 0.35, 0, s * 0.35);
    c.fill();
  },
  shamrock(c, s) {
    for (let i = 0; i < 3; i += 1) {
      c.save();
      c.rotate((i * TAU) / 3);
      c.beginPath();
      c.arc(-s * 0.2, -s * 0.48, s * 0.3, 0, TAU);
      c.arc(s * 0.2, -s * 0.48, s * 0.3, 0, TAU);
      c.fill();
      c.restore();
    }
    c.lineWidth = s * 0.12;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(s * 0.15, s * 0.6, s * 0.35, s * 0.95);
    c.stroke();
  },
  // `flap` from 0.6 to 1 as it falls: the wings open and close.
  butterfly(c, s, flap = 1) {
    c.save();
    c.scale(flap, 1);
    c.beginPath();
    c.ellipse(-s * 0.42, -s * 0.25, s * 0.42, s * 0.34, -0.5, 0, TAU);
    c.ellipse(s * 0.42, -s * 0.25, s * 0.42, s * 0.34, 0.5, 0, TAU);
    c.fill();
    c.beginPath();
    c.ellipse(-s * 0.3, s * 0.32, s * 0.26, s * 0.22, 0.5, 0, TAU);
    c.ellipse(s * 0.3, s * 0.32, s * 0.26, s * 0.22, -0.5, 0, TAU);
    c.fill();
    c.restore();
    c.fillStyle = SEASON_INK.navy;
    c.beginPath();
    c.ellipse(0, 0, s * 0.08, s * 0.5, 0, 0, TAU);
    c.fill();
  },
  flower(c, s) {
    for (let i = 0; i < 5; i += 1) {
      c.rotate(TAU / 5);
      c.beginPath();
      c.ellipse(0, -s * 0.45, s * 0.24, s * 0.42, 0, 0, TAU);
      c.fill();
    }
    c.fillStyle = SEASON_INK.gold;
    c.beginPath();
    c.arc(0, 0, s * 0.22, 0, TAU);
    c.fill();
  },
  sun(c, s) {
    c.beginPath();
    c.arc(0, 0, s * 0.42, 0, TAU);
    c.fill();
    c.lineWidth = s * 0.1;
    c.lineCap = "round";
    for (let i = 0; i < 8; i += 1) {
      c.rotate(Math.PI / 4);
      c.beginPath();
      c.moveTo(0, -s * 0.6);
      c.lineTo(0, -s * 0.9);
      c.stroke();
    }
  },
  star(c, s) {
    c.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const r = i % 2 ? s * 0.42 : s;
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
    c.fill();
  },
  sunflower(c, s) {
    for (let i = 0; i < 12; i += 1) {
      c.rotate(Math.PI / 6);
      c.beginPath();
      c.ellipse(0, -s * 0.6, s * 0.14, s * 0.36, 0, 0, TAU);
      c.fill();
    }
    c.fillStyle = "#6B4A2E";
    c.beginPath();
    c.arc(0, 0, s * 0.38, 0, TAU);
    c.fill();
  },
  apple(c, s) {
    c.beginPath();
    c.arc(-s * 0.25, 0, s * 0.45, 0, TAU);
    c.arc(s * 0.25, 0, s * 0.45, 0, TAU);
    c.fill();
    c.fillStyle = SEASON_INK.gold;
    c.beginPath();
    c.ellipse(s * 0.18, -s * 0.62, s * 0.18, s * 0.09, -0.5, 0, TAU);
    c.fill();
  },
  pumpkin(c, s) {
    c.beginPath();
    c.ellipse(-s * 0.38, s * 0.05, s * 0.42, s * 0.6, 0, 0, TAU);
    c.ellipse(s * 0.38, s * 0.05, s * 0.42, s * 0.6, 0, 0, TAU);
    c.fill();
    c.beginPath();
    c.ellipse(0, s * 0.05, s * 0.42, s * 0.66, 0, 0, TAU);
    c.fill();
    c.strokeStyle = "rgba(27,35,50,.25)";
    c.lineWidth = s * 0.06;
    c.beginPath();
    c.ellipse(0, s * 0.05, s * 0.42, s * 0.66, 0, 0, TAU);
    c.stroke();
    c.fillStyle = "#6E7A55";
    c.fillRect(-s * 0.08, -s * 0.85, s * 0.16, s * 0.3);
  },
  leaf(c, s) {
    c.beginPath();
    c.moveTo(0, -s);
    c.quadraticCurveTo(s * 0.8, -s * 0.2, 0, s * 0.8);
    c.quadraticCurveTo(-s * 0.8, -s * 0.2, 0, -s);
    c.fill();
    c.strokeStyle = "rgba(27,35,50,.35)";
    c.lineWidth = s * 0.07;
    c.beginPath();
    c.moveTo(0, -s * 0.8);
    c.lineTo(0, s * 0.75);
    c.stroke();
  },
  ornament(c, s) {
    c.beginPath();
    c.arc(0, s * 0.15, s * 0.62, 0, TAU);
    c.fill();
    c.fillStyle = "rgba(255,255,255,.35)";
    c.beginPath();
    c.arc(-s * 0.2, -s * 0.05, s * 0.16, 0, TAU);
    c.fill();
    c.fillStyle = SEASON_INK.gold;
    c.fillRect(-s * 0.18, -s * 0.62, s * 0.36, s * 0.18);
    c.strokeStyle = SEASON_INK.gold;
    c.lineWidth = s * 0.08;
    c.beginPath();
    c.arc(0, -s * 0.72, s * 0.13, 0, TAU);
    c.stroke();
  },
  confetti(c, s) {
    c.fillRect(-s * 0.5, -s * 0.25, s, s * 0.5);
  }
};

/**
 * One shape, in one colour, at the context's origin.
 *
 * @param {CanvasRenderingContext2D} c
 * @param {string} shape
 * @param {number} size
 * @param {string} color
 * @param {number} [flap]
 */
export function drawShape(c, shape, size, color, flap = 1) {
  const draw = SHAPES[shape] || SHAPES.confetti;
  c.fillStyle = color;
  c.strokeStyle = color;
  draw(c, size, flap);
}

/**
 * The pieces of one burst, placed once: deterministic per celebration, so the
 * same burst draws if the screen draws twice.
 *
 * Each starts somewhere above the top (the later ones further up, so they
 * arrive in waves) and falls the whole height of the screen, leaving at the
 * foot as its life ends: Logan, November 3, "make them all the way to the
 * bottom".
 *
 * @param {{ shape: string, colors: string[], fall: number, sway: number, spin: number }} season
 * @param {{ count: number, size: number[], life: number[], stagger: number }} burst
 * @param {number} width
 * @param {number} height
 * @param {() => number} next  a random number in [0, 1)
 */
export function piecesFor(season, burst, width, height, next) {
  const gentle = Math.sqrt(Math.max(0.25, season.fall || 1));
  return Array.from({ length: burst.count }, (_, i) => {
    const y = -20 - next() * height * burst.stagger;
    const life = Math.min(MOST_FRAMES, (burst.life[0] + next() * (burst.life[1] - burst.life[0])) / gentle);
    return {
      x: next() * width,
      y,
      size: burst.size[0] + next() * (burst.size[1] - burst.size[0]),
      color: season.colors[i % season.colors.length],
      // Per frame at 60 a second: far enough to clear the foot by its end.
      vy: (height + 40 - y) / life,
      phase: next() * TAU,
      sway: season.sway,
      turn: next() * TAU,
      spinRate: (next() - 0.5) * 0.16 * season.spin,
      life
    };
  });
}

/**
 * Where a piece is, `frames` in (60 a second), and how visible: it falls,
 * sways side to side, turns, and fades over its last 18 frames, at the foot
 * of the screen.
 */
export function pieceAt(piece, frames) {
  const swayAt = piece.phase + frames * 0.05;
  // The sway is the running sum of the reference's per-frame one.
  const across = ((Math.cos(piece.phase) - Math.cos(swayAt)) / 0.05) * 0.7 * piece.sway;
  return {
    x: piece.x + across,
    y: piece.y + piece.vy * frames,
    turn: piece.turn + piece.spinRate * frames,
    alpha: frames >= piece.life ? 0 : frames > piece.life - 18 ? (piece.life - frames) / 18 : 1
  };
}
