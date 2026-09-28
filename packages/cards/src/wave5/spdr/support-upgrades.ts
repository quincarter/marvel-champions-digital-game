import { trait } from "@mc/content";
import { MSM_PACK_CARDS } from "../../wave1/msm/pack-cards.js";
import {
  changeForm,
  chooseTarget,
  chosen,
  constant,
  damageCardsCost,
  defineAbilities,
  discardFromHandCost,
  discardThis,
  draw,
  each,
  eventAmount,
  exhaust,
  exhaustCardsCost,
  exhaustThis,
  forcedInterrupt,
  gainsKeyword,
  giveTough,
  heroAction,
  heroInterrupt,
  heroResource,
  interrupt,
  min,
  countersOn,
  modifyStat,
  on,
  playOnlyIf,
  preventDamage,
  printedHpOf,
  query,
  ready,
  refMatches,
  removeCountersFrom,
  cancelWhenRevealed,
  discard,
  eventTarget,
  ifThen,
  self,
  setRemainingHitPoints,
  valueAtLeast,
  you,
  yourIdentity,
  YOUR_IDENTITY,
} from "../../dsl/index.js";

const INTERFACE = trait("INTERFACE");
const WEB_WARRIOR = trait("WEB-WARRIOR");

/**
 * SP//dr's own supports, upgrades and resources (`spdr` 31007-31013, 31018-31020, 31024, 31029; SP//dr Hero Pack
 * pp. 1-2, 4-5; read directly off `packages/content/src/data/spdr/cards.ts`, no errata on RRG 1.8 pp. 67-68,
 * confirmed against each card's own scan, `assets/card-art/bundles/cards/<id>.png`, except 31018 which reuses
 * `05017.png`, the msm alias below). None of 31010-31013 carry `attachesTo` (a `hero:31001a`-restricted signature
 * card that implicitly travels with its owning hero, `spiderham/support-upgrades.ts`'s Huge Wooden Hammer/Organic
 * Webbing precedent) — their effects read `YOUR_IDENTITY`/`yourIdentity` directly, "SP//dr Suit" naming the hero
 * form of the identity itself (`identity.ts`'s own module docblock: 31001a is the hero-form identity, printed
 * "SP//dr Suit").
 *
 * **Aunt May & Uncle Ben (support, 31007)** — **KNOWN_SKIPPED, missing cost primitive.** "Action: Exhaust Aunt May
 * & Uncle Ben and discard the top 2 cards of your deck (top 3 cards instead if you are in alter-ego form) → add
 * each SP//dr card discarded this way to your hand." The "→" puts "discard the top N cards of your deck" on the
 * *cost* side (RRG 1.8 "Cost", p. 13-14: a cost must be fully payable to initiate, `dsl/abilities.ts`'s own
 * `discardTopOfDeckCost`/Reactor Core (`gmw` 16165) docblock makes the same reading of an identical "discard the
 * top N (variant) cards of your deck →" shape). `discardTopOfDeckCost`/`AbilityCost.discardFromDeck`
 * (`packages/engine/src/abilities.ts`) exists but is a bare count with **no `bind`** — nothing records *which*
 * cards it discarded, so the granted effect has no way to read "each SP//dr card discarded this way" (the aspect
 * filter itself is easy, `query({ aspect: "hero:31001a" })`, No Quarter's own `{ aspect: "aggression" }` precedent,
 * `wave5/nova/events.ts` 28013 — the missing piece is purely the cost-side reference). Would need
 * `AbilityCost.discardFromDeck` to carry an optional `bind` the way `discardCards`/`discardFromHand` already do.
 * The amount itself (`ifElse(isAlterEgo(), 3, 2)`, `dsl/values.ts`) is not the gap.
 *
 * **Ejection Protocol (support, 31008)**: "Hero Action: Discard Ejection Protocol → exhaust each Interface upgrade
 * you control, set your hit point dial to 6, give your identity a tough status card, and flip to alter-ego form."
 * Printed order, one step each: `exhaust(each(query("upgrade", { trait: INTERFACE, controller: "you" })))`,
 * `setRemainingHitPoints(6, yourIdentity)` (`cap`'s own Bucky Barnes precedent, `wave1/cap/kit.ts`),
 * `giveTough(yourIdentity)`, `changeForm(you, "alterEgo")` (`drs/obligation.ts`'s own "Flip to alter-ego form"
 * precedent). `heroAction` alone gates it to hero form (the printed "Hero Action:" label), so there is no
 * `isHero()` guard to add.
 *
 * **SP//dr Command (support, 31009)**: two independent Hero Actions on one card. "Exhaust SP//dr Command and an
 * Interface upgrade → draw 1 card." is `[exhaustThis, exhaustCardsCost(query("upgrade", { trait: INTERFACE,
 * controller: "you" }))]` then `draw(1)`. "Exhaust SP//dr Command, choose and discard 1 card from your hand →
 * ready an Interface upgrade." is `[exhaustThis, discardFromHandCost(1, 1)]` (any hand card, no filter printed)
 * then `chooseTarget`/`ready` on an Interface upgrade — the target isn't restricted to an *exhausted* one (the
 * printed text doesn't say "an exhausted Interface upgrade", unlike Host Spider's own "ready SP//dr Suit" which
 * carries no restriction either), so readying an already-ready upgrade is a legal (if pointless) choice.
 *
 * **Host Spider (upgrade, 31010, INTERFACE/SPIDER)**: "Hero Action: Exhaust Host Spider → ready SP//dr Suit."
 * `ready(yourIdentity)` — "SP//dr Suit" is the hero-form identity itself (module docblock).
 *
 * **Psychic Link (upgrade, 31011, INTERFACE/TECH)**: "Hero Interrupt: When SP//dr Suit makes a basic thwart,
 * exhaust Psychic Link → it gets +2 THW for that thwart." `on.thwarts(YOUR_IDENTITY, { basic: true })`,
 * `modifyStat("thw", 2, yourIdentity, "endOfAttack")` — `"endOfAttack"` is "until after the activation in progress
 * resolves" regardless of which basic power it was (Entangling Vines, `gmw` 16008, the identical "+2 THW for that
 * thwart" shape).
 *
 * **Speed-Metal Alloy (upgrade, 31012, INTERFACE/TECH)**: "Hero Interrupt: When SP//dr Suit defends against an
 * attack, exhaust Speed-Metal Alloy → it gets +2 DEF for that defense." `on.defends(YOUR_IDENTITY)`,
 * `modifyStat("def", 2, yourIdentity, "endOfAttack")` — Never Back Down's own shape (`qsv` 14014).
 *
 * **Web-Fluid Compressor (upgrade, 31013, INTERFACE/TECH)**: "Hero Interrupt: When SP/dr Suit makes a basic
 * attack, exhaust Web-Fluid Compressor → it gets +2 ATK for that attack." (printed text drops one slash in "SP/dr
 * Suit" — a data transcription slip, not a different card; same identity reference as every other 31010-31013
 * card.) `on.attacks(YOUR_IDENTITY, { basic: true })`, `modifyStat("atk", 2, yourIdentity, "endOfAttack")` —
 * Huge Wooden Hammer's own shape (`spiderham` 30010) minus the overkill grant that card's own text adds.
 *
 * **Energy Barrier (upgrade, 31018)** reprints `msm` 05017 verbatim (identical printed text, cost, aspect, traits
 * and scan filename `05017.png` — the card data's own `images.front` already points there) — aliased rather than
 * re-scripted, `spiderham/support-upgrades.ts`'s own Followed/Team-Building Exercise/Web of Life and Destiny
 * precedent.
 *
 * **Forcefield Generator (upgrade, 31019)**: this box's own printing — no earlier card shares this exact text
 * (checked every `cards.ts` for the name). "Uses (6 energy counters). Max 1 per player.\nForced Interrupt: When
 * you would take any amount of damage, remove that many energy counters from here. For each energy counter removed
 * this way, prevent 1 of that damage." Both effects read the same pre-effect amount (`min(eventAmount,
 * countersOn(self, "energy"))`) before either changes what it depends on — Flora Colossus's own exact shape
 * (`gmw` 16001a: "remove that many growth counters … prevent 1 of that damage"), `dsl/values.ts`'s own `min`
 * docblock cites it for this reason.
 *
 * **Spider-Tingle (upgrade, 31020)**: "Interrupt: When you would reveal an encounter card, deal 1 damage to a
 * Web-Warrior character you control → if that card is a treachery, cancel its 'When Revealed' effects and discard
 * Spider-Tingle." Plain `interrupt` (usable from either form, no "Hero"/"Alter-Ego" label printed — Cartoon
 * Physics's own reasoning, `spiderham/support-upgrades.ts` 30009). The cost is `damageCardsCost(query("character",
 * { trait: WEB_WARRIOR, controller: "you" }), 1)` (`AbilityCost.damageCards`, `packages/engine/src/abilities.ts`
 * — landed since Thwip Thwip!'s own `events.ts` docblock flagged an identical cost shape as a gap; this card no
 * longer needs that flag). The trigger is unfiltered (`on.encounterCardRevealed()`, Enhanced Spider-Sense's own
 * `01004` builder with no query) since the cost is paid — and the card is exhausted of its use — even when the
 * revealed card isn't a treachery; only "cancel its 'When Revealed' effects and discard Spider-Tingle" is
 * conditional on it. `refMatches(eventTarget, query("treachery"), { anywhere: true })` reads the revealed card
 * still on the encounter deck (not yet in play, so `anywhere: true` — Master of Illusions's own exact shape,
 * `wave4/mts/loki.ts` 21173, checking a card it just moved rather than one revealed in place, but the same
 * "not-in-play" reason applies here to a card still being revealed).
 *
 * **Unshakable (upgrade, 31024)**: "Play only if your identity has at least 14 printed hit points.\nYour identity
 * gains steady." `31024.unshakable-constant-2` is `constant(gainsKeyword({ name: "steady" }, YOUR_IDENTITY))`
 * (`keywordGrants`, the primitive every other "gains [keyword]" grant in this codebase uses, e.g. Warrior of the
 * Great Web's own sibling cards). `31024.unshakable-constant` (the play restriction) is
 * `constant(playOnlyIf(valueAtLeast(printedHpOf(yourIdentity), 14)))` — `printedHpOf`/`ValueSpec { kind:
 * "printedHp" }` (`dsl/values.ts`) landed since this docblock's own earlier draft, its own docblock naming this
 * exact card ("Play only if your identity has at least 14 printed hit points" — Limitless Stamina, `spdr` 31023,
 * the identical printed sentence, same box). The identity's *printed* HP (14, `identity.ts`'s own card data) never
 * changes at runtime, so this reads as a static gate, not a live one.
 *
 * **Clarity of Purpose (upgrade, 31029)**: "Attach to a friendly character. Max 1 per character." is schema-level
 * (`attachesTo: { kind: "friendlyCharacter" }`, already on the card record; no ability ref). "Hero Resource:
 * Exhaust this card and deal 1 damage to attached character → generate a [wild] resource." The damage is a cost
 * component, not an effect ("→" separates it from "generate a [wild] resource") — `damageCardsCost(query("character",
 * { hostOfSelf: true }), 1)` (Thwip Thwip!'s own docblock names this exact `AbilityCost.damageCards` shape;
 * `hostOfSelf` auto-picks the one attached character the same way Sync Ratio's own `exhaustCardsCost` auto-picks a
 * single candidate, `identity.ts`'s own docblock), paired with `exhaustThis`, generating `{ wild: 1 }`
 * (`heroResource`, Enhanced Reflexes's own shape, `msm` 05024).
 */

export const SPDR_SUPPORT_UPGRADES = defineAbilities({
  // 31007.aunt-may-and-uncle-ben-action — KNOWN_SKIPPED, see module docblock (missing `bind` on
  // `AbilityCost.discardFromDeck`).

  "31008.ejection-protocol-action": heroAction(
    { cost: discardThis },
    exhaust(each(query("upgrade", { trait: INTERFACE, controller: "you" }))),
    setRemainingHitPoints(6, yourIdentity),
    giveTough(yourIdentity),
    changeForm(you, "alterEgo"),
  ),

  "31009.sp-dr-command-action": heroAction(
    { cost: [exhaustThis, exhaustCardsCost(query("upgrade", { trait: INTERFACE, controller: "you" }))] },
    draw(1),
  ),
  "31009.sp-dr-command-hero-action": heroAction(
    { cost: [exhaustThis, discardFromHandCost(1, 1)] },
    chooseTarget("upgrade", query("upgrade", { trait: INTERFACE, controller: "you" })),
    ready(chosen("upgrade")),
  ),

  "31010.host-spider-action": heroAction({ cost: exhaustThis }, ready(yourIdentity)),

  "31011.psychic-link-interrupt": heroInterrupt(
    on.thwarts(YOUR_IDENTITY, { basic: true }),
    { cost: exhaustThis },
    modifyStat("thw", 2, yourIdentity, "endOfAttack"),
  ),

  "31012.speed-metal-alloy-interrupt": heroInterrupt(
    on.defends(YOUR_IDENTITY),
    { cost: exhaustThis, label: "defense" },
    modifyStat("def", 2, yourIdentity, "endOfAttack"),
  ),

  "31013.web-fluid-compressor-interrupt": heroInterrupt(
    on.attacks(YOUR_IDENTITY, { basic: true }),
    { cost: exhaustThis },
    modifyStat("atk", 2, yourIdentity, "endOfAttack"),
  ),

  "31018.energy-barrier-interrupt": MSM_PACK_CARDS["05017.energy-barrier-interrupt"]!,

  "31019.forcefield-generator-forced-interrupt": forcedInterrupt(
    on.damage(YOUR_IDENTITY),
    preventDamage(min(eventAmount, countersOn(self, "energy"))),
    removeCountersFrom(self, "energy", min(eventAmount, countersOn(self, "energy"))),
  ),

  "31020.spider-tingle-interrupt": interrupt(
    on.encounterCardRevealed(),
    { cost: damageCardsCost(query("character", { trait: WEB_WARRIOR, controller: "you" }), 1) },
    ifThen(refMatches(eventTarget, query("treachery"), { anywhere: true }), [cancelWhenRevealed(), discard(self)]),
  ),

  "31024.unshakable-constant": constant(playOnlyIf(valueAtLeast(printedHpOf(yourIdentity), 14))),
  "31024.unshakable-constant-2": constant(gainsKeyword({ name: "steady" }, YOUR_IDENTITY)),

  "31029.clarity-of-purpose-resource": heroResource(
    { wild: 1 },
    { cost: [exhaustThis, damageCardsCost(query("character", { hostOfSelf: true }), 1)] },
  ),
});
