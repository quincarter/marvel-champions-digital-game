/**
 * A guest's Each player Undo, bound to the moves it saw (#1019 review). The guest sends the command count it saw
 * (`base`), the count its Undo goes back to (`target`) and a fingerprint of every move up to `base` (`moves`); the
 * room refuses one from another log epoch, and the host's device does it only when its own table holds that very
 * history: the same count, the same target, and the same moves all the way back. Any rewind followed by other moves up
 * to the same count is a different history, whichever moves changed, and its fingerprint does not match.
 */
import type { Command } from "@mc/engine";

export interface UndoBound {
  readonly base: number;
  readonly target: number;
  readonly moves: string;
}

/** Plain data in a fixed key order, so two devices that built the same command write the same text. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** A short fingerprint of a run of moves (FNV-1a over their canonical text, twice, as 16 hex digits). */
export function movesFingerprint(commands: readonly Command[]): string {
  const text = canonical(commands);
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x0100019d) >>> 0;
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}

/** The binding for an Undo back to `target` on a table at `base`, from that table's command trail. */
export function bindUndo(
  trail: readonly { readonly command: Command }[],
  base: number,
  target: number,
): UndoBound | null {
  if (target < 0 || target > base || trail.length !== base) return null;
  // The whole history up to `base`, not only the moves taken back: a log rewound and replayed to the same count with
  // the same last moves but a different past is still another table (Codex review on #1019).
  return { base, target, moves: movesFingerprint(trail.slice(0, base).map((entry) => entry.command)) };
}

/**
 * Whether the host's table still holds the history a bound Undo was asked on: its count is `base`, its own Undo for
 * that hero goes back to `target`, and every move up to `base` is the one the guest saw.
 */
export function boundUndoMatches(
  trail: readonly { readonly command: Command }[],
  version: number,
  offerTarget: number,
  bound: UndoBound,
): boolean {
  if (version !== bound.base || offerTarget !== bound.target) return false;
  return bindUndo(trail, version, offerTarget)?.moves === bound.moves;
}
