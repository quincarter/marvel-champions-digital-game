/**
 * The `?screen=board&fixture=mission` dev jump (`scenes/boot.ts`): a real one-seat game with a mission area, for
 * checking the board's wave 8 interactions before the Age of Apocalypse campaign is registered in the client (it is
 * not; there is no menu path to a mission). Dev builds only: `boot.ts` reaches this through a dynamic import behind
 * `import.meta.env.DEV`, so a production build never bundles it, nor the cards package's test builder it loads.
 *
 * The state is the cards package's own `campaignGame` (`wave8/aoa/campaign/testing.ts`, test-only and not exported):
 * Spider-Man (Justice) against Rhino, the mission area created at setup with the mission, its Overseer and, with
 * `team`, Mission Team in play. The campaign abilities are merged into the app's `POOL_DEPS` registry in place, since
 * the board's view models read abilities from there; the campaign step will register them properly.
 *
 * Three more jumps live here for the same wave: `horsemen` (Golden Horse on a Horseman) and `grounded` (Jubilee with
 * Grounded in play). The mission jump's query parameters: `mission`, `overseer`, `team=0`, and comma lists of card
 * codes: `deck` (added to the deck), `hand`, `atmission` and `top` (moved there from the deck).
 *
 * The builder is loaded with `import.meta.glob`, which Vite serves from outside this package in dev and TypeScript
 * does not follow (a relative import of another package's source breaks this package's `rootDir`).
 */

import type { EngineDeps, GameState, InstanceId, PlayerId } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { DevStateHost } from "../engine/dev-state-host.js";
import { appSession, useDevHost } from "../session.js";

export interface MissionFixtureOptions {
  readonly mission: string;
  readonly overseer: string | undefined;
  readonly team: boolean;
  /** Codes added to the deck, so the three lists below can name them. */
  readonly deck: readonly string[];
  /** Codes moved from the deck to the hand before the first turn. */
  readonly hand: readonly string[];
  /** Codes put at the mission, faceup, under nobody's control (test surgery, as `atMission` does). */
  readonly atMission: readonly string[];
  /** Codes stacked on top of the deck, the first on top. */
  readonly top: readonly string[];
}

/** What this fixture uses of the cards package's `wave8/aoa/campaign/testing.ts`. */
interface MissionTesting {
  readonly campaignGame: (options: {
    readonly deck?: readonly string[];
    readonly mission?: { readonly mission: string; readonly overseer?: string; readonly team?: boolean };
  }) => GameState;
  readonly atMission: (state: GameState, player: PlayerId, ...codes: readonly string[]) => Staged;
  readonly CAMPAIGN_DEPS: EngineDeps;
}
/** What the cards package's `testing/harness.ts` offers for staging a hand and the top of a deck. */
interface Harness {
  readonly P1: PlayerId;
  readonly moveToHand: (state: GameState, player: PlayerId, ...codes: readonly string[]) => Staged;
  readonly putOnTopOfDeck: (state: GameState, player: PlayerId, ...codes: readonly string[]) => Staged;
}
interface Staged {
  readonly state: GameState;
  readonly ids: readonly InstanceId[];
}

const BUILDERS = import.meta.glob("../../../cards/src/wave8/aoa/campaign/testing.ts");
const HARNESS = import.meta.glob("../../../cards/src/testing/harness.ts");

/** Builds the mission game and swaps the app's host for one that plays it. Returns once the first turn is up. */
export async function startDevMissionGame(options: MissionFixtureOptions): Promise<void> {
  const load = Object.values(BUILDERS)[0];
  if (!load) throw new Error("the cards package's mission test builder is not reachable");
  const loadHarness = Object.values(HARNESS)[0];
  if (!loadHarness) throw new Error("the cards package's test harness is not reachable");
  const testing = (await load()) as MissionTesting;
  const harness = (await loadHarness()) as Harness;
  const deck = [...options.deck, ...options.hand, ...options.atMission, ...options.top];
  let state = testing.campaignGame({
    mission: {
      mission: options.mission,
      ...(options.overseer ? { overseer: options.overseer } : {}),
      team: options.team,
    },
    ...(deck.length > 0 ? { deck } : {}),
  });
  if (options.atMission.length > 0) state = testing.atMission(state, harness.P1, ...options.atMission).state;
  if (options.hand.length > 0) state = harness.moveToHand(state, harness.P1, ...options.hand).state;
  if (options.top.length > 0) state = harness.putOnTopOfDeck(state, harness.P1, ...options.top).state;
  Object.assign(POOL_DEPS.abilities, testing.CAMPAIGN_DEPS.abilities);
  const host = new DevStateHost(state, testing.CAMPAIGN_DEPS);
  useDevHost(host);
  // Headless click-through hook only: a driver reads instance ids and the live state from here (`e2e`-style QA).
  (window as unknown as { __mcMission?: unknown }).__mcMission = { store: appSession().store };
  await appSession().store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
  });
}

/**
 * The Four Horsemen (standard) with Golden Horse (45090) attached to the first Horseman, for Inspect's hit point floor
 * note ("Considered to have at least 1 hit point"). Played through the app's own host first, to the first turn; then the
 * card is moved from the encounter deck to its host by state surgery and the game goes on in a `DevStateHost`.
 */
export async function startDevHorsemenGame(): Promise<void> {
  const store = appSession().store;
  await store.start({
    scenarioId: "four-horsemen",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 3,
  });
  for (let step = 0; step < 40 && store.state.legal?.actions.kind === "choice"; step++) {
    const { choice } = store.state.legal.actions as {
      choice: { options: readonly { optionId: string }[]; minSelections: number };
    };
    await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
  }
  const game = store.state.game;
  if (!game) throw new Error("the Four Horsemen game did not start");
  const horse = Object.values(game.instances).find((instance) => (instance.cardId as string) === "45090");
  const host = game.villains[0]?.instanceId;
  if (!horse || !host) throw new Error("no Golden Horse or no Horseman in this game");
  const instances = {
    ...game.instances,
    [horse.instanceId]: { ...horse, controllerId: null, faceup: true, attachedTo: host },
    [host]: { ...game.instances[host]!, attachments: [...(game.instances[host]!.attachments ?? []), horse.instanceId] },
  };
  const encounterDecks = Object.fromEntries(
    Object.entries(game.encounterDecks).map(([id, piles]) => [
      id,
      { ...piles, deck: piles.deck.filter((card) => card !== horse.instanceId) },
    ]),
  );
  const state = { ...game, instances, encounterDecks } as GameState;
  const config = store.state.config;
  useDevHost(new DevStateHost(state, POOL_DEPS));
  (window as unknown as { __mcMission?: unknown }).__mcMission = { store: appSession().store, host };
  if (config) await appSession().store.start(config);
}

/**
 * Jubilee in alter-ego form on round 2's turn with Grounded (47023) in her play area, for the change-of-form payment
 * (`RuleSpec formChangeCost`, docs/phase7-wave8.md section 3.63: "Flip to hero" costs two cards of the same type). A
 * real game through the app's own host: Grounded is stacked as round 1's reveal and the first turn is ended.
 */
export async function startDevGroundedGame(): Promise<void> {
  const { cardId } = await import("@mc/content");
  const { nextTurn } = await import("./dev-game-steps.js");
  const store = appSession().store;
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "jubilee-justice" }],
    seed: 11,
    stack: { encounter: [cardId("01099"), cardId("47023")] },
  });
  (window as unknown as { __mcMission?: unknown }).__mcMission = { store };
  const turn = await nextTurn(store);
  const end = turn?.legal.find((entry) => entry.action.kind === "endTurn");
  if (end) await store.dispatch(end.example);
  await nextTurn(store);
}
