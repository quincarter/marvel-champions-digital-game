import { trait } from "@mc/content";
import type { AbilityDefinition, AbilityRegistry, EffectSpec, PlayerRef } from "@mc/engine";
import {
  adjustBoostCount,
  alterEgoAction,
  anyOf,
  boost,
  chooseTarget,
  chosen,
  constant,
  controllerOf,
  defeatingPlayer,
  defineAbilities,
  discard,
  each,
  engage,
  eventTarget,
  find,
  findCard,
  forcedInterrupt,
  forcedResponse,
  gainsKeyword,
  host,
  identityOf,
  ifThen,
  inForm,
  on,
  ownerOf,
  placeThreat,
  query,
  refMatches,
  resolveSpecialsOf,
  revealCard,
  self,
  special,
  theMainScheme,
  whenDefeated,
  whenRevealed,
  yourIdentity,
  you,
} from "../../dsl/index.js";

const SETTING = trait("SETTING");
const GENOSHA_TRAIT = trait("GENOSHA");
const SETTING_ENVIRONMENT = query("environment", { trait: SETTING });
const ESCAPED_MUTANT = query("attachment", { name: "Escaped Mutant" });
const HAS_MUTANT = { hasAttachment: { name: "Escaped Mutant" } } as const;
const THIS_MINION = query("minion", { self: true });

/**
 * "Resolve the 'Special' ability on the Setting environment", by `who`: the resolving player chooses which Setting when
 * several are in play (Q15 = A) and is "you" inside the Special. The same helper as `blue-moon.ts` and
 * `savage-land.ts` (three copies; they should move to one shared file).
 */
const resolveSettingSpecial = (who: PlayerRef = you): EffectSpec[] => [
  chooseTarget("setting", SETTING_ENVIRONMENT, { chooser: who }),
  resolveSpecialsOf(chosen("setting"), who),
];

/**
 * "Your ally": the defeated ally's player. The Mech is an encounter card, so `you` names nobody in its Forced Response;
 * the ally (a player card) is read by its owner. Not the ally's current controller: a stolen ally is the open edge.
 */
const allyOwner = ownerOf(eventTarget);

/** A real player (not "nobody") defeated the card: an encounter card's damage leaves no defeating player. */
const aPlayerDefeated = anyOf(inForm("hero", defeatingPlayer), inForm("alterEgo", defeatingPlayer));

/**
 * Escaped Mutant's Alter-Ego Action is "Resolve the 'Special' ability on the Setting environment -> discard this
 * card": the Special is the COST (docs/phase7-wave8.md §3.24, queue task 27, `AbilityCost.resolveAbility` with
 * `trigger: "special"`), so the action must be unusable with no Setting environment in play. The DSL cannot type that
 * cost yet; this draft is the effect form (Special, then discard) and is NOT registered.
 */
export const ESCAPED_MUTANT_ACTION_DRAFT: AbilityDefinition = alterEgoAction(...resolveSettingSpecial(), discard(self));

/**
 * Modular encounter set `genosha` (Age of Apocalypse, docs/phase7-wave8.md §1.16, §2.8, §3.24, §3.25, §3.31, §4.1
 * Q15 and Q17): one of Dark Beast's three Setting sets, also a modular set. Setup, Patrol, Guard, Toughness and
 * Hinder 1 per hero are data keywords.
 *
 * Genosha's constant is a live steady grant on the villain. Its Special places 1 threat on the main scheme.
 *
 * Escaped Mutant is "attach to your identity" (data). Its quickstrike grant is read live: a Genosha minion engaged
 * with the host's controller has quickstrike, so Armored Unibike's engage (a Forced Interrupt on entering play, as
 * Dreadpool) is already in effect when it attacks. Armored Unibike with nobody holding the card engages as any minion
 * does (the revealing player). Magistrate's When Defeated finds the card wherever it is and attaches it to the
 * defeating player's identity (moving it from another identity); Police State reveals the found card where it is
 * (Q17 = A: an attached one stays). Both do nothing when no player defeated them.
 *
 * Escaped Mutant's Action is skipped (see `ESCAPED_MUTANT_ACTION_DRAFT`), waiting on queue task 27 (spec §8.2).
 *
 * Cards (6):
 * - 45133 Genosha (environment)
 * - 45134 Magistrate (minion)
 * - 45135 Armored Unibike (minion)
 * - 45136 Genoshan Mech (minion)
 * - 45137 Escaped Mutant (attachment)
 * - 45138 Police State (side_scheme)
 */
export const GENOSHA: AbilityRegistry = defineAbilities({
  // Genosha — The villain gains steady.
  "45133.genosha-constant": constant(gainsKeyword({ name: "steady" }, query("villain"))),
  // Special: Place 1 threat on the main scheme.
  "45133.genosha-special": special(placeThreat(1, theMainScheme)),
  // When Revealed: Discard each other Setting environment in play.
  "45133.when-revealed": whenRevealed(discard(each(query("environment", { trait: SETTING, excluding: self })))),

  // Magistrate — Patrol (data). When Defeated: The defeating player finds Escaped Mutant and attaches it to their
  // identity.
  "45134.when-defeated": whenDefeated(
    ifThen(aPlayerDefeated, findCard(ESCAPED_MUTANT, { attachTo: identityOf(defeatingPlayer) })),
  ),
  // [star] Boost: If Escaped Mutant is attached to your identity, this card gains 3 boost icons.
  "45134.boost": boost(ifThen(refMatches(yourIdentity, HAS_MUTANT), adjustBoostCount(3))),

  // Armored Unibike — engages the player with Escaped Mutant attached, if able.
  "45135.armored-unibike-constant": forcedInterrupt(
    on.entersPlay("self"),
    ifThen(
      refMatches(find(query("identity", HAS_MUTANT)), {}, { anywhere: true }),
      engage(self, controllerOf(each(query("identity", HAS_MUTANT)))),
    ),
  ),
  // [star] Forced Response: After Armored Unibike attacks, resolve the Special on the Setting environment (the
  // attacked player resolves it).
  "45135.armored-unibike-forced-response": forcedResponse(
    on.enemyAttacks("self", { againstYou: true }),
    ...resolveSettingSpecial(),
  ),

  // Genoshan Mech — Guard, Toughness (data). [star] Forced Response: After it attacks and defeats one of your allies,
  // resolve the Special twice.
  "45136.genoshan-mech-forced-response": forcedResponse(
    on.defeated(query("ally"), { byAttackFrom: THIS_MINION }),
    ...resolveSettingSpecial(allyOwner),
    ...resolveSettingSpecial(allyOwner),
  ),

  // Escaped Mutant — Each Genosha minion that engages you gains quickstrike.
  "45137.escaped-mutant-constant": constant(
    gainsKeyword(
      { name: "quickstrike" },
      query("minion", { trait: GENOSHA_TRAIT, engagedWithPlayer: controllerOf(host) }),
    ),
  ),
  // "45137.escaped-mutant-action": skipped, see ESCAPED_MUTANT_ACTION_DRAFT.

  // Police State — Hinder 1 per hero (data). When Defeated: The player who defeated this scheme finds the Escaped
  // Mutant attachment and reveals it (found where it is, Q17 = A).
  "45138.when-defeated": whenDefeated(ifThen(aPlayerDefeated, revealCard(find(ESCAPED_MUTANT), defeatingPlayer))),
});

export const GENOSHA_SKIPPED: Readonly<Record<string, string>> = {
  "45137.escaped-mutant-action":
    "Its cost is resolving the Setting environment's Special, unusable with none in play (spec §3.24, queue task 27: AbilityCost.resolveAbility). ESCAPED_MUTANT_ACTION_DRAFT is the effect form, unregistered.",
};
