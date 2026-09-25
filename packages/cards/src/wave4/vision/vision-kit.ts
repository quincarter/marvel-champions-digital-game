import { trait } from "@mc/content";
import {
  aScheme,
  action,
  alterEgoAction,
  anAttackableEnemy,
  atEndOfAttack,
  attachCard,
  attack,
  attackAnEnemy,
  cards,
  changeAdditionalForm,
  chooseCards,
  chosen,
  constant,
  defineAbilities,
  discardThis,
  draw,
  eventSource,
  exhaustThis,
  gainsKeyword,
  gainsTrait,
  gets,
  heroAction,
  heroInterrupt,
  heroResponse,
  ifThen,
  inAdditionalForm,
  isHero,
  modifyAttack,
  moveCards,
  ofIdentitySetTitled,
  on,
  playOnlyIf,
  putIntoPlay,
  query,
  resource,
  response,
  rule,
  selectCards,
  setup,
  shuffleDeck,
  stun,
  thwartAScheme,
  you,
  yourIdentity,
  YOUR_IDENTITY,
  zone,
  thwart,
  anEnemy,
  confuse,
  chooseTarget,
  discard,
} from "../../dsl/index.js";

const ANDROID = trait("ANDROID");

/**
 * Vision (26001a/b) and his signature hero kit (26002–26012, printed `aspect: "hero:26001a"`): the "mass form"
 * keyword (docs/phase7-wave4.md §1.1/§3.1, `KeywordInstance form`/`changeAdditionalForm`/`inAdditionalForm`,
 * already landed) — Intangible/Dense (26002) is one double-sided upgrade, put into play at setup Intangible side
 * faceup, flipped by "Density Manipulation" (a once-per-round Action on the identity, not the once-per-round
 * hero/alter-ego flip: `action({ limit: { count: 1, period: "round" } }, changeAdditionalForm("mass"))` never uses
 * `changedFormThisRound`, RRG 1.8 "Form, Change Form" p. 21, docs/phase7-wave4.md §3.1's own worked example).
 *
 * **Intangible's "Vision cannot attack or defend." (26002.intangible-constant)** is `cannotAttack` scoped to the
 * attacking character plus `RuleSpec cannotDefend` (docs/phase7-wave4.md §3.31), both on the upgrade's host.
 *
 * **Corrupted Programming's "blank, except for keywords" (26028.corrupted-programming-constant, obligation)**
 * landed after this pack's own "Not done" note (docs/phase7-wave4.md §3.28): `blankTextBox` gained `exceptKeywords`,
 * so the obligation is fully scripted in `vision-obligation-nemesis.ts`, not skipped.
 *
 * **Just Passing Through's "ignoring the patrol keyword" (26010.just-passing-through-action)** is the one-shot
 * `thwart.ignorePatrol` (docs/phase7-wave4.md §3.32). **Phase Disruption's "Choose an attachment … with the text
 * 'Hero Action' or 'Hero Response'" (26011.phase-disruption-action)** is `TargetQuery.abilityTiming` (§3.33).
 */
export const VISION_KIT = defineAbilities({
  // Vision (hero, 26001a) — Density Manipulation - Action: Change mass form by flipping your mass form upgrade
  // over. (Limit once per round.) Not the hero/alter-ego flip's own once-per-round limit (module docblock).
  "26001a.vision-constant": action({ limit: { count: 1, period: "round" } }, changeAdditionalForm("mass")),

  // Vision (alter-ego, 26001b) — While you are in Dense mass form, you get +2 REC. While you are in Intangible mass
  // form, you get +1 hand size. Setup: Put your mass form upgrade into play, Intangible side faceup (the double-
  // sided card's default face is its front, Intangible — no explicit flip needed, docs/phase7-wave4.md §3.1's own
  // "the mass form card is faceup on its front" reading).
  "26001b.vision-constant": constant(gets("rec", 2, YOUR_IDENTITY, { while: inAdditionalForm("mass", "Dense") })),
  "26001b.vision-constant-2": constant(
    gets("handSize", 1, YOUR_IDENTITY, { while: inAdditionalForm("mass", "Intangible") }),
  ),
  "26001b.setup": setup(
    // `["deck", "hand"]`, not `"deck"` alone: RRG 1.8 Appendix II step 16 ("Resolve Player Setup Abilities") runs
    // *after* the opening hand is drawn and mulliganed (`packages/engine/src/flow.ts`'s own docblock on
    // `executePlayerSetupAbilities`), so a random shuffle can legitimately deal Intangible into the opening hand
    // before this setup effect ever runs — unlike a "search for X and add to hand" ability (Captain America's
    // Shield, 03001b; Star-Lord's Element Gun, 17001b), which only needs deck/discard because the point is moot if
    // the card is already in hand, "put [it] into play" is not moot, so it must find the card wherever it is.
    selectCards("mass", zone(["deck", "hand"], you, { filter: query("upgrade", { name: "Intangible" }) })),
    putIntoPlay(chosen("mass"), you),
    // `putIntoPlay` alone leaves an ownerless upgrade sitting in the play area unattached
    // (`packages/engine/src/resolve/apply-effect.ts`'s own `case "putIntoPlay"` never infers a host from
    // `attachesTo`); Intangible's own "Reduce the amount of damage Vision takes …" reads `{ hostOfSelf: true }`
    // (`26002.intangible-constant-2`), so it must actually be attached, the same as any other identity upgrade.
    attachCard(chosen("mass"), yourIdentity),
    shuffleDeck(),
  ),

  // Intangible (upgrade, 26002) — Mass form. Permanent. Vision cannot attack or defend (§3.31). Reduce the amount
  // of damage Vision takes from each attack by 2.
  "26002.intangible-constant": constant(
    rule({ kind: "cannotAttack", attacker: { hostOfSelf: true }, target: query("enemy") }),
    rule({ kind: "cannotDefend", target: { hostOfSelf: true } }),
  ),
  "26002.intangible-constant-2": constant(
    rule({ kind: "reduceDamageTaken", target: { hostOfSelf: true }, amount: 2, fromAttack: true }),
  ),

  // Dense (26002's flip side) — Mass form. Permanent. While in hero form, Vision gets +2 ATK and +2 DEF. Response:
  // After you change to this mass form, draw 1 card.
  "26002b.dense-constant": constant(
    gets("atk", 2, YOUR_IDENTITY, { while: isHero() }),
    gets("def", 2, YOUR_IDENTITY, { while: isHero() }),
  ),
  "26002b.dense-response": response(on.youChangeToThisForm(), draw(1)),

  // Vivian (ally, 26003) — While you are in Intangible mass form, Vivian gets +2 THW. While you are in Dense mass
  // form, Vivian gets +2 ATK.
  "26003.vivian-constant": constant(
    gets("thw", 2, query("ally", { self: true }), { while: inAdditionalForm("mass", "Intangible") }),
  ),
  "26003.vivian-constant-2": constant(
    gets("atk", 2, query("ally", { self: true }), { while: inAdditionalForm("mass", "Dense") }),
  ),

  // 616 Hickory Branch Lane (support, 26004) — Alter-Ego Action: Exhaust this card → search your deck and discard
  // pile for an Android ally and add it to your hand. (Shuffle.)
  "26004.616-hickory-branch-lane-action": alterEgoAction(
    { cost: exhaustThis },
    chooseCards("found", zone(["deck", "discard"], you, { filter: query("ally", { trait: ANDROID }) }), {
      min: 0,
      max: 1,
    }),
    moveCards(cards(chosen("found")), "hand"),
    shuffleDeck(),
  ),

  // Solar Gem (upgrade, 26005) — Vision gains the Aerial trait. Resource: Exhaust Solar Gem → generate a [wild]
  // resource.
  "26005.solar-gem-constant": constant(gainsTrait(trait("AERIAL"), YOUR_IDENTITY)),
  "26005.solar-gem-resource": resource({ wild: 1 }, { cost: exhaustThis }),

  // Vision's Cape (upgrade, 26006) — While you are in Dense mass form, you gain retaliate 1. While you are in
  // Intangible mass form, you gain stalwart.
  "26006.visions-cape-constant": constant(
    gainsKeyword({ name: "retaliate", value: 1 }, YOUR_IDENTITY, { while: inAdditionalForm("mass", "Dense") }),
  ),
  "26006.visions-cape-constant-2": constant(
    gainsKeyword({ name: "stalwart" }, YOUR_IDENTITY, { while: inAdditionalForm("mass", "Intangible") }),
  ),

  // Density Control (upgrade, 26007) — Hero Response: After you change mass form, discard this card → add a
  // Vision event from your discard pile to your hand.
  "26007.density-control-response": heroResponse(
    on.youChangeAdditionalForm("mass"),
    { cost: discardThis },
    chooseCards("found", zone("discard", you, { filter: query("event", ofIdentitySetTitled("Vision")) }), {
      min: 0,
      max: 1,
    }),
    moveCards(cards(chosen("found")), "hand"),
  ),

  // Solar Beam (event, 26008) — Hero Action (attack): If Vision is in Dense mass form, deal 7 damage to an enemy.
  // Hero Action (thwart): If Vision is in Intangible mass form, remove 5 threat from a scheme.
  "26008.solar-beam-action": heroAction(
    { label: "attack" },
    ifThen(inAdditionalForm("mass", "Dense"), attackAnEnemy(7)),
  ),
  "26008.solar-beam-hero-action": heroAction(
    { label: "thwart" },
    ifThen(inAdditionalForm("mass", "Intangible"), thwartAScheme(5)),
  ),

  // Superdense Strike (event, 26009) — Play only if Vision is in Dense mass form. Hero Action (attack): Deal 5
  // damage to an enemy. This attack gains piercing.
  "26009.superdense-strike-constant": constant(playOnlyIf(inAdditionalForm("mass", "Dense"))),
  "26009.superdense-strike-action": heroAction(
    { label: "attack" },
    anAttackableEnemy("enemy"),
    attack(5, chosen("enemy"), { keywords: ["piercing"] }),
  ),

  // Just Passing Through (event, 26010) — Play only if Vision is in Intangible mass form. Hero Action (thwart):
  // Remove 3 threat from a scheme, ignoring the patrol keyword and the crisis icon.
  "26010.just-passing-through-constant": constant(playOnlyIf(inAdditionalForm("mass", "Intangible"))),
  // "…, ignoring the patrol keyword and the crisis icon": this thwart only (docs/phase7-wave4.md §3.32).
  "26010.just-passing-through-action": heroAction(
    { label: "thwart" },
    aScheme("scheme"),
    thwart(3, chosen("scheme"), { ignorePatrol: true, ignoreCrisis: true }),
  ),

  // Phase Disruption (event, 26011) — Play only if Vision is in Intangible mass form. Hero Action: Confuse an
  // enemy. Choose an attachment on that enemy with the text "Hero Action" or "Hero Response" and discard that
  // attachment.
  "26011.phase-disruption-constant": constant(playOnlyIf(inAdditionalForm("mass", "Intangible"))),
  // "…with the text 'Hero Action' or 'Hero Response'" reads the attachment's own abilities (`TargetQuery.abilityTiming`,
  // docs/phase7-wave4.md §3.33). No such attachment: nothing to choose, and the confuse still happens.
  "26011.phase-disruption-action": heroAction(
    anEnemy("enemy"),
    confuse(chosen("enemy")),
    chooseTarget(
      "attachment",
      query("attachment", { host: chosen("enemy"), abilityTiming: ["heroAction", "heroResponse"] }),
    ),
    discard(chosen("attachment")),
  ),

  // Mass Increase (event, 26012) — Play only if Vision is in Dense mass form. Hero Interrupt (defense): When
  // Vision defends, prevent all damage from that attack. Stun the attacking enemy after that attack resolves. The
  // same "prevent all damage from this attack, stun after the attack resolves" shape as Mockingbird (`trors`
  // 04004) and Never Back Down (`qsv` 14014): `modifyAttack({ preventAllDamage: true })` rides the attack's own
  // event frame from wherever it's set (here, the "defended" interrupt point, still before the damage step) through
  // to the eventual damage step; `atEndOfAttack(stun(eventSource))` reads the "defended" event's own source (the
  // attacking enemy, `packages/engine/src/trigger-events.ts`'s `eventSubjects` case "defended") after the attack's
  // results are known, the same deferral Never Back Down's own stun already uses.
  "26012.mass-increase-constant": constant(playOnlyIf(inAdditionalForm("mass", "Dense"))),
  "26012.mass-increase-interrupt": heroInterrupt(
    on.defends(YOUR_IDENTITY),
    { label: "defense" },
    modifyAttack({ preventAllDamage: true }),
    atEndOfAttack(stun(eventSource)),
  ),
});
