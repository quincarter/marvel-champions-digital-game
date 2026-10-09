import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  action,
  addCounters,
  after,
  allOf,
  alterEgoAction,
  anAttackableEnemy,
  anEnemy,
  anyOf,
  attack,
  attachCard,
  canPayResources,
  canRemoveThreatFrom,
  cancelWhenRevealed,
  cannotActivate,
  cards,
  chooseCardCost,
  chooseCards,
  chooseOne,
  chooseTarget,
  chosen,
  confuse,
  constant,
  countBoostIcons,
  coveredByEngineRule,
  countOf,
  countersOn,
  damageAnEnemy,
  dealDamage,
  dealDamageCost,
  dealEncounterCardsCost,
  defineAbilities,
  discard,
  discardEncounterCards,
  discardThis,
  discardTopOfDeckCost,
  draw,
  drawUpTo,
  each,
  encounterIconsInPlay,
  enemyAttack,
  exhaustThis,
  exists,
  handCountOf,
  handSizeOf,
  heal,
  heroAction,
  heroInterrupt,
  ifThen,
  interrupt,
  min,
  moveCards,
  not,
  on,
  option,
  playOnlyIf,
  playedThisPhase,
  printedCostOf,
  putIntoPlay,
  query,
  refMatches,
  removeThreat,
  removeThreatFromAScheme,
  reportFact,
  response,
  self,
  spendResources,
  setVar,
  sum,
  takeDamage,
  takeIntoHand,
  theVillain,
  topOfDeck,
  valueAtLeast,
  valueAtMost,
  varAtLeast,
  varOf,
  YOUR_IDENTITY,
  you,
  zone,
  eachPlayer,
  gets,
} from "../../dsl/index.js";
import { NEXT_EVOL_PRECON_CABLE_DECK } from "../next_evol/precon-cable-deck.js";

/**
 * The deadpool pack's aspect and basic cards no hero kit owns (44031, 44043-44058), docs/phase7-wave7.md §7.3, §3.77,
 * §3.82-§3.84, §3.87.
 *
 * - **Frenemies (44031)**: the same card as the box's 40026 (§3.61): that definition, aliased. Team-Up is data.
 * - **Bob (44043)**: Response after he enters play; a choice between damage to an enemy and a removal from a scheme
 *   (neither is an attack or a thwart). The acceleration icon is data.
 * - **Negasonic Teenage Warhead (44044)**: an ally's Interrupt (any player's hero is protected), paid by 2 damage to
 *   her. The hazard icon is data. **Pandapool (44045)** prints Toughness and an icon only: no ability ref.
 * - **Break Time (44046)**: Alliance and the per-player cost are data. The player who plays it reports the minutes
 *   away (Q49: whole minutes, no cap; `reportFact`), then every identity heals that many. The client cannot ask yet.
 * - **Get in Front of Me! (44047)**: Get Behind Me!'s shape (01078). "If an ally or another hero defends this attack"
 *   reads the attack's `defender` slot through its bind: an ally of any player, or the identity of any other player. A
 *   defender who has left play by then still counts (the character did defend, RRG "Defend, Defense", p. 16).
 * - **Mulligan (44048)**: "You cannot play this card if you have played another card this phase" is a `playOnlyIf`
 *   over `playedThisPhase`, the player's own plays this phase: a card they played in an earlier turn of the same
 *   player phase, or during another player's turn, counts (RRG 1.8 "Player Phase", p. 34: one phase).
 * - **Deadpool Corps Ship (44049)**: the cost deals the player 1 facedown encounter card; any 'Pool ally in hand.
 * - **Plot Convenience (44050)**: `triggerableBy: eachPlayer`; the triggering player attaches from their hand or takes
 *   any attached card into their own hand, whoever owns it, and it stays its owner's (Q53 = A, `takeIntoHand` with
 *   `keepOwner`; spent or discarded from that hand it goes to its owner's discard pile, RRG 1.8 p. 31). The data's constant ref ("Any
 *   player may trigger this ability.") is part of the Action. An aspect card includes 'Pool (spec §3.73).
 * - **Ambush (44051), Distraction (44054)**: crisis icon and "Max 1 per ..." are data.
 * - **Bazooka (44052)**: Restricted is data; discarding it is the cost, the icons are read as the attack resolves.
 * - **Laser Swords (44055)**: "Counts as 2 restricted cards" is `restrictedWeight` (data, Q52 = B). The ATK line is
 *   live (a stat bonus's amount stays live) and capped at +4.
 * - **Blackout (44053), Tic-Tac-Toe (44057)**: spaces are counters on the card (§3.84). One Action offers one option
 *   per resource type (the spend names its type, so a wild resource is spent as that type: Q51 = A); a type is offered
 *   only while a space of it is empty and a source exists. The move is a removal of threat or healing of damage, never
 *   a thwart or an attack; a move that moved nothing (no valid source) places no token.
 * - **Rock, Paper, Scissors (44056)**: the diagram is energy > mental > physical > energy, wild beats those three and
 *   nothing beats wild (§3.87). Choosing the card and discarding the top card are both costs.
 * - **War (44058)**: the encounter discard is not a reveal; the damage taken counts star and boost icons.
 */
const ELITE = trait("ELITE");
const FACEDOWN_HERE = { host: self, facedown: true } as const;
const POOL_ALLY = query("ally", { aspect: "pool" });
const ANY_ASPECT = ["aggression", "justice", "leadership", "protection", "pool"];
const AN_ASPECT_CARD = query(["ally", "event", "upgrade", "support", "resource"], { anyAspect: ANY_ASPECT });
const ANY_PLAYED_CARD = query(["ally", "event", "upgrade", "support", "resource"]);
/** "To a maximum of 3": a fourth is not attached. The hand is the triggering player's own ("you" while it resolves). */
const CAN_ATTACH_HERE = allOf(
  valueAtLeast(handCountOf(you, AN_ASPECT_CARD), 1),
  valueAtMost(countOf(FACEDOWN_HERE), 2),
);
const CAN_TAKE_FROM_HERE = valueAtLeast(countOf(FACEDOWN_HERE), 1);
const HAS_THREAT = query("scheme", { hasThreat: true });
const DAMAGED = query("character", { damaged: true });

const TYPES = ["energy", "mental", "physical"] as const;
const labelOf = (type: string): string => `Spend an [${type}] resource`;

/** The attack's defender (its bind's `defender` slot) is an ally or another player's hero. */
const ANOTHER_DEFENDS = anyOf(
  refMatches(chosen("attack.defender"), query("ally"), { anywhere: true }),
  refMatches(chosen("attack.defender"), query("identity", { controller: "other" }), {
    anywhere: true,
  }),
);

const BLACKOUT_FULL = allOf(...TYPES.map((type) => valueAtLeast(countersOn(self, type), 2)));
/**
 * One option of a type-by-type spend: the spend names its type, and the option records which type was paid (`as.<type>`)
 * for the effects after the choice. `spaces` are the counters of that type's row on the card, each holding `capacity`
 * tokens: the option is offered only while one has room.
 */
const spendAs = (type: (typeof TYPES)[number], spaces: readonly string[], capacity: number) =>
  option(
    labelOf(type),
    {
      when: allOf(
        canPayResources({ [type]: 1 }),
        anyOf(...spaces.map((space) => valueAtMost(countersOn(self, space), capacity - 1))),
      ),
    },
    [spendResources({ [type]: 1 }, "spent"), setVar(`as.${type}`, 1)],
  );

const COLUMNS = [1, 2, 3] as const;
const cell = (row: number, column: number): string => `r${row}c${column}`;
const LINES: readonly (readonly string[])[] = [
  ...[1, 2, 3].map((r) => COLUMNS.map((c) => cell(r, c))),
  ...COLUMNS.map((c) => [1, 2, 3].map((r) => cell(r, c))),
  [cell(1, 1), cell(2, 2), cell(3, 3)],
  [cell(1, 3), cell(2, 2), cell(3, 1)],
];
const ALL_CELLS = [1, 2, 3].flatMap((r) => COLUMNS.map((c) => cell(r, c)));
/** A printed resource on the chosen card beats one on the discarded card. */
const beats = (winner: string, loser: string) =>
  allOf(
    refMatches(chosen("pick"), { printedResource: winner as never }, { anywhere: true }),
    refMatches(chosen("top"), { printedResource: loser as never }, { anywhere: true }),
  );
const CHOSEN_BEATS_DISCARDED = anyOf(
  beats("energy", "mental"),
  beats("mental", "physical"),
  beats("physical", "energy"),
  beats("wild", "energy"),
  beats("wild", "mental"),
  beats("wild", "physical"),
);

export const DEADPOOL_PACK_CARDS: AbilityRegistry = defineAbilities({
  "44031.frenemies-action": NEXT_EVOL_PRECON_CABLE_DECK["40026.frenemies-action"]!,

  "44043.bob-agent-of-hydra-response": response(
    after.entersPlay("self"),
    chooseOne(
      option("Deal 2 damage to an enemy", damageAnEnemy(2)),
      option("Remove 1 threat from a scheme", removeThreatFromAScheme(1)),
    ),
  ),

  "44044.negasonic-teenage-warhead-interrupt": interrupt(
    on.encounterCardRevealed(query("treachery")),
    { cost: dealDamageCost(self, 2) },
    cancelWhenRevealed(),
  ),

  "44046.break-time-action": alterEgoAction(
    reportFact("minutesAway", "break"),
    heal(varOf("break.amount"), each(query("identity"))),
  ),

  "44047.get-in-front-of-me-interrupt": heroInterrupt(
    on.encounterCardRevealed(query("treachery")),
    cancelWhenRevealed(),
    enemyAttack(theVillain, { against: you, bind: "attack" }),
    ifThen(ANOTHER_DEFENDS, draw(1)),
  ),

  "44048.mulligan-constant": constant(playOnlyIf(not(playedThisPhase(ANY_PLAYED_CARD)))),
  "44048.mulligan-action": action(moveCards(zone("hand", you), "discard"), drawUpTo(handSizeOf())),

  "44049.deadpool-corps-ship-action": action(
    { cost: [exhaustThis, dealEncounterCardsCost(1)] },
    chooseCards("ally", zone("hand", you, { filter: POOL_ALLY }), { min: 1, max: 1 }),
    putIntoPlay(chosen("ally")),
  ),

  "44050.plot-convenience-action": action(
    { cost: exhaustThis, triggerableBy: eachPlayer, while: anyOf(CAN_ATTACH_HERE, CAN_TAKE_FROM_HERE) },
    chooseOne(
      option("Attach 1 aspect card from your hand facedown here", { when: CAN_ATTACH_HERE }, [
        chooseCards("card", zone("hand", you, { filter: AN_ASPECT_CARD }), { min: 1, max: 1 }),
        attachCard(chosen("card"), self, { facedown: true }),
      ]),
      option("Add 1 card attached here to your hand", { when: CAN_TAKE_FROM_HERE }, [
        chooseCards("banked", { kind: "ref", ref: each(FACEDOWN_HERE) }, { min: 1, max: 1 }),
        takeIntoHand(cards(chosen("banked")), you, { keepOwner: true }),
      ]),
    ),
  ),
  "44050.plot-convenience-constant": coveredByEngineRule(),

  "44051.ambush-interrupt": interrupt(
    on.schemeDefeated("host"),
    { while: exists(query("minion", { withoutTrait: ELITE })) },
    chooseTarget("minion", query("minion", { withoutTrait: ELITE })),
    discard(chosen("minion")),
  ),

  "44052.bazooka-action": heroAction(
    { label: "attack", cost: discardThis },
    anAttackableEnemy("enemy"),
    attack(encounterIconsInPlay(), chosen("enemy"), { keywords: ["ranged"] }),
  ),

  "44053.blackout-action": heroAction(
    // With no scheme the threat can be taken from (the only threat on the main scheme under a crisis icon) the Action
    // cannot be started and nothing is spent: the payment stands between the choice and the removal, so the gate says
    // it (owner ruling 2026-10-06, docs/phase7-wave7.md §4.1; RRG 1.8 "Move", p. 30).
    { while: canRemoveThreatFrom(each(HAS_THREAT)) },
    // The scheme comes first. The removal is the amount paid (1, or 0 if the payment was declined).
    chooseTarget("scheme", HAS_THREAT),
    chooseOne(...TYPES.map((type) => spendAs(type, [type], 2))),
    removeThreat(varOf("spent.made"), chosen("scheme"), { bind: "moved" }),
    ...TYPES.map((type) => ifThen(allOf(varAtLeast("moved.amount"), varAtLeast(`as.${type}`)), addCounters(type, 1))),
    ifThen(BLACKOUT_FULL, [discard(self), confuse(theVillain)]),
  ),

  "44054.distraction-constant": constant(cannotActivate(query("minion", { hostOfSelf: true }))),

  "44055.laser-swords-constant": constant(gets("atk", min(encounterIconsInPlay(), 4), YOUR_IDENTITY)),

  "44056.rock-paper-scissors-action": heroAction(
    {
      cost: [exhaustThis, chooseCardCost("pick", { zone: "hand", player: "you" }), discardTopOfDeckCost(1, "top")],
    },
    ifThen(CHOSEN_BEATS_DISCARDED, moveCards(cards(chosen("top")), "hand")),
  ),

  "44057.tic-tac-toe-action": heroAction(
    { while: exists(DAMAGED) },
    chooseTarget("source", DAMAGED),
    chooseOne(
      ...TYPES.map((type, row) =>
        spendAs(
          type,
          COLUMNS.map((c) => cell(row + 1, c)),
          1,
        ),
      ),
    ),
    heal(varOf("spent.made"), chosen("source"), { bind: "moved" }),
    ...TYPES.map((type, row) =>
      ifThen(
        allOf(varAtLeast("moved.amount"), varAtLeast(`as.${type}`)),
        chooseOne(
          ...COLUMNS.map((c) =>
            option(
              `Column ${c}`,
              { when: valueAtMost(countersOn(self, cell(row + 1, c)), 0) },
              addCounters(cell(row + 1, c), 1),
            ),
          ),
        ),
      ),
    ),
    ifThen(anyOf(...LINES.map((line) => allOf(...line.map((c) => valueAtLeast(countersOn(self, c), 1))))), [
      anEnemy("enemy"),
      dealDamage(sum(...ALL_CELLS.map((c) => countersOn(self, c))), chosen("enemy")),
      discard(self),
    ]),
  ),

  "44058.war-action": heroAction(
    { cost: exhaustThis },
    discardEncounterCards(1, {
      forEachDiscarded: {
        slot: "card",
        effects: [
          countBoostIcons(chosen("card"), "card"),
          takeDamage(sum(varOf("card.boostIcons"), { kind: "starIcons", cards: chosen("card") })),
        ],
      },
    }),
    moveCards(topOfDeck(1), "discard", "top"),
    anEnemy("enemy"),
    dealDamage(printedCostOf(chosen("top")), chosen("enemy")),
  ),
});
