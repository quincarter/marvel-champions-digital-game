import {
  after,
  attacksGainKeywords,
  constant,
  defineAbilities,
  discard,
  discardCardsCost,
  discardRandomFromHandCost,
  enemyAttack,
  exhaustCardsCost,
  forcedResponse,
  gainsKeyword,
  giveBoostCardsCost,
  giveStatusCost,
  heroAction,
  ifThen,
  not,
  placeThreat,
  query,
  rule,
  self,
  spend,
  takeIndirectDamageCost,
  theMainScheme,
  theVillain,
  varAtLeast,
  you,
} from "../../../dsl/index.js";

/**
 * Osborn Tech (`sm` 27147–27152, docs/phase7-wave5.md §2.2/§3.31): the Sinister Motives villain-attachment modular
 * set — Arm Cannon, Ionic Boots, Kinetic Armor, Neocarbon Scales, Spiked Gauntlet, Tracking Display. Every card's
 * printed `[star]` marker is a reminder icon with no gameplay meaning (confirmed by the curation notes for the same
 * marker on other packs, e.g. `packages/content/scripts/marvelcdb/curation/core.ts` "The [star] is a reminder
 * icon.") — the constant/Forced Response text on these cards is unconditional, not gated by anything the star could
 * mean. "Attach to the villain" (`attachesTo: { kind: "villain" }`) is data, resolved by the engine's own reveal
 * step, not scripted here.
 *
 * Every card's "Hero Action: … → discard this card" pays the part before the arrow as a real `AbilityCost`, so the
 * action is offered only while that cost can be paid in full and the cost is paid before (and apart from) the effect
 * (RRG 1.8 "Cost", pp. 13–14; "Cost Arrow Icon", p. 14): Arm Cannon's "discard the highest-cost upgrade you control"
 * is `discardCardsCost(…, { superlative: "highest" })`, Kinetic Armor's "take 3 indirect damage" is
 * `takeIndirectDamageCost(3)`, Neocarbon Scales' "give the villain a tough status card and 1 facedown boost card" is
 * `giveStatusCost` plus `giveBoostCardsCost`.
 */
export const OSBORN_TECH = defineAbilities({
  // Arm Cannon (27147, attachment to the villain; Surge/TECH/WEAPON are data) — Attached villain's attacks gain
  // overkill and piercing.
  "27147.arm-cannon-constant": constant(
    attacksGainKeywords(["overkill", "piercing"], { attacker: query("villain", { hostOfSelf: true }) }),
  ),
  // Arm Cannon — Hero Action: Discard the highest-cost upgrade you control → discard this card. Only an upgrade tied
  // for the highest printed cost among those you control can pay; a tie is the paying player's pick (costs are paid
  // by the player using the ability, RRG 1.8 "Cost", p. 14), named in `costChoices.discarded`. With no upgrade the
  // cost can't be paid and the action isn't offered.
  "27147.arm-cannon-action": heroAction(
    { cost: discardCardsCost(query("upgrade"), { superlative: "highest" }) },
    discard(self),
  ),

  // Ionic Boots (27148, attachment to the villain; Surge/ITEM/TECH are data) — Forced Response: After attached
  // villain attacks and damages your identity, place 2 threat on the main scheme (`after.enemyAttacks("host", …)`,
  // the same shape Bulldozer's Helmet, `twc` 07049, uses for its own "attach to the villain"/"after [host] attacks
  // you" pair).
  "27148.ionic-boots-forced-response": forcedResponse(
    after.enemyAttacks("host", { againstYou: true, damages: true }),
    placeThreat(2, theMainScheme),
  ),
  // Ionic Boots — Hero Action: Spend [energy][mental][physical] resources → discard this card (`we-are-one`'s own
  // precedent, `wave5/sm/venom-goblin/encounter-set.ts` 27120, and Improvised Weapons, `wave5/sm/venom/
  // symbiotic-strength.ts` 27164 — the same printed resource line on other Osborn Tech-adjacent attachments).
  "27148.ionic-boots-action": heroAction({ cost: spend({ energy: 1, mental: 1, physical: 1 }) }, discard(self)),

  // Kinetic Armor (27149, attachment to the villain; Surge/ARMOR/TECH are data) — Attached villain gains retaliate 1.
  "27149.kinetic-armor-constant": constant(
    gainsKeyword({ name: "retaliate", value: 1 }, query("villain", { hostOfSelf: true })),
  ),
  // Kinetic Armor — Hero Action: Take 3 indirect damage → discard this card. The damage is divided among your
  // characters before the effect; the action is offered only while they can take all 3 (a character with a tough
  // status card can't pay it), and if any of it is prevented the cost wasn't paid and this card stays
  // (`AbilityCost.indirectDamage`).
  "27149.kinetic-armor-action": heroAction({ cost: takeIndirectDamageCost(3) }, discard(self)),

  // Neocarbon Scales (27150, attachment to the villain; Surge/ARMOR/TECH are data) — Reduce the amount of damage
  // attached villain takes from each attack by 1 (`RuleSpec reduceDamageTaken`, `dsl/abilities.ts`'s own doc comment
  // above `increaseDamageTaken`; docs/phase7-wave3.md §3.15).
  "27150.neocarbon-scales-constant": constant(
    rule({ kind: "reduceDamageTaken", target: query("villain", { hostOfSelf: true }), amount: 1, fromAttack: true }),
  ),
  // Neocarbon Scales — Hero Action: Give the villain a tough status card and 1 facedown boost card → discard this
  // card. A villain that already has a tough status card can't be given another (RRG 1.8 "Status Cards", p. 41), so
  // the cost can't be paid in full and the action isn't offered then (with Venom, whose Toughness gives him one, only
  // once it is gone).
  "27150.neocarbon-scales-action": heroAction(
    { cost: [giveStatusCost(theVillain, "tough"), giveBoostCardsCost(theVillain, 1)] },
    discard(self),
  ),

  // Spiked Gauntlet (27151, attachment to the villain; Surge/TECH/WEAPON, +1 ATK are data) — Hero Action: The
  // villain attacks you. After that attack ends, if your identity took no damage from that attack, discard this
  // card. `enemyAttack`'s own `bind` reports that attack's damage to var `<bind>.damage`, read once the attack has
  // resolved by the next effect in this same list (Klaw's Vengeance, `01122.when-revealed-hero`'s own "If this
  // attack deals damage, place 1 threat on the main scheme" precedent for the same bind-then-read shape) —
  // `atEndOfAttack` is for a response *to* an attack event still in progress (Sandman's own "Sand Blast"/"Sand
  // Wave", `wave5/sm/sandman/villain.ts`), not for effects sequenced after an attack this same ability initiated,
  // which has already fully resolved (including its own response window) by the time the next effect runs.
  "27151.spiked-gauntlet-action": heroAction(
    enemyAttack(theVillain, { against: you, bind: "gauntlet" }),
    ifThen(not(varAtLeast("gauntlet.damage")), discard(self)),
  ),

  // Tracking Display (27152, attachment to the villain; Surge/ITEM/TECH are data) — Each character cannot defend
  // against attached villain's attacks (`RuleSpec cannotDefend`, its own printed worked example,
  // `packages/engine/src/abilities.ts`'s doc comment naming this exact card).
  "27152.tracking-display-constant": constant(
    rule({ kind: "cannotDefend", target: query("character"), attacker: query("villain", { hostOfSelf: true }) }),
  ),
  // Tracking Display — Hero Action: Exhaust a character you control and discard 1 random card from your hand →
  // discard this card.
  "27152.tracking-display-action": heroAction(
    { cost: [exhaustCardsCost(query("character", { controller: "you" })), discardRandomFromHandCost(1)] },
    discard(self),
  ),
});
