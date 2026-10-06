/**
 * The Aspects lesson track's content (guided mode G10a, `docs/guided-mode.md` §5.4 and §3.7): one entry per aspect
 * covering what it's for, when to pick it, and two or three signature Core Set cards. G10c/G10d render this as
 * data; nothing here draws anything.
 *
 * Copy is original, written for a first-time player — not transcribed FFG card or rules text. Mid-sentence rules
 * words use `[[id|label]]` markup (`view/term-text-model.ts`), resolved against `@mc/content`'s glossary
 * (`schema/glossary.ts` `CONCEPT_GLOSSARY`, plus its keyword/status entries).
 *
 * **Signature cards.** `docs/guided-mode.md` §5.4's picks are suggestions, not gospel: "Tackle" isn't a Core Set
 * card, so it's swapped for Uppercut, a Core Aggression attack event that shows off the same "burst damage" idea.
 * Every code here is checked by `aspects.test.ts` to be a Core Set card, printed with that aspect, a member of
 * that aspect's Core precon (`CORE_STARTER_DECKS`), and in the playable pool (`PLAYABLE_CARDS`).
 *
 * **'Pool (wave 7).** The fifth aspect, from the Deadpool hero pack, so its signature cards and precon
 * (`deadpool-pool`) are not Core Set: `aspects.test.ts` checks them against the app's pool and the wave 7 precons.
 * Its "Try it" game (`aspect-tryit-config.ts`) is a Rhino game that carries the Dreadpool set. The rule it teaches is
 * the Dreadpool one: a player who chooses 'Pool as their aspect adds the Dreadpool set (Crisis of Infinite
 * Deadpools), 'Pool cards inside another aspect's deck do not (RRG 1.8 pp. 8, 12, 64).
 */
import type { CardId, CoreAspect, StarterDeckId } from "@mc/content";
import { cardId, starterDeckId } from "@mc/content";

/** One aspect's (or Basic's) lesson content. `preconId` is `null` for Basic, which has no Core precon of its own. */
export interface AspectGuide {
  readonly aspect: CoreAspect;
  readonly name: string;
  /** One line, e.g. "Thwarting — keeps threat off the scheme". */
  readonly tagline: string;
  /** Two to three sentences, may use `[[id|label]]` glossary markup. */
  readonly whatItsFor: string;
  /** Two to three bullets, may use `[[id|label]]` glossary markup. */
  readonly pickItWhen: readonly string[];
  /** Two or three cards printed with this aspect, in this aspect's precon and the app's pool. */
  readonly signatureCardCodes: readonly CardId[];
  /** The precon that shows the aspect (the "Try it" game's deck where there is one). `null` for Basic. */
  readonly preconId: StarterDeckId | null;
  /** One short line for the inline chip tip (Seats / Deck check / Deck builder aspect chips, G10b). */
  readonly tipLine: string;
}

const JUSTICE: AspectGuide = {
  aspect: "justice",
  name: "Justice",
  tagline: "Thwarting — keeps threat off the scheme",
  whatItsFor:
    "Justice is about [[thwart|thwarting]]: clearing [[threat|threat]] before it piles up. It's the balanced, " +
    "steady aspect, trading a bit of everything else for control over the [[mainScheme|main scheme]].",
  pickItWhen: [
    "The villain schemes fast, or adds [[sideScheme|side schemes]] that punish you for ignoring them.",
    "You want a good first aspect for learning the round loop — it rewards steady play over big swings.",
  ],
  signatureCardCodes: [cardId("01060"), cardId("01061"), cardId("01058")],
  preconId: starterDeckId("core-spider-man-justice"),
  tipLine: "Pick it when the villain schemes fast. A steady first choice.",
};

const AGGRESSION: AspectGuide = {
  aspect: "aggression",
  name: "Aggression",
  tagline: "Attacking and brawling",
  whatItsFor:
    "Aggression is about [[attack|attacking]]: burst damage, clearing minions, and racing the villain down before " +
    "he finishes his scheme. It spends resources on hitting hard rather than on staying safe.",
  pickItWhen: [
    "You want to end the fight fast, before the villain's threat catches up.",
    "The scenario floods the board with minions that need clearing.",
  ],
  signatureCardCodes: [cardId("01053"), cardId("01054"), cardId("01050")],
  preconId: starterDeckId("core-she-hulk-aggression"),
  tipLine: "Pick it to end fights fast or clear lots of minions.",
};

const LEADERSHIP: AspectGuide = {
  aspect: "leadership",
  name: "Leadership",
  tagline: "Allies — a wider board",
  whatItsFor:
    "Leadership is about [[ally|allies]]: it fields more of them, and makes them hit harder and stay in play " +
    "longer. Allies soak attacks, [[thwart|thwart]] and chip in damage every round on top of your own turn.",
  pickItWhen: [
    "Your hero likes a wide board rather than going it alone.",
    "You want extra bodies to [[defend|defend]] with, so no single hit falls on you.",
  ],
  signatureCardCodes: [cardId("01074"), cardId("01070"), cardId("01067")],
  preconId: starterDeckId("core-captain-marvel-leadership"),
  tipLine: "Pick it when your hero likes a wide board of allies.",
};

const PROTECTION: AspectGuide = {
  aspect: "protection",
  name: "Protection",
  tagline: "Defending and healing",
  whatItsFor:
    "Protection is about [[defend|defending]] and healing: blocking attacks, preventing damage before it lands, " +
    "and staying alive through a long fight rather than racing to end it.",
  pickItWhen: [
    "The villain hits hard, or your hero has low HP or DEF.",
    "You're the team's tank in a multiplayer game, keeping attacks off allies who can't take them.",
  ],
  signatureCardCodes: [cardId("01077"), cardId("01081"), cardId("01076")],
  preconId: starterDeckId("core-black-panther-protection"),
  tipLine: "Pick it when the villain hits hard or your hero is fragile.",
};

const POOL: AspectGuide = {
  aspect: "pool",
  name: "'Pool",
  tagline: "Big swings, at a price",
  whatItsFor:
    "[[poolAspect|'Pool]] is the fifth aspect, from the Deadpool pack: chatty [[ally|allies]], odd events and " +
    "upgrades that heal or hit hard, and a few that cost you something. It counts as an aspect everywhere a card " +
    "asks for one.",
  pickItWhen: [
    "You want a deck with bigger swings and a sense of humor, and can live with a few risks.",
    "You accept the cost: a player who chooses 'Pool adds the Dreadpool set to the encounter deck. 'Pool cards in another aspect's deck don't.",
  ],
  signatureCardCodes: [cardId("44013"), cardId("44017"), cardId("44029")],
  preconId: starterDeckId("deadpool-pool"),
  tipLine: "Pick it for wild, risky cards. It adds extra Dreadpool enemy cards to the villain's deck.",
};

const BASIC: AspectGuide = {
  aspect: "basic",
  name: "Basic",
  tagline: "Neutral cards any deck can use",
  whatItsFor:
    "Basic cards carry no aspect: [[resource|resource]] cards, allies and staples any hero can run alongside " +
    "whichever aspect they've picked. Every deck has them, always available.",
  pickItWhen: ["Always — Basic cards sit in every deck alongside your chosen aspect, not instead of it."],
  signatureCardCodes: [],
  preconId: null,
  tipLine: "Every deck runs these alongside its aspect.",
};

/**
 * One entry per playable aspect, plus Basic. In §5.4's table order, with 'Pool after the four Core aspects.
 */
export const ASPECT_GUIDES: readonly AspectGuide[] = [JUSTICE, AGGRESSION, LEADERSHIP, PROTECTION, POOL, BASIC];

/** Looks up one aspect's guide by `CoreAspect`, or `undefined` if it has none (every aspect has one now). */
export function aspectGuideOf(aspect: CoreAspect): AspectGuide | undefined {
  return ASPECT_GUIDES.find((guide) => guide.aspect === aspect);
}
