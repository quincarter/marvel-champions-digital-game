import { trait } from "@mc/content";
import type { AbilityRegistry, EffectSpec, TargetRef } from "@mc/engine";
import {
  andThen,
  attachCard,
  attackingEnemy,
  attackTarget,
  chosen,
  constant,
  damagedAtLeast,
  defineAbilities,
  discard,
  draw,
  eventAmount,
  eventTarget,
  exhaustThis,
  forcedInterrupt,
  forcedResponse,
  gainsTrait,
  gets,
  heroResource,
  heroResponse,
  ifThen,
  instead,
  moveCards,
  cards,
  on,
  oneCopyOf,
  placeDamage,
  query,
  ready,
  refMatches,
  rule,
  selectCards,
  self,
  setAside,
  takesConsequentialDamage,
  valueAtLeast,
  varOf,
  when,
  you,
  YOUR_IDENTITY,
  yourIdentity,
} from "../../../dsl/index.js";
import { FREEZE_MOMENT } from "./identity.js";

const FROSTBITE = query("upgrade", { name: "Frostbite" });
const THE_HOST_ENEMY = { hostOfSelf: true } as const;
/** "Iceman": the identity this upgrade is attached to, on his hero face (the alter-ego face is Bobby Drake). */
const HOST_ICEMAN = query("identity", { hostOfSelf: true, name: "Iceman" });

/**
 * "Attach a set-aside copy of Frostbite to [enemy]" (docs/phase7-wave8.md section 3.61): one copy from the resolving
 * player's own set-aside area, nothing when none is set aside. The same lines as Iceman's "Freeze!" (identity.ts), which
 * also raises the moment; Frozen Solid and Ice Wall attach without it ("Freeze!" is the identity's ability alone).
 */
export const attachFrostbite = (enemy: TargetRef): readonly EffectSpec[] => [
  selectCards("frostbite", oneCopyOf(setAside(you, FROSTBITE))),
  ifThen(valueAtLeast(varOf("frostbite.count"), 1), [attachCard(chosen("frostbite"), enemy)]),
];

/**
 * Iceman's signature supports, upgrades and allies (docs/phase7-wave8.md section 7.2, 3.61, 3.65, 3.67; Q35 = A,
 * Q38 = A).
 *
 * Cards (7):
 * - 46002 Frostbite (upgrade)
 * - 46003 Snow Clone (ally)
 * - 46004 Power Belt (upgrade)
 * - 46005 Cryokinetic Perception (upgrade)
 * - 46006 Ice Slide (upgrade)
 * - 46007 Frozen Solid (upgrade)
 * - 46008 Ice Wall (support)
 *
 * **Frostbite (46002)** is a permanent upgrade attached to an enemy, from its owner's set-aside area. Its constant takes
 * 1 from the host's SCH and ATK, once per copy, to the engine's floor of 0. Its Forced Response, "After attached enemy
 * activates or leaves play, set this card aside", is `on.either(on.enemyActivates("host"), on.leavesPlay("host"))` with
 * `moveCards(cards(self), "setAside")`. The activation half includes Q35 = A (a copy attached during an activation, by a
 * basic defense or by Ice Wall, is set aside after that same activation: no grace activation). The leaves-play half:
 * the permanent copy stays in play unattached when its host leaves (RRG 1.8 "Permanent", p. 32), and the engine's
 * `cardLeavesPlay` names the attachments it stranded, so the copy still reads the leaving card as its host and is set
 * aside (section 3.61).
 *
 * **Snow Clone (46003)** cannot have upgrades attached (an encounter attachment can go on it). Its consequential damage
 * is reduced by 1 after it attacks an enemy with Frostbite attached (`46003.snow-clone-constant-2`). The enemy is read
 * live while it is in play and as it was when the attack was made once the attack has defeated it (Q38 = A; ruling
 * February 8, 2026 - Ruling 1: the engine's last known information for an attack's target), so a defeating attack
 * keeps the reduction although the Frostbite is no longer attached by then.
 *
 * **Power Belt (46004)**: +3 hit points on the identity it is attached to; a hero resource that generates a wild
 * resource only for an ICE card.
 *
 * **Cryokinetic Perception (46005)**, Hero Response: after "Freeze!" resolves (the moment the identity raises once a
 * copy is attached), exhaust this card to draw 1 card; if the card drawn has the ICE trait, ready Iceman. The draw
 * binds the card it drew (section 3.70), read in hand by its printed traits. An empty deck and discard pile draw
 * nothing and ready nothing.
 *
 * **Ice Slide (46006)**: +1 THW, ATK and DEF and the AERIAL trait for Iceman on his hero face; its Forced Response
 * shuffles it into its controller's deck after they change to alter-ego form.
 *
 * **Frozen Solid (46007)**: Forced Interrupt when the attached enemy would activate: the activation is replaced by
 * discarding Frozen Solid, then a set-aside Frostbite is attached to that enemy. The activation did not happen, so
 * nothing answers "after it activates" and the new copy stays (section 3.61).
 *
 * **Ice Wall (46008)**: Forced Interrupt when an identity (any player's) would take damage from an attack: the damage
 * is placed on Ice Wall instead. Then, at 8 or more damage on it, it is discarded and the enemy that just attacked gets
 * a Frostbite (set aside again when that activation ends, Q35 = A).
 */
export const ICEMAN_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({
  "46002.frostbite-constant": constant(gets("sch", -1, THE_HOST_ENEMY), gets("atk", -1, THE_HOST_ENEMY)),

  "46002.frostbite-forced-response": forcedResponse(
    on.either(on.enemyActivates("host"), on.leavesPlay("host")),
    moveCards(cards(self), "setAside"),
  ),

  "46003.snow-clone-constant": constant(
    rule({ kind: "cannotHaveAttachments", target: { self: true }, from: "upgrade" }),
  ),

  "46003.snow-clone-constant-2": constant(
    rule(
      takesConsequentialDamage({ self: true }, -1, {
        from: "attack",
        if: refMatches(attackTarget(), query("enemy", { hasAttachment: FROSTBITE }), { anywhere: true }),
      }),
    ),
  ),

  "46004.power-belt-constant": constant(gets("hp", 3, YOUR_IDENTITY)),
  "46004.power-belt-resource": heroResource(
    { wild: 1 },
    {
      cost: exhaustThis,
      generatesFor: query(["ally", "event", "support", "upgrade", "resource"], { trait: trait("ICE") }),
    },
  ),

  "46005.cryokinetic-perception-response": heroResponse(
    on.moment(FREEZE_MOMENT),
    { cost: exhaustThis },
    draw(1, you, { bind: "drawn" }),
    ifThen(refMatches(chosen("drawn"), { trait: trait("ICE") }, { anywhere: true }), [ready(yourIdentity)]),
  ),

  "46006.ice-slide-constant": constant(
    gets("thw", 1, HOST_ICEMAN),
    gets("atk", 1, HOST_ICEMAN),
    gets("def", 1, HOST_ICEMAN),
    gainsTrait(trait("AERIAL"), HOST_ICEMAN),
  ),
  "46006.ice-slide-forced-response": forcedResponse(
    { ...on.youChangeIdentityForm(), eventIs: { change: "identity", to: "alterEgo" } },
    moveCards(cards(self), "deckShuffle"),
  ),

  "46007.frozen-solid-forced-interrupt": forcedInterrupt(
    on.enemyActivating("host"),
    instead(discard(self), andThen(attachFrostbite(eventTarget))),
  ),

  "46008.ice-wall-forced-interrupt": forcedInterrupt(
    when.damage(query("identity"), { fromAttack: true }),
    instead(
      placeDamage(eventAmount, self),
      andThen(ifThen(damagedAtLeast(self, 8), [discard(self), attachFrostbite(attackingEnemy)])),
    ),
  ),
});

/** Refs left unregistered, each with its reason (the coverage test reads this through its own `skipped` list). */
export const ICEMAN_SUPPORT_UPGRADES_ALLIES_SKIPPED: Readonly<Record<string, string>> = {};
