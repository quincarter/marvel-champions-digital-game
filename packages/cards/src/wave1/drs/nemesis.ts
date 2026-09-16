import type { EventPattern } from "@mc/engine";
import {
  anyOf,
  bindTargets,
  cancelIt,
  cards,
  chooseCards,
  chosen,
  confuse,
  defineAbilities,
  discard,
  forcedInterrupt,
  ifThen,
  moveCards,
  partOf,
  placeThreat,
  query,
  self,
  selectCards,
  stun,
  takeDamage,
  theMainScheme,
  topOfDeck,
  varAtLeast,
  when,
  whenDefeated,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
  yourIdentity,
  zone,
} from "../../dsl/index.js";
import { candidateSlot, printedCostOf, superlativeAmong } from "./local.js";

/** See `kit.ts`'s `milled` — the same "printed-resource branch" shape, reused here for Baron Mordo. */
const mordoHas = (type: "physical" | "energy" | "mental") => anyOf(varAtLeast(`mordo.${type}`), varAtLeast("mordo.wild"));

/**
 * "Discard a card from your hand with the highest cost" (Thoughtcasting, both halves): bind every hand card, break
 * ties on printed cost with a `superlative`, let the affected player choose among any tie (their own hand, not a
 * contested pool — unlike a tied villain/scheme, which needs `firstPlayerTargets`), then discard the chosen card.
 * `<slot>` receives exactly the one discarded card, read by each half's own follow-up effect.
 *
 * **`chooseCards`, not `chooseTarget`.** `chooseTarget`'s `TargetQuery`/`inSlot` narrowing only ever matches
 * in-play instances (`matchesQuery`'s domain) — exactly right for a *board* pick among a bound slot (Clash of the
 * Titans' tied enemies/characters, `wave1/hlk/nemesis.ts`; Burn Notice's tied in-play Preparation cards,
 * `wave1/bkw/obligation.ts`, `PREPARATION_YOU_CONTROL`'s `categories: ["ally","support","upgrade"]`), but a
 * *hand* card is never "in play", so `chooseTarget(slot, { inSlot: "costly" })` always found zero candidates here —
 * confirmed by direct engine tracing (an empty "costly" bind silently short-circuits `chooseTarget`, `moveCards`,
 * and `placeThreat`/`takeDamage` right along with it, with no error). `chooseCards`'s `from` is a `CardSelector`,
 * not a `TargetQuery`, and `cards(chosen("costly"))` (`kind: "ref"`, resolved via the generic `resolveRef`, not
 * `matchesQuery`) reads a bound slot regardless of zone — the same "already known gaps" class of Interrupt/Response
 * primitive gap, but this one was a plain misuse of an existing primitive, fixed here rather than skipped.
 */
const discardHighestCostCard = (slot: string) => [
  selectCards("hand", zone("hand", you)),
  bindTargets("costly", superlativeAmong(chosen("hand"), "highest", printedCostOf(candidateSlot))),
  chooseCards(slot, cards(chosen("costly")), { min: 1, max: 1, chooser: you }),
  moveCards(cards(chosen(slot)), "discard"),
];

/**
 * Doctor Strange's nemesis set: Baron Mordo (09028, nemesis minion), Open the Dark Dimension (09029, side scheme),
 * Counterspell ×2 (09030, attachment), Thoughtcasting (09031, treachery).
 *
 * Counterspell (09030): "Attach to your hero (data). Forced Interrupt: When you play an event, cancel its effects
 * and discard it. Then, discard this card." Was a skip because `cancelTriggeringEvent` only flagged the
 * `cardBeingPlayed` *event frame* as cancelled (closing its own interrupt/response windows) without stopping the
 * played card's own printed-ability effect frames, already queued independently on the stack by the time the
 * interrupt resolved — unlike `resolve/reveal.ts`'s `case "enterPlay"`, which already gated an encounter card's own
 * When Revealed on `!frame.effectsCancelled`. Landed with the wave B primitives batch (docs/phase7-wave1-scripting.md
 * §6): `play-card.ts` now pushes a card's own ability frames in a later `"abilities"` stage, after the
 * `cardBeingPlayed` window resolves, so there's something left for `cancelIt()` to cancel. Per RRG 1.8 "Cancel"
 * (p. 13) the play still stands otherwise — cost paid, "Max N per round" counted, `cardPlayed` still announced, and
 * the event still goes to its owner's discard "because it is still considered played" — so "cancel its effects and
 * discard it" needs no separate discard effect of its own; only "Then, discard this card" (Counterspell itself) is
 * scripted here.
 */
const whenYouPlayAnEvent: EventPattern = { on: "cardBeingPlayed", playerIs: "controller", targetIs: query("event") };
export const DRS_NEMESIS = defineAbilities({
  // Baron Mordo — Elite (data). Forced Interrupt: When Baron Mordo attacks you, discard the top card of your deck.
  // If that card's printed resource has: [physical] You are stunned. [energy] Take 2 damage. [mental] You are
  // confused. [wild] All of the above. The four bracketed lines are ingested as separate refs (Core's Hulk, 01050;
  // this pack's own Magic Blast, 09004); their behavior lives entirely in the forced interrupt below. `you`
  // (default player for `topOfDeck`/`takeDamage`/`stun`/`confuse`) is the attacked player, per Core's identical
  // "after enemy attacks you" convention (Ultron I/II, Radioactive Man, `core/scenarios/ultron.ts`/`klaw.ts`).
  "09028.baron-mordo-forced-interrupt": forcedInterrupt(
    when.enemyAttacks("self", { againstYou: true }),
    moveCards(topOfDeck(1), "discard", "mordo"),
    ifThen(mordoHas("physical"), stun(yourIdentity)),
    ifThen(mordoHas("energy"), takeDamage(2)),
    ifThen(mordoHas("mental"), confuse(yourIdentity)),
  ),
  "09028.baron-mordo-constant": partOf("09028.baron-mordo-forced-interrupt"),
  "09028.baron-mordo-constant-2": partOf("09028.baron-mordo-forced-interrupt"),
  "09028.baron-mordo-constant-3": partOf("09028.baron-mordo-forced-interrupt"),
  "09028.baron-mordo-constant-4": partOf("09028.baron-mordo-forced-interrupt"),

  // Open the Dark Dimension — When Revealed: Place the top card of the Invocation deck facedown under this scheme.
  // When Defeated: Shuffle the Invocation card under here into the Invocation deck. Exact shape of the synthetic
  // "Open the Dark Dimension" fixture proven in `packages/engine/src/separate-deck.test.ts` (`DARK_REVEALED`/
  // `DARK_DEFEATED`): `player: eachPlayer`, since the printed text names no specific player and only Doctor
  // Strange's own separate deck (named "Invocation") exists in this game to match it.
  "09029.when-revealed": whenRevealed({
    kind: "tuckCards",
    cards: { kind: "separateDeck", player: { kind: "each" }, name: "Invocation", top: { kind: "const", value: 1 } },
    under: { kind: "self" },
    facedown: true,
  }),
  "09029.when-defeated": whenDefeated(moveCards({ kind: "tucked", under: { kind: "self" } }, "separateDeckShuffle")),

  // Counterspell — Attach to your hero (data). Forced Interrupt: When you play an event, cancel its effects and
  // discard it (the discard is the standard "cancel" rule, not a separate effect here — see the module doc comment
  // above). Then, discard this card.
  "09030.counterspell-forced-interrupt": forcedInterrupt(whenYouPlayAnEvent, cancelIt(), discard(self)),

  // Thoughtcasting — When Revealed (Alter-Ego): Discard a card from your hand with the highest cost. Place threat
  // on the main scheme equal to the printed cost of that card. When Revealed (Hero): Discard a card from your hand
  // with the highest cost. Take damage equal to the printed cost of that card.
  "09031.when-revealed-alter-ego": whenRevealedAlterEgo(...discardHighestCostCard("discarded"), placeThreat(printedCostOf(chosen("discarded")), theMainScheme)),
  "09031.when-revealed-hero": whenRevealedHero(...discardHighestCostCard("discarded"), takeDamage(printedCostOf(chosen("discarded")))),
});
