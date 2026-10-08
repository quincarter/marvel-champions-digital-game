import type { AbilityRegistry } from "@mc/engine";
import {
  anyOf,
  boost,
  chosen,
  constant,
  dealAsEncounterCard,
  dealIndirectDamage,
  defeatingPlayer,
  defineAbilities,
  discard,
  each,
  eachPlayer,
  find,
  forEachPlayer,
  forcedInterrupt,
  gainsKeyword,
  ifThen,
  inForm,
  inPlay,
  modifyAttack,
  moveCards,
  named,
  on,
  query,
  resolveSpecialsOf,
  revealCard,
  self,
  special,
  thatPlayer,
  topOfDeck,
  totalPrintedResources,
  whenDefeated,
  whenRevealed,
  you,
} from "../../dsl/index.js";
import { resolveSettingSpecial, SETTING } from "./setting.js";

const THE_SAVAGE_LAND = "The Savage Land";

/**
 * Scenario or modular encounter set `savage_land` (Age of Apocalypse, docs/phase7-wave8.md §1.16, §2.8, §2.10, §3.1,
 * §3.23, §3.24, §4.1 Q15 = A): one of Dark Beast's three Setting sets, also a modular set. Setup, Guard and Hinder 1
 * per hero are data keywords.
 *
 * The Savage Land's Special discards the top 3 cards of the resolving player's deck and binds them to the slot
 * "discarded", which Land Out of Time reads through `resolveSpecialsOf`'s bind. Land Out of Time names The Savage Land,
 * not "the Setting environment", so it resolves that card's Special directly (no Q15 choice); otherwise it finds The
 * Savage Land wherever it is and reveals it (§3.1). Pterosaur resolves the Special for the revealing player, Giant Ape
 * for the player who defeated it (nobody when no player did: the Special is resolved only if a defeating player
 * exists), Village Under Attack for each player in player order. Each of those with several Settings in play lets the
 * resolving player choose which one.
 *
 * Velociraptor discards the top card of its target's deck and takes +1 ATK for this attack for each printed resource
 * icon of the discarded card, any type.
 *
 * Cards (6):
 * - 45127 The Savage Land (environment)
 * - 45128 Pterosaur (minion)
 * - 45129 Velociraptor (minion)
 * - 45130 Giant Ape (minion)
 * - 45131 Land Out of Time (treachery)
 * - 45132 Village Under Attack (side_scheme)
 */
export const SAVAGE_LAND: AbilityRegistry = defineAbilities({
  // The Savage Land — The villain gains retaliate 1.
  "45127.the-savage-land-constant": constant(gainsKeyword({ name: "retaliate", value: 1 }, query("villain"))),
  // Special: Discard the top 3 cards of your deck.
  "45127.the-savage-land-special": special(moveCards(topOfDeck(3, you), "discard", "discarded")),
  // When Revealed: Discard each other Setting environment in play.
  "45127.when-revealed": whenRevealed(discard(each(query("environment", { trait: SETTING, excluding: self })))),

  // Pterosaur — When Revealed: Resolve the Special on the Setting environment.
  "45128.when-revealed": whenRevealed(resolveSettingSpecial()),
  // [star] Boost: If The Savage Land is in play, deal Pterosaur to yourself as a facedown encounter card.
  "45128.boost": boost(ifThen(inPlay(THE_SAVAGE_LAND), dealAsEncounterCard(self))),

  // Velociraptor — Quickstrike (data). [star] Forced Interrupt: When Velociraptor attacks you, discard the top card of
  // your deck. Velociraptor gets +1 ATK for this attack for each resource icon discarded this way.
  "45129.velociraptor-forced-interrupt": forcedInterrupt(
    on.enemyAttacks("self", { againstYou: true }),
    moveCards(topOfDeck(1, you), "discard", "discarded"),
    modifyAttack({ atkBonus: totalPrintedResources(chosen("discarded")) }),
  ),

  // Giant Ape — Guard (data). When Defeated: The player who defeated Giant Ape resolves the Special on the Setting
  // environment; nobody does when no player defeated it.
  "45130.when-defeated": whenDefeated(
    ifThen(
      anyOf(inForm("hero", defeatingPlayer), inForm("alterEgo", defeatingPlayer)),
      resolveSettingSpecial(defeatingPlayer),
    ),
  ),

  // Land Out of Time — When Revealed: If The Savage Land is in play, resolve its Special and take 1 indirect damage for
  // each resource icon on the discarded cards. Otherwise, find The Savage Land and reveal it.
  "45131.when-revealed": whenRevealed(
    ifThen(
      inPlay(THE_SAVAGE_LAND),
      [
        resolveSpecialsOf(named(THE_SAVAGE_LAND), you, { bind: "land" }),
        dealIndirectDamage(you, totalPrintedResources(chosen("land.discarded"))),
      ],
      revealCard(find(query("environment", { name: THE_SAVAGE_LAND })), you),
    ),
  ),

  // Village Under Attack — Hinder 1 per hero (data). When Defeated: Each player resolves the Special on the Setting
  // environment, in player order.
  "45132.when-defeated": whenDefeated(forEachPlayer(eachPlayer, resolveSettingSpecial(thatPlayer))),
});
