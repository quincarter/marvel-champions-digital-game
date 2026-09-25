import { trait } from "@mc/content";
import {
  action,
  after,
  attack,
  attackAnEnemy,
  cards,
  chooseCards,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  costModifier,
  dealDamage,
  defineAbilities,
  discardDeckUntil,
  distinctAspectsOf,
  draw,
  each,
  eventSource,
  gets,
  heal,
  heroAction,
  heroResponse,
  ifElse,
  interrupt,
  modifyAttack,
  moveCards,
  on,
  option,
  paidWith,
  payPrintedCostOf,
  putIntoPlay,
  query,
  ready,
  removeThreat,
  response,
  selectCards,
  self,
  spend,
  statOf,
  sum,
  theMainScheme,
  theVillain,
  thwart,
  thwartAScheme,
  topOfDeck,
  uncancellable,
  type EffectArg,
  whenRevealed,
  you,
  YOUR_HERO,
  yourIdentity,
  youHaveTrait,
  zone,
} from "../../dsl/index.js";

const GUARDIAN = trait("GUARDIAN");

/**
 * "Discard up to N cards from the top of your deck → …" (Karmic Blast, Cosmic Awareness, Magic Attack, Zone of
 * Silence): the docs/phase7-wave4.md §3.12 composition — a `chooseOne` of 1..max, each `selectCards(topOfDeck(n))`
 * then `moveCards` to the discard pile. **The dependent effect (reading `chosen("discarded")`) has to be inside the
 * same `chooseOne` option, not a sibling after it**: `executeChooseOne` (`packages/engine/src/resolve/apply-effect.
 * ts`/`effects-frame.ts`) pushes a chosen option's own effects as a *child* frame, and a `selectCards` binding
 * written there (`updateFrame` on that child's own `frame.frameId`) never propagates back up to the parent frame a
 * sibling effect after the `chooseOne` would read — found by testing, not assumed (Magic Attack dealt 0 damage until
 * this was fixed). `effectFor(n)` gets the option's own literal count `n` to build the dependent effect with.
 */
const discardUpTo = (max: number, effectFor: (n: number) => EffectArg) =>
  chooseOne(
    ...Array.from({ length: max }, (_, i) => i + 1).map((n) =>
      option(
        `Discard ${n}`,
        selectCards("discarded", topOfDeck(n)),
        moveCards(cards(chosen("discarded")), "discard"),
        effectFor(n),
      ),
    ),
  );

/**
 * Adam Warlock's precon's aspect and basic cards (21038–21065, MC21 p. 3): 6 from each of aggression/justice/
 * leadership/protection plus Martinex (basic). Several reuse a card the pool already scripted elsewhere under a
 * different printed id — the docblock on each entry names the reprint.
 *
 * **Shield Spell (21061) is a primitive gap, not scripted**: "discard that many cards from the top of your deck"
 * (equal to the amount of damage this interrupt prevents) needs a dynamic `AbilityCost.discardFromDeck`, which is a
 * fixed `number` (`packages/engine/src/abilities.ts`), not a `ValueSpec` reading the triggering event's amount — see
 * `KNOWN_SKIPPED["mts"]`.
 */
export const ADAM_WARLOCK_PACK_CARDS = defineAbilities({
  // Karmic Blast (21038) — Hero Action (attack): Deal 4 damage to an enemy and discard up to 4 cards from the top
  // of your deck → deal 1 additional damage for each different aspect discarded this way (the exact composition
  // docs/phase7-wave4.md §3.12/`dsl/wave4-primitives.test.ts` gives for this card).
  "21038.karmic-blast-action": heroAction(
    { label: "attack" },
    chooseTarget("enemy", query("enemy")),
    discardUpTo(4, () => attack(sum(4, distinctAspectsOf(chosen("discarded"))), chosen("enemy"))),
  ),

  // Cosmic Awareness (21039) — Hero Action (thwart): Remove 3 threat from a scheme and discard up to 4 cards from
  // the top of your deck → remove 1 additional threat for each different aspect discarded this way.
  "21039.cosmic-awareness-action": heroAction(
    { label: "thwart" },
    chooseTarget("scheme", query("scheme")),
    discardUpTo(4, () => thwart(sum(3, distinctAspectsOf(chosen("discarded"))), chosen("scheme"))),
  ),

  // Quantum Magic (21040) — Action: Choose a card in your discard pile → add that card to your hand.
  "21040.quantum-magic-action": action(
    chooseCards("card", zone("discard", you), { min: 1, max: 1 }),
    moveCards(cards(chosen("card")), "hand"),
  ),

  // Marvel Boy (ally, 21041) — Interrupt: When Marvel Boy attacks, spend a [physical] resource → this attack gains
  // piercing and ranged (the Crossfire/§3.21 `modifyAttack({ keywords })` shape).
  "21041.marvel-boy-interrupt": interrupt(
    { on: "attack", selfIs: "source" },
    { cost: spend({ physical: 1 }) },
    modifyAttack({ keywords: ["piercing", "ranged"] }),
  ),

  // In-Betweener (21042) — Cosmic Entity. Action: Shuffle this card into the encounter deck (without looking). When
  // Revealed: Deal 2 damage to the villain and remove this card from the game. This effect cannot be canceled
  // (docs/phase7-wave4.md §3.14, the exact composition its own primitive test gives for this card).
  "21042.in-betweener-action": action(moveCards(cards(self), "encounterDeckShuffle")),
  "21042.when-revealed": uncancellable(
    whenRevealed(dealDamage(2, theVillain), moveCards(cards(self), "removedFromGame")),
  ),

  // Magic Attack (21043) — Play only if your identity has the Mystic trait. Max 1 per deck (data). Hero Action
  // (attack): Choose an enemy and discard up to 5 cards from the top of your deck → deal 1 damage to that enemy for
  // each card discarded this way.
  "21043.magic-attack-action": heroAction(
    { label: "attack" },
    chooseTarget("enemy", query("enemy")),
    discardUpTo(5, (n) => attack(n, chosen("enemy"))),
  ),

  // Uppercut (21044) — Core's own Uppercut (01054), reprinted verbatim.
  "21044.uppercut-action": heroAction({ label: "attack" }, attackAnEnemy(5)),

  // Combat Training (21045) — Core's own Combat Training (01057), reprinted verbatim.
  "21045.combat-training-constant": constant(gets("atk", 1, YOUR_HERO)),

  // Audacity (resource, 21046) — Max 1 per deck (data). Hero Response: After you spend this card, deal 1 damage to
  // the villain.
  "21046.audacity-response": heroResponse(on.youSpendThis(), dealDamage(1, theVillain)),

  // Quasar (ally, 21047) — Response: After Quasar enters play, remove 1 threat from each scheme in play.
  "21047.quasar-response": response(on.entersPlay("self"), removeThreat(1, each(query("scheme")))),

  // Living Tribunal (21048) — Cosmic Entity. When Revealed: Remove 2 threat from the main scheme and remove this
  // card from the game.
  "21048.living-tribunal-action": action(moveCards(cards(self), "encounterDeckShuffle")),
  "21048.when-revealed": uncancellable(
    whenRevealed(removeThreat(2, theMainScheme), moveCards(cards(self), "removedFromGame")),
  ),

  // For Justice! (21049) — Core's own For Justice! (01060), reprinted verbatim.
  "21049.for-justice-action": heroAction({ label: "thwart" }, thwartAScheme(ifElse(paidWith("mental"), 4, 3))),

  // Zone of Silence (21050) — Play only if your identity has the Mystic trait. Max 1 per deck (data). Hero Action
  // (thwart): Choose a scheme and discard up to 4 cards from the top of your deck → remove 1 threat for each card
  // discarded this way.
  "21050.zone-of-silence-action": heroAction(
    { label: "thwart" },
    chooseTarget("scheme", query("scheme")),
    discardUpTo(4, (n) => thwart(n, chosen("scheme"))),
  ),

  // Heroic Intuition (21051) — Core's own Heroic Intuition (01065), reprinted verbatim.
  "21051.heroic-intuition-constant": constant(gets("thw", 1, YOUR_HERO)),

  // Determination (resource, 21052) — Max 1 per deck (data). Hero Response: After you spend this card, remove 1
  // threat from the main scheme (`nebu` 22016's own reprint of this card).
  "21052.determination-response": heroResponse(on.youSpendThis(), removeThreat(1, theMainScheme)),

  // Major Victory (ally, 21053) — Interrupt: When Major Victory is defeated, choose a friendly Guardian character →
  // ready that character.
  "21053.major-victory-interrupt": interrupt(
    on.defeated("self"),
    chooseTarget("char", query(["hero", "ally"], { controller: "you", trait: GUARDIAN })),
    ready(chosen("char")),
  ),

  // Eternity (21054) — Cosmic Entity. When Revealed: Draw 1 card and remove this card from the game.
  "21054.eternity-action": action(moveCards(cards(self), "encounterDeckShuffle")),
  "21054.when-revealed": uncancellable(whenRevealed(draw(1), moveCards(cards(self), "removedFromGame"))),

  // Summoning Spell (21055) — Play only if your identity has the Mystic trait. Max 1 per deck (data). Hero Action:
  // Discard cards from the top of your deck until you discard an ally → put that ally into play under your control.
  "21055.summoning-spell-action": heroAction(
    discardDeckUntil(query("ally"), "found"),
    putIntoPlay(chosen("found"), you),
  ),

  // Make the Call (21056) — Core's own Make the Call (01071), reprinted verbatim.
  "21056.make-the-call-action": action(
    { cost: payPrintedCostOf("ally", { zone: "discard", player: "any", query: query("ally") }, { entersPlay: true }) },
    putIntoPlay(chosen("ally"), you),
  ),

  // Inspired (21057) — Core's own Inspired (01074), reprinted verbatim.
  "21057.inspired-constant": constant(gets("thw", 1, { hostOfSelf: true }), gets("atk", 1, { hostOfSelf: true })),

  // Innovation (resource, 21058) — Max 1 per deck (data). Hero Response: After you spend this card, heal 1 damage
  // from an ally you control.
  "21058.innovation-response": heroResponse(
    on.youSpendThis(),
    chooseTarget("ally", query("ally", { controller: "you" })),
    heal(1, chosen("ally")),
  ),

  // Charlie-27 (21059) — Retaliate 1, Toughness (data). No ability text.

  // The Gardener (21060) — Cosmic Entity. When Revealed: Heal 2 damage from your identity and remove this card from
  // the game.
  "21060.the-gardener-action": action(moveCards(cards(self), "encounterDeckShuffle")),
  "21060.when-revealed": uncancellable(whenRevealed(heal(2, yourIdentity), moveCards(cards(self), "removedFromGame"))),

  // Shield Spell (21061): see module docblock — KNOWN_SKIPPED.

  // Counter-Punch (21062) — Core's own Counter-Punch (01077), reprinted verbatim.
  "21062.counter-punch-response": response(
    after.defends(YOUR_HERO),
    { label: "attack" },
    attack(statOf(yourIdentity, "atk"), eventSource),
  ),

  // Armored Vest (21063) — Core's own Armored Vest (01081), reprinted verbatim.
  "21063.armored-vest-constant": constant(gets("def", 1, YOUR_HERO)),

  // Preservation (resource, 21064) — Max 1 per deck (data). Hero Response: After you spend this card, heal 1 damage
  // from your hero.
  "21064.preservation-response": heroResponse(on.youSpendThis(), heal(1, yourIdentity)),

  // Martinex (ally, 21065) — Reduce the cost to play Martinex by 1 if your identity has the Guardian trait.
  "21065.martinex-constant": constant(
    costModifier({
      delta: -1,
      appliesTo: query("ally", { self: true }),
      while: youHaveTrait(GUARDIAN),
      activeIn: "hand",
    }),
  ),
});
