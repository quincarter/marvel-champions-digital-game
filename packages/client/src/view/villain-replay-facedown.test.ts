/**
 * Issue #311: the engine runs the whole villain phase inside one command, so an encounter card dealt facedown was
 * already revealed (an obligation face up in the play area) while the rail was still showing the deal. The table holds
 * each dealt card in its facedown pile until the rail reveals it. Replays the reported game (Rhino, Spider-Man
 * Justice, seed 53823) up to its round-3 villain phase.
 */
import { describe, expect, it } from "vitest";
import { locateCard, type Command, type GameEvent, type GameState, type PlayerId } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { boardModel } from "./board-model.js";
import { tableHoldOf, withFacedownHeld } from "./villain-replay.js";
import { appendWalkthrough, emptyWalkthrough, type Walkthrough } from "./villain-walkthrough.js";

const P1 = "p1" as PlayerId;
const COMMANDS = [
  { type: "resolveChoice", playerId: "p1", choiceId: "c1", selectedOptionIds: [] },
  {
    type: "playCard",
    playerId: "p1",
    cardInstanceId: "i19",
    payment: [
      { fromHand: "i25" },
      { ability: { instanceId: "i3", abilityId: "01001b.scientist" } },
      { fromHand: "i7" },
    ],
    attachToInstanceId: null,
  },
  { type: "changeForm", playerId: "p1" },
  { type: "basicAttack", playerId: "p1", attackerInstanceId: "i3", targetInstanceId: "i1" },
  { type: "basicAttack", playerId: "p1", attackerInstanceId: "i19", targetInstanceId: "i1" },
  { type: "endTurn", playerId: "p1" },
  { type: "resolveChoice", playerId: "p1", choiceId: "c2", selectedOptionIds: [] },
  { type: "resolveChoice", playerId: "p1", choiceId: "c3", selectedOptionIds: ["i3:01001a.spider-sense"] },
  { type: "resolveChoice", playerId: "p1", choiceId: "c4", selectedOptionIds: ["decline"] },
  { type: "playCard", playerId: "p1", cardInstanceId: "i4", payment: [{ fromHand: "i39" }], attachToInstanceId: null },
  {
    type: "playCard",
    playerId: "p1",
    cardInstanceId: "i31",
    payment: [{ fromHand: "i23" }, { fromHand: "i8" }],
    attachToInstanceId: null,
  },
  { type: "basicThwart", playerId: "p1", thwarterInstanceId: "i3", schemeInstanceId: "i2" },
  { type: "basicAttack", playerId: "p1", attackerInstanceId: "i19", targetInstanceId: "i1" },
  { type: "basicAttack", playerId: "p1", attackerInstanceId: "i4", targetInstanceId: "i1" },
  { type: "endTurn", playerId: "p1" },
  { type: "resolveChoice", playerId: "p1", choiceId: "c5", selectedOptionIds: [] },
  { type: "resolveChoice", playerId: "p1", choiceId: "c6", selectedOptionIds: ["i3:01001a.spider-sense"] },
  { type: "resolveChoice", playerId: "p1", choiceId: "c7", selectedOptionIds: ["i3"] },
  { type: "resolveChoice", playerId: "p1", choiceId: "c8", selectedOptionIds: ["i3:01001a.spider-sense"] },
  { type: "resolveChoice", playerId: "p1", choiceId: "c9", selectedOptionIds: ["i19"] },
  {
    type: "playCard",
    playerId: "p1",
    cardInstanceId: "i9",
    payment: [{ fromHand: "i35" }, { fromHand: "i12" }, { fromHand: "i33" }],
    attachToInstanceId: null,
  },
  { type: "resolveChoice", playerId: "p1", choiceId: "c10", selectedOptionIds: ["i1"] },
  { type: "basicThwart", playerId: "p1", thwarterInstanceId: "i4", schemeInstanceId: "i65" },
  { type: "changeForm", playerId: "p1" },
  { type: "endTurn", playerId: "p1" },
  { type: "resolveChoice", playerId: "p1", choiceId: "c11", selectedOptionIds: [] },
] as unknown as readonly Command[];

async function reportedGame(): Promise<{ state: GameState; walkthrough: Walkthrough }> {
  const host = new LocalEngineHost();
  let state: GameState | null = null;
  let events: readonly GameEvent[] = [];
  host.subscribe((update) => {
    state = update.state;
    events = update.events;
  });
  await host.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 53823,
  });
  let walkthrough = emptyWalkthrough(1);
  for (const command of COMMANDS) {
    await host.dispatch(command);
    walkthrough = appendWalkthrough(walkthrough, events, state!, P1, POOL_DEPS);
  }
  return { state: state!, walkthrough };
}

const nameOf = (state: GameState, id: string): string | undefined => state.cardPool[state.instances[id]!.cardId]?.name;
const beatIndex = (walkthrough: Walkthrough, text: string): number =>
  walkthrough.steps.flatMap((step) => step.beats).findIndex((beat) => beat.text === text);

describe("the table while the villain phase rail is behind (issue #311)", async () => {
  const { state, walkthrough } = await reportedGame();
  const dealt = walkthrough.encounter.dealt.map((card) => card.instanceId);
  const [charge, eviction] = dealt;

  it("the engine has already revealed both cards dealt to you", () => {
    expect(dealt.map((id) => nameOf(state, id))).toEqual(["Charge", "Eviction Notice"]);
    expect(locateCard(state, eviction!)).toEqual({ kind: "playArea", playerId: P1 });
    expect(locateCard(state, charge!)?.kind).toBe("attachment");
  });

  it("on the deal, both cards are in your facedown pile and neither face is on the table", () => {
    const atDeal = beatIndex(walkthrough, "You are dealt a facedown encounter card.") + 1;
    const hold = tableHoldOf(walkthrough, atDeal);
    expect(hold?.facedown?.map((card) => card.instanceId)).toEqual([charge, eviction]);
    const held = withFacedownHeld(state, hold!.facedown!);
    expect(held.players[0]!.dealtEncounter).toEqual([charge, eviction]);
    expect(held.players[0]!.playArea).not.toContain(eviction);
    expect(Object.values(held.instances).some((card) => card.attachments.includes(charge!))).toBe(false);
    // The facedown pile lists the ids (`myDealt`, `dealtFacedown`) and nothing reads them; every other mention is a face.
    const model = JSON.stringify(boardModel(held, P1, POOL_DEPS), (key, value: unknown) =>
      key === "myDealt" || key === "dealtFacedown" ? undefined : value,
    );
    expect(boardModel(held, P1, POOL_DEPS).myDealt).toEqual([charge, eviction]);
    expect(model).not.toContain(eviction);
    expect(model).not.toContain(charge);
  });

  it("once Charge is revealed, only Eviction Notice stays facedown", () => {
    const hold = tableHoldOf(walkthrough, beatIndex(walkthrough, "You revealed Charge.") + 1);
    expect(hold?.facedown?.map((card) => card.instanceId)).toEqual([eviction]);
    const held = withFacedownHeld(state, hold!.facedown!);
    expect(locateCard(held, charge!)?.kind).toBe("attachment");
    expect(held.players[0]!.dealtEncounter).toEqual([eviction]);
  });

  it("a card waiting on Flip Encounter Card stays facedown though its reveal beat is up", () => {
    const atCharge = beatIndex(walkthrough, "You revealed Charge.") + 1;
    expect(tableHoldOf(walkthrough, atCharge, charge!)?.facedown?.map((card) => card.instanceId)).toEqual([
      charge,
      eviction,
    ]);
    const total = walkthrough.steps.flatMap((step) => step.beats).length;
    expect(tableHoldOf(walkthrough, total, eviction!)?.facedown?.map((card) => card.instanceId)).toEqual([eviction]);
    expect(tableHoldOf(walkthrough, total)).toBeNull();
  });

  it("once Eviction Notice is revealed, nothing is held", () => {
    const hold = tableHoldOf(walkthrough, beatIndex(walkthrough, "You revealed Eviction Notice.") + 1);
    expect(hold?.facedown).toBeUndefined();
  });

  it("never changes the engine's own game", () => {
    const before = JSON.stringify(state);
    withFacedownHeld(state, walkthrough.encounter.dealt);
    expect(JSON.stringify(state)).toBe(before);
  });
});
