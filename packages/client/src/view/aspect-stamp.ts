/**
 * A deck's aspect as a stamp: the aspect's own card-frame colour with its name on it, so a roster of decks reads by
 * colour at a glance instead of by a parenthetical in the title.
 *
 * The fills are the printed card frames' colours (red Aggression, yellow Justice, green Protection, blue Leadership,
 * pink 'Pool, grey Basic). They are deliberately *not* the design system's signal tokens: `signal.heal` means "HP
 * gained", not "Protection", and a stamp must never be mistaken for one. Ink is fixed where the owner chose it
 * (white on Aggression; black on Justice and 'Pool) and otherwise whichever of black or white contrasts more.
 */
import type { CoreAspect } from "@mc/content";

export interface AspectStamp {
  readonly aspect: CoreAspect;
  /** "JUSTICE" — drawn uppercase by the label role anyway; kept as the display word. */
  readonly label: string;
  readonly fill: number;
  readonly ink: number;
}

const BLACK = 0x14110d;
const WHITE = 0xffffff;

const FILL: Readonly<Record<CoreAspect, number>> = {
  aggression: 0xc62828,
  justice: 0xf4c20d,
  protection: 0x2e9e4f,
  leadership: 0x4fb3e8,
  pool: 0xf48fb1,
  basic: 0x9a948a,
};

const FIXED_INK: Partial<Record<CoreAspect, number>> = { aggression: WHITE, justice: BLACK, pool: BLACK };

const LABEL: Readonly<Record<CoreAspect, string>> = {
  aggression: "Aggression",
  justice: "Justice",
  protection: "Protection",
  leadership: "Leadership",
  pool: "'Pool",
  basic: "Basic",
};

/** WCAG relative luminance of an 0xRRGGBB colour. */
export function luminanceOf(hex: number): number {
  const channel = (value: number): number => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel((hex >> 16) & 0xff) + 0.7152 * channel((hex >> 8) & 0xff) + 0.0722 * channel(hex & 0xff);
}

export function contrastRatio(a: number, b: number): number {
  const [hi, lo] = [luminanceOf(a), luminanceOf(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

export function aspectStampOf(aspect: CoreAspect): AspectStamp {
  const fill = FILL[aspect];
  const ink = FIXED_INK[aspect] ?? (contrastRatio(fill, BLACK) >= contrastRatio(fill, WHITE) ? BLACK : WHITE);
  return { aspect, label: LABEL[aspect], fill, ink };
}

/** One stamp per chosen aspect, in the deck's own order. A deck with none (an identity that builds without one) gets none. */
export function aspectStampsOf(aspects: readonly CoreAspect[]): readonly AspectStamp[] {
  return aspects.map(aspectStampOf);
}

/**
 * A deck title without the aspect it already wears as a stamp: "Spider-Man (Justice)" → "Spider-Man". Only a
 * trailing parenthetical that names exactly this deck's aspects is dropped — a player's own "(v2)" is theirs.
 */
export function titleWithoutAspects(title: string, aspects: readonly CoreAspect[]): string {
  const match = /^(.*\S)\s*\(([^()]*)\)\s*$/.exec(title);
  if (!match || aspects.length === 0) return title;
  const named = match[2]!.split(/\s*(?:\+|\/|,|&)\s*/).map((word) => word.trim().toLowerCase().replace(/^'/, "")).sort();
  const own = [...aspects].map((aspect) => aspect.toLowerCase()).sort();
  return named.length === own.length && named.every((word, index) => word === own[index]) ? match[1]! : title;
}
