/**
 * The one place the design system lives, as plain data.
 *
 * Every value is transcribed from `Marvel Champions game screens/Components.dc.html`
 * (the design canvas that is the source of truth for the client's look). Colors
 * are Phaser-style `0xRRGGBB` numbers with a `css` twin for the few DOM-backed
 * bits (rexUI's text input, the page background). Nothing here imports Phaser,
 * so view models and tests can read tokens without a canvas.
 *
 * The design decisions these tokens serve, from section 06 of that canvas:
 *  - One red per screen: `accent.heroRed` marks the single forward action
 *    (Continue / Start game / End turn) plus the live round chip. Nothing else.
 *  - Borders, not shadows: depth is border weight and ground swaps. The only
 *    shadow in the system is the red selection ring.
 *  - Dim, don't hide: illegal choices stay in place at `ink.illegal`.
 *  - Numbers before prose: anything recalculated each round is Bangers 17px+.
 */

/** A color in both the forms the client needs. */
export interface Token {
  readonly hex: number;
  readonly css: string;
}

const token = (hex: number): Token => ({ hex, css: `#${hex.toString(16).padStart(6, "0")}` });

/** Section 01 — surfaces. Five grounds; depth comes from swapping between them. */
export const surface = {
  /** Canvas behind screens. Never inside a screen. */
  void: token(0x0e0c0a),
  /** All text, all borders, chrome bars, action bar. */
  ink: token(0x14110e),
  /** Default screen ground; also the text color on dark grounds. */
  paper: token(0xf4efe3),
  /** Recessed strips: tab rails, seat rows, settings groups. */
  parchment: token(0xeae3d3),
  /** Anything liftable off the paper: cards, rows, stat tiles. */
  card: token(0xffffff),
} as const;

/** Section 01 — the accent. Hero Red has exactly one job per screen. */
export const accent = {
  heroRed: token(0xc8102e),
  /** Hover and pressed only; also link hover. */
  redDeep: token(0x8e0b20),
  /** Outer ring of the targeting pulse. Never a fill. */
  redGlowAlpha: 0.3,
} as const;

/** Section 01 — signals. Four colors, each with one meaning. */
export const signal = {
  /** Resource pips, cost chips, low curve bars. */
  cost: token(0x1f5fa8),
  /** Recover, HP gain, deck legal, win state. */
  heal: token(0x1f7a4c),
  /** Advisory banners, pending choice, status dot. Ink text on it. */
  caution: token(0xf2b01e),
  /** Exhausted, discarded, 4+ cost bucket. */
  spent: token(0x2b241c),
} as const;

/**
 * Section 05 — status tokens. Three hues that exist nowhere else in the system,
 * so a status can never be mistaken for a cost, a warning, or an action. Each
 * one owns a concrete control: stunned greys Attack, confused greys Thwart,
 * tough hatches the HP bar.
 */
export const status = {
  stunned: token(0x6e9b2f),
  confused: token(0x8e5aa0),
  tough: token(0xd9741f),
} as const;

/** The control each status disables (section 06, "status owns a button"). */
export const STATUS_DISABLES = {
  stunned: "attack",
  confused: "thwart",
  tough: null,
} as const satisfies Record<keyof typeof status, "attack" | "thwart" | null>;

/**
 * Stat badge hues — the starburst a printed hero card puts behind THW, ATK and
 * DEF, redrawn so a live number can sit in it (`McStatBadge`).
 *
 * THW blue, ATK red and DEF green are taken from the card's own icons, because
 * a player already reads those shapes and colours as those stats. SCH and REC
 * are *chosen*, not taken from a card: change them freely if the printed
 * villain and alter-ego icons are wanted instead.
 *
 * Two constraints hold for all five. None collides with the status hues above,
 * which the design reserves as hues that exist nowhere else — so DEF is a
 * blue-leaning green well clear of stunned's olive, and neither SCH nor REC is
 * purple or orange. And none is ever the only signal: a badge always carries
 * its label and its number as text.
 */
export const statHue = {
  thw: token(0x2471b8),
  atk: token(0xc4302b),
  def: token(0x23875a),
  sch: token(0x4a4e6e),
  rec: token(0x17727e),
} as const;

/**
 * Section 01 — the ink opacity ladder. Opacity carries hierarchy so the palette
 * stays at five values.
 */
export const ink = {
  body: 1.0,
  secondary: 0.75,
  label: 0.6,
  meta: 0.5,
  disabled: 0.4,
  /** "Dim, don't hide": present but illegal this instant. */
  illegal: 0.38,
} as const;

/**
 * Section 06 — the entire depth model. 3px ink = a real object (screen, card,
 * CTA); 2.5px = a control inside one; 2px = a detail box inside that; dashed =
 * a slot that isn't filled.
 */
export const border = {
  object: 3,
  control: 2.5,
  detail: 2,
  /** Drawn dashed at `object` weight for an empty seat or a locked mode. */
  dashSegment: 6,
  dashGap: 5,
} as const;

/** Section 02 — type. Bangers shouts, Public Sans explains, Mono specs. */
export const font = {
  /** Sign painter, not a narrator: never below 12px, never a sentence. */
  display: "Bangers",
  body: "Public Sans",
  mono: "IBM Plex Mono",
} as const;

/**
 * The faces the Boot scene waits for before drawing. They are bundled
 * (`@fontsource/*`, imported by `main.ts`); these are the `document.fonts.load` specifiers, which need
 * a size and a weight to identify a face.
 */
export const WEB_FONTS = [
  "12px Bangers",
  "400 12px 'Public Sans'",
  "700 12px 'Public Sans'",
  "800 12px 'Public Sans'",
  "400 12px 'IBM Plex Mono'",
] as const;

/**
 * Section 02 — named type roles. `weight` is only ever 800 (labels), 700
 * (emphasis) or 400 (body): no 500/600 in product UI.
 */
export interface TypeSpec {
  readonly family: string;
  readonly size: number;
  readonly weight: 400 | 700 | 800;
  readonly lineHeight: number;
  readonly letterSpacing: number;
  readonly uppercase: boolean;
}

const display = (size: number, lineHeight: number, letterSpacing = 2): TypeSpec => ({
  family: font.display,
  size,
  weight: 400,
  lineHeight,
  letterSpacing,
  uppercase: true,
});

export const typeRole = {
  /** Screen titles, hero names. */
  screenTitle: display(64, 0.86),
  /** Bar titles, CTA labels, section rules. */
  barTitle: display(22, 0.9),
  /** Every number the player reads at a glance. */
  stat: display(20, 0.9, 1),
  statSmall: display(17, 0.9, 1),
  /** Public Sans 9/800, 1.2px tracking, uppercase. */
  label: { family: font.body, size: 9, weight: 800, lineHeight: 1.2, letterSpacing: 1.2, uppercase: true },
  /** Strong row title, 11/800. */
  rowTitle: { family: font.body, size: 11, weight: 800, lineHeight: 1.25, letterSpacing: 0, uppercase: false },
  emphasis: { family: font.body, size: 11, weight: 700, lineHeight: 1.4, letterSpacing: 0, uppercase: false },
  /** Rules text, card effects, advisory copy. Two sentences maximum on the table. */
  body: { family: font.body, size: 11, weight: 400, lineHeight: 1.45, letterSpacing: 0, uppercase: false },
  /** Specs, tokens, version stamps only. */
  mono: { family: font.mono, size: 11, weight: 400, lineHeight: 1.4, letterSpacing: 0, uppercase: false },
} as const satisfies Record<string, TypeSpec>;

/** Section 02 — minimum sizes, per form factor. */
export const minType = {
  phoneBody: 10,
  phoneLabel: 8,
  desktopBody: 11,
} as const;

/** Section 02 / 06 — touch targets. The action bar parks at the thumb on phone. */
export const hit = {
  /** Row action caps and the abilities row. */
  target: 44,
  /** The primary CTA / commit row. */
  primary: 52,
} as const;

/**
 * Section 06 — "numbers before prose": rules text on the table is capped, and
 * anything longer goes to the Inspect overlay. The cap is enforced by
 * `view/card-text.ts`, which is why it lives here as a number.
 */
export const RULES_TEXT_TABLE_LINES = 2;

/** Section 01 — the dot grid that marks the table felt, and nothing else. */
export const dotGrid = {
  onPaper: { spacing: 6, radius: 1, alpha: 0.1 },
  onInk: { spacing: 8, radius: 1, alpha: 0.13 },
} as const;

/** Section 04 — the threat meter. Fill is always Hero Red: threat is the clock you lose to. */
export const threatMeter = {
  fill: accent.heroRed,
  /** The hatched tail previews next phase's gain, so the loss is visible a round early. */
  previewAlpha: 0.45,
} as const;

/**
 * Section 03 — the selection ring, the one shadow in the system.
 * Static ring = committed choice. Pulsing ring = awaiting your tap.
 */
export const selectionRing = {
  width: 3,
  /** Gap between the object's own border and the ring. */
  offset: 3,
  color: accent.heroRed,
  glowWidth: 6,
  glowAlpha: accent.redGlowAlpha,
  pulseMs: 900,
} as const;

/** How long the readable state-change beats run. Halved to 0 under reduced motion. */
export const motion = {
  cardMoveMs: 220,
  damageMs: 260,
  threatMs: 300,
  phaseWipeMs: 420,
  statusStampMs: 340,
} as const;
