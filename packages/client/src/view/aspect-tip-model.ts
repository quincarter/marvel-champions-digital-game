/**
 * The aspect-chip inline tip's content (guided mode G10b, `docs/guided-mode.md` §3 decision 7 and §5.4):
 * whichever short blurb an aspect chip/tile shows on hover (desktop) or tap-the-info-affordance (touch),
 * in Seats, Deck check and Deck builder. Pure lookup over G10a's `ASPECT_GUIDES`; `ui/aspect-tip.ts` draws
 * it, scenes stay thin.
 *
 * Reference material like the glossary (`view/term-text-model.ts`), so it shows at every guide level,
 * including Off (§3 §2 "the guide is a view" — this isn't gated by `guidePrefs()` at all, same as
 * `McTermText`/`McTooltip`).
 */
import type { CoreAspect } from "@mc/content";
import { aspectGuideOf } from "../guide/aspects.js";

export interface AspectTipContent {
  readonly aspect: CoreAspect;
  /** The aspect's display name ("Justice"), Bangers title. */
  readonly title: string;
  /** One line, e.g. "Thwarting — keeps threat off the scheme". */
  readonly tagline: string;
  /** The short inline tip, one line (`AspectGuide.tipLine`). */
  readonly tipLine: string;
  readonly linkLabel: string;
  /** False until G10c's Aspect lessons screen exists to receive this link — draw it dashed/unavailable. */
  readonly linkAvailable: boolean;
  /** The reason shown alongside a not-yet-available link ("Coming soon"), `null` once it's available. */
  readonly linkReason: string | null;
}

/**
 * The tip content for one aspect's chip/tile, or `null` when that aspect has no guide yet ('Pool, §3.7 —
 * `aspectGuideOf` only covers the playable aspects plus Basic). Callers should draw no info affordance at
 * all in that case, rather than an affordance that opens nothing.
 */
export function aspectTipContentOf(aspect: CoreAspect): AspectTipContent | null {
  const guide = aspectGuideOf(aspect);
  if (!guide) return null;
  return {
    aspect,
    title: guide.name,
    tagline: guide.tagline,
    tipLine: guide.tipLine,
    linkLabel: "Aspects ▸",
    linkAvailable: false,
    linkReason: "Coming soon",
  };
}
