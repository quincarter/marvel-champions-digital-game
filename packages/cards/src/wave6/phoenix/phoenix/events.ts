import { trait } from "@mc/content";
import { SCW_PACK_CARDS } from "../../../wave2/scw/pack-cards.js";
import {
  addCounters,
  anAttackableEnemy,
  anEnemy,
  attack,
  cards,
  chooseCards,
  chooseOne,
  chooseTarget,
  chosen,
  confuse,
  countersOn,
  dealDamage,
  defineAbilities,
  divide,
  each,
  eventSource,
  exhaustCardsCost,
  exhaustYourHero,
  heal,
  heroAction,
  heroInterrupt,
  ifThen,
  interrupt,
  modifyAttack,
  modifyStat,
  moveCards,
  named,
  ofTeamUpSet,
  on,
  option,
  query,
  ready,
  removeCountersFrom,
  statOf,
  stun,
  sum,
  teamUpCharacters,
  theVillain,
  thwartAScheme,
  totalStatOf,
  valueAtLeast,
  you,
  youHaveTrait,
  yourIdentity,
  zone,
} from "../../../dsl/index.js";

const UNLEASHED = trait("UNLEASHED");
const X_MEN = trait("X-MEN");
const PHOENIX_FORCE = named("Phoenix Force");
const NEXT_BASIC = { nextBasic: ["attack", "thwart"] } as const;

/**
 * Phoenix's events (`phoenix` 34010-34013 hero set; 34017-34019, 34023, 34032-34035 aspect, basic and Team-Up cards of
 * her precon), docs/phase7-wave6.md §6.1. "Play only if your identity has the PSIONIC / X-MEN trait" is card data
 * (`playRestrictions.requiresIdentityTrait`), not scripted. Rise from the Ashes (34006) is an upgrade, so it is not here.
 * Psychic Rapport's other printing, 33023, belongs to the Cyclops pack's registry.
 *
 * - **UNLEASHED/RESTRAINED switches** read `youHaveTrait`: Phoenix Force grants the trait to the identity while it
 *   is on that side (granted traits count). Telekinetic Attack's "2 additional damage" is a 9 attack with overkill.
 * - **Phoenix Firebird (34013)**: the removal "→" is a cost of its option, so the option is offered only while Phoenix
 *   Force has a counter; removing the last one flips it to Unleashed through its own forced response (Q24's reading).
 * - **Psychic Manipulation (34017)** (§3.35, Q17) and **Psychic Misdirection (34033)** (§3.36, Q18) are interrupts
 *   that modify the enemy activation in progress. **Psychic Kicker (34034)** (§3.39, Q23): both bonuses wait on the
 *   ally's next basic thwart or attack this phase.
 * - **Mutant Peacekeepers (34018)**: "any number" of X-MEN allies pays with at least one (RRG 1.8 "Cost", p. 14), the
 *   hero's THW counts with those of the exhausted allies, and X is divided among schemes (a thwart).
 * - **Swift Retribution (34019)**: printed the same as the Core-set card `15014`; aliased.
 */
export const PHOENIX_EVENTS = defineAbilities({
  "34010.telekinetic-attack-action": heroAction(
    { label: "attack" },
    anAttackableEnemy("enemy"),
    ifThen(youHaveTrait(UNLEASHED), attack(9, chosen("enemy"), { overkill: true }), attack(7, chosen("enemy"))),
  ),

  "34011.psychic-blast-action": heroAction(
    dealDamage(4, theVillain),
    ifThen(youHaveTrait(UNLEASHED), dealDamage(4, each(query("minion", { engagedWith: "you" })))),
  ),

  "34012.telepathic-trickery-action": heroAction(
    { label: "thwart" },
    ...thwartAScheme(4),
    ifThen(youHaveTrait(UNLEASHED), [anEnemy("target"), stun(chosen("target")), confuse(chosen("target"))]),
  ),

  "34013.phoenix-firebird-action": heroAction(
    chooseOne(
      option(
        "Remove 1 power counter from Phoenix Force: ready Phoenix",
        { when: valueAtLeast(countersOn(PHOENIX_FORCE, "power"), 1) },
        removeCountersFrom(PHOENIX_FORCE, "power", 1),
        ready(yourIdentity),
      ),
      option("Place 2 power counters on Phoenix Force", addCounters("power", 2, PHOENIX_FORCE)),
    ),
  ),

  // Psychic Manipulation — Interrupt (thwart): When the villain schemes, this activation removes threat instead of
  // placing it. The label makes the removal a thwart by your identity (RRG 1.8 "Labeled Ability", p. 26; owner
  // decision, 2026-10-03): "after you thwart" answers it, and it is not offered while you cannot thwart the scheme the
  // villain is scheming on (an engaged patrol minion, p. 32; a crisis icon, p. 14; "Target", p. 43).
  "34017.psychic-manipulation-interrupt": interrupt(
    on.enemySchemes({ categories: ["villain"] }),
    { label: "thwart" },
    modifyAttack({ removesThreat: true }),
  ),

  "34018.mutant-peacekeepers-action": heroAction(
    {
      label: "thwart",
      cost: [exhaustYourHero, exhaustCardsCost(query("ally", { trait: X_MEN }), { max: "any" })],
    },
    divide("threat", sum(statOf(yourIdentity, "thw"), totalStatOf(chosen("exhausted"), "thw")), query("scheme")),
  ),

  "34019.swift-retribution-action": SCW_PACK_CARDS["15014.swift-retribution-action"]!,

  "34023.psychic-rapport-action": heroAction(
    ready(teamUpCharacters()),
    chooseOne(
      option(
        "Return a Cyclops card from your discard pile to your hand",
        chooseCards("card", zone("discard", you, { filter: ofTeamUpSet(0) }), { min: 1, max: 1 }),
        moveCards(cards(chosen("card")), "hand"),
      ),
      option("Place 2 power counters on Phoenix Force", addCounters("power", 2, PHOENIX_FORCE)),
    ),
  ),

  "34032.psychic-assault-action": heroAction(
    { label: "attack" },
    anAttackableEnemy("enemy"),
    attack(3, chosen("enemy")),
    confuse(chosen("enemy")),
  ),

  "34033.psychic-misdirection-interrupt": heroInterrupt(
    on.enemyAttacks({ categories: ["enemy"] }, { againstYou: true }),
    { label: "defense" },
    chooseTarget("enemy", query("enemy", { excluding: eventSource })),
    modifyAttack({ damageTo: chosen("enemy") }),
  ),

  "34034.psychic-kicker-action": heroAction(
    chooseTarget("ally", query("ally")),
    ready(chosen("ally")),
    modifyStat("thw", 2, chosen("ally"), NEXT_BASIC),
    modifyStat("atk", 2, chosen("ally"), NEXT_BASIC),
  ),

  "34035.soul-sisters-action": heroAction(ready(teamUpCharacters()), heal(2, teamUpCharacters())),
});
