/**
 * Input ownership while a screen waits on an answer (the deck picker's "Sending your deck"): every panel under the veil
 * is disarmed and made inert, so a finger already down on it releases into nothing, no field takes the caret by Tab, and
 * no key reaches a control. Lifting it gives the panels back.
 */
import { cancelPressesWithin } from "@mc/ui";

export function gatePanels(elements: readonly (HTMLElement | null | undefined)[], busy: boolean): void {
  for (const element of elements) {
    if (!element) continue;
    if (busy) {
      cancelPressesWithin(element);
      (element as { cancelHolds?: () => void }).cancelHolds?.();
      // A field with the caret gives it up before the panel stops taking focus.
      const active = element.shadowRoot?.activeElement as HTMLElement | null | undefined;
      active?.blur?.();
    }
    element.inert = busy;
  }
}
