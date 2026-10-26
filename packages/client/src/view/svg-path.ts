/**
 * Flattens an SVG path's `d` into polylines, for drawing the Controls screen's controllers with Phaser Graphics
 * (`ui/controller-drawing.ts`). Handles the commands the drawings use: M L H V C Z in both cases, plus arcs, which are
 * drawn as the straight line to their end point (the drawings only use them for 4px rounded corners).
 */

export interface Subpath {
  readonly points: readonly { readonly x: number; readonly y: number }[];
  readonly closed: boolean;
}

const CURVE_STEPS = 14;

export function flattenPath(d: string): readonly Subpath[] {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  interface Work {
    points: { x: number; y: number }[];
    closed: boolean;
  }
  const out: Work[] = [];
  let current = null as Work | null;
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let i = 0;
  let command = "";
  const read = (): number => Number(tokens[i++]);
  const begin = (): void => {
    current = { points: [{ x, y }], closed: false };
    out.push(current);
  };
  const lineTo = (nx: number, ny: number): void => {
    if (!current) begin();
    x = nx;
    y = ny;
    current!.points.push({ x, y });
  };
  while (i < tokens.length) {
    const token = tokens[i]!;
    if (/[a-zA-Z]/.test(token)) {
      command = token;
      i++;
      if (command === "Z" || command === "z") {
        const open = current as Work | null;
        if (open) {
          open.closed = true;
          x = startX;
          y = startY;
          current = null;
        }
        continue;
      }
    }
    const relative = command === command.toLowerCase();
    switch (command.toUpperCase()) {
      case "M": {
        const nx = read() + (relative ? x : 0);
        const ny = read() + (relative ? y : 0);
        x = nx;
        y = ny;
        startX = nx;
        startY = ny;
        begin();
        // Further pairs after a move are implicit line-tos.
        command = relative ? "l" : "L";
        break;
      }
      case "L":
        lineTo(read() + (relative ? x : 0), read() + (relative ? y : 0));
        break;
      case "H":
        lineTo(read() + (relative ? x : 0), y);
        break;
      case "V":
        lineTo(x, read() + (relative ? y : 0));
        break;
      case "C": {
        const ox = relative ? x : 0;
        const oy = relative ? y : 0;
        const x1 = read() + ox;
        const y1 = read() + oy;
        const x2 = read() + ox;
        const y2 = read() + oy;
        const x3 = read() + ox;
        const y3 = read() + oy;
        const x0 = x;
        const y0 = y;
        for (let s = 1; s <= CURVE_STEPS; s++) {
          const t = s / CURVE_STEPS;
          const u = 1 - t;
          lineTo(
            u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
            u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
          );
        }
        break;
      }
      case "A": {
        // rx ry rotation large-arc sweep x y: the arc is flattened to its chord.
        i += 5;
        lineTo(read() + (relative ? x : 0), read() + (relative ? y : 0));
        break;
      }
      default:
        // An unknown command: skip its token so a bad path can't loop forever.
        i++;
    }
  }
  return out;
}
