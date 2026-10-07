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
  eventAmount,
  eventTarget,
  exhaustThis,
  forcedInterrupt,
  forcedResponse,
  gainsTrait,
  gets,
  heroResource,
  ifThen,
  instead,
  moveCards,
  cards,
  on,
  oneCopyOf,
  placeDamage,
  query,
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
} from "../../../dsl/index.js";

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
 * 1 from the host's SCH and ATK, once per copy, to the engine's floor of 0. Its Forced Response is NOT registered:
 * "After attached enemy activates or leaves play, set this card aside" is `on.either(on.enemyActivates("host"),
 * on.leavesPlay("host"))` with `moveCards(cards(self), "setAside")`. The activation half works, including Q35 = A (a
 * copy attached during an activation, by a basic defense or by Ice Wall, is set aside after that same activation: no
 * grace activation). The leaves-play half does not: the engine unattaches the permanent copy into its owner's play
 * area before the host's move, so no response ever sees "host" as the leaving card and the copy stays in play
 * unattached. The ref has one trigger, so it cannot be split into an activation response and a leaves-play
 * interrupt; registering half of it would be an approximation. See `skipped`.
 *
 * **Snow Clone (46003)** cannot have upgrades attached (an encounter attachment can go on it). Its consequential damage
 * is reduced by 1 after it attacks an enemy with Frostbite attached (`46003.snow-clone-constant-2`, NOT registered). It
 * works against an enemy that survives. When the attack defeats the enemy the Frostbite is already unattached when
 * the consequential damage is dealt, so the reduction is lost, against Q38 = A (ruling February 8, 2026 - Ruling 1; the
 * engine keeps Coordinated Attack's rule as last known information, but not an upgrade's attachment to a defeated
 * target). See `skipped` and `ICEMAN_SUPPORT_UPGRADES_ALLIES_DRAFTS`.
 *
 * **Power Belt (46004)**: +3 hit points on the identity it is attached to; a hero resource that generates a wild
 * resource only for an ICE card.
 *
 * **Cryokinetic Perception (46005)** is not scripted: "draw 1 card. If that card has the ICE trait" needs to read the
 * card the draw just moved, and the draw effect binds no card (docs/phase7-wave8.md section 3.70 lists "a bound draw"
 * as existing vocabulary; it is not in the DSL). See `skipped`.
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

  "46003.snow-clone-constant": constant(
    rule({ kind: "cannotHaveAttachments", target: { self: true }, from: "upgrade" }),
  ),

  "46004.power-belt-constant": constant(gets("hp", 3, YOUR_IDENTITY)),
  "46004.power-belt-resource": heroResource(
    { wild: 1 },
    {
      cost: exhaustThis,
      generatesFor: query(["ally", "event", "support", "upgrade", "resource"], { trait: trait("ICE") }),
    },
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

/**
 * The two skipped refs written out as printed, NOT registered (the registry above must not hold them; the coverage test
 * pins that). They exist so the tests can show exactly where each one fails, and to register unchanged once the engine
 * can run them: move each entry into the registry and delete it from `skipped`.
 *
 * Frostbite's Forced Response: the leaves-play half is never heard (section 3.61). Snow Clone's consequential-damage
 * reduction reads the target's Frostbite after the attack defeated it, when the copy is already unattached: Q38 = A (the
 * enemy as it was when the attack was made) is not kept (section 3.67).
 */
export const ICEMAN_SUPPORT_UPGRADES_ALLIES_DRAFTS: AbilityRegistry = defineAbilities({
  "46002.frostbite-forced-response": forcedResponse(
    on.either(on.enemyActivates("host"), on.leavesPlay("host")),
    moveCards(cards(self), "setAside"),
  ),
  "46003.snow-clone-constant-2": constant(
    rule(
      takesConsequentialDamage({ self: true }, -1, {
        from: "attack",
        if: refMatches(attackTarget(), query("enemy", { hasAttachment: FROSTBITE }), { anywhere: true }),
      }),
    ),
  ),
});

/** Refs left unregistered, each with its reason (the coverage test reads this through its own `skipped` list). */
export const ICEMAN_SUPPORT_UPGRADES_ALLIES_SKIPPED: Readonly<Record<string, string>> = {
  "46002.frostbite-forced-response":
    "section 3.61 proof fails: after the host leaves play the unattached permanent copy hears no response (on.leavesPlay('host') no longer matches); no former-host response pattern exists",
  "46003.snow-clone-constant-2":
    "section 3.67 proof fails: an attack that defeats the enemy leaves its Frostbite already unattached, so the 'enemy with Frostbite attached' condition is false and Q38 = A (read the enemy as when the attack was made) is not kept",
  "46005.cryokinetic-perception-response":
    "reads the card its own 'draw 1 card' drew (trait ICE) and the draw effect binds no card or slot; spec section 3.70 lists a bound draw as existing vocabulary",
};
