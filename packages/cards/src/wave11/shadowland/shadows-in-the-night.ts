import { trait } from "@mc/content";
import type { AbilityRegistry, EffectSpec, Predicate, TargetQuery } from "@mc/engine";
import {
  addCounters,
  andThen,
  atEndOfPhase,
  boost,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  defineAbilities,
  dealDamage,
  discard,
  each,
  enemyAttack,
  enemyScheme,
  exhaust,
  exists,
  firstPlayerAction,
  flipCard,
  gainsIcon,
  gets,
  giveStatus,
  identityOf,
  ifThen,
  not,
  option,
  partOf,
  placeThreat,
  query,
  reducesAttackDamageTaken,
  removeCountersFrom,
  resolveWhenRevealedOf,
  rule,
  self,
  spendResources,
  stun,
  takeDamage,
  theMainScheme,
  theVillain,
  confuse,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
} from "../../dsl/index.js";

/**
 * Shadowland, Shadows in the Night (MC65; docs/phase7-shadowland.md §6 rules brief M1, FAQ p. 18).
 *
 * Cards (6):
 * - 65003a The Streets Below (environment; flips to Atop the Tenshu, 65003b)
 * - 65004a The Streets Below (environment; flips to Atop the Tenshu, 65004b)
 * - 65005 Black Tarantula (minion)
 * - 65008 Strategic Positioning (side scheme)
 * - 65010 Chaos in Hell's Kitchen (treachery)
 * - 65011 Moonlit Silhouette (treachery)
 *
 * Positions (insert p. 8): "the villain's position is X" is the faceup VILLAIN POSITION environment showing X; "change
 * the villain's position" flips it, which is a flip and not a reveal (RRG 1.8 "Flip", p. 20). "Both positions are the
 * same" compares the two environments' faceup titles.
 */
const VILLAIN_POSITION = trait("VILLAIN POSITION");
const HERO_POSITION = trait("HERO POSITION");
const AERIAL = trait("AERIAL");

const villainPositionCard: TargetQuery = query("environment", { trait: VILLAIN_POSITION });
const heroPositionCard: TargetQuery = query("environment", { trait: HERO_POSITION });

/** "If both positions are the same": the two position environments share a faceup title. */
export const POSITIONS_SAME: Predicate = exists(
  query("environment", { trait: VILLAIN_POSITION, sharesTitleWith: each(heroPositionCard) }),
);
/** "If the positions are different". */
export const POSITIONS_DIFFERENT: Predicate = not(POSITIONS_SAME);
/** "The villain's position is [title]". */
const villainPositionIs = (name: string): Predicate => exists(query("environment", { trait: VILLAIN_POSITION, name }));
const ATOP_THE_TENSHU = villainPositionIs("Atop the Tenshu");
const THE_STREETS_BELOW = villainPositionIs("The Streets Below");

const aerialToExhaust: TargetQuery = query("character", { trait: AERIAL, controlledBy: you, exhausted: false });

/**
 * The counter that marks a villain position already changed this phase. An engine device (authority level 5): no
 * official source says how to track "has not changed this phase". It is added only by `changeVillainPositionOnce`,
 * which also queues its removal for the end of the phase it was added in, so it cannot outlive a phase; setup never
 * changes a position through these cards (they resolve only when revealed), so none is left over from setup.
 */
const CHANGED = "positionChanged";
const villainPositionRef = each(villainPositionCard);
/**
 * "Change the villain's position if it has not changed this phase." The flip marks the card with a counter that comes
 * off when the phase ends; the next change in the same phase finds it and does nothing. Exported for the other
 * Shadowland cards that change the villain's position.
 */
export const changeVillainPositionOnce: readonly EffectSpec[] = [
  ifThen(not({ kind: "counterAtLeast", of: villainPositionRef, counterType: CHANGED, amount: 1 }), [
    flipCard(villainPositionRef),
    addCounters(CHANGED, 1, villainPositionRef),
    atEndOfPhase(removeCountersFrom(villainPositionRef, CHANGED, 1)),
  ]),
];

/** The villain-position environment's three abilities, the same on both faces (65003a / 65003b). */
const villainPositionAbilities = (face: "a" | "b") => {
  const base = `65003${face}.${face === "a" ? "the-streets-below" : "atop-the-tenshu"}-constant`;
  return {
    [base]: constant(gets("atk", 1, query("character"), { while: POSITIONS_SAME })),
    [`${base}-2`]: constant(reducesAttackDamageTaken(query("character"), 1, { while: POSITIONS_DIFFERENT })),
    [`${base}-3`]: constant(
      rule({ kind: "threatCannotBeRemoved", target: query("mainScheme"), while: POSITIONS_DIFFERENT }),
    ),
  };
};

/** "First Player Action: Resolve one of the effects below, then flip this card." (65004a / 65004b; FAQ p. 18) */
const heroPositionAbilities = (face: "a" | "b") => {
  const base = `65004${face}.${face === "a" ? "the-streets-below" : "atop-the-tenshu"}-constant`;
  const options =
    face === "a"
      ? [
          // Offered even when the stun cannot be given (FAQ p. 18): the card then just does not flip.
          option("Place 3 threat on the main scheme and stun your identity", [
            placeThreat(3, theMainScheme),
            stun(identityOf(you)),
          ]),
          option("Spend physical physical resources", spendResources({ physical: 2 }, "spent")),
          // An option that needs a target is not offered without one (RRG 1.8 "Choose (Option)", p. 12).
          option(
            "Spend 1 resource of any type and exhaust an Aerial character you control",
            { when: exists(aerialToExhaust) },
            [
              spendResources({ generic: 1 }, "spent"),
              chooseTarget("aerial", aerialToExhaust),
              exhaust(chosen("aerial")),
            ],
          ),
        ]
      : [
          option("Deal 3 damage to your identity", dealDamage(3, identityOf(you))),
          option("Spend energy energy resources", spendResources({ energy: 2 }, "spent")),
          option(
            "Discard an ally or upgrade you control",
            { when: exists(query(["ally", "upgrade"], { controlledBy: you })) },
            [chooseTarget("card", query(["ally", "upgrade"], { controlledBy: you })), discard(chosen("card"))],
          ),
        ];
  return {
    [base]: firstPlayerAction(chooseOne(...options), andThen(flipCard(self))),
    [`${base}-2`]: partOf(base as `${string}.${string}`),
    [`${base}-3`]: partOf(base as `${string}.${string}`),
    [`${base}-4`]: partOf(base as `${string}.${string}`),
  };
};

/** "When Revealed: Change the villain's position if it has not changed this phase. …" Chaos in Hell's Kitchen. */
const chaosWhenRevealed = [
  ...changeVillainPositionOnce,
  ifThen(ATOP_THE_TENSHU, placeThreat(2, theMainScheme), takeDamage(2)),
];

export const SHADOWLAND_SHADOWS_IN_THE_NIGHT: AbilityRegistry = defineAbilities({
  ...villainPositionAbilities("a"),
  ...villainPositionAbilities("b"),
  ...heroPositionAbilities("a"),
  ...heroPositionAbilities("b"),

  // Black Tarantula (Guard is data). The villain's position is read after the change.
  "65005.when-revealed": whenRevealed(
    ...changeVillainPositionOnce,
    ifThen(ATOP_THE_TENSHU, enemyAttack(self, { against: you }), [
      giveStatus(theVillain, "tough"),
      giveStatus(self, "tough"),
    ]),
  ),

  "65008.strategic-positioning-constant": constant(
    gainsIcon("acceleration", { self: true }, { while: THE_STREETS_BELOW }),
  ),
  "65008.strategic-positioning-constant-2": constant(gainsIcon("hazard", { self: true }, { while: ATOP_THE_TENSHU })),

  "65010.when-revealed": whenRevealed(...chaosWhenRevealed),
  "65010.boost": boost(resolveWhenRevealedOf(self)),

  "65011.when-revealed-alter-ego": whenRevealedAlterEgo(...changeVillainPositionOnce, confuse(identityOf(you))),
  "65011.when-revealed-hero": whenRevealedHero(
    ifThen(ATOP_THE_TENSHU, enemyScheme(theVillain), enemyAttack(theVillain, { against: you })),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const SHADOWLAND_SHADOWS_IN_THE_NIGHT_SKIPPED: Readonly<Record<string, string>> = {};
