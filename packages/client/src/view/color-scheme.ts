/**
 * Dark mode (#459): the color scheme the client draws in, as plain data.
 *
 * The design system's five grounds (`tokens.ts`) are a light paper ramp with ink on top, and every screen draws with
 * those tokens directly: `surface.paper.hex` as a panel's fill, `surface.ink.hex` as its border and its text. Dark mode
 * keeps every one of those calls and swaps the color at the point Phaser receives it, by channel, because the same
 * token means different things in different channels:
 *
 *  - **fill**: the light grounds (paper, parchment, card) step down to warm charcoals in the same order, so depth by
 *    "ground swap" still reads (ink < parchment < paper < card). Ink stays ink: it is already the dark chrome (top bars,
 *    action bar, the Board's felt, Settings' panel), and a selected or hovered control that fills with paper is still
 *    the lighter of the two.
 *  - **line**: ink borders turn to a soft cream, so the comic 3px outline still frames each object on a dark ground.
 *  - **text**: ink text turns cream. Paper text (already the text color on dark grounds) is left as it is.
 *
 * Every hue (Hero Red, the signals, the status and stat hues, aspect colors) is left alone, and nothing here touches a
 * texture: card art and card faces are pictures and draw exactly as printed. Ink text that sits on a hue (caution
 * yellow, an aspect chip) uses `surface.inkOnHue`, which no scheme changes.
 *
 * The values are swapped both ways (`schemeColor(..., from, to)`), so a screen already on the table can be recolored
 * in place when the player flips the toggle (`ui/color-scheme-phaser.ts`). Every dark value is a hex no token uses,
 * which is what makes that reverse lookup safe.
 */

export type ColorScheme = "light" | "dark";
export type ColorChannel = "fill" | "line" | "text";

const INK = 0x14110e;
const PAPER = 0xf4efe3;
const PARCHMENT = 0xeae3d3;
const CARD = 0xffffff;

/** Light value to dark value, per channel. A color not listed is the same in both schemes. */
const DARK: Readonly<Record<ColorChannel, ReadonlyMap<number, number>>> = {
  fill: new Map([
    [PAPER, 0x3a342d],
    [PARCHMENT, 0x2e2924],
    [CARD, 0x48413a],
  ]),
  line: new Map([[INK, 0xd8cfbd]]),
  text: new Map([[INK, 0xf0e9db]]),
};

const LIGHT: Readonly<Record<ColorChannel, ReadonlyMap<number, number>>> = {
  fill: invert(DARK.fill),
  line: invert(DARK.line),
  text: invert(DARK.text),
};

function invert(map: ReadonlyMap<number, number>): ReadonlyMap<number, number> {
  return new Map([...map].map(([light, dark]) => [dark, light]));
}

/** `color` as drawn in `to`, given it was chosen for `from` (`light` for every token in `tokens.ts`). */
export function schemeColor(
  color: number,
  channel: ColorChannel,
  to: ColorScheme,
  from: ColorScheme = "light",
): number {
  if (from === to) return color;
  const table = to === "dark" ? DARK : LIGHT;
  return table[channel].get(color) ?? color;
}

/** Whether `color` is one a scheme swap changes in `channel`, in either scheme: what a live recolor has to track. */
export function isSchemeColor(color: number, channel: ColorChannel): boolean {
  return DARK[channel].has(color) || LIGHT[channel].has(color);
}

/**
 * The same for a CSS color string: `#rrggbb`, `#rgb` or `rgba(r,g,b,a)` (what `cssOf` writes). Anything else (a named
 * color, `transparent`) is returned unchanged.
 */
export function schemeCss(css: string, channel: ColorChannel, to: ColorScheme, from: ColorScheme = "light"): string {
  if (from === to) return css;
  const parsed = parseCss(css);
  if (!parsed) return css;
  const next = schemeColor(parsed.color, channel, to, from);
  if (next === parsed.color) return css;
  if (parsed.alpha === null) return `#${next.toString(16).padStart(6, "0")}`;
  return `rgba(${(next >> 16) & 0xff},${(next >> 8) & 0xff},${next & 0xff},${parsed.alpha})`;
}

function parseCss(css: string): { color: number; alpha: string | null } | null {
  const text = css.trim().toLowerCase();
  const long = /^#([0-9a-f]{6})$/.exec(text);
  if (long) return { color: Number.parseInt(long[1]!, 16), alpha: null };
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(text);
  if (short)
    return {
      color: Number.parseInt(`${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`, 16),
      alpha: null,
    };
  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(text);
  if (!rgba) return null;
  const color = (Number(rgba[1]) << 16) | (Number(rgba[2]) << 8) | Number(rgba[3]);
  return { color, alpha: rgba[4] ?? null };
}

let current: ColorScheme = "light";
const listeners = new Set<(next: ColorScheme, previous: ColorScheme) => void>();

/** The scheme every draw call is getting now. */
export function colorScheme(): ColorScheme {
  return current;
}

/** Switch schemes; listeners (the Phaser bridge, the toggle button) hear about a real change only. */
export function setColorScheme(next: ColorScheme): void {
  if (next === current) return;
  const previous = current;
  current = next;
  for (const listener of listeners) listener(next, previous);
}

export function onColorSchemeChange(listener: (next: ColorScheme, previous: ColorScheme) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The scheme a `darkMode` setting asks for. */
export const colorSchemeOf = (darkMode: boolean): ColorScheme => (darkMode ? "dark" : "light");
