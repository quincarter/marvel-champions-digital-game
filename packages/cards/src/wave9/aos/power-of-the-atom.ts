import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  after,
  boost,
  constant,
  dealDamage,
  dealIndirectDamage,
  defineAbilities,
  discard,
  each,
  enemyActivates,
  eventAmount,
  find,
  forcedResponse,
  gets,
  hasTrait,
  host,
  ifThen,
  named,
  not,
  on,
  placeThreat,
  query,
  revealCard,
  self,
  surge,
  threatAtLeast,
  varAtLeast,
  whenRevealed,
  discardFromHandCost,
  you,
} from "../../dsl/index.js";

const RADIOACTIVE_MAN = "Radioactive Man";
const GAMMA = trait("GAMMA");

/**
 * Modular encounter set `power_of_the_atom` (Agents of S.H.I.E.L.D., a Thunderbolt set; docs/phase7-wave9.md sections
 * 3.25, 3.34 and 3.35). Villainous and Victory 1 are data, and so is Radiation Exposure's stat box (-1 ATK, and -1 THW:
 * RRG 1.8 erratum, p. 69, whose printed "SCH" box "should be a 'THW' modifier"; docs/phase7-wave9.md section 1.14
 * item 3).
 *
 * **Radioactive Man (50152)**: Forced Response after he activates against you (an attack or a scheme): 1 damage to
 * each character you control (your identity and your allies).
 *
 * **Radiation Exposure (50153)**: the star on the ATK box: "If attached identity has the Gamma trait, this attachment
 * gives +1 ATK instead", so the data's -1 ATK becomes +1 with a constant +2 while the identity is Gamma (THW stays
 * -1). Forced Response after you recover: discard 1 card from your hand (the cost), then discard this card; an empty
 * hand pays nothing and keeps it.
 *
 * **Runaway Nuclear Reaction (50154)**: Forced Response after Radioactive Man is dealt any amount of damage: that
 * amount of threat here (damage dealt, which a tough status card does not reduce: dealt-vs-taken audit), then at 10
 * or more threat, 10 damage to each character (enemies included, RRG 1.8 "Character", p. 11) and it is discarded.
 *
 * **Power of the Atom (50155)**: reveals Radioactive Man (found, or engaged with the revealing player when in play),
 * who activates against the revealing player; surge when nobody activated. Boost: 2 indirect damage to you.
 *
 * Cards (4):
 * - 50152 Radioactive Man (minion)
 * - 50153 Radiation Exposure (attachment)
 * - 50154 Runaway Nuclear Reaction (side_scheme)
 * - 50155 Power of the Atom (treachery)
 */
export const POWER_OF_THE_ATOM: AbilityRegistry = defineAbilities({
  "50152.radioactive-man-forced-response": forcedResponse(
    after.enemyActivates("self", { againstYou: true }),
    dealDamage(1, each(query("character", { controller: "you" }))),
  ),

  "50153.radiation-exposure-constant": constant(gets("atk", 2, { hostOfSelf: true }, { while: hasTrait(host, GAMMA) })),
  "50153.radiation-exposure-forced-response": forcedResponse(
    on.basicRecovery("host"),
    { cost: discardFromHandCost(1, 1) },
    discard(self),
  ),

  "50154.runaway-nuclear-reaction-forced-response": forcedResponse(
    on.damage(query("minion", { name: RADIOACTIVE_MAN }), { dealt: true }),
    placeThreat(eventAmount, self),
    // Discarded first: the 10 damage dealt to Radioactive Man would otherwise be a second trigger of this still-in-play
    // card (threat 10 more, 10 damage more), and the card's text ends the scheme with that one blast.
    ifThen(threatAtLeast(self, 10), [discard(self), dealDamage(10, each(query("character")))]),
  ),

  "50155.when-revealed": whenRevealed(
    revealCard(find(query("minion", { name: RADIOACTIVE_MAN })), you),
    enemyActivates(named(RADIOACTIVE_MAN), { against: you, bind: "activated" }),
    ifThen(not(varAtLeast("activated.made")), surge()),
  ),
  "50155.boost": boost(dealIndirectDamage(you, 2)),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const POWER_OF_THE_ATOM_SKIPPED: Readonly<Record<string, string>> = {};
