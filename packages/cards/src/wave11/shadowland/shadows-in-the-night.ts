import { trait } from "@mc/content";
import type { AbilityRegistry, EffectSpec, Predicate, TargetQuery } from "@mc/engine";
import {
  addCounters,
  andThen,
  atEndOfActivation,
  atEndOfPhase,
  boost,
  chooseCards,
  chooseOne,
  chooseTarget,
  chosen,
  confuse,
  constant,
  dealDamage,
  dealEncounterCard,
  dealIndirectDamage,
  defendingCharacter,
  defineAbilities,
  discard,
  each,
  eachPlayer,
  encounterCards,
  endGame,
  enemyAttack,
  enemyScheme,
  exhaust,
  exists,
  firstPlayer,
  firstPlayerAction,
  flipCard,
  forEachPlayer,
  forcedInterrupt,
  forcedResponse,
  gainsIcon,
  gets,
  giveStatus,
  identityOf,
  ifThen,
  inMode,
  instead,
  not,
  on,
  option,
  partOf,
  perHero,
  placeThreat,
  putIntoPlay,
  query,
  reducesAttackDamageTaken,
  refMatches,
  removeCountersFrom,
  resetHitPoints,
  resolveWhenRevealedOf,
  revealCard,
  rule,
  selectCards,
  self,
  setup,
  shuffleEncounterDeck,
  spendResources,
  stun,
  takeDamage,
  thatPlayer,
  theMainScheme,
  theVillain,
  whenDefeated,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
} from "../../dsl/index.js";

/**
 * Shadowland, Shadows in the Night (MC65; docs/phase7-shadowland.md §6 rules brief M1, FAQ p. 18).
 *
 * **65001a A Barricade of Blades / Fortress Lockdown** (main scheme, one pool card: stages 1 and 2, printed 65001 and
 *   65002; insert p. 9). Setup puts both The Streets Below environments into play (the villain choice, the linked cards
 *   and the set-aside Dark Protege set are scenario setup, `villainChoiceOf`). 1B/2B: expert mode gives the villain +1
 *   SCH and +3[per_hero] hit points (2A: the hit points only; it is on the table only while it is revealed). The
 *   villain is ONE card with sides A and B and one stage (the content encodes villainStages [1,1]), so the flip is
 *   not a stage advance; "would be defeated on side A" is a forced interrupt that replaces the defeat by the flip, the
 *   hit point reset, the position change and a facedown encounter card for each player. The engine has no "villain is
 *   on side X" predicate, so the interrupt marks the villain with a "sideB" counter (an engine device, authority level
 *   5: nothing else puts one there and the villain is never flipped back) and "defeated on side B" reads that counter.
 *   2A When Revealed: change the position (printed without "if it has not changed", so it changes even after a change
 *   this phase, and it counts as this phase's change), then each player in player order searches the encounter deck
 *   and discard pile for a minion and reveals it, then the deck is shuffled.
 * **65006 Ghost Maker**, **65007 Sealed Entrances**, **65009 Surround the Fortress**: the "if it has not changed this
 *   phase" position change; Ghost Maker discards 1 card you control (an ally, support or upgrade) when Atop the
 *   Tenshu, otherwise takes 2 indirect damage; his Boost reveals him after the activation when an ally defends (the
 *   wording and script of 65028 Ninja Swarm).
 *
 * Cards (11):
 * - 65001a A Barricade of Blades / Fortress Lockdown (main_scheme)
 * - 65003a The Streets Below (environment; flips to Atop the Tenshu, 65003b)
 * - 65004a The Streets Below (environment; flips to Atop the Tenshu, 65004b)
 * - 65005 Black Tarantula (minion)
 * - 65006 Ghost Maker (minion)
 * - 65007 Sealed Entrances (side scheme)
 * - 65008 Strategic Positioning (side scheme)
 * - 65009 Surround the Fortress (side scheme)
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

/**
 * "Change the villain's position" with no "if it has not changed this phase": the flip is made whatever happened
 * earlier in the phase, and it counts as this phase's change for the cards that do say "if it has not changed".
 */
const changeVillainPosition: readonly EffectSpec[] = [
  ifThen(not({ kind: "counterAtLeast", of: villainPositionRef, counterType: CHANGED, amount: 1 }), [
    addCounters(CHANGED, 1, villainPositionRef),
    atEndOfPhase(removeCountersFrom(villainPositionRef, CHANGED, 1)),
  ]),
  flipCard(villainPositionRef),
];

/** "The villain is on side B": the marker the side A defeat interrupt leaves (see the module header). */
const SIDE_B_COUNTER = "sideB";
const VILLAIN_ON_SIDE_B: Predicate = {
  kind: "counterAtLeast",
  of: theVillain,
  counterType: SIDE_B_COUNTER,
  amount: 1,
};
const VILLAIN_ON_SIDE_A: Predicate = not(VILLAIN_ON_SIDE_B);

/** "Forced Interrupt: When the villain would be defeated on side A, instead flip it to side B, reset its hit points, ..." */
const barricadeForcedInterrupt = forcedInterrupt(
  on.defeated(query("villain")),
  { would: true, while: VILLAIN_ON_SIDE_A },
  instead(
    flipCard(theVillain),
    addCounters(SIDE_B_COUNTER, 1, theVillain),
    resetHitPoints(theVillain),
    ...changeVillainPosition,
    dealEncounterCard(eachPlayer),
  ),
);
/** "If the villain is defeated on side B, the players win the game." */
const barricadeWin = forcedResponse(
  on.defeated(query("villain")),
  { while: VILLAIN_ON_SIDE_B },
  endGame("win", "cardAbility"),
);
const THE_STREETS_BELOW_ENVIRONMENT: TargetQuery = query("environment", { name: "The Streets Below" });
const EXPERT_VILLAIN_BONUS = (withScheme: boolean) =>
  constant(
    ...(withScheme ? [gets("sch", 1, query("villain"), { while: inMode("expert") })] : []),
    gets("hp", perHero(3), query("villain"), { while: inMode("expert") }),
  );

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
  // 1A Setup, the environments part: "Put each The Streets Below environment into play" (both start on that face).
  "65001a.setup": setup(
    selectCards("environments", encounterCards(["deck"], THE_STREETS_BELOW_ENVIRONMENT)),
    putIntoPlay(chosen("environments"), firstPlayer),
  ),
  "65001b.a-barricade-of-blades-constant": EXPERT_VILLAIN_BONUS(true),
  "65001b.a-barricade-of-blades-forced-interrupt": barricadeForcedInterrupt,
  "65001b.a-barricade-of-blades-constant-2": barricadeWin,
  "65002a.fortress-lockdown-constant": EXPERT_VILLAIN_BONUS(false),
  "65002a.fortress-lockdown-constant-2": partOf("65002a.fortress-lockdown-constant"),
  "65002a.when-revealed": whenRevealed(
    ...changeVillainPosition,
    forEachPlayer(
      eachPlayer,
      chooseCards("found", encounterCards(["deck", "discard"], query("minion")), {
        min: 1,
        max: 1,
        chooser: thatPlayer,
      }),
      revealCard(chosen("found"), thatPlayer),
    ),
    shuffleEncounterDeck(),
  ),
  "65002b.fortress-lockdown-constant": EXPERT_VILLAIN_BONUS(true),
  "65002b.fortress-lockdown-forced-interrupt": barricadeForcedInterrupt,
  "65002b.fortress-lockdown-constant-2": barricadeWin,

  // Ghost Maker. Boost: after the activation (as every "reveal this card" boost, 65028 Ninja Swarm).
  "65006.when-defeated": whenDefeated(
    ...changeVillainPositionOnce,
    ifThen(
      ATOP_THE_TENSHU,
      [
        chooseTarget("controlled", query(["ally", "support", "upgrade"], { controlledBy: you })),
        discard(chosen("controlled")),
      ],
      dealIndirectDamage(you, 2),
    ),
  ),
  "65006.boost": boost(ifThen(refMatches(defendingCharacter, query("ally")), atEndOfActivation(revealCard(self)))),
  "65007.when-defeated": whenDefeated(...changeVillainPositionOnce),
  "65009.when-revealed": whenRevealed(
    ...changeVillainPositionOnce,
    ifThen(ATOP_THE_TENSHU, placeThreat(perHero(1), theMainScheme), placeThreat(perHero(1), self)),
  ),

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
