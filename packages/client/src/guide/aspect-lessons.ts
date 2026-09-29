/**
 * The four aspect "Try it" lessons (guided mode G10d, `docs/guided-mode.md` §3.7, §4 G10d): one short `Lesson`
 * (G5b's `view/lesson-model.ts`) per aspect, played against `guide/aspect-tryit-config.ts`'s own stacked opening.
 * Two steps each — an intro the player acknowledges, then "play the signature card" — gated to become current only
 * once that card is actually in hand (`cardInHand`, `view/lesson-model.ts`), the same `Lesson.when`/`waitingCopy`
 * shape `guide/tutorial-lessons.ts`'s own `PAYING_FOR_CARDS` uses for "wait for the flip".
 *
 * **Copy is original**, not transcribed FFG text, same rule `guide/aspects.ts`'s own header states for the aspect
 * lesson page. Mid-sentence terms use `[[id|label]]` glossary markup (G3a): `ally`, `thwart`, `threat`, `cost`,
 * `resource`.
 *
 * **Input stays loose while waiting for the play** (`docs/guided-mode.md` brief for G10d: "don't gate input
 * heavily... a gate only when a signature card is playable, and the soft gate still applies"): every "play it" step
 * names every basic action in its own `LessonStep.gate` alongside the signature card's own anchor, so a player free
 * to just play the game — attack, thwart, recover, flip, end the turn — never finds those blocked while this step
 * sits waiting for them to get around to the signature card (`guide/guide-controller.ts#gateFor`'s own "a card
 * anchor gates the whole hand" doc comment: without this, only hand cards would stay tappable).
 */
import { cardId } from "@mc/content";
import { cardInHand, cardPlayed, type Lesson } from "../view/lesson-model.js";
import type { AspectTryItId } from "./aspect-tryit-config.js";

const FULL_GATE = ["attack", "thwart", "recover", "changeForm", "endTurn"] as const;

const JUSTICE_CARD = cardId("01058"); // Daredevil

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
          "Justice is about [[thwart|thwarting]] — clearing [[threat|threat]] before it piles up. Look for " +
          "Daredevil in your hand: an [[ally|ally]] worth playing early, the way Black Cat was in the tutorial.",
      },
      mode: "acknowledge",
    },
    {
      id: "play-signature",
      anchor: { kind: "card", code: JUSTICE_CARD },
      copy: {
        title: "Play Daredevil",
        body:
          "Daredevil [[cost|costs]] 4 — pay it by discarding other cards from your hand for their printed " +
          "[[resource|resources]]. He's a Defender, so once he's down he's ready to take a hit for you.",
        tip: "Strength and Genius together pay his cost exactly.",
        doThis: "Play Daredevil",
      },
      mode: "await",
      completes: cardPlayed(JUSTICE_CARD),
      gate: FULL_GATE,
    },
  ],
};

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
