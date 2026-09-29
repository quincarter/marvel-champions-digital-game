/**
 * The guide controller (guided mode G5c part 1, `docs/guided-mode.md` §4): the plain-TS glue between G5b's lesson
 * state machine (`view/lesson-model.ts`) and whatever's actually on screen. It owns no Phaser objects and reads no
 * live board draw — those live in the thin Phaser adapter (`scenes/board/guide-mount.ts`), which calls `view()`
 * every redraw and resolves `view().anchor` to a screen rect itself (`view/guide-anchor.ts#resolveAnchor`, which
 * needs the live draw's own hit rects). Kept this way so the actual lesson-advancing logic — which step is
 * current, what its copy says, which control is gated — is Vitest-tested with a real session core and no canvas.
 *
 * **G5b's own contract, followed here**: `observe` runs on every store update (`onObservation`) *and* again after
 * every button reducer (`acknowledge`/`back`/`skipLesson`) — a reducer can leave a predicate that's already true
 * (an "await" step whose `completes` predicate reads live state, not just `lastEvents`), and `observe` is the only
 * thing that notices that.
 *
 * **§3.10 "never locked in", as this module implements it**:
 *  - `skip()` ("Skip this step") is `view/lesson-model.ts`'s own `skipStep` — advances past only the current step
 *    (its own `when`/`completes` gates still apply to whatever comes next), never the whole run. `skipLesson`
 *    (which *does* end scripted lessons for the run) is kept only for `stop()`, below.
 *  - `stop()` ("Stop tutorial") calls `skipLesson`, plus marks itself `stopped` (every later `view()` call reports
 *    nothing at all) and records `markTutorialSkipped` in the guide prefs — the game keeps going, only guidance
 *    stops. The caller (the adapter) still has to clear the board's own input gate and tear down the panel/
 *    spotlight/tag itself; this module has no Phaser objects to hide.
 *  - Escape's own release (`GuideGate.onGateReleased`) counts the step as skipped, via the same `skip()`.
 *  - Two inert clicks (`GuideGate.onGateEscaped`) never advance anything on their own — they only arm the panel's
 *    `nudge` line ("Want to do something else? Skip this step"), so the player decides.
 *
 * **The waiting and complete states (G5c part 2, `docs/guided-mode.md` §4 G5c item 0).** `view()` no longer goes
 * blank whenever `currentStep` is `null` — that used to leave an empty rail with the board not reflowing, for as
 * long as a lesson's own `when` hadn't fired yet (e.g. round 1 between "Paying for cards" and "The villain
 * phase"). Instead:
 *  - **Waiting** (some lesson isn't done yet, none is current): the panel keeps showing the lesson list, with no
 *    anchor and no gate (nothing to spotlight or gate for "nothing's happening yet"), and a body naming the next
 *    not-done lesson and what starts it (`Lesson.waitingCopy`, built by `waitingPanelContent`).
 *  - **Complete** (every lesson is done): a short "Tutorial complete" panel with a `Close` primary action
 *    (`dismiss()`), also with no anchor/gate. The transition into this state is also where `markTutorialFinished`
 *    is recorded (`#apply`), once, the same moment `doneLessonIds` first reaches every lesson.
 *  - **Hidden**: `stop()` (§3.10) or `dismiss()` closing the finished panel — `view()` reports `active: false`
 *    either way, via the shared `hidden` getter, so the board mount's `railOptionFor` reflows to full width
 *    without having to know which of the two ended the run.
 */
import type { GameState, InstanceId, PlayerId } from "@mc/engine";
import type { McGuidePanelContent, GuidePanelLessonRow } from "../ui/guide-panel.js";
import type { McGuideTagVariant } from "../ui/guide-tag.js";
import { ACTION_TO_BASIC, instanceOfCode } from "../view/guide-anchor.js";
import type { BasicAction } from "../view/highlights.js";
import {
  acknowledge,
  back as lessonBack,
  currentLesson,
  currentStep,
  fillCopy,
  lessonList,
  observe,
  progressOf,
  skipLesson,
  skipStep,
  startLessons,
  type Lesson,
  type LessonAnchor,
  type LessonObservation,
  type LessonResult,
  type LessonRunnerState,
  type LessonStep,
} from "../view/lesson-model.js";
import type { GuideGate } from "../scenes/board/guide-gate.js";
import { guidePrefs, setGuidePrefs } from "./guide-store.js";
import { markLessonDone, markTutorialFinished, markTutorialSkipped } from "./guide-prefs.js";

const PRIMARY_LABEL = "Got it";
const NUDGE_TEXT = "Want to do something else? Skip this step";
/** Fallback for an `"await"` step whose copy has no `doThis` (`view/lesson-model.ts#LessonStepCopy`'s own doc
 * comment) — every scripted step in `guide/tutorial-lessons.ts` sets one, so this only ever shows for content
 * that hasn't been filled in yet. */
const GENERIC_CONTINUE_HINT = "Do this to continue";
/** The waiting state's own title, when there's no next-not-done lesson to name (shouldn't happen outside a test
 * fixture with a gap in its lesson data — `waitingPanelContent`'s own fallback). */
const WAITING_FALLBACK_TITLE = "Up next";
/** `GuideControllerOptions.runLabel`'s own fallback — every real caller sets one (`scenes/board.ts` passes
 * "First game" for the tutorial run), so this only shows for a test fixture that doesn't care what it says. */
const DEFAULT_RUN_LABEL = "Guide";
const COMPLETE_TITLE = "Tutorial complete";
const COMPLETE_BODY =
  "Nice work — you've learned the core loop. Keep playing, or find the aspect lessons any time from " +
  "Settings ▸ Guide.";
const COMPLETE_PRIMARY_LABEL = "Close";

export interface GuideControllerOptions {
  readonly lessons: readonly Lesson[];
  /** Lesson ids to treat as already complete before this run starts — the tutorial's lesson 1 ("How to win") is
   * its own pre-game screen (G6b), not a board step, so the board-side controller starts with it already done
   * rather than running it (`docs/guided-mode.md` §4 G5c). */
  readonly alreadyDone?: readonly string[];
  /** Content-derived `fillCopy` values (a scheme's scaled target, ...) a step's copy needs beyond what
   * `LessonObservation` resolves on its own (`view/lesson-model.ts`'s own `fillCopy` doc comment). Omit for none. */
  readonly extraFor?: (
    step: LessonStep,
    observation: LessonObservation,
  ) => Readonly<Record<string, string | number>> | undefined;
  /**
   * This run's own name, shown beside the `GUIDE` stamp while waiting or complete (`waitingPanelContent`/
   * `completePanelContent`, below) — "FIRST GAME" for the tutorial. A current step's own panel never uses this:
   * it shows "Lesson N of M" instead (`view()`'s own `contextLabel`), which already names the run implicitly.
   * Defaults to `DEFAULT_RUN_LABEL` ("Guide") for a caller that doesn't care, e.g. a test fixture — every real
   * caller sets one, so a duplicated "GUIDE GUIDE" stamp+label (the `GUIDE` stamp is drawn separately,
   * `ui/guide-panel.ts`) never reaches a real run.
   */
  readonly runLabel?: string;
}

/** Everything the Phaser adapter needs to draw one frame. `anchor` is semantic — resolving it to a screen rect is
 * the adapter's own job, since that needs the live board draw's hit rects (`view/guide-anchor.ts`). */
export interface GuideControllerView {
  readonly step: LessonStep | null;
  readonly panel: McGuidePanelContent | null;
  readonly anchor: LessonAnchor | null;
  readonly tagVariant: McGuideTagVariant | null;
  /** Built fresh every `view()` call, but meant to be applied to the board only on a step change (the adapter's
   * own job — `docs/guided-mode.md` §4 G4c "For G5c": "set the gate only on a step change, never per redraw").
   * Always `null` while waiting or complete (this module's own header) — there's nothing to gate either. */
  readonly gate: GuideGate | null;
  /** False once nothing should show at all: `stop()` was called, or the finished panel was closed (`dismiss()`).
   * True for a waiting or complete `panel`, same as for a current `step` — see this module's own header. */
  readonly active: boolean;
}

/**
 * A step's anchor/`doThis` copy, overridden for this frame only — the paying-for-cards lesson's own sub-steps
 * (`docs/guided-mode.md` §4 G5c): "Play Black Cat" is really three targets in sequence (Black Cat, then the
 * source card to tap, then Pay), driven by live payment-bar state the lesson data can't see (it isn't part of
 * `LessonObservation` — a payment is client-side UI state, not engine `GameState`). The adapter (`scenes/board/
 * guide-mount.ts`) computes this from the live payment bar and calls `setOverride` before reading `view()`, the
 * same "the mount owns the tutorial-specific card code" shape `#syncChoicePick`'s own `BLACK_CAT` already uses —
 * this stays a data override rather than a scattered conditional in the Phaser draw code itself.
 */
export interface GuideStepOverride {
  readonly anchor?: LessonAnchor;
  readonly doThis?: string;
}

export class GuideController {
  #state: LessonRunnerState;
  #observation: LessonObservation;
  #stopped = false;
  /** Set by `dismiss()` — the complete state's own "Close" (this module's own header's "Hidden"). */
  #dismissed = false;
  #nudge: string | null = null;
  #override: { readonly stepId: string; readonly override: GuideStepOverride } | null = null;
  readonly #extraFor: GuideControllerOptions["extraFor"];
  readonly #runLabel: string;

  constructor(options: GuideControllerOptions, observation: LessonObservation) {
    this.#extraFor = options.extraFor;
    this.#runLabel = options.runLabel ?? DEFAULT_RUN_LABEL;
    this.#state = startLessons(options.lessons, options.alreadyDone ?? []);
    this.#observation = observation;
    this.#runObserve();
  }

  /** Feeds a fresh store observation in — call on every session-store update (this module's own contract, above). */
  onObservation(observation: LessonObservation): void {
    this.#observation = observation;
    if (this.hidden) return;
    this.#runObserve();
  }

  /** The panel/callout's primary button. On an "acknowledge" step, `view/lesson-model.ts#acknowledge`'s own
   * forward action; on the complete state's own "Close", `dismiss()` instead (there's no current step for
   * `acknowledge` to advance) — the adapter always wires the same `primary()` call regardless of which panel is
   * showing, same as every other button here. A no-op once hidden, with no lesson current and not complete
   * (waiting has no primary button to press), or on an "await" step. */
  primary(): void {
    if (this.hidden) return;
    if (!currentStep(this.#state) && this.#isComplete()) {
      this.dismiss();
      return;
    }
    this.#apply(acknowledge(this.#state));
    this.#runObserve();
  }

  /** The footer's Back button. */
  back(): void {
    if (this.hidden) return;
    this.#nudge = null;
    this.#apply(lessonBack(this.#state));
  }

  /** "Skip this step" (§3.10) — advances past only the current step (`view/lesson-model.ts#skipStep`), then
   * re-runs `observe` so a lesson that finished on this call (or a next lesson whose `when` already holds) is
   * picked up immediately, same as every other reducer here. A no-op while waiting or complete (`skipStep`'s own
   * no-op rule with nothing current) — the adapter only wires this button while a step is actually current
   * (`scenes/board/guide-mount.ts`). */
  skip(): void {
    if (this.hidden) return;
    this.#nudge = null;
    this.#apply(skipStep(this.#state));
    this.#runObserve();
  }

  /** "Stop tutorial" (§3.10): ends guidance for this game outright. The caller still has to clear the board's own
   * gate (`BoardScene.setGuideGate(null)`) and tear down the panel/spotlight/tag — this module owns none of them. */
  stop(): void {
    if (this.hidden) return;
    this.#stopped = true;
    this.#nudge = null;
    this.#apply(skipLesson(this.#state));
    setGuidePrefs(markTutorialSkipped(guidePrefs()));
  }

  /** Closes the complete state's own panel (its "Close" primary action, routed there by `primary()`) — distinct
   * from `stop()`: the tutorial already finished normally, so this never touches guide prefs, it only hides the
   * guide surface for the rest of this game via the shared `hidden` getter. */
  dismiss(): void {
    this.#dismissed = true;
  }

  get stopped(): boolean {
    return this.#stopped;
  }

  /** True once nothing should show at all — `stop()` (§3.10) or `dismiss()` (the complete state's own "Close").
   * `view()` reports `active: false` exactly when this is true (this module's own header's "Hidden"). */
  get hidden(): boolean {
    return this.#stopped || this.#dismissed;
  }

  get state(): LessonRunnerState {
    return this.#state;
  }

  /**
   * Sets (or clears, with `null`) this frame's anchor/`doThis` override for `stepId` — see `GuideStepOverride`'s
   * own doc comment. A no-op call every draw (the adapter's own idempotent-set shape, mirroring `ChoiceOverlay
   * #setGuidePick`) is expected; this only actually changes anything when the override itself changed.
   */
  setOverride(stepId: string, override: GuideStepOverride | null): void {
    this.#override = override ? { stepId, override } : null;
  }

  /** Everything the Phaser adapter needs to draw this frame. */
  view(): GuideControllerView {
    if (this.hidden) {
      return { step: null, panel: null, anchor: null, tagVariant: null, gate: null, active: false };
    }
    const step = currentStep(this.#state);
    if (!step) {
      // Waiting or complete (this module's own header) — no anchor, no gate either way: waiting has nothing on
      // the board to spotlight yet, and the finished panel isn't teaching anything.
      const panel = this.#isComplete()
        ? completePanelContent(this.#runLabel)
        : waitingPanelContent(this.#state, this.#runLabel);
      return { step: null, panel, anchor: null, tagVariant: null, gate: null, active: true };
    }
    const override = this.#override?.stepId === step.id ? this.#override.override : null;
    const anchor = override?.anchor ?? step.anchor ?? null;
    const lesson = currentLesson(this.#state);
    const extra = this.#extraFor?.(step, this.#observation);
    const copy = fillCopy(step.copy, this.#observation, extra);
    const progress = progressOf(this.#state);
    const panel: McGuidePanelContent = {
      contextLabel: progress
        ? `Lesson ${progress.doneCount + 1} of ${progress.totalCount}`
        : (lesson?.title ?? "Guide"),
      lessons: lessonRowsOf(this.#state, progress),
      stepLabel: copy.stepLabel ?? null,
      title: copy.title,
      body: copy.body,
      tip: copy.tip ?? null,
      progressTicks: progress?.totalSteps ?? null,
      progressCurrent: progress?.stepIndex ?? null,
      backLabel: progress && progress.stepIndex > 0 ? "Back" : null,
      primaryLabel: step.mode === "acknowledge" ? PRIMARY_LABEL : null,
      continueHint: step.mode === "await" ? (override?.doThis ?? copy.doThis ?? GENERIC_CONTINUE_HINT) : null,
      nudge: this.#nudge,
    };
    const tagVariant = tagVariantOf(anchor);
    const gate = step.anchor ? gateFor(step, this.#observation.game, this.#observation.perspectiveId, this) : null;
    return { step, panel, anchor, tagVariant, gate, active: true };
  }

  #runObserve(): void {
    this.#apply(observe(this.#state, this.#observation));
  }

  /**
   * Applies a reducer's result, records every lesson it finished, and — the moment `doneLessonIds` first covers
   * every lesson in this run — records `markTutorialFinished` too (this module's own header's "Complete"). Checked
   * before/after rather than "did `lessonDone` include the last lesson", because `skipStep`/`acknowledge` are the
   * only reducers that ever add to `doneLessonIds` one at a time; comparing the whole set is simpler than trusting
   * every call site to fold the last id correctly, and it's cheap (`lessons.length` is 5 in the tutorial).
   */
  #apply(result: LessonResult): void {
    const wasComplete = this.#isComplete();
    this.#state = result.state;
    for (const id of result.lessonDone) setGuidePrefs(markLessonDone(guidePrefs(), id));
    if (!wasComplete && this.#isComplete()) setGuidePrefs(markTutorialFinished(guidePrefs()));
  }

  /** True once every lesson in this run is done and none is current — the "complete" state (this module's own
   * header). `!skipped` excludes a run `stop()` ended early via `skipLesson`, which also clears `active` but
   * leaves `doneLessonIds` short of the full set (unless the player happened to finish the last lesson on the
   * very same call, in which case `stop()` never runs at all) — without this guard, a stopped-early run would
   * read as "complete" the moment its own final `doneLessonIds` write landed. */
  #isComplete(): boolean {
    return (
      !this.#state.skipped &&
      this.#state.active === null &&
      this.#state.doneLessonIds.length >= this.#state.lessons.length
    );
  }

  /** Escape's own release (§3.10 "Escape always works"): the step counts as skipped. The gate itself is already
   * released by the caller (`GuideGateHolder.release`) before this ever runs — this only advances the lesson.
   * Public because a `GuideGate`'s `onGateReleased` is built from it (`gateFor`, below), not because a widget
   * button calls it directly — Escape/2-inert-clicks are the board's own input path, not a button. */
  onGateReleased(): void {
    this.skip();
  }

  /** Two inert clicks lifted the gate on their own (§3.10) — arms the panel's nudge line rather than acting for
   * the player. Same visibility note as `onGateReleased`. */
  onGateEscaped(): void {
    this.#nudge = NUDGE_TEXT;
  }
}

function lessonRowsOf(
  state: LessonRunnerState,
  progress: ReturnType<typeof progressOf>,
): readonly GuidePanelLessonRow[] {
  return lessonList(state).map((entry) => ({
    id: entry.lesson.id,
    label: entry.lesson.title,
    status: entry.status,
    progress: entry.status === "current" && progress ? `${progress.stepIndex + 1} / ${progress.totalSteps}` : null,
  }));
}

/** The first not-done lesson, in this run's own order — the "next" lesson the waiting state names. `null` only
 * when every lesson is already done (`view()` shows the complete state in that case, so this is never called). */
function nextNotDoneLesson(state: LessonRunnerState): Lesson | null {
  return state.lessons.find((lesson) => !state.doneLessonIds.includes(lesson.id)) ?? null;
}

/**
 * The waiting state's own panel content (this module's own header): the lesson list, unchanged, plus a body
 * naming the next not-done lesson and what starts it (`Lesson.waitingCopy`) — "Next: {title}. {waitingCopy}",
 * split across the panel's own Bangers title and body text. No `tip`/progress/back/primary/continueHint: there's
 * no step here to show any of that for.
 */
function waitingPanelContent(state: LessonRunnerState, runLabel: string): McGuidePanelContent {
  const next = nextNotDoneLesson(state);
  return {
    contextLabel: runLabel,
    lessons: lessonRowsOf(state, null),
    stepLabel: null,
    title: next ? `Next: ${next.title}` : WAITING_FALLBACK_TITLE,
    body: next?.waitingCopy ?? "",
    tip: null,
    progressTicks: null,
    progressCurrent: null,
    backLabel: null,
    primaryLabel: null,
    continueHint: null,
    nudge: null,
  };
}

/** The complete state's own panel content (this module's own header): a short "Tutorial complete" message with a
 * `Close` primary action, routed by `primary()` to `dismiss()`. No lesson list — there's nothing left upcoming to
 * show, and the debrief/hub screens (G8/G6c) are where "what's next" (Aspects) actually lives. */
function completePanelContent(runLabel: string): McGuidePanelContent {
  return {
    contextLabel: runLabel,
    lessons: null,
    stepLabel: null,
    title: COMPLETE_TITLE,
    body: COMPLETE_BODY,
    tip: null,
    progressTicks: null,
    progressCurrent: null,
    backLabel: null,
    primaryLabel: COMPLETE_PRIMARY_LABEL,
    continueHint: null,
    nudge: null,
  };
}

/** `TRY THIS` on an actionable anchor (action/card), `GUIDE PICK` on a recommended choice, nothing on a bare zone —
 * `docs/guided-mode.md` §4 G4c "For G5c": "Put TRY THIS only on actionable anchors (action/card), not zones." */
function tagVariantOf(anchor: LessonAnchor | null | undefined): McGuideTagVariant | null {
  if (!anchor) return null;
  if (anchor.kind === "choice") return "guidePick";
  if (anchor.kind === "action" || anchor.kind === "card" || anchor.kind === "control") return "tryThis";
  return null;
}

/**
 * The soft gate for `step`'s own anchor (§3.10): only the taught control (plus any extra basic actions the step
 * itself names via `LessonStep.gate`) stays live. A zone anchor gates nothing extra — there's nothing on the board
 * to tap for "look at the main scheme" — and a choice anchor gates nothing on the *board* either, since the open
 * choice sheet (`ChoiceOverlay`) already owns input exclusively while it's up (its own `binding.blocked`).
 *
 * **A `card` anchor gates the whole hand, not just the taught card.** "Play this card" is a two-tap flow the
 * moment it costs anything: tapping it opens payment mode, and *paying* means tapping other hand cards as
 * sources (`BoardController#tapInMode`'s own `"paying"` branch, `#spendByInstance`) — a gate that only allowed
 * the taught card itself would block every one of those taps as "inert" (`GuideGateHolder.noteInertClick`),
 * making the very thing the step is teaching impossible to finish. Found in browser verification: lesson 3
 * ("Play Black Cat") never advanced past tapping Black Cat, because tapping Energy to pay her cost was gated out.
 */
function gateFor(
  step: LessonStep,
  game: GameState,
  perspectiveId: PlayerId | null,
  controller: GuideController,
): GuideGate | null {
  const anchor = step.anchor;
  if (!anchor || anchor.kind === "zone" || anchor.kind === "choice" || anchor.kind === "control") return null;

  const actions = new Set<BasicAction>();
  const cards = new Set<InstanceId>();
  for (const id of step.gate ?? []) actions.add(id as BasicAction);

  if (anchor.kind === "action") {
    actions.add(ACTION_TO_BASIC[anchor.id]);
  } else if (perspectiveId !== null) {
    const player = game.players.find((p) => p.playerId === perspectiveId);
    for (const id of player?.hand ?? []) cards.add(id);
    const instanceId = instanceOfCode(game, perspectiveId, anchor.code);
    if (instanceId !== null) cards.add(instanceId);
  }

  return {
    actions,
    cards,
    onGateReleased: () => controller.onGateReleased(),
    onGateEscaped: () => controller.onGateEscaped(),
  };
}
