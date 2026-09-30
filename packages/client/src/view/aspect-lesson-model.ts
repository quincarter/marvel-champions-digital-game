/**
 * The per-aspect lesson page's content and layout (guided mode G10c, `docs/guided-mode.md` §3.7, §3.10 and §5.4):
 * G10a's `ASPECT_GUIDES` (`guide/aspects.ts`) turned into what `scenes/aspect-lesson.ts` actually draws — the
 * signature cards resolved to real names/costs/art keys, and the "Try it" precon resolved to its hero's name/art,
 * both read from the app's own pool (`content/pool.ts`), never hardcoded. Pure data plus a pure layout, the same
 * split `view/how-to-win-model.ts` and `view/guide-chooser-model.ts` use.
 *
 * `scenes/aspect-lesson.ts` is a standalone scene for this box (G10c): wiring it into the "How to play" hub (G6c)
 * and the aspect chips' "Aspects ▸" link (G10b's `linkAvailable`/`linkReason`) is a follow-up once G6c lands.
 */
import type { CoreAspect } from "@mc/content";
import { aspectGuideOf } from "../guide/aspects.js";
import { CARDS_BY_ID, POOL_STARTER_DECKS } from "../content/pool.js";
import { formFactorFor, type FormFactor, type Rect } from "./layout.js";

/** One signature card, resolved from `AspectGuide.signatureCardCodes` against the pool. */
export interface AspectLessonSignatureCard {
  readonly cardId: string;
  readonly name: string;
  /** The printed resource cost, or `null` for a card type with none (there are none among today's picks, but a
   * future signature card swap could add one — draw no cost tag rather than a fabricated "0"). */
  readonly cost: number | null;
}

export interface AspectLessonContent {
  readonly aspect: CoreAspect;
  readonly name: string;
  readonly tagline: string;
  /** May use `[[id|label]]` glossary markup (`AspectGuide.whatItsFor`). */
  readonly whatItsFor: string;
  /** May use `[[id|label]]` glossary markup (`AspectGuide.pickItWhen`). */
  readonly pickItWhen: readonly string[];
  readonly signatureCards: readonly AspectLessonSignatureCard[];
  readonly heroCardId: string | null;
  readonly heroName: string | null;
  readonly preconId: string | null;
}

/**
 * This aspect's lesson content, or `null` when it has no `AspectGuide` yet (currently only `"pool"`, §3.7) —
 * `scenes/aspect-lesson.ts` should never be reached for that aspect; a caller that does should fall back rather
 * than draw an empty page.
 */
export function aspectLessonContent(aspect: CoreAspect): AspectLessonContent | null {
  const guide = aspectGuideOf(aspect);
  if (!guide) return null;

  const signatureCards: AspectLessonSignatureCard[] = guide.signatureCardCodes.map((code) => {
    const card = CARDS_BY_ID.get(code as string);
    if (!card) throw new Error(`aspect lesson: signature card ${code as string} not in the pool`);
    const cost = "cost" in card && typeof card.cost === "number" ? card.cost : null;
    return { cardId: card.id as string, name: card.name, cost };
  });

  let heroCardId: string | null = null;
  let heroName: string | null = null;
  if (guide.preconId) {
    const deck = POOL_STARTER_DECKS.find((d) => (d.id as string) === (guide.preconId as string));
    if (!deck) throw new Error(`aspect lesson: precon "${guide.preconId as string}" not in the pool`);
    const hero = CARDS_BY_ID.get(deck.identityCardId as string);
    if (!hero) throw new Error(`aspect lesson: hero identity ${deck.identityCardId as string} not in the pool`);
    heroCardId = hero.id as string;
    heroName = hero.name;
  }

  return {
    aspect,
    name: guide.name,
    tagline: guide.tagline,
    whatItsFor: guide.whatItsFor,
    pickItWhen: guide.pickItWhen,
    signatureCards,
    heroCardId,
    heroName,
    preconId: (guide.preconId as string | null) ?? null,
  };
}

export interface AspectLessonLayout {
  readonly formFactor: FormFactor;
  /** Tablet landscape/desktop: text (tagline, "What it's for", "Pick it when") in a left column, signature cards
   * and "Try it" stacked in a right column — the same wide-split judgement call `how-to-win-model.ts` and
   * `guide-chooser-model.ts` make where there's no wide design tile to follow. Phone/tablet portrait: one stacked
   * column, text then cards then Try it, matching the chooser/How to win's own narrow shape. */
  readonly wide: boolean;
  readonly header: Rect;
  readonly close: Rect;
  /** Content columns, each independently scrollable if its own drawn content runs taller (`ui/scroll-region.ts`).
   * `cards` equals `text` on narrow layouts — both flow into the same one-column stack, drawn in sequence by the
   * scene, not two overlapping regions. */
  readonly text: Rect;
  readonly cards: Rect;
  readonly gotIt: Rect;
}

const HEADER_HEIGHT = 56;
const CLOSE_WIDTH = 44;
const PAD = 24;
const NARROW_PAD = 16;
const FOOTER_HEIGHT = 60;
const GAP = 16;
const CONTENT_MAX_WIDTH = 1200;

function narrowLayout(width: number, height: number, formFactor: FormFactor): AspectLessonLayout {
  const pad = NARROW_PAD;
  const header: Rect = { x: 0, y: 0, width, height: HEADER_HEIGHT };
  const close: Rect = { x: pad, y: (HEADER_HEIGHT - CLOSE_WIDTH) / 2, width: CLOSE_WIDTH, height: CLOSE_WIDTH };
  const gotIt: Rect = { x: pad, y: height - PAD - FOOTER_HEIGHT, width: width - pad * 2, height: FOOTER_HEIGHT };
  const body: Rect = {
    x: pad,
    y: HEADER_HEIGHT + GAP,
    width: width - pad * 2,
    height: gotIt.y - GAP - (HEADER_HEIGHT + GAP),
  };
  return { formFactor, wide: false, header, close, text: body, cards: body, gotIt };
}

function wideLayout(width: number, height: number, formFactor: FormFactor): AspectLessonLayout {
  const pad = PAD;
  const contentWidth = Math.min(CONTENT_MAX_WIDTH, width - pad * 2);
  const contentX = (width - contentWidth) / 2;
  const header: Rect = { x: 0, y: 0, width, height: HEADER_HEIGHT };
  const close: Rect = { x: pad, y: (HEADER_HEIGHT - CLOSE_WIDTH) / 2, width: CLOSE_WIDTH, height: CLOSE_WIDTH };
  const gotIt: Rect = {
    x: contentX + contentWidth - 220,
    y: height - PAD - FOOTER_HEIGHT,
    width: 220,
    height: FOOTER_HEIGHT,
  };
  const bodyTop = HEADER_HEIGHT + GAP;
  const bodyHeight = gotIt.y - GAP - bodyTop;
  const textWidth = Math.round(contentWidth * 0.5);
  const cardsWidth = contentWidth - textWidth - GAP;
  const text: Rect = { x: contentX, y: bodyTop, width: textWidth, height: bodyHeight };
  const cards: Rect = { x: contentX + textWidth + GAP, y: bodyTop, width: cardsWidth, height: bodyHeight };
  return { formFactor, wide: true, header, close, text, cards, gotIt };
}

export function aspectLessonLayout(width: number, height: number): AspectLessonLayout {
  const formFactor = formFactorFor(width, height);
  const wide = formFactor === "desktop" || formFactor === "tabletLandscape";
  return wide ? wideLayout(width, height, formFactor) : narrowLayout(width, height, formFactor);
}
