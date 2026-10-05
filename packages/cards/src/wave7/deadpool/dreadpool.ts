import { trait } from "@mc/content";
import type { AbilityRegistry, EffectSpec } from "@mc/engine";
import {
  addAccelerationToken,
  attachCard,
  constant,
  controllerOf,
  dealAsEncounterCard,
  dealDamage,
  defeatingPlayer,
  defineAbilities,
  each,
  encounterSetAside,
  engage,
  eventTarget,
  exists,
  firstPlayer,
  forEachPlayer,
  forcedInterrupt,
  host,
  heroAction,
  ifElse,
  ifThen,
  isAttached,
  moveCards,
  cards,
  not,
  on,
  placeThreat,
  playersWhere,
  query,
  revealCard,
  selectCards,
  self,
  spend,
  surge,
  thatPlayer,
  treatAttachedAllyAsMinion,
  varAtLeast,
  whenDefeated,
  whenRevealed,
  yourIdentity,
  chosen,
} from "../../dsl/index.js";

/**
 * The Dreadpool modular set (44037-44042), the Deadpool pack's own encounter set. It is not a set anyone picks: one
 * Crisis of Infinite Deadpools is shuffled into the encounter deck when a player chose the 'Pool aspect and the other
 * six cards start set aside (`EncounterSet.autoIncluded`; Deadpool insert, RRG 1.8 FAQ p. 64; docs/phase7-wave7.md
 * §3.74, Q44 = A). Crisis finds them there by `inEncounterSet: "dreadpool"`.
 *
 * - **Crisis of Infinite Deadpools (44037)**: "you" reveals the minion, then the side scheme (text order); the rest of
 *   the set-aside set is shuffled into the encounter deck; Crisis is removed from the game.
 * - **Dreadpool (44038)**: "Dreadpool engages the first player" is an interrupt as he enters play, so it also holds
 *   when he is revealed by the player who defeated him (When Defeated deals him facedown to that player). Defeated by
 *   no player (an encounter effect), nobody is dealt him and he is discarded.
 * - **Anti-Regeneration Ray (44040)**: the forced interrupt is heard for the attached character's own attacks, whichever
 *   side it is on: an enemy host attacking a hero, alter-ego or ally; Deadpool's identity (after the Hero Action)
 *   attacking a minion. The villain is never blanked ("non-villain character"). The +1 ATK is data.
 * - **'Pool-ized (44041)**: the host and the surge are as Manipulated Mind (`sm` 27171); the erratum (RRG 1.8 p. 69)
 *   adds "Attached ally engages its controller". Traits are 'POOL only (no `keepPrintedTraits`).
 */
const POOL = trait("POOL");
const DEADPOOL_CORPS = trait("DEADPOOL CORPS");
const DREADPOOL_SET = { inEncounterSet: "dreadpool" } as const;

/** "Each player who controls 1 or more 'Pool (pink) cards": a card in play under their control. */
const CONTROLS_POOL_CARD = playersWhere(
  exists(query(["ally", "upgrade", "support"], { aspect: "pool", controlledBy: thatPlayer })),
);

/** A non-villain character: the Ray's attacked character, on either side of an attack. */
const NON_VILLAIN_CHARACTER = query(["hero", "alterEgo", "ally", "minion"]);

/** "Treat the attacked character's text box as if it were blank (except for TRAITS) until the end of the attack." */
const BLANK_ATTACKED: EffectSpec = { kind: "blankTextBox", target: eventTarget, until: "endOfAttack" };

export const DREADPOOL: AbilityRegistry = defineAbilities({
  // Crisis of Infinite Deadpools
  "44037.when-revealed": whenRevealed(
    selectCards("minion", encounterSetAside({ ...DREADPOOL_SET, categories: ["minion"] })),
    revealCard(chosen("minion")),
    selectCards("scheme", encounterSetAside({ ...DREADPOOL_SET, categories: ["sideScheme"] })),
    revealCard(chosen("scheme")),
    moveCards(encounterSetAside(DREADPOOL_SET), "encounterDeckShuffle"),
    moveCards(cards(self), "removedFromGame"),
  ),

  // Dreadpool
  "44038.dreadpool-constant": forcedInterrupt(on.entersPlay("self"), engage(self, firstPlayer)),
  "44038.when-defeated": whenDefeated(moveCards(cards(self), "discard"), dealAsEncounterCard(self, defeatingPlayer)),

  // Dreadful Deeds (starting threat 2 is data)
  "44039.when-revealed": whenRevealed(forEachPlayer(CONTROLS_POOL_CARD, placeThreat(2, self))),

  // Anti-Regeneration Ray
  "44040.anti-regeneration-ray-forced-interrupt": forcedInterrupt(
    on.either(
      { ...on.enemyAttacks("host"), targetIs: NON_VILLAIN_CHARACTER },
      on.attacks("host", { target: NON_VILLAIN_CHARACTER }),
    ),
    BLANK_ATTACKED,
  ),
  "44040.anti-regeneration-ray-action": heroAction(
    { cost: spend({ energy: 1, mental: 1, physical: 1 }) },
    attachCard(self, yourIdentity),
  ),

  // 'Pool-ized
  "44041.pool-ized-constant": constant(treatAttachedAllyAsMinion([POOL])),
  "44041.when-revealed": whenRevealed(ifThen(isAttached(self), engage(host, controllerOf(host)), surge())),

  // Metacidal Tendencies
  "44042.when-revealed": whenRevealed(
    dealDamage(
      ifElse(exists(query("minion", { name: "Dreadpool" })), 3, 2),
      each(query("character", { trait: DEADPOOL_CORPS })),
      {
        bind: "hit",
      },
    ),
    ifThen(not(varAtLeast("hit.amount", 1)), addAccelerationToken()),
  ),
});
