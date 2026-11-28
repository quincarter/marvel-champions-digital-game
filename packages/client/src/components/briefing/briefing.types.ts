/**
 * What every Briefing element says to the scene: one `mc-briefing` event whose `detail` is a `BriefingDetail`. A feature's
 * own events share one name (`packages/ui/ARCHITECTURE.md`), and that name is in `GUARDED_EVENTS` (`dom/dom-region.ts`) so
 * the region holds them back while its scene is not taking input.
 *
 * - `back`, `open`, `watch`: the top bar's Back, the red Open / Continue issue button and the "Let people watch this game"
 *   toggle.
 * - `edit-decks` (no `seat`: the one a problem points at, else the "which deck?" chooser), `close-seat-picker`.
 * - `answer`: the pending call's answer (the options picked; empty for a decline).
 * - `toggle-easier`, `set-mode`: the easier-start card and a mode chip.
 * - `inspect`: a card picture or name pressed or held; `choice` adds a "Take this card" button to Inspect.
 */
export const BRIEFING_EVENT = "mc-briefing";

export type BriefingDetail =
  | { readonly type: "back" }
  | { readonly type: "open" }
  | { readonly type: "watch" }
  | { readonly type: "edit-decks"; readonly seat?: number }
  | { readonly type: "close-seat-picker" }
  | { readonly type: "answer"; readonly picked: readonly string[] }
  | { readonly type: "toggle-easier" }
  | { readonly type: "set-mode"; readonly action: string }
  | {
      readonly type: "inspect";
      readonly cardId: string;
      readonly name: string;
      readonly choice?: { readonly optionId: string; readonly label: string };
    };

/**
 * A step inside a call (a role chosen, Back, Confirm, Take, a filter, a page turned): it stays within the call that owns the
 * progress and never reaches the scene (the owner stops it).
 */
export const BRIEFING_STEP_EVENT = "mc-briefing-step";

export type BriefingStepDetail =
  | { readonly type: "role"; readonly id: string }
  | { readonly type: "back" }
  | { readonly type: "confirm" }
  | { readonly type: "read" }
  | { readonly type: "take"; readonly id: string }
  | { readonly type: "filter"; readonly aspect: string | null }
  | { readonly type: "toggle"; readonly id: string }
  | { readonly type: "page"; readonly by: number };

declare global {
  interface HTMLElementEventMap {
    "mc-briefing": CustomEvent<BriefingDetail>;
    "mc-briefing-step": CustomEvent<BriefingStepDetail>;
  }
}

/** Raises one `mc-briefing` from `source`. */
export function raiseBriefing(source: EventTarget, detail: BriefingDetail): void {
  source.dispatchEvent(new CustomEvent<BriefingDetail>(BRIEFING_EVENT, { detail, bubbles: true, composed: true }));
}

/** Raises one `mc-briefing-step` from `source`. */
export function raiseStep(source: EventTarget, detail: BriefingStepDetail): void {
  source.dispatchEvent(
    new CustomEvent<BriefingStepDetail>(BRIEFING_STEP_EVENT, { detail, bubbles: true, composed: true }),
  );
}

/** A card a picture or a name stands for; `choice` adds a "Take this card" button to its Inspect. */
export interface BriefingCard {
  readonly cardId: string;
  readonly name: string;
  readonly choice?: { readonly optionId: string; readonly label: string };
}

const DETAIL_TYPES: ReadonlySet<string> = new Set([
  "back",
  "open",
  "watch",
  "edit-decks",
  "close-seat-picker",
  "answer",
  "toggle-easier",
  "set-mode",
  "inspect",
]);

/** What a pressed action means to the screen (null: not a Briefing detail, so the owner of the press handles it). */
export function briefingDetailOf(action: unknown): BriefingDetail | null {
  if (typeof action !== "object" || action === null || !("type" in action)) return null;
  return DETAIL_TYPES.has((action as { type: string }).type) ? (action as BriefingDetail) : null;
}
