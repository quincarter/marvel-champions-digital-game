import type { AbilityDefinition, AbilityRegistry } from "@mc/engine";
import {
  aScheme,
  anAttackableEnemy,
  anEnemy,
  attack,
  chooseTarget,
  chosen,
  confuse,
  dealDamage,
  defineAbilities,
  heroAction,
  ifThen,
  paidTypeCount,
  query,
  stun,
  thwart,
  valueAtLeast,
} from "../../../dsl/index.js";

/**
 * Jubilee signature events (docs/phase7-wave8.md section 7.3, 3.62, 3.69; Q33 = B, Q34 = A). All four titles read the
 * resource types that paid for them, so each ability is marked with exactly what it reads (`readsPaidTypes`): the
 * engine then asks the paying player to declare what each wild was used as, and asks nothing when every declaration
 * would read the same. A cost reduced to 0 pays nothing, so no type was used (the count is 0).
 *
 * Cards (8):
 * - 47006 Blinding Flash (event)
 * - 47007a Firecracker (event)
 * - 47007b Firecracker (event)
 * - 47007c Firecracker (event)
 * - 47008a Flash of Light (event)
 * - 47008b Flash of Light (event)
 * - 47008c Flash of Light (event)
 * - 47009 Grand Finale (event)
 *
 * The a/b/c versions of Firecracker and Flash of Light differ only in resource icon and collector line (section 3.69),
 * so each title is one definition object registered under its three ability ids (`versions`).
 *
 * Blinding Flash (cost 3), Hero Action: choose X enemies, X the number of different types that paid (reads the count).
 * Exactly X enemies, or every enemy when there are fewer (the engine asks for the largest legal set); with X = 0 nothing
 * is chosen. Each chosen enemy is stunned, then confused. Not an attack: guard does not restrict the choice.
 *
 * Firecracker (cost 2), Hero Action (attack): 4 damage to an enemy as an attack; stun that enemy if 2 different types
 * paid (reads at least 2). The stun is given to the enemy chosen, even when the attack defeated it (nothing is left to
 * receive it then).
 *
 * Flash of Light (cost 2), Hero Action (thwart): remove 3 threat from a scheme as a thwart; if 2 different types paid
 * (reads at least 2), confuse an enemy (any enemy, not only one she could attack).
 *
 * Grand Finale (cost 3), Hero Action (attack): one attack of 2 damage to an enemy; then, for each different type that
 * paid (reads the count, at most the cost under Q34 = A, so 3 at its printed cost and 4 only with a cost of 4), choose
 * an enemy and deal it 2 damage. RRG "Attack (Player Ability Type)" (p. 10, as transcribed in the rules reference):
 * an ability labeled attack is a single attack even with several instances of damage; each "for each ... choose" is its
 * own instance, and the same enemy may be chosen again. The instances are chosen among the enemies she may attack at
 * that moment (RRG "For Each", p. 20: defeating a guard minion with one instance makes the villain a valid target for
 * the next). The first instance is the attack proper (guard, retaliate and "after attacks" responses); the rest are
 * further damage of that attack and run as `dealDamage`, as Royal Flush (`gambit` 37007) does.
 */
const versions = (ids: readonly string[], slug: string, definition: AbilityDefinition) =>
  Object.fromEntries(ids.map((id) => [`${id}.${slug}`, definition]));

const BLINDING_FLASH = heroAction(
  { readsPaidTypes: { count: true } },
  chooseTarget("victims", query("enemy"), { count: paidTypeCount() }),
  stun(chosen("victims")),
  confuse(chosen("victims")),
);

const TWO_TYPES = valueAtLeast(paidTypeCount(), 2);

const FIRECRACKER = heroAction(
  { label: "attack", readsPaidTypes: { atLeast: 2 } },
  anAttackableEnemy("enemy"),
  attack(4, chosen("enemy")),
  ifThen(TWO_TYPES, stun(chosen("enemy"))),
);

const FLASH_OF_LIGHT = heroAction(
  { label: "thwart", readsPaidTypes: { atLeast: 2 } },
  aScheme("scheme"),
  thwart(3, chosen("scheme")),
  ifThen(TWO_TYPES, [anEnemy("confused"), confuse(chosen("confused"))]),
);

/** Instance k (1 to 4) of Grand Finale's "for each different resource type": it exists while at least k types paid. */
const finaleInstance = (k: number) =>
  ifThen(valueAtLeast(paidTypeCount(), k), [anAttackableEnemy(`more${k}`), dealDamage(2, chosen(`more${k}`))]);

const GRAND_FINALE = heroAction(
  { label: "attack", readsPaidTypes: { count: true } },
  anAttackableEnemy("first"),
  attack(2, chosen("first")),
  finaleInstance(1),
  finaleInstance(2),
  finaleInstance(3),
  finaleInstance(4),
);

export const JUBILEE_EVENTS: AbilityRegistry = defineAbilities({
  "47006.blinding-flash-action": BLINDING_FLASH,
  ...versions(["47007a", "47007b", "47007c"], "firecracker-action", FIRECRACKER),
  ...versions(["47008a", "47008b", "47008c"], "flash-of-light-action", FLASH_OF_LIGHT),
  "47009.grand-finale-action": GRAND_FINALE,
});

/** Refs left unregistered, each with its reason (the coverage test reads this through its own `skipped` list). */
export const JUBILEE_EVENTS_SKIPPED: Readonly<Record<string, string>> = {};
