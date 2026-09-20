import {
  action,
  alterEgoAction,
  atEndOfAttack,
  attack,
  cancelWhenRevealed,
  chooseTarget,
  chosen,
  dealDamage,
  defineAbilities,
  discard,
  discardEncounterCards,
  discardFromHand,
  draw,
  enemyAttack,
  enemyScheme,
  eventSource,
  heal,
  heroAction,
  heroInterrupt,
  ifThen,
  modifyStat,
  on,
  oncePerRound,
  paidWith,
  query,
  ready,
  response,
  scaled,
  self,
  statOf,
  theMainScheme,
  theVillain,
  thwart,
  varOf,
  villainStageNumberOf,
  you,
  yourIdentity,
} from "../../dsl/index.js";

/**
 * The `scw` pack's non-hero-specific player cards (docs/phase7-wave1-scripting.md §1's convention): Justice
 * (15010–15015, her own precon aspect — Speed, Wiccan, Crisis Averted, Multitasking, Swift Retribution, Turn the
 * Tide), Basic (15018, 15019, 15031), Aggression (15028), Leadership (15029), Protection (15030). The Power of
 * Justice (15016), Heroic Intuition (15017), and the three basic resources (15020–15022) are verbatim Core/wave 1
 * reprints, aliased by `../reprints.ts` (confirmed against a throwaway `wave2ReprintPairs()` dump before writing
 * this file, per docs/phase7-wave2-scripting.md §3 — never assumed from the name alone), so they are not scripted
 * here; defining their ability ids in this module would throw `mergeRegistries`' "defined twice".
 *
 * **Order and Chaos (15018)** prints the identical text (down to the FAQ-settled internal reading it needs none
 * of) as the `qsv` pack's own 14018 — a genuine same-name/same-type/same-text duplicate, but `reprints.ts` only
 * aliases a wave 2 card against the wave 1/Core pool (`WAVE2_CARDS` vs `WAVE1_CARDS`), never one wave 2 pack
 * against another (`reprints.ts`'s own docblock), so this is hand-scripted here rather than aliased, identically
 * to `qsv/pack-cards.ts`'s own `14018.order-and-chaos-interrupt`.
 *
 * **Turn the Tide (15015)** — "Response (attack): After your hero thwarts and removes all threat from a scheme,
 * deal 3 damage to an enemy" reads as "your hero defeats a scheme by thwarting it": a scheme is only ever defeated
 * by its threat reaching 0 through a removal (RRG 1.8 "Side Scheme", p. 39), and `schemeDefeated.sourceInstanceId`
 * (§17.2, docs/phase7-wave2.md) already carries whichever character's thwart removed the last threat — basic or
 * "(thwart)"-labeled alike, both read `applyPlayerThwart`'s own `sourceInstanceId: event.thwarterInstanceId`
 * (`packages/engine/src/resolve/event.ts`). A raw `EventPattern` (`{ on: "schemeDefeated", sourceIs: { categories:
 * ["identity"], controller: "you" } }`) says exactly that, the scheme-only sibling of `on.defeats(source)`'s own
 * `["characterDefeated", "schemeDefeated"]` pair (§17.2) — Turn the Tide only ever cares about the scheme half, so
 * the narrower literal avoids also firing on an unrelated attack that defeats a minion.
 *
 * **Browbeat (15028)** — "Deal 2 damage … Deal X additional damage … (to a maximum of 3)" is one combined `attack`
 * (the same "one attack event for the base plus the bonus" reading Repulsor Blast, 01031, Core, and this pack's own
 * Molecular Decay, `kit.ts`, already use) with the cap applied to the bonus alone before the base is added:
 * `scaled(scaled(villainStageNumberOf(), { max: 3 }), { plus: 2 })` — `scaled`'s own `max` clamps *after* `plus`
 * (`packages/engine/src/select.ts`'s `"scaled"` case), so capping the whole expression at 3 would be wrong; nesting
 * two `scaled` calls caps only the inner "X" term.
 *
 * **Off-aspect cards, `toBeDefined()`-only** (`pack-cards.test.ts`'s own docblock explains why, following `qsv/
 * pack-cards.test.ts`'s precedent for the identical situation): Browbeat (Aggression), Last Stand (Leadership),
 * Bait and Switch (Protection) are unreachable from Scarlet Witch's own single-aspect Justice precon.
 */
export const SCW_PACK_CARDS = defineAbilities({
  // Speed (15010, Justice ally) — Response: After Speed thwarts, ready him. (Limit once per round.)
  "15010.speed-response": response(on.thwarts("self"), { limit: oncePerRound }, ready(self)),

  // Wiccan (15011, Justice ally) — Response: After Wiccan thwarts, discard the top card of the encounter deck.
  // For each boost icon discarded this way, deal 1 damage to an enemy.
  "15011.wiccan-response": response(
    on.thwarts("self"),
    discardEncounterCards(1, { bind: "d" }),
    chooseTarget("enemy", query("enemy")),
    dealDamage(varOf("d.boostIcons"), chosen("enemy")),
  ),

  // Crisis Averted (15012, Justice event) — Hero Action (thwart): Remove 6 threat from the main scheme. If you
  // paid for this card using a [mental] resource, this thwart ignores the crisis icon.
  "15012.crisis-averted-action": heroAction(
    { label: "thwart" },
    ifThen(paidWith("mental"), thwart(6, theMainScheme, { ignoreCrisis: true }), thwart(6, theMainScheme)),
  ),

  // Multitasking (15013, Justice event) — Hero Action (thwart): Remove 2 threat from a scheme. If you paid for
  // this card using a [mental] resource, remove 2 threat from a different scheme.
  "15013.multitasking-action": heroAction(
    { label: "thwart" },
    chooseTarget("scheme", query("scheme")),
    thwart(2, chosen("scheme")),
    ifThen(paidWith("mental"), [
      chooseTarget("scheme2", query("scheme", { excludeSlots: ["scheme"] })),
      thwart(2, chosen("scheme2")),
    ]),
  ),

  // Swift Retribution (15014, Justice event) — Hero Action (attack): The villain schemes. Deal 4 damage to the
  // villain.
  "15014.swift-retribution-action": heroAction({ label: "attack" }, enemyScheme(theVillain), attack(4, theVillain)),

  // Turn the Tide (15015, Justice event) — Response (attack): After your hero thwarts and removes all threat from
  // a scheme, deal 3 damage to an enemy (module docblock).
  "15015.turn-the-tide-response": response(
    { on: "schemeDefeated", sourceIs: { categories: ["identity"], controller: "you" } },
    { label: "attack" },
    chooseTarget("enemy", query("enemy")),
    dealDamage(3, chosen("enemy")),
  ),

  // Order and Chaos (15018, Basic event) — Team-Up (Quicksilver and Scarlet Witch), Max 1 per deck (data). Hero
  // Interrupt: when a treachery card is revealed from the encounter deck, cancel its "When Revealed" effects, then
  // deal 2 damage to the villain (module docblock: identical text to `qsv`'s own 14018).
  "15018.order-and-chaos-interrupt": heroInterrupt(on.encounterCardRevealed(query("treachery")), cancelWhenRevealed(), dealDamage(2, theVillain)),

  // Spiritual Meditation (15019, Basic event) — Play only if your identity has the Mystic trait (data). Action:
  // Draw 2 cards. Choose and discard 1 card from your hand.
  "15019.spiritual-meditation-action": action(draw(2), discardFromHand(1)),

  // Browbeat (15028, Aggression event) — Play only if your identity has the Avenger trait (data). Hero Action
  // (attack): Deal 2 damage to the villain. Deal X additional damage (max 3), where X is the villain's stage
  // number (module docblock).
  "15028.browbeat-action": heroAction(
    { label: "attack" },
    attack(scaled(scaled(villainStageNumberOf(), { max: 3 }), { plus: 2 }), theVillain),
  ),

  // Last Stand (15029, Leadership event) — Hero Interrupt: When an ally you control attacks, it gets +3 ATK for
  // that attack. After that attack resolves, discard that ally.
  "15029.last-stand-interrupt": heroInterrupt(
    on.attacks({ categories: ["ally"], controller: "you" }),
    modifyStat("atk", 3, eventSource, "endOfAttack"),
    atEndOfAttack(discard(eventSource)),
  ),

  // Bait and Switch (15030, Protection event) — Hero Action (thwart): The villain attacks you. Remove 4 threat
  // from the main scheme.
  "15030.bait-and-switch-action": heroAction({ label: "thwart" }, enemyAttack(theVillain, { against: you }), thwart(4, theMainScheme)),

  // Recuperation (15031, Basic event) — Alter-Ego Action: Heal damage from your alter-ego equal to your REC.
  "15031.recuperation-action": alterEgoAction(heal(statOf(yourIdentity, "rec"), yourIdentity)),
});
