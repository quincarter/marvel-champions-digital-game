import { trait } from "@mc/content";
import { CAP_PACK_CARDS } from "../../wave1/cap/pack-cards.js";
import { ANT_PACK_CARDS } from "../../wave2/ant/pack-cards.js";
import { GHOST_SPIDER_SUPPORT_UPGRADES_ALLIES } from "../sm/ghost-spider/support-upgrades-allies.js";
import {
  addCounters,
  alterEgoAction,
  chosen,
  chooseTarget,
  constant,
  defineAbilities,
  discardThis,
  eventAmount,
  exhaustThis,
  gainsTrait,
  gainTraitUntil,
  gets,
  heroAction,
  heroInterrupt,
  host,
  interrupt,
  min,
  modifyAttack,
  modifyStat,
  on,
  preventDamage,
  query,
  ready,
  removeCounter,
  removeThreat,
  response,
  scaled,
  threatOn,
  yourIdentity,
  YOUR_IDENTITY,
} from "../../dsl/index.js";

const WEB_WARRIOR = trait("WEB-WARRIOR");

/**
 * Spider-Ham's own supports, upgrades and resources (`spiderham` 30008-30011, 30018-30019, 30022-30023, 30029; read
 * directly off `packages/content/src/data/spiderham/cards.ts`, no errata on RRG 1.8 pp. 67-68, confirmed against
 * each card's own scan, `assets/card-art/bundles/cards/<id>.png`). Toon counters live on the identity throughout
 * (`identity.ts`'s own `countersAsResource`/`addCounters` precedent, `events.ts`'s own `removeCounter(…, {
 * fromIdentity: true })` cost shape), matching every other toon-counter card in this box.
 *
 * **The Daily Beagle (support, 30008)**: "Alter-Ego Action: Exhaust The Daily Beagle → place 1 toon counter on
 * Peter Porker." Peter Porker is the alter-ego name printed on Spider-Ham's own identity (`identity.ts`'s module
 * docblock), i.e. `yourIdentity` — `alterEgoAction` (usable only in alter-ego form) with a plain `exhaustThis` cost.
 *
 * **Cartoon Physics (upgrade, 30009)**: "Interrupt: When your identity would take any amount of damage, discard
 * this card → wiggle your body and prevent all but 1 of that damage." "Wiggle your body" is flavor (no state
 * change). No existing primitive says "prevent all but N" directly (only "prevent N" — `preventDamage`,
 * `dsl/effects.ts`), so this reads as "prevent (that damage minus 1)" the same way `wave1/twc/thunderball.ts`'s own
 * "Remove all but 3 threat from this scheme" reads as `removeThreat(scaled(threatOn(self), { plus: -3 }), self)` —
 * `preventDamage(scaled(eventAmount, { plus: -1 }))` on `on.damage(YOUR_IDENTITY)`, `eventAmount` being "that
 * damage" (`dsl/values.ts`). Plain
 * `interrupt` (not `heroInterrupt`): the card is usable from either form ("your identity" is the printed subject,
 * not "your hero"), the same reading Great Responsibility's own "you take it as damage instead" gets — except that
 * one is explicitly "Hero Interrupt" in print and this one is not, so no form restriction here.
 *
 * **Huge Wooden Hammer (upgrade, 30010)**: no `attachesTo` in the schema (a `hero:30001a`-restricted signature card
 * that implicitly travels with its owning hero, Photon Blasters'/Propulsion Jets' own shape,
 * `wave5/ironheart/support-upgrades.ts` 29012/29013) rather than an explicit attach target — its effects read
 * `YOUR_IDENTITY`/`yourIdentity` directly, not `host`. "Spider-Ham gets +1 ATK." is
 * `constant(gets("atk", 1, YOUR_IDENTITY))`. "Hero Interrupt: When Spider-Ham makes a basic attack, exhaust Huge
 * Wooden Hammer and remove 1 toon counter from Spider-Ham → Spider-Ham gets +2 ATK for that attack. That attack
 * gains overkill." is `on.attacks(YOUR_IDENTITY, { basic: true })` with `modifyStat("atk", 2, yourIdentity,
 * "endOfAttack")` plus `modifyAttack({ overkill: true })` — **not** `modifyAttack({ atkBonus: 2, … })`: a player's
 * own attack (`applyPlayerAttack`, `packages/engine/src/resolve/event.ts`) reads its damage as `event.amount ??
 * profile.atk`, never folding in a `modifyAttack.atkBonus` var the way an *enemy* activation does
 * (`enemy-activation.ts`) — every existing `atkBonus` caller in this codebase (`wave1/twc/piledriver.ts`,
 * `wave2/toafk/kang.ts`, `wave4/mts/tower-defense.ts`, …) is an enemy's own attack, none a player's. The identical
 * printed text elsewhere (Skilled Strike, `drs` 09037; Hulk Smash, `hlk` 10003) already reads it this way —
 * `modifyStat`, which changes the identity's own ATK stat before `profile.atk` is read, is the correct primitive,
 * `overkill` granted the same `modifyAttack({ overkill: true })` way Hulk Smash's own docblock cites (the
 * 2026-09-15 `applyPlayerAttack` fix that made a player's own granted overkill spill correctly). Cost
 * `[exhaustThis, removeCounter("toon", 1, { fromIdentity: true })]`.
 *
 * **Organic Webbing (upgrade, 30011)**: the THW sibling of Huge Wooden Hammer, same no-`attachesTo` shape.
 * "Spider-Ham gets +1 THW." is `constant(gets("thw", 1, YOUR_IDENTITY))`. "Hero Action: Exhaust Organic Webbing and
 * remove 1 toon counter from Spider-Ham → ready Spider-Ham. He gains the Aerial trait until the end of the phase."
 * is `ready(yourIdentity)` then `gainTraitUntil(AERIAL, yourIdentity, "endOfPhase")` (the temporary-grant `EffectSpec`
 * sibling of the persistent `gainsTrait` `ConstantPart`, `dsl/effects.ts`), same cost shape as Huge Wooden Hammer.
 *
 * **Followed (upgrade, 30018)** reprints `cap` 03032 verbatim (identical printed text, same scan filename
 * `03032.png`) — aliased rather than re-scripted, `events.ts`'s own Great Responsibility/Making an Entrance/One Way
 * or Another precedent (`wave5/ironheart/allies.ts`'s Agent 13 shape).
 *
 * **Overwatch (upgrade, 30019)**: this box's own printing — no earlier card shares this exact text (checked every
 * `cards.ts` for the name). "Attach to a scheme. Max 1 per scheme." is schema-level `attachesTo`/`playRestrictions`
 * (already on the card record; no ability ref). "Hero Interrupt: When any amount of threat is removed from attached
 * scheme by a thwart, discard this card → remove an equal amount of threat from a different scheme." The trigger
 * reads the "thwart" `TriggerEvent`'s own target (the scheme thwarted, `packages/engine/src/trigger-events.ts`
 * `eventParticipants`'s `case "thwart"`) as the host: `{ on: "thwart", targetIs: { hostOfSelf: true } }`, the same
 * literal-`EventPattern` idiom `wave3/gmw/nebula.ts` 16093/`wave3/ron/kree-fanatic.ts` use for a host-scoped pattern
 * with no dedicated `on.*` wrapper (no `on.thwarts` variant targets the scheme rather than the thwarting
 * character). `eventAmount` reads the thwart's own removal amount — for a *basic* thwart as for a "(thwart)"
 * ability, `select.ts`'s own `thwartAmount` (the thwarter's THW/ATK before the thwart resolves, the threat actually
 * removed after) — same as Lady Spider's Response (`allies.ts` 30012). "A different scheme" excludes the attached
 * scheme itself via `TargetQuery.excluding: host` (Web of Life and Destiny/Lady Spider's own `excluding`
 * precedent, here excluding the host rather than an event target since host and event target are the same
 * scheme). The cost discards Overwatch before the effect resolves, so `host` reads the scheme it was attached to
 * when the interrupt was initiated (the engine's `SELF_HOST` binding, `packages/engine/src/select.ts`; RRG 1.8
 * "Initiating Abilities", p. 24). "An equal amount" is capped at the threat on the attached scheme
 * (`min(eventAmount, threatOn(host))`, read while the interrupt resolves, before the thwart removes any): only that
 * much "is removed", so THW 2 against 1 threat moves 1 (decided by the main session, 2026-09-28).
 *
 * **Team-Building Exercise (support, 30022)** reprints `ant` 12024 verbatim (identical printed text, same scan
 * filename `12024.png`) — aliased the same way as Followed above.
 *
 * **Web of Life and Destiny (support, 30023)** reprints `sm` 27023 verbatim (identical printed text, cost, aspect,
 * traits and scan filename `27023.png`, already scripted for Ghost-Spider's own kit,
 * `wave5/sm/ghost-spider/support-upgrades-allies.ts`) — aliased the same way.
 *
 * **Warrior of the Great Web (upgrade, 30029)**: a `basic`-aspect player upgrade, not part of the pack's Inheritors
 * modular set (`identity.ts`'s module docblock already notes this). "Attach to a character with 'Spider' in its
 * title. Max 1 per character." is schema-level `attachesTo: { kind: "qualified", category: "character",
 * titleContains: "Spider" }` (`packages/content/src/schema/cards/attachment-host.ts`'s own `titleContains` case,
 * built and engine-tested for this exact card, `packages/engine/src/attachment-hosts.test.ts`) — no ability ref for
 * the attach restriction itself. "Attached character gains the Web-Warrior trait." is
 * `constant(gainsTrait(WEB_WARRIOR, { hostOfSelf: true }))`, Cloak of Levitation's own shape (`wave1/drs/kit.ts`
 * 09009) for a persistent trait grant onto the attached character. "Response: After a Web-Warrior ally leaves play,
 * attached character gets +1 ATK until the end of the phase." reuses Web of Life and Destiny's own trigger
 * (`on.leavesPlay(query("ally", { trait: WEB_WARRIOR }))`) with `modifyStat("atk", 1, host, "endOfPhase")` — `host`
 * (`dsl/values.ts`'s bare `TargetRef`) rather than `hostOfSelf` (a query-only qualifier) since `modifyStat` takes a
 * `TargetRef`. Its usual trigger is an ally defeated by a villain attack, so the +1 ATK lasts until the end of that
 * villain phase (RRG 1.8 "Lasting Effects", p. 26) and is gone by the next hero phase.
 */
export const SPIDERHAM_SUPPORT_UPGRADES = defineAbilities({
  "30008.the-daily-beagle-action": alterEgoAction({ cost: exhaustThis }, addCounters("toon", 1, yourIdentity)),

  "30009.cartoon-physics-interrupt": interrupt(
    on.damage(YOUR_IDENTITY),
    { cost: discardThis },
    preventDamage(scaled(eventAmount, { plus: -1 })),
  ),

  "30010.huge-wooden-hammer-constant": constant(gets("atk", 1, YOUR_IDENTITY)),
  "30010.huge-wooden-hammer-interrupt": heroInterrupt(
    on.attacks(YOUR_IDENTITY, { basic: true }),
    { cost: [exhaustThis, removeCounter("toon", 1, { fromIdentity: true })] },
    modifyStat("atk", 2, yourIdentity, "endOfAttack"),
    modifyAttack({ overkill: true }),
  ),

  "30011.organic-webbing-constant": constant(gets("thw", 1, YOUR_IDENTITY)),
  "30011.organic-webbing-action": heroAction(
    { cost: [exhaustThis, removeCounter("toon", 1, { fromIdentity: true })] },
    ready(yourIdentity),
    gainTraitUntil(trait("AERIAL"), yourIdentity, "endOfPhase"),
  ),

  "30018.followed-constant": CAP_PACK_CARDS["03032.followed-constant"]!,
  "30018.followed-interrupt": CAP_PACK_CARDS["03032.followed-interrupt"]!,

  "30019.overwatch-constant": constant(),
  "30019.overwatch-interrupt": heroInterrupt(
    { on: "thwart", targetIs: { hostOfSelf: true } },
    { cost: discardThis },
    chooseTarget("scheme", query("scheme", { excluding: host })),
    removeThreat(min(eventAmount, threatOn(host)), chosen("scheme")),
  ),

  "30022.team-building-exercise-action": ANT_PACK_CARDS["12024.team-building-exercise-action"]!,

  "30023.web-of-life-and-destiny-constant":
    GHOST_SPIDER_SUPPORT_UPGRADES_ALLIES["27023.web-of-life-and-destiny-constant"]!,
  "30023.web-of-life-and-destiny-response":
    GHOST_SPIDER_SUPPORT_UPGRADES_ALLIES["27023.web-of-life-and-destiny-response"]!,

  "30029.warrior-of-the-great-web-constant": constant(gainsTrait(WEB_WARRIOR, { hostOfSelf: true })),
  "30029.warrior-of-the-great-web-response": response(
    on.leavesPlay(query("ally", { trait: WEB_WARRIOR })),
    modifyStat("atk", 1, host, "endOfPhase"),
  ),
});
