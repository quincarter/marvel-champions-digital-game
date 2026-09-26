import { trait } from "@mc/content";
import {
  action,
  addCounters,
  after,
  choosePlayer,
  chooseCards,
  chooseOne,
  chosen,
  chosenPlayer,
  cards,
  constant,
  costModifier,
  countOf,
  defineAbilities,
  discard,
  discardFromHand,
  draw,
  exhaustThis,
  exists,
  forcedResponse,
  gets,
  heroResponse,
  max,
  min,
  modifyStat,
  moveCards,
  not,
  on,
  option,
  query,
  ready,
  reduceNextCardCost,
  removeUpToCounters,
  response,
  rule,
  scaled,
  self,
  shuffleDeck,
  varOf,
  villainStageNumberOf,
  you,
  yourIdentity,
  zone,
  generatesPerCard,
  heroAction,
  exhaustCardsCost,
  anAttackableEnemy,
  attack,
  sum,
  totalStatOf,
  statOf,
} from "../../dsl/index.js";

const AVENGER = trait("AVENGER");

/**
 * Spectrum's precon Leadership/basic cards (21011–21025, MC21 p. 3). Several reuse a card the pool already scripted
 * under a different printed id (same image, same text) — the docblock on each entry names the reprint.
 *
 * **Mass Attack (21016)** sums the three allies' ATK with `totalStatOf` (docs/phase7-wave4.md §3.41).
 *
 * **Band Together (21018)** is `handGenerates: generatesPerCard(...)` (docs/phase7-wave4.md §3.38).
 */
export const SPECTRUM_PACK_CARDS = defineAbilities({
  // Captain America (21011) — Toughness (data). Reduce the cost to play Captain America by 1 for each avenger
  // character you control (the Hercules shape, `wave1/thor/pack-cards.ts` `06011.hercules-constant`).
  "21011.captain-america-constant": constant(
    costModifier({
      delta: scaled(countOf(query("character", { controller: "you", trait: AVENGER })), { times: -1 }),
      appliesTo: query("ally", { self: true }),
      activeIn: "hand",
    }),
  ),

  // Power Man (21012) — enters play with 2 chi counters (the Hawkeye/Iron Fist shape, `core/aspects/leadership.ts`).
  // Action: discard any number of chi counters from Power Man → he gets +2 ATK for each chi counter discarded this
  // way until the end of the phase.
  "21012.power-man-constant": forcedResponse(after.entersPlay("self"), addCounters("chi", 2)),
  "21012.power-man-action": action(
    { cost: removeUpToCounters("chi", 2, { bind: "n" }) },
    modifyStat("atk", scaled(varOf("n"), { times: 2 }), self, "endOfPhase"),
  ),

  // White Tiger (21013) — Response: After you play White Tiger from your hand, draw X cards (max 3), where X is the
  // villain's stage number, or 1 with no stage number.
  "21013.white-tiger-response": heroResponse(on.youPlayThis(), draw(min(max(villainStageNumberOf(), 1), 3))),

  // Kaluu (21014) — Response: After Kaluu enters play, search the top 5 cards of your deck for an event → add it to
  // your hand. Shuffle your deck (the Brother Voodoo shape, `wave1/drs/pack-cards.ts` `09012.brother-voodoo-response`).
  "21014.kaluu-response": response(
    after.entersPlay("self"),
    chooseCards("found", zone("deck", you, { top: 5, filter: query("event") }), { min: 1, max: 1 }),
    moveCards(cards(chosen("found")), "hand"),
    shuffleDeck(),
  ),

  // Mighty Avengers (21015) — Play under any player's control. Max 1 Team per player (data). If each of your
  // characters has the Avenger trait, each ally you control gets +1 THW and +1 ATK. Two ability ids per the printed
  // "+1 THW and +1 ATK" split (the Avengers Tower/`cap` shape for the vacuous "each of your X" condition).
  "21015.mighty-avengers-constant": constant(
    gets("thw", 1, query("ally", { controller: "you" }), {
      while: not(exists(query("character", { controller: "you", withoutTrait: AVENGER }))),
    }),
  ),
  "21015.mighty-avengers-constant-2": constant(
    gets("atk", 1, query("ally", { controller: "you" }), {
      while: not(exists(query("character", { controller: "you", withoutTrait: AVENGER }))),
    }),
  ),

  // Mass Attack (21016) — Hero Action (attack): Exhaust 3 allies you control that share a Trait with your hero → deal
  // X damage to an enemy, where X is the total ATK of those allies and your hero (`totalStatOf`, docs/phase7-wave4.md
  // §3.41).
  "21016.mass-attack-action": heroAction(
    {
      label: "attack",
      cost: exhaustCardsCost(query("ally", { sharesTraitWith: yourIdentity }), { min: 3, max: 3, slot: "allies" }),
    },
    anAttackableEnemy("enemy"),
    attack(sum(totalStatOf(chosen("allies"), "atk"), statOf(yourIdentity, "atk")), chosen("enemy")),
  ),

  // Moxie (21017) — Hero Response: After you change form, your hero gets +1 THW, +1 ATK, +1 DEF until the end of
  // the round (`wave2/ant/pack-cards.ts` `12016.moxie-response`, reprinted verbatim).
  "21017.moxie-response": heroResponse(
    on.youChangeForm(),
    modifyStat("thw", 1, yourIdentity, "endOfRound"),
    modifyStat("atk", 1, yourIdentity, "endOfRound"),
    modifyStat("def", 1, yourIdentity, "endOfRound"),
  ),

  // Band Together (21018) — This card generates [wild] for each ally you control (to a maximum of 3) (`handGenerates`,
  // docs/phase7-wave4.md §3.38).
  "21018.band-together-constant": constant({
    handGenerates: generatesPerCard("wild", query("ally", { controller: "you" }), 3),
  }),

  // Blade (21019) — [star] Forced Response: After Blade thwarts or attacks, choose to either spend a [physical]
  // resource from your hand or discard Blade.
  "21019.blade-forced-response": forcedResponse(
    on.attacksOrThwarts("self"),
    chooseOne(
      option(
        "Spend a [physical] resource from your hand",
        discardFromHand(1, you, { filter: { anyPrintedResource: ["physical"] } }),
      ),
      option("Discard Blade", discard(self)),
    ),
  ),

  // Avengers Tower (21020) — the `cap` pack's own Avengers Tower (03024), reprinted verbatim.
  "21020.avengers-tower-constant": constant(
    rule({
      kind: "allyLimit",
      amount: 1,
      while: not(exists(query("ally", { controller: "you", withoutTrait: AVENGER }))),
    }),
  ),
  "21020.avengers-tower-action": action(
    { cost: exhaustThis },
    reduceNextCardCost(you, 1, "phase", { categories: ["ally"], trait: AVENGER }),
  ),

  // Avengers Mansion (21021) — Core's own Avengers Mansion (01091), reprinted verbatim: Action: exhaust it → choose
  // a player, who draws 1 card.
  "21021.avengers-mansion-action": action({ cost: exhaustThis }, choosePlayer(), draw(1, chosenPlayer())),

  // Ready to Rumble (21022) — Play under any player's control. Max 1 per player (data). Hero Response: After you
  // change form, discard this card → ready your hero.
  "21022.ready-to-rumble-response": heroResponse(on.youChangeForm(), discard(self), ready(yourIdentity)),

  // Loss of Control (21026), Radioactive Man (21027) etc. are `spectrum-obligation-nemesis.ts`.
});
