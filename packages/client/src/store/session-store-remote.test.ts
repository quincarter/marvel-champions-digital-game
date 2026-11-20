/**
 * A command a seat holder proposed in a lobby room is applied by the engine worker, not dispatched by this store
 * (issue #881): the update carries it as `remote`, and the store's trail, which Undo reads, still has one entry per command.
 */
import type { Command, LegalActions } from "@mc/engine";
import { describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import type { EngineUpdate, SessionConfig, UpdateListener } from "../engine/host.js";
import { SessionStore } from "./session-store.js";

const CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 2026,
};

/** A local host that tags the update of the next dispatch as a seat holder's command, as the worker host does. */
class RemoteTaggingHost extends LocalEngineHost {
  remote: Command | null = null;
  override subscribe(listener: UpdateListener): () => void {
    return super.subscribe((update: EngineUpdate) => {
      const remote = this.remote;
      this.remote = null;
      listener(remote ? { ...update, remote } : update);
    });
  }
}

function anyLegalCommand(legal: LegalActions): Command {
  if (legal.kind === "choice") {
    const option = legal.choice.options[0]!;
    return {
      type: "resolveChoice",
      playerId: legal.choice.playerId,
      choiceId: legal.choice.choiceId,
      selectedOptionIds: [option.optionId],
    };
  }
  if (legal.kind !== "turn") throw new Error("nothing legal");
  return (legal.legal.find((a) => a.action.kind === "endTurn") ?? legal.legal[0]!).example;
}

describe("a seat holder's command in the host's store", () => {
  test("joins the trail, so the trail stays as long as the version", async () => {
    const host = new RemoteTaggingHost();
    const store = new SessionStore(host);
    await store.start(CONFIG);
    expect(store.state.commandTrail).toHaveLength(0);

    const command = anyLegalCommand((await host.legalActions(store.state.legal!.playerId)) as LegalActions);
    host.remote = command;
    const result = await host.dispatch(command);
    expect(result.ok).toBe(true);

    expect(store.state.version).toBe(1);
    expect(store.state.commandTrail).toHaveLength(1);
    expect(store.state.commandTrail[0]).toMatchObject({ playerId: command.playerId, command });
    expect(store.state.commandTrail[0]!.events.length).toBeGreaterThan(0);
  });

  test("a host command after it keeps the trail in step", async () => {
    const host = new RemoteTaggingHost();
    const store = new SessionStore(host);
    await store.start(CONFIG);
    const first = anyLegalCommand(await host.legalActions(store.state.legal!.playerId));
    host.remote = first;
    await host.dispatch(first);
    expect(await store.dispatch(anyLegalCommand(await host.legalActions(store.state.legal!.playerId)))).toBe(true);
    expect(store.state.commandTrail).toHaveLength(store.state.version);
  });
});
