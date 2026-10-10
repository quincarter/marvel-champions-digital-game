import type { AbilityRegistry } from "@mc/engine";
import {
  andThen,
  cards,
  chooseOne,
  constant,
  coveredByEngineRule,
  dealDamage,
  defineAbilities,
  each,
  eventPlayer,
  forcedInterrupt,
  forcedResponse,
  gets,
  identityOf,
  ifThen,
  moveCards,
  on,
  option,
  placeThreat,
  query,
  replaceTuckHost,
  self,
  tuckedCount,
  tuckedUnderRef,
  valueAtLeast,
  valueEquals,
  whenDefeated,
  whenRevealed,
  whileTucked,
} from "../../../dsl/index.js";

/** "Each identity": every player's identity, in whichever form it shows. */
const EACH_IDENTITY = each(query("identity"));
/** "Each card tucked under each identity" (the encounter cards among them for Morlun: a card with no controller). */
const TUCKED_UNDER_IDENTITIES = tuckedCount(EACH_IDENTITY);
const ENCOUNTER_CARDS_TUCKED_UNDER_IDENTITIES = tuckedCount(EACH_IDENTITY, query([], { controller: "encounter" }));

/**
 * Wave 9 scripting module `silk/silk/obligation-nemesis` (docs/phase7-wave9.md section 8.4, 3.39, 3.40).
 *
 * Cards (4):
 * - 52028 Silk Sense Overload (obligation)
 * - 52029 Morlun (minion)
 * - 52030 The Great Hunt (side_scheme)
 * - 52031 Hunting the Spider-Bride (treachery)
 *
 * **Silk Sense Overload (52028)**: "Give to the Cindy Moon player" is data and engine rule; the obligation has no When
 * Revealed, so it stays in the Cindy Moon player's play area. Forced Interrupt (a `would` interrupt: the tuck is
 * replaced, RRG 1.8 "Replacement Effect", p. 37): a card about to be tucked under that player's identity by a player
 * card goes under the obligation instead, at once. "Then" reads the count after it: at exactly 2 the player may
 * discard the obligation, at 3 or more it is removed from the game (no choice: the parenthesis is what the printed
 * "instead" replaces the discard with; flagged in the report). The cards under it are discarded by the game when it
 * leaves (RRG 1.8 "Tuck", p. 45), an encounter card's discard (no "player card" cause). Encounter cards' tucks
 * (Hunting the Spider-Bride tucking itself) are not redirected.
 *
 * **Morlun (52029)**: the star constant counts the encounter cards (no controller) tucked under every identity; cards
 * under the obligation are not under an identity. When Defeated discards every copy of Hunting the Spider-Bride under
 * any identity: an encounter card's discard, so the Spider-Bride deals nothing (owner decision Q7).
 *
 * **The Great Hunt (52030)**: When Revealed places 1 additional threat for each card (of any kind) tucked under each
 * identity. Its 2 starting threat is data.
 *
 * **Hunting the Spider-Bride (52031)**: Surge is data. Forced Response, from the discard pile it went to
 * (`whileTucked`): after a player card discards it from under an identity, that identity takes 2 damage. Owner decision
 * Q7 = A (provisional): any discard a player card causes counts (a cost, an effect, the identity's four-card cap),
 * so it is `by: "playerCard"` with no `how`; an encounter card's discard (Morlun, its own random discard) is not.
 * "That identity" is the host it was under (`eventPlayer`'s identity). A swap is not a discard. The When Revealed is
 * skipped, see `SILK_OBLIGATION_NEMESIS_SKIPPED`.
 */
export const SILK_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({
  "52028.silk-sense-overload-constant": coveredByEngineRule(),
  "52028.silk-sense-overload-forced-interrupt": forcedInterrupt(
    on.cardWouldBeTucked({ under: "yourIdentity", by: "playerCard" }),
    { would: true },
    replaceTuckHost(self),
    andThen(
      ifThen(
        valueAtLeast(tuckedCount(self), 3),
        moveCards(cards(self), "removedFromGame"),
        ifThen(
          valueEquals(tuckedCount(self), 2),
          chooseOne(
            option("Discard Silk Sense Overload", moveCards(cards(self), "discard")),
            option("Keep Silk Sense Overload"),
          ),
        ),
      ),
    ),
  ),

  "52029.morlun-constant": constant(
    gets("sch", ENCOUNTER_CARDS_TUCKED_UNDER_IDENTITIES, { self: true }),
    gets("atk", ENCOUNTER_CARDS_TUCKED_UNDER_IDENTITIES, { self: true }),
  ),
  "52029.when-defeated": whenDefeated(
    moveCards(cards(tuckedUnderRef(EACH_IDENTITY, query([], { name: "Hunting the Spider-Bride" }))), "discard"),
  ),

  "52030.when-revealed": whenRevealed(placeThreat(TUCKED_UNDER_IDENTITIES, self)),

  "52031.hunting-the-spider-bride-forced-response": whileTucked(
    forcedResponse(
      on.thisDiscardedFromUnder({ fromUnder: "identity", by: "playerCard" }),
      dealDamage(2, identityOf(eventPlayer)),
    ),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const SILK_OBLIGATION_NEMESIS_SKIPPED: Readonly<Record<string, string>> = {
  "52031.when-revealed":
    "\"If you have 4 cards tucked under your identity, discard 1 of those cards at random\" needs a random pick among tucked cards: the DSL's `random` exists only on `zone(...)` (hand, deck, discard), `encounterCards` and `encounterSetAside` selectors, not on `tuckedUnder` / `cards(tuckedUnderRef(...))`, and `chooseCards` has no random chooser. Scripting only the self-tuck would let a fifth card trigger the identity's cap instead of the random discard, so the whole When Revealed waits for a tucked-card `random` selector (docs/phase7-wave9.md section 3.40 and The Raft 51018 need the same).",
};
