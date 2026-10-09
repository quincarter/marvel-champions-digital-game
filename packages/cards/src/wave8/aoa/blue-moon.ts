import { trait } from "@mc/content";
import type { AbilityRegistry, Predicate } from "@mc/engine";
import {
  anyOf,
  boost,
  cannotAttach,
  chosen,
  confuse,
  constant,
  dealAsEncounterCard,
  dealDamage,
  defineAbilities,
  defeatingPlayer,
  discard,
  discardEncounterCards,
  each,
  encounterCards,
  exhaust,
  forcedInterrupt,
  gainsKeyword,
  gainsTrait,
  gets,
  ifElse,
  ifThen,
  inForm,
  inPlay,
  isConfused,
  isStunned,
  moveCards,
  query,
  refMatches,
  revealCard,
  rule,
  self,
  setVar,
  special,
  stun,
  surge,
  varAtLeast,
  when,
  whenDefeated,
  whenRevealed,
  yourIdentity,
} from "../../dsl/index.js";
import { resolveSettingSpecial, SETTING } from "./setting.js";

const IMPERIAL_GUARD = trait("IMPERIAL GUARD");
const IMPERIAL_GUARD_MINION = query("minion", { trait: IMPERIAL_GUARD });
const TRIAL_BY_COMBAT = "Trial by Combat";

/**
 * "If you were already [status]": read before the status is given, kept in a var so the effects still run in the
 * order the text prints them (the status first, then the Special).
 */
const readAlready = (name: string, already: Predicate) => setVar(name, ifElse(already, 1, 0));

/**
 * Scenario or modular encounter set `blue_moon` (Age of Apocalypse, docs/phase7-wave8.md §1.16, §2.8, §3.23, §3.24,
 * §4.1 Q14 = B and Q15): one of Dark Beast's three Setting sets, also a modular set. Setup, Teamwork (Imperial Guard)
 * and Hinder 1 per hero are data keywords.
 *
 * The Setting environment's Special is resolved by the revealing player for Oracle, Manta, Earthquake and Warstar. For
 * Imperial Guardsman it is the player who defeated the attached minion (Q14 = B), and nobody when no player did:
 * the Special is resolved only if a defeating player exists, since an unnamed player would otherwise fall back to the
 * engaged player. With several Setting environments in play the resolving player chooses which one (Q15 = A, a
 * `chooseTarget` before the Special); no second Setting with a Special can be staged until the Savage Land and Genosha
 * are scripted, so that choice stays unproven here.
 *
 * Imperial Guardsman's first ref is its "Otherwise, this card gains surge" half (a `cannotAttach` ability, as the
 * Sinister Six attachments), the second is the +4 hit points and the trait.
 *
 * Cards (8):
 * - 45139 Blue Area of the Moon (environment)
 * - 45140 Gladiator (minion)
 * - 45141 Oracle (minion)
 * - 45142 Manta (minion)
 * - 45143 Earthquake (minion)
 * - 45144 Warstar (minion)
 * - 45145 Imperial Guardsman (attachment)
 * - 45146 Trial by Combat (side_scheme)
 */
export const BLUE_MOON: AbilityRegistry = defineAbilities({
  // Blue Area of the Moon — Each minion gains guard.
  "45139.blue-area-of-the-moon-constant": constant(gainsKeyword({ name: "guard" }, query("minion"))),
  // Special: Deal 1 damage to your identity.
  "45139.blue-area-of-the-moon-special": special(dealDamage(1, yourIdentity)),
  // When Revealed: Discard each other Setting environment in play.
  "45139.when-revealed": whenRevealed(discard(each(query("environment", { trait: SETTING, excluding: self })))),

  // Gladiator — While Trial by Combat is in play, Gladiator cannot take damage.
  "45140.gladiator-constant": constant(
    rule({ kind: "cannotTakeDamage", target: query("minion", { self: true }), while: inPlay(TRIAL_BY_COMBAT) }),
  ),
  // [star] Boost: If Trial by Combat is in play, deal Gladiator to yourself as a facedown encounter card.
  "45140.boost": boost(ifThen(inPlay(TRIAL_BY_COMBAT), dealAsEncounterCard(self))),

  // Oracle — When Revealed: You are confused. If you were already confused, resolve the Special.
  "45141.when-revealed": whenRevealed(
    readAlready("oracle.already", isConfused(yourIdentity)),
    confuse(yourIdentity),
    ifThen(varAtLeast("oracle.already"), resolveSettingSpecial()),
  ),

  // Manta — When Revealed: You are stunned. If you were already stunned, resolve the Special.
  "45142.when-revealed": whenRevealed(
    readAlready("manta.already", isStunned(yourIdentity)),
    stun(yourIdentity),
    ifThen(varAtLeast("manta.already"), resolveSettingSpecial()),
  ),

  // Earthquake — When Revealed: Exhaust your identity. If you were already exhausted, resolve the Special.
  "45143.when-revealed": whenRevealed(
    readAlready("earthquake.already", refMatches(yourIdentity, { exhausted: true })),
    exhaust(yourIdentity),
    ifThen(varAtLeast("earthquake.already"), resolveSettingSpecial()),
  ),

  // Warstar — When Revealed: Discard the top card of the encounter deck. If that card is an Imperial Guard minion,
  // reveal it. Otherwise, resolve the Special.
  "45144.when-revealed": whenRevealed(
    discardEncounterCards(1, {
      forEachDiscarded: {
        slot: "discarded",
        effects: [
          ifThen(
            refMatches(chosen("discarded"), IMPERIAL_GUARD_MINION, { anywhere: true }),
            revealCard(chosen("discarded")),
            resolveSettingSpecial(),
          ),
        ],
      },
    }),
  ),

  // Imperial Guardsman — Attach to a minion (data). Otherwise, this card gains surge (it is then discarded).
  "45145.imperial-guardsman-constant": cannotAttach(surge()),
  // Attached minion gets +4 hit points and gains the Imperial Guard trait.
  "45145.imperial-guardsman-constant-2": constant(
    gets("hp", 4, query("minion", { hostOfSelf: true })),
    gainsTrait(IMPERIAL_GUARD, query("minion", { hostOfSelf: true })),
  ),
  // Forced Interrupt: When attached minion is defeated, resolve the Special on the Setting environment. The player who
  // defeated the minion resolves it; nobody does when no player did (Q14 = B).
  "45145.imperial-guardsman-forced-interrupt": forcedInterrupt(
    when.defeated("host"),
    ifThen(
      anyOf(inForm("hero", defeatingPlayer), inForm("alterEgo", defeatingPlayer)),
      resolveSettingSpecial(defeatingPlayer),
    ),
  ),

  // Trial by Combat — Hinder 1 per hero (data). When Defeated: Shuffle each Imperial Guard minion in the encounter
  // discard pile into the encounter deck.
  "45146.when-defeated": whenDefeated(
    moveCards(encounterCards(["discard"], IMPERIAL_GUARD_MINION), "encounterDeckShuffle"),
  ),
});
