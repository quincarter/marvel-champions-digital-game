import { trait } from "@mc/content";
import type { EffectSpec, TargetRef } from "@mc/engine";
import {
  after,
  amount,
  type Amount,
  atEndOfActivation,
  atEndOfAttack,
  boost,
  cards,
  chooseOneBy,
  chooseTarget,
  chosen,
  constant,
  deckCountOf,
  defineAbilities,
  discard,
  eachPlayer,
  enemyAttack,
  enemyScheme,
  firstPlayer,
  forcedInterrupt,
  forcedResponse,
  forEachPlayer,
  gainsKeyword,
  giveBoostCard,
  giveTough,
  hasStatus,
  ifThen,
  moveCards,
  not,
  option,
  placeThreat,
  putIntoPlay,
  query,
  replaceBoostCount,
  response,
  rule,
  scaled,
  scenarioDeck,
  searchAndReveal,
  selectCards,
  self,
  spend,
  spendResources,
  thatPlayer,
  theMainScheme,
  theVillain,
  varAtLeast,
  when,
  whenDefeated,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
  zone,
} from "../../dsl/index.js";
import { cardName } from "../names.js";

/**
 * The Thanos scenario (docs/phase7-wave4.md §2.2, §3.6, §3.11): the villain Thanos I–III (21111–21113), the main
 * scheme The Infinity Stones → Balance the Scales (21114/21115), and his own encounter set (Sanctuary, Thanos's
 * Armor/Helmet, Master of the Stones, Avatar of Death, Deviant Syndrome, "I Am Inevitable", The Mad Titan, The
 * Titan's Throne — 21116–21124). The Infinity Gauntlet modular set (21129–21135) is `infinity-gauntlet.ts`.
 *
 * **The Infinity Stone deck** (MC21 p. 16, §1.10/§3.6) is built at setup from `infinity_gauntlet`'s
 * `EncounterSet.separateDecks` (wired in `../setup.ts`'s `buildMtsSingleVillain`), so "put the top card of the
 * infinity stone deck into play" is `selectCards` of `scenarioDeck("Infinity Stone", { top: 1 })` then
 * `putIntoPlay`, and "place this card in the infinity stone deck discard pile" is a plain move to `"discard"` — the
 * card's own `home` (set at deck-build time) already routes it to the Infinity Stone deck's own discard pile
 * (`discardZoneFor`, `packages/engine/src/query.ts`), matching `packages/engine/src/set-deck-and-run-out.test.ts`'s
 * own worked example.
 *
 * **"Thanos cannot take damage from player cards" (Sanctuary, errata RRG 1.8 p. 67)** is `RuleSpec
 * cannotTakeDamage { fromSource }`. RRG 1.8 "Player Card" (p. 33) lists seven printed types: ally, event, identity,
 * player side scheme, resource, support, upgrade. `PLAYER_CARD` below reads the five a card in this scenario's
 * pool could plausibly deal damage as (identity, ally, event, upgrade, support) — resource and player side scheme
 * cards deal no damage in this game's pool, so they're omitted rather than guessed at.
 *
 * **"Each player may spend up to 3 [physical] resources from their hand. Deal 2 damage to Thanos for each …
 * resource spent this way." (Sanctuary's own When Defeated)**: `spendResources` reports only whether its exact
 * requirement was met (`<bind>.made`, 0 or 1), not how many resources a variable payment used, so "up to 3,
 * scaling the result" can't be read back from one call. Scripted the same way `adam-warlock-pack-cards.ts`'s own
 * `discardUpTo` composes "discard up to N cards → …" (docs/phase7-wave4.md §3.12): a `chooseOne` of "spend 0/1/2/3",
 * each committing to (and reading back only whether it succeeded at) exactly that count, so the damage for that
 * option is the option's own known literal, not a read-back amount.
 *
 * **"Hero Response: After a hero makes a basic attack against Thanos, spend … → discard this card" (Thanos's Armor,
 * Thanos's Helmet)** is a plain `response`, not `heroResponse`: `heroResponse`'s `form: "hero"` gate is checked
 * against `controllerOf` *before* falling back to the acting player (`packages/engine/src/resolve/triggers.ts`
 * `candidatesFor`: `formSatisfied` returns `false` outright when `controllerOf` is `null`, which it always is for an
 * attachment on the villain — an uncontrolled card). A basic attack can only be made by a hero in the first place,
 * so the plain response with `query("hero")` as the attacker is exactly as restrictive and resolves correctly (the
 * acting player becomes the attacking hero via `uncontrolledYouOf ?? actingPlayerOf`).
 *
 * **"Forced Interrupt: When Thanos would take any amount of damage, reduce that amount by 1" (Thanos's Armor)** is
 * the same `reduceDamageTaken` constant `wave4/vision/vision-kit.ts`'s 26002.intangible-constant-2 uses for the
 * same printed wording without the "Forced Interrupt:" label — the engine's one damage-reduction rule regardless of
 * how the card announces it, and here with no `fromAttack` (the card says "any amount of damage", not "from each
 * attack").
 *
 * **"Thanos attacks you. That attack gains overkill and piercing." (Avatar of Death, 21120)** is `enemyAttack`
 * followed by `modifyAttack` in the same effects list — proven to apply to the very attack `enemyAttack` just
 * initiated by `packages/cards/src/wave1/twc/piledriver.ts` (`enemyAttack(...)` then `modifyAttack({ atkBonus: 2
 * })` right after it), not two separate abilities.
 *
 * **"Discard the top card of the infinity stone deck. Apply its boost icons … as if it were a boost card." (I Am
 * Inevitable, 21122's own Boost)** is `replaceBoostCount` (docs/phase7-wave4.md §3.6's own "not yet proven" item,
 * confirmed here): select the top card, move it to its own discard pile, then `replaceBoostCount(chosen)` — the
 * `packages/cards/src/wave2/scw/kit.ts` Chaos Control shape, over the Infinity Stone deck's own top card rather
 * than the encounter deck's.
 */

const INFINITY_STONE = trait("INFINITY STONE");
const STONE_DECK = "Infinity Stone";
const PLAYER_CARD = query(["identity", "ally", "event", "upgrade", "support"]);

/**
 * "This damage ignores the tough status card" (Sanctuary's own When Defeated). Engine primitive
 * `EffectSpec.dealDamage.ignoreTough` (`packages/engine/src/spec.ts`); `dsl/effects.ts`'s `dealDamage` doesn't
 * expose `ignoreTough` (the same gap `packages/cards/src/wave1/thor/local.ts`'s own `dealDamageIgnoringTough`
 * documents for Lightning Strike).
 */
const dealDamageIgnoringTough = (n: Amount, target: TargetRef): EffectSpec => ({
  kind: "dealDamage",
  target,
  amount: amount(n),
  ignoreTough: true,
});

/** "Put the top card of the infinity stone deck into play" (The Infinity Stones 1B, Master of the Stones). */
const putTopStoneIntoPlay = (controller = you): EffectSpec[] => [
  selectCards("stone", scenarioDeck(STONE_DECK, { top: 1 })),
  putIntoPlay(chosen("stone"), controller),
];

/** "May spend up to 3 [physical] resources from their hand. Deal 2 damage to Thanos for each … spent this way." */
const maySpendPhysicalForDamage = (max: number) =>
  chooseOneBy(
    thatPlayer,
    option("Spend none"),
    ...Array.from({ length: max }, (_, i) => i + 1).map((n) =>
      option(
        `Spend ${n} [physical]`,
        spendResources({ physical: n }, "paid", thatPlayer),
        ifThen(varAtLeast("paid.made"), dealDamageIgnoringTough(2 * n, theVillain)),
      ),
    ),
  );

export const THANOS = defineAbilities({
  // Thanos (I) — Stalwart (data). Forced Response: After the infinity stone deck runs out, give Thanos 1 facedown
  // boost card. Reprinted verbatim on (II) and (III) below.
  "21111.thanos-forced-response": forcedResponse(after.scenarioDeckRunsOut(STONE_DECK), giveBoostCard(theVillain)),
  // Thanos (II) — Stalwart, Toughness (data). When Revealed: Search the encounter deck and discard pile for
  // Thanos's Helmet and reveal it. (Shuffle.)
  "21112.when-revealed": whenRevealed(searchAndReveal(cardName("21118"))),
  "21112.thanos-forced-response": forcedResponse(after.scenarioDeckRunsOut(STONE_DECK), giveBoostCard(theVillain)),
  // Thanos (III) — same as (II).
  "21113.when-revealed": whenRevealed(searchAndReveal(cardName("21118"))),
  "21113.thanos-forced-response": forcedResponse(after.scenarioDeckRunsOut(STONE_DECK), giveBoostCard(theVillain)),

  // The Infinity Stones 1B (21114b) — When Revealed: Put the top card of the infinity stone deck into play. Search
  // the encounter deck for the Sanctuary side scheme and reveal it. (Shuffle the encounter deck.)
  "21114b.when-revealed": whenRevealed(
    ...putTopStoneIntoPlay(firstPlayer),
    searchAndReveal(cardName("21116"), ["deck"]),
  ),
  // Balance the Scales 2B (21115b) — When Revealed: Each player shuffles their discard pile into their deck. Each
  // player removes the top half of their deck (rounded down) from the game. 2A's own "the players lose the game if
  // completed" reminder needs no ability ref (`completionLoses`, data).
  "21115b.when-revealed": whenRevealed(
    forEachPlayer(
      eachPlayer,
      moveCards(zone("discard", thatPlayer), "deckShuffle"),
      moveCards(
        zone("deck", thatPlayer, { top: scaled(deckCountOf(thatPlayer), { divide: { by: 2, round: "down" } }) }),
        "removedFromGame",
      ),
    ),
  ),

  // Sanctuary (21116) — Hinder 1[per_hero]. Victory 1 (data). Thanos cannot take damage from player cards. When
  // Defeated: Each player may spend up to 3 [physical] resources from their hand. Deal 2 damage to Thanos for each
  // [physical] resource spent this way. This damage ignores the tough status card.
  "21116.sanctuary-constant": constant(
    rule({ kind: "cannotTakeDamage", target: query("villain"), fromSource: PLAYER_CARD }),
  ),
  "21116.when-defeated": whenDefeated(forEachPlayer(eachPlayer, maySpendPhysicalForDamage(3))),

  // Thanos's Armor (21117) — Forced Interrupt: When Thanos would take any amount of damage, reduce that amount by
  // 1. Hero Response: After a hero makes a basic attack against Thanos, spend [energy][physical] resources →
  // discard this card.
  "21117.thanoss-armor-forced-interrupt": constant(
    rule({ kind: "reduceDamageTaken", target: query("villain"), amount: 1 }),
  ),
  "21117.thanoss-armor-response": response(
    after.attacks(query("hero"), { basic: true, target: query("villain") }),
    { cost: spend({ energy: 1, physical: 1 }) },
    discard(self),
  ),

  // Thanos's Helmet (21118) — Thanos gains retaliate 1. Hero Response: After a hero makes a basic attack against
  // Thanos, spend [mental][physical] resources → discard this card.
  "21118.thanoss-helmet-constant": constant(gainsKeyword({ name: "retaliate", value: 1 }, query("villain"))),
  "21118.thanoss-helmet-response": response(
    after.attacks(query("hero"), { basic: true, target: query("villain") }),
    { cost: spend({ mental: 1, physical: 1 }) },
    discard(self),
  ),

  // Master of the Stones (21119, +1 ATK/+1 SCH printed as a stat modifier) — Forced Interrupt: When Thanos
  // activates, put the top card of the infinity stone deck into play. At the end of this activation, discard
  // Master of the Stones.
  "21119.master-of-the-stones-forced-interrupt": forcedInterrupt(
    when.enemySchemesOrAttacks("host"),
    ...putTopStoneIntoPlay(firstPlayer),
    atEndOfActivation(discard(self)),
  ),

  // Avatar of Death (21120) — When Revealed (Alter-Ego): Thanos schemes. When Revealed (Hero): Thanos attacks you.
  // That attack gains overkill and piercing.
  "21120.when-revealed-alter-ego": whenRevealedAlterEgo(enemyScheme(theVillain)),
  // "That attack gains overkill and piercing": carried by the attack itself (docs/phase7-wave4.md §3.51).
  "21120.when-revealed-hero": whenRevealedHero(
    enemyAttack(theVillain, { against: you, keywords: ["overkill", "piercing"] }),
  ),

  // Deviant Syndrome (21121) — Incite 1 (data). When Revealed: Give Thanos a tough status card. If you cannot,
  // place 2 threat on the main scheme. [star] Boost: Give Thanos a tough status card.
  "21121.when-revealed": whenRevealed(
    ifThen(not(hasStatus(theVillain, "tough")), giveTough(theVillain), placeThreat(2, theMainScheme)),
  ),
  "21121.boost": boost(giveTough(theVillain)),

  // "I Am Inevitable" (21122) — When Revealed: Give Thanos 1 facedown boost card. [star] Boost: Discard the top
  // card of the infinity stone deck. Apply its boost icons for this activation as if it were a boost card
  // (`replaceBoostCount`, docs/phase7-wave4.md §3.6's own "not yet proven" item, confirmed here).
  "21122.when-revealed": whenRevealed(giveBoostCard(theVillain)),
  "21122.boost": boost(
    selectCards("stone", scenarioDeck(STONE_DECK, { top: 1 })),
    moveCards(cards(chosen("stone")), "discard"),
    replaceBoostCount(chosen("stone")),
  ),

  // The Mad Titan (21123) — When Revealed: Put the top card of the infinity stone deck into play. [star] Boost: If
  // damage from this attack defeats an ally, put the top card of the infinity stone deck into play. Deferred to the
  // end of the attack (`atEndOfAttack`) because a Boost ability's own effects resolve before the attack's damage
  // step, so whether an ally was defeated isn't known yet when the Boost text would otherwise run.
  "21123.when-revealed": whenRevealed(...putTopStoneIntoPlay(firstPlayer)),
  // "If damage from this attack defeats an ally": an `enemyAttack` event carries no `results` field at all (unlike
  // a player's own `attack` event), so `eventDealt`/`eventTarget` — which read the *event's own* `results` and
  // target — can never match it. `{ kind: "currentAttack" }` instead reads the currently-resolving activation
  // *frame*'s own `defeated` var, which `resolve/event.ts` sets to 1 whenever the attack's target is defeated
  // (`addFrameVars(ctx, event.parentFrameId, { defeated: 1 })`) regardless of which side attacked. An enemy's own
  // attack always targets either the attacked player's identity or their declared defending ally, so "the attack
  // defeated its target" and "the attack defeated an ally" agree here (defeating the identity itself would end the
  // game before this Boost effect could run).
  "21123.boost": boost(
    atEndOfAttack(ifThen({ kind: "currentAttack", key: "defeated", atLeast: 1 }, putTopStoneIntoPlay(firstPlayer))),
  ),

  // The Titan's Throne (21124, amplify 1) — When Revealed: Choose and discard an infinity stone from play.
  "21124.when-revealed": whenRevealed(
    chooseTarget("stone", query("environment", { trait: INFINITY_STONE })),
    discard(chosen("stone")),
  ),
});
