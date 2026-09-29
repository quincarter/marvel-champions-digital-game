/**
 * The board's own opportunistic-tip mount (guided mode G10e part 2, `docs/guided-mode.md` §4 G10e "Part 2
 * (display)"): the thin Phaser adapter that turns `view/tip-schedule.ts#advance`'s pacing decisions into a drawn
 * `McTipToast`. Unlike `BoardGuideMount` (the scripted-lesson rail/callout, only built for a guided tutorial run —
 * `appSession().guidedRun`), this mount is always built once a game exists: opportunistic tips are "the main use"
 * at the Full guide level in an ordinary, non-tutorial game (this box's own brief), not a tutorial-only feature.
 *
 * **Every Phaser widget here is rebuilt fresh on every draw, never held across redraws** — the same discipline
 * `scenes/board/guide-mount.ts`'s own header documents and for the identical reason: `BoardScene#draw` empties its
 * entire display list every redraw (`ui/destroy-children.ts`), so a `McTipToast` instance held as a field would
 * reference containers Phaser already destroyed out from under it the next time this module tried to update it.
 *
 * **Pacing lives in `view/tip-schedule.ts`, not here.** This module's own job is narrower: feed it observations,
 * remember which `Tip` (if any) is currently displayed, mark it seen the moment it's shown (`markTipSeen`, per the
 * brief: "mark a tip seen when it's shown"), auto-hide it the moment the player does anything else (the next fresh
 * store update, whatever it is), and never draw it while `blocked()` says an overlay or a lesson step already owns
 * the screen.
 *
 * **The tutorial's own suppressed ids** (`TUTORIAL_SUPPRESSED_TIP_IDS`): while a guided run is active, three
 * opportunistic-tip ids duplicate content the scripted lessons already teach on their own schedule — lesson 2
 * ("Hero & alter-ego") covers hand size differing by form, and lesson 4 ("The villain phase") covers both a boost
 * card flipping during an enemy's activation and a Spider-Sense-style draw on being attacked. The brief also names
 * "flip", "paying" and "thwart" as lesson content, but no opportunistic tip exists for any of those today (`flip`,
 * `resource`/`cost` and `thwart` are basic-concept glossary ids, never emitted by `tipsFor`'s own glossary catch-all,
 * which only surfaces keywords/statuses — `guide-tips.ts`'s own `glossaryTips` calls `rulesGlossaryOf` without
 * `includeConcepts`) — there's nothing to suppress for those, so this list only names the three that actually fire.
 */
import type { EngineDeps } from "@mc/engine";
import { POOL_DEPS } from "../../content/pool.js";
import { markTipSeen, withLevel } from "../../guide/guide-prefs.js";
import { guidePrefs, setGuidePrefs } from "../../guide/guide-store.js";
import { boardLayout, type Rect } from "../../view/layout.js";
import type { LessonObservation } from "../../view/lesson-model.js";
import type { Tip } from "../../view/guide-tips.js";
import { advance, initialTipScheduleState, type TipScheduleState } from "../../view/tip-schedule.js";
import { McTipToast, type McTipToastContent } from "../../ui/tip-toast.js";
import type { BoardScene } from "../board.js";

/** See this module's own header — the three opportunistic-tip ids the scripted tutorial already covers. */
export const TUTORIAL_SUPPRESSED_TIP_IDS: readonly string[] = [
  "situation:handSizeDiffers",
  "situation:boostFlip",
  "situation:drawOnAttack",
];

const NO_SUPPRESS: readonly string[] = [];

export class BoardTipMount {
  readonly #scene: BoardScene;
  readonly #deps: EngineDeps;
  #state: TipScheduleState = initialTipScheduleState;
  #displayed: Tip | null = null;
  /** This frame's toast, if one was drawn — kept only for a headless click-through's `debugRects` hook, mirroring
   * `BoardGuideMount`'s own `#lastPanel`/`#lastCallout`. */
  #lastToast: McTipToast | null = null;
  /** `blocked` as of the last `pollBlocked` call — see that method's own doc comment. Starts `true` so a tip
   * that happens to arm while the board is still mid-setup never fires a spurious redraw on its very first poll. */
  #lastBlocked = true;
  /** The keyboard/pad focus-region state (§3.10, §7 accessibility fix) — mirrors `BoardGuideMount`'s own fields
   * and reasoning: `McTipToast` is rebuilt fresh every draw and always starts unfocused, so the persistent index
   * lives here and is reapplied after every rebuild (`#applyRegionFocus`). */
  #regionActive = false;
  #regionFocusIndex = -1;

  constructor(scene: BoardScene, deps: EngineDeps = POOL_DEPS) {
    this.#scene = scene;
    this.#deps = deps;
  }

  /**
   * Feeds a fresh store observation in — call once per genuinely new command (`fresh` in `BoardScene#onState`,
   * never on an `inFlight`-only redelivery of the same version, which would otherwise auto-hide a tip the instant
   * it was shown). `blocked`/`guidedRun` are read fresh every call, since either can change without a new command
   * (an overlay opening is itself usually part of the very state this observation carries, but the villain-phase
   * walkthrough and a lesson step both close themselves with no dispatch — `pollBlocked` covers that half).
   */
  onObservation(observation: LessonObservation, blocked: boolean, guidedRun: boolean): void {
    // "Auto-hides when the player acts" (the brief): any later command at all clears whatever was showing, before
    // this call decides whether a new one should replace it.
    this.#displayed = null;

    const suppress = guidedRun ? TUTORIAL_SUPPRESSED_TIP_IDS : NO_SUPPRESS;
    const result = advance(this.#state, observation, this.#deps, guidePrefs(), { blocked, suppress });
    this.#state = result.state;
    if (result.tip) {
      this.#displayed = result.tip;
      setGuidePrefs(markTipSeen(guidePrefs(), result.tip.id));
    }
  }

  /** True while a tip is currently up, whether or not it's actually drawing this frame (`blocked` can hide it
   * without discarding it — see `draw`'s own doc comment). */
  get displayed(): Tip | null {
    return this.#displayed;
  }

  /** "Got it" / the top-right × — both simply dismiss (docs/guided-mode.md §4 G10e: "Got it and × to dismiss"). */
  dismiss(): void {
    this.#displayed = null;
  }

  /** "Turn tips off" (§4 G10e): a deliberate choice, so it saves — drops the guide level to Hints, the same
   * level a player who declines Full from the first-run chooser lands on. */
  turnOff(): void {
    setGuidePrefs(withLevel(guidePrefs(), "hints"));
    this.#displayed = null;
  }

  /**
   * Draws this frame's toast, or nothing — `blocked` (an overlay or a lesson step owns the screen right now) hides
   * it without discarding `#displayed`, so it reappears the moment the block lifts (`pollBlocked` below), the same
   * way `BoardGuideMount`'s own spotlight waits for `guideBannerClear()`.
   *
   * `_actionBarRect` is unused: `McTipToast` now places itself off the hand and play area
   * (`view/tip-toast-model.ts`, fixed post-merge — the first placement sat over the action bar and hand on both
   * desktop and phone), which this method derives itself via a fresh `boardLayout()` call rather than threading
   * every zone rect the board's own draw loop already computed through this call's own parameter list. `playerCount`
   * doesn't affect either zone's `y` in `view/layout.ts`'s own layout functions (only their `x`/`width`, which this
   * placement never depends on for a bottom-right/above-hand anchor), so a synthetic `{ playerCount: 1 }` gets the
   * real board's own `handRect`/`playAreaRect` for this frame's `viewport` without the board needing to hand them
   * over — kept as a parameter anyway so the call site (`scenes/board.ts`) doesn't need to change shape.
   */
  draw(viewport: Rect, tabbed: boolean, _actionBarRect: Rect | null, blocked: boolean): void {
    this.#lastToast = null;
    if (!this.#displayed || blocked) return;
    const layout = boardLayout(viewport, { playerCount: 1 });
    const content: McTipToastContent = {
      title: this.#displayed.title,
      body: this.#displayed.body,
      // The guide's own focus-region key hint (§3.10, §7 fix), same "only when nothing else needs the slot and
      // this surface isn't already focused" rule `BoardGuideMount#withFocusHint` uses — this toast has no
      // gate-escape nudge of its own to compete with, so the only guard here is `#regionActive`.
      hint: this.#regionActive ? null : "Press G (or X on a gamepad) to use these buttons.",
    };
    const toast = new McTipToast(this.#scene, {
      onGotIt: () => this.#act(() => this.dismiss()),
      onClose: () => this.#act(() => this.dismiss()),
      onTurnOff: () => this.#act(() => this.turnOff()),
    });
    toast.update(content, viewport, tabbed, layout.zones.hand!, layout.zones.playArea);
    this.#lastToast = toast;
    if (this.#regionActive) this.#applyRegionFocus();
  }

  /**
   * Call every frame (`BoardScene#update`, mirroring `BoardGuideMount#pollBanner`'s own reasoning): the villain-
   * phase walkthrough and a lesson step's own callout can both clear on their own client-side timer with no new
   * store dispatch, so a tip that was held back while `blocked` was true needs a redraw the moment it turns false
   * to actually reappear, not wait for the next unrelated redraw. A no-op unless a tip is actually waiting to be
   * shown, requesting a redraw only on the falling edge — never every frame — the same cheap-poll shape
   * `BoardGuideMount#pollBanner` already uses.
   */
  pollBlocked(blocked: boolean): void {
    if (this.#displayed !== null && this.#lastBlocked && !blocked) this.#scene.requestGuideRedraw();
    this.#lastBlocked = blocked;
  }

  /** Escape while a tip is drawn: closes its open term tooltip first, else dismisses it like "Got it". Returns false
   * (Escape falls through to the board's usual Pause handling) when no tip is on screen. */
  handleEscape(): boolean {
    if (!this.#lastToast) return false;
    this.#lastToast.handleEscape();
    this.#scene.requestGuideRedraw();
    return true;
  }

  /** Headless click-through hook only: this frame's toast rects, or `null` when nothing drew. */
  debugRects(): { readonly focusables: readonly Rect[]; readonly tooltipLink: Rect | null } | null {
    return this.#lastToast?.debugRects() ?? null;
  }

  /** True while this frame's toast has at least one keyboard-focusable control — mirrors
   * `BoardGuideMount#focusAvailable`'s own doc comment, same reasoning. */
  focusAvailable(): boolean {
    return (this.#lastToast?.debugRects().focusables.length ?? 0) > 0;
  }

  /** "G"/pad-X moving focus *into* the toast (§3.10, §7 fix). Returns whether there was anything to focus. */
  enterFocus(): boolean {
    if (!this.focusAvailable()) return false;
    this.#regionActive = true;
    this.#regionFocusIndex = 0;
    this.#applyRegionFocus();
    return true;
  }

  /** "G"/pad-X moving focus back out to the board, or the board's own self-heal once the toast disappears. */
  exitFocus(): void {
    this.#regionActive = false;
    this.#regionFocusIndex = -1;
    this.#lastToast?.blur();
  }

  /** Tab/Shift+Tab or an arrow key, while the toast owns focus — a no-op otherwise. */
  moveFocus(direction: 1 | -1): void {
    if (!this.#regionActive) return;
    const count = this.#lastToast?.debugRects().focusables.length ?? 0;
    if (count === 0) return;
    const from = this.#regionFocusIndex < 0 ? 0 : this.#regionFocusIndex;
    this.#regionFocusIndex = (((from + direction) % count) + count) % count;
    this.#applyRegionFocus();
  }

  /** Enter/A, while the toast owns focus — activates whichever control focus is currently on. */
  activateFocused(): void {
    if (!this.#regionActive) return;
    this.#lastToast?.activateFocused();
  }

  #applyRegionFocus(): void {
    this.#lastToast?.focusAt(this.#regionFocusIndex);
  }

  #act(fn: () => void): void {
    fn();
    this.#scene.requestGuideRedraw();
  }
}
