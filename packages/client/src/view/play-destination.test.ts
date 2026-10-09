/**
 * Choosing where an ally is played (MC45 p. 5; `LegalAction.destinations`, `destinationOnly`; docs/phase7-wave8.md
 * §3.34 and §3.35): the options, their prices by destination, and the command re-aimed at the one picked. The prices are
 * the engine's own (`playCostOf` with `into`): a lasting "next ally played to the mission" reduction is put on a real
 * state, not restated.
 */

import type { Command, GameState, InstanceId, LegalAction, PlayerId } from "@mc/engine";
import { beforeAll, describe, expect, test } from "vitest";
import { POOL_DEPS } from "../content/pool.js";
import { cardName } from "./names.js";
import { paymentIntoOf, playDestinationChoice, playInto } from "./play-destination.js";
import { firstOfType, startedRhinoGame } from "./wave8-fixture.js";

let state: GameState;
let me: PlayerId;
let ally: InstanceId;

beforeAll(async () => {
  ({ state, me } = await startedRhinoGame());
  ally = firstOfType(state, "ally");
}, 30_000);

const reduced = (amount: number): GameState =>
  ({
    ...state,
    lastingEffects: [
      ...state.lastingEffects,
      {
        id: "lasting-test",
        kind: "costReduction",
        playerId: me,
        amount,
        into: { scenarioPlayArea: "mission" },
        anyPlayer: true,
        duration: { kind: "endOfPhase" },
      },
    ],
  }) as unknown as GameState;

const entry = (extra: Partial<LegalAction> = {}, command: Partial<Command> = {}): LegalAction =>
  ({
    action: { kind: "playCard", instanceId: ally },
    example: {
      type: "playCard",
      playerId: me,
      cardInstanceId: ally,
      payment: [],
      attachToInstanceId: null,
      ...command,
    },
    targets: [],
    blockedTargets: [],
    needsPayment: true,
    ...extra,
  }) as unknown as LegalAction;

describe("playDestinationChoice", () => {
  test("a play with no destinations is not a question", () => {
    expect(playDestinationChoice(state, POOL_DEPS, entry())).toBeNull();
    expect(playDestinationChoice(state, POOL_DEPS, entry({ destinations: [] }))).toBeNull();
    expect(
      playDestinationChoice(state, POOL_DEPS, {
        ...entry({ destinations: ["mission"] }),
        action: { kind: "basicAttack" },
      } as unknown as LegalAction),
    ).toBeNull();
  });

  test("your area or the mission, each with its price", () => {
    const choice = playDestinationChoice(state, POOL_DEPS, entry({ destinations: ["mission"] }))!;
    expect(choice.prompt).toBe(`Where does ${cardName(state, ally)} go?`);
    expect(choice.needsChoice).toBe(true);
    expect(choice.destinationOnly).toBe(false);
    expect(choice.note).toBeNull();
    expect(choice.options.map((option) => [option.into, option.label])).toEqual([
      [null, "Your area"],
      ["mission", "The mission"],
    ]);
    const [own, there] = choice.options;
    expect(own!.cost).toBeGreaterThan(0);
    expect(there!.cost).toBe(own!.cost);
    expect(choice.priceDiffers).toBe(false);
    expect(own!.costLabel).toBe(`Costs ${own!.cost}`);
  });

  test("a reduction that reads the destination makes the mission cheaper, and only the mission", () => {
    const cheaper = reduced(2);
    const choice = playDestinationChoice(cheaper, POOL_DEPS, entry({ destinations: ["mission"] }))!;
    const [own, there] = choice.options;
    expect(there!.cost).toBe(Math.max(0, own!.cost! - 2));
    expect(there!.cost).toBeLessThan(own!.cost!);
    expect(choice.priceDiffers).toBe(true);
  });

  test("a free play at the mission says Free", () => {
    const choice = playDestinationChoice(reduced(9), POOL_DEPS, entry({ destinations: ["mission"] }))!;
    expect(choice.options[1]!.costLabel).toBe("Free");
  });

  test("destinationOnly offers no play to your own area, and says why", () => {
    const choice = playDestinationChoice(
      reduced(2),
      POOL_DEPS,
      entry({ destinations: ["mission"], destinationOnly: true }, { into: { scenarioPlayArea: "mission" } }),
    )!;
    expect(choice.destinationOnly).toBe(true);
    expect(choice.options.map((option) => option.into)).toEqual(["mission"]);
    expect(choice.needsChoice).toBe(false);
    expect(choice.note).toBe("Only payable at the mission");
  });

  test("several areas are all offered after your own", () => {
    const choice = playDestinationChoice(state, POOL_DEPS, entry({ destinations: ["mission", "camp"] }))!;
    expect(choice.options.map((option) => option.label)).toEqual(["Your area", "The mission", "The camp"]);
  });
});

describe("playInto and the payment context", () => {
  const play = { type: "playCard", playerId: "p1", cardInstanceId: "i4", payment: [] } as unknown as Command;

  test("an area is sent as into, and your own area sends none", () => {
    expect(playInto(play, "mission")).toEqual({ ...play, into: { scenarioPlayArea: "mission" } });
    const there = playInto(play, "mission");
    expect("into" in playInto(there, null)).toBe(false);
    expect(playInto(there, null)).toEqual(play);
  });

  test("a command that is not a play is left alone", () => {
    const end = { type: "endTurn", playerId: "p1" } as unknown as Command;
    expect(playInto(end, "mission")).toBe(end);
  });

  test("the payment context prices the play where it will happen", () => {
    expect(paymentIntoOf({ into: "mission" })).toEqual({ into: "mission" });
    expect(paymentIntoOf({ into: null })).toEqual({});
  });
});
