import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  attachCard,
  boost,
  cannotAttach,
  chosen,
  confuse,
  damageOn,
  defeatingPlayer,
  defineAbilities,
  discard,
  each,
  encounterCards,
  enemyActivates,
  exists,
  forcedInterrupt,
  heal,
  host,
  ifThen,
  instead,
  on,
  oneCopyOf,
  query,
  revealCard,
  selectCards,
  self,
  shuffleEncounterDeck,
  stun,
  surge,
  whenDefeated,
  whenRevealed,
  you,
  yourIdentity,
} from "../../../dsl/index.js";

const ACOLYTE_ENGAGED = query("minion", { trait: trait("ACOLYTE"), engagedWith: "you" });

/**
 * The Exodus modular set (`exodus`, `gambit` 37032-37035; docs/phase7-wave6.md §2, §6.2): Exodus (minion), Herald of
 * Avalon (side scheme), Psionic Shield x2 (attachment) and Acolyte Frenzy x2 (treachery).
 *
 * - **Psionic Shield** (erratum, RRG 1.8 p. 68): "When attached minion would leave play, instead heal all damage from
 *   that minion. Then, discard this attachment." The printed "and put it back into play" is gone: the minion simply
 *   never leaves. The host and +1 ATK / +1 SCH are data (`attachesTo`, `statModifiers`); "Otherwise, Psionic Shield
 *   gains surge" is its `cannotAttach` ability.
 * - **Herald of Avalon**: the defeating player reveals Exodus, so he engages them (Fabian Cortez's shape).
 * - **Acolyte Frenzy**: only ACOLYTE minions engaged with you activate; none and the card gains surge.
 */
export const EXODUS_ABILITIES: AbilityRegistry = defineAbilities({
  // Exodus — Retaliate 1 and Villainous are data. When Revealed: search the encounter deck and discard pile for the
  // Psionic Shield attachment and attach it to Exodus. (Shuffle.)
  "37032.when-revealed": whenRevealed(
    selectCards(
      "found",
      oneCopyOf(encounterCards(["deck", "discard"], query("attachment", { name: "Psionic Shield" }))),
    ),
    attachCard(chosen("found"), self),
    shuffleEncounterDeck(),
  ),

  // Herald of Avalon — When Defeated: the player who defeated this scheme searches the encounter deck and discard pile
  // for Exodus and reveals him. (Shuffle.)
  "37033.when-defeated": whenDefeated(
    selectCards("found", oneCopyOf(encounterCards(["deck", "discard"], query("minion", { name: "Exodus" })))),
    revealCard(chosen("found"), defeatingPlayer),
    shuffleEncounterDeck(),
  ),

  // Psionic Shield — Attach to a minion (data). Otherwise, Psionic Shield gains surge.
  "37034.psionic-shield-constant": cannotAttach(surge()),
  // Forced Interrupt: When attached minion would leave play, instead heal all damage from that minion. Then, discard
  // this attachment. (Erratum RRG 1.8 p. 68: no "and put it back into play".)
  "37034.psionic-shield-forced-interrupt": forcedInterrupt(
    on.leavesPlay("host"),
    instead(heal(damageOn(host), host), discard(self)),
  ),

  // Acolyte Frenzy — When Revealed: each ACOLYTE minion engaged with you activates against you. If you are not engaged
  // with an ACOLYTE minion, this card gains surge.
  "37035.when-revealed": whenRevealed(
    ifThen(exists(ACOLYTE_ENGAGED), enemyActivates(each(ACOLYTE_ENGAGED), { against: you }), surge()),
  ),
  // [star] Boost: You are stunned and confused.
  "37035.boost": boost(stun(yourIdentity), confuse(yourIdentity)),
});
