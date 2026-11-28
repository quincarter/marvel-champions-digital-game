/**
 * What the Art & Credits page says to its scene: one `mc-credits` event (bubbles and composed), listed in
 * `GUARDED_EVENTS` so the region holds it back while the scene is not taking input.
 */
export const CREDITS_EVENT = "mc-credits";

export type CreditsEventDetail = { readonly type: "back" };

export function creditsEvent(detail: CreditsEventDetail): CustomEvent<CreditsEventDetail> {
  return new CustomEvent<CreditsEventDetail>(CREDITS_EVENT, { detail, bubbles: true, composed: true });
}

declare global {
  interface HTMLElementEventMap {
    "mc-credits": CustomEvent<CreditsEventDetail>;
  }
}
