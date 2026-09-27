import { trait } from "@mc/content";
import {
  after,
  boost,
  bindTargets,
  cards,
  chooseTarget,
  chosen,
  constant,
  dealIndirectDamage,
  defineAbilities,
  enemyActivates,
  exhaust,
  forcedResponse,
  gainsKeyword,
  host,
  ifThen,
  inPlay,
  modifyAttack,
  moveCards,
  not,
  oncePerRoundPerPlayer,
  printedCostOf,
  query,
  removeCounter,
  searchAndReveal,
  selectCards,
  superlative,
  theVillain,
  whenRevealed,
  you,
  zone,
} from "../../../dsl/index.js";

const TECH = trait("TECH");

/**
 * Goblin Gear (`sm` 27136–27141, docs/phase7-wave5.md §2.2): the recommended modular set for the Venom Goblin
 * scenario (MC27 p. 20's own scenario card lists it alongside Osborn Tech) — Advanced Glider, Concussive Bombs,
 * Incendiary Bombs, Smoke Bombs, Limitless Supply, Remote Navigation.
 *
 * **Advanced Glider's Hero Action is not implemented — engine gap, see the docblock above its own entry below.**
 */
export const GOBLIN_GEAR = defineAbilities({
  // Advanced Glider (27136, attachment; ATK/boost icons are data, "Attach to the villain" is the ordinary implicit
  // attach rule — no ability needed) — [star] Forced Response: after attached villain activates against you, it
  // activates against you again (limit once per round per player). `host` is the attached villain (RRG 1.8
  // "Activation", p. 6, docs/phase7-wave5.md §4.1 Q67 for "activates against you" covering both attacks and
  // schemes); `afterCurrentActivation` queues the repeat behind the one that triggered it, the same "gains an
  // extra activation, nested rather than simultaneous" shape as Hydra Jet-Trooper's own boost
  // (`wave2/trors/red-skull.ts` 04146).
  "27136.advanced-glider-forced-response": forcedResponse(
    after.enemyActivates("host", { againstYou: true }),
    { limit: oncePerRoundPerPlayer },
    enemyActivates(host, { against: you, afterCurrentActivation: true }),
  ),
  // Advanced Glider — [star] Hero Action: Discard any number of attack cards from your hand with a combined
  // resource cost of 3 or more → discard this card. **Skipped — engine gap**: every existing cost primitive that
  // picks cards from hand (`discardFromHandCost`, `AbilityCost.discardFromHand`) counts *cards*, min/max, never a
  // running sum of the chosen cards' own printed resource cost; there is also no effect-side selector that sums a
  // player's own free choice of hand cards against a target total the way `AbilityCost` would need to validate the
  // payment. Needs a new `AbilityCost` shape (e.g. `discardFromHandCombinedCost`) that lets the player pick any
  // number of matching hand cards and pays only if their summed printed cost meets a minimum — a
  // `game-rules-architect` primitive, not expressible by composing what exists today.

  // Concussive Bombs (27137, attachment; ATK+1/boost icons are data) — Attach to the villain (implicit). Uses (2
  // bomb counters). [star] Forced Response: After the villain attacks you, remove 1 bomb counter from here →
  // exhaust 1 upgrade and 1 support you control. Card data's own id says "-constant" for this — the printed "Uses
  // (2 bomb counters.)" sentence prints its closing period *inside* the parenthetical (unlike every other "Uses"
  // card in the corpus, e.g. `27078` "Uses (2 rage counters)."), which is why `parse-text.ts`'s `/^Uses \(...\)\.?$/`
  // regex never recognized it as the keyword and the curation pipeline instead left it as unscripted constant text
  // under this id (Common Criminal's own "-constant" misnomer, `down-to-earth.ts` 27131, is the same class of
  // pipeline artifact) — confirmed against the card's own scan (`assets/card-art/bundles/cards/27137.png`): "Uses
  // (2 bomb counters.)" is exactly how it is printed, not a MarvelCDB transcription error to correct. Scripted here
  // as the keyword grant itself rather than as a `packages/content` curation fix, so the fix stays inside this
  // pack's own ability id and doesn't touch the shared generated `sm/cards.ts` file mid-wave.
  "27137.concussive-bombs-constant": constant(
    gainsKeyword({ name: "uses", count: 2, counterType: "bomb" }, { self: true }),
  ),
  "27137.concussive-bombs-forced-response": forcedResponse(
    after.villainAttacks({ againstYou: true }),
    { cost: removeCounter("bomb", 1) },
    chooseTarget("upgrade", query("upgrade", { controller: "you" })),
    exhaust(chosen("upgrade")),
    chooseTarget("support", query("support", { controller: "you" })),
    exhaust(chosen("support")),
  ),

  // Incendiary Bombs (27138, attachment; ATK+1/boost icons are data) — Attach to the villain (implicit). Uses (2
  // bomb counters), same printed-punctuation gap as Concussive Bombs above (scan:
  // `assets/card-art/bundles/cards/27138.png`). [star] Forced Response: After the villain attacks you, remove 1
  // bomb counter from here → take 2 indirect damage.
  "27138.incendiary-bombs-constant": constant(
    gainsKeyword({ name: "uses", count: 2, counterType: "bomb" }, { self: true }),
  ),
  "27138.incendiary-bombs-forced-response": forcedResponse(
    after.villainAttacks({ againstYou: true }),
    { cost: removeCounter("bomb", 1) },
    dealIndirectDamage(you, 2),
  ),

  // Smoke Bombs (27139, attachment; ATK+1/boost icons are data) — Attach to the villain (implicit). Uses (2 bomb
  // counters), same printed-punctuation gap as Concussive Bombs above (scan:
  // `assets/card-art/bundles/cards/27139.png`). [star] Forced Response: After the villain attacks you, remove 1
  // bomb counter from here → discard 1 event from your hand with the lowest cost. `each(query(...))`/`superlative`
  // only reaches cards in play (`selectTargets`'s own `cardsInPlay`, `packages/engine/src/select.ts`), so the pool
  // is gathered with `selectCards`/`zone("hand", ...)` first and `superlative` measures over that bound slot
  // instead (`TargetRef superlative`'s own "or a slot an earlier `selectCards` bound" reading,
  // `packages/engine/src/spec.ts`). No `chooseTarget` step (unlike High Fashion's own lowest-cost pick,
  // `sinister-six/treacheries.ts` 27060, whose pool is in play): `chooseTarget`'s own legal-target list is always
  // `selectTargets`, i.e. `cardsInPlay` again (`effects-frame.ts` `requestTargetChoice`), so it can never resolve
  // a hand card even filtered by `inSlot` — going straight from the bound `lowest` slot (already exactly one card,
  // `ties: "first"`) to `moveCards` avoids that same in-play-only limitation a second time.
  "27139.smoke-bombs-constant": constant(gainsKeyword({ name: "uses", count: 2, counterType: "bomb" }, { self: true })),
  "27139.smoke-bombs-forced-response": forcedResponse(
    after.villainAttacks({ againstYou: true }),
    { cost: removeCounter("bomb", 1) },
    selectCards("candidates", zone("hand", you, { filter: query("event") })),
    bindTargets(
      "lowest",
      superlative("lowest", chosen("candidates"), printedCostOf(chosen("candidate")), { ties: "first" }),
    ),
    moveCards(cards(chosen("lowest")), "discard"),
  ),

  // Limitless Supply (27140, side scheme; startingThreat 5/3 boost icons are data) — Each Tech attachment gains
  // surge.
  "27140.limitless-supply-constant": constant(gainsKeyword({ name: "surge" }, query("attachment", { trait: TECH }))),

  // Remote Navigation (27141, treachery; star icon/no boost icons are data) — When Revealed: If Advanced Glider is
  // in play, the villain activates against you. If it is not in play, search the encounter deck and discard pile
  // for Advanced Glider and reveal it. [star] Boost: Give the villain 2 additional boost cards for this activation.
  // Raw text says "search ... for Advance Glider" — a dropped "d" (confirmed against the card's own scan,
  // `assets/card-art/bundles/cards/27141.png`: "...search the encounter deck and discard pile for Advanced Glider
  // and reveal it."), read here by the card's real name rather than corrected in `packages/content`, the same
  // reasoning as the Uses-keyword gap above. `searchAndReveal`'s own "reveal it" already shuffles the encounter
  // deck after (RRG 1.8 "Search", p. 39), matching the printed effect exactly even though this card's own sentence
  // never says "(Shuffle.)" in so many words.
  "27141.when-revealed": whenRevealed(
    ifThen(inPlay("Advanced Glider"), enemyActivates(theVillain, { against: you })),
    ifThen(not(inPlay("Advanced Glider")), searchAndReveal("Advanced Glider")),
  ),
  "27141.boost": boost(modifyAttack({ extraBoostCards: 2 })),
});

export const GOBLIN_GEAR_SKIPPED = ["27136.advanced-glider-action"] as const;
