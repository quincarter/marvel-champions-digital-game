/**
 * The four aspect "Try it" lessons (guided mode G10d, `docs/guided-mode.md` §3.7, §4 G10d): one short `Lesson`
 * (G5b's `view/lesson-model.ts`) per aspect, played against `guide/aspect-tryit-config.ts`'s own stacked opening.
 * Two steps each — an intro the player acknowledges, then "play the signature card" — except Justice, which goes on
 * into round 2 to teach attack-or-thwart (see `JUSTICE_TRYIT`'s own comment). Each is gated to become current only
 * once that card is actually in hand (`cardInHand`, `view/lesson-model.ts`), the same `Lesson.when`/`waitingCopy`
 * shape `guide/tutorial-lessons.ts`'s own `PAYING_FOR_CARDS` uses for "wait for the flip".
 *
 * **Copy is original**, not transcribed FFG text, same rule `guide/aspects.ts`'s own header states for the aspect
 * lesson page. Mid-sentence terms use `[[id|label]]` glossary markup (G3a): `ally`, `thwart`, `threat`, `cost`,
 * `resource`, `mainScheme`, `consequentialDamage`.
 *
 * **Input stays loose while waiting for the play** (`docs/guided-mode.md` brief for G10d: "don't gate input
 * heavily... a gate only when a signature card is playable, and the soft gate still applies"): every "play it" step
 * names every basic action in its own `LessonStep.gate` alongside the signature card's own anchor, so a player free
 * to just play the game — attack, thwart, recover, flip, end the turn — never finds those blocked while this step
 * sits waiting for them to get around to the signature card (`guide/guide-controller.ts#gateFor`'s own "a card
 * anchor gates the whole hand" doc comment: without this, only hand cards would stay tappable).
 */
import { cardId } from "@mc/content";
import {
  cardInHand,
  cardPlayed,
  threatRemovedFromMainScheme,
  type Lesson,
  type LessonPredicate,
} from "../view/lesson-model.js";
import type { AspectTryItId } from "./aspect-tryit-config.js";

const FULL_GATE = ["attack", "thwart", "recover", "changeForm", "endTurn"] as const;

const JUSTICE_CARD = cardId("01058"); // Daredevil
const STRENGTH = cardId("01090");
const GENIUS_FOR_JUSTICE = cardId("01089");

/** True from the given round's player phase on — the Justice lesson's "come back after Rhino has schemed" wait. */
function playerPhaseOfRound(round: number): LessonPredicate {
  return ({ game }) => game.round >= round && game.step.phase === "player";
}

/**
 * Justice is the owner's "balance" aspect (2026-09-29): "It's about balancing attacking with thwarting. Justice
 * differs from aggression aspects because it adds a concept of defense and mitigation of threat on the schemes
 * while being able to also engage in combat." So the lesson runs two rounds rather than stopping at the play:
 * round 1 has nothing on The Break-In! to thwart (`aspect-tryit-config.test.ts` proves 0 threat and no legal
 * thwart), so it fights; round 2 opens with Rhino's threat on the scheme and asks the player to choose. Daredevil
 * is the lesson's card because he does both at once: his thwart is followed by 1 damage to an enemy.
 */
const JUSTICE_TRYIT: Lesson = {
  id: "aspect-tryit-justice",
  title: "Justice",
  when: cardInHand(JUSTICE_CARD),
  waitingCopy: "It starts once Daredevil is in your hand.",
  steps: [
    {
      id: "intro",
      copy: {
        title: "You're playing Spider-Man with Justice",
        body:
          "Aggression races to knock the villain out. Justice plays both halves of the board: it " +
          "[[thwart|thwarts]] to keep [[threat|threat]] off the scheme, so you don't lose while you fight, and " +
          "still hits hard when the scheme is under control. Every turn asks the same question: attack or thwart?",
      },
      mode: "acknowledge",
    },
    {
      id: "play-signature",
      anchor: { kind: "card", code: JUSTICE_CARD },
      copy: {
        title: "Play Daredevil",
        body:
          "Daredevil [[cost|costs]] 4. Strength and Genius each print two [[resource|resources]], so discarding " +
          "both pays for him exactly. He's an [[ally|ally]] who can thwart and attack on his own.",
        tip: "Strength and Genius together pay his cost exactly.",
        doThis: "Play Daredevil",
        doThisTabbed: "Tap Daredevil, then Play",
        payWith: [
          { kind: "handCard", code: STRENGTH, doThis: "Tap Strength to spend its resources" },
          { kind: "handCard", code: GENIUS_FOR_JUSTICE, doThis: "Tap Genius, then Pay" },
        ],
      },
      mode: "await",
      completes: cardPlayed(JUSTICE_CARD),
      gate: FULL_GATE,
    },
    {
      id: "daredevil-does-both",
      anchor: { kind: "card", code: JUSTICE_CARD },
      copy: {
        title: "Thwarting that fights back",
        body:
          "Read Daredevil's text: after he thwarts, he deals 1 damage to an enemy. Every time he keeps the " +
          "scheme in check he also chips at Rhino. That's Justice in one card: you never have to stop fighting " +
          "to defend the scheme.",
        short: "After Daredevil thwarts, he deals 1 damage too.",
      },
      mode: "acknowledge",
    },
    {
      id: "fight-while-its-quiet",
      anchor: { kind: "zone", id: "mainScheme" },
      copy: {
        title: "Nothing to thwart yet",
        body:
          "[[mainScheme|The Break-In!]] has {threat} threat, so thwarting would do nothing this turn. When the " +
          "scheme is quiet, fight: attack Rhino with Daredevil if you like, then end your turn. Watch the scheme " +
          "during Rhino's phase: he'll add threat to it.",
        short: "The scheme is empty: fight now, then end your turn.",
        doThis: "Fight if you like, then end your turn",
      },
      mode: "await",
      completes: playerPhaseOfRound(2),
    },
    {
      id: "attack-or-thwart",
      anchor: { kind: "zone", id: "mainScheme" },
      copy: {
        title: "Attack or thwart?",
        body:
          "Now [[mainScheme|The Break-In!]] has {threat} [[threat|threat]]. Rhino adds more every villain phase, " +
          "and if it reaches the target you lose however hurt he is. The Justice habit: when the scheme is " +
          "climbing, clear it first, then spend what's left on attacks.",
        short: "Threat is climbing: clear it first, then attack.",
      },
      mode: "acknowledge",
    },
    {
      id: "thwart-with-daredevil",
      anchor: { kind: "action", id: "thwart" },
      copy: {
        title: "Thwart with Daredevil",
        body:
          "Daredevil's THW is 2: enough to clear the scheme on his own. Thwarting costs him 1 " +
          "[[consequentialDamage|consequential damage]], and his own response then deals 1 damage to Rhino. " +
          "If he's exhausted, Spider-Man can thwart instead.",
        doThis: "Thwart with Daredevil",
        pickSource: { code: JUSTICE_CARD, doThis: "Pick Daredevil to thwart" },
      },
      mode: "await",
      completes: threatRemovedFromMainScheme(),
      gate: FULL_GATE,
    },
    {
      id: "balance",
      copy: {
        title: "That's the balance",
        body:
          "The scheme is back under control, and Rhino took damage anyway. Spider-Man is still free to attack " +
          "this turn. Keep asking the same question each round: if threat is climbing, thwart first; if it's " +
          "quiet, fight.",
      },
      mode: "acknowledge",
    },
  ],
};

const ENERGY = cardId("01088");
const GENIUS = cardId("01089");
const ANCESTRAL_KNOWLEDGE = cardId("01042");

const AGGRESSION_CARD = cardId("01050"); // Hulk

const AGGRESSION_TRYIT: Lesson = {
  id: "aspect-tryit-aggression",
  title: "Aggression",
  when: cardInHand(AGGRESSION_CARD),
  waitingCopy: "It starts once Hulk is in your hand.",
  steps: [
    {
      id: "intro",
      copy: {
        title: "You're playing She-Hulk with Aggression",
        body:
          "Aggression is about hitting hard and racing the villain down. Look for Hulk in your hand — a big " +
          "[[ally|ally]] that adds real damage to the board the moment he's in play.",
      },
      mode: "acknowledge",
    },
    {
      id: "play-signature",
      anchor: { kind: "card", code: AGGRESSION_CARD },
      copy: {
        title: "Play Hulk",
        body:
          "Hulk [[cost|costs]] 2 — pay it by discarding another card from your hand for its printed " +
          "[[resource|resources]]. Once he's down, his own ATK adds to whatever damage you're already dealing.",
        tip: "Energy pays for him on its own.",
        doThis: "Play Hulk",
        payWith: [{ kind: "handCard", code: ENERGY, doThis: "Tap Energy, then Pay" }],
      },
      mode: "await",
      completes: cardPlayed(AGGRESSION_CARD),
      gate: FULL_GATE,
    },
  ],
};

const LEADERSHIP_CARD = cardId("01067"); // Maria Hill

const LEADERSHIP_TRYIT: Lesson = {
  id: "aspect-tryit-leadership",
  title: "Leadership",
  when: cardInHand(LEADERSHIP_CARD),
  waitingCopy: "It starts once Maria Hill is in your hand.",
  steps: [
    {
      id: "intro",
      copy: {
        title: "You're playing Captain Marvel with Leadership",
        body:
          "Leadership is about fielding [[ally|allies]] — more of them, hitting harder, staying longer. Look for " +
          "Maria Hill in your hand: a small ally today, but the kind every Leadership deck wants more of.",
      },
      mode: "acknowledge",
    },
    {
      id: "play-signature",
      anchor: { kind: "card", code: LEADERSHIP_CARD },
      copy: {
        title: "Play Maria Hill",
        body:
          "Maria Hill [[cost|costs]] 2 — pay it by discarding another card from your hand for its printed " +
          "[[resource|resources]]. She thwarts and attacks on her own every round, on top of your own turn.",
        tip: "Genius pays for her on its own.",
        doThis: "Play Maria Hill",
        payWith: [{ kind: "handCard", code: GENIUS, doThis: "Tap Genius, then Pay" }],
      },
      mode: "await",
      completes: cardPlayed(LEADERSHIP_CARD),
      gate: FULL_GATE,
    },
  ],
};

const PROTECTION_CARD = cardId("01081"); // Armored Vest

const PROTECTION_TRYIT: Lesson = {
  id: "aspect-tryit-protection",
  title: "Protection",
  when: cardInHand(PROTECTION_CARD),
  waitingCopy: "It starts once Armored Vest is in your hand.",
  steps: [
    {
      id: "intro",
      copy: {
        title: "You're playing Black Panther with Protection",
        body:
          "Protection is about staying alive: blocking hits, preventing damage before it lands. Look for Armored " +
          "Vest in your hand — it raises your DEF before Rhino ever swings at you.",
      },
      mode: "acknowledge",
    },
    {
      id: "play-signature",
      anchor: { kind: "card", code: PROTECTION_CARD },
      copy: {
        title: "Play Armored Vest",
        body:
          "Armored Vest [[cost|costs]] 1 — pay it by discarding another card from your hand for its printed " +
          "[[resource|resources]]. It has no target: it just makes you a little harder for Rhino to knock down.",
        tip: "Ancestral Knowledge pays for it on its own.",
        doThis: "Play Armored Vest",
        payWith: [{ kind: "handCard", code: ANCESTRAL_KNOWLEDGE, doThis: "Tap Ancestral Knowledge, then Pay" }],
      },
      mode: "await",
      completes: cardPlayed(PROTECTION_CARD),
      gate: FULL_GATE,
    },
  ],
};

/** One `Lesson` per aspect with a "Try it" game — keyed the same as `guide/aspect-tryit-config.ts#ASPECT_TRYIT_CONFIGS`. */
export const ASPECT_TRYIT_LESSONS: Readonly<Record<AspectTryItId, Lesson>> = {
  justice: JUSTICE_TRYIT,
  aggression: AGGRESSION_TRYIT,
  leadership: LEADERSHIP_TRYIT,
  protection: PROTECTION_TRYIT,
};
