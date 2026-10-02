import { trait } from "@mc/content";
import {
  addCounters,
  anAttackableEnemy,
  aScheme,
  attack,
  applyRuleUntil,
  cards,
  chooseCards,
  chooseOptions,
  chooseTarget,
  chosen,
  constant,
  costModifier,
  defineAbilities,
  exhaustYourHero,
  giveTough,
  heroAction,
  ifThen,
  mayLookAtTopOfEncounterDeckUntil,
  modifyStat,
  moveCards,
  option,
  query,
  ready,
  scaled,
  self,
  shuffleDeck,
  statOf,
  sum,
  thwart,
  threatOn,
  traitNumber,
  valueEquals,
  varAtLeast,
  you,
  yourIdentity,
  zone,
  type ChoiceOption,
} from "../../dsl/index.js";

const CHAMPION = trait("CHAMPION");

/**
 * Ironheart's own signature events (`ironheart` 29005–29008, 29017–29019, 29025; Ironheart Hero Pack pp. 1-3,
 * docs/phase7-wave5.md; read directly from `packages/content/src/data/ironheart/cards.ts`). Every "Ironheart" in
 * the printed text is her identity (`yourIdentity`), not the event card — the same reading `identity.ts`'s own
 * docblock gives ("Ironheart" in "remove 6 progress counters from Ironheart" is the identity's instance).
 *
 * **Fly Over (29005)**: "Hero Action (thwart): Remove 3 threat from a scheme and place 1 progress counter on
 * Ironheart (2 progress counters instead if this thwart removes the last threat from that scheme)." A basic thwart
 * target must still hold threat to be legal (`target-validity.ts`), so reading the chosen scheme's threat back to 0
 * after the removal (`valueEquals(threatOn(chosen("scheme")), 0)`) is exactly "removes the last threat" — the
 * Nova `28006` `unleash-nova-force-action` precedent for the same check (its own comment: "a defeated side scheme
 * has left play; its threat still reads 0", so the read is safe even for a side scheme the removal just defeated).
 *
 * **Photon Beam (29006)**: "Hero Action (attack): Deal 4 damage to an enemy and place 1 progress counter on
 * Ironheart (2 progress counters instead if this attack defeats that enemy)." The "(attack)" label means an actual
 * attack, not a bare `dealDamage` (Nova's own Pot Shot/No Quarter precedent, `../nova/events.ts`), so
 * `attack(4, chosen("enemy"), { bind })` + `varAtLeast("<bind>.defeated")` (One by One's own shape) reads whether
 * this specific attack defeated its target.
 *
 * **New and Improved (29007)**: "Hero Action: Choose X different options, where X is equal to Ironheart's version
 * number: • Search your deck for an Ironheart card and add it to your hand. (Shuffle.) • Give Ironheart a tough
 * status card. • Ready Ironheart." X is read at resolution time (`traitNumber(yourIdentity, "Version")`,
 * docs/phase7-wave5.md §1.7/§3.23) but `chooseOptions`' own `count` is a literal `number` the engine reads once
 * (`packages/engine/src/spec.ts` `chooseOne.count`, no `ValueSpec` support) — not a DSL gap: three `ifThen`
 * branches, one per possible Version (1–3), each with a literal `chooseOptions(N, …)`, compose it exactly, since
 * only one branch's condition is ever true. "An Ironheart card" is any card in her signature set
 * (`query([], { identitySetOf: you })`, read off `aspect: "hero:29001a"` — RRG 1.8 "Identity-Specific Card",
 * p. 23), the Black Panther Foresight shape (`core/heroes/black-panther.ts` 01040b) for the search-and-shuffle
 * itself. The one action ref carries the header and its three bulleted lines.
 *
 * **Sector Scan (29008)**: "Reduce the cost to play Sector Scan by X, where X is equal to Ironheart's version
 * number.\nHero Action: Until the end of the round, you may look at the top card of the encounter deck at any
 * time." The cost reduction is `costModifier({ delta: scaled(traitNumber(...), { times: -1 }), appliesTo: {
 * self: true }, activeIn: "hand" })` — the Knife Leap shape (`wave3/drax/drax-kit.ts` 19005: a printed-cost
 * reduction read from hand). The Hero Action is `mayLookAtTopOfEncounterDeckUntil("endOfRound")`, landed for this
 * exact card (docs/phase7-wave5.md §3.28).
 *
 * **Go All Out (29017)** and **Push Ahead (29018)**: `Requirement (…)` is data (`keywords`, no ability ref — Nova's
 * own No Quarter precedent). "Hero Action (attack/thwart): Exhaust your hero → deal damage to an enemy / remove
 * threat from a scheme equal to the total of your hero's THW, ATK, and DEF values" is `exhaustYourHero` as the
 * cost (Smash the Problem's own shape, `wave4/valk/valkyrie-pack-cards.ts` 25019) with `sum(statOf(…, "thw"),
 * statOf(…, "atk"), statOf(…, "def"))` for the total — effective (current, not printed) values, per "The Best
 * Offense…" ruling (June 25, 2026 - Ruling 3: a stat-replacing upgrade's substituted DEF is what Go All Out reads).
 *
 * **Morale Boost (29019)**: "Hero Action: Choose a hero. Until the end of the round, that hero gets +1 THW, +1
 * ATK, and +1 DEF" — any hero, not just yours (`chooseTarget("hero", query("hero"))`, Adam Warlock's own
 * leadership-branch shape, `wave4/mts/adam-warlock-kit.ts` 21031a) with three `modifyStat` calls.
 *
 * **"Go for Champions!" (29025)**: current (errata'd) text, RRG 1.8 p. 68: "Max 1 per deck.\nPlay only if your
 * identity has the Champion trait.\nHero Action: Remove "Go for Champions!" from the game → Each champion
 * character in play cannot take damage until the end of the round." (the printed card was missing the "Remove …
 * from the game →" clause; `packages/content/src/data/ironheart/cards.ts`'s `text.current` already carries the
 * errata, confirmed against the RRG). "Max 1 per deck" and "Play only if …" are data
 * (`deckLimit`/`playRestrictions.requiresIdentityTrait`). Removing the card itself is `moveCards(cards(self),
 * "removedFromGame")` (Loki/Kang/Taskmaster's own "remove this card from the game" shape — no dedicated
 * `AbilityCost` field exists for it, so it resolves as the ability's own first effect rather than as a payment;
 * nothing here depends on the cost/effect ordering distinction, since it is the ability's only cost and nothing
 * else in the game can intervene between "Remove … from the game" and the grant in the same resolution). The
 * grant itself is `applyRuleUntil({ kind: "cannotTakeDamage", target: query("character", { trait: CHAMPION }) },
 * "endOfRound")` (the FAQ p. 62/ruling Jan 26, 2026 (1) precedent table entry, docs/phase7-wave5.md §3.32) — a
 * live query, so a Champion character that enters play afterward this round is protected too, matching "each …
 * character in play" read continuously rather than a fixed snapshot.
 */

const newAndImprovedOptions = (): readonly ChoiceOption[] => [
  option(
    "Search your deck for an Ironheart card and add it to your hand. (Shuffle.)",
    chooseCards("found", zone("deck", you, { filter: query([], { identitySetOf: you }) }), { min: 1, max: 1 }),
    moveCards(cards(chosen("found")), "hand"),
    shuffleDeck(),
  ),
  option("Give Ironheart a tough status card.", giveTough(yourIdentity)),
  option("Ready Ironheart.", ready(yourIdentity)),
];

const heroStatTotal = sum(statOf(yourIdentity, "thw"), statOf(yourIdentity, "atk"), statOf(yourIdentity, "def"));

export const IRONHEART_EVENTS = defineAbilities({
  "29005.fly-over-action": heroAction(
    { label: "thwart" },
    aScheme("scheme"),
    thwart(3, chosen("scheme")),
    ifThen(
      valueEquals(threatOn(chosen("scheme")), 0),
      addCounters("progress", 2, yourIdentity),
      addCounters("progress", 1, yourIdentity),
    ),
  ),

  "29006.photon-beam-action": heroAction(
    { label: "attack" },
    anAttackableEnemy("enemy"),
    attack(4, chosen("enemy"), { bind: "beam" }),
    ifThen(
      varAtLeast("beam.defeated"),
      addCounters("progress", 2, yourIdentity),
      addCounters("progress", 1, yourIdentity),
    ),
  ),

  "29007.new-and-improved-action": heroAction(
    ifThen(valueEquals(traitNumber(yourIdentity, "Version"), 1), chooseOptions(1, newAndImprovedOptions())),
    ifThen(valueEquals(traitNumber(yourIdentity, "Version"), 2), chooseOptions(2, newAndImprovedOptions())),
    ifThen(valueEquals(traitNumber(yourIdentity, "Version"), 3), chooseOptions(3, newAndImprovedOptions())),
  ),

  "29008.sector-scan-constant": constant(
    costModifier({
      delta: scaled(traitNumber(yourIdentity, "Version"), { times: -1 }),
      appliesTo: { self: true },
      activeIn: "hand",
    }),
  ),
  "29008.sector-scan-action": heroAction(mayLookAtTopOfEncounterDeckUntil("endOfRound")),

  "29017.go-all-out-action": heroAction(
    { label: "attack", cost: exhaustYourHero },
    anAttackableEnemy("enemy"),
    attack(heroStatTotal, chosen("enemy")),
  ),

  "29018.push-ahead-action": heroAction(
    { label: "thwart", cost: exhaustYourHero },
    aScheme("scheme"),
    thwart(heroStatTotal, chosen("scheme")),
  ),

  "29019.morale-boost-action": heroAction(
    chooseTarget("hero", query("hero")),
    modifyStat("thw", 1, chosen("hero"), "endOfRound"),
    modifyStat("atk", 1, chosen("hero"), "endOfRound"),
    modifyStat("def", 1, chosen("hero"), "endOfRound"),
  ),

  "29025.go-for-champions-action": heroAction(
    moveCards(cards(self), "removedFromGame"),
    applyRuleUntil({ kind: "cannotTakeDamage", target: query("character", { trait: CHAMPION }) }, "endOfRound"),
  ),
});
