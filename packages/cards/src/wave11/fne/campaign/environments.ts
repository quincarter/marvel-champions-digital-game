import type { AbilityRegistry } from "@mc/engine";
import {
  chooseTarget,
  canTakeStatus,
  allOf,
  applyRuleUntil,
  cards,
  chooseCards,
  chooseOneBy,
  choiceFoundNothing,
  chosen,
  confuse,
  constant,
  dealAsEncounterCard,
  dealEncounterCard,
  defineAbilities,
  discardFromHand,
  eachPlayer,
  encounterCards,
  encounterSetAside,
  forEachPlayer,
  forEachPlayerInChosenOrder,
  giveTough,
  identityOf,
  ifElse,
  ifThen,
  inEncounterSet,
  inMode,
  moveCards,
  option,
  putIntoPlay,
  query,
  revealCard,
  selectCards,
  setup,
  shuffleDeck,
  shuffleEncounterDeck,
  stun,
  thatPlayer,
  valueAtLeast,
  varOf,
  zone,
} from "../../../dsl/index.js";

const UPGRADE = query("upgrade");
const SUPPORT = query("support");
const ALLY = query("ally");
/** "Attachment" is an encounter card type (RRG 1.8 "Attachment", p. 8); a player's upgrade is not one. */
const ATTACHMENT = query("attachment");
/**
 * The minions of The Raft Breakout encounter set (60144-60149), out of the encounter deck until a campaign brings them
 * in.
 */
const RAFT_MINION = query("minion", inEncounterSet("the_raft_breakout"));
/** A Daily Bugle support of the Stop the Presses! encounter set (60153-60156), set aside. */
const BUGLE_SUPPORT = query("support", inEncounterSet("stop_the_presses"));

/**
 * "Each player may search their deck and discard pile for a [type] and add it to their hand. In expert mode, each
 * player who did so discards 1 card from their hand." (The Getaway, Protection Racket and The Raft Breakout, Completed
 * faces.) The "After resolving mulligans" opening is the campaign window the Setup resolves in (`afterMulligans`,
 * docs/phase7-wave11-scenarios.md section S4 Q202 = A), not part of the ability.
 *
 * Each player in turn order (the first player first) decides for themself; the deck is
 * shuffled once they searched (RRG 1.8 "Search", p. 39). "Who did so" is a player who added a card: one who searched
 * and found none did not add anything, so does not discard (engine reading, flagged for the rules expert).
 */
const searchFor = (type: ReturnType<typeof query>) =>
  forEachPlayer(
    eachPlayer,
    chooseOneBy(
      thatPlayer,
      option(
        "Search your deck and discard pile and add one to your hand",
        chooseCards("found", zone(["deck", "discard"], thatPlayer, { filter: type }), {
          min: 1,
          max: 1,
          chooser: thatPlayer,
        }),
        moveCards(cards(chosen("found")), "hand", "added"),
        shuffleDeck(thatPlayer),
        ifThen(allOf(inMode("expert"), valueAtLeast(varOf("added.count"), 1)), discardFromHand(1, thatPlayer)),
      ),
      option("Do not search"),
    ),
  );

/**
 * The campaign environments (docs/phase7-wave11-scenarios.md section S6; MC60 p. 9 steps 12 and 14, p. 6). Each is
 * put into play by the campaign (`putIntoPlay { otherFace, resolveSetup }`, section S3.15) on its Completed face (a) or
 * its Failed face (b), and its Setup then resolves with the other environments' Setups in the order the first player
 * chooses (RRG 1.8 "Simultaneous Resolution", p. 40). "Each player" / "each identity" is every seat, in turn order.
 *
 * **60205a Art Museum Heist (Completed)**: each identity gets a tough status card.
 * **60205b (Failed)**: each player chooses to stun or confuse their identity; in expert mode, both.
 * **60206a The Getaway (Completed)**: the optional upgrade search above.
 * **60206b (Failed)**: "In expert mode, attachments cannot be discarded from play during the first round." There is no
 * round number a constant could read, and the card only ever enters play in setup, so the rule is a lasting one made
 * by the Setup (`applyRuleUntil` until the end of the round in progress, which setup leaves as round 1), expert only;
 * so the printed constant is registered empty. The rule begins at setup step 12, slightly before round 1, which changes
 * nothing. No discard moves an attachment (RRG 1.8 "'Cannot'", p. 11); an
 * upgrade is not an attachment. Setup: each player in turn searches the encounter deck for an attachment and reveals it
 * (the deck is shuffled once afterwards), and a player who found none is dealt a facedown encounter card at once. A
 * player cannot find one only when the deck has none, which leaves none for a later player either, so dealing as each
 * player's search ends gives the same result as dealing after all of them.
 * The two Setups that draw on one shared pile (the encounter deck's attachments in 60206b, the set-aside Daily Bugle
 * supports in 60209a) use `forEachPlayerInChosenOrder`: the first player orders the players (RRG 1.8 "Each Player",
 * p. 17).
 * **60207a Protection Racket (Completed)**: the optional support search. **60207b (Failed)**: each player chooses and
 * discards 1 card from their hand (2 in expert mode).
 * **60208a The Raft Breakout (Completed)**: the optional ally search. **60208b (Failed)**: the six minions of The Raft
 * Breakout encounter set shuffle into the encounter deck; in expert mode first 1 of them at random is dealt to each
 * player as a facedown encounter card, before the rest are shuffled in. The campaign sets those minions aside.
 * **60209a Stop the Presses! (Completed)**: each player chooses 1 Daily Bugle support from the Stop the Presses!
 * encounter set and puts it into play under their control. The campaign sets aside only the supports not removed from
 * the campaign (Q203 = B: a title removed from the game in an earlier Stop the Presses! game is recorded and gone), so
 * a player is offered none when the pool is empty. **60209b (Failed)**: each player is dealt 1 facedown encounter card
 * (2 in expert mode).
 *
 * Cards (5):
 * - 60205a Art Museum Heist (environment)
 * - 60206a The Getaway (environment)
 * - 60207a Protection Racket (environment)
 * - 60208a The Raft Breakout (environment)
 * - 60209a Stop the Presses! (environment)
 */
export const FNE_CAMPAIGN_ENVIRONMENTS: AbilityRegistry = defineAbilities({
  "60205a.setup": setup(forEachPlayer(eachPlayer, giveTough(identityOf(thatPlayer)))),
  "60205b.setup": setup(
    forEachPlayer(
      eachPlayer,
      ifThen(
        inMode("expert"),
        [stun(identityOf(thatPlayer)), confuse(identityOf(thatPlayer))],
        chooseOneBy(
          thatPlayer,
          // Barred when the identity cannot take the status (RRG 1.8 "Choose (Option)", p. 12; "Target", p. 42).
          option(
            "Stun your identity",
            chooseTarget("identity", query("identity", { controlledBy: thatPlayer, ...canTakeStatus("stunned") }), {
              chooser: thatPlayer,
            }),
            stun(chosen("identity")),
          ),
          option(
            "Confuse your identity",
            chooseTarget("identity", query("identity", { controlledBy: thatPlayer, ...canTakeStatus("confused") }), {
              chooser: thatPlayer,
            }),
            confuse(chosen("identity")),
          ),
        ),
      ),
    ),
  ),

  "60206a.setup": setup(searchFor(UPGRADE)),
  "60206b.the-getaway-constant": constant(),
  "60206b.setup": setup(
    ifThen(
      inMode("expert"),
      applyRuleUntil({ kind: "cannotLeavePlay", target: ATTACHMENT, by: "discard" }, "endOfRound"),
    ),
    forEachPlayerInChosenOrder(
      eachPlayer,
      chooseCards("found", encounterCards(["deck"], ATTACHMENT), { min: 1, max: 1, chooser: thatPlayer }),
      revealCard(chosen("found"), thatPlayer),
      ifThen(choiceFoundNothing(), dealEncounterCard(thatPlayer)),
    ),
    shuffleEncounterDeck(),
  ),

  "60207a.setup": setup(searchFor(SUPPORT)),
  "60207b.setup": setup(forEachPlayer(eachPlayer, discardFromHand(ifElse(inMode("expert"), 2, 1), thatPlayer))),

  "60208a.setup": setup(searchFor(ALLY)),
  "60208b.setup": setup(
    ifThen(
      inMode("expert"),
      forEachPlayer(
        eachPlayer,
        selectCards("dealt", encounterSetAside(RAFT_MINION, { random: 1 })),
        dealAsEncounterCard(chosen("dealt"), thatPlayer),
      ),
    ),
    moveCards(encounterSetAside(RAFT_MINION), "encounterDeckShuffle"),
  ),

  "60209a.setup": setup(
    forEachPlayerInChosenOrder(
      eachPlayer,
      chooseCards("support", encounterSetAside(BUGLE_SUPPORT), { min: 1, max: 1, chooser: thatPlayer }),
      putIntoPlay(chosen("support"), thatPlayer),
    ),
  ),
  "60209b.setup": setup(dealEncounterCard(eachPlayer, { count: ifElse(inMode("expert"), 2, 1) })),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FNE_CAMPAIGN_ENVIRONMENTS_SKIPPED: Readonly<Record<string, string>> = {};
