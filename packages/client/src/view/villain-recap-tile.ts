/**
 * The wording of a "what changed" tile when its box is narrow: which label and which tail survive. Pure over a `fits`
 * measure so the rule is testable without a canvas. The rule is that the figures ("10 → 8") and the "YOU" tag always
 * outrank the words around them: a tile used to cut its own numbers to "0…" to keep "/12 THREAT" at full size.
 */
import type { RecapChange } from "./villain-recap.js";

/** The words a tile can shorten before it cuts letters: the chrome's own "1ST PLAYER", the board's "ENC DECK". */
const SHORT_WORDS: readonly (readonly [RegExp, string])[] = [
  [/^FIRST PLAYER$/, "1ST PLAYER"],
  [/^ENCOUNTER DECK$/, "ENC. DECK"],
];

/**
 * "SPIDER-MAN (PETER PARKER) · YOU" with the room it has: whole, then in its short words, then without the aside,
 * then the name cut, "· YOU" kept.
 */
export function fitTileLabel(text: string, fits: (candidate: string) => boolean): string {
  if (fits(text)) return text;
  const short = SHORT_WORDS.reduce((word, [pattern, replacement]) => word.replace(pattern, replacement), text);
  if (short !== text && fits(short)) return short;
  const noAside = short.replace(/\s*\([^)]*\)/, "");
  if (noAside !== short && fits(noAside)) return noAside;
  const split = noAside.indexOf(" · ");
  const head = split >= 0 ? noAside.slice(0, split) : noAside;
  const suffix = split >= 0 ? noAside.slice(split) : "";
  for (let length = head.length - 1; length >= 2; length--) {
    const candidate = `${head.slice(0, length).trimEnd()}…${suffix}`;
    if (fits(candidate)) return candidate;
  }
  return noAside;
}

/**
 * What follows a tile's figures, widest first: "/12 THREAT · NO DAMAGE", "/12 THREAT", "/12", nothing. The panel draws
 * the first that sits beside the figures at full size. The note is only said where there is room ahead of the phone's.
 */
export function tileTailVariants(change: RecapChange, phone: boolean): readonly string[] {
  const max = change.max !== null ? `/${change.max}` : "";
  const word = change.kind === "threat" && change.max !== null && !phone ? `${max} THREAT` : max;
  const note = change.note && !phone ? change.note : "";
  const variants = [[word, note].filter(Boolean).join(" · "), word, max, ""];
  return variants.filter((variant, index) => variants.indexOf(variant) === index);
}
