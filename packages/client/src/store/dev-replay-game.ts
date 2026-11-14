/**
 * The `?screen=replay` dev jump (`scenes/boot-dev-jump.ts`, issue #693): plays a short real game in the page with the
 * engine's own session core (greedy: End turn whenever it can, the first option of any choice), then opens it as a
 * replay over an in-thread `ReplayCore`, so the replay screen can be screenshotted without a saved game on the machine.
 */
import type { Command, LegalActions } from "@mc/engine";
import { POOL_VERSION } from "../content/pool.js";
import { MemoryGameStorage } from "../engine/game-storage.js";
import type { SessionConfig } from "../engine/host.js";
import { EngineSessionCore } from "../engine/session-core.js";
import { ReplayCore } from "../replay/replay-core.js";
import { LocalReplayBackend, ReplayHost } from "../replay/replay-host.js";
import { CLIENT_VERSION } from "../version.js";

const CONFIG: SessionConfig = {
  scenarioId: "ultron",
  difficulty: "standard",
  players: [{ starterDeckId: "core-captain-marvel-leadership" }, { starterDeckId: "core-iron-man-aggression" }],
  seed: 77,
};

function anyLegalCommand(legal: LegalActions): Command | null {
  if (legal.kind === "choice") {
    return {
      type: "resolveChoice",
      playerId: legal.choice.playerId,
      choiceId: legal.choice.choiceId,
      selectedOptionIds: legal.choice.options.slice(0, legal.choice.minSelections).map((option) => option.optionId),
    };
  }
  if (legal.kind !== "turn") return null;
  const action = legal.legal.find((a) => a.action.kind === "endTurn") ?? legal.legal[0];
  return action ? action.example : null;
}

/** A game of up to `commands` commands, opened as a replay. */
export async function openDevReplay(
  commands: number,
  options: { readonly otherBuild?: boolean; readonly config?: SessionConfig } = {},
): Promise<ReplayHost> {
  const config = options.config ?? CONFIG;
  const storage = new MemoryGameStorage();
  const core = new EngineSessionCore({ storage });
  const started = await core.start(config);
  let toAct = started.snapshot.legal?.playerId ?? null;
  for (let i = 0; i < commands && toAct; i++) {
    const command = anyLegalCommand(core.legalActions(toAct));
    if (!command) break;
    const dispatched = core.dispatch(command);
    if (!dispatched.ok) break;
    toAct = dispatched.snapshot.legal?.playerId ?? null;
  }
  await core.flushed();
  const [meta] = await storage.list();
  if (!meta) throw new Error("the dev game was not saved");
  const host = new ReplayHost(
    new LocalReplayBackend(new ReplayCore({ appVersion: CLIENT_VERSION, contentVersion: POOL_VERSION }, storage)),
  );
  await host.open({ kind: "stored", gameId: meta.id });
  if (!options.otherBuild) return host;
  // `&other=1`: the same game as a file written by another release, for the banner.
  const { bytes } = await host.exportFile();
  host.dispose();
  const elsewhere = new ReplayHost(
    new LocalReplayBackend(new ReplayCore({ appVersion: "0.0.1-dev", contentVersion: "other-pool" }, storage)),
  );
  await elsewhere.open({ kind: "file", bytes });
  return elsewhere;
}
