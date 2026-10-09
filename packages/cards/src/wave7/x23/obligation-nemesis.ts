import type { AbilityRegistry, EventPattern } from "@mc/engine";
import {
  attachCard,
  boost,
  cannotAttach,
  cards,
  chosen,
  constant,
  countBoostIcons,
  dealEncounterCard,
  dealIndirectDamage,
  defeatingPlayer,
  defineAbilities,
  discard,
  discardEncounterCards,
  discardEncounterUntil,
  each,
  eventTarget,
  forcedInterrupt,
  gainsKeyword,
  ifThen,
  instead,
  moveCards,
  on,
  not,
  putIntoPlay,
  query,
  refCount,
  response,
  selectCards,
  self,
  shuffleDeck,
  takeDamage,
  totalPrintedResources,
  tuckCards,
  tuckedUnderRef,
  valueAtLeast,
  varOf,
  whenDefeated,
  whenRevealed,
  you,
  YOUR_IDENTITY,
  zone,
} from "../../dsl/index.js";

/** "When your turn ends" (Enraged, `wave1/hlk/kit.ts`): no `on.*` wrapper. */
const turnEnding: EventPattern = { on: "turnEnding", playerIs: "controller" };

const HONEY_BADGER = query("ally", { name: "Honey Badger" });

/**
 * "Discard 1 random card from your hand and take damage equal to the number of printed resources on it" (Hack 'n'
 * Slash 43033, as When Revealed and as Boost). An empty hand discards nothing and takes 0.
 */
const HACK_AND_SLASH = [
  selectCards("hacked", zone("hand", you, { random: 1 })),
  moveCards(cards(chosen("hacked")), "discard"),
  takeDamage(totalPrintedResources(chosen("hacked"))),
];

/**
 * X-23's obligation and nemesis set (43028-43033), docs/phase7-wave7.md §7.3, §3.86.
 *
 * - **Self-Isolation (43028)**: "Give to the Laura Kinney player" is engine data. When Revealed: search the hand, deck,
 *   discard pile and play area for Honey Badger and tuck her facedown under this obligation (the deck is shuffled after
 *   the search); if she cannot be found, discard this card and deal the player 1 facedown encounter card. It stays in
 *   play otherwise. Response: after the player makes a basic recovery, discard Honey Badger and this obligation.
 * - **Lady Deathstrike (43029)**: When Defeated, the defeating player discards the top encounter card and takes 1
 *   indirect damage per boost icon on it.
 * - **In the Name of Vengeance (43030)**: every enemy gains retaliate 1.
 * - **Cybermods (43031)**: attaches to Lady Deathstrike (data); with her out of play, discard from the top of the
 *   encounter deck until a minion, put it into play engaged with you and attach to it. The attached minion is shuffled
 *   into the encounter deck instead of being discarded.
 * - **Critical Wound (43032)**: attaches to your identity (data); when your turn ends, discard it and take 4 damage.
 * - **Hack 'n' Slash (43033)**: see `HACK_AND_SLASH`.
 */
export const X23_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({
  "43028.self-isolation-constant": whenRevealed(
    selectCards("inPlay", cards(each(query("ally", { name: "Honey Badger", controlledBy: you })))),
    selectCards("elsewhere", zone(["hand", "deck", "discard"], you, { filter: HONEY_BADGER })),
    tuckCards(cards(chosen("inPlay")), self, true),
    tuckCards(cards(chosen("elsewhere")), self, true),
    shuffleDeck(you),
    ifThen(not(valueAtLeast(refCount(tuckedUnderRef(self)), 1)), [discard(self), dealEncounterCard(you)]),
  ),
  "43028.self-isolation-response": response(
    on.basicRecovery(YOUR_IDENTITY),
    moveCards(cards(tuckedUnderRef(self)), "discard"),
    discard(self),
  ),

  "43029.when-defeated": whenDefeated(
    discardEncounterCards(1, { bind: "top" }),
    countBoostIcons(chosen("top"), "top"),
    dealIndirectDamage(defeatingPlayer, varOf("top.boostIcons")),
  ),

  "43030.in-the-name-of-vengeance-constant": constant(gainsKeyword({ name: "retaliate", value: 1 }, query("enemy"))),

  "43031.cybermods-constant": cannotAttach(
    discardEncounterUntil(query("minion"), "found"),
    putIntoPlay(chosen("found"), you),
    attachCard(self, chosen("found")),
  ),
  "43031.cybermods-forced-interrupt": forcedInterrupt(
    on.encounterCardDiscardedFromPlay({ hostOfSelf: true }),
    instead(moveCards(cards(eventTarget), "encounterDeckShuffle")),
  ),

  "43032.critical-wound-forced-interrupt": forcedInterrupt(turnEnding, discard(self), takeDamage(4)),

  "43033.when-revealed": whenRevealed(...HACK_AND_SLASH),
  "43033.boost": boost(...HACK_AND_SLASH),
});
