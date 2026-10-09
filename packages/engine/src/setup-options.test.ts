/**
 * `GameSetupConfig.setupOptions` (docs/phase7-wave8.md §3.5, §4.1 Q1 = A): an optional setup rule the players turned
 * on, with the amount they stated. The first user is MC45 p. 8's "Modular Difficulty" for an encounter set ("they may
 * place threat on Gene Pool during setup … The amount of threat placed is up to the players as a group"), so the
 * fixture mirrors it: a permanent, setup side scheme with 4 starting threat that the encounter deck brings, and an
 * option that places threat per player on it. The engine names neither.
 *
 * What is pinned: the option resolves after RRG 1.8 Appendix II step 11 (the setup card is in play) and before step
 * 12 (the main scheme's 1A Setup reads the threat it placed), in a standalone game and in a campaign game; the log
 * records the stated amount; nothing is placed that the config does not state, whatever the mode; and a game without
 * any is exactly the game it was.
 */
import { describe, expect, it } from "vitest";
import { cardId, flat, type CardId } from "@mc/content";
import type { EngineDeps } from "./abilities.js";
import type { GameEvent } from "./events.js";
import { createGame, type GameSetupConfig } from "./setup.js";
import type { GameState, SetupOption } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { syntheticCampaignInput } from "./testing/campaign.js";
import { runCommands } from "./testing/drive.js";
import { stubMainScheme, stubSideScheme } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO, VILLAIN, seatIdentities } from "./testing/scenario.js";

const POOL = stubSideScheme({
  id: "syn-pool",
  startingThreat: 4,
  keywords: [{ name: "permanent" }, { name: "setup" }],
});
const POOL_TARGET = { kind: "each", query: { categories: ["sideScheme"], name: POOL.name } } as const;

/** 1A Setup: "Place threat here equal to the threat on the Syn Pool": what step 12 saw on the setup card. */
const READ_POOL = stubAbility("syn-scheme.setup", {
  trigger: { kind: "setup" },
  effects: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "threat", of: POOL_TARGET } }],
});
const SCHEME = stubMainScheme({
  id: "syn-scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0), aSideAbilities: [READ_POOL.ref] }],
});
const deps: EngineDeps = depsOf(READ_POOL);

/** "Place N[per_hero] threat on the Syn Pool", for the amount the players stated. */
const poolThreat = (amount: number): SetupOption => ({
  option: "syn-set.modular-difficulty",
  amount,
  text: `Place ${amount}[per_hero] threat on the Syn Pool.`,
  citation: "test",
  effects: [{ kind: "placeThreat", target: POOL_TARGET, amount: { kind: "perPlayer", base: 0, perPlayer: amount } }],
});

interface Table {
  readonly options?: readonly SetupOption[];
  readonly campaign?: boolean;
  readonly expert?: boolean;
  readonly withPool?: boolean;
}

function config(table: Table): GameSetupConfig {
  const identities = seatIdentities(HERO, 2);
  return {
    seed: 7,
    cards: [...DEFAULT_CARDS, SCHEME, POOL, ...identities],
    villainCardId: VILLAIN.id,
    mainSchemeCardId: SCHEME.id,
    encounterDeck: table.withPool === false ? [] : [POOL.id],
    players: identities.map((identity) => ({ identityCardId: identity.id, deck: DEFAULT_DECK })),
    ...(table.options ? { setupOptions: table.options } : {}),
    ...(table.expert ? { difficulty: "expert" as const } : {}),
    ...(table.campaign
      ? {
          campaign: syntheticCampaignInput({
            seats: identities.map((identity, index) => ({
              seatNumber: index + 1,
              identityCardId: identity.id,
              deck: [] as CardId[],
              aspects: [],
              grantedCardIds: [],
            })),
          }),
        }
      : {}),
  };
}

function play(table: Table): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  const created = createGame(config(table), deps);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const driven = runCommands(created.state, deps);
  return { state: driven.state, events: [...created.events, ...driven.events] };
}

const poolId = (state: GameState): string | undefined =>
  Object.keys(state.instances).find((key) => state.instances[key]?.cardId === cardId(POOL.id));
const poolThreatOf = (state: GameState): number => state.instances[poolId(state) ?? ""]?.threat ?? -1;
const mainThreatOf = (state: GameState): number => state.instances[state.mainScheme.instanceId]?.threat ?? -1;
const applied = (events: readonly GameEvent[]) => events.filter((event) => event.type === "setupOptionApplied");

describe("setup options (GameSetupConfig.setupOptions)", () => {
  it("2 players, 2 per player: the setup card holds 8 after step 11, and step 12's Setup reads 8", () => {
    const { state, events } = play({ options: [poolThreat(2)] });
    expect(poolThreatOf(state)).toBe(8);
    // The 1A Setup placed what it read on the setup card: 8, not the printed 4.
    expect(mainThreatOf(state)).toBe(8);
    const id = poolId(state);
    const entered = events.findIndex((event) => event.type === "cardMoved" && event.instanceId === id);
    const logged = events.findIndex((event) => event.type === "setupOptionApplied");
    const placed = events.findIndex(
      (event) => event.type === "threatPlaced" && event.schemeInstanceId === id && event.amount === 4,
    );
    const setupRead = events.findIndex(
      (event) => event.type === "threatPlaced" && event.schemeInstanceId === state.mainScheme.instanceId,
    );
    const drawn = events.findIndex((event) => event.type === "cardDrawn");
    expect(entered).toBeGreaterThanOrEqual(0);
    // Logged when applied: after the card entered play and the option's threat was placed, before step 12 reads it.
    expect(entered).toBeLessThan(placed);
    expect(placed).toBeLessThan(logged);
    expect(logged).toBeLessThan(setupRead);
    if (drawn >= 0) expect(setupRead).toBeLessThan(drawn);
  });

  it("is logged when applied: after step 11's starting threat and its own threat, before step 12 reads the card", () => {
    // 3 per player: the option's 6 can be told from the card's own starting 4.
    const { state, events } = play({ options: [poolThreat(3)] });
    const id = poolId(state);
    const placedAt = (amount: number) =>
      events.findIndex((e) => e.type === "threatPlaced" && e.schemeInstanceId === id && e.amount === amount);
    const logged = events.findIndex((event) => event.type === "setupOptionApplied");
    const setupRead = events.findIndex(
      (event) => event.type === "threatPlaced" && event.schemeInstanceId === state.mainScheme.instanceId,
    );
    expect(placedAt(4)).toBeGreaterThanOrEqual(0);
    expect(placedAt(4)).toBeLessThan(placedAt(6));
    expect(placedAt(6)).toBeLessThan(logged);
    expect(logged).toBeLessThan(setupRead);
    expect(state.stack).toEqual([]);
  });

  it("several options are logged in the order listed, one with no instruction in its place", () => {
    const bare: SetupOption = {
      option: "syn-set.note",
      amount: 1,
      text: "Nothing to do.",
      citation: "test",
      effects: [],
    };
    const second: SetupOption = { ...poolThreat(1), option: "syn-set.second" };
    const { state, events } = play({ options: [poolThreat(3), bare, second] });
    expect(applied(events).map((event) => event.option)).toEqual([
      "syn-set.modular-difficulty",
      "syn-set.note",
      "syn-set.second",
    ]);
    expect(poolThreatOf(state)).toBe(4 + 6 + 2);
    // Each entry follows its own change: the second option's 2 threat is placed after the first two are logged.
    const id = poolId(state);
    const lastPlaced = events.findIndex(
      (e) => e.type === "threatPlaced" && e.schemeInstanceId === id && e.amount === 2,
    );
    const logs = events.flatMap((event, at) => (event.type === "setupOptionApplied" ? [at] : []));
    expect(logs[1]!).toBeLessThan(lastPlaced);
    expect(lastPlaced).toBeLessThan(logs[2]!);
  });

  it("logs the option and the stated amount, once", () => {
    const option = poolThreat(2);
    expect(applied(play({ options: [option] }).events)).toEqual([
      { type: "setupOptionApplied", option: option.option, amount: 2, text: option.text, citation: option.citation },
    ]);
  });

  it.each([1, 3])("places the amount stated and no other (%i per player)", (amount) => {
    const { state } = play({ options: [poolThreat(amount)] });
    expect(poolThreatOf(state)).toBe(4 + amount * 2);
  });

  it("stated at 0: the printed 4, and the log says 0", () => {
    const { state, events } = play({ options: [poolThreat(0)] });
    expect(poolThreatOf(state)).toBe(4);
    expect(mainThreatOf(state)).toBe(4);
    expect(applied(events).map((event) => event.amount)).toEqual([0]);
  });

  it("expert mode with the option left off: the printed 4, nothing derived from the mode, no log entry", () => {
    for (const options of [undefined, []]) {
      const { state, events } = play({ expert: true, ...(options ? { options } : {}) });
      expect(poolThreatOf(state)).toBe(4);
      expect(applied(events)).toEqual([]);
      expect("setupOptions" in state.scenarioRules).toBe(false);
    }
  });

  it("a game without any is the game it was: the same state and events as before the field existed", () => {
    const without = play({});
    const empty = play({ options: [] });
    expect(JSON.stringify(empty.state)).toBe(JSON.stringify(without.state));
    expect(empty.events).toEqual(without.events);
  });

  it("is plain data carried into the state, so a save replays it, and the same config gives the same game", () => {
    const first = play({ options: [poolThreat(2)] });
    expect(first.state.scenarioRules.setupOptions).toEqual([poolThreat(2)]);
    expect(JSON.parse(JSON.stringify(first.state.scenarioRules))).toEqual(first.state.scenarioRules);
    const second = play({ options: [poolThreat(2)] });
    expect(JSON.stringify(second.state)).toBe(JSON.stringify(first.state));
    expect(second.events).toEqual(first.events);
  });

  it("resolves in a campaign game too, in the same place", () => {
    const { state, events } = play({ options: [poolThreat(2)], campaign: true });
    expect(poolThreatOf(state)).toBe(8);
    expect(mainThreatOf(state)).toBe(8);
    expect(applied(events)).toHaveLength(1);
  });

  it("with no card for it to act on, the option is logged and changes nothing", () => {
    const { state, events } = play({ options: [poolThreat(2)], withPool: false });
    expect(poolId(state)).toBeUndefined();
    expect(mainThreatOf(state)).toBe(0);
    expect(applied(events)).toHaveLength(1);
  });

  it("refuses an amount that is not a whole number of 0 or more, an empty id, and an option listed twice", () => {
    const refused = (options: readonly SetupOption[]) => {
      const created = createGame(config({ options }), deps);
      return created.ok ? "ok" : created.error.code;
    };
    expect(refused([poolThreat(-1)])).toBe("invalid_setup");
    expect(refused([{ ...poolThreat(1), amount: 1.5 }])).toBe("invalid_setup");
    expect(refused([{ ...poolThreat(1), option: "" }])).toBe("invalid_setup");
    expect(refused([poolThreat(1), poolThreat(2)])).toBe("invalid_setup");
  });
});
