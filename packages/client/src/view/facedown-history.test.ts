/**
 * Issue #291: an Ultron Drone that attacks and then leaves play in the same command (Retaliate kills it) was named
 * and pictured by the card underneath ("Indomitable attacks you") in the log, the villain-phase walkthrough and its
 * round recap, because all three read the state after the whole command, where the card is faceup in a discard pile.
 */
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { cardOf, getInstance, type GameEvent, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { CARD_BACKS, artFor, setShownStandIns, standInArt } from "../art/art-source.js";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { faceOf } from "./board-model.js";
import { facedownUntilLater } from "./facedown-history.js";
import { appendEvents, emptyLog } from "./log-lines.js";
import { cardName } from "./names.js";
import { activationHiddenFace } from "./villain-breakdown.js";
import { villainRecapOf } from "./villain-recap.js";
import { appendWalkthrough, emptyWalkthrough } from "./villain-walkthrough.js";

interface Table {
  readonly before: GameState;
  readonly drone: InstanceId;
  readonly owner: PlayerId;
}

/** A real Ultron game played until a Drone is engaged with the player. */
async function droneOnTheTable(): Promise<Table> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "ultron",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 11,
  });
  for (let step = 0; step < 400 && !store.state.game!.outcome; step++) {
    const game = store.state.game!;
    const drone = Object.values(game.instances).find((instance) => instance.facedownAs?.kind === "minion");
    if (drone && store.state.legal?.actions.kind === "turn") {
      return { before: game, drone: drone.instanceId, owner: drone.ownerId! };
    }
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
  }
  throw new Error("no Drone came into play");
}

/** The state after the command: the Drone is its owner's card again, faceup in their discard pile. */
function droneDefeated({ before, drone, owner }: Table): GameState {
  return {
    ...before,
    players: before.players.map((seat) =>
      seat.playerId === owner
        ? { ...seat, playArea: seat.playArea.filter((id) => id !== drone), discard: [...seat.discard, drone] }
        : seat,
    ),
    instances: {
      ...before.instances,
      [drone]: { ...before.instances[drone]!, facedownAs: null, faceup: true, engagedWith: null, damage: 0 },
    },
  };
}

/** One command: the villain phase starts, the Drone attacks for 1, and the attack's Retaliate defeats it. */
function burst({ before, drone, owner }: Table): readonly GameEvent[] {
  const target = before.players.find((seat) => seat.playerId === owner)!.identity.instanceId;
  return [
    { type: "stepChanged", from: before.step, to: { phase: "villain", kind: "enemyActivations" } } as GameEvent,
    { type: "enemyActivated", enemyInstanceId: drone, activation: "attack", playerId: owner },
    {
      type: "attackResolved",
      enemyInstanceId: drone,
      targetInstanceId: target,
      baseAtk: 1,
      boostIcons: 0,
      defenseReduction: 0,
      damageDealt: 1,
    },
    {
      type: "characterDefeated",
      instanceId: drone,
      cardId: before.instances[drone]!.cardId,
      facedownAs: before.instances[drone]!.facedownAs!,
    },
  ];
}

describe("a Drone that leaves play in the command it attacked in (#291)", () => {
  let table: Table;
  let after: GameState;
  let events: readonly GameEvent[];
  let printed: string;

  beforeAll(async () => {
    table = await droneOnTheTable();
    after = droneDefeated(table);
    events = burst(table);
    printed = cardOf(after, table.drone)!.name;
  }, 120_000);

  afterEach(() => setShownStandIns(new Set()));

  test("the state after the command names the card underneath, which is why the lines can't read it", () => {
    expect(cardName(table.before, table.drone)).toBe("DRONE");
    expect(cardName(after, table.drone)).toBe(printed);
  });

  test("the defeat later in the command says it was a Drone until then", () => {
    expect(facedownUntilLater(events, 1, table.drone)?.kind).toBe("minion");
    expect(facedownUntilLater(events, 3, table.drone)).toBeNull();
  });

  test("the log says the Drone attacked", () => {
    const log = appendEvents(emptyLog(), events, after, table.owner, POOL_DEPS);
    const attack = log.lines.find((line) => line.text.includes("attacks"));
    expect(attack?.text).toMatch(/^DRONE attacks/);
    expect(log.lines.some((line) => line.text.includes(`${printed} attacks`))).toBe(false);
  });

  test("the round recap's row says the Drone attacked, as a minion, and draws a card back", () => {
    const walkthrough = appendWalkthrough(emptyWalkthrough(1), events, after, table.owner, POOL_DEPS);
    const recap = villainRecapOf(walkthrough, table.before, after, table.owner, POOL_DEPS);
    const row = recap.columns.flatMap((column) => column.entries).find((entry) => entry.kind === "activation")!;
    expect(row.headline).toBe("DRONE attacks you");
    expect(row.cardType).toBe("minion");
    expect(row.detail).toBe("ATK 1 · minions take no boost");
    expect(row.cardFace).toEqual({ kind: "back", back: "player", standIn: { kind: "ultronDrone", atk: 1 } });
    expect(artFor(cardOf(after, table.drone), row.cardFace!)).toEqual(CARD_BACKS.player);
  });

  test("with the Drone art earned and on, that row draws the Drone at the attack's ATK", () => {
    setShownStandIns(new Set(["ultronDrone"]));
    const walkthrough = appendWalkthrough(emptyWalkthrough(1), events, after, table.owner, POOL_DEPS);
    const activation = walkthrough.steps
      .flatMap((step) => step.beats)
      .findLast((beat) => beat.activation?.kind === "attack" && beat.activation.resolved)!.activation!;
    expect(artFor(undefined, activationHiddenFace(activation)!)).toEqual(standInArt({ kind: "ultronDrone", atk: 1 }));
  });

  test("a Drone in play shows the Drone art at its ATK only once earned and on", () => {
    const face = faceOf(table.before, table.drone);
    expect(face).toMatchObject({ kind: "back", back: "player", standIn: { kind: "ultronDrone" } });
    expect(artFor(cardOf(table.before, table.drone), face)).toEqual(CARD_BACKS.player);
    setShownStandIns(new Set(["ultronDrone"]));
    expect(artFor(cardOf(table.before, table.drone), face).url).toMatch(/stand-ins\/ultron-drone-atk-\d\.webp$/);
    expect(getInstance(table.before, table.drone)?.facedownAs).not.toBeNull();
  });
});
