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
import { abilityId, cardId } from "@mc/content";
import {
  cardPlayed,
  defenderDeclared,
  eventSeen,
  formIs,
  type Lesson,
  type LessonObservation,
  type LessonPredicate,
  villainActivationPast,
} from "../view/lesson-model.js";
import type { MechanicTryItId } from "./mechanic-tryits.js";

const FULL_GATE = ["attack", "thwart", "recover", "changeForm", "endTurn"] as const;

/** True once an event of `type` has been seen this lesson and no choice is left open: the ability behind it has settled. */
function seenAndSettled(type: Parameters<typeof eventSeen>[0]): LessonPredicate {
  const seen = eventSeen(type);
  return (observation: LessonObservation) => seen(observation) && observation.game.pendingChoice === null;
}

/** True once the game has reached the player phase of `round`: the "end your turn and come back" wait. */
function playerPhaseOfRound(round: number): LessonPredicate {
  return ({ game }) => game.round >= round && game.step.phase === "player";
}

/** The one Phoenix Force upgrade (either side) on the table, if any. */
function phoenixForceOf(observation: LessonObservation) {
  return Object.values(observation.game.instances).find((i) => i.cardId.startsWith("34002"));
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

const DOWN_TIME = cardId("34024");
const FIREBIRD = cardId("34013");
const ENERGY = cardId("34025");
const PSIONIC_BOND = abilityId("34001a.psionic-bond");

/**
 * Phoenix: take Phoenix Force from 4 power counters to none. The opening is Jean Grey in alter-ego form with Phoenix
 * Force Restrained (setup puts it into play with 4 counters, `wave6/phoenix/phoenix/identity.ts`). Round 1 spends two
 * (Psionic Bond paying for Down Time, then Phoenix Firebird's "remove a counter" choice), round 2 spends the last two
 * (Psionic Bond paying for the second Firebird, then its own choice), and removing the last counter flips the card:
 * the lesson reads the flipped card, never a count the client kept itself.
 */
const PHOENIX_TRYIT: Lesson = {
  id: "mechanic-tryit-phoenix",
  title: "Phoenix: Restrained and Unleashed",
  steps: [
    {
      id: "intro",
      copy: {
        title: "Phoenix Force holds her back",
        body:
          "[[phoenixForce|Phoenix Force]] is a permanent upgrade on your identity. It starts RESTRAINED with 4 power " +
          "counters. Take the last counter away and it flips to UNLEASHED: +2 ATK and -2 THW. Spend them on purpose.",
      },
      mode: "acknowledge",
    },
    {
      id: "flip",
      anchor: { kind: "action", id: "flip" },
      copy: {
        title: "Flip to Phoenix",
        body:
          "Psionic Bond and Phoenix Firebird both need her hero side, so [[flip|flip]] from Jean Grey to Phoenix. " +
          "Phoenix Force is not a form card: it flips by its own rule, never with this button.",
        doThis: "Flip to Phoenix",
      },
      mode: "await",
      completes: formIs("hero"),
      gate: FULL_GATE,
    },
    {
      id: "psionic-bond",
      anchor: { kind: "card", code: DOWN_TIME },
      copy: {
        title: "Pay with a power counter",
        body:
          "Down Time [[cost|costs]] 1. Psionic Bond pays it for free by removing one power counter from Phoenix Force, " +
          "once each phase. Watch her counters drop from 4 to 3.",
        tip: "Psionic Bond pays with a counter, not a card.",
        doThis: "Play Down Time",
        doThisTabbed: "Tap Down Time, then Play",
        payWith: [{ kind: "identityAbility", abilityId: PSIONIC_BOND, doThis: "Tap Psionic Bond to spend a counter" }],
      },
      mode: "await",
      completes: cardPlayed(DOWN_TIME),
      gate: FULL_GATE,
    },
    {
      id: "firebird-remove",
      anchor: { kind: "card", code: FIREBIRD },
      copy: {
        title: "Phoenix Firebird: remove a counter",
        body:
          "Phoenix Firebird has two choices: remove 1 power counter to ready Phoenix, or place 2 counters on Phoenix " +
          "Force. Energy pays its cost. Choose to remove one.",
        tip: "Pick Remove 1 power counter.",
        doThis: "Play Firebird, then choose Remove",
        doThisTabbed: "Tap Firebird, then Play",
        payWith: [{ kind: "handCard", code: ENERGY, doThis: "Tap Energy, then Pay" }],
      },
      mode: "await",
      completes: (observation) => {
        const force = phoenixForceOf(observation);
        return force !== undefined && (force.counters.power ?? 0) <= 2 && observation.game.pendingChoice === null;
      },
      gate: FULL_GATE,
    },
    {
      id: "end-turn",
      anchor: { kind: "action", id: "endTurn" },
      copy: {
        title: "Two counters left",
        body:
          "Phoenix Force is down to 2 counters, still RESTRAINED. End your turn: Rhino acts, and round 2 begins with " +
          "the last Firebird still in your hand.",
        doThis: "End your turn",
      },
      mode: "await",
      completes: playerPhaseOfRound(2),
      gate: FULL_GATE,
    },
    {
      id: "firebird-flip",
      anchor: { kind: "card", code: FIREBIRD },
      copy: {
        title: "Take the last counter",
        body:
          "Psionic Bond pays Firebird's cost with one counter, and Firebird removes the other. When the last one " +
          "leaves, Phoenix Force flips by itself.",
        tip: "Choose Remove 1 power counter again.",
        doThis: "Play Firebird with Psionic Bond, then choose Remove",
        doThisTabbed: "Tap Firebird, then Play",
        payWith: [{ kind: "identityAbility", abilityId: PSIONIC_BOND, doThis: "Tap Psionic Bond to spend a counter" }],
      },
      mode: "await",
      completes: (observation) => phoenixForceOf(observation)?.flipped === true,
      gate: FULL_GATE,
    },
    {
      id: "unleashed",
      copy: {
        title: "Unleashed",
        body:
          "Phoenix Force is UNLEASHED: +2 ATK, -2 THW, and Phoenix cards that check for the trait hit harder. " +
          "Placing counters back (Firebird's other choice, Cyclops, White Hot Room) flips it back once it holds 4 or more.",
      },
      mode: "acknowledge",
    },
  ],
};

/**
 * True once the player's turn has ended and Rhino's attack is being (or has been) dealt with: the defend prompt is
 * up, the villain phase is under way, or the round has already moved on. The tutorial's `villainActivationPast` can't
 * be used here: it is also true all through the player phase, and these lessons are not gated on the villain phase.
 */
function turnEnded(): LessonPredicate {
  return ({ game }) =>
    game.pendingChoice?.prompt.kind === "declareDefender" || game.step.phase === "villain" || game.round >= 2;
}

/** True once the defend decision is made (an event this lesson saw), or the chance has passed without one. */
function defenseDecided(): LessonPredicate {
  const declared = defenderDeclared();
  return (observation) => {
    if (declared(observation)) return true;
    if (observation.game.pendingChoice?.prompt.kind === "declareDefender") return false;
    return (
      observation.game.round >= 2 || (observation.game.step.phase === "villain" && villainActivationPast()(observation))
    );
  };
}

/** Shadowcat's mass form upgrade (Solid, or Phased once flipped), if it is on the table. */
function massFormOf(observation: LessonObservation) {
  return Object.values(observation.game.instances).find((i) => i.cardId.startsWith("32031"));
}

/**
 * Shadowcat: the mass form is a separate upgrade with its own flips, not the hero/alter-ego flip. Phase Control (an
 * alter-ego action) flips Solid to Phased; she flips to hero form so Rhino attacks her; defending while Phased takes
 * no damage, and Phased flips itself back to Solid after the defense (`wave6/mut_gen/shadowcat/identity.ts`). Every
 * check reads the upgrade's own `flipped` state, so the two kinds of flip can never be mistaken for each other.
 */
const SHADOWCAT_TRYIT: Lesson = {
  id: "mechanic-tryit-shadowcat",
  title: "Shadowcat: Solid and Phased",
  steps: [
    {
      id: "intro",
      copy: {
        title: "Two flips, not one",
        body:
          "Shadowcat has a mass form upgrade on her identity: Solid on one side, Phased on the other. It flips on its " +
          "own rules, so it is not the [[flip|hero and alter-ego flip]] you already know, and that button never touches it.",
      },
      mode: "acknowledge",
    },
    {
      id: "phase-control",
      anchor: { kind: "zone", id: "identity" },
      copy: {
        title: "Phase Control",
        body:
          "Kitty Pryde's Phase Control flips the mass form from Solid to Phased. It is an action, so use it once each " +
          "round. It leaves her hero and alter-ego form exactly as it was.",
        short: "Use Phase Control to go Phased.",
        doThis: "Tap Kitty Pryde, then Phase Control",
      },
      mode: "await",
      completes: (observation) => massFormOf(observation)?.flipped === true,
      gate: FULL_GATE,
    },
    {
      id: "flip",
      anchor: { kind: "action", id: "flip" },
      copy: {
        title: "Now flip to Shadowcat",
        body:
          "Rhino only attacks heroes; against an alter-ego he schemes. Flip to hero form so he comes for Shadowcat, " +
          "who is Phased. That second flip is the other kind, and it is separate.",
        doThis: "Flip to Shadowcat",
      },
      mode: "await",
      completes: formIs("hero"),
      gate: FULL_GATE,
    },
    {
      id: "end-turn",
      anchor: { kind: "action", id: "endTurn" },
      copy: {
        title: "Let him attack",
        body: "End your turn. Rhino attacks Shadowcat in his villain phase, and you choose who defends.",
        doThis: "End your turn",
      },
      mode: "await",
      completes: turnEnded(),
      gate: FULL_GATE,
    },
    {
      id: "declare-defender",
      anchor: { kind: "choice", id: "defend" },
      copy: {
        title: "Defend while Phased",
        body:
          "While Shadowcat is [[defend|defending]] and Phased she cannot take damage. Defend with her and Rhino's " +
          "hit does nothing.",
        short: "Defend with Shadowcat: Phased takes no damage.",
        doThis: "Pick Shadowcat to defend",
      },
      mode: "await",
      completes: defenseDecided(),
    },
    {
      id: "back-to-solid",
      copy: {
        title: "Phased flipped back to Solid",
        body:
          "She took no damage, and after she defended the Phased side flipped itself back to Solid. Solid is a " +
          "resource for attack and defense events, and flipping it from there is your choice. Phase Control is ready " +
          "again next round.",
      },
      mode: "acknowledge",
    },
  ],
};

/** One `Lesson` per mechanic with a "Try it" game, keyed like `guide/mechanic-tryit-config.ts`'s own record. */
export const MECHANIC_TRYIT_LESSONS: Readonly<Record<MechanicTryItId, Lesson>> = {
  storm: STORM_TRYIT,
  phoenix: PHOENIX_TRYIT,
  shadowcat: SHADOWCAT_TRYIT,
};
