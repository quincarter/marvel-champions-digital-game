import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  attacksGainKeywords,
  boost,
  choosePlayer,
  chosenPlayer,
  constant,
  defineAbilities,
  discard,
  discardFromHandCost,
  each,
  enemyScheme,
  enemyAttack,
  engage,
  firstPlayer,
  gainsTrait,
  heroAction,
  hasTrait,
  identityOf,
  ifElse,
  ifThen,
  isAttached,
  modifyAttack,
  not,
  notMatching,
  query,
  remainingHpOf,
  self,
  superlativePlayer,
  surge,
  theVillain,
  thatPlayer,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
} from "../../../dsl/index.js";

const AERIAL = trait("AERIAL");
const ATTACK = trait("ATTACK");

/** Minions engaged with you, split by Aerial so each group's activations carry their own bonus. */
const ENGAGED_AERIAL = query("minion", { engagedWith: "you", trait: AERIAL });
const ENGAGED_GROUNDED = query("minion", { engagedWith: "you", ...notMatching({ trait: AERIAL }) });

/**
 * The Owl modular set (docs/phase7-wave11-scenarios.md section S6). Quickstrike is data.
 *
 * **60191 Flight Serum**: "Attach to a non-Aerial enemy" is data (`attachesTo`); "Otherwise, this card gains surge" is
 * the unattached When Revealed (RRG 1.8 "Attach To", p. 8). The attached enemy gains Aerial (the stat box is data).
 * Hero Action: discard an Attack event from your hand to discard this card. Any player may use it (a hero action on a
 * card in play, RRG 1.8 "Ability", p. 4), paying from their own hand.
 * **60192 Mister Fish**: his attacks gain piercing and ranged. When Revealed: he engages the player whose identity has
 * the fewest remaining hit points (a tie goes to the first player to pick, RRG 1.8 "First Player", p. 19).
 * **60193 The Owl**: his attacks gain piercing; Boost: if the activation is an attack it gains piercing (a boost
 * resolving during a scheme activation reads nothing, `modifyAttack`).
 * **60194 Swoop Down**: the villain and each minion engaged with you scheme (alter-ego) or attack you (hero), the
 * Aerial ones with +2 SCH / +2 ATK for that activation. The activations are initiated one group at a time (the
 * villain, then Aerial minions, then the others); the bonus is per activation and not a stat change, so it does not
 * leak into later activations. TIER 5 (RRG silent on card-caused activation order): RRG 1.8 "Activation", p. 6 lets the
 * player order the minion activations; the three-group split is an interim reading, to be replaced by engine task E21
 * (player-ordered card-caused activations plus a per-enemy bonus). The engaged-minion set is read again when each
 * group is initiated, so it is re-read after the villain's activation.
 *
 * Cards (4):
 * - 60191 Flight Serum (attachment)
 * - 60192 Mister Fish (minion)
 * - 60193 The Owl (minion)
 * - 60194 Swoop Down (treachery)
 */
export const FNE_MODULAR_THE_OWL: AbilityRegistry = defineAbilities({
  "60191.flight-serum-constant": whenRevealed(ifThen(not(isAttached(self)), surge())),
  "60191.flight-serum-constant-2": constant(gainsTrait(AERIAL, { hostOfSelf: true })),
  "60191.flight-serum-action": heroAction(
    { cost: discardFromHandCost(1, 1, undefined, query("event", { trait: ATTACK })) },
    discard(self),
  ),

  "60192.mister-fish-constant": constant(attacksGainKeywords(["piercing", "ranged"], { attacker: { self: true } })),
  "60192.when-revealed": whenRevealed(
    choosePlayer("fewest", firstPlayer, {
      among: superlativePlayer("lowest", remainingHpOf(identityOf(thatPlayer))),
    }),
    engage(self, chosenPlayer("fewest")),
  ),

  "60193.the-owl-constant": constant(attacksGainKeywords(["piercing"], { attacker: { self: true } })),
  "60193.boost": boost(modifyAttack({ keywords: ["piercing"] })),

  "60194.when-revealed-alter-ego": whenRevealedAlterEgo(
    enemyScheme(theVillain, { against: you, schBonus: ifElse(hasTrait(theVillain, AERIAL), 2, 0) }),
    enemyScheme(each(ENGAGED_AERIAL), { against: you, schBonus: 2 }),
    enemyScheme(each(ENGAGED_GROUNDED), { against: you }),
  ),
  "60194.when-revealed-hero": whenRevealedHero(
    enemyAttack(theVillain, { against: you, atkBonus: ifElse(hasTrait(theVillain, AERIAL), 2, 0) }),
    enemyAttack(each(ENGAGED_AERIAL), { against: you, atkBonus: 2 }),
    enemyAttack(each(ENGAGED_GROUNDED), { against: you }),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FNE_MODULAR_THE_OWL_SKIPPED: Readonly<Record<string, string>> = {};
