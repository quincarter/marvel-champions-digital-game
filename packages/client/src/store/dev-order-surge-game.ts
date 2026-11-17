/**
 * The `?screen=board&fixture=play-area-order` and `&fixture=surge` dev jumps (`scenes/boot-dev-jump.ts`): the PR
 * screenshots for the Play area order setting (#768) and the surge marks in the log and the villain phase recap (#764).
 *
 * - play-area-order: the crowded three-seat game (`dev-crowded-game.ts`), whose first seat has allies, supports and
 *   upgrades in play in the order they were played; the order itself is the `playAreaOrder` setting (`&order=type`).
 * - surge: a real Rhino game (the shape of `view/surge-marks.test.ts`) whose first villain-phase card is swapped to a
 *   core treachery that prints surge. A state edit made once before the game starts (`DevStateHost`), then every
 *   command is the engine's own. The returned function ends the turn once the board is up, because the walkthrough only
 *   collects beats while Board is mounted.
 */
import type { GameEvent, GameState } from "@mc/engine";
import { POOL_CARDS, POOL_DEPS } from "../content/pool.js";
import { DevStateHost } from "../engine/dev-state-host.js";
import { LocalEngineHost } from "../engine/local-host.js";
import type { SessionConfig } from "../engine/host.js";
import { appSession, useDevHost } from "../session.js";
import { PLAY_AREA_ORDER_VALUES } from "../settings.js";
import { startCrowdedGame } from "./dev-crowded-game.js";
import { nextTurn } from "./dev-game-steps.js";
import { SessionStore } from "./session-store.js";

export const SURGE_CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 7,
};

export async function startDevPlayAreaOrderGame(order: string | null): Promise<void> {
  const picked = PLAY_AREA_ORDER_VALUES.find((value) => value === order);
  const session = appSession();
  if (picked) session.settings = { ...session.settings, playAreaOrder: picked };
  await startCrowdedGame(session.store);
}

async function endTurn(store: SessionStore): Promise<void> {
  const turn = await nextTurn(store);
  const end = turn?.legal.find((entry) => entry.action.kind === "endTurn");
  if (end) await store.dispatch(end.example);
  await nextTurn(store);
}

/** The game with the first villain-phase card swapped to a printed-surge treachery; ends the turn once the board is up. */
export async function startDevSurgeGame(): Promise<() => Promise<void>> {
  const probe = new SessionStore(new LocalEngineHost());
  await probe.start(SURGE_CONFIG);
  const state = probe.state.game!;
  const events: GameEvent[] = [];
  const watcher = new SessionStore(new DevStateHost(state, POOL_DEPS));
  await watcher.start(SURGE_CONFIG);
  watcher.subscribe((s) => events.push(...s.lastEvents));
  await endTurn(watcher);
  const first = events.find((e) => e.type === "encounterCardDealt" && e.source === "villainPhase");
  if (!first || first.type !== "encounterCardDealt") throw new Error("no encounter card dealt");
  const surgeCard = POOL_CARDS.find(
    (card) => card.type === "treachery" && card.keywords?.some((keyword) => keyword.name === "surge"),
  )!;
  const staged: GameState = {
    ...state,
    instances: {
      ...state.instances,
      [first.instanceId]: { ...state.instances[first.instanceId]!, cardId: surgeCard.id },
    },
  };
  useDevHost(new DevStateHost(staged, POOL_DEPS));
  const store = appSession().store;
  await store.start(SURGE_CONFIG);
  await nextTurn(store);
  return () => endTurn(store);
}
