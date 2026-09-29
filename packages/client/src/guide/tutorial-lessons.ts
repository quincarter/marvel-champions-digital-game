/**
 * The tutorial's five scripted lessons (`docs/guided-mode.md` §5.1), as `view/lesson-model.ts` data. Written against
 * `guide/tutorial-config.ts`'s `TUTORIAL_CONFIG`/`TUTORIAL_SCRIPT` — the stacked opening hand and encounter deck
 * that guarantee each lesson's precondition, proved by `tutorial-config.test.ts`. Nothing here hardcodes an
 * instance id: every predicate reads the live perspective player, the live main scheme, or the most recent events,
 * so the same data would still make sense against a differently-stacked replay of the same matchup.
 *
 * Copy is short and original, in the guide's own voice (`docs/guided-mode.md` §1). Mid-sentence terms use
 * `[[id|label]]` so a lowercase mention doesn't draw the glossary's capitalized display name
 * (`view/term-text-model.ts`'s header). Glossary ids are `@mc/content`'s concept entries (G3a): `mainScheme`,
 * `threat`, `heroAlterEgoForm`, `flip`, `cost`, `resource`, `aspect`, `villainPhase`, `defend`, `exhaustCost`,
 * `thwart`.
 *
 * `McGuideCalloutContent`'s own fields (`ui/guide-callout.ts`: `continueHint`, `primaryLabel`, `skipLabel`, …) are
 * G5c's concern, not this module's — a `LessonStep`'s `copy` only carries `title`/`body`/`tip`/`stepLabel`/`rows`
 * (`view/lesson-model.ts`); the controller decides how an `"await"` step's missing primary button is worded.
 */
import { cardId } from "@mc/content";
import {
  cardPlayed,
  declareDefenderResolved,
  formIs,
  stepIs,
  threatRemovedFromMainScheme,
  villainActivationPast,
  type Lesson,
} from "../view/lesson-model.js";

const BLACK_CAT = cardId("01002");
const ENERGY = cardId("01088");

/**
 * Lesson 1: "How to win" (§5.1). Shown as its own screen before the game starts (G6b's "How to win" screen), not a
 * board step — a single acknowledge-mode step with no `anchor`, so it exists in `lessonList` alongside the other
 * four but never becomes the board's current step. G6b calls `acknowledge` when the player leaves that screen.
 */
const HOW_TO_WIN: Lesson = {
  id: "how-to-win",
  title: "How to win",
  steps: [
    {
      id: "how-to-win-intro",
      copy: {
        title: "One way to win, two ways to lose",
        body:
          "Defeat Rhino through both his stages and you win. Let [[mainScheme|The Break-In!]] reach its target " +
          "[[threat|threat]], or let Spider-Man fall, and you lose. Every round: you act and draw back up, then " +
          "Rhino acts.",
      },
      mode: "acknowledge",
    },
  ],
};

/** Lesson 2: "Hero & alter-ego" (§5.1). Round 1, start of the turn — eligible as soon as the game begins. */
const HERO_AND_ALTER_EGO: Lesson = {
  id: "hero-and-alter-ego",
  title: "Hero & alter-ego",
  steps: [
    {
      id: "flip",
      anchor: { kind: "action", id: "flip" },
      copy: {
        stepLabel: "STEP 1 OF 5",
        title: "You're Peter Parker",
        body:
          "In [[heroAlterEgoForm|alter-ego]] form Rhino schemes instead of attacking, and you can't attack or thwart. " +
          "[[flip|Flip]] once per turn to become Spider-Man — your hand size changes with you.",
        doThis: "Flip to Spider-Man",
      },
      mode: "await",
      completes: formIs("hero"),
    },
  ],
};

/** Lesson 3: "Paying for cards" (§5.1). Round 1, right after the flip — Black Cat is stacked into the opening hand. */
const PAYING_FOR_CARDS: Lesson = {
  id: "paying-for-cards",
  title: "Paying for cards",
  when: formIs("hero"),
  waitingCopy: "Flip to Spider-Man when you're ready.",
  steps: [
    {
      id: "play-black-cat",
      anchor: { kind: "card", code: BLACK_CAT },
      copy: {
        stepLabel: "STEP 2 OF 5",
        title: "Play Black Cat",
        body:
          "A card's [[cost|cost]] is the number in its corner. Pay it by discarding other cards from your hand — " +
          "each gives the [[resource|resources]] printed on it. Play Black Cat: she'll matter when Rhino attacks.",
        // Plain text, not `[[id]]` markup — `McGuidePanel`'s own tip box renders it as a plain `Text`, not
        // through `McTermText` (found in browser verification, G5c: a bracketed term showed up literally on
        // screen instead of resolving). See `LessonStepCopy`'s own doc comment for the corrected contract.
        tip: "Energy prints two resources, so it pays for Black Cat on its own.",
        // Overridden while the payment bar is open (`scenes/board/guide-mount.ts#syncPayingOverride`) — this is
        // only what shows before Black Cat's been tapped at all.
        doThis: "Tap Black Cat to play her",
        // Tabbed layouts open Inspect on a hand tap before Black Cat is on the table (guided mode G7b,
        // `docs/guided-mode.md` §4 "Left for G7") — `scenes/board/guide-mount.ts` swaps this in while tabbed,
        // both on the board's own callout and Inspect's compact guide strip.
        doThisTabbed: "Tap Black Cat, then Play",
        // Once Black Cat is the open payment's subject, `TRY THIS` walks to Energy, then to Pay (guided mode
        // G10d fix) — Energy alone pays her cost of 2.
        payWith: ENERGY,
        payWithDoThis: "Tap Energy, then Pay",
      },
      mode: "await",
      completes: cardPlayed(BLACK_CAT),
    },
  ],
};

/** Lesson 4: "The villain phase" (§5.1). Round 1's villain phase — Rhino attacks once every hero is a hero. */
const VILLAIN_PHASE: Lesson = {
  id: "villain-phase",
  title: "The villain phase",
  when: stepIs("villain"),
  waitingCopy: "It starts when you end your turn.",
  steps: [
    {
      id: "villain-phase-order",
      anchor: { kind: "zone", id: "villain" },
      copy: {
        stepLabel: "STEP 3 OF 5",
        title: "Now it's his turn",
        body:
          "The [[villainPhase|villain phase]] always goes the same three steps, in order — you'll see them at the " +
          "left. He'll attack you now, since you're a hero. You'll make one choice along the way: who takes his hit.",
        short: "Always the same order: threat, his attack, then an encounter card.",
      },
      // Also auto-advances (villain phase QA, G11 note): the player doesn't have to press "Got it" before Rhino's
      // attack resolves. Without this, a player who plays on stranded the guide here for a whole round, and
      // `declare-defender` below — gated on this step first going away — never got to show its `GUIDE PICK`.
      mode: "acknowledge",
      completes: villainActivationPast(),
    },
    {
      id: "declare-defender",
      anchor: { kind: "choice", id: "defend" },
      copy: {
        stepLabel: "STEP 4 OF 5",
        title: "Who takes the hit?",
        body:
          "[[defend|Defend]] with Black Cat and she takes the damage instead of you, [[exhaustCost|exhausting]] " +
          "her to do it. You could defend yourself, or just take it — but she's why you played her.",
        short: "No wrong answer. Allies are there to soak hits — that's what you paid for.",
        doThis: "Pick who takes the hit",
      },
      mode: "await",
      // State-based fallback alongside the event (G11 note): if `villain-phase-order` only just auto-advanced
      // because the whole villain phase already went by unacknowledged, the defend event is long gone from
      // `lastEvents`/`stepEvents` — `declareDefenderResolved` also passes once the villain phase itself has ended,
      // so this step (and lesson 4 with it) doesn't sit current forever teaching a moment that's already over.
      completes: declareDefenderResolved(),
    },
  ],
};

/** Lesson 5: "Threat & thwarting" (§5.1). Round 2, start of the turn — the stacked "Advance" card left threat behind. */
const THREAT_AND_THWARTING: Lesson = {
  id: "threat-and-thwarting",
  title: "Threat & thwarting",
  when: stepIs("player", "turn"),
  waitingCopy: "It starts at the top of round 2, after the villain phase.",
  steps: [
    {
      id: "spotlight-scheme",
      anchor: { kind: "zone", id: "mainScheme" },
      copy: {
        stepLabel: "STEP 5 OF 5",
        title: "The main scheme has {threat} threat",
        body:
          "[[threat|Threat]] goes on [[mainScheme|the main scheme]] every villain phase. Reach its target and the " +
          "villain wins — so it's worth clearing before it gets there. A rule of thumb: thwart once it's past " +
          "halfway to target.",
        // The curious-vs-just-move-on pair (guided mode G7d, tile P03): both buttons advance the same way
        // (`GuideController#primary`) — this only changes which one the player taps.
        secondaryLabel: "How do I stop it?",
      },
      mode: "acknowledge",
    },
    {
      id: "thwart",
      anchor: { kind: "action", id: "thwart" },
      copy: {
        title: "Thwart it",
        body:
          "[[thwart|Thwart]] removes threat equal to your THW, the same way attacking uses your ATK. It " +
          "[[exhaustCost|exhausts]] Spider-Man, so he can't also attack this round, but you can still play cards.",
        doThis: "Click Thwart",
      },
      mode: "await",
      completes: threatRemovedFromMainScheme(),
    },
  ],
};

/** The tutorial's five lessons, in §5.1's order. `guide/guide-store.ts`'s prefs track completion by `Lesson.id`. */
export const TUTORIAL_LESSONS: readonly Lesson[] = [
  HOW_TO_WIN,
  HERO_AND_ALTER_EGO,
  PAYING_FOR_CARDS,
  VILLAIN_PHASE,
  THREAT_AND_THWARTING,
];
