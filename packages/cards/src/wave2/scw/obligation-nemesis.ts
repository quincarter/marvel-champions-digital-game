import {
  chooseCards,
  chosen,
  costModifier,
  constant,
  dealEncounterCard,
  defineAbilities,
  discard,
  discardEncounterCards,
  encounterCards,
  enemyAttack,
  exhaustYourHero,
  forcedResponse,
  gets,
  heroAction,
  ifThen,
  on,
  placeThreat,
  putIntoPlay,
  query,
  self,
  theMainScheme,
  valueAtLeast,
  varOf,
  whenRevealed,
  you,
} from "../../dsl/index.js";
import { obligation } from "../../core/obligations.js";
import { cardName } from "../names.js";

/**
 * Slipping Sanity (15023), Scarlet Witch's obligation (`quantity: 2`, both copies shuffled in per docs/phase7-
 * wave2.md §1.10), and her nemesis set: The Next Evolution (15024), Luminous (15025), Magical Suspension (15026),
 * Chaos Manipulation (15027).
 *
 * **`15023.obligation` is now scripted** (docs/phase7-wave2.md §18.6/§24, landed after `card-data-pipeline` added
 * `starIcon?: boolean` — a printed characteristic, backfilled for 159 cards, distinct from `boostIcons`). "• Discard
 * the top 5 cards of the encounter deck. For each **star icon** ([star]) **in the boost area** discarded this way,
 * place 1 threat on the main scheme. Discard this obligation." is the Core obligation shape (`core/obligations.ts`'s
 * `obligation()` helper: "give to X, may flip, exhaust-to-remove-or-alternative") with `discardEncounterCards(5,
 * { bind: "sanity" })` + `placeThreat(varOf("sanity.starIcons"), theMainScheme)` as the alternative — the same
 * `<bind>.boostIcons`-shaped total `discardEncounterCards` already exposed, with a `.starIcons` sibling (§24.3).
 * RRG 1.8 "Boost" (p. 11): "A star icon is not itself considered a boost icon" — `starIcons` and `boostIcons` count
 * independently (§24's own correction: only 43 of the pool's 159 starred cards print both; a typo swapping one for
 * the other would still pass on a pile where the two happen to agree, docs/card-scripting-process.md §7).
 *
 * **The Next Evolution (15024)** — "Increase the number of boost icons on each encounter card by 1" is the exact
 * card docs/phase7-wave2.md §3.6 names as the constant-modifier half of the boost-icon-counting primitive: a
 * `boostIcons` stat modifier (`gets`) targeting every encounter-controlled card (`{ controller: "encounter" }`),
 * read by `boostIconsFor` (`packages/engine/src/modifiers.ts`) wherever a card's icons are counted — an activation's
 * boost step or a card effect's own `<bind>.boostIcons` read alike, since both go through the same function.
 *
 * **Luminous (15025)** — "After Luminous activates against you" is `on.enemyAttacks("self", { againstYou: true })`,
 * the same "a minion/villain reacting to its own activation" reading `absorbing-man.ts`/`crossbones.ts` already
 * established for "activates against you" (docs/phase7-wave2-scripting.md §5's citation).
 *
 * **Magical Suspension (15026)** — "Each card you play costs 1 additional resource" is `costModifier({ delta: 1,
 * appliesTo: { controller: "you" } })`: `appliesTo` is checked against the *card being played*, with the ability's
 * own `context.controllerId` (Magical Suspension's controller, since it attaches to "your identity") as "you" —
 * `controller: "you"` on the played card therefore means "controlled by the same player Magical Suspension is
 * attached to," which is exactly "each card **you** play" and nothing else (RRG 1.8 "Cost" (p. 13) treats this as
 * an additional-cost modifier, the same class already used for Mother's Orders, `wsp/obligation-nemesis.ts`).
 *
 * **Chaos Manipulation (15027)** — "Search the encounter deck and discard pile for Luminous and put her into play
 * engaged with you" reuses the exact "search two zones, `putIntoPlay` already engaging a minion with its player"
 * shape `zola.ts`'s Island of Dr. Zola setup (`04112a.setup`) established for cycle 1. **Found by testing, not
 * assumed (docs/phase7-wave2-scripting.md §4.1):** the search's own `chooseCards` is `{ min: 1, max: 1 }`, not
 * `{ min: 0, max: 1 }` — `min: 0` typechecked and looked identical to Zola's own "may already be in play" case, but
 * `firstLegal` (which always answers with the *fewest* legal selections) then declines the pick even when Luminous
 * genuinely *was* found, so she was never actually put into play in a real playthrough. `executeChooseCards`
 * (`packages/engine/src/resolve/effects-frame.ts`) already special-cases zero legal candidates before `min` is
 * ever consulted (`if (!chooser || max === 0) { … return }`), so `min: 1` is safe even when she isn't findable at
 * all (in play already, or genuinely nowhere) — it only forces the pick when there is exactly one real candidate,
 * which is what "search … for Luminous and put her into play" (no "you may") actually means.
 */
export const SCW_OBLIGATION_NEMESIS = defineAbilities({
  // Slipping Sanity — Give to the Wanda Maximoff player. You may flip to alter-ego form. Choose:
  // • Exhaust Wanda Maximoff → remove Slipping Sanity from the game.
  // • Discard the top 5 cards of the encounter deck. For each star icon in the boost area discarded this way,
  //   place 1 threat on the main scheme. Discard this obligation.
  "15023.obligation": obligation("Wanda Maximoff", {
    label: "Discard the top 5 cards of the encounter deck. For each star icon in the boost area discarded this way, place 1 threat on the main scheme",
    effects: [discardEncounterCards(5, { bind: "sanity" }), placeThreat(varOf("sanity.starIcons"), theMainScheme)],
  }),

  // The Next Evolution — Increase the number of boost icons on each encounter card by 1 (module docblock).
  "15024.the-next-evolution-constant": constant(gets("boostIcons", 1, { controller: "encounter" })),

  // Luminous — Forced Response: After Luminous activates against you, discard the top card of the encounter deck.
  // If 2 or more boost icons were discarded this way, deal yourself 1 encounter card (module docblock).
  "15025.luminous-forced-response": forcedResponse(
    on.enemyAttacks("self", { againstYou: true }),
    discardEncounterCards(1, { bind: "d" }),
    ifThen(valueAtLeast(varOf("d.boostIcons"), 2), dealEncounterCard(you)),
  ),

  // Magical Suspension — Attach to your identity (data). Each card you play costs 1 additional resource. Hero
  // Action: Exhaust your hero → discard this card (module docblock).
  "15026.magical-suspension-constant": constant(costModifier({ delta: 1, appliesTo: { controller: "you" } })),
  "15026.magical-suspension-action": heroAction({ cost: exhaustYourHero }, discard(self)),

  // Chaos Manipulation — When Revealed: Search the encounter deck and discard pile for Luminous and put her into
  // play engaged with you. Discard the top card of the encounter deck. If 2 or more boost icons were discarded
  // this way, Luminous activates against you (module docblock).
  "15027.when-revealed": whenRevealed(
    chooseCards("luminous", encounterCards(["deck", "discard"], query("minion", { name: cardName("15025") })), { min: 1, max: 1 }),
    putIntoPlay(chosen("luminous"), you),
    discardEncounterCards(1, { bind: "d" }),
    ifThen(valueAtLeast(varOf("d.boostIcons"), 2), enemyAttack(chosen("luminous"), { against: you })),
  ),
});
