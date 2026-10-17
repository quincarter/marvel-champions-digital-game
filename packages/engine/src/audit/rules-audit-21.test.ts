/**
 * Rules audit, chunk 21 (RRG 1.8 Appendix IV: FAQ, HEX BOLT ... LABOR CARDS), engine-level proofs. Every `it.fails`
 * asserts what the RRG says and fails today; when the engine changes the test flips and `it.fails` must be dropped.
 * The one test here is an INTERPRETATION proof, not a settled bug: the FAQ below and FFG ruling August 3, 2026 (3) pull
 * in different directions (rules audit 21.22).
 */
import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "../abilities.js";
import type { GameEvent } from "../events.js";
import type { GameState } from "../state.js";
import { depsOf, stubAbility } from "../testing/abilities.js";
import { runCommandsPicking } from "../testing/drive.js";
import { stubEvent, stubSupport, stubTreachery } from "../testing/fixtures.js";
import { defaultPick, giveCard, TREACHERY } from "../testing/scenario.js";
import { copiesOf, gameAtFirstTurn, onTopOfEncounterDeck, P1, playerCardIntoPlay } from "../testing/wave3.js";

// A treachery that prints "Surge." and a When Revealed ability ("draw 1 card").
const DRAWS_WR = stubAbility("draws-surge.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [{ kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 1 } }],
});
const SURGING = stubTreachery({
  id: "draws-surge",
  boostIcons: 0,
  abilities: [DRAWS_WR.ref],
  keywords: [{ name: "surge" }],
});
// Spider-Tingle's shape (31020): "cancel its 'When Revealed' effects".
const CANCEL_WR = stubAbility("cancel-wr.interrupt", {
  trigger: { kind: "interrupt", forced: false, on: { on: "encounterCardRevealing" } },
  effects: [{ kind: "cancelWhenRevealed" }],
});
const CANCEL_WR_CARD = stubSupport({ id: "cancel-wr", cost: 0, abilities: [CANCEL_WR.ref] });
const REVEAL = stubAbility("reveal.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "revealEncounterCard", player: { kind: "controller" } }],
});
const REVEAL_CARD = stubEvent({ id: "reveal", cost: 0, abilities: [REVEAL.ref] });

const deps: EngineDeps = depsOf(DRAWS_WR, CANCEL_WR, REVEAL);
const CARDS = [SURGING, CANCEL_WR_CARD, REVEAL_CARD];

const acceptOnlyCancels = (state: GameState): readonly string[] => {
  const choice = state.pendingChoice;
  if (choice?.prompt.kind === "chooseTriggers")
    return choice.options.filter((o) => o.optionId.includes("cancel-")).map((o) => o.optionId);
  return defaultPick(state);
};

function revealWithWhenRevealedCancelled(top: CardId) {
  const base = gameAtFirstTurn({
    cards: CARDS,
    deps,
    encounter: [SURGING.id, ...copiesOf(TREACHERY.id, 10)],
    deck: [REVEAL_CARD.id, CANCEL_WR_CARD.id],
  });
  const withCancel = playerCardIntoPlay(base, CANCEL_WR_CARD.id, P1).state;
  const given = giveCard(onTopOfEncounterDeck(withCancel, top), P1, REVEAL_CARD.id);
  return runCommandsPicking(given.state, deps, acceptOnlyCancels, {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  });
}

const typed = (events: readonly GameEvent[], type: GameEvent["type"]) => events.filter((e) => e.type === type);

describe("21.22 SPIDER-MAN NOIR (#15), RRG 1.8 Appendix IV FAQ p. 63", () => {
  // "Q: If a treachery's 'When Revealed' ability is canceled, can Spider-Man Noir attach that treachery to himself? A:
  // In order for Spider-Man Noir's response to trigger, some part of the treachery card must be resolved. If the
  // treachery card has a keyword on it that is resolved when the card is revealed, like surge or incite X, Spider-Man
  // Noir can trigger his response to attach that card to himself."
  // The engine drops surge (and incite) whenever the When Revealed ability is cancelled (resolve/reveal.ts `surgeLive`,
  // and the early return after "Incite and surge are 'When Revealed' effects too"). FFG ruling August 3, 2026 (3) (after
  // RRG 1.8) says Enhanced Spider-Sense can cancel surge, which is a different cancel; it does not overrule the FAQ.
  it.fails("a treachery with Surge whose printed When Revealed is cancelled still surges and counts as resolved", () => {
    const { events } = revealWithWhenRevealedCancelled(SURGING.id);
    expect(typed(events, "revealCancelled")).toHaveLength(1);
    // The printed ability did not resolve (the draw never happened) ...
    expect(typed(events, "cardDrawn")).toHaveLength(0);
    // ... but the keyword did: the player is dealt the surge card, and "After you resolve a treachery" is announced.
    expect(typed(events, "surgeTriggered")).toHaveLength(1);
    expect(events.filter((e) => e.type === "triggerEvent" && e.event.kind === "encounterCardResolved")).toHaveLength(1);
  });
});
