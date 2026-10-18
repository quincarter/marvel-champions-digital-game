import type { AbilityRegistry } from "@mc/engine";
import {
  addCounters,
  after,
  attackExcessAsDealt,
  baseStatOf,
  changeForm,
  chooseOneBy,
  constant,
  countersOn,
  defineAbilities,
  discard,
  eachPlayer,
  eventTarget,
  exhaustThis,
  forcedResponse,
  forEachPlayer,
  gets,
  heal,
  heroResponse,
  identityOf,
  ifThen,
  isAlterEgo,
  isHero,
  losesIcon,
  made,
  not,
  on,
  option,
  query,
  removeThreatFromAScheme,
  self,
  spendResources,
  statOf,
  thatPlayer,
  reducesAttackDamageTaken,
  valueAtLeast,
  valueAtMost,
  whenDefeated,
  YOUR_HERO,
  YOUR_IDENTITY,
  yourIdentity,
} from "../../dsl/index.js";

/** "Each ally you control" (RRG 1.8 "You, Your", p. 49). */
const YOUR_ALLIES = query("ally", { controller: "you" });
/** Mitigated Threat's "attached card". */
const ATTACHED_CARD = { hostOfSelf: true } as const;

/**
 * Wave 11 scripting module `jj/other-aspects` (docs/phase7-wave11-hero-packs.md H8.4).
 *
 * Cards (6):
 * - 61034 Innate Aggression (upgrade)
 * - 61035 Shakedown (upgrade)
 * - 61037 Innate Inspiration (upgrade)
 * - 61038 Echo (ally)
 * - 61039 Lay Low (player_side_scheme)
 * - 61040 Mitigated Threat (upgrade)
 *
 * **61034 / 61037**: Starting is data (engine setup step, spec H3.17).
 *
 * **61035.shakedown-response**: "After you attack and exactly defeat a minion": your identity's attack (an ally's is
 * not "you", RRG 1.8 p. 49) that dealt no excess damage (August 3, 2026 - Ruling 6: the excess dealt, so a reducer or a
 * tough status card does not make a defeat "exact"). The threat is removed, not thwarted.
 *
 * **61039.when-defeated**: each player in hero form may change; then each alter-ego (changed or already so) heals its
 * REC.
 *
 * **61040**: the host loses the four icons; the end-of-round spend is each player's choice, and one player declining
 * discards the card once at the end (every player is still asked, and a player who paid keeps having paid).
 */
export const JJ_OTHER_ASPECTS: AbilityRegistry = defineAbilities({
  "61034.innate-aggression-constant": constant(gets("atk", 1, YOUR_HERO)),

  "61035.shakedown-response": heroResponse(
    after.attacks(YOUR_IDENTITY, { target: query("minion"), defeats: true }),
    { cost: exhaustThis, while: valueAtMost(attackExcessAsDealt, 0) },
    removeThreatFromAScheme(baseStatOf(eventTarget, "sch")),
  ),

  // "each enemy attack": an attack by a hero or an ally is not one (RRG 1.8 "Enemy", p. 17). Indirect damage from an
  // enemy attack is the attack's damage too (August 3, 2026 - Ruling 2). "Your hero's DEF" reads 0 for an alter-ego.
  "61038.echo-constant": constant(
    reducesAttackDamageTaken({ self: true }, statOf(yourIdentity, "def"), {
      exceptAttacker: query(["hero", "ally"]),
    }),
  ),

  "61037.innate-inspiration-constant": constant(gets("hp", 1, YOUR_ALLIES)),

  "61039.when-defeated": whenDefeated(
    forEachPlayer(
      eachPlayer,
      chooseOneBy(
        thatPlayer,
        option("Change to alter-ego form", { when: isHero(thatPlayer) }, changeForm(thatPlayer, "alterEgo")),
        option("Do not change form", { when: isHero(thatPlayer) }),
      ),
    ),
    forEachPlayer(
      eachPlayer,
      ifThen(isAlterEgo(thatPlayer), heal(statOf(identityOf(thatPlayer), "rec"), identityOf(thatPlayer))),
    ),
  ),

  "61040.mitigated-threat-constant": constant(
    losesIcon("acceleration", ATTACHED_CARD),
    losesIcon("amplify", ATTACHED_CARD),
    losesIcon("crisis", ATTACHED_CARD),
    losesIcon("hazard", ATTACHED_CARD),
  ),
  "61040.mitigated-threat-forced-response": forcedResponse(
    on.roundEnding(),
    forEachPlayer(
      eachPlayer,
      spendResources({ generic: 1 }, "spent", thatPlayer),
      ifThen(not(made("spent")), addCounters("declined", 1)),
    ),
    ifThen(valueAtLeast(countersOn(self, "declined"), 1), discard(self)),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const JJ_OTHER_ASPECTS_SKIPPED: Readonly<Record<string, string>> = {};
