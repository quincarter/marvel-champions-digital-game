import {
  advanceToSetAsideVillain,
  after,
  attachCard,
  attacksGainKeywords,
  boost,
  cards,
  chosen,
  constant,
  discard,
  discardEncounterUntil,
  encounterCards,
  endGame,
  enemyScheme,
  eventTarget,
  exists,
  firstPlayer,
  forcedInterrupt,
  forcedResponse,
  giveTough,
  hasStatus,
  ifThen,
  modifyAttack,
  moveCards,
  on,
  placeThreat,
  preventDamage,
  query,
  refMatches,
  replaceBoostCount,
  response,
  revealCard,
  rule,
  scenarioDeck,
  searchAndReveal,
  selectCards,
  self,
  setup,
  spend,
  stateCheck,
  stun,
  swapVillain,
  takeDamage,
  theMainScheme,
  theVillain,
  valueAtLeast,
  victoryCondition,
  victoryDisplayCount,
  whenDefeated,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  yourIdentity,
} from "../../dsl/index.js";
import { defineAbilities } from "../../dsl/index.js";
import { cardName } from "../names.js";

/**
 * The Loki scenario (docs/phase7-wave4.md §2.2, §3.7, §3.23, the box's fifth scenario): five random stage-I Loki
 * villain cards (21160–21164), All Hail King Loki → its own victory-display win condition (21165), the Loki
 * encounter set's side schemes (Casket of Ancient Winters, War in Asgard, Madness on Midgard, Open the Bifrost,
 * 21166–21169), Loki's own three attachments (Loki's Staff/Crown/Cape, 21170–21172; Master of Illusions, 21173) and
 * three treacheries (Devious Sorcery, Infinite Mischief, The Trickster, 21174–21176). Enchantress (`enchantress.ts`)
 * and Frost Giants (the Hela pass) are its two recommended modular sets.
 *
 * **The random start, the swap, and the victory count are all engine primitives already** (docs/phase7-wave4.md
 * §3.7, landed 2026-09-24): `GameSetupConfig.randomStartingVillain`/`victoryCondition` (wired for this scenario in
 * `../setup.ts`'s `buildMtsSingleVillain`), `EffectSpec swapVillain`/`advanceToSetAsideVillain`, `ValueSpec
 * victoryCondition`, and a defeated last-stage-with-Victory-X villain going to the victory display automatically
 * (`defeatVillainStage`). All Hail King Loki 1B's own two lines (the Forced Interrupt and the win condition) are
 * exactly the DSL shape `packages/cards/src/dsl/wave4-primitives.test.ts`'s own "§3.7 Loki" test already proves.
 *
 * **21165a's own Setup** ("Set each copy of the Loki villain aside… Reveal 1 set-aside Loki villain at random")
 * needs no ability body for those two sentences (the scenario config does them before any card ability runs); the
 * remaining two — "Put the War in Asgard side scheme into play" and "Reveal the top card of the infinity stone
 * deck" — are `searchAndReveal` (revealing a side scheme puts it into play, `enterPlayOnReveal`'s `case
 * "side_scheme"`, the same reading `infinity-gauntlet.ts`'s own docblock gives for an attachment's `setup` keyword)
 * and a plain `scenarioDeck` top-card reveal (revealing an environment also enters it into play, the same case's
 * `"environment"` branch) — no player is named, so `firstPlayer` (the same choice `thanos.ts`'s own
 * `putTopStoneIntoPlay(firstPlayer)` and `infinity-gauntlet.ts`'s own "otherwise" branch make for an unnamed
 * scenario-level reveal).
 *
 * **The five Loki villain cards' own "When Defeated"** ("discard cards from the top of the encounter deck until a
 * side scheme is discarded, reveal that side scheme") is the Core Standard set's own Rampage idiom
 * (`core/modular/standard.ts` 01192): `discardEncounterUntil` + `revealCard`.
 *
 * **The four side schemes' own "When Defeated"** ("Reveal the top card of the infinity stone deck. Swap Loki with a
 * random set-aside Loki villain.") is the top-of-stone-deck reveal (`firstPlayer`, as above) then a plain
 * `swapVillain()` — there is only ever one villain in play in this scenario, so the default `{ kind: "villain" }`
 * target needs no further scoping.
 *
 * **Loki's Staff's own Boost ("Attack this card to Loki")** is read as "Attach this card to Loki" — MarvelCDB's
 * `text`/`real_text` both print "Attack", but the sibling Loki's Crown prints the same boost line correctly
 * ("Attach this card to Loki"), the sentence is otherwise meaningless game language ("attack" a card onto a
 * villain isn't a defined action), and the two are otherwise identical Uru-item-style attachments (`attachesTo:
 * { kind: "namedVillain", name: "Loki" }`), so this is a MarvelCDB transcription slip, not a rules question.
 *
 * **"Hero Response: After you make a basic attack against Loki, spend … → discard this card"** (Loki's Staff/Crown/
 * Cape) is a plain `response`, not `heroResponse`, for the same reason `thanos.ts`'s own docblock gives for Thanos's
 * Armor/Helmet: `heroResponse`'s `form: "hero"` gate reads `controllerOf` first, which is always `null` for an
 * attachment on the villain — an uncontrolled card. A basic attack can only be made by a hero, so `query("hero")`
 * as the attacker is exactly as restrictive.
 *
 * **The Trickster's own "Loki activates against you"** is read as a scheme activation (`enemyScheme`), matching
 * `wave4-primitives.test.ts`'s own "§3.7 Loki" worked example for this exact card (21176) — unlike the reactive
 * "after X activates against you" idiom (read as an attack elsewhere, `wave2/scw/obligation-nemesis.ts`'s own
 * docblock), this is a forcing effect that must commit to one activation kind, and the DSL primitives test already
 * settled which for this card.
 *
 * **Infinite Mischief's own When Revealed** shuffles the Infinity Stone discard pile back into its deck on demand
 * (`scenarioDeckShuffle`, docs/phase7-wave4.md §3.49), distinct from the automatic empty-deck reset
 * (`ScenarioDeckState.whenEmpty`), then reveals the top card.
 */

const STONE_DECK = "Infinity Stone";
const SIDE_SCHEME_SWAP = () => [
  selectCards("stone", scenarioDeck(STONE_DECK, { top: 1 })),
  revealCard(chosen("stone"), firstPlayer),
  swapVillain(),
];
const LOKI_WHEN_DEFEATED = () =>
  whenDefeated(discardEncounterUntil(query("sideScheme"), "found"), revealCard(chosen("found")));
/** "Hero Response: After you make a basic attack against Loki, spend … → discard this card" (Loki's Staff/Crown/
 * Cape; the module docblock's own reasoning for a plain `response` over `heroResponse`). */
const afterBasicAttackOnLoki = (cost: Parameters<typeof spend>[0]) =>
  response(
    after.attacks(query("hero"), { basic: true, target: query("villain") }),
    { cost: spend(cost) },
    discard(self),
  );

export const LOKI = defineAbilities({
  // All Hail King Loki 1A (21165a) — Setup: the two RNG-driven sentences are the scenario config's own
  // (`randomStartingVillain`); the remaining two are below (module docblock).
  "21165a.setup": setup(
    searchAndReveal(cardName("21167"), ["deck"]),
    selectCards("stone", scenarioDeck(STONE_DECK, { top: 1 })),
    revealCard(chosen("stone"), firstPlayer),
  ),

  // All Hail King Loki 1B (21165b) — Forced Interrupt: When Loki is defeated, advance to a random set-aside Loki
  // villain. If the number of Lokis in the victory display is equal to the victory condition, the players win the
  // game. (See rule insert.) If this stage is completed, the players lose the game (`completionLoses`, data).
  "21165b.all-hail-king-loki-forced-interrupt": forcedInterrupt(
    on.defeated(query("villain", { name: "Loki" })),
    advanceToSetAsideVillain(eventTarget),
  ),
  "21165b.all-hail-king-loki-constant": stateCheck(
    valueAtLeast(victoryDisplayCount(query("villain", { name: "Loki" })), victoryCondition),
    endGame("win"),
  ),

  // Loki (I, 21160) — Victory 1 (data). Loki cannot take damage while a side scheme is in play. When Defeated:
  // discard cards from the top of the encounter deck until a side scheme is discarded. Reveal that side scheme.
  "21160.loki-constant": constant(
    rule({ kind: "cannotTakeDamage", target: { self: true }, while: exists(query("sideScheme")) }),
  ),
  "21160.when-defeated": LOKI_WHEN_DEFEATED(),
  // Loki (II, 21161) — Retaliate 1, Victory 1 (data). Same When Defeated.
  "21161.when-defeated": LOKI_WHEN_DEFEATED(),
  // Loki (III, 21162) — Stalwart, Victory 1 (data). Same When Defeated.
  "21162.when-defeated": LOKI_WHEN_DEFEATED(),
  // Loki (IV, 21163) — Stalwart, Victory 1 (data). Same When Defeated.
  "21163.when-defeated": LOKI_WHEN_DEFEATED(),
  // Loki (V, 21164) — Victory 1 (data). Loki's attacks gain piercing. Same When Defeated.
  "21164.loki-constant": constant(attacksGainKeywords(["piercing"], { attacker: { self: true } })),
  "21164.when-defeated": LOKI_WHEN_DEFEATED(),

  // Casket of Ancient Winters / War in Asgard / Madness on Midgard / Open the Bifrost (side schemes, 21166–21169;
  // Hinder 1[per_hero] is data) — When Defeated: Reveal the top card of the infinity stone deck. Swap Loki with a
  // random set-aside Loki villain.
  "21166.when-defeated": whenDefeated(...SIDE_SCHEME_SWAP()),
  "21167.when-defeated": whenDefeated(...SIDE_SCHEME_SWAP()),
  "21168.when-defeated": whenDefeated(...SIDE_SCHEME_SWAP()),
  "21169.when-defeated": whenDefeated(...SIDE_SCHEME_SWAP()),

  // Loki's Staff (attachment, 21170; Attach to Loki is data) — Hero Response as above. [star] Boost: Attach this
  // card to Loki (module docblock: read over the raw "Attack this card to Loki").
  "21170.lokis-staff-response": afterBasicAttackOnLoki({ energy: 1, physical: 1 }),
  "21170.boost": boost(attachCard(self, theVillain)),

  // Loki's Crown (attachment, 21171; Attach to Loki is data) — same shape.
  "21171.lokis-crown-response": afterBasicAttackOnLoki({ mental: 1, physical: 1 }),
  "21171.boost": boost(attachCard(self, theVillain)),

  // Loki's Cape (attachment, 21172; Attach to Loki is data) — Forced Response: After Loki is swapped with a
  // set-aside Loki villain, give him a tough status card. Hero Response as above.
  "21172.lokis-cape-forced-response": forcedResponse(on.villainSwapped(), giveTough(theVillain)),
  "21172.lokis-cape-response": afterBasicAttackOnLoki({ energy: 1, mental: 1 }),

  // Master of Illusions (attachment, 21173; Attach to Loki is data) — Forced Interrupt: When Loki would take damage
  // from an attack, discard the top card of the encounter deck. If that card is a treachery, prevent all damage
  // from this attack and discard this card (the Thor nemesis Loki's own "would be defeated" shape,
  // `wave1/thor/nemesis.ts` 06028, over damage instead of defeat). `refMatches` only matches an *in-play* card by
  // default (`RefMatches`'s own `anywhere` option); the discarded top card never is one, so this needs
  // `{ anywhere: true }` where 06028's own version (checked against a live, in-play minion) doesn't.
  "21173.master-of-illusions-forced-interrupt": forcedInterrupt(
    on.damage("host", { fromAttack: true }),
    moveCards(encounterCards(["deck"], undefined, 1), "discard", "flipped"),
    ifThen(refMatches(chosen("flipped"), query("treachery"), { anywhere: true }), [preventDamage(), discard(self)]),
  ),

  // Devious Sorcery (treachery x2, 21174) — When Revealed (Alter-Ego): You are stunned. If you were already
  // stunned, place 2 threat on the main scheme. When Revealed (Hero): You are stunned. If you were already
  // stunned, take 2 damage. ("Already" read before this card's own stun, the Monster/red-skull precedent.)
  "21174.when-revealed-alter-ego": whenRevealedAlterEgo(
    ifThen(hasStatus(yourIdentity, "stunned"), placeThreat(2, theMainScheme), stun(yourIdentity)),
  ),
  "21174.when-revealed-hero": whenRevealedHero(
    ifThen(hasStatus(yourIdentity, "stunned"), takeDamage(2), stun(yourIdentity)),
  ),

  // Infinite Mischief (treachery x2, 21175) — When Revealed: Shuffle the infinity stone deck discard pile into the
  // infinity stone deck (`scenarioDeckShuffle`, docs/phase7-wave4.md §3.49) and reveal the top card. [star] Boost:
  // Discard the top card of the infinity stone deck. Apply its boost icons for this activation as if it were a boost
  // card (`replaceBoostCount`, `thanos.ts`'s own "I Am Inevitable" shape).
  "21175.when-revealed": whenRevealed(
    moveCards(scenarioDeck(STONE_DECK, { zones: ["discard"] }), "scenarioDeckShuffle"),
    selectCards("stone", scenarioDeck(STONE_DECK, { top: 1 })),
    revealCard(chosen("stone")),
  ),
  "21175.boost": boost(
    selectCards("stone", scenarioDeck(STONE_DECK, { top: 1 })),
    moveCards(cards(chosen("stone")), "discard"),
    replaceBoostCount(chosen("stone")),
  ),

  // The Trickster (treachery x3, 21176) — When Revealed: Swap Loki with a random set-aside Loki villain. Loki
  // activates against you (module docblock: read as a scheme). [star] Boost: Give Loki an additional boost card and
  // a tough status card.
  "21176.when-revealed": whenRevealed(swapVillain(), enemyScheme(theVillain)),
  "21176.boost": boost(modifyAttack({ extraBoostCards: 1 }), giveTough(theVillain)),
});
