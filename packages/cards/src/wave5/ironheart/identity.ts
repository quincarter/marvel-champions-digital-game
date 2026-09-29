import {
  action,
  addCounters,
  alterEgoAction,
  chooseTarget,
  chosen,
  coveredByEngineRule,
  dealDamage,
  defineAbilities,
  eitherCost,
  giveTough,
  heroAction,
  query,
  ready,
  removeCounter,
  self,
  spend,
  swapIdentity,
} from "../../dsl/index.js";

/**
 * Ironheart / Riri Williams (29001a-29003a/29001b-29003b, Ironheart Hero Pack p. 1-3, docs/phase7-wave5.md's
 * Ironheart row, §2.1 table): read directly from `packages/content/src/data/ironheart/cards.ts` (no errata, no
 * `curation/ironheart.ts` correction on any of the three faces). Her signature events/support/upgrade/allies
 * (29004-29027) are a separate module (`support-upgrades-allies.ts`/`events.ts`, not yet built); her obligation
 * (A Minor Setback, 29028) and nemesis set (Lucia von Bardas/Rule by Force/Cyborg Tech/Political Retribution x2,
 * 29029-29032) and the Zzzax modular (29033-29040) are likewise separate (`obligation-nemesis.ts`, not yet built).
 *
 * **Not a three-sided identity (Ant-Man/Wasp's shape) — three complete, separately-numbered hero/alter-ego
 * identity pairs sharing one dial**, per `curation/ironheart.ts`'s own header comment and the Ironheart insert,
 * "New Rules: Progressing Identity Cards" (docs/phase7-wave5.md §1.4, quoted there and in §3.23): "Ironheart /
 * Riri Williams has three identity cards in total … During game setup, the weakest of the cards is put into play
 * under the player's control, with the other two cards set aside … All versions … share a single hit point dial,
 * with damage persisting from one version to the next. Additionally, when one identity is swapped for another,
 * move all game elements … on or attached to the original identity to the subsequent identity. If any one version
 * … is defeated, all versions are considered to be defeated simultaneously." `HeroIdentityCard.progressingIdentity`
 * (`["29001a", "29002a", "29003a"]` on all three) is engine-native as of §3.23 (landed 2026-09-26): `createGame`
 * seats Version 1 (29001a) and sets the other two aside in the player's set-aside area; `EffectSpec swapIdentity`
 * trades the identity instance's card id for the next set-aside version's, keeping the instance (so damage,
 * counters, statuses, attachments and form all carry over — RRG 1.8 "Swap", p. 42: "neither card … enters or
 * leaves play"), taking the new card's hit points, hand size and abilities. A defeat of the identity eliminates
 * the player the ordinary way; the set-aside versions need nothing.
 *
 * **29001a Ironheart (Version 1, no named title beyond "Level Up!") / 29002a (Version 2)**: "Level Up! — Action:
 * Remove 6 progress counters from Ironheart → ready her and swap her with [Version 2] Ironheart" (29001a); "…
 * ready her, give her a tough status card, and swap her with [Version 3] Ironheart" (29002a). `removeCounter`
 * (`dsl/abilities.ts`) is a cost against the ability's own card by default — exactly right here since "Ironheart"
 * in "remove 6 progress counters from Ironheart" is this card, the same instance across every version (so a
 * `fromIdentity` cost isn't needed: this ability already lives *on* the identity). `swapIdentity()` defaults to
 * the controller (`you`), matching the printed "her". 29003a (Version 3) prints no Level Up! — it is the last
 * version (RRG p. 42 / the insert: "If any one version … is defeated, all versions are … defeated simultaneously"
 * gives Version 3 nowhere further to level; `swapIdentity` on a last version is a no-op per the engine's own
 * §3.23 test, so no version-3 Level Up! ability exists to call it).
 *
 * **29003a Maximum Efficiency (Version 3 only)**: "Hero Action: Remove 1 progress counter from Ironheart → deal 2
 * damage to an enemy." `heroAction` + `chooseTarget("enemy", query("enemy"))` + `dealDamage(2, chosen("enemy"))`
 * is the exact "deal N damage to a chosen enemy" shape `qsv/kit.ts`'s Super Speed alternate mode and `ant/kit.ts`
 * already use.
 *
 * **29001b/29002b/29003b Child Prodigy (every version, alter-ego)**: "Alter-Ego Action: Spend a [mental] resource
 * → place 1 progress counter on Riri Williams. (Limit once per round.)" (V1); "… Spend a [mental] resource or 2
 * resources of any type → …" (V2); "… Spend 1 resource of any type → …" (V3). V2's either/or cost is
 * `eitherCost(spend({ mental: 1 }), spend(2))` (`AbilityCost.either`, docs/phase7-wave3.md §3.36's "Grand
 * Collection" precedent) — the engine defaults to whichever branch is payable, or asks via `costSelection.branch`
 * when both are. "Riri Williams" is this same card/instance (`self`), so `addCounters("progress", 1)` targets it
 * with no explicit `target` needed.
 *
 * **29001b's own "Begin the game with this card. Set your other identities aside."** is data, not an ability
 * (docs/phase7-wave5.md §1.4: "becomes data (no ability ref)") — `createGame` itself seats Version 1 and sets the
 * others aside from `progressingIdentity.versions[0]`. The printed record still carries an ability id
 * (`29001b.riri-williams-constant`, no label) for that sentence, so it is registered as `coveredByEngineRule()`
 * (the SP//dr `31001b.return-to-base`/Light at the End `27102a.light-at-the-end-constant` precedent for "the
 * engine's own setup/transition already does this, this id exists only so the printed sentence has a ref").
 */

const removeSixProgress = () => removeCounter("progress", 6);
const addProgress = () => addCounters("progress", 1);

export const IRONHEART_IDENTITY = defineAbilities({
  "29001b.riri-williams-constant": coveredByEngineRule(),

  "29001a.level-up": action({ cost: removeSixProgress() }, ready(self), swapIdentity()),
  "29001b.child-prodigy": alterEgoAction(
    { cost: spend({ mental: 1 }), limit: { count: 1, period: "round" } },
    addProgress(),
  ),

  "29002a.level-up": action({ cost: removeSixProgress() }, ready(self), giveTough(self), swapIdentity()),
  "29002b.child-prodigy": alterEgoAction(
    { cost: eitherCost(spend({ mental: 1 }), spend(2)), limit: { count: 1, period: "round" } },
    addProgress(),
  ),

  "29003a.maximum-efficiency": heroAction(
    { cost: removeCounter("progress", 1) },
    chooseTarget("enemy", query("enemy")),
    dealDamage(2, chosen("enemy")),
  ),
  "29003b.child-prodigy": alterEgoAction({ cost: spend(1), limit: { count: 1, period: "round" } }, addProgress()),
});
