import { trait } from "@mc/content";
import {
  action,
  addCounters,
  after,
  alterEgoAction,
  anAttackableEnemy,
  attack,
  cards,
  chooseCards,
  chooseOne,
  chosen,
  constant,
  countersOn,
  dealDamage,
  defineAbilities,
  each,
  exhaustThis,
  forcedResponse,
  gainsTrait,
  giveTough,
  heroAction,
  heroResponse,
  moveCards,
  on,
  oncePerPhase,
  option,
  query,
  ready,
  removeCounter,
  removeCountersFrom,
  resource,
  response,
  self,
  shuffleDeck,
  thwartAScheme,
  you,
  YOUR_IDENTITY,
  yourIdentity,
  zone,
} from "../../dsl/index.js";

const TECH = trait("TECH");
const AERIAL = trait("AERIAL");

/**
 * War Machine / James Rhodes (23001a/b) and his signature hero kit (23002–23011, printed `aspect: "hero:23001a"`):
 * the shared "ammo counter" mechanic (docs/phase7-wave4.md §2.1 — no new primitive needed, `addCounters`/
 * `removeCounter`/`removeCountersFrom`/`countersOn` with the printed `"ammo"` counter type already cover every
 * printed line here). Ammo counters sit on the identity card itself ("place 5 ammo counters on **War Machine**"),
 * so every effect that adds or removes them targets `YOUR_IDENTITY`/`yourIdentity`, not the ability's own card,
 * unless the printed cost names a card ability is *on* (`removeCounter(..., { fromIdentity: true })` for a cost that
 * removes ammo from the identity while the ability itself is on a different card).
 *
 * **"Move each ammo counter here to War Machine" (Munitions Bunker, 23003)** has no dedicated "move counters"
 * primitive; it's read as the two-step "add to the destination what's on the source, then remove that same amount
 * from the source" — `addCounters` reads `countersOn(self, "ammo")` *before* the removal changes it, so both effects
 * see the same starting count, exactly "moving" it.
 */
export const WAR_MACHINE_KIT = defineAbilities({
  // War Machine (hero, 23001a) — Locked and Loaded, Response: After you change to this form, place 5 ammo counters
  // on War Machine. Printed on the hero face only, so this ref is active only while hero form is up — "this form"
  // is the plain hero/alter-ego change (the She-Hulk "Do You Even Lift?" precedent, `core/heroes/she-hulk.ts`).
  "23001a.war-machine-constant": response(on.youChangeForm(), addCounters("ammo", 5, yourIdentity)),

  // James Rhodes (alter-ego, 23001b) — Action: Choose a War Machine card in your discard pile and shuffle it into
  // your deck. (Limit once per phase — errata, docs/phase7-wave4.md §1.13, already the printed text.) "A War
  // Machine card" is this player's own identity-specific set (`identitySetOf`, RRG 1.8 "Identity-Specific Card",
  // p. 23) — any category, `query([], { identitySetOf: you })` (the empty-category spelling `query` documents).
  "23001b.james-rhodes-action": action(
    { limit: oncePerPhase },
    chooseCards("found", zone("discard", you, { filter: query([], { identitySetOf: you }) }), { min: 1, max: 1 }),
    moveCards(cards(chosen("found")), "deckShuffle"),
  ),
  // James Rhodes (alter-ego, 23001b) — Forced Response: After you change to this form, discard each ammo counter
  // from your identity. Printed on the alter-ego face only, so — like 23001a above — this fires only when the
  // change lands on alter-ego (the only form where this ref is active).
  "23001b.james-rhodes-forced-response": forcedResponse(
    on.youChangeForm(),
    removeCountersFrom(yourIdentity, "ammo", countersOn(yourIdentity, "ammo")),
  ),

  // Iron Man (ally, 23002) — Response: After Iron Man enters play, search your deck and discard pile for a tech
  // upgrade and add it to your hand. Shuffle your deck. The "Agent Coulson" shape (`wave1/bkw/pack-cards.ts`).
  "23002.iron-man-response": response(
    after.entersPlay("self"),
    chooseCards("found", zone(["deck", "discard"], you, { filter: query("upgrade", { trait: TECH }) }), {
      min: 1,
      max: 1,
    }),
    moveCards(cards(chosen("found")), "hand"),
    shuffleDeck(),
  ),

  // Munitions Bunker (support, 23003) — Alter-Ego Action: Exhaust Munitions Bunker → place 2 ammo counters here.
  "23003.munitions-bunker-action": alterEgoAction({ cost: exhaustThis }, addCounters("ammo", 2, self)),
  // Munitions Bunker (support, 23003) — Hero Action: Exhaust Munitions Bunker → move each ammo counter here to War
  // Machine (module docblock's two-step "move").
  "23003.munitions-bunker-hero-action": heroAction(
    { cost: exhaustThis },
    addCounters("ammo", countersOn(self, "ammo"), yourIdentity),
    removeCountersFrom(self, "ammo", countersOn(self, "ammo")),
  ),

  // Upgraded Chassis (upgrade, 23004) — War Machine gains the aerial trait. Hero Response: After you change to
  // hero form, exhaust Upgraded Chassis → give War Machine a tough status card. `heroResponse` itself is the "to
  // hero form" gate: its trigger only listens while its controller is currently in hero form, which right after
  // this event is exactly "changed to hero" (the `wsp`/`ant` "Surprise Attack"/"Time to Unwind" precedent for a
  // hero-only ref reacting to `on.youChangeForm()`, docs/phase7-wave2.md's own form-change scripting note).
  "23004.upgraded-chassis-constant": constant(gainsTrait(AERIAL, YOUR_IDENTITY)),
  "23004.upgraded-chassis-response": heroResponse(on.youChangeForm(), { cost: exhaustThis }, giveTough(yourIdentity)),

  // Gauntlet Gun (upgrade ×2, 23005) — Resource: Exhaust Gauntlet Gun → generate a [wild] resource for a War
  // Machine event and place 1 ammo counter on War Machine. `generatesFor` covers "for a War Machine event"
  // (`identitySetOf`, FAQ p. 62, docs/phase7-wave4.md §3.23); the ammo counter is the resource ability's own effect,
  // resolved when the resource is used in a payment (docs/phase7-wave4.md §3.30).
  "23005.gauntlet-gun-resource": resource(
    { wild: 1 },
    { cost: exhaustThis, generatesFor: query("event", { identitySetOf: you }) },
    addCounters("ammo", 1, yourIdentity),
  ),

  // Missile Launcher (upgrade, 23006) — Hero Action (attack): Exhaust Missile Launcher and remove 1 ammo counter
  // from War Machine → deal 2 damage to an enemy. This attack gains ranged.
  "23006.missile-launcher-action": heroAction(
    { label: "attack", cost: [exhaustThis, removeCounter("ammo", 1, { fromIdentity: true })] },
    anAttackableEnemy(),
    attack(2, chosen("enemy"), { keywords: ["ranged"] }),
  ),

  // Shoulder Cannon (upgrade, 23007) — Hero Action (attack): Exhaust Shoulder Cannon → deal 1 damage to an enemy.
  // You may remove 1 ammo from War Machine to ready shoulder cannon. The established "you may" idiom
  // (`chooseOne(option("do the thing", ...), option("Do not"))`, `gmw/galactic-artifacts.ts`).
  "23007.shoulder-cannon-action": heroAction(
    { label: "attack", cost: exhaustThis },
    anAttackableEnemy(),
    attack(1, chosen("enemy")),
    chooseOne(
      option(
        "Remove 1 ammo from War Machine to ready Shoulder Cannon",
        removeCountersFrom(yourIdentity, "ammo", 1),
        ready(self),
      ),
      option("Do not"),
    ),
  ),

  // Repulsor Beam (event ×2, 23008) — Hero Action (attack): Remove 1 ammo counter from War Machine → deal 4 damage
  // to an enemy.
  "23008.repulsor-beam-action": heroAction(
    { label: "attack", cost: removeCounter("ammo", 1, { fromIdentity: true }) },
    anAttackableEnemy(),
    attack(4, chosen("enemy")),
  ),

  // Targeted Strike (event ×2, 23009) — Hero Action (thwart): Remove 1 ammo counter from War Machine → remove 3
  // threat from a scheme.
  "23009.targeted-strike-action": heroAction(
    { label: "thwart", cost: removeCounter("ammo", 1, { fromIdentity: true }) },
    thwartAScheme(3),
  ),

  // Scorched Earth (event ×2, 23010) — Hero Action: Remove 3 ammo counters from War Machine → deal 3 damage to each
  // enemy in play.
  "23010.scorched-earth-action": heroAction(
    { cost: removeCounter("ammo", 3, { fromIdentity: true }) },
    dealDamage(3, each(query("enemy"))),
  ),

  // Full Auto (event ×2, 23011) — Hero Action (attack): Remove 4 ammo counters from War Machine and choose an enemy
  // → deal 8 damage to that enemy. This attack gains overkill.
  "23011.full-auto-action": heroAction(
    { label: "attack", cost: removeCounter("ammo", 4, { fromIdentity: true }) },
    anAttackableEnemy(),
    attack(8, chosen("enemy"), { overkill: true }),
  ),
});
