import { trait } from "@mc/content";
import {
  alterEgoAction,
  attack,
  attackInProgress,
  cards,
  chooseCards,
  chooseTarget,
  chosen,
  constant,
  declareDefender,
  defineAbilities,
  discardThis,
  draw,
  encounterCards,
  eventSource,
  exhaustThis,
  forcedInterrupt,
  gainsTrait,
  gets,
  heal,
  heroAction,
  heroInterrupt,
  ifElse,
  ifThen,
  modifyStat,
  moveCards,
  named,
  on,
  playSetAside,
  putIntoPlay,
  query,
  ready,
  refMatches,
  removeThreatFromAScheme,
  response,
  selectCards,
  self,
  setup,
  topOfDeck,
  yourIdentity,
  you,
  zone,
} from "../../dsl/index.js";

/** "…the enemy with Death-Glow attached" (Valhalla, Valkyrie's Spear, Dragonfang, Flight of the Valkyrior,
 * Shieldmaiden): an enemy carrying the (unique, deckLimit 1) Death-Glow upgrade. */
const WITH_GLOW = query("enemy", { hasAttachment: { name: "Death-Glow" } });
/** Valkyrie's own identity, whoever controls it (the "Gamora"/"Nebula" identity-query precedent, `wave3/gam/
 * gamora-obligation-nemesis.ts`, `wave4/nebu/nebula-obligation-nemesis.ts`): matches whichever face is up, and only
 * her own hero — not the separately titled Valkyrie ally (ruling Jan 26, 2026 (4) #7). */
const YOUR_IDENTITY = query("identity", { controller: "you" });

/**
 * Valkyrie / Brunnhilde (25001a/b) and her signature kit (25002–25012, docs/phase7-wave4.md §3.22, §2.1). Death-Glow
 * is her own set-aside upgrade: set aside at setup (25001b's Setup), played from there like a hand card (Death
 * Perception, 25001a), and — once attached to an enemy — set aside again the moment that enemy is defeated, readying
 * Valkyrie only if *she* (an "extension" of her own identity, RRG 1.8 "You, Your" p. 49, `TargetQuery.extensionOf`)
 * defeated it.
 */
export const VALKYRIE_KIT = defineAbilities({
  // Valkyrie (hero, 25001a) — Death Perception, Hero Action: Play the set-aside Death-Glow upgrade as if it were in
  // your hand.
  "25001a.death-perception": heroAction(playSetAside(query("upgrade", { name: "Death-Glow" }))),

  // Brunnhilde (alter-ego, 25001b) — Setup: Set the Death Glow upgrade aside, out of play. Setup resolves *after*
  // the opening draw and mulligan (RRG 1.8 Appendix II step 16; the Captain America's Shield precedent, `wave1/cap/
  // kit.ts`'s own docblock), so Death-Glow (a deckLimit-1 upgrade) may already be in the opening hand, not only the
  // deck — both zones are searched, the `zone()` multi-zone shape that precedent established.
  "25001b.setup": setup(
    moveCards(zone(["deck", "hand"], you, { filter: query("upgrade", { name: "Death-Glow" }) }), "setAside"),
  ),
  // "Not this Day." — Action: Detach Death-Glow and set it aside, out of play. `named` finds the in-play card of
  // that title (it is only ever in play attached, given her Setup and the interrupt below): moving it straight to
  // her set-aside area both detaches it (an attachment leaving play is unattached first) and satisfies "out of
  // play" in one step.
  "25001b.not-this-day": alterEgoAction(moveCards(cards(named("Death-Glow")), "setAside")),

  // Death-Glow (upgrade, 25002) — Attach to an enemy (data). Forced Interrupt: When attached enemy is defeated, set
  // this card aside, out of play. If Valkyrie defeated that enemy, ready her.
  "25002.death-glow-forced-interrupt": forcedInterrupt(
    on.defeated("host"),
    moveCards(cards(self), "setAside"),
    ifThen(refMatches(eventSource, { extensionOf: you }, { anywhere: true }), ready(yourIdentity)),
  ),

  // Annabelle Riggs (ally, 25003) — Alter-Ego Action: Exhaust Annabelle Riggs → search the top 5 cards of your deck
  // for a Valkyrie card and add it to your hand. Shuffle the rest back into your deck. "A Valkyrie card" is her own
  // identity-specific set (RRG 1.8 "Identity-Specific Card", p. 23), `identitySetOf: you` — the `msm`/`drs` reading.
  "25003.annabelle-riggs-action": alterEgoAction(
    { cost: exhaustThis },
    selectCards("looked", topOfDeck(5)),
    chooseCards("found", cards(chosen("looked"), { identitySetOf: you }), { min: 0, max: 1 }),
    moveCards(cards(chosen("found")), "hand"),
    moveCards(cards(chosen("looked"), { excludeSlots: ["found"] }), "deckShuffle"),
  ),

  // Valhalla (support, 25004) — Response: After Valkyrie attacks and defeats the enemy that has Death-Glow attached,
  // exhaust Valhalla → draw 1 card and heal 1 damage from Valkyrie.
  "25004.valhalla-response": response(
    on.attacks(YOUR_IDENTITY, { target: WITH_GLOW, defeats: true }),
    { cost: exhaustThis },
    draw(1),
    heal(1, yourIdentity),
  ),

  // Valkyrie's Spear (upgrade, 25005) — Restricted (data). Valkyrie gets +1 DEF (+2 DEF instead while defending
  // against the enemy with Death Glow attached).
  "25005.valkyries-spear-constant": constant(
    gets("def", ifElse(attackInProgress({ attacker: WITH_GLOW, defender: YOUR_IDENTITY }), 2, 1), YOUR_IDENTITY),
  ),

  // Dragonfang (upgrade, 25006) — Restricted (data). Valkyrie gets +1 ATK (+2 ATK instead while attacking the enemy
  // with Death-Glow attached).
  "25006.dragonfang-constant": constant(
    gets("atk", ifElse(attackInProgress({ attacker: YOUR_IDENTITY, target: WITH_GLOW }), 2, 1), YOUR_IDENTITY),
  ),

  // Aragorn (upgrade, 25007, errata RRG 1.8 p. 67: "Valkyrie" → "You") — no printed `attachesTo`, so it attaches to
  // your identity by default (`packages/engine/src/actions.ts`'s own "no host, own identity" fallback): You get +4
  // hit points and gain the aerial trait.
  "25007.aragorn-constant": constant(gets("hp", 4, YOUR_IDENTITY), gainsTrait(trait("AERIAL"), YOUR_IDENTITY)),

  // Flight of the Valkyrior (upgrade x2, 25008) — Response: After the enemy with Death-Glow is defeated, discard
  // Flight of the Valkyrior → remove 5 threat from a scheme.
  "25008.flight-of-the-valkyrior-response": response(
    on.defeated(query("enemy"), { withAttachment: { name: "Death-Glow" } }),
    { cost: discardThis },
    ...removeThreatFromAScheme(5),
  ),

  // Visit Valhalla (event, 25009) — Alter-Ego Action: Return a Valkyrie card from your discard pile to your hand.
  "25009.visit-valhalla-action": alterEgoAction(
    chooseCards("returned", zone("discard", you, { filter: { identitySetOf: you } }), { min: 1, max: 1 }),
    moveCards(cards(chosen("returned")), "hand"),
  ),

  // Chooser of the Slain (event x2, 25010) — Hero Action: Search the encounter deck and discard pile for a minion
  // and put it into play engaged with you → draw 2 cards.
  "25010.chooser-of-the-slain-action": heroAction(
    chooseCards("minion", encounterCards(["deck", "discard"], query("minion")), { min: 1, max: 1 }),
    putIntoPlay(chosen("minion"), you),
    draw(2),
  ),

  // Shieldmaiden (event x2, 25011, errata RRG 1.8 p. 67: Defense trait and the "(defense)" label) — Hero Interrupt
  // (defense): When the enemy with Death-Glow attached attacks, declare Valkyrie the defender without exhausting
  // her. She gets +2 DEF for this attack.
  "25011.shieldmaiden-interrupt": heroInterrupt(
    on.enemyAttacks(WITH_GLOW),
    { label: "defense" },
    declareDefender(yourIdentity),
    modifyStat("def", 2, yourIdentity, "endOfAttack"),
  ),

  // Have at Thee! (event x3, 25012) — Hero Action(attack): Deal 7 damage to an enemy. If that enemy has Death-Glow
  // attached, this attack gains overkill.
  "25012.have-at-thee-constant": heroAction(
    { label: "attack" },
    chooseTarget("enemy", query("enemy")),
    ifThen(
      refMatches(chosen("enemy"), { hasAttachment: { name: "Death-Glow" } }),
      attack(7, chosen("enemy"), { overkill: true }),
      attack(7, chosen("enemy")),
    ),
  ),
});
