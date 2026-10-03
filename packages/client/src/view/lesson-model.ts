/**
 * The guide's lesson state machine (guided mode G5b, `docs/guided-mode.md` §4): lessons made of steps, each step
 * anchored to something on the board (or nothing), with either a manual "acknowledge" advance or an "await" step
 * that auto-advances once a predicate over the live store state holds. Pure data plus pure reducers, no Phaser and
 * no engine dispatch — G5c (the guide controller) feeds it `SessionState` on every store update and shows G4a/G4b/
 * G4c for whatever `currentStep` returns. G10d (aspect try-it games) drives the same machine with its own lesson
 * data, which is why every shape here is generic rather than tutorial-specific — the tutorial's own five lessons
 * live as data in `guide/tutorial-lessons.ts`.
 *
 * **Anchors are semantic, not pixels** (`LessonAnchor`): a zone id, a named board action, a card code, or a named
 * choice. The controller (G5c) resolves an anchor to a screen rect from the live board layout; this module never
 * knows about coordinates.
 *
 * **Predicates read only what the store already has**: `LessonObservation` is `{ game, lastEvents, perspectiveId }`,
 * the same three fields `store/session-store.ts`'s `SessionState` carries as `game`/`lastEvents`/`perspectiveId`.
 * A predicate is a plain function over that — no hidden lookahead, no engine query. `lastEvents` is the most recent
 * command's events only (see `SessionState.lastEvents`'s own doc comment), which is why an `await` step's
 * `completes` predicate has to check for a state it can also recognize as "already true" (e.g.
 * `defenderDeclared()` reads an event, but `formIs` reads live state) — `observe` is called once per store update,
 * so a predicate that only ever looks at `lastEvents` would miss a state that was already true before the guide
 * started watching for it.
 *
 * **Two step modes.** `"acknowledge"`: the player advances it with the callout/panel's primary button
 * (`acknowledge`). `"await"`: the step names a `completes` predicate and `observe` advances it automatically the
 * moment that predicate holds — there is no manual advance for one (§3.10's "do this to continue" steps). An
 * `"acknowledge"` step may *also* carry a `completes` predicate: the player can still press the primary button, but
 * `observe` advances it on its own if the taught moment has already passed underneath them (found in G11 QA: a
 * player who plays on without pressing "Got it" on the villain phase's opening acknowledge step left the guide
 * stuck on it for a whole round, with the next step's `GUIDE PICK` never showing because its own trigger had already
 * fired and gone). `completes` is required on `"await"`, optional on `"acknowledge"`, and never read on neither.
 *
 * **Lesson gating.** A lesson only becomes current once its own `when` predicate holds (defaults to "always"),
 * checked by `observe` the same way a step's `completes` is. That's how lesson 4 (the villain phase) waits for the
 * villain phase to actually start, and lesson 5 (round 2's thwart) waits for round 2, without the controller having
 * to special-case either.
 *
 * **A lesson's own history, not just the latest `lastEvents`.** A predicate that only ever checks `lastEvents`
 * misses a trigger that already fired on an earlier `observe` call while an *earlier step in the same lesson* was
 * current (e.g. the guide sat on step 1 all through the villain phase because the player never acknowledged it, so
 * step 4's own `defenderDeclared()` never got a chance to see the defend decision's events). `LessonRunnerState`
 * accumulates every `lastEvents` it's handed since the current lesson became current into `lessonEvents`, and
 * `observe` merges them in before calling `completes` — so a later step's event-based predicate stays correct even
 * if the event actually fired while an earlier step of the same lesson was still current. Prefer a state-based
 * predicate (reads `game` directly, e.g. `formIs`) over an event-based one when the taught state is easy to read
 * live; fall back to `lessonEvents` accumulation (event-based predicates) otherwise, and add a "the moment already
 * passed" fallback (e.g. "the phase this was about has ended") so a step
 * doesn't sit current forever waiting for an event that's never coming.
 */
import type { AbilityId, CardId } from "@mc/content";
import type { Form, GameEvent, GameState, GameStep, PlayerId } from "@mc/engine";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

/** What a step is teaching, as a semantic id the controller resolves to a board rect. */
export type LessonAnchor =
  | { readonly kind: "zone"; readonly id: string }
  | { readonly kind: "action"; readonly id: "flip" | "thwart" | "attack" | "endTurn" }
  | { readonly kind: "card"; readonly code: CardId }
  | { readonly kind: "choice"; readonly id: string }
  /** A control keyed by the live draw's own `BoardFrame.focusRects` id — the payment bar's "Pay" button
   * (`"payment:pay"`, `scenes/board/payment-bar.ts`), not a hand/play-area card and not a basic-bar action.
   * Only ever reached via a `GuideStepOverride` (`guide/guide-controller.ts`) — no scripted `LessonStep` names
   * one directly, since the control it points at doesn't exist until a mode (paying, choosing a target, ...)
   * opens it. */
  | { readonly kind: "control"; readonly id: string };

/**
 * One entry in a `LessonStepCopy.payWith` walk: either a card from the perspective player's hand, discarded for
 * its own printed resource, or a resource ability on the player's identity card (Peter Parker's Scientist —
 * `RRG "Resource"` abilities live on a card in play, not the hand, so this needs its own kind rather than a
 * `CardId` the way a hand card does). `doThis` is this payer's own "TRY THIS" wording — "Tap Scientist to
 * generate a resource", "Tap Energy, then Pay" — since each payer in a multi-payer walk needs different words,
 * unlike the old single-card `payWithDoThis`.
 */
export type LessonPayer =
  | { readonly kind: "handCard"; readonly code: CardId; readonly doThis: string }
  | { readonly kind: "identityAbility"; readonly abilityId: AbilityId; readonly doThis: string }
  /**
   * A resource ability on another card in play — an upgrade like Titanium Muscles (`mut_gen` 32005, "Hero Resource:
   * Exhaust this card → generate [physical] for each tough status card"), which sits attached to the identity rather
   * than in the play area. `code` names that card; the payment bar shows it as a tile marked "In play".
   */
  | {
      readonly kind: "cardAbility";
      readonly code: CardId;
      readonly abilityId: AbilityId;
      readonly doThis: string;
    };

/**
 * A step's copy. `body` uses `[[id]]`/`[[id|label]]` term markup (G3b, `McTermText`). `tip`/`rows`, when
 * present, are plain text — `McGuidePanel`'s own tip box draws them with a bare `Text`, not `McTermText`
 * (found in browser verification, G5c: bracketed markup in a tip showed up literally on screen). Keep a
 * mid-sentence term reference out of `tip`/`rows`, or spell it out in `body` instead.
 */
export interface LessonStepCopy {
  readonly title: string;
  readonly body: string;
  readonly tip?: string;
  /**
   * One line short enough for the compact bottom strip a tabbed villain-phase walkthrough or defend choice sheet
   * draws over itself (guided mode G7c, `docs/guided-mode.md` §4 "Left for G7") — those overlays have no room for
   * the full callout's title/body/step-label. Plain text, like `tip` (never `[[id]]` markup). Falls back to `tip`,
   * then `doThis`, when unset (`GuideController#view`'s own `stripText`) — a step without one still shows *some*
   * words on the strip rather than nothing.
   */
  readonly short?: string;
  /** "STEP 2 OF 5" — the callout/panel's own step label (`McGuideCalloutContent.stepLabel`). Omit to hide it. */
  readonly stepLabel?: string;
  /** Extra bullet-style rows under the body (the panel's tip box can show more than one line). */
  readonly rows?: readonly string[];
  /**
   * The specific action an `"await"` step's "do this to continue" slot names — "Flip to Spider-Man", "Tap Energy,
   * then Pay", "Pick who takes the hit", "Click Thwart". Required (by convention, not the type) on every `"await"`
   * step's copy; the controller falls back to a generic "Do this to continue" when it's missing rather than
   * refusing to draw (`GuideController#view`'s own fallback), so a content gap shows up as a blander hint instead
   * of a crash. Ignored on an `"acknowledge"` step, which shows its `primaryLabel` button instead.
   */
  readonly doThis?: string;
  /**
   * `doThis`'s own tabbed-layout variant (guided mode G7b, `docs/guided-mode.md` §4 "Left for G7"): on phone/
   * tablet portrait, tapping a hand card opens Inspect *before* the target action happens (`scenes/inspect.ts`),
   * so a step whose `doThis` assumes the card is already on the table ("Tap X to play her") needs to say "then
   * Play" instead. Optional — omit on a step whose `doThis` reads the same either way. Read by the board's own
   * mount (`scenes/board/guide-mount.ts`), never branched on here: this module stays free of a form-factor
   * dependency (`view/layout.ts`), same as every other field in this interface.
   */
  readonly doThisTabbed?: string;
  /**
   * The ordered payer(s) that pay this step's own signature card exactly (guided mode G10d fix, extended for the
   * owner's lesson-2 reorder, `docs/guided-mode.md` §4): once the payment bar opens for this step's `anchor` card,
   * the board's own mount (`scenes/board/guide-mount.ts#syncPayingOverride`) walks `TRY THIS` from the card being
   * paid for to the first not-yet-spent payer in this list, in order, then to the Pay button once every payer here
   * has been spent — the way the tutorial's Black Cat → Scientist → Interrogation Room → Pay walk needs two payers
   * in sequence, and the aspect try-it lessons' single-card walks (Energy, Genius, Ancestral Knowledge) still work
   * as a one-element list. Omit on a step whose cost needs cards this can't name in order (e.g. an either/or
   * choice) — nothing generalizes that case, so `TRY THIS` just stays on the signature card itself, same as before
   * this field existed. Only meaningful alongside a `{ kind: "card" }` anchor.
   */
  readonly payWith?: readonly LessonPayer[];
  /**
   * The character the guide suggests once the "Attack with" / "Thwart with" picker opens (`scenes/board/
   * controller-bar.ts#drawSourceBar`), when more than one character could make the basic power: the board's own
   * mount (`scenes/board/guide-mount.ts#syncSourceOverride`) moves `TRY THIS` from the step's action onto that
   * character's button, with this entry's own `doThis`. Only a suggestion — the other buttons stay live, since
   * which character goes first is the player's call. Only meaningful alongside a `{ kind: "action" }` anchor.
   */
  readonly pickSource?: { readonly code: CardId; readonly doThis: string };
  /**
   * A second forward button on an `"acknowledge"` step, alongside the primary "Got it" — lesson 5's
   * spotlight-scheme step's "How do I stop it?" (guided mode G7d, `docs/guided-mode.md` §5.1 tile P03). Both
   * buttons advance the step the same way (`GuideController#primary`/`acknowledge`); this only changes which
   * label the curious-vs-just-move-on player taps. Ignored on an `"await"` step, and on any step that doesn't set
   * it — most acknowledge steps show only the primary button.
   */
  readonly secondaryLabel?: string;
}

export type LessonStepMode = "acknowledge" | "await";

/** The store fields a predicate is allowed to read — see the module header. */
export interface LessonObservation {
  readonly game: GameState;
  readonly lastEvents: readonly GameEvent[];
  readonly perspectiveId: PlayerId | null;
}

export type LessonPredicate = (observation: LessonObservation) => boolean;

export interface LessonStep {
  readonly id: string;
  readonly anchor?: LessonAnchor;
  readonly copy: LessonStepCopy;
  readonly mode: LessonStepMode;
  /**
   * Required when `mode` is `"await"` (the only way an await step advances). Optional when `mode` is
   * `"acknowledge"`: the primary button (`acknowledge`) still works, but `observe` also advances the step on its
   * own once this holds, so an acknowledge step can't strand the player on stale copy (see the module header).
   */
  readonly completes?: LessonPredicate;
  /**
   * The step is *about* the villain-phase walkthrough, so it may show while that overlay is still playing (the
   * tutorial's lesson 4: "Now it's his turn", "Who takes the hit?"). Every other step is held back while the
   * walkthrough auto-advances, and appears once the board is waiting for the player again
   * (`GuideControllerOptions.blocked`).
   */
  readonly overWalkthrough?: boolean;
  /** Action ids left live while this step is up (§3.10's soft gate). Absent = the controller gates nothing extra. */
  readonly gate?: readonly string[];
}

export interface Lesson {
  readonly id: string;
  readonly title: string;
  readonly steps: readonly LessonStep[];
  /** Held back from becoming current until this holds. Absent = eligible as soon as it's next in line. */
  readonly when?: LessonPredicate;
  /**
   * What starts this lesson, shown in the guide's "waiting" state (G5c part 2, `docs/guided-mode.md` §4 G5c item
   * 0) whenever this is the next not-done lesson but its own `when` doesn't hold yet — e.g. "Flip to Spider-Man
   * when you're ready." or "It starts when you end your turn." Paired with `title` by the controller
   * (`guide/guide-controller.ts`'s own `waitingPanelContent`) into "Next: {title}. {waitingCopy}". Only meaningful
   * on a lesson that has a `when`; a lesson with no `when` becomes current the moment it's next in line, so it's
   * never the "next" lesson shown waiting.
   */
  readonly waitingCopy?: string;
}

// ---------------------------------------------------------------------------
// Predicate helpers
// ---------------------------------------------------------------------------

/** True while `perspectiveId`'s player is in `form`. False with no `perspectiveId` (nothing to watch yet). */
export function formIs(form: Form): LessonPredicate {
  return (observation) => {
    const player = observation.game.players.find((p) => p.playerId === observation.perspectiveId);
    return player?.identity.form === form;
  };
}

/** True once the most recent command played the card with this code. */
export function cardPlayed(code: CardId): LessonPredicate {
  return (observation) => observation.lastEvents.some((event) => event.type === "cardPlayed" && event.cardId === code);
}

/**
 * True while `perspectiveId`'s hand contains a card with this code — from the moment it's drawn (or, more often
 * here, from a stacked opening hand at game start) until it leaves the hand. Unlike `cardPlayed`, this reads live
 * state rather than `lastEvents`, so a lesson gated on it (`Lesson.when`, guided mode G10d's aspect "Try it"
 * lessons, `guide/aspect-lessons.ts`) becomes eligible the instant the observation shows the card already there,
 * not only on the command that put it there.
 */
export function cardInHand(code: CardId): LessonPredicate {
  return (observation) => {
    const player = observation.game.players.find((p) => p.playerId === observation.perspectiveId);
    if (!player) return false;
    return player.hand.some((id) => observation.game.instances[id]?.cardId === code);
  };
}

/** True once the most recent command produced an event of this type, whatever its other fields. */
export function eventSeen(type: GameEvent["type"]): LessonPredicate {
  return (observation) => observation.lastEvents.some((event) => event.type === type);
}

/** True while the live game step matches `phase` (and `kind`, when given). */
export function stepIs<Phase extends GameStep["phase"]>(
  phase: Phase,
  kind?: Extract<GameStep, { readonly phase: Phase }>["kind"],
): LessonPredicate {
  return (observation) => {
    const step = observation.game.step;
    if (step.phase !== phase) return false;
    return kind === undefined || step.kind === kind;
  };
}

/**
 * True once the most recent command dealt attack damage to a villain from an attacker whose own card is `code` —
 * the tutorial's own "Attack Rhino" steps (guided mode, `docs/guided-mode.md` §3.10, lesson 3's owner-requested
 * addition), each teaching one specific attacker (Black Cat, then Spider-Man). Reads the engine's `damageDealt`
 * event, the same one a player-initiated `basicAttack` (and any other source of attack damage) always produces —
 * `sourceInstanceId` names the character whose ATK dealt it, resolved back to a card code via `game.instances` so
 * this stays card-code-based like `cardPlayed`, never a hardcoded instance id.
 */
export function villainDamagedBy(code: CardId): LessonPredicate {
  return (observation) =>
    observation.lastEvents.some((event) => {
      if (event.type !== "damageDealt" || event.sourceInstanceId === null) return false;
      if (observation.game.instances[event.sourceInstanceId]?.cardId !== code) return false;
      return observation.game.villains.some((villain) => villain.instanceId === event.targetInstanceId);
    });
}

/** True once the most recent command removed threat from the main scheme (a thwart landing). */
export function threatRemovedFromMainScheme(): LessonPredicate {
  return (observation) =>
    observation.lastEvents.some(
      (event) =>
        event.type === "threatRemoved" &&
        event.schemeInstanceId === observation.game.mainScheme.instanceId &&
        event.amount > 0,
    );
}

/**
 * True once the defend decision for the most recent attack has been made, whichever way: a defender was declared
 * (`defenderDeclared`) or the hero took the hit (`defenseDeclined`). Named for the declare-defender prompt lesson 4
 * teaches, which either outcome resolves. Event-based (see the module header on `lessonEvents`) — `observe` merges
 * in everything seen since this lesson became current, so this still catches a decision made before this step (an
 * earlier step of the same lesson) got a chance to notice it.
 */
export function defenderDeclared(): LessonPredicate {
  return (observation) =>
    observation.lastEvents.some((event) => event.type === "defenderDeclared" || event.type === "defenseDeclined");
}

/**
 * True once the villain phase's enemy-activation step (`placeThreat`/`enemyActivations`) is behind us — either a
 * defend decision is now pending (`declareDefender`), or the live step has moved past activation (an encounter
 * card, `passFirstPlayer`, `endOfRound`), or the phase has ended entirely. Drives `villain-phase-order`'s
 * auto-advance (lesson 4, §5.1): the step teaches "he'll attack now, you'll pick who takes it", so it's done the
 * moment either of those has actually happened, whether or not the player pressed "Got it".
 */
export function villainActivationPast(): LessonPredicate {
  return (observation) => {
    if (observation.game.pendingChoice?.prompt.kind === "declareDefender") return true;
    const step = observation.game.step;
    if (step.phase !== "villain") return true;
    return step.kind !== "placeThreat" && step.kind !== "enemyActivations";
  };
}

/**
 * True once the declare-defender decision this round is resolved, however the guide finds out: the event fired
 * (`defenderDeclared`, robust via `lessonEvents` even if this step became current late), or there's no
 * `declareDefender` choice pending and the villain phase's activation step is already behind us (no attack came, or
 * the whole villain phase — and the teaching moment with it — has already ended). Drives `declare-defender`'s
 * auto-advance (lesson 4, §5.1) so it never sits current after the moment it teaches is gone.
 */
export function declareDefenderResolved(): LessonPredicate {
  return (observation) => {
    if (defenderDeclared()(observation)) return true;
    if (observation.game.pendingChoice?.prompt.kind === "declareDefender") return false;
    return villainActivationPast()(observation);
  };
}

// ---------------------------------------------------------------------------
// Copy interpolation
// ---------------------------------------------------------------------------

const PLACEHOLDER_PATTERN = /\{(\w+)}/g;

/**
 * Values `fillCopy` can resolve straight from `GameState` with no other input. `{threat}` is the main scheme's
 * current threat count (`game.instances[game.mainScheme.instanceId].threat`). A scheme's *target* threshold is
 * card data (`@mc/content`, scaled by player count — see `view/board-model.ts`'s `schemePanel`), not part of
 * `GameState`, so `{target}` (or anything else content-derived) has to come through `fillCopy`'s `extra` argument;
 * this module stays free of a content-pool dependency on purpose.
 */
function builtinValues(observation: LessonObservation): Readonly<Record<string, string | number>> {
  const mainScheme = observation.game.instances[observation.game.mainScheme.instanceId];
  return { threat: mainScheme?.threat ?? 0 };
}

/**
 * Substitutes `{name}` placeholders in `copy`'s text fields (title, body, tip, each row) with values from
 * `observation` (see `builtinValues`) and `extra` (content-derived numbers the caller already resolved — `extra`
 * wins on a key collision). An unresolved placeholder is left as-is rather than throwing, so a content typo shows
 * up as a literal `{oops}` in a click-through instead of crashing the guide.
 */
export function fillCopy(
  copy: LessonStepCopy,
  observation: LessonObservation,
  extra?: Readonly<Record<string, string | number>>,
): LessonStepCopy {
  const values: Readonly<Record<string, string | number>> = { ...builtinValues(observation), ...extra };
  const fill = (text: string): string =>
    text.replace(PLACEHOLDER_PATTERN, (match, key: string) => (key in values ? String(values[key]) : match));
  return {
    ...copy,
    title: fill(copy.title),
    body: fill(copy.body),
    ...(copy.tip !== undefined ? { tip: fill(copy.tip) } : {}),
    ...(copy.short !== undefined ? { short: fill(copy.short) } : {}),
    ...(copy.rows ? { rows: copy.rows.map(fill) } : {}),
    ...(copy.doThis !== undefined ? { doThis: fill(copy.doThis) } : {}),
    ...(copy.doThisTabbed !== undefined ? { doThisTabbed: fill(copy.doThisTabbed) } : {}),
    ...(copy.payWith ? { payWith: copy.payWith.map((payer) => ({ ...payer, doThis: fill(payer.doThis) })) } : {}),
    ...(copy.pickSource ? { pickSource: { ...copy.pickSource, doThis: fill(copy.pickSource.doThis) } } : {}),
  };
}

// ---------------------------------------------------------------------------
// Machine
// ---------------------------------------------------------------------------

/** Which lesson/step is current, if any. `null` between lessons (nothing eligible yet) or once everything is done. */
export interface LessonPointer {
  readonly lessonIndex: number;
  readonly stepIndex: number;
}

export interface LessonRunnerState {
  readonly lessons: readonly Lesson[];
  readonly doneLessonIds: readonly string[];
  /** Set by `skipLesson` (§3.10: "ends scripted lessons for this game"). No lesson becomes current once set. */
  readonly skipped: boolean;
  readonly active: LessonPointer | null;
  /**
   * Every `lastEvents` this run has been handed (via `observe`) since the *lesson* `active` points into last became
   * current — reset to `[]` only when a lesson boundary is crossed (a fresh lesson becomes current, this lesson
   * finishes, the run is skipped/stopped, or `replay` re-enters a lesson), never on an ordinary step-to-step advance
   * within the same lesson (`observe`'s own internal step transition, `acknowledge`, `back`, `skipStep`). That's
   * the point: lesson 4's `declare-defender` needs to see the defend event even though it fired while
   * `villain-phase-order` (an earlier step in the *same* lesson) was still current (G11 fix) — "since the lesson
   * started", not "since this step started". `observe` merges this in ahead of a fresh call's `lastEvents` before
   * evaluating `completes` (see the module header) — this is the state, not the predicate; an event-based predicate
   * like `defenderDeclared` still only ever reads `observation.lastEvents`.
   */
  readonly lessonEvents: readonly GameEvent[];
}

/** A reducer's result: the new state, plus any lesson ids that finished on this call (for `markLessonDone`). */
export interface LessonResult {
  readonly state: LessonRunnerState;
  readonly lessonDone: readonly string[];
}

const NO_LESSONS_DONE: LessonResult["lessonDone"] = [];

function result(state: LessonRunnerState, lessonDone: readonly string[] = NO_LESSONS_DONE): LessonResult {
  return { state, lessonDone };
}

/**
 * Starts (or resumes) a run over `lessons`, with `alreadyDone` (e.g. `GuidePrefs.tutorial.lessonsDone` or
 * `aspectLessonsDone`) marking lessons already complete. Nothing becomes current yet — `active` starts `null`;
 * call `observe` with the live game state to let a lesson's `when` decide whether it's eligible right now.
 */
export function startLessons(lessons: readonly Lesson[], alreadyDone: readonly string[] = []): LessonRunnerState {
  return { lessons, doneLessonIds: [...alreadyDone], skipped: false, active: null, lessonEvents: [] };
}

/**
 * The next lesson to make current, or `null` if none is ready yet. Lessons run in strict order: this skips past
 * ones already done, but stops (rather than skipping ahead) at the first not-done lesson whose `when` doesn't hold
 * yet — lesson 5 shouldn't jump ahead of lesson 4 just because round 2's condition happens to be satisfiable
 * before the villain phase runs. A caller that wants an out-of-order lesson uses `replay`, not `observe`.
 */
function findEligibleLesson(state: LessonRunnerState, observation: LessonObservation): number | null {
  for (let i = 0; i < state.lessons.length; i++) {
    const lesson = state.lessons[i]!;
    if (state.doneLessonIds.includes(lesson.id)) continue;
    if (lesson.when && !lesson.when(observation)) return null;
    return i;
  }
  return null;
}

/**
 * Feeds a store observation to the machine: auto-advances the current step once its `completes` predicate holds
 * (required on `"await"`, optional on `"acknowledge"` — see the module header), finishing the lesson and starting
 * the next eligible one when it does, and — with no lesson current — looks for the next lesson whose `when` now
 * holds. Loops until nothing more changes, bounded by the total step count so a predicate that's already true
 * doesn't require a second `observe` call to be noticed.
 *
 * Before evaluating `completes`, this merges `state.lessonEvents` (everything seen since the current lesson became
 * current) ahead of `observation.lastEvents`, so an event-based predicate on a *later* step still catches an event
 * that fired while an *earlier* step in the same lesson was current (see `LessonRunnerState.lessonEvents`'s own
 * doc comment). When the step doesn't complete, this call's `lastEvents` is folded into `lessonEvents` for next
 * time.
 */
export function observe(state: LessonRunnerState, observation: LessonObservation): LessonResult {
  if (state.skipped) return result(state);

  let current = state;
  const finished: string[] = [];
  const totalSteps = current.lessons.reduce((n, l) => n + l.steps.length, 0);
  let guard = totalSteps + current.lessons.length + 1;

  while (guard-- > 0) {
    if (current.active === null) {
      const nextIndex = findEligibleLesson(current, observation);
      if (nextIndex === null) break;
      current = { ...current, active: { lessonIndex: nextIndex, stepIndex: 0 }, lessonEvents: [] };
      continue;
    }

    const { lessonIndex, stepIndex } = current.active;
    const lesson = current.lessons[lessonIndex]!;
    const step = lesson.steps[stepIndex]!;

    const merged: LessonObservation = current.lessonEvents.length
      ? { ...observation, lastEvents: [...current.lessonEvents, ...observation.lastEvents] }
      : observation;

    if (!step.completes || !step.completes(merged)) {
      if (observation.lastEvents.length > 0) {
        current = { ...current, lessonEvents: [...current.lessonEvents, ...observation.lastEvents] };
      }
      break;
    }

    if (stepIndex + 1 < lesson.steps.length) {
      current = { ...current, active: { lessonIndex, stepIndex: stepIndex + 1 } };
      continue;
    }
    finished.push(lesson.id);
    current = { ...current, doneLessonIds: [...current.doneLessonIds, lesson.id], active: null, lessonEvents: [] };
  }

  return result(current, finished);
}

/**
 * Advances the current step, if it's `"acknowledge"` mode (the primary button's action). A no-op — same state, no
 * `lessonDone` — with no active lesson, or when the current step is `"await"` (those only ever advance via
 * `observe`).
 */
export function acknowledge(state: LessonRunnerState): LessonResult {
  if (state.skipped || state.active === null) return result(state);
  const { lessonIndex, stepIndex } = state.active;
  const lesson = state.lessons[lessonIndex]!;
  const step = lesson.steps[stepIndex]!;
  if (step.mode !== "acknowledge") return result(state);

  // Same lesson, next step: `lessonEvents` carries forward unchanged (see its own doc comment) — this is the
  // manual-primary path for the exact same "later step in this lesson needs an earlier step's event" case
  // `observe`'s own internal step transition handles.
  if (stepIndex + 1 < lesson.steps.length) {
    return result({ ...state, active: { lessonIndex, stepIndex: stepIndex + 1 } });
  }
  return result({ ...state, doneLessonIds: [...state.doneLessonIds, lesson.id], active: null, lessonEvents: [] }, [
    lesson.id,
  ]);
}

/** Steps back one step within the current lesson. A no-op at the lesson's first step, or with no active lesson. */
export function back(state: LessonRunnerState): LessonResult {
  if (state.active === null || state.active.stepIndex === 0) return result(state);
  return result({ ...state, active: { ...state.active, stepIndex: state.active.stepIndex - 1 } });
}

/** Ends scripted lessons for this run (§3.10): no lesson becomes current again until a fresh `startLessons`. */
export function skipLesson(state: LessonRunnerState): LessonResult {
  if (state.skipped) return result(state);
  return result({ ...state, skipped: true, active: null, lessonEvents: [] });
}

/**
 * "Skip this step" (§3.10): advances past only the current step, whatever its mode — unlike `acknowledge`, this
 * works on an `"await"` step too, since skipping *is* the player's way past a step they don't want to do right
 * now. If this was the lesson's last step, the lesson counts as done (folded into `doneLessonIds`, same as
 * finishing it normally) rather than staying current — `observe` picks up the next eligible lesson from there,
 * still gated by that lesson's own `when` (lesson 4 shouldn't show up before the villain phase just because
 * lesson 3 was skipped). A no-op — same state, no `lessonDone` — once the run itself is `skipped`, or with no
 * lesson current.
 */
export function skipStep(state: LessonRunnerState): LessonResult {
  if (state.skipped || state.active === null) return result(state);
  const { lessonIndex, stepIndex } = state.active;
  const lesson = state.lessons[lessonIndex]!;

  if (stepIndex + 1 < lesson.steps.length) {
    return result({ ...state, active: { lessonIndex, stepIndex: stepIndex + 1 } });
  }
  return result({ ...state, doneLessonIds: [...state.doneLessonIds, lesson.id], active: null, lessonEvents: [] }, [
    lesson.id,
  ]);
}

/**
 * Re-enters `lessonId` at its first step (the debrief's "Replay a lesson"), even if it's already done or the run
 * was skipped. Leaves `doneLessonIds` alone — replaying doesn't undo completion, it only makes the lesson current
 * again so its steps show. A no-op if `lessonId` isn't in this run's lessons.
 */
export function replay(state: LessonRunnerState, lessonId: string): LessonResult {
  const lessonIndex = state.lessons.findIndex((l) => l.id === lessonId);
  if (lessonIndex < 0) return result(state);
  return result({ ...state, skipped: false, active: { lessonIndex, stepIndex: 0 }, lessonEvents: [] });
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/** The step G4a/G4b/G4c should show right now, or `null` with no lesson current. */
export function currentStep(state: LessonRunnerState): LessonStep | null {
  if (state.active === null) return null;
  const lesson = state.lessons[state.active.lessonIndex];
  return lesson?.steps[state.active.stepIndex] ?? null;
}

/** The lesson `currentStep` belongs to, or `null` with no lesson current. */
export function currentLesson(state: LessonRunnerState): Lesson | null {
  if (state.active === null) return null;
  return state.lessons[state.active.lessonIndex] ?? null;
}

export type LessonStatus = "done" | "current" | "upcoming";

export interface LessonListEntry {
  readonly lesson: Lesson;
  readonly status: LessonStatus;
}

/**
 * Every lesson in this run's order, with its status — G4b's lesson list. `"current"` wins over `"done"`: `replay`
 * can re-enter an already-done lesson, and the list should show it as the one being walked through right now, not
 * fold it back into "done" the instant it's reopened.
 */
export function lessonList(state: LessonRunnerState): readonly LessonListEntry[] {
  const currentId = state.active !== null ? state.lessons[state.active.lessonIndex]?.id : undefined;
  return state.lessons.map((lesson) => ({
    lesson,
    status: lesson.id === currentId ? "current" : state.doneLessonIds.includes(lesson.id) ? "done" : "upcoming",
  }));
}

export interface LessonProgress {
  readonly lessonId: string;
  /** 0-based position of `currentStep` within its lesson. */
  readonly stepIndex: number;
  readonly totalSteps: number;
  /** How many of this run's lessons are done, including ones finished before `startLessons` (`alreadyDone`). */
  readonly doneCount: number;
  readonly totalCount: number;
}

/** The current lesson's step position plus the run's overall progress — G4b's progress ticks. `null` if none is current. */
export function progressOf(state: LessonRunnerState): LessonProgress | null {
  if (state.active === null) return null;
  const lesson = state.lessons[state.active.lessonIndex];
  if (!lesson) return null;
  return {
    lessonId: lesson.id,
    stepIndex: state.active.stepIndex,
    totalSteps: lesson.steps.length,
    doneCount: state.doneLessonIds.length,
    totalCount: state.lessons.length,
  };
}
