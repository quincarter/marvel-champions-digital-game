/**
 * The hero-mechanic "Try it" lessons (guided mode §3.14, `docs/guided-mode.md`): one short `Lesson` per mechanic, played
 * against `guide/mechanic-tryit-config.ts`'s own opening on the same `GuideController` and `LessonStep` shapes the
 * aspect lessons use (`guide/aspect-lessons.ts`). Each is a scripted situation: the lesson names the one thing to do,
 * the player does it with the real controls, and the step advances when the engine's own state or events say it
 * happened, never on a click the client counted itself.
 *
 * Copy is original, written for a player who has read the mechanic's glossary entry once. Mid-sentence terms use
 * `[[id|label]]` markup (`view/term-text-model.ts`); `tip`, `short` and `doThis` are plain text. Input stays loose
 * (`FULL_GATE` lists every basic action), the way the aspect lessons keep it: a player free to keep playing is never
 * blocked while a step waits for them to get around to the mechanic.
 */
import { eventSeen, formIs, type Lesson, type LessonObservation, type LessonPredicate } from "../view/lesson-model.js";
import type { MechanicTryItId } from "./mechanic-tryits.js";

const FULL_GATE = ["attack", "thwart", "recover", "changeForm", "endTurn"] as const;

/** True once an event of `type` has been seen this lesson and no choice is left open: the ability behind it has settled. */
function seenAndSettled(type: Parameters<typeof eventSeen>[0]): LessonPredicate {
  const seen = eventSeen(type);
  return (observation: LessonObservation) => seen(observation) && observation.game.pendingChoice === null;
}

/**
 * Storm: swap the Weather in play, then use its Special. The opening is solo Storm in alter-ego form with Clear
 * Skies already in play (setup's pick), so the lesson flips her first and then asks for Weather Control. The swap
 * and the new Weather's Special are one ability (`wave6/storm/storm/identity.ts`): the `cardsSwapped` event is the
 * swap, and the ability is settled once any choice its Special asks for (Thunderstorm's target) is answered.
 */
const STORM_TRYIT: Lesson = {
  id: "mechanic-tryit-storm",
  title: "Storm: the Weather deck",
  steps: [
    {
      id: "intro",
      copy: {
        title: "Storm keeps a Weather deck",
        body:
          "Storm's four Weather cards wait in a facedown [[weatherDeck|Weather deck]] beside her identity. One Weather " +
          "is always in play, and it changes every character on the table, enemies too. Setup already put one into play.",
      },
      mode: "acknowledge",
    },
    {
      id: "flip",
      anchor: { kind: "action", id: "flip" },
      copy: {
        title: "Flip to Storm",
        body:
          "Weather Control is printed on Storm's hero side, so [[flip|flip]] from Ororo to Storm first. Flipping is " +
          "free once each turn.",
        doThis: "Flip to Storm",
      },
      mode: "await",
      completes: formIs("hero"),
      gate: FULL_GATE,
    },
    {
      id: "weather-control",
      anchor: { kind: "zone", id: "identity" },
      copy: {
        title: "Use Weather Control",
        body:
          "Weather Control swaps the Weather in play for one you pick from the deck, then resolves the new Weather's " +
          "Special. Use it once each round. Pick any Weather you like, and answer whatever its Special asks.",
        tip: "A Special only resolves when another ability says so.",
        short: "Use Weather Control, then pick a Weather.",
        doThis: "Tap Storm, then Weather Control",
      },
      mode: "await",
      completes: seenAndSettled("cardsSwapped"),
      gate: FULL_GATE,
    },
    {
      id: "special-resolved",
      copy: {
        title: "Swapped, and the Special resolved",
        body:
          "The new Weather is in play and its Special has happened once. Its other text stays on for as long as it " +
          "is in play. Match the Weather to the turn: Hurricane clears threat, Thunderstorm hits an enemy, Clear " +
          "Skies draws a card, and Blizzard silences a minion.",
      },
      mode: "acknowledge",
    },
  ],
};

/** One `Lesson` per mechanic with a "Try it" game, keyed like `guide/mechanic-tryit-config.ts`'s own record. */
export const MECHANIC_TRYIT_LESSONS: Readonly<Record<MechanicTryItId, Lesson>> = {
  storm: STORM_TRYIT,
};
