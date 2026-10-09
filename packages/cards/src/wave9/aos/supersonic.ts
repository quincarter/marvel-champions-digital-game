import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  activationIs,
  after,
  attacksGainKeywords,
  boost,
  constant,
  dealIndirectDamage,
  defineAbilities,
  discard,
  enemyActivates,
  find,
  forcedResponse,
  heroResponse,
  ifThen,
  modifyAttack,
  named,
  not,
  notMatching,
  on,
  query,
  removeCountersFrom,
  revealCard,
  rule,
  self,
  spend,
  surge,
  varAtLeast,
  whenRevealed,
  you,
} from "../../dsl/index.js";

const MACH_IV = "MACH-IV";
const AERIAL = trait("AERIAL");

/**
 * Modular encounter set `supersonic` (Agents of S.H.I.E.L.D., a Thunderbolt set; docs/phase7-wave9.md sections 3.25,
 * 3.26, 3.34 and 3.35). Villainous, Victory 1, Hinder, Uses (4 missile counters), the attachments' hosts ("Attach to
 * MACH-IV. Otherwise, ...") and Blasters' +1 ATK box are data.
 *
 * **MACH-IV (50156)**: RRG 1.8 erratum (p. 69; docs/phase7-wave9.md section 1.14 item 4): the scan's "cannot make basic
 * defenses against MACH-IV's attacks" now reads "Each character without the Aerial trait cannot defend against
 * MACH-IV's attacks", so no such character (ally, identity, or one an ability would declare the defender) is a
 * legal defender; an Aerial one still is.
 *
 * **Blasters (50157)**: the attached enemy's attacks gain overkill and ranged (the star on its +1 ATK box). Hero
 * Response after you attack and damage the attached enemy: spend two energy resources to discard it.
 *
 * **Heat-Seeking Missiles (50158)**: Forced Response after the attached enemy attacks you: remove 1 missile counter
 * from here (the last one discards the card, Uses) and take 2 indirect damage.
 *
 * **Aerial Dogfight (50159)**: left unscripted, see `SUPERSONIC_SKIPPED`.
 *
 * **Supersonic (50160)**: reveals MACH-IV (found, or engaged with the revealing player when in play), who activates
 * against the revealing player; surge when nobody activated. Boost: an attack gains overkill and ranged.
 *
 * Cards (5):
 * - 50156 MACH-IV (minion)
 * - 50157 Blasters (attachment)
 * - 50158 Heat-Seeking Missiles (attachment)
 * - 50159 Aerial Dogfight (side_scheme)
 * - 50160 Supersonic (treachery)
 */
export const SUPERSONIC: AbilityRegistry = defineAbilities({
  "50156.mach-iv-constant": constant(
    rule({
      kind: "cannotDefend",
      target: query("character", notMatching({ trait: AERIAL })),
      attacker: { self: true },
    }),
  ),

  "50157.blasters-constant": constant(
    attacksGainKeywords(["overkill", "ranged"], { attacker: query("enemy", { hostOfSelf: true }) }),
  ),
  "50157.blasters-response": heroResponse(
    on.attacks(query("identity"), { target: { hostOfSelf: true }, damages: true, byYou: true }),
    { cost: spend({ energy: 2 }) },
    discard(self),
  ),

  "50158.heat-seeking-missiles-forced-response": forcedResponse(
    after.enemyAttacks("host", { againstYou: true }),
    removeCountersFrom(self, "missile", 1),
    dealIndirectDamage(you, 2),
  ),

  "50160.when-revealed": whenRevealed(
    revealCard(find(query("minion", { name: MACH_IV })), you),
    enemyActivates(named(MACH_IV), { against: you, bind: "activated" }),
    ifThen(not(varAtLeast("activated.made")), surge()),
  ),
  "50160.boost": boost(ifThen(activationIs("attack"), modifyAttack({ overkill: true, keywords: ["ranged"] }))),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const SUPERSONIC_SKIPPED: Readonly<Record<string, string>> = {
  "50159.aerial-dogfight-constant":
    'reduceDamageTaken (the "reduce the damage each Aerial character takes from each attack by 2" rule) has only exceptAttacker; the card also exempts "the attack has the Aerial trait" (an attacking card) and "the attack has ranged", which cannotTakeDamage can name (exceptAttackCard, exceptAttackKeyword) but reduceDamageTaken cannot',
};
