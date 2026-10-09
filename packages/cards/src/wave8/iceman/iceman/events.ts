import type { AbilityRegistry, EffectSpec } from "@mc/engine";
import {
  aScheme,
  anEnemy,
  attachCard,
  attack,
  bindTargets,
  chooseOne,
  choosePlayer,
  chooseTarget,
  chosen,
  chosenPlayer,
  dealDamage,
  defineAbilities,
  each,
  exists,
  heroAction,
  ifThen,
  oneCopyOf,
  option,
  query,
  selectCards,
  setAside,
  theVillain,
  thwart,
  valueAtLeast,
  varOf,
  you,
  yourIdentity,
} from "../../../dsl/index.js";

const FROSTBITE = query("upgrade", { name: "Frostbite" });
/** An enemy Iceman may attack right now, and one of those with a copy of Frostbite attached. */
const ANY_TARGET = query("enemy", { attackableBy: yourIdentity });
const FROSTBITTEN_TARGET = query("enemy", { attackableBy: yourIdentity, hasAttachment: FROSTBITE });

/** One copy of the owner's set-aside Frostbite, bound to `slot` (nothing bound, count 0, when none is set aside). */
const takeCopy = (slot: string): EffectSpec => selectCards(slot, oneCopyOf(setAside(you, FROSTBITE)));
const haveCopy = (slot: string) => valueAtLeast(varOf(`${slot}.count`), 1);

/**
 * Ice Blast gives at most one copy per enemy named, and at most six copies exist, so six steps cover the villain and
 * every minion: step k takes the next set-aside copy, asks for one of the named enemies that has not been given a copy
 * in this resolution, and attaches it. A step with no copy left or no enemy left does nothing (RRG 1.8 "Resolve":
 * do as much as you can). The named enemies are the villain and each minion engaged with the chosen player; a player
 * with fewer copies than enemies picks which of them get one.
 */
const BLAST_STEPS = [0, 1, 2, 3, 4, 5];
const blastStep = (k: number): EffectSpec[] => [
  takeCopy(`copy${k}`),
  ifThen(haveCopy(`copy${k}`), [
    chooseTarget(
      `enemy${k}`,
      query([], {
        anyOf: [
          query("villain", { inSlot: "villain" }),
          query("minion", { engagedWithPlayer: chosenPlayer("player") }),
        ],
        excludeSlots: BLAST_STEPS.slice(0, k).map((i) => `enemy${i}`),
      }),
    ),
    attachCard(chosen(`copy${k}`), chosen(`enemy${k}`)),
  ]),
];

/**
 * Iceman signature events (docs/phase7-wave8.md section 7.2, 3.61, 3.67; Q35 = A, Q38 = A).
 *
 * Cards (3):
 * - 46009 Arctic Attack (event)
 * - 46010 Ice Blast (event)
 * - 46011 Chill Out! (event)
 *
 * **Arctic Attack (46009)**, Hero Action (attack): choose one. Either deal 4 damage to an enemy and then attach a
 * set-aside copy of Frostbite to it, or deal 6 damage to an enemy with Frostbite attached. It carries the "(attack)"
 * label, so each option is an attack by his identity (RRG 1.8 "Attack", p. 7: guard and retaliate apply; he does not
 * exhaust), made on an enemy he may attack. The first option attaches after the damage: an enemy the attack defeats
 * has nothing to receive the copy, and the copy stays set aside. Its second option is offered only while an enemy he
 * may attack has a copy attached, read when the choice is made (before the damage). With no copy set aside the first
 * option just attacks.
 *
 * **Ice Blast (46010)**, Hero Action, not an attack: choose a player; attach a set-aside copy to the villain and to each
 * minion engaged with that player (one copy each, `blastStep`), then deal 3 damage to each enemy with a copy attached
 * (all of them, engaged with that player or not; an enemy with two copies takes 3 once). Plain damage: guard and
 * retaliate do not apply. The "freeze" moment is not raised (only Iceman's identity ability raises it).
 *
 * **Chill Out! (46011)**, Hero Action (thwart): remove 3 threat from a scheme, then attach a set-aside copy of Frostbite
 * to an enemy (any enemy, engaged or not). With no copy set aside the enemy is not asked for.
 */
export const ICEMAN_EVENTS: AbilityRegistry = defineAbilities({
  "46009.arctic-attack-action": heroAction(
    { label: "attack" },
    chooseOne(
      option(
        "Deal 4 damage to an enemy and attach a set-aside copy of Frostbite to it",
        { when: exists(ANY_TARGET) },
        chooseTarget("enemy", ANY_TARGET),
        attack(4, chosen("enemy")),
        takeCopy("copy"),
        ifThen(haveCopy("copy"), [attachCard(chosen("copy"), chosen("enemy"))]),
      ),
      option(
        "Deal 6 damage to an enemy with Frostbite attached",
        { when: exists(FROSTBITTEN_TARGET) },
        chooseTarget("enemy", FROSTBITTEN_TARGET),
        attack(6, chosen("enemy")),
      ),
    ),
  ),

  "46010.ice-blast-action": heroAction(
    choosePlayer("player"),
    bindTargets("villain", theVillain),
    BLAST_STEPS.flatMap(blastStep),
    dealDamage(3, each(query("enemy", { hasAttachment: FROSTBITE }))),
  ),

  "46011.chill-out-action": heroAction(
    { label: "thwart" },
    aScheme("scheme"),
    thwart(3, chosen("scheme")),
    takeCopy("copy"),
    ifThen(haveCopy("copy"), [anEnemy("enemy"), attachCard(chosen("copy"), chosen("enemy"))]),
  ),
});

/** Refs left unregistered, each with its reason (the coverage test reads this through its own `skipped` list). */
export const ICEMAN_EVENTS_SKIPPED: Readonly<Record<string, string>> = {};
