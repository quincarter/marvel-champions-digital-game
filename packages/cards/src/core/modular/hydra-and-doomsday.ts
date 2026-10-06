import {
  after,
  andThen,
  chosen,
  constant,
  countOf,
  damageOn,
  dealEncounterCard,
  defineAbilities,
  discard,
  encounterCards,
  forcedInterrupt,
  forcedResponse,
  bindTargets,
  chooseTarget,
  firstPlayer,
  heal,
  host,
  ifThen,
  inPlay,
  instead,
  named,
  not,
  placeThreat,
  putIntoPlay,
  query,
  rule,
  scaled,
  selectCards,
  self,
  shuffleEncounterDeck,
  TRAIT,
  valueAtLeast,
  when,
  whenDefeated,
  whenRevealed,
  you,
} from "../../dsl/index.js";
import { cardName } from "../names.js";

const LEGIONS_OF_HYDRA = cardName("01180");
const MADAME_HYDRA = cardName("01181");
const MODOK = cardName("01184"); // current title "M.O.D.O.K." (RRG 1.5 errata)
const LEGIONS_IN_PLAY = query("sideScheme", { name: LEGIONS_OF_HYDRA });

/**
 * "If X is not in play, search the encounter deck and discard pile for X and put it into play engaged with you, then
 * shuffle the encounter deck." A search that finds no X leaves the pre-"then" text unresolved (`searchFoundNothing`,
 * RRG 1.8 "'Then'", p. 44), but the shuffle is not `andThen`: it is also the Search rule's own shuffle (RRG 1.8
 * "Search", p. 39: "If any portion of a deck is searched, upon completion of that … card ability, shuffle that entire
 * deck"), which happens whether or not the search found anything.
 */
const fetchIntoPlay = (name: string, slot: string) =>
  ifThen(not(inPlay(name)), [
    selectCards(slot, encounterCards(["deck", "discard"], { name })),
    putIntoPlay(chosen(slot), you),
    shuffleEncounterDeck(),
  ]);

/** The Legions of Hydra modular set (01180–01182). */
export const LEGIONS_OF_HYDRA_SET = defineAbilities({
  // Legions of Hydra — When Revealed: If Madame Hydra is not in play, search the encounter deck and discard pile for Madame Hydra and put
  // her into play engaged with you, then shuffle the encounter deck. Place 2 additional threat here for each Hydra enemy in play.
  "01180.when-revealed": whenRevealed(
    fetchIntoPlay(MADAME_HYDRA, "madame"),
    placeThreat(scaled(countOf(query("enemy", { trait: TRAIT.HYDRA })), { times: 2 }), self),
  ),
  // Madame Hydra — Madame Hydra cannot take damage while the Legions of Hydra side scheme is in play.
  "01181.madame-hydra-constant": constant(
    rule({ kind: "cannotTakeDamage", target: { self: true }, while: inPlay(LEGIONS_OF_HYDRA) }),
  ),
  // [star] Forced Response: After Madame Hydra schemes or attacks, place 2 threat on the Legions of Hydra side scheme.
  // The set has two copies; with both in play the first player picks which one (RRG 1.8 "First Player", p. 19: an
  // encounter card with multiple eligible targets).
  "01181.madame-hydra-forced-response": forcedResponse(
    after.enemySchemesOrAttacks("self"),
    ifThen(
      valueAtLeast(countOf(LEGIONS_IN_PLAY), 2),
      chooseTarget("legions", LEGIONS_IN_PLAY, { chooser: firstPlayer }),
      bindTargets("legions", named(LEGIONS_OF_HYDRA)),
    ),
    placeThreat(2, chosen("legions")),
  ),
  // Hydra Soldier — When Defeated: Deal the engaged player an encounter card. ("You" on a minion's When Defeated is the engaged player.)
  "01182.when-defeated": whenDefeated(dealEncounterCard(you)),
});

/** The Doomsday Chair modular set (01183–01185). */
export const DOOMSDAY_CHAIR_SET = defineAbilities({
  // The Doomsday Chair — When Revealed: If M.O.D.O.K. is not in play, search the encounter deck and discard pile for M.O.D.O.K. and put him
  // into play engaged with you, then shuffle the encounter deck.
  "01183.when-revealed": whenRevealed(fetchIntoPlay(MODOK, "modok")),
  // Biomechanical Upgrades — Forced Interrupt: When attached minion would be defeated, heal all damage from it instead, then discard this card.
  // `heal` always fully resolves, so `andThen` is the faithful reading (RRG 1.8 "'Then'", p. 44) without changing
  // observable behavior today.
  "01185.biomechanical-upgrades-forced-interrupt": forcedInterrupt(
    when.defeated("host"),
    { would: true },
    instead(heal(damageOn(host), host), andThen(discard(self))),
  ),
});
