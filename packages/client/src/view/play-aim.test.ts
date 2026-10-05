/**
 * Energy Transfer (38007) is Rogue's "attach Touched to a character other than Rogue and deal 2 damage to that
 * character" cost (RRG 1.8 erratum p. 69). `legalActions` offers one play variant per possible host; the player
 * picks, so the client re-aims the example at the picked host in the cost's own slot and never takes the first
 * (QA playthrough C, defect C1: it attached to Spiral, who cannot take damage). Real content, real commands.
 */
import { describe, expect, test } from "vitest";
import { applyCommand, legalActions, type Command, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { EngineSessionCore } from "../engine/session-core.js";
import { POOL_DEPS } from "../content/pool.js";
import { retarget } from "../scenes/board/selection.js";
import { actionAbilityCost } from "./cost-choice-model.js";
import { aimedAt, costPickSlot, needsPlayAim, playAimPrompt } from "./play-aim.js";

const ENERGY_TRANSFER = "38007";

function run(state: GameState, command: Command): GameState {
  const result = applyCommand(state, command, POOL_DEPS);
  if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.message}`);
  return result.state;
}

function settle(state: GameState): GameState {
  let current = state;
  for (let guard = 0; guard < 40 && current.pendingChoice; guard++) {
    const choice = current.pendingChoice;
    current = run(current, {
      type: "resolveChoice",
      playerId: choice.playerId,
      choiceId: choice.choiceId,
      selectedOptionIds: choice.options.slice(0, choice.minSelections).map((option) => option.optionId),
    });
  }
  return current;
}

async function rogueWithEnergyTransfer(
  scenarioId = "rhino",
  players: readonly { starterDeckId: string }[] = [
    { starterDeckId: "rogue-protection" },
    { starterDeckId: "core-spider-man-justice" },
  ],
): Promise<{ state: GameState; me: PlayerId; transfer: InstanceId }> {
  const core = new EngineSessionCore();
  const started = await core.start({ scenarioId, difficulty: "standard", players, seed: 11 });
  let state = settle({ ...started.snapshot.state, cardPool: started.cardPool } as GameState);
  const me = state.players[0]!.playerId;
  if (state.players[0]!.identity.form !== "hero") state = run(state, { type: "changeForm", playerId: me });
  const seat = state.players[0]!;
  const transfer = [...seat.deck, ...seat.hand, ...seat.discard].find(
    (id) => state.instances[id]?.cardId === ENERGY_TRANSFER,
  );
  if (!transfer) throw new Error("no Energy Transfer in Rogue's deck");
  state = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === me
        ? {
            ...p,
            hand: [...p.hand.filter((id) => id !== transfer), transfer],
            deck: p.deck.filter((id) => id !== transfer),
            discard: p.discard.filter((id) => id !== transfer),
          }
        : p,
    ),
  };
  return { state, me, transfer };
}

const playEntry = (state: GameState, me: PlayerId, id: InstanceId) => {
  const legal = legalActions(state, me, POOL_DEPS);
  if (legal.kind !== "turn") throw new Error(`expected a turn, got ${legal.kind}`);
  const entry = legal.legal.find((e) => e.action.kind === "playCard" && e.action.instanceId === id);
  if (!entry) throw new Error("Energy Transfer is not playable");
  return entry;
};

describe("aiming a play at the host the player picked", () => {
  test("Energy Transfer lists several hosts, and the picked one rides in the cost's own slot", async () => {
    const { state, me, transfer } = await rogueWithEnergyTransfer();
    const entry = playEntry(state, me, transfer);
    expect(entry.targets.length).toBeGreaterThan(1);
    expect(entry.targets).not.toContain(state.players[0]!.identity.instanceId);
    expect(playAimPrompt(state, POOL_DEPS, entry)).toBe("Energy Transfer: choose the character it attaches to");

    // The first host is what `example` takes; the second is what the player picks instead.
    const [first, second] = entry.targets as [InstanceId, InstanceId];
    const aimed = retarget(state, entry.example, second);
    expect(aimed.type).toBe("playCard");
    const slot = costPickSlot(actionAbilityCost(state, POOL_DEPS, me, entry.action))!;
    expect(slot).toBe("host");
    expect((aimed as Extract<Command, { type: "playCard" }>).costChoices?.[slot]).toEqual([second]);
    expect((entry.example as Extract<Command, { type: "playCard" }>).costChoices?.[slot]).toEqual([first]);

    // The engine takes it and attaches Touched where the player said, whichever host that is.
    for (const host of entry.targets) {
      const after = settle(run(state, aimedAt(state, POOL_DEPS, entry.example, host)));
      const touched = Object.values(after.instances).find((i) => i.cardId === "38002");
      expect(touched?.attachedTo).toBe(host);
    }
  });

  test("several listed hosts are a question; a lone host is not", async () => {
    const { state, me, transfer } = await rogueWithEnergyTransfer();
    expect(needsPlayAim(playEntry(state, me, transfer))).toBe(true);
    // Another seat's identity is a host too, so the engine's `example` (the first host) is never taken silently.
    const entry = playEntry(state, me, transfer);
    expect(entry.targets.length).toBeGreaterThan(1);
  });

  test("Sabretooth solo: Robert Kelly cannot have player cards attached, so Sabretooth is the only host listed", async () => {
    const { state, me, transfer } = await rogueWithEnergyTransfer("sabretooth", [
      { starterDeckId: "rogue-protection" },
    ]);
    const kelly = Object.keys(state.instances).find((id) => state.instances[id as InstanceId]?.cardId === "32066");
    expect(kelly, "Robert Kelly is in play, attached to Find the Senator").toBeDefined();
    const entry = playEntry(state, me, transfer);
    // Kelly's own text: "cannot have player cards attached". Touched is a player card, so he is not a legal host and
    // there is nothing to ask: one host, not a silent pick among two.
    expect(entry.targets).not.toContain(kelly);
    expect(entry.targets).toHaveLength(1);
    expect(needsPlayAim(entry)).toBe(false);
  });
});
