/**
 * The "Hold on!" overlay (guided mode G9b, `docs/guided-mode.md` §4, tiles P06/T03): the pure content + layout
 * math for the overlay that intercepts End turn, Flip and a payment confirm whenever `guide-hints.ts#hintsFor`
 * has something to say. `scenes/hold-on.ts` turns this into Phaser draws; this module owns the two things worth
 * testing without a canvas — what the facts panel reads, and where the card lands.
 */
import type { Hint } from "./guide-hints.js";
import { formFactorFor, isTabbed, type Rect } from "./layout.js";

/** One row of the facts panel — "Threat 10 → 12", "Result YOU LOSE". */
export interface HoldOnFact {
  readonly label: string;
  readonly value: string;
}

export interface HoldOnContent {
  /** The heuristic's own title (`Hint.title`), shown as the overlay's subtitle under the "HOLD ON!" header. */
  readonly subtitle: string;
  /** `McTermText` markup — `Hint.body` unchanged. */
  readonly body: string;
  readonly facts: readonly HoldOnFact[];
  /** Null when the hint has no safe action to offer this turn (`Hint.safeAction`) — only "do it anyway" draws. */
  readonly safeLabel: string | null;
  readonly anywayLabel: string;
  readonly checkboxLabel: string;
}

/**
 * The facts panel's rows: one hard-coded shape per hint key, since each heuristic's `facts` record carries
 * different fields (`guide-hints.ts`'s own doc comment on each) — there's no generic way to turn an arbitrary
 * `Record<string, number>` into two labeled rows that read like the design tiles' scheme bar.
 */
function factsFor(hint: Hint): readonly HoldOnFact[] {
  const { facts } = hint;
  switch (hint.key) {
    case "schemeFinish":
    case "flipDanger": {
      // Both heuristics' bodies use the same "lose the game"/"complete this stage" wording (`guide-hints.ts`).
      const loses = hint.body.includes("lose the game");
      return [
        { label: "Threat", value: `${facts.threat} → ${facts.target}` },
        { label: "Result", value: loses ? "YOU LOSE" : "STAGE ADVANCES" },
      ];
    }
    case "lethal":
      return [
        { label: "HP", value: `${facts.currentHp} → 0` },
        { label: "Incoming", value: `${facts.bestCaseDamage} dmg` },
      ];
    case "wastedPay":
      return [
        { label: "Paid", value: `${facts.paid}` },
        { label: "Needed", value: `${facts.required}` },
      ];
  }
}

/** Turns a hint into the overlay's content. Pure — no Phaser measurement, no store reads. */
export function holdOnContentOf(hint: Hint): HoldOnContent {
  return {
    subtitle: hint.title,
    body: hint.body,
    facts: factsFor(hint),
    safeLabel: hint.safeAction?.label ?? null,
    anywayLabel: hint.anywayAction.label,
    checkboxLabel: "Don't warn me about this again",
  };
}

const TABLET_GAP = 24;
const EDGE_MARGIN = 16;

export interface HoldOnLayoutInput {
  readonly viewport: Rect;
  /** The box's own measured size — the scene lays out its content at the origin first, same as `end-turn-confirm.ts`. */
  readonly boxWidth: number;
  readonly boxHeight: number;
  /** The live main scheme's own on-screen rect this draw, or null when it isn't resolvable (phone tab elsewhere,
   * no game) — always falls back to the centred card in that case. */
  readonly schemeRect: Rect | null;
}

export interface HoldOnLayout {
  readonly box: Rect;
  /** A leader line from the box's near edge to the scheme's centre (T03) — null on the centred (P06) card. */
  readonly leader: { readonly from: Rect; readonly to: Rect } | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/**
 * P06's centred card on phone/tablet-portrait (`view/layout.ts#isTabbed`'s own tall-form-factor set), or — when
 * the live scheme rect is known and the viewport is wide enough for the long-table layout — T03's card anchored
 * beside the scheme with a leader line.
 */
export function holdOnLayoutOf(input: HoldOnLayoutInput): HoldOnLayout {
  const { viewport, boxWidth, boxHeight, schemeRect } = input;
  const formFactor = formFactorFor(viewport.width, viewport.height);

  if (schemeRect && !isTabbed(formFactor)) {
    const preferRight = schemeRect.x + schemeRect.width + TABLET_GAP + boxWidth <= viewport.x + viewport.width;
    const x = preferRight
      ? schemeRect.x + schemeRect.width + TABLET_GAP
      : Math.max(viewport.x + EDGE_MARGIN, schemeRect.x - TABLET_GAP - boxWidth);
    const y = clamp(
      schemeRect.y + schemeRect.height / 2 - boxHeight / 2,
      viewport.y + EDGE_MARGIN,
      viewport.y + viewport.height - boxHeight - EDGE_MARGIN,
    );
    const box: Rect = { x, y, width: boxWidth, height: boxHeight };
    const fromX = preferRight ? box.x : box.x + box.width;
    const from: Rect = { x: fromX, y: box.y + box.height / 2, width: 0, height: 0 };
    const to: Rect = {
      x: schemeRect.x + schemeRect.width / 2,
      y: schemeRect.y + schemeRect.height / 2,
      width: 0,
      height: 0,
    };
    return { box, leader: { from, to } };
  }

  const box: Rect = {
    x: viewport.x + (viewport.width - boxWidth) / 2,
    y: Math.max(viewport.y + EDGE_MARGIN, viewport.y + (viewport.height - boxHeight) / 2),
    width: boxWidth,
    height: boxHeight,
  };
  return { box, leader: null };
}
