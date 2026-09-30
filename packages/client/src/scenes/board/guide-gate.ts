/**
 * The soft input gate a guided-mode "do this" step applies while it's teaching a specific control (§3.10,
 * `docs/guided-mode.md` §4 G4c): clicks outside the taught control(s) are inert, but the menu, Skip, Escape and
 * every guide surface's own controls (Collapse, Back, "Stop tutorial") stay live — none of those ever route through
 * `BoardController`'s gated entry points at all, so they're unaffected by construction, not by a special case here.
 *
 * **"No one should ever feel locked into a tutorial" (owner).** Three separate escapes, on top of "no gate at all"
 * always being the default:
 *  - `release()` — Escape's own explicit release. Lifts the gate immediately and fires `onGateReleased`, so the
 *    guide controller (G5c) can treat the step as skipped.
 *  - Two inert clicks (`noteInertClick`, called from every blocked entry point) lift the gate on their own and
 *    fire `onGateEscaped`, so a *third* click always lands on whatever it actually hit — a player who taps around
 *    trying to find the way out is never stuck for more than two taps, and the guide can offer "Want to do
 *    something else? Skip this step" rather than staying silent about it.
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

/** How many inert clicks (§3.10, owner: "no one should ever feel locked into a tutorial") lift a gate on their
 * own — the third click after that always lands on whatever it actually hit. */
const INERT_CLICKS_BEFORE_ESCAPE = 2;

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
   * fires `onGateReleased` — never `onGateEscaped`, since Escape is an explicit "let me out" and the two-strikes
   * path is a fallback for a player who doesn't know Escape does that. Returns whether a gate was actually open
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
   * one. Lifts the gate itself once the count reaches `INERT_CLICKS_BEFORE_ESCAPE`, firing `onGateEscaped` — the
   * *next* click after that is checked against "no gate at all" (every entry point re-reads `current`/`allows*`
   * fresh), so a third click never gets swallowed the way the first two were. No-op with no gate open.
   */
  noteInertClick(): void {
    if (this.#gate === null) return;
    this.#inertClicks += 1;
    if (this.#inertClicks < INERT_CLICKS_BEFORE_ESCAPE) return;
    const gate = this.#gate;
    this.#gate = null;
    this.#inertClicks = 0;
    gate.onGateEscaped?.();
  }
}
