import { trait } from "@mc/content";
import {
  after,
  alterEgoAction,
  anAttackableEnemy,
  anEnemy,
  attack,
  attackAnEnemy,
  atEndOfActivation,
  addCounters,
  cancelIt,
  cards,
  chooseCards,
  chooseOne,
  choosePlayer,
  chooseTarget,
  chosen,
  chosenPlayer,
  confuse,
  constant,
  damageAnEnemy,
  dealDamage,
  dealEncounterCard,
  defineAbilities,
  discardDeckUntil,
  draw,
  each,
  eventTarget,
  exhaustCardsCost,
  exhaustThis,
  forcedResponse,
  gainsKeyword,
  giveTough,
  hasStatus,
  heal,
  heroAction,
  heroInterrupt,
  heroResource,
  heroResponse,
  ifThen,
  modifyBasicPower,
  moveCards,
  on,
  partOf,
  option,
  paidWithOnly,
  query,
  ready,
  reduceNextCardCost,
  removeCounter,
  removeThreatFromAScheme,
  restrictedLimit,
  self,
  setup,
  shuffleDeck,
  stun,
  takeDamageCost,
  theVillain,
  threatOn,
  thwartAScheme,
  valueEquals,
  you,
  YOUR_IDENTITY,
  yourIdentity,
  zone,
} from "../../dsl/index.js";

const WEAPON = trait("WEAPON");
const GUARDIAN = trait("GUARDIAN");

/**
 * Venom / Flash Thompson (20001a/b) and his hero kit (20002–20022, 20026–20029). Reprints in this pack — The
 * Power of Justice (20014, verbatim Core 01062) and Resourceful (20020, verbatim reprint) — are aliased
 * automatically by `../reprints.ts`, not scripted here.
 *
 * **Errata/FAQ checked:** none of 20001–20029 carries current errata (`pnpm card` shows no `!! ERRATA` for any of
 * them); the printed text transcribed from `packages/content/src/data/vnm/cards.ts` is the current legal text.
 *
 * **No genuine primitive gaps in the kit.** Every ability composes from existing DSL vocabulary, plus three small
 * additive DSL wrappers this pass needed and added generically (no engine change, in `dsl/values.ts`/`dsl/
 * abilities.ts`/`dsl/effects.ts` respectively):
 * - `paidWithOnly` — the engine `Predicate` already existed (wave 2's own play-restrictions test), with no DSL
 *   builder; "If you paid for this card using only [X] resources" (Behind Enemy Lines, Grasping Tendrils, Savage
 *   Attack) needed it.
 * - `restrictedLimit` — docs/phase7-wave3.md §3.22's `RuleSpec`, landed in the engine with no DSL wrapper yet;
 *   Venom's own identity (both faces) and Side Holster (20021) both print it.
 * - `atEndOfActivation` — the engine `EffectSpec` already existed (a Boost ability's own "after this activation
 *   ends"), with no DSL wrapper; Making an Entrance's "After that thwart ends, if your hero removed all threat
 *   from a scheme that way, heal 2 damage" needs it from a player-side interrupt, not a Boost body.
 *   `currentActivationFrameId` (`packages/engine/src/stack.ts`) already matches a `thwart` event frame alongside
 *   `attack`/`enemyAttack`/`enemyScheme`, so this composes with no engine change.
 *
 * **Making an Entrance (20013)** reads "removed all threat from a scheme that way" as the scheme's threat sitting
 * at 0 once the (boosted) thwart resolves — `valueEquals(threatOn(eventTarget), 0)` inside the deferred
 * `atEndOfActivation` block, where `eventTarget` is the thwart event's own scheme (RRG 1.8 "Thwart", p. 44;
 * `trigger-events.ts`'s `eventSubjects` names the scheme as a `thwart` event's target). The interrupt itself
 * triggers on `basicPowerUsing` (the `on.basicPowerUsing`/`modifyBasicPower` pairing Rapid Growth, `wsp` 13005,
 * and Venom's own Pistol already use), not `on.thwarts`, since `modifyBasicPower` only reads that event.
 *
 * **Multi-Gun (20008)** parses into one `-action` ref plus three bullet-line refs (`-constant`/`-constant-2`/`-
 * constant-3`), the same ingestion artifact Hex Bolt (`scw` 15004) and several `trors` cards carry (docs/phase7-
 * wave2-scripting.md's own precedent): the `-action` ref's `chooseOne` already carries the whole printed text, so
 * the three extras are `partOf` it, each covered by its own branch test in `venom-kit.test.ts`.
 */
export const VENOM_KIT = defineAbilities({
  // Venom (20001a) — You can control 1 additional upgrade that has the restricted keyword. Symbiotic Bond -
  // Resource: Take 1 damage → generate a [wild] resource. (Limit once per phase.) Printed identically on both
  // faces (below), so both refs carry the restricted-limit rule — `activeAbilityRefs` (`packages/engine/src/
  // select.ts`) reads only the currently-showing face's abilities, and the printed sentence is meant to apply
  // regardless of form.
  "20001a.venom-constant": constant(restrictedLimit(1)),
  "20001a.venom-constant-2": heroResource(
    { wild: 1 },
    { cost: takeDamageCost(1), limit: { count: 1, period: "phase" } },
  ),

  // Flash Thompson (20001b) — You can control 1 additional upgrade that has the restricted keyword. Armed and
  // Ready - Setup: Discard cards from the top of your deck until you discard a weapon upgrade, then add that card
  // to your hand.
  "20001b.flash-thompson-constant": constant(restrictedLimit(1)),
  "20001b.flash-thompson-constant-2": setup(
    discardDeckUntil(query("upgrade", { trait: WEAPON }), "found"),
    moveCards(cards(chosen("found")), "hand"),
  ),

  // Behind Enemy Lines — Hero Action (thwart): Remove 3 threat from a scheme. If you paid for this card using
  // only [mental] resources, confuse an enemy.
  "20002.behind-enemy-lines-action": heroAction(
    { label: "thwart" },
    ...thwartAScheme(3),
    ifThen(paidWithOnly("mental"), [anEnemy(), confuse(chosen("enemy"))]),
  ),

  // Grasping Tendrils — Hero Interrupt (defense): When the villain initiates an attack against you, cancel that
  // attack. If you paid for this card using only [physical] resources, stun the villain.
  "20003.grasping-tendrils-interrupt": heroInterrupt(
    on.villainAttacks({ againstYou: true }),
    { label: "defense" },
    cancelIt(),
    ifThen(paidWithOnly("physical"), stun(theVillain)),
  ),

  // Locked and Loaded — Action: Search your deck for a weapon upgrade and add it to your hand. Shuffle your deck.
  "20004.locked-and-loaded-constant": heroAction(
    chooseCards("found", zone("deck", you, { filter: query("upgrade", { trait: WEAPON }) }), { min: 1, max: 1 }),
    moveCards(cards(chosen("found")), "hand"),
    shuffleDeck(),
  ),

  // Run and Gun — Hero Action: Ready Venom and each weapon upgrade you control.
  "20005.run-and-gun-action": heroAction(
    ready(yourIdentity),
    ready(each(query("upgrade", { trait: WEAPON, controller: "you" }))),
  ),

  // Savage Attack — Hero Action (attack): Deal 5 damage to an enemy. If you paid for this card using only
  // [energy] resources, this attack gains overkill.
  "20006.savage-attack-action": heroAction(
    { label: "attack" },
    anAttackableEnemy(),
    ifThen(paidWithOnly("energy"), attack(5, chosen("enemy"), { overkill: true }), attack(5, chosen("enemy"))),
  ),

  // Project Rebirth 2.0 — Alter-Ego Action: Exhaust Project Rebirth 2.0 → choose to either draw 1 card or heal 3
  // damage from Flash Thompson.
  "20007.project-rebirth-20-action": alterEgoAction(
    { cost: exhaustThis },
    chooseOne(option("Draw 1 card", draw(1)), option("Heal 3 damage from Flash Thompson", heal(3, yourIdentity))),
  ),

  // Multi-Gun — Restricted. Hero Action: Exhaust Multi-Gun → choose one of the following: deal 2 damage to an
  // enemy; choose a player, deal 1 damage to each minion engaged with that player; remove 2 threat from a scheme.
  "20008.multi-gun-action": heroAction(
    { cost: exhaustThis },
    chooseOne(
      option("Deal 2 damage to an enemy", ...damageAnEnemy(2)),
      option(
        "Choose a player. Deal 1 damage to each minion engaged with that player.",
        choosePlayer("player"),
        dealDamage(1, each(query("minion", { engagedWithPlayer: chosenPlayer("player") }))),
      ),
      option("Remove 2 threat from a scheme", ...removeThreatFromAScheme(2)),
    ),
  ),
  // The three bulleted options were ingested as their own refs, one per bullet; each is part of the action above.
  "20008.multi-gun-constant": partOf("20008.multi-gun-action"),
  "20008.multi-gun-constant-2": partOf("20008.multi-gun-action"),
  "20008.multi-gun-constant-3": partOf("20008.multi-gun-action"),

  // Spider-Sense — Hero Interrupt: When the villain initiates an attack against you, draw 1 card.
  "20009.spider-sense-interrupt": heroInterrupt(on.villainAttacks({ againstYou: true }), draw(1)),

  // Venom's Pistol — Restricted. Hero Interrupt: When you use one of Venom's basic powers, exhaust Venom's Pistol
  // → Venom gets +1 to that power for this use.
  "20010.venoms-pistol-interrupt": heroInterrupt(
    on.basicPowerUsing(YOUR_IDENTITY),
    { cost: exhaustThis },
    modifyBasicPower(1),
  ),

  // Jack Flag — Response: After Jack Flag thwarts, place 1 ammo counter on him. Hero Action: Exhaust Jack Flag
  // and remove 1 ammo counter from him → deal 2 damage to an enemy.
  "20011.jack-flag-response": heroResponse(on.thwarts("self"), addCounters("ammo", 1, self)),
  "20011.jack-flag-action": heroAction({ cost: [exhaustThis, removeCounter("ammo")] }, ...damageAnEnemy(2)),

  // Scare Tactic — Hero Action (attack): Deal 3 damage to a confused enemy.
  "20012.scare-tactic-action": heroAction(
    { label: "attack" },
    chooseTarget("enemy", query("enemy", { attackableBy: yourIdentity, hasStatus: "confused" })),
    attack(3, chosen("enemy")),
  ),

  // Making an Entrance — Hero Interrupt: When your hero makes a basic thwart, it gets +2 THW for that thwart.
  // After that thwart ends, if your hero removed all threat from a scheme that way, heal 2 damage from your hero
  // (module docblock).
  "20013.making-an-entrance-interrupt": heroInterrupt(
    on.basicPowerUsing(YOUR_IDENTITY, { power: "thwart" }),
    modifyBasicPower(2),
    atEndOfActivation(ifThen(valueEquals(threatOn(eventTarget), 0), heal(2, yourIdentity))),
  ),

  // Sonic Rifle — Restricted. Uses (2 charge counters). Hero Action: Exhaust Sonic Rifle and remove 1 charge
  // counter from it → confuse an enemy (deal 3 damage to that enemy instead if it is already confused).
  "20015.sonic-rifle-action": heroAction(
    { cost: [exhaustThis, removeCounter("charge")] },
    anEnemy(),
    ifThen(hasStatus(chosen("enemy"), "confused"), dealDamage(3, chosen("enemy")), confuse(chosen("enemy"))),
  ),

  // Star-Lord — [star] Star-Lord's attacks gain ranged (the mirror of War Machine's own self-grant, `trors`
  // 04020). Forced Response: After Star-Lord enters play under your control, deal yourself 1 facedown encounter
  // card.
  "20016.star-lord-constant": constant(gainsKeyword({ name: "ranged" }, query("ally", { self: true }))),
  "20016.star-lord-forced-response": forcedResponse(after.entersPlay("self"), dealEncounterCard()),

  // Side Holster — Play under any player's control. Max 1 per player. You can control 1 additional [Weapon]
  // upgrade that has the restricted keyword.
  "20021.side-holster-constant": constant(restrictedLimit(1, { cards: query("upgrade", { trait: WEAPON }) })),

  // Plasma Pistol — Restricted. Uses (3 charge counters). Hero Action: Exhaust Plasma Pistol and remove 1 charge
  // counter from it → deal 1 damage to an enemy.
  "20022.plasma-pistol-action": heroAction({ cost: [exhaustThis, removeCounter("charge")] }, ...damageAnEnemy(1)),

  // Fusillade — Hero Action (attack): Exhaust a weapon upgrade you control → deal 5 damage to an enemy.
  "20026.fusillade-action": heroAction(
    { label: "attack", cost: exhaustCardsCost(query("upgrade", { trait: WEAPON })) },
    ...attackAnEnemy(5),
  ),

  // "Welcome Aboard" — Play only if your identity has the guardian trait; Max 1 per round (both already data,
  // `playRestrictions: { requiresIdentityTrait, maxPerRound: 1 }`, `packages/content/src/data/vnm/cards.ts` —
  // a one-shot event's own play cap, not a repeatable ability's own `limit`). Hero Action: Reduce the resource
  // cost of the next ally played this phase by 2.
  "20027.welcome-aboard-action": heroAction(reduceNextCardCost(you, 2, "phase", query("ally"))),

  // Shake it Off — Hero Response: After a guardian character takes any amount of damage from an attack, give
  // that character a tough status card.
  "20028.shake-it-off-response": heroResponse(
    on.damage(query("character", { trait: GUARDIAN }), { fromAttack: true, taken: true }),
    giveTough(eventTarget),
  ),

  // Crew Quarters — Play under any player's control. Max 1 per player. Alter-Ego Action: Exhaust Crew Quarters →
  // heal 1 damage from an alter-ego.
  "20029.crew-quarters-action": alterEgoAction(
    { cost: exhaustThis },
    chooseTarget("target", query("alterEgo")),
    heal(1, chosen("target")),
  ),
});
