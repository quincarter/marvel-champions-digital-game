import {
  adjustBoostCount,
  boost,
  constant,
  countOf,
  dealIndirectDamage,
  defineAbilities,
  each,
  eachPlayer,
  firstPlayer,
  gainsIcon,
  gainsKeyword,
  gets,
  ifThen,
  inMode,
  placeThreat,
  putIntoPlay,
  query,
  self,
  theMainScheme,
  whenRevealed,
  you,
} from "../../../dsl/index.js";

/**
 * Guerrilla Tactics (`sm` 27142–27146, docs/phase7-wave5.md §2.2/§3.10/§3.11): the Sinister Six scenario's other
 * modular set — Life-Size Decoy, Coordinated Effort, Hidden in Shadow, Teamwork Makes the Dream Work, From Every
 * Direction. Every constant text below reads "each enemy"/"an enemy in play" as the `query("enemy")` villain+minion
 * category (`spec.ts`), so it scales correctly whether one villain or all six Sinister Six villains happen to be in
 * play, with no special-casing for the multiple-villains scenario (docs/phase7-wave5.md §3.1's own "the villain"
 * plumbing is a separate concern from these cards' plain "each enemy").
 *
 * **Not scripted here — a missing engine primitive, reported rather than worked around
 * (docs/phase7-wave5-handoff.md's own standing instruction):** Life-Size Decoy's second line, "The engaged player
 * cannot thwart side schemes." `RuleSpec cannotThwart` (`packages/engine/src/abilities.ts`) only takes a `player`
 * and a `while` predicate — no scheme-type scoping — so it cannot express "side schemes only" (main scheme thwarts
 * must stay legal). The other candidate, `RuleSpec threatCannotBeRemoved { target: query("sideScheme"), by:
 * "thwart", player: engagedPlayerOf(self) }`, has the right query/player shape but is only consulted at actual
 * threat-removal time (`resolve/event.ts`'s per-scheme check) — a basic thwart against a side scheme would still be
 * a legal command (pay the cost, exhaust the thwarter) that simply removes 0 threat, unlike Patrol's own "cannot
 * thwart the main scheme," which `actions.ts`'s `basicThwartWith` pre-validates and refuses as `no_valid_target`
 * before any cost is paid. Getting this ability's actual timing wrong (silently wasting the thwarter's action
 * instead of refusing the command) would be a subtly-wrong implementation, so it is left out of the registry
 * instead of guessed at; `27142.life-size-decoy-constant-2` is not a registered ability id.
 */
export const GUERRILLA_TACTICS = defineAbilities({
  // Life-Size Decoy (27142, minion; ATK 0/SCH 0/HP 5/star icon are data) — In expert mode, Life-Size Decoy gains
  // toughness.
  "27142.life-size-decoy-constant": constant(
    gainsKeyword({ name: "toughness" }, { self: true }, { while: inMode("expert") }),
  ),
  // Life-Size Decoy — [star] Boost: Put this minion into play engaged with you.
  "27142.boost": boost(putIntoPlay(self, you)),

  // Coordinated Effort (27143, side scheme; startingThreat 6/1 boost icon/star icon are data) — Each enemy gains 1
  // acceleration icon.
  "27143.coordinated-effort-constant": constant(gainsIcon("acceleration", query("enemy"))),
  // Coordinated Effort — [star] Boost: Place 1 threat on each scheme. (In expert mode, place 1 additional threat on
  // the main scheme.)
  "27143.boost": boost(placeThreat(1, each(query("scheme"))), ifThen(inMode("expert"), placeThreat(1, theMainScheme))),

  // Hidden in Shadow (27144, side scheme; startingThreat 4/1 boost icon/star icon are data) — Each enemy gains 1
  // hazard icon. (Curation-corrected "addition" → "additional" in the boost's expert-mode clause,
  // `packages/content/scripts/marvelcdb/curation/sm.ts` 27144, against the card's own scan.)
  "27144.hidden-in-shadow-constant": constant(gainsIcon("hazard", query("enemy"))),
  // Hidden in Shadow — [star] Boost: Deal 1 indirect damage to each player. (In expert mode, deal 1 additional
  // indirect damage to the first player.)
  "27144.boost": boost(dealIndirectDamage(eachPlayer, 1), ifThen(inMode("expert"), dealIndirectDamage(firstPlayer, 1))),

  // Teamwork Makes the Dream Work (27145, side scheme; startingThreat 5/2 boost icons/star icon are data) — Each
  // enemy gets +1 SCH and +1 ATK.
  "27145.teamwork-makes-the-dream-work-constant": constant(
    gets("sch", 1, query("enemy")),
    gets("atk", 1, query("enemy")),
  ),
  // Teamwork Makes the Dream Work — [star] Boost: In expert mode, this card gets +2 boost icons for this
  // activation (`adjustBoostCount`, Badoon Warlord's own "gets +2 boost icons" precedent, `gmw/badoon.ts` 16121).
  "27145.boost": boost(ifThen(inMode("expert"), adjustBoostCount(2))),

  // From Every Direction (27146, treachery; no boost icons are data) — In expert mode, this card gains surge
  // (`inMode`/`gainsKeyword` shape, Surprise!'s own precedent, `sinister-six/treacheries.ts` 27112).
  "27146.from-every-direction-constant": constant(
    gainsKeyword({ name: "surge" }, { self: true }, { while: inMode("expert") }),
  ),
  // From Every Direction — When Revealed: Place 1 threat on the main scheme for each enemy in play.
  "27146.when-revealed": whenRevealed(placeThreat(countOf(query("enemy")), theMainScheme)),
});
