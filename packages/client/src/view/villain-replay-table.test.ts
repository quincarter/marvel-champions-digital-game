/**
 * Issue #386: while the villain phase replays card by card, the table draws the game as the engine had it at the beat
 * the rail is on, not the engine's end state (a surge's card dealt, a minion put into play, a status given, all before
 * the rail got there).
 */
import { locateCard, type GameState, type PlayerId } from "@mc/engine";
import { beforeAll, describe, expect, test } from "vitest";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { tableAt, tableHoldOf, totalBeats } from "./villain-replay.js";
import { appendWalkthrough, emptyWalkthrough, type Walkthrough } from "./villain-walkthrough.js";

interface Played {
  readonly walkthrough: Walkthrough;
  readonly live: GameState;
  readonly viewer: PlayerId;
}

/** A Rhino solo game, every turn ended at once, folded the way the villain phase scene folds each update. */
async function playThroughVillainPhase(): Promise<Played> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 2026,
  });
  const viewer = store.state.game!.players[0]!.playerId;
  let walkthrough = emptyWalkthrough(store.state.game!.round);
  let sawVillainPhase = false;
  for (let step = 0; step < 80 && !store.state.game!.outcome; step++) {
    const legal = store.state.legal;
    if (!legal) break;
    if (legal.actions.kind === "choice") {
      const { choice } = legal.actions;
      await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
    } else if (legal.actions.kind === "turn") {
      const end = legal.actions.legal.find((entry) => entry.action.kind === "endTurn");
      if (!end) break;
      await store.dispatch(end.example);
    } else break;
    walkthrough = appendWalkthrough(
      walkthrough,
      store.state.lastEvents,
      store.state.game!,
      viewer,
      POOL_DEPS,
      store.state.lastStates,
    );
    if (walkthrough.activeStep !== null) sawVillainPhase = true;
    if (sawVillainPhase && walkthrough.complete) break;
  }
  return { walkthrough, live: store.state.game!, viewer };
}

const dealtTo = (game: GameState, instanceId: string): boolean =>
  game.players.some((player) => player.dealtEncounter.includes(instanceId as never));

describe("the table follows the villain phase replay (#386)", () => {
  let played: Played;

  beforeAll(async () => {
    played = await playThroughVillainPhase();
  }, 60_000);

  test("the host records the table through the phase, opening first, in beat order", () => {
    const { tables } = played.walkthrough;
    expect(tables.length).toBeGreaterThan(2);
    expect(tables[0]!.atBeat).toBe(-1);
    for (let i = 1; i < tables.length; i++) expect(tables[i]!.atBeat).toBeGreaterThan(tables[i - 1]!.atBeat);
  });

  test("before any beat is shown, the table is the phase's opening: nothing has been dealt yet", () => {
    const opening = tableAt(played.walkthrough, 0)!;
    for (const card of played.walkthrough.encounter.dealt) expect(dealtTo(opening, card.instanceId)).toBe(false);
  });

  test("an encounter card is on the table only once the rail reaches its deal", () => {
    const { walkthrough } = played;
    expect(walkthrough.encounter.dealt.length).toBeGreaterThan(0);
    for (const card of walkthrough.encounter.dealt) {
      const before = tableAt(walkthrough, card.atBeat!)!;
      expect(locateCard(before, card.instanceId)?.kind).not.toBe("dealtEncounter");
      const after = tableAt(walkthrough, card.atBeat! + 1)!;
      expect(dealtTo(after, card.instanceId)).toBe(true);
    }
  });

  test("the hold draws the recorded table while behind, and lets go once caught up", () => {
    const { walkthrough } = played;
    const total = totalBeats(walkthrough);
    expect(tableHoldOf(walkthrough, 1)?.game).toBe(tableAt(walkthrough, 1));
    expect(tableHoldOf(walkthrough, total)).toBeNull();
  });
});
