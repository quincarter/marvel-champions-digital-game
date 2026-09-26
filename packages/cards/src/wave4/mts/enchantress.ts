import { trait } from "@mc/content";
import {
  alterEgoAction,
  anyOfCards,
  attachCard,
  cards,
  chooseCards,
  chosen,
  constant,
  controllerOf,
  defineAbilities,
  encounterCards,
  encounterSetAside,
  engage,
  host,
  ifThen,
  moveCards,
  query,
  rule,
  self,
  shuffleEncounterDeck,
  spend,
  surge,
  treatAttachedAllyAsMinion,
  whenRevealed,
  yourIdentity,
} from "../../dsl/index.js";
import type { Predicate, TargetRef } from "@mc/engine";

/**
 * Enchantress (`mts` modular, 21177–21179, docs/phase7-wave4.md §2.2, §3.9, §3.23): Thanos's own Valkyrie-nemesis
 * counterpart with the same three card names (Enchantress, Beguiled, Seduced) and near-identical printed text as
 * her Valkyrie obligation/nemesis set (`valk` 25029/25031/25032, `valk/valkyrie-obligation-nemesis.ts`) — but
 * `../reprints.ts` only aliases a wave 4 card against an *earlier* (Core–cycle 2) card, so a same-wave coincidence
 * like this is never auto-aliased, and the two sets are not the same encounter set at setup (this one is a
 * standalone recommended modular, not shuffled into a nemesis-only deck), so each gets its own script here. The one
 * behavioral difference: Beguiled/Enchantress's "the set-aside area" is `encounterSetAside` (the scenario's own
 * shared set-aside pool a set-aside Seduced would sit in — the same pool Odin's or Kang's set-aside cards use), not
 * a hero's own nemesis-set-aside pile (`valk`'s `setAside(you, …)`, only meaningful when Enchantress is played as
 * Valkyrie's nemesis set).
 */

/** "If you cannot, this card gains surge" (Goblin Glider, `wave1/gob/local.ts`'s own precedent; `valk`'s own
 * `valkyrie-obligation-nemesis.ts` for the same card family): whether `attachesTo` found a legal host. */
const isAttached = (of: TargetRef): Predicate => ({ kind: "isAttached", of });

const ENTHRALLED = trait("ENTHRALLED");
const ATTACK = trait("ATTACK");

export const ENCHANTRESS = defineAbilities({
  // Enchantress (minion, 21177; Elite is data) — When Revealed: Search the encounter deck, discard pile, and
  // set-aside area for a copy of Seduced and attach it to your identity. (Shuffle.) "You" is the revealing player
  // (RRG 1.8 "You, Your", p. 49), the same `yourIdentity` every other When Revealed uses.
  "21177.when-revealed": whenRevealed(
    chooseCards(
      "seduced",
      anyOfCards(
        encounterCards(["deck", "discard"], query("attachment", { name: "Seduced" })),
        encounterSetAside(query("attachment", { name: "Seduced" })),
      ),
      { min: 1, max: 1 },
    ),
    attachCard(chosen("seduced"), yourIdentity),
    shuffleEncounterDeck(),
  ),

  // Beguiled (attachment x2, 21178; ruling Dec 17, 2025 (1) #3: "essentially a status change" — the ally never
  // leaves play, docs/phase7-wave4.md §3.9) — Treat attached ally as an Enthralled minion with a blank text box.
  // Attached minion's SCH is equal to its printed THW and it does not take consequential damage (both already true
  // of `treatAttachedAllyAsMinion`'s `schFromThw` and its "no ally action offered" shape, per §3.9's own landed
  // note). When Revealed: Attach to the ally with the highest cost without Beguiled attached (data `attachesTo`,
  // the superlative host). Attached ally engages its controller. Otherwise, this card gains surge.
  "21178.beguiled-constant": constant(treatAttachedAllyAsMinion([ENTHRALLED])),
  "21178.when-revealed": whenRevealed(ifThen(isAttached(self), engage(host, controllerOf(host)), surge())),

  // Seduced (attachment x2, 21179) — Attach to your identity (data). You cannot make basic attacks or play Attack
  // events. Alter-Ego Action: Spend [energy][mental] resources → discard this card.
  "21179.seduced-constant": constant(
    rule({ kind: "cannotAttack", target: query("enemy"), attacker: { hostOfSelf: true } }),
    rule({ kind: "cannotPlay", player: controllerOf(host), cards: query("event", { trait: ATTACK }) }),
  ),
  "21179.seduced-action": alterEgoAction({ cost: spend({ energy: 1, mental: 1 }) }, moveCards(cards(self), "discard")),
});
