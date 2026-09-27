import {
  after,
  attacksGainKeywords,
  bindTargets,
  chooseTarget,
  chosen,
  constant,
  dealIndirectDamage,
  defineAbilities,
  discard,
  discardRandomFromHandCost,
  each,
  enemyAttack,
  exhaustCardsCost,
  exists,
  forcedResponse,
  gainsKeyword,
  giveBoostCard,
  giveTough,
  heroAction,
  ifThen,
  not,
  placeThreat,
  printedCostOf,
  query,
  rule,
  self,
  spend,
  superlative,
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
 * Every card's own "Hero Action: … → discard this card" is two ordered effects rather than a formal `AbilityCost`
 * plus effect for Arm Cannon, Kinetic Armor and Neocarbon Scales: the DSL's `AbilityCost` vocabulary (`spend`,
 * `discardCardsCost`, `exhaustCardsCost`, `discardRandomFromHandCost`, …) has resource/pick-by-query/random-discard
 * costs, all used as real costs below for Ionic Boots and Tracking Display, but nothing for "discard the
 * highest-cost upgrade you control" (a dynamic superlative selection — `TargetQuery` has no "is the max among this
 * group" filter, only `maxPrintedCost` against a fixed/computed threshold), "take 3 indirect damage" (a cost
 * `AbilityCost` only knows as `damageSelf`, which is direct damage to the identity specifically, not the RRG 1.8
 * "Indirect Damage" (p. 24) assignment-among-your-characters `dealIndirectDamage` already gives it as an effect), or
 * "give the villain a tough status card and 1 facedown boost card" (an in-play effect, not a resource/card
 * payment). All three are instead scripted as ordered `effects` on the action — Arm Cannon gated by
 * `while: exists(...)` so the action isn't offered without a valid discard target, matching a real cost's "must be
 * payable to initiate" (RRG 1.8 "Initiating Abilities", p. 24) — following the same
 * `bindTargets`+`superlative`+`chooseTarget`+`discard` shape `hood/standard-expert-ii.ts`'s own Overwhelming Force
 * (24052) uses for "discard the highest-cost upgrade or support you control" as a When Revealed effect. Reported as
 * a DSL gap rather than hacked further: `superlativeDiscardCost`/`indirectDamageCost`/`giveCardsCost`-shaped
 * `AbilityCost` additions would let these read as true costs instead.
 */
export const OSBORN_TECH = defineAbilities({
  // Arm Cannon (27147, attachment to the villain; Surge/TECH/WEAPON are data) — Attached villain's attacks gain
  // overkill and piercing.
  "27147.arm-cannon-constant": constant(
    attacksGainKeywords(["overkill", "piercing"], { attacker: query("villain", { hostOfSelf: true }) }),
  ),
  // Arm Cannon — Hero Action: Discard the highest-cost upgrade you control → discard this card. See the module
  // docblock above for why this is ordered effects rather than a formal cost. A tie is the acting player's own
  // choice (RRG 1.8 "Choose (Option)", p. 12: the player who owns/uses the ability breaks its own ties absent a
  // printed rule otherwise; unlike an encounter card's own "the first player" default).
  "27147.arm-cannon-action": heroAction(
    { while: exists(query("upgrade", { controller: "you" })) },
    bindTargets(
      "highest",
      superlative("highest", each(query("upgrade", { controller: "you" })), printedCostOf(chosen("candidate"))),
    ),
    chooseTarget("pick", { inSlot: "highest" }),
    discard(chosen("pick")),
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
  // Kinetic Armor — Hero Action: Take 3 indirect damage → discard this card. See the module docblock: ordered
  // effects (`dealIndirectDamage` then `discard`), unconditionally, since the printed text has no "if you do".
  "27149.kinetic-armor-action": heroAction(dealIndirectDamage(you, 3), discard(self)),

  // Neocarbon Scales (27150, attachment to the villain; Surge/ARMOR/TECH are data) — Reduce the amount of damage
  // attached villain takes from each attack by 1 (`RuleSpec reduceDamageTaken`, `dsl/abilities.ts`'s own doc comment
  // above `increaseDamageTaken`; docs/phase7-wave3.md §3.15).
  "27150.neocarbon-scales-constant": constant(
    rule({ kind: "reduceDamageTaken", target: query("villain", { hostOfSelf: true }), amount: 1, fromAttack: true }),
  ),
  // Neocarbon Scales — Hero Action: Give the villain a tough status card and 1 facedown boost card → discard this
  // card. See the module docblock: ordered effects, since neither "give a tough status card" nor "give a boost
  // card" is a resource/card payment `AbilityCost` can express.
  "27150.neocarbon-scales-action": heroAction(giveTough(theVillain), giveBoostCard(theVillain, 1), discard(self)),

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
