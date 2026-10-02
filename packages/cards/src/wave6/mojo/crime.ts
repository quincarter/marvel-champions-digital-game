import { trait } from "@mc/content";
import {
  addCounters,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  countersOn,
  defineAbilities,
  discard,
  discardEncounterUntil,
  each,
  encounterCard,
  exists,
  forcedResponse,
  FRIENDLY_CHARACTER,
  gainsKeywordX,
  gets,
  heroAction,
  ifThen,
  moveThreat,
  on,
  option,
  query,
  removeThreat,
  revealCard,
  revealedFromEncounterDeck,
  rule,
  self,
  spendX,
  surge,
  theMainScheme,
  valueAtLeast,
  varOf,
  whenRevealed,
} from "../../dsl/index.js";

const SETTING = trait("SETTING");
const SIDE_SCHEME = query("sideScheme");
/** "Threat cannot be removed from other schemes": every scheme but this one, main scheme included. */
const OTHER_SCHEMES = query(["mainScheme", "sideScheme"], { excluding: self });

/**
 * MojoMania (`mojo`), the Crime genre set (`crime`, 39035-39040; docs/phase7-wave6.md §7.4). The side schemes' "Hinder
 * 1[per_hero]" is a printed keyword the engine resolves from the card data (§3.59), so it needs no ability here.
 *
 * Dial M for Mojo is a SHOW environment: its incite grant reaches every other encounter card as it is revealed and a
 * villain's new face (FAQ "Dial M for Mojo (#35)", RRG 1.8 p. 64; §3.65, §4 Q37), and it surges only when revealed
 * from the encounter deck (§3.64).
 */
export const CRIME_ABILITIES = defineAbilities({
  // Dial M for Mojo (39035) — Each other encounter card gains incite 1.
  "39035.dial-m-for-mojo-constant": constant(gainsKeywordX("incite", 1, encounterCard({ self: false }))),
  // Each friendly character gets +1 THW.
  "39035.dial-m-for-mojo-constant-2": constant(gets("thw", 1, FRIENDLY_CHARACTER)),
  // When Revealed: Discard each other Setting environment in play. If this card was revealed from the encounter deck,
  // it gains surge.
  "39035.when-revealed": whenRevealed(
    discard(each(query("environment", { trait: SETTING, excluding: self }))),
    ifThen(revealedFromEncounterDeck, surge()),
  ),

  // Build the Case (39036) — Forced Response: After a side scheme is defeated, place 1 clue counter here. Then, if
  // there are at least 3 clue counters here, discard this card.
  "39036.obligation": forcedResponse(
    on.schemeDefeated(SIDE_SCHEME),
    addCounters("clue", 1, self),
    ifThen(valueAtLeast(countersOn(self, "clue"), 3), discard(self)),
  ),

  // Crime Scene Investigation (39037) — Threat cannot be removed from other schemes.
  "39037.crime-scene-investigation-constant": constant(rule({ kind: "threatCannotBeRemoved", target: OTHER_SCHEMES })),
  // Hero Action: Spend X [mental] resources → remove X threat from this scheme.
  "39037.crime-scene-investigation-action": heroAction({ cost: spendX("mental", "x") }, removeThreat(varOf("x"), self)),

  // Law & Order (39038) — Each friendly character gets -2 ATK.
  "39038.law-and-order-constant": constant(gets("atk", -2, FRIENDLY_CHARACTER)),
  // Hero Action: Spend X [energy] resources → remove X threat from this scheme.
  "39038.law-and-order-action": heroAction({ cost: spendX("energy", "x") }, removeThreat(varOf("x"), self)),

  // Dragnet (39039) — The villain cannot take damage. (Ruling Apr 30, 2026 (1): an effect whose only effect is damage
  // cannot target the villain, one with another effect can; the engine's target validity reads this rule.)
  "39039.dragnet-constant": constant(rule({ kind: "cannotTakeDamage", target: query("villain") })),
  // Hero Action: Spend X [physical] resources → remove X threat from this scheme.
  "39039.dragnet-action": heroAction({ cost: spendX("physical", "x") }, removeThreat(varOf("x"), self)),

  // Elementary, My Dear Mojo (39040) — When Revealed: Choose one: move all threat from a side scheme to the main
  // scheme (that side scheme is defeated), or discard from the encounter deck until a side scheme is discarded and
  // reveal that card. The first option is offered only while a side scheme is in play, so a greedy player's first
  // listed pick is the scheme move whenever it can happen.
  "39040.when-revealed": whenRevealed(
    chooseOne(
      option(
        "Move all threat from a side scheme to the main scheme",
        { when: exists(SIDE_SCHEME) },
        chooseTarget("scheme", SIDE_SCHEME),
        moveThreat(chosen("scheme"), theMainScheme),
      ),
      option(
        "Discard from the encounter deck until a side scheme is discarded, then reveal it",
        discardEncounterUntil(SIDE_SCHEME, "found"),
        revealCard(chosen("found")),
      ),
    ),
  ),
});
