import { trait } from "@mc/content";
import type { AbilityDefinition, AbilityRegistry } from "@mc/engine";
import {
  YOUR_HERO,
  YOUR_IDENTITY,
  aScheme,
  action,
  anAttackableEnemy,
  anEnemy,
  atEndOfActivation,
  attack,
  attackTarget,
  chooseCards,
  chooseTarget,
  chosen,
  confuse,
  constant,
  dealDamage,
  defineAbilities,
  eachPlayer,
  eventTarget,
  exhaustEachCost,
  exhaustThis,
  exhaustYourHero,
  forEachPlayer,
  giveTough,
  gets,
  heal,
  heroAction,
  heroInterrupt,
  heroResponse,
  ifElse,
  ifThen,
  interrupt,
  modifyBasicPower,
  moveCards,
  on,
  paidType,
  paidTypeCount,
  playFromHandIgnoringCost,
  preventThreat,
  query,
  ready,
  refMatches,
  removeCounter,
  removeThreat,
  rule,
  self,
  shuffleDeck,
  spendChosen,
  takesConsequentialDamage,
  thatPlayer,
  thwart,
  threatOn,
  valueAtLeast,
  valueEquals,
  when,
  whenDefeated,
  yourIdentity,
  zone,
  cards,
} from "../../dsl/index.js";
import { WAVE7_ABILITIES } from "../../wave7/index.js";

const X_FORCE = trait("X-FORCE");
const X_MEN = trait("X-MEN");

/** The existing script of a card this one reprints, found by its ability id (docs/phase7-wave8.md §3.70). */
function reprintOf(id: string): AbilityDefinition {
  const definition = WAVE7_ABILITIES[id];
  if (!definition) throw new Error(`reprint source ${id} is not scripted`);
  return definition;
}

/** "Exhaust an [X-FORCE] character and an [X-MEN] character →" (Alliance): one card per slot, never one for both (Q40 = A). */
const XFORCE_AND_XMEN = exhaustEachCost({
  xforce: query(["identity", "ally"], { trait: X_FORCE }),
  xmen: query(["identity", "ally"], { trait: X_MEN }),
});

/** Instance k (1 to 4) of Three Steps Ahead's "for each different resource type": it exists while at least k types paid. */
const stepInstance = (k: number) =>
  ifThen(valueAtLeast(paidTypeCount(), k), [aScheme(`scheme${k}`), removeThreat(2, chosen(`scheme${k}`))]);

/**
 * Jubilee pack aspect and basic player cards, docs/phase7-wave8.md §7.3, §3.62, §3.64, §3.67, §3.70; Q33 = B, Q34 = A,
 * Q38 = A, Q40 = A, Q48.
 *
 * Cards (14):
 * - 47011 Chamber (ally)
 * - 47012 Husk (ally)
 * - 47013 Disguise (upgrade)
 * - 47014 Waylay (event)
 * - 47015 Three Steps Ahead (event)
 * - 47016 Generation X (player_side_scheme)
 * - 47017 The Power of Justice (resource)
 * - 47018 Synch (ally)
 * - 47019 Cell Phone (upgrade)
 * - 47020 X-Gene (upgrade)
 * - 47021 Multitalented (event)
 * - 47022 Unlikely Duo (event)
 * - 47028 Mutant Mayhem (event)
 * - 47029 Serve and Protect (event)
 *
 * **Reprints, one script under two ids**: The Power of Justice 47017 is Core 01062's, X-Gene 47020 is `rogue` 38019's
 * (raw `duplicate_of_code`).
 *
 * **Data ids that are not abilities.** Husk 47012 lists three `husk-constant` ids beside her interrupt and Multitalented
 * 47021 lists four ids for its one Hero Action (the Hero Action line and its three bullets). docs/phase7-wave8.md §7
 * "Left for the data agent" item 3 regenerates Husk to `husk-interrupt` alone; Multitalented's bullets are the same
 * kind of drift. Husk's interrupt and Multitalented's first id (`multitalented-constant`, which holds the whole Hero
 * Action) are registered; the other ids are in `JUBILEE_ASPECT_BASIC_SKIPPED` with that reason.
 *
 * **Chamber (47011) is not registered**: Q38 = A (the enemy as it was when the attack was made) is not met when the
 * attack defeats the confused enemy; see `JUBILEE_ASPECT_BASIC_DRAFTS`.
 *
 * **Husk (47012)**: a resource cost of a chosen size (1 to 3, nothing overpaid); everything spent was spent, so each
 * named type is read from the whole spent pool, a wild as its player declared it (Q33 = B). [energy] adds 1 to the
 * power, [mental] heals 1 from her, [physical] readies her after the use (after any consequential damage).
 *
 * **Waylay (47014)** is an (attack)-labeled ability that only deals damage. Q48 = A makes it an attack; that engine
 * change is not built yet, so today its damage is plain damage (no retaliate, no "after you attack"). Written the
 * natural way, the target chosen among the enemies the identity may attack (guard), so the rule will apply as it lands.
 * The 7 damage is read from the thwarted scheme: the thwart left it with no threat (a thwart's own event carries no
 * `lastThreatRemoved`, which only the removal records).
 *
 * **Three Steps Ahead (47015)** is one (thwart)-labeled ability: every removal is an instance of the one thwart
 * (RRG 1.8 "Thwart", p. 44), the same scheme may be chosen again.
 *
 * **Multitalented (47021)** is (attack)/(thwart) in one ability and resolves in the printed order: damage, threat,
 * heal. Like Waylay its damage line is damage only (Q48).
 *
 * **Unlikely Duo (47022)**: confuse an enemy, then attack a confused enemy (possibly another) for 4.
 *
 * **Serve and Protect (47029)**: any placement on the main scheme is prevented; the two characters that paid are given
 * a tough status card each.
 *
 * **Generation X (47016) constant, Cell Phone (47019) and Mutant Mayhem (47028) are not registered**; see
 * `JUBILEE_ASPECT_BASIC_SKIPPED`. The unregistered drafts are exported for the proofs in the test file.
 */
export const JUBILEE_ASPECT_BASIC: AbilityRegistry = defineAbilities({
  "47012.husk-interrupt": interrupt(
    on.basicPowerUsing("self"),
    { cost: spendChosen(3), readsPaidTypes: { types: ["energy", "mental", "physical"] } },
    ifThen(paidType("energy"), modifyBasicPower(1)),
    ifThen(paidType("mental"), heal(1, self)),
    ifThen(paidType("physical"), atEndOfActivation(ready(self))),
  ),

  "47013.disguise-action": action(
    { label: "thwart", cost: [exhaustThis, exhaustYourHero] },
    aScheme("scheme"),
    thwart(2, chosen("scheme")),
  ),

  "47014.waylay-response": heroResponse(
    on.thwarts(YOUR_HERO),
    { label: "attack" },
    anAttackableEnemy("enemy"),
    dealDamage(ifElse(valueEquals(threatOn(eventTarget), 0), 7, 4), chosen("enemy")),
  ),

  "47015.three-steps-ahead-action": heroAction(
    { label: "thwart", readsPaidTypes: { count: true } },
    stepInstance(1),
    stepInstance(2),
    stepInstance(3),
    stepInstance(4),
  ),

  "47016.when-defeated": whenDefeated(
    forEachPlayer(
      eachPlayer,
      chooseCards(
        "found",
        zone(["deck", "discard"], thatPlayer, { filter: query("event", { identitySetOf: thatPlayer }) }),
        { min: 0, max: 1, chooser: thatPlayer },
      ),
      moveCards(cards(chosen("found")), "hand"),
      shuffleDeck(thatPlayer),
    ),
  ),

  "47017.the-power-of-justice-constant": reprintOf("01062.the-power-of-justice-constant"),

  "47018.synch-interrupt": interrupt(on.basicPowerUsing(YOUR_IDENTITY), { cost: exhaustThis }, modifyBasicPower(1)),

  "47020.x-gene-resource": reprintOf("38019.x-gene-resource"),

  "47021.multitalented-constant": heroAction(
    { label: ["attack", "thwart"], readsPaidTypes: { types: ["physical", "mental", "energy"] } },
    ifThen(paidType("physical"), [anAttackableEnemy("enemy"), dealDamage(2, chosen("enemy"))]),
    ifThen(paidType("mental"), [aScheme("scheme"), removeThreat(2, chosen("scheme"))]),
    ifThen(paidType("energy"), heal(2, yourIdentity)),
  ),

  "47022.unlikely-duo-action": heroAction(
    { label: "attack" },
    anEnemy("confused"),
    confuse(chosen("confused")),
    chooseTarget("target", query("enemy", { attackableBy: yourIdentity, hasStatus: "confused" })),
    attack(4, chosen("target")),
  ),

  "47029.serve-and-protect-interrupt": heroInterrupt(
    when.threatPlaced(query("mainScheme")),
    { cost: XFORCE_AND_XMEN },
    preventThreat(),
    giveTough(chosen("xforce")),
    giveTough(chosen("xmen")),
  ),
});

/**
 * The scripts this module cannot register yet, as printed text would have them (the engine cannot run them, or runs
 * them wrongly); the test file proves each with an `it.fails` and pins today's behavior beside it. Register one by
 * moving it into the registry above once its proof passes.
 *
 * Chamber (`47011.chamber-constant`): the reduction reads the attacked enemy's confused status when the consequential
 * damage is dealt. An attack that defeats the enemy has discarded the status by then, so the reduction is lost (Q38 = A
 * asks for the enemy as it was when the attack was made). The same gap as Snow Clone (`46003.snow-clone-constant-2`).
 *
 * Generation X (`47016.generation-x-constant`): drafted as an always-on +1 THW for X-MEN characters, which is wrong off
 * Generation X (no predicate says "making a basic thwart against this scheme").
 *
 * Cell Phone (`47019.cell-phone-action`): "choose a player -> that player makes a basic attack or thwart with a
 * character they control" has no effect (`basicPowerBy`, docs/phase7-wave8.md section 3.64, build item 11, is not
 * built). The draft stands in with the controller's own DSL attack: no choice of player or character, no +1 THW / +1 ATK,
 * no basic power interrupts.
 *
 * Mutant Mayhem (`47028.mutant-mayhem-action`): the printed "return them to their owners' hands ->" is a cost of two
 * picks and `AbilityCost.returnToHand` takes one. The draft chooses and returns them as effects, which lets the card be
 * used with no ally to return and loses the cost semantics (RRG 1.8 "Cost", p. 13).
 */
export const JUBILEE_ASPECT_BASIC_DRAFTS: Readonly<Record<string, AbilityDefinition>> = {
  "47011.chamber-constant": constant(
    rule(
      takesConsequentialDamage({ self: true }, -1, {
        from: "attack",
        if: refMatches(attackTarget(), query("enemy", { hasStatus: "confused" }), { anywhere: true }),
      }),
    ),
  ),

  "47016.generation-x-constant": constant(gets("thw", 1, query(["hero", "ally"], { trait: X_MEN }))),

  "47019.cell-phone-action": action(
    { cost: [exhaustThis, removeCounter("charge", 1)] },
    anAttackableEnemy("enemy"),
    attack(1, chosen("enemy")),
  ),

  "47028.mutant-mayhem-action": heroAction(
    chooseTarget("xforce", query("ally", { trait: X_FORCE })),
    chooseTarget("xmen", query("ally", { trait: X_MEN })),
    moveCards(cards(chosen("xforce")), "hand"),
    moveCards(cards(chosen("xmen")), "hand"),
    playFromHandIgnoringCost(),
    playFromHandIgnoringCost(),
  ),
};

/** Refs of this module's cards left unregistered, each with its reason; `coverage.test.ts` pins them. */
export const JUBILEE_ASPECT_BASIC_SKIPPED: Readonly<Record<string, string>> = {
  "47011.chamber-constant":
    "the reduction is lost when the attack defeats the confused enemy (its confused card is discarded before the consequential damage is dealt); Q38 = A asks for the enemy as it was when the attack was made. The same gap as Snow Clone 46003: docs/phase7-wave8.md section 3.67",
  "47012.husk-constant":
    "not an ability: the data lists three extra ids beside her interrupt; docs/phase7-wave8.md §7 'Left for the data agent' item 3 regenerates the card to husk-interrupt alone",
  "47012.husk-constant-2": "not an ability: same data drift as 47012.husk-constant",
  "47012.husk-constant-3": "not an ability: same data drift as 47012.husk-constant",
  "47016.generation-x-constant":
    "'+1 THW while making a basic thwart against this scheme' needs a stat-modifier condition on the thwart in progress and its scheme; there is no thwartInProgress predicate (attackInProgress is attacks only) and the basicPowerUsing event carries no target scheme, so an interrupt would raise every X-MEN thwart against any scheme: docs/phase7-wave8.md §3.70 row 'Each [X-MEN] character gets +1 THW'",
  "47019.cell-phone-action":
    "'choose a player -> that player makes a basic attack or thwart with a character they control' needs EffectSpec basicPowerBy, which is not built: docs/phase7-wave8.md §3.64, build item 11",
  "47021.multitalented-constant-2":
    "not an ability: a bullet of the one Hero Action, carried by 47021.multitalented-constant (data drift like Husk's)",
  "47021.multitalented-constant-3": "not an ability: same as 47021.multitalented-constant-2",
  "47021.multitalented-constant-4": "not an ability: same as 47021.multitalented-constant-2",
  "47028.mutant-mayhem-action":
    "the cost 'return an X-FORCE ally and an X-MEN ally to their owners' hands' is two picks and AbilityCost.returnToHand takes one (exhaustCards takes a list); docs/phase7-wave8.md §3.70 row 'Alliance. Choose an [X-FORCE] ally and an [X-MEN] ally' assumed a two-pick return cost",
};
