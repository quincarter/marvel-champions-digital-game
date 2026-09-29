/**
 * The guide's thin Phaser adapter for the Board (guided mode G5c, `docs/guided-mode.md` §4): mounts
 * `GuideController` (`guide/guide-controller.ts`, pure) onto a live game, and turns its `view()` snapshot into
 * `McGuidePanel`/`McGuideCallout`/`McGuideSpotlight`/`McGuideTag` draws plus the board's own soft input gate
 * (`scenes/board/guide-gate.ts`). Desktop and tablet landscape get the rail (`McGuidePanel`); phone, phone
 * landscape and tablet portrait (`view/layout.ts`'s own `isTabbed`) get the anchored `McGuideCallout` instead,
 * with the same content and the same spotlight/tag, plus a one-shot auto-switch of the active phone tab when a
 * step's own anchor lives behind one the player isn't currently looking at (`#maybeSwitchTab`, G5c part 2).
 *
 * **Gate discipline**: `BoardScene.setGuideGate` is only ever called from `#syncGate`, and only when the current
 * step's own id actually changed — never on a plain redraw — per `docs/guided-mode.md` §4 G4c "For G5c": "set the
 * gate only on a step change, never per redraw" (a fresh `GuideGateHolder.set` resets the two-inert-clicks counter,
 * so calling it every frame would make the soft gate impossible to escape by clicking through it).
 *
 * **Banner discipline**: the spotlight/tag are held back while `BoardScene#guideBannerClear()` is false — the
 * round/phase band, or the villain-phase walkthrough overlay, is covering (or about to cover) the very thing being
 * taught (`docs/guided-mode.md` §4 G4c "For G5c": "delay the spotlight until the round/phase banner has cleared").
 * The panel itself is not held back: its rail sits beside the table, not over it, so there's nothing for the band
 * to collide with.
 *
 * **The defend-choice anchor is a known, deliberate special case, in two ways.** First, a `LessonAnchor` names
 * *what's being taught*, not *which of several open options* — the sheet can offer "No defense" alongside one or
 * more defenders, so lesson 4's own `{ kind: "choice", id: "defend" }` (`guide/tutorial-lessons.ts`) can't say
 * "Black Cat" on its own; this module names her card directly (`BLACK_CAT`) via `#syncChoicePick`. A later aspect
 * lesson with its own defend step (G10d) will need a real per-step way to name "which option" — a `LessonStep`
 * field, most likely — rather than a second hardcoded card here. Second, the `GUIDE PICK` stamp itself is drawn
 * by `ChoiceOverlay`, not by this module's own `McGuideSpotlight`/`McGuideTag` — see `#drawSpotlight`'s own
 * comment for why (a later-launched scene renders above Board, so a tag added to Board's own display list would
 * sit *underneath* the choice sheet's scrim).
 *
 * **Every Phaser widget here is rebuilt fresh on every `draw()` call, never held across redraws.** `BoardScene#draw`
 * empties its *entire* display list every single redraw (`ui/destroy-children.ts`'s own header: "what every
 * scene's redraw means by 'start from a blank screen'"), the same way every other Board zone module works
 * (`scenes/board/log.ts`'s `LogPanel.draw(scene, rect, …)` is the same shape). `McGuidePanel`/`McGuideSpotlight`/
 * `McGuideTag` were written assuming a persistent host scene that only they redraw (their own demo scenes:
 * `scenes/guide-panel-demo.ts` et al.) — holding one as a `BoardGuideMount` field and calling `.update()` on it
 * across draws crashes the moment a later `destroyChildren(this)` has already destroyed its container out from
 * under it (found in browser verification: "Cannot read properties of undefined (reading 'sys')" the first time a
 * board redraw fired after the panel first drew). So this module keeps only *plain state* across draws
 * (`#collapsed`, the controller itself) and constructs a fresh widget instance inside `draw()` whenever one needs
 * to appear this frame — cheap, and consistent with how every other Board widget already survives this scene's
 * own redraw discipline.
 */
import type { GameEvent } from "@mc/engine";
import { cardId } from "@mc/content";
import type { BoardScene } from "../board.js";
import type { ChoiceOverlay } from "../choice.js";
import type { InspectOverlay } from "../inspect.js";
import { SCENES } from "../keys.js";
import { showRoundDebrief } from "../round-debrief.js";
import {
  GuideController,
  type GuideControllerOptions,
  type GuideControllerView,
} from "../../guide/guide-controller.js";
import { guidePrefs, setGuideRunLevelOverride } from "../../guide/guide-store.js";
import { signal, surface, threatMeter, typeRole } from "../../tokens.js";
import { McGuideCallout } from "../../ui/guide-callout.js";
import { McGuidePanel, type GuidePanelExtraRow } from "../../ui/guide-panel.js";
import { McGuideSpotlight } from "../../ui/guide-spotlight.js";
import { McGuideTag } from "../../ui/guide-tag.js";
import { textStyle } from "../../ui/theme.js";
import { hatchRect } from "../../ui/widgets.js";
import { GUIDE_PANEL_COLLAPSED_WIDTH, guideRailWidthFor } from "../../view/guide-panel-model.js";
import { instanceOfCode, resolveAnchor, type AnchorFrame, type ResolvedAnchor } from "../../view/guide-anchor.js";
import { calloutContentOf } from "../../view/guide-callout-content.js";
import { formFactorFor, isTabbed, type BoardLayout, type PhoneTab, type Rect } from "../../view/layout.js";
import { currentStep, lessonList, type LessonAnchor, type LessonObservation } from "../../view/lesson-model.js";
import { logGateFor, type LogGate } from "../../view/log-gate-model.js";
import { payingOverrideFor, type ResolvedPayer } from "../../view/guide-paying-override.js";
import { shouldFireRoundDebrief, splitAtRoundBoundary } from "../../view/round-debrief-trigger.js";
import { schemeMeterRect } from "./schemes.js";

const RAIL_FORM_FACTORS: ReadonlySet<string> = new Set(["desktop", "tabletLandscape"]);
const BLACK_CAT = cardId("01002");
/** Lesson 4's own two board steps (guided mode G7c, `docs/guided-mode.md` §4 "Left for G7") — the only steps
 * whose rail shows the villain phase's own progress instead of the ordinary lesson list. */
const VILLAIN_PHASE_STEP_IDS: ReadonlySet<string> = new Set(["villain-phase-order", "declare-defender"]);
/** Where the engine's own `GameStep.kind` (villain phase only) lands among the tutorial's three rows — the same
 * order the villain-phase walkthrough narrates (`view/villain-walkthrough.ts`'s own numbered steps). Anything
 * past the third row (`passFirstPlayer`/`endOfRound`) reads as "all three are done" rather than a fourth row. */
const VILLAIN_STEP_ROW: Readonly<Record<string, number>> = {
  placeThreat: 0,
  enemyActivations: 1,
  dealEncounterCards: 2,
  revealEncounterCards: 2,
  passFirstPlayer: 3,
  endOfRound: 3,
};
const VILLAIN_ROW_LABELS: readonly string[] = ["Plan advances", "Rhino attacks you", "Draw an encounter card"];
/** Lesson 5's own thwart step (guided mode G7d, `docs/guided-mode.md` §5.1 tile D01) — the only step that draws
 * `#drawThreatPreview`'s projected-removal overlay on the main scheme's own meter. */
const THWART_STEP_ID = "thwart";

/**
 * The keyboard/pad focus-region hint (§3.10, §7 accessibility fix): shown in the rail/callout's own `nudge` slot
 * whenever nothing else is already using it and keyboard focus isn't already on this surface, so a player who
 * hasn't discovered "G" yet is told about it without a second, competing line of small text — `#panelContentOf`/
 * `#calloutHintOf` only ever fill this in when `view.panel.nudge` (G5c's own gate-escape line) is null.
 */
const FOCUS_REGION_HINT = "Press G (or the gamepad's X) to reach this panel's own buttons by keyboard.";

/**
 * Lesson 4's own rail extra rows (guided mode G7c): the villain phase's three steps, in order, with the current
 * one highlighted — read straight off the engine's own `GameState.step`, never re-derived, so the rail always
 * agrees with whatever the villain-phase walkthrough is narrating on the same frame. `null` for every step but
 * this lesson's own two (every other step's rail keeps its ordinary lesson list instead — `ui/guide-panel.ts`'s
 * own `lessons`/`extra` are mutually exclusive by convention, not enforced by the type).
 */
function villainPhaseExtraRowsOf(
  stepId: string,
  observation: LessonObservation,
): { readonly heading: string; readonly rows: readonly GuidePanelExtraRow[] } | null {
  if (!VILLAIN_PHASE_STEP_IDS.has(stepId)) return null;
  const gameStep = observation.game.step;
  const row = gameStep.phase === "villain" ? (VILLAIN_STEP_ROW[gameStep.kind] ?? 0) : 0;
  const rows = VILLAIN_ROW_LABELS.map((label, index) => ({ label, done: row > index, current: row === index }));
  return { heading: "This villain phase", rows };
}

/** `tutorial-lessons.ts`'s own lesson-2 payment step id — the only step whose rail shows the resource legend. */
const PLAY_BLACK_CAT_STEP_ID = "play-black-cat";

/** Lesson 2's own rail extra rows (owner's tutorial reorder, `docs/guided-mode.md` §4): the T02 tile's resource
 * legend, one row per resource type. Every row shares the same swatch — types are told apart by the letter
 * already in each row's label (`scenes/inspect.ts#resourcePipGlyph`'s own "never colour-only" rule), not by a
 * distinct swatch colour per type, so this stays consistent with how a resource pip reads everywhere else in the
 * client. Only the payment step shows it (`PLAY_BLACK_CAT_STEP_ID`); the callout surfaces (phone, tablet
 * portrait) get the step's own one-line `tip` instead — `McGuideCallout` has no `extra` rows at all. */
const RESOURCE_LEGEND_ROWS: readonly GuidePanelExtraRow[] = [
  // One line each: a status row has no room for a second line, and the step's own tip already says any type pays.
  { label: "E — Energy", swatch: signal.cost.hex },
  { label: "M — Mental", swatch: signal.cost.hex },
  { label: "P — Physical", swatch: signal.cost.hex },
  { label: "W — Wild: counts as any type", swatch: signal.cost.hex },
];

function resourceLegendExtraRowsOf(
  stepId: string,
): { readonly heading: string; readonly rows: readonly GuidePanelExtraRow[] } | null {
  return stepId === PLAY_BLACK_CAT_STEP_ID ? { heading: "Resource types", rows: RESOURCE_LEGEND_ROWS } : null;
}

/**
 * Board-side behavior guided mode G10d's aspect "Try it" runs opt out of, alongside the tutorial's own defaults
 * (both `true`, so every pre-existing `new BoardGuideMount(scene, options, observation)` call keeps its old
 * behavior unchanged): a short one-lesson aspect run has no round-boundary debrief content worth showing
 * (`docs/guided-mode.md` §4 G10d: "no debrief, no Log lock"), and never locks the Log tab — the tutorial's own
 * "Lesson 5" unlock story doesn't apply to a run that never reaches a lesson 5.
 */
export interface BoardGuideMountOptions {
  readonly lockLog?: boolean;
  readonly roundDebrief?: boolean;
}

export class BoardGuideMount {
  readonly #scene: BoardScene;
  readonly #controller: GuideController;
  readonly #lockLog: boolean;
  readonly #roundDebrief: boolean;
  #observation: LessonObservation;
  #collapsed = false;
  #lastGateStepId: string | null = null;
  /** True while the phone/tablet-portrait callout's own × is armed for a second tap — the inline "Stop the
   * tutorial?" confirm row (G11 fix wave 2, `ui/guide-callout.ts`'s own header). Plain mount-owned state, since
   * the callout is rebuilt fresh every `#drawCallout` call and has nowhere of its own to remember a tap. Reset
   * on every step change (`#syncGate`) so a stray confirm from a previous step never lingers onto the next one. */
  #stopConfirming = false;
  /** This frame's panel, if one was drawn — kept only so a headless click-through can reach its rects
   * (`debugPanelRects`); never read to decide what to draw next frame (that's `#collapsed`, plain state). */
  #lastPanel: McGuidePanel | null = null;
  /** This frame's phone/tablet-portrait callout, if one was drawn — the same "debug hook only" role `#lastPanel`
   * plays for the rail (`debugCalloutRects`), G5c part 2. */
  #lastCallout: McGuideCallout | null = null;
  /** `BoardScene#guideBannerClear()` as of the last `pollBanner` call — see that method's own doc comment. */
  #lastBannerClear = true;
  /** Whether the round debrief (guided mode G8 part 2) was active as of the last `pollBanner` call — the same
   * falling-edge redraw trick `#lastBannerClear` uses, for the same reason: `scene.stop()` (`RoundDebriefScene
   * #nextRound`) queues the actual shutdown rather than applying it synchronously, so the one `requestGuideRedraw`
   * call `onNextRound` makes can land on a frame where `scene.isActive(SCENES.roundDebrief)` is still stale-true —
   * `draw()`'s own early return would then leave the rail/panel paused with nothing left to ever un-pause them
   * (found in browser verification: lesson 5's own panel never came back after "Round 2 ▸"). */
  #lastDebriefActive = false;
  /** This frame's resolved anchor, if any — kept only for `debugAnchorRect` (G5c part 2 verification hook). */
  #lastResolved: ResolvedAnchor | null = null;
  /**
   * The step id the tab auto-switch decision was already made for (G5c part 2, `docs/guided-mode.md` §4 G5c
   * "Auto-switch the tab") — `undefined` matches nothing, so the very first step always gets a decision.
   * `#maybeSwitchTab` only ever *acts* the first time a given step id is seen here; every later draw for the same
   * step, whatever the player does with the tab bar in the meantime, is left alone — "do it only once per step,
   * so the player can switch away freely afterwards".
   */
  #tabSwitchStepId: string | null | undefined = undefined;
  /** The step id `#syncPayingOverride` last set (or cleared) an override for — see that method's own doc comment
   * for why this is tracked rather than re-derived from `PLAY_BLACK_CAT_STEP_ID` (guided mode G10d fix, any
   * card-play step with a `payWith` can drive this, not only the tutorial's own lesson 3). */
  #payingOverrideStepId: string | null = null;
  /**
   * The round debrief (guided mode G8 part 2, `docs/guided-mode.md` §4 G8, §3.10, §3.11): every `GameEvent` seen
   * so far in the round still in progress — reset at a `roundStarted` boundary (`noteRoundEvents`), not on every
   * `onObservation` call, since a store update can re-deliver the same command's `lastEvents` more than once (an
   * `inFlight` toggle notifies subscribers with an unchanged `version`) and double-counting would corrupt the
   * debrief's own "Worth remembering" heuristics (`view/round-debrief-model.ts`, which reads event counts).
   */
  #roundEvents: GameEvent[] = [];
  /** A finished round's own events, waiting for `#scene.guideBannerClear()` before the debrief actually opens
   * (`#tryShowDebrief`) — never opened mid-band or on top of the villain-phase overlay, the same discipline
   * `#drawSpotlight` already gives the spotlight/tag. */
  #pendingDebrief: { readonly round: number; readonly events: readonly GameEvent[] } | null = null;
  /** True once the run's own "all lessons done" debrief has fired — `noteRoundEvents`' own guard against firing it
   * again on every later round for the rest of the game (`docs/guided-mode.md` §4 G8 part 2: "while the tutorial
   * still has lessons left (or on the round where the last lesson completes)"). */
  #firedCompleteDebrief = false;
  /**
   * The keyboard/pad focus-region state (§3.10, §7 accessibility fix): true while `BoardScene`'s own "G"/pad-X
   * toggle has moved focus onto this mount's own rail/callout. Plain mount-owned state, like `#collapsed` — the
   * widget itself is rebuilt fresh every draw (this module's own header) and always starts unfocused, so the
   * *persistent* index has to live here and be reapplied after every rebuild (`#applyRegionFocus`).
   */
  #regionActive = false;
  /** The persisted focus index within whichever surface is current — see `#regionActive`'s own doc comment. */
  #regionFocusIndex = -1;

  constructor(
    scene: BoardScene,
    options: GuideControllerOptions,
    observation: LessonObservation,
    mountOptions: BoardGuideMountOptions = {},
  ) {
    this.#scene = scene;
    this.#observation = observation;
    this.#lockLog = mountOptions.lockLog ?? true;
    this.#roundDebrief = mountOptions.roundDebrief ?? true;
    this.#controller = new GuideController(
      {
        ...options,
        panelExtraFor: (step, obs) => villainPhaseExtraRowsOf(step.id, obs) ?? resourceLegendExtraRowsOf(step.id),
      },
      observation,
    );
  }

  /** Feeds a fresh store observation to the controller — call on every `BoardScene#onState`. */
  onObservation(observation: LessonObservation): void {
    this.#observation = observation;
    this.#controller.onObservation(observation);
  }

  /**
   * Feeds this command's own fresh events to the round debrief's own accumulator (guided mode G8 part 2) — call
   * once per genuinely new command (`BoardScene#onState`'s own `fresh`, mirroring `#openVillainWalkthrough`'s
   * call), **after** `onObservation` has already run for the very same events, so a lesson this batch just
   * finished (e.g. the villain-phase walkthrough's own last "Got it") is already reflected in `#controller.state`
   * by the time this decides whether the round that's ending is the one that completed the run.
   *
   * A `roundStarted` event always lands in the same batch as the `stepChanged` that crosses into the new round's
   * player phase (`view/phase-wipe.ts`'s own header) — this splits that batch at the boundary: everything before
   * it belongs to the round that just ended (queued as `#pendingDebrief`, shown once the round/phase band and the
   * villain-phase overlay have cleared), everything at/after it starts the new round's own accumulator.
   */
  noteRoundEvents(events: readonly GameEvent[]): void {
    if (this.#controller.hidden || !this.#roundDebrief) {
      this.#roundEvents = [];
      this.#pendingDebrief = null;
      return;
    }
    const split = splitAtRoundBoundary(this.#roundEvents, events);
    this.#roundEvents = [...split.carried];
    if (!split.finished) return;

    const state = this.#controller.state;
    if (!shouldFireRoundDebrief(state.doneLessonIds.length, state.lessons.length, this.#firedCompleteDebrief)) return;
    if (state.doneLessonIds.length >= state.lessons.length) this.#firedCompleteDebrief = true;
    this.#pendingDebrief = split.finished;
  }

  /**
   * Opens the queued round debrief once the round/phase band and the villain-phase overlay have both cleared
   * (`#scene.guideBannerClear()`, the same gate `#drawSpotlight` already waits on) — called every frame
   * (`pollBanner`), since the band clears on its own client-side clock, not from a store update.
   *
   * The run's own "all lessons done" debrief (`#firedCompleteDebrief` already set by `noteRoundEvents`) also swaps
   * the tutorial's forced-Full run override (`guide/start-tutorial.ts`) for a Hints one, so the rest of this game
   * plays at Hints and the debrief's selector shows Hints — "it drops to Hints unless the player picked Full in the
   * debrief's selector" (`docs/guided-mode.md` §5.1). The saved level is never written here (G6c: a replay from the
   * hub must not change the player's setting); a pick in the debrief's own selector is what saves.
   */
  #tryShowDebrief(): void {
    if (!this.#pendingDebrief) return;
    if (!this.#scene.guideBannerClear()) return;
    const { round, events } = this.#pendingDebrief;
    this.#pendingDebrief = null;
    const state = this.#controller.state;
    const allDone = state.doneLessonIds.length >= state.lessons.length;
    if (allDone) {
      setGuideRunLevelOverride("hints");
    }
    showRoundDebrief(this.#scene, {
      lessons: lessonList(state),
      round,
      events,
      level: guidePrefs().level,
      onNextRound: () => this.#scene.requestGuideRedraw(),
    });
  }

  /**
   * The Log tab/panel's own tutorial lock (guided mode G8 part 2, `docs/guided-mode.md` §3.11, `view/log-gate-
   * model.ts`) — `board.ts` reads this for both the phone tab rail (`drawPhoneTabs`) and the desktop/tablet-
   * landscape Log zone (`LogPanel.drawLocked`), so the same rule gates whichever surface is on screen.
   */
  logGate(): LogGate {
    if (this.#controller.hidden || !this.#lockLog) return { locked: false, reason: null };
    return logGateFor(true, lessonList(this.#controller.state));
  }

  /**
   * Escape's own release for a step with **no board gate at all** — a zone or choice anchor never sets one
   * (`guide/guide-controller.ts#gateFor`'s own doc comment: nothing to tap for "look at the main scheme", and
   * the choice sheet already owns input while it's open), so `BoardController.releaseGuideGate()` has nothing to
   * release and returns `false` for those steps. §3.10 ("Escape always works") applies to *every* guide surface,
   * not only a gated one, so the board's own Escape route (`BoardScene#actOnIntent`'s `"cancel"` case) falls
   * back to this whenever `releaseGuideGate()` didn't handle it. Returns whether there was anything to skip, so
   * the caller knows whether to fall through to its own cancel/Pause behavior.
   */
  handleEscape(): boolean {
    if (!this.#controller.view().active) return false;
    this.#controller.onGateReleased();
    this.#scene.requestGuideRedraw();
    return true;
  }

  /**
   * Call every frame (`BoardScene#update`, which already runs every frame for the hand's own flick) so the
   * spotlight/tag actually appear the moment a round/phase band or the villain-phase walkthrough clears on its
   * own timer, not only on the next store update. Without this, a step whose gate became clear while nothing was
   * dispatching (the common case: the band is a purely client-side animation with its own clock, not a reaction
   * to a command) would wait for the *next* unrelated redraw to ever show its spotlight — found in browser
   * verification: lesson 5's "Thwart it" step never got its ring until some other input happened to redraw the
   * board. Requests a redraw only on the false→true edge, never every frame, so this stays as cheap as the
   * `BoardScene#guideBannerClear()` check itself.
   */
  pollBanner(): void {
    if (this.#controller.hidden) return;
    const clear = this.#scene.guideBannerClear();
    if (clear && !this.#lastBannerClear) this.#scene.requestGuideRedraw();
    this.#lastBannerClear = clear;
    this.#tryShowDebrief();
    // The falling edge of the debrief itself (this method's own `#lastDebriefActive` doc comment) — resumes the
    // rail/panel/spotlight the frame Phaser actually finishes tearing the overlay down, even when that lands after
    // the one redraw `onNextRound` already asked for.
    const debriefActive = this.#scene.scene.isActive(SCENES.roundDebrief);
    if (!debriefActive && this.#lastDebriefActive) this.#scene.requestGuideRedraw();
    this.#lastDebriefActive = debriefActive;
  }

  /** True once nothing should show at all — "Stop tutorial", or the complete state's own "Close" (G5c part 2:
   * `GuideController#hidden`) — the host keeps calling `draw()` (a no-op past this point: `view()` always reports
   * `active: false`), it just never has to construct a fresh mount again. */
  get stopped(): boolean {
    return this.#controller.hidden;
  }

  /** True while a scripted lesson step's own callout/panel is actually on screen right now — not the waiting or
   * complete states, which have no `step` (`GuideController#view`'s own header). Guided mode G10e part 2 reads
   * this to hold back an opportunistic tip that would otherwise collide with the lesson surface on the same
   * screen (`docs/guided-mode.md` §4 G10e: "None while a scripted lesson step is active in a tutorial run"). */
  hasCurrentStep(): boolean {
    return this.#controller.view().step !== null;
  }

  /**
   * True while this frame's rail or callout has at least one keyboard-focusable control — `BoardScene` reads this
   * to decide whether "G" has anything to move focus onto, and to self-heal back to the board's own focus region
   * the moment the surface disappears out from under an active region focus (a step change with no controls, the
   * tutorial stopping mid-focus, …).
   */
  focusAvailable(): boolean {
    return (
      (this.#lastPanel?.debugRects().focusables.length ?? 0) > 0 ||
      (this.#lastCallout?.debugRects().focusables.length ?? 0) > 0
    );
  }

  /** "G"/pad-X moving focus *into* this surface (§3.10, §7 fix). Returns whether there was anything to focus. */
  enterFocus(): boolean {
    if (!this.focusAvailable()) return false;
    this.#regionActive = true;
    this.#regionFocusIndex = 0;
    this.#applyRegionFocus();
    return true;
  }

  /** "G"/pad-X moving focus *out* of this surface, back to the board — also called by `BoardScene`'s own
   * self-heal when the surface this mount was focused on disappears. */
  exitFocus(): void {
    this.#regionActive = false;
    this.#regionFocusIndex = -1;
    this.#lastPanel?.blur();
    this.#lastCallout?.blur();
  }

  /** Tab/Shift+Tab or an arrow key, while this surface owns focus — a no-op otherwise. */
  moveFocus(direction: 1 | -1): void {
    if (!this.#regionActive) return;
    const count =
      this.#lastPanel?.debugRects().focusables.length ?? this.#lastCallout?.debugRects().focusables.length ?? 0;
    if (count === 0) return;
    const from = this.#regionFocusIndex < 0 ? 0 : this.#regionFocusIndex;
    this.#regionFocusIndex = (((from + direction) % count) + count) % count;
    this.#applyRegionFocus();
  }

  /** Enter/A, while this surface owns focus — activates whichever control focus is currently on. */
  activateFocused(): void {
    if (!this.#regionActive) return;
    this.#lastPanel?.activateFocused();
    this.#lastCallout?.activateFocused();
  }

  /** Reapplies `#regionFocusIndex` to whichever widget instance is live this frame — called both right after a
   * fresh rebuild (`draw()`) and from `enterFocus`/`moveFocus` themselves. */
  #applyRegionFocus(): void {
    this.#lastPanel?.focusAt(this.#regionFocusIndex);
    this.#lastCallout?.focusAt(this.#regionFocusIndex);
  }

  /** Headless click-through hook only (never referenced by product code, JSON-safe): the current step's own id,
   * or `null` with nothing current (including the waiting/complete states — mirrors every other `?screen=…demo`
   * scene's own `__mc*Debug` accessor). */
  debugStepId(): string | null {
    return this.#controller.view().step?.id ?? null;
  }

  /** Headless click-through hook only: the panel's own nudge line, or `null` when none is armed. */
  debugNudge(): string | null {
    return this.#controller.view().panel?.nudge ?? null;
  }

  /** Debug-only: this frame's panel rects, for a headless script to click a real screen coordinate. `null` when
   * no panel drew this frame (off rail form factors, or nothing current). */
  debugPanelRects(): { readonly focusables: readonly Rect[]; readonly tooltipLink: Rect | null } | null {
    return this.#lastPanel?.debugRects() ?? null;
  }

  /** Debug-only: this frame's phone/tablet-portrait callout rects (G5c part 2), for a headless script to click a
   * real screen coordinate. `null` when no callout drew this frame (on a rail form factor, or nothing current). */
  debugCalloutRects(): { readonly focusables: readonly Rect[]; readonly tooltipLink: Rect | null } | null {
    return this.#lastCallout?.debugRects() ?? null;
  }

  /** Debug-only: the current step's own resolved anchor rect (G5c part 2 verification) — the same rect the
   * spotlight/tag would ring, whether or not the spotlight actually drew this frame (a banner covering it, or the
   * anchor living on a phone tab the player isn't on). `null` with no anchor, or nothing currently resolvable. */
  debugAnchorRect(): Rect | null {
    return this.#lastResolved?.rect ?? null;
  }

  /** The guide rail's own width to reserve in this frame's `boardLayout` call, or `null` off desktop/tablet
   * landscape, or once the guide is hidden — `BoardScene#draw` reads this *before* laying out the rest of the
   * table, so nothing the rail covers is also a drop target underneath it. */
  railOptionFor(viewport: Rect): { readonly side: "left"; readonly width: number } | null {
    if (this.#controller.hidden) return null;
    const formFactor = formFactorFor(viewport.width, viewport.height);
    if (!RAIL_FORM_FACTORS.has(formFactor)) return null;
    const width = this.#collapsed ? GUIDE_PANEL_COLLAPSED_WIDTH : guideRailWidthFor(viewport.width, formFactor);
    return { side: "left", width };
  }

  /**
   * The compact bottom guide strip's own content (guided mode G7c, `docs/guided-mode.md` §4 "Left for G7"), for
   * a scene launched *above* Board that covers the whole tabbed-layout canvas itself — the villain-phase
   * walkthrough and the defend choice sheet, both of which have no room for the full `McGuideCallout` inside
   * their own layouts. `null` whenever there's nothing to strip (no guided run, waiting/complete, or the current
   * step has neither a `short` nor a `tip` — `GuideController#view`'s own `stripText`). The Skip/Stop callbacks
   * are the same reducers the rail/callout's own header buttons call (`#act` redraws the whole board after).
   */
  stripContent(): {
    readonly text: string;
    readonly onSkip: () => void;
    readonly onStop: () => void;
    readonly onPrimary?: () => void;
    readonly primaryLabel?: string;
  } | null {
    const view = this.#controller.view();
    if (!view.active || !view.step || !view.stripText) return null;
    return {
      text: view.stripText,
      onSkip: () => this.#act(() => this.#controller.skip()),
      onStop: () => this.stop(),
      // "Got it" (guided mode G11 note): the strip's own way to dismiss an acknowledge step — see `ui/guide-strip
      // .ts#GuideStripContent.onPrimary`'s own doc comment. `view.panel` is always built alongside a current step
      // (`GuideController#view`), so `primaryLabel` here already reflects the step's own mode.
      ...(view.panel?.primaryLabel
        ? { onPrimary: () => this.#act(() => this.#controller.primary()), primaryLabel: view.panel.primaryLabel }
        : {}),
    };
  }

  /**
   * Draws the panel/callout, spotlight and tag for this frame (each a fresh instance — see this module's own
   * header), and syncs the board's own gate. `layout` is the very `BoardLayout` `BoardScene#draw` already built
   * this frame — `railOptionFor` told it how wide to leave the rail, so a rail-form-factor draw only ever puts
   * the panel inside that reserved space. Call *after* every zone has drawn (schemes, action bar, hand, …), since
   * resolving a card/action anchor reads the hit rects those draws just registered, and *before*
   * `destroyChildren` runs again (i.e. once per `BoardScene#draw`, same as everything else on the table).
   *
   * **The tab auto-switch can end this call early (G5c part 2).** The anchor is resolved once, up front, since
   * both the spotlight/tag and the phone/tablet-portrait callout need it. When that resolution says the anchor
   * lives on a phone tab the player isn't looking at, and this is the first draw for the current step,
   * `#maybeSwitchTab` calls `BoardScene#switchToTab`, which runs its own full `BoardScene#draw()` — including a
   * fresh call to this very method, this time matching — before returning here. This call has created nothing
   * yet at that point (the switch check runs before any `new McGuidePanel`/`McGuideCallout`/spotlight), so it
   * just returns rather than drawing a second, stale copy on top of what the nested redraw already put down.
   */
  draw(layout: BoardLayout, viewport: Rect): void {
    // Pauses the guide's own surfaces while the round debrief (guided mode G8 part 2) covers the table: no rail/
    // callout/spotlight/tag draws, and the board's own soft gate is released rather than left stale underneath an
    // overlay the player can't act through. `#scene.requestGuideRedraw()` after the debrief closes (`onNextRound`,
    // `#tryShowDebrief`) resumes them on the very next draw, once `scene.isActive` reports false again.
    if (this.#scene.scene.isActive(SCENES.roundDebrief)) {
      this.#lastPanel = null;
      this.#lastCallout = null;
      this.#lastResolved = null;
      this.#syncGate(null, null);
      return;
    }
    const formFactor = formFactorFor(viewport.width, viewport.height);
    const tabbed = isTabbed(formFactor);
    this.#syncPayingOverride(tabbed);
    const view = this.#controller.view();
    this.#syncInspectPick(view.anchor);
    this.#syncGate(view.step?.id ?? null, view.gate);
    this.#lastPanel = null;
    this.#lastCallout = null;

    const onRail = RAIL_FORM_FACTORS.has(formFactor);

    const resolved = this.#resolveAnchorRect(view.anchor, viewport);
    this.#lastResolved = resolved;
    if (tabbed && this.#maybeSwitchTab(view.step?.id ?? null, resolved?.tab ?? null)) return;

    if (onRail && view.active && view.panel) {
      const panel = new McGuidePanel(this.#scene, {
        side: "left",
        onBack: () => this.#act(() => this.#controller.back()),
        // The step's own `secondaryLabel` (guided mode G7d, "How do I stop it?") advances the same way the
        // primary button does — see `LessonStepCopy.secondaryLabel`'s own doc comment.
        onSecondary: () => this.#act(() => this.#controller.primary()),
        onPrimary: () => this.#act(() => this.#controller.primary()),
        // Waiting/complete have no current step to skip (`view.step` is null then) — the header's Skip control
        // only draws when `onSkip` is wired, so it's simply left out rather than shown as a no-op.
        ...(view.step ? { onSkip: () => this.#act(() => this.#controller.skip()) } : {}),
        onStop: () => this.stop(),
        onCollapse: () => this.#act(() => (this.#collapsed = true)),
        onExpand: () => this.#act(() => (this.#collapsed = false)),
      });
      if (this.#collapsed) panel.collapse();
      const chromeHeight = layout.zones.chrome?.height ?? 0;
      const railRect: Rect = {
        x: viewport.x,
        y: viewport.y + chromeHeight,
        width: this.railOptionFor(viewport)?.width ?? 0,
        height: viewport.height - chromeHeight,
      };
      panel.update(this.#withFocusHint(view.panel), railRect);
      this.#lastPanel = panel;
      if (this.#regionActive) this.#applyRegionFocus();
    } else if (tabbed && view.active && view.panel) {
      // Assigned directly here, in `draw()`'s own scope (mirroring `#lastPanel` just above), rather than inside
      // `#drawCallout` itself — TS's own narrowing of a private field only reliably tracks assignments made in the
      // same function body, not ones made by a called method.
      //
      // Clipped to stop above the hand/action bar, which sit at the bottom of every phone/tablet-portrait tab
      // regardless of which tab is active (`view/layout.ts`'s own `hand`/`actionBar` zones) — the callout's own
      // layout (`view/guide-callout-model.ts#guideCalloutLayoutOf`) always fits itself inside whatever viewport
      // it's given, so shrinking that viewport is enough to keep it clear of the controls it's often pointing a
      // "tap this" instruction *at*. Found in G11 QA (`docs/guided-mode.md` §4 G11): the waiting-state callout
      // ("Next: The villain phase...") sat flush against the bottom on 390×844, covering End Turn — the very
      // button it was telling the player to press.
      const calloutViewport: Rect = layout.zones.hand
        ? { ...viewport, height: layout.zones.hand.y - viewport.y }
        : viewport;
      this.#lastCallout = this.#drawCallout(view, resolved, calloutViewport);
      if (this.#regionActive) this.#applyRegionFocus();
    }

    this.#drawSpotlight(view.anchor, resolved, view.tagVariant, viewport);
    // The spotlight's own dim bands (`McGuideSpotlight#show`) bring themselves to the top of the display list on
    // every call, which would otherwise leave the rail/callout sitting under the dim (found in browser
    // verification, G5c fix: the yellow rail read muddy, since it isn't inside the spotlight's own cutout). The
    // rail sits beside the table, not over it, and the callout must render above the dim too (G5c part 2) — only
    // the board itself should ever be dimmed — so both are brought back above the dim/ring every frame either
    // drew, right after the spotlight, rather than the spotlight skipping their bounds (a real cutout carve-out
    // would have to track them too, for no benefit: neither is ever the thing being spotlit).
    if (this.#lastPanel) this.#scene.children.bringToTop(this.#lastPanel.container);
    if (this.#lastCallout) this.#scene.children.bringToTop(this.#lastCallout.container);
    this.#drawThreatPreview(view.step?.id ?? null);
  }

  /**
   * Resolves `anchor` to a screen rect once per draw, shared by the spotlight/tag and the phone/tablet-portrait
   * callout's own anchoring (G5c part 2) — both need the identical rect, and the tab-switch decision needs to
   * see it before either widget is built. Mirrors the pre-part-2 `#drawSpotlight`'s own resolution, unchanged:
   * a choice anchor is never resolved here (the choice sheet owns its own `GUIDE PICK` stamp, `#syncChoicePick`),
   * and `null` covers every other "nothing to show yet" case (no anchor, no game, or the anchor genuinely isn't
   * on screen right now).
   */
  #resolveAnchorRect(anchor: LessonAnchor | null, viewport: Rect): ResolvedAnchor | null {
    if (!anchor || anchor.kind === "choice" || !this.#observation.game) return null;
    const frame = this.#scene.guideAnchorFrame();
    const game = this.#observation.game;
    const perspectiveId = this.#observation.perspectiveId;
    const anchorFrame: AnchorFrame = {
      cardRects: frame.hitRects,
      focusRects: frame.focusRects,
      instanceOfCode: (code) => (perspectiveId ? instanceOfCode(game, perspectiveId, code) : null),
      mainSchemeInstanceId: frame.mainSchemeInstanceId,
    };
    return resolveAnchor(
      anchor,
      viewport,
      { playerCount: game.players.length, activeTab: this.#scene.activeTabName() },
      anchorFrame,
    );
  }

  /**
   * The tab auto-switch itself (G5c part 2, `docs/guided-mode.md` §4 G5c "Auto-switch the tab"): the *first* time
   * `stepId` is seen here, and only then, a non-null `tab` that doesn't match the board's own active tab is
   * switched to via `BoardScene#switchToTab` (which redraws on its own — see `draw()`'s own header for why this
   * method's caller must stop immediately when this returns `true`). Every later call for the same `stepId` is a
   * no-op read of `#tabSwitchStepId`'s guard, whatever the player has done with the tab bar since — that's what
   * lets them switch away freely without being yanked back (§3.10's spirit, applied to tabs rather than a gate).
   */
  #maybeSwitchTab(stepId: string | null, tab: PhoneTab | null): boolean {
    if (stepId === this.#tabSwitchStepId) return false;
    this.#tabSwitchStepId = stepId;
    if (!tab || this.#scene.activeTabName() === tab) return false;
    this.#scene.switchToTab(tab);
    return true;
  }

  /**
   * The phone/tablet-portrait callout (G5c part 2): the same `view.panel` content the rail draws, mapped to
   * `McGuideCalloutContent` (`calloutContentOf`). Anchored to `resolved`'s own rect only when the anchor is
   * actually showing on the current tab (`resolved.tab === null`) — when it isn't (the player switched away
   * after the one auto-switch, or a step's own anchor just doesn't live on this tab), the callout falls back to
   * `McGuideCallout`'s own anchor-less centered layout rather than pointing at a rect that isn't on screen; the
   * spotlight is hidden for the same reason (`#drawSpotlight`), but the callout stays up with its text either
   * way — the player already has the lesson's words, only the "look here" ring goes away.
   */
  #drawCallout(view: GuideControllerView, resolved: ResolvedAnchor | null, viewport: Rect): McGuideCallout | null {
    if (!view.panel) return null;
    const anchorRect = resolved && !resolved.tab ? resolved.rect : null;
    const callout = new McGuideCallout(this.#scene, {
      onPrimary: () => this.#act(() => this.#controller.primary()),
      // Back wins the callout's one secondary slot when both are set (never happens in the tutorial's own data —
      // `McGuidePanelContent.backLabel`'s own doc comment); a step's own `secondaryLabel` (guided mode G7d) fires
      // the same `primary()` call as the primary button, same as the rail above.
      ...(view.panel.backLabel
        ? { onSecondary: () => this.#act(() => this.#controller.back()) }
        : view.panel.secondaryLabel
          ? { onSecondary: () => this.#act(() => this.#controller.primary()) }
          : {}),
      // Waiting/complete have no current step to skip — same reasoning as the rail's own `onSkip` above.
      ...(view.step ? { onSkip: () => this.#act(() => this.#controller.skip()) } : {}),
      // The × never stops outright on its own tap (G11 fix wave 2) — it arms the inline confirm row, which
      // then fires the real `stop()` from its own "Stop" button, or backs out via "Keep going".
      onStopRequest: () => this.#act(() => (this.#stopConfirming = true)),
      onStop: () => this.stop(),
      onStopCancel: () => this.#act(() => (this.#stopConfirming = false)),
    });
    callout.update(
      {
        ...this.#withFocusHint(calloutContentOf(view.panel, Boolean(view.panel.backLabel))),
        confirmingStop: this.#stopConfirming,
      },
      anchorRect,
      viewport,
    );
    return callout;
  }

  /** Fills a step's own `nudge` slot with the guide's focus-region key hint (`FOCUS_REGION_HINT`'s own doc
   * comment) whenever nothing else is already using it and this surface isn't already keyboard-focused. */
  #withFocusHint<T extends { readonly nudge?: string | null }>(content: T): T {
    if (content.nudge || this.#regionActive) return content;
    return { ...content, nudge: FOCUS_REGION_HINT };
  }

  #drawSpotlight(
    anchor: ReturnType<GuideController["view"]>["anchor"],
    resolved: ResolvedAnchor | null,
    tagVariant: ReturnType<GuideController["view"]>["tagVariant"],
    viewport: Rect,
  ): void {
    // A choice anchor never gets Board's own spotlight/tag — see `ChoiceOverlay#guidePickInstanceId`'s own doc
    // comment for why (a later-launched scene renders *above* Board, so a tag added to Board's own display list
    // would sit underneath the choice sheet's scrim, not on top of it). The sheet draws its own `GUIDE PICK`
    // stamp instead, via `#syncChoicePick`.
    this.#syncChoicePick(anchor);
    if (!resolved || !this.#scene.guideBannerClear()) return;
    // `resolved.tab` set means the anchor isn't actually on the currently active phone tab right now — either
    // this step's one auto-switch (`#maybeSwitchTab`) hasn't happened yet this exact draw (it would already have
    // returned above), or the player switched away from it on their own since. Either way there's nothing to
    // ring on *this* screen — "hide the spotlight until they come back" (`docs/guided-mode.md` §4 G5c item 1) —
    // while the callout stays up with its text regardless (`#drawCallout`'s own doc comment).
    if (resolved.tab) return;
    new McGuideSpotlight(this.#scene).show(viewport, resolved.rect);
    if (tagVariant) new McGuideTag(this.#scene, tagVariant).update(resolved.rect);
  }

  /**
   * Lesson 5's own projected-removal preview (guided mode G7d, `docs/guided-mode.md` §5.1 tile D01: "4 → 3 /12"):
   * while the "Thwart it" step is up, redraws the main scheme's own meter (`schemes.ts#schemeMeterRect`, the very
   * rect `drawScheme` just painted this frame) with the portion Spider-Man's THW would remove hatched out, instead
   * of solid — the same "this is about to be gone" texture `McHpPlate`'s own Tough hatch uses. Reads the live THW
   * and threat off `BoardScene#guideBoardModel()` (this draw's own `BoardModel`, not re-derived from `GameState`)
   * rather than the engine directly, so this stays in step with whatever the board itself just showed. A no-op
   * with no board model yet, no THW this turn (an alter-ego's panel prints REC, not THW — `BoardModel.me.stats`'s
   * own doc comment), a THW of 0, the scheme's rect not on the current phone tab, or nothing left to remove.
   */
  #drawThreatPreview(stepId: string | null): void {
    if (stepId !== THWART_STEP_ID) return;
    const model = this.#scene.guideBoardModel();
    if (!model) return;
    const thwTile = model.me.stats.find((tile) => tile.label === "THW");
    const thw = thwTile ? Number.parseInt(thwTile.value, 10) : Number.NaN;
    if (!Number.isFinite(thw) || thw <= 0) return;
    const scheme = model.mainScheme;
    const current = scheme.threat;
    const projected = Math.max(0, current - thw);
    if (projected >= current || !scheme.meterMax || scheme.meterMax <= 0) return;
    const rect = this.#scene.guideAnchorFrame().hitRects.get(scheme.instanceId);
    if (!rect) return;

    const meter = schemeMeterRect(rect);
    const scene = this.#scene;
    const g = scene.add.graphics();
    g.fillStyle(surface.parchment.hex, 1).fillRect(meter.x, meter.y, meter.width, meter.height);
    const ratio = (value: number) => Math.min(1, Math.max(0, value) / scheme.meterMax!);
    const solidWidth = meter.width * ratio(projected);
    const removedWidth = meter.width * (ratio(current) - ratio(projected));
    g.fillStyle(threatMeter.fill.hex, 1).fillRect(meter.x, meter.y, solidWidth, meter.height);
    hatchRect(
      g,
      { x: meter.x + solidWidth, y: meter.y, width: removedWidth, height: meter.height },
      threatMeter.fill.hex,
      1,
      6,
      3,
    );
    g.lineStyle(2, surface.ink.hex, 1).strokeRect(meter.x, meter.y, meter.width, meter.height);
    const label = scheme.target !== null ? `${current} → ${projected} /${scheme.target}` : `${current} → ${projected}`;
    scene.add
      .text(
        meter.x + meter.width / 2,
        meter.y + meter.height / 2,
        label,
        textStyle(typeRole.statSmall, surface.ink.hex),
      )
      .setOrigin(0.5, 0.5);
  }

  /**
   * Tells the open declareDefender sheet which defender to stamp `GUIDE PICK` on — the tutorial's own Black Cat
   * (this module's own header explains why that card is hardcoded here rather than named generically). Clears
   * the sheet's pick whenever the current step isn't this particular choice step, so a stamp never survives past
   * the step that asked for it.
   */
  #syncChoicePick(anchor: ReturnType<GuideController["view"]>["anchor"]): void {
    const overlay = this.#scene.scene.get(SCENES.choice) as ChoiceOverlay | undefined;
    if (!overlay) return;
    const game = this.#observation.game;
    const perspectiveId = this.#observation.perspectiveId;
    if (anchor?.kind === "choice" && anchor.id === "defend" && game && perspectiveId) {
      overlay.setGuidePick(instanceOfCode(game, perspectiveId, BLACK_CAT));
    } else {
      overlay.setGuidePick(null);
    }
  }

  /**
   * Tells the Inspect overlay which card it should stamp `TRY THIS` on (guided mode G7b, `docs/guided-mode.md` §4
   * "Left for G7"): on a tabbed layout, tapping a hand card opens Inspect *before* the payment bar, covering the
   * board's own callout/spotlight entirely — the same "a later-launched scene above Board owns its own stamp"
   * shape `#syncChoicePick` already uses for the defend sheet, generalized to whatever card the current step's
   * own anchor names (never hardcoded here, unlike `#syncChoicePick`'s `BLACK_CAT` — a plain `{ kind: "card" }`
   * anchor already carries the code). Cleared whenever the current anchor isn't a card, so a stamp never survives
   * past the step that asked for it.
   */
  #syncInspectPick(anchor: LessonAnchor | null): void {
    const overlay = this.#scene.scene.get(SCENES.inspect) as InspectOverlay | undefined;
    if (!overlay) return;
    const game = this.#observation.game;
    const perspectiveId = this.#observation.perspectiveId;
    if (anchor?.kind === "card" && game && perspectiveId) {
      overlay.setGuidePick(instanceOfCode(game, perspectiveId, anchor.code));
    } else {
      overlay.setGuidePick(null);
    }
  }

  /**
   * Inspect's own compact guide strip content (guided mode G7b, `docs/guided-mode.md` §4 "Left for G7") — unlike
   * `stripContent()` above (the villain-phase walkthrough / defend sheet, which only ever narrate a step already
   * in progress), Inspect opens *before* the taught action has happened at all, so the strip has to say what to
   * do next, not just remind what the step is about. Reads the same `continueHint` the panel/callout's own
   * "do this to continue" slot shows (`GuideControllerView`'s `panel.continueHint`), which already folds in the
   * paying-for-cards override (`#syncPayingOverride`) — so this always agrees with whatever the board itself
   * would be telling the player if Inspect weren't covering it. `null` off a guided run, on an "acknowledge" step
   * (nothing to "do"), or once Inspect isn't showing the taught card (the caller only asks while it is).
   */
  inspectStripContent(): { readonly text: string; readonly onSkip: () => void; readonly onStop: () => void } | null {
    const view = this.#controller.view();
    if (!view.active || !view.step || !view.panel?.continueHint) return null;
    return {
      text: view.panel.continueHint,
      onSkip: () => this.#act(() => this.#controller.skip()),
      onStop: () => this.stop(),
    };
  }

  /**
   * Any card-play step whose own data names a single-card `payWith` (`LessonStepCopy.payWith`, guided mode G10d
   * fix — generalized off lesson 3's own tutorial-only special case, `docs/guided-mode.md` §4 G5c fix) really has
   * three targets the player has to hit in sequence — the signature card itself, then its payer, then Pay —
   * driven entirely by the live payment bar, which is client-side UI state `GuideController`'s own
   * `LessonObservation` never carries (it isn't part of engine `GameState`). That's why this method exists at
   * all rather than the lesson data driving it directly, even though the card codes and wording now come from
   * the step's own `copy` (`GuideStepOverride`'s own doc comment explains the split). This method's only job is
   * resolving instance ids and the live payment bar; the actual decision is `view/guide-paying-override.ts#
   * payingOverrideFor`, pure and unit-tested without a Phaser scene. A step with no `payWith` (e.g. Daredevil,
   * whose cost needs two cards together) is left alone entirely — its own `doThis`/`doThisTabbed` keeps showing
   * as-is.
   *
   * `tabbed` covers the same sub-step G7b added (`docs/guided-mode.md` §4 "Left for G7"): before the signature
   * card's been tapped at all, a tabbed layout swaps in the step's own `LessonStepCopy.doThisTabbed` ("Tap X,
   * then Play") in place of the desktop `doThis` ("Tap X to play her") — Inspect opens on the tap, so the action
   * isn't done yet the way the desktop wording implies.
   */
  #syncPayingOverride(tabbed: boolean): void {
    const step = currentStep(this.#controller.state);
    const anchor = step?.anchor;
    const payWith = step?.copy.payWith;
    if (!step || !anchor || anchor.kind !== "card" || !payWith || payWith.length === 0) {
      if (this.#payingOverrideStepId) this.#controller.setOverride(this.#payingOverrideStepId, null);
      this.#payingOverrideStepId = null;
      return;
    }
    this.#payingOverrideStepId = step.id;
    const game = this.#observation.game;
    const perspectiveId = this.#observation.perspectiveId;
    const subjectId = game && perspectiveId ? instanceOfCode(game, perspectiveId, anchor.code) : null;
    const player = game && perspectiveId ? game.players.find((p) => p.playerId === perspectiveId) : undefined;
    const payers: readonly ResolvedPayer[] = payWith.map((payer) => ({
      payer,
      instanceId:
        payer.kind === "handCard"
          ? game && perspectiveId
            ? instanceOfCode(game, perspectiveId, payer.code)
            : null
          : (player?.identity.instanceId ?? null),
    }));
    const paymentView = this.#scene.paymentView();
    const payment = paymentView
      ? { subject: paymentView.subject, spentOptionIds: Array.from(paymentView.spent.keys()) }
      : null;
    this.#controller.setOverride(step.id, payingOverrideFor(step, subjectId, payers, payment, tabbed));
  }

  /** Applies a controller reducer, then asks the host for a full board redraw — the same "the whole table
   * relayouts" shape every other board control uses (`BoardController`'s own `redraw` callback). */
  #act(fn: () => void): void {
    fn();
    this.#scene.requestGuideRedraw();
  }

  /** "Stop tutorial" (§3.10): ends guidance for this game, clears the board's own gate outright, and requests a
   * redraw so every guide surface disappears immediately — `draw()` won't recreate any of them once
   * `#controller.stopped` is true. The game keeps going. Public because Pause's own "Stop tutorial" entry
   * (`BoardScene.stopGuide`, G5c part 3) calls this from outside the board's own button wiring, not only the
   * guide panel/callout's own `onStop`. */
  stop(): void {
    this.#controller.stop();
    this.#scene.setGuideGate(null);
    this.#lastGateStepId = null;
    this.#stopConfirming = false;
    this.#scene.requestGuideRedraw();
  }

  /** Only calls `BoardScene.setGuideGate` when the current step's own id changed — never on a plain redraw (this
   * module's own header). Wraps `onGateEscaped` in a redraw request: two inert clicks arm the panel's `nudge`
   * line (`GuideController#onGateEscaped`) but that's plain-TS state with no Phaser object of its own to repaint
   * itself, so without this the nudge is computed and never actually shown — found in G11 QA (`docs/guided-mode.md`
   * §4 G11, findings 3/tablet). `onGateReleased` already gets its own redraw from `handleEscape`, above, for the
   * Escape path, but the gate itself also fires it for the board's own inert-click branches that don't go through
   * `handleEscape`, so it's wrapped here too rather than assuming every caller remembers to redraw. */
  #syncGate(stepId: string | null, gate: ReturnType<GuideController["view"]>["gate"]): void {
    if (stepId === this.#lastGateStepId) return;
    this.#lastGateStepId = stepId;
    // A fresh step also clears any armed Stop confirm from the one before it — the × question shouldn't outlive
    // the step it was asked on (G11 fix wave 2).
    this.#stopConfirming = false;
    this.#scene.setGuideGate(gate ? this.#withGateRedraw(gate) : null);
  }

  #withGateRedraw(
    gate: NonNullable<ReturnType<GuideController["view"]>["gate"]>,
  ): NonNullable<ReturnType<GuideController["view"]>["gate"]> {
    return {
      ...gate,
      onGateReleased: () => {
        gate.onGateReleased?.();
        this.#scene.requestGuideRedraw();
      },
      onGateEscaped: () => {
        gate.onGateEscaped?.();
        this.#scene.requestGuideRedraw();
      },
    };
  }

  /** No-op: every Phaser widget this module draws is already ephemeral, torn down by the Board's own
   * `destroyChildren` on its very next redraw (this module's own header) — kept only so `BoardScene` has a
   * single, uniform "tear the guide down" call at scene shutdown / a fresh game, whether or not that redraw
   * ever actually happens again. */
  destroy(): void {
    // Nothing owned here outlives a single `draw()` call.
  }
}
