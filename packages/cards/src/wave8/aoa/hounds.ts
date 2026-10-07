import type { AbilityRegistry } from "@mc/engine";
import {
  atEndOfAttack,
  chooseCards,
  chosen,
  changeForm,
  constant,
  dealAsEncounterCard,
  defeatingPlayer,
  defineAbilities,
  discard,
  encounterCards,
  enemyAttack,
  exists,
  find,
  firstRevealGainsSurge,
  forcedInterrupt,
  ifThen,
  isHero,
  modifyAttack,
  named,
  on,
  placeThreat,
  query,
  revealCard,
  self,
  shuffleEncounterDeck,
  whenDefeated,
  whenRevealed,
  you,
} from "../../dsl/index.js";

const RELEASE_THE_HOUNDS = "Release the Hounds";
const A_HOUND = query("minion", { name: "Hound" });

/**
 * Modular encounter set `hounds` (Age of Apocalypse, docs/phase7-wave8.md §2.4, §3.1, §3.16, §8.4). Ahab's find and
 * reveal is engine task 2 (§3.1, commit 88f61ac0): a Release the Hounds in play takes his 3 threat instead, one out of
 * play is found (the encounter deck, then its discard pile; a searched deck is shuffled) and revealed, and a Hound in
 * play is not part of the search.
 *
 * Hound's "change your identity to hero form" is a card effect, so it does not use the once-per-round change. Release
 * the Hounds' surge is the "first copy revealed each phase" rule (`firstRevealGainsSurge`), read while the scheme is in
 * play. When it is defeated the player who defeated it chooses the Hound; the search covers the encounter deck and its
 * discard pile, and the deck is shuffled afterwards.
 *
 * Ahab's Energy Spear attaches to Ahab, otherwise to the villain (data). Its "you" is the player attacked: the
 * interrupt is forced and only answers an attack against that player.
 *
 * Cards (4):
 * - 45097 Ahab (minion)
 * - 45098 Hound (minion)
 * - 45099 Ahab's Energy Spear (attachment)
 * - 45100 Release the Hounds (side_scheme)
 */
export const HOUNDS: AbilityRegistry = defineAbilities({
  // Ahab — When Revealed: if Release the Hounds is in play, place 3 threat on it. Otherwise, find it and reveal it.
  "45097.when-revealed": whenRevealed(
    ifThen(
      exists(query("sideScheme", { name: RELEASE_THE_HOUNDS })),
      placeThreat(3, named(RELEASE_THE_HOUNDS)),
      revealCard(find(query("sideScheme", { name: RELEASE_THE_HOUNDS })), you),
    ),
  ),

  // Hound — When Revealed: if you are in hero form, Hound attacks you. Otherwise, change your identity to hero form.
  "45098.when-revealed": whenRevealed(ifThen(isHero(), enemyAttack(self, { against: you }), changeForm(you, "hero"))),

  // Ahab's Energy Spear — [star] Forced Interrupt: when attached enemy attacks you, this attack gains overkill and
  // piercing. At the end of this attack, discard Ahab's Energy Spear.
  "45099.ahabs-energy-spear-forced-interrupt": forcedInterrupt(
    on.enemyAttacks("host", { againstYou: true }),
    modifyAttack({ keywords: ["overkill", "piercing"] }),
    atEndOfAttack(discard(self)),
  ),

  // Release the Hounds — the first copy of Hound revealed each phase gains surge.
  "45100.release-the-hounds-constant": constant(firstRevealGainsSurge(A_HOUND, "phase")),
  // Release the Hounds — When Defeated: the defeating player searches the encounter deck and discard pile for a copy of
  // Hound and deals it to themself as a facedown encounter card.
  "45100.when-defeated": whenDefeated(
    chooseCards("found", encounterCards(["deck", "discard"], A_HOUND), {
      min: 1,
      max: 1,
      chooser: defeatingPlayer,
    }),
    dealAsEncounterCard(chosen("found"), defeatingPlayer),
    shuffleEncounterDeck(),
  ),
});
