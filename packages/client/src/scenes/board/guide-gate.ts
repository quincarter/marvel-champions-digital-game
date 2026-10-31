/**
 * The input gate a guided-mode "do this" step applies while it's teaching a specific control (§3.10,
 * `docs/guided-mode.md` §4 G4c): clicks outside the taught control(s) are inert, but the menu, Skip, Escape and
 * every guide surface's own controls (Collapse, Back, "Stop tutorial") stay live — none of those ever route through
 * `BoardController`'s gated entry points at all, so they're unaffected by construction, not by a special case here.
 *
 * **Clicks outside the guide never land (owner, #554).** The gate used to lift after two inert clicks, which let a
 * third click run ahead of the lesson. The ways out are explicit instead:
 *  - `release()` — Escape's own explicit release. Lifts the gate immediately and fires `onGateReleased`, so the
 *    guide controller (G5c) can treat the step as skipped.
 *  - Two inert clicks (`noteInertClick`, called from every blocked entry point) fire `onGateEscaped`, so the guide
 *    offers "Want to do something else? Skip this step" to a player who taps around looking for the way out. The
 *    gate stays up.
 *  - `set(null)` clears the gate outright — what "Stop tutorial" calls.
 *
 * A plain nullable field couldn't hold the inert-click count between calls, so `BoardController` holds one
 * `GuideGateHolder` instance (the same shape `#readOnly` already is: a fact about input the controller checks
 * before every mutating entry point) rather than a bare `GuideGate | null`.
 */
import type { InstanceId } from "@mc/engine";
import type { BasicAction } from "../../view/highlights.js";

export interface GuideGate {
  /** Basic-bar action ids left clickable this step. */
  readonly actions: ReadonlySet<BasicAction>;
  /** Card instance ids left tappable this step — the taught card(s), and nothing else. */
  readonly cards: ReadonlySet<InstanceId>;
  /** Escape's own release fired this gate's step as skipped. */
  readonly onGateReleased?: () => void;
  /** Two inert clicks landed outside the allowed targets; the gate has already lifted itself. */
  readonly onGateEscaped?: () => void;
}

/** How many inert clicks earn the "Skip this step" nudge. */
const INERT_CLICKS_BEFORE_NUDGE = 2;

export class GuideGateHolder {
  #gate: GuideGate | null = null;
  #inertClicks = 0;

  /** The active gate, or `null` outside a gated step. */
  get current(): GuideGate | null {
    return this.#gate;
  }

  /** Sets (replaces) the active gate, or clears it with `null` — "Stop tutorial", and a fresh step replacing the
   * previous one, both call this directly. Always resets the inert-click count: a new step gets two fresh strikes. */
  set(gate: GuideGate | null): void {
    this.#gate = gate;
    this.#inertClicks = 0;
  }

  /** True when `action` may be acted on right now: no gate at all, or the gate names it. */
  allowsAction(action: BasicAction): boolean {
    return this.#gate === null || this.#gate.actions.has(action);
  }

  /** True when `id` may be tapped right now: no gate at all, or the gate names it. */
  allowsCard(id: InstanceId): boolean {
    return this.#gate === null || this.#gate.cards.has(id);
  }

  /**
   * Escape's own release: always lifts the gate immediately, regardless of the inert-click count so far, and
   * fires `onGateReleased` — never `onGateEscaped`, which only points a player who doesn't know Escape at Skip.
   * Returns whether a gate was actually open
   * (so the caller — board.ts's own Escape handling — knows whether to fall through to its usual behavior). A
   * no-op, returning `false`, with no gate open.
   */
  release(): boolean {
    const gate = this.#gate;
    if (gate === null) return false;
    this.#gate = null;
    this.#inertClicks = 0;
    gate.onGateReleased?.();
    return true;
  }

  /**
   * Counts one inert click — call this from a gated entry point's own "blocked" branch, never from an allowed
   * one. Fires `onGateEscaped` each time the count reaches `INERT_CLICKS_BEFORE_NUDGE`. The gate stays up. No-op with
   * no gate open.
   */
  noteInertClick(): void {
    if (this.#gate === null) return;
    this.#inertClicks += 1;
    if (this.#inertClicks < INERT_CLICKS_BEFORE_NUDGE) return;
    this.#inertClicks = 0;
    this.#gate.onGateEscaped?.();
  }
}
