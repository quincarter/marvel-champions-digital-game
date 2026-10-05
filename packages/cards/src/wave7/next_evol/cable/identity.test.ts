import {
  createGame,
  replay,
  sessionApply,
  startSession,
  type Command,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  patchInstance,
  playerOf,
  settle,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, withForm } from "../../../testing/staging.js";
import { WAVE7_DEPS, wave7Scenario } from "../../index.js";
import { CABLE_IDENTITY } from "./identity.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Cable / Nathan Summers (40001a/b), docs/phase7-wave7.md §7.1, §3.52. Cable's real precon (`cable-leadership`) against
 * Juggernaut, through `wave7Scenario` with the real registry. Cable: THW 2, ATK 2, DEF 2, 12 hit points, hand size 5;
 * Nathan Summers: REC 4, hand size 6. A player side scheme is 5 threat for Technovirus Purge (40006) and 2 base threat
 * for Lock and Load (40019) / Establish Perimeter (40020) / Call for Backup (40018).
 */
const RESPONSE = "40001a.cable-response";
const CONSTANT = "40001b.nathan-summers-constant";
const SOLDIER_X = "40001b.soldier-x";
const CABLE = { starterDeckId: "cable-leadership" } as const;
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const PURGE = "40006";
// Technovirus Purge, Call for Backup, Lock and Load, Establish Perimeter and Leadership's 40027 (Cable's precon).
const SCHEMES_IN_DECK = ["40006", "40018", "40019", "40020", "40027"];
const BREAKIN = "40131"; // Captive Hope: an encounter side scheme (the Juggernaut scenario's), staged at 2 threat

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
/** Every player side scheme in play (the villain area holds them next to the main scheme). */
const playerSideSchemes = (s: GameState): InstanceId[] =>
  s.villainArea.filter((id) => s.cardPool[s.instances[id]!.cardId]!.type === "player_side_scheme");

type Seat = typeof CABLE | typeof SPIDER_MAN;

/** Setup picks `pickCode` for Soldier X's search when offered (otherwise the first legal option). */
const choosing =
  (pickCode: string): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseCards") {
      const hit = choice.options.find((o) => codeOf(state, o.optionId as InstanceId) === pickCode);
      if (hit) return [hit.optionId];
    }
    return firstLegal(state);
  };

function setupGame(players: readonly Seat[] = [CABLE], pick: Picker = firstLegal, seed = 1): GameState {
  const config = wave7Scenario("juggernaut", { players, seed, difficulty: "standard", modularSetIds: [] });
  const created = createGame(config, WAVE7_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, pick, (s) => s.step.phase === "player", WAVE7_DEPS);
}

/** Cable in hero form, Technovirus Purge in play and the given scheme threat. */
function heroGame(players: readonly Seat[] = [CABLE], seed = 1): GameState {
  return withForm(setupGame(players, choosing(PURGE), seed), { heroForm: 0 });
}
const purgeOf = (s: GameState): InstanceId => instancesOf(s, PURGE)[0]!;

const thwart = (player: typeof P1, thwarter: InstanceId, scheme: InstanceId): Command => ({
  type: "basicThwart",
  playerId: player,
  thwarterInstanceId: thwarter,
  schemeInstanceId: scheme,
});
const accepting: Picker = (state) => {
  const choice = state.pendingChoice;
  if (choice?.prompt.kind === "chooseTriggers") {
    const hit = choice.options.find((o) => o.optionId.includes(RESPONSE));
    return hit ? [hit.optionId] : [];
  }
  return firstLegal(state);
};
/** Whether Cable was offered his response while resolving `command`. */
function offeredResponse(state: GameState, command: Command): { state: GameState; offered: boolean } {
  let offered = false;
  const pick: Picker = (s) => {
    if (
      s.pendingChoice?.prompt.kind === "chooseTriggers" &&
      s.pendingChoice.options.some((o) => o.optionId.includes(RESPONSE))
    )
      offered = true;
    return accepting(s);
  };
  const result = driveEventsPicking(WAVE7_DEPS, state, pick, command);
  return { state: result.state, offered };
}

describe("Cable identity registry", () => {
  it.each([RESPONSE, CONSTANT, SOLDIER_X])("%s validates", (id) => {
    expect(validateDefinition(CABLE_IDENTITY[id]!)).toEqual([]);
  });
  it("holds exactly the three identity refs", () => {
    expect(Object.keys(CABLE_IDENTITY).sort()).toEqual([RESPONSE, CONSTANT, SOLDIER_X].sort());
  });
});

describe("Nathan Summers: Soldier X (Setup)", () => {
  it("searches the deck for a player side scheme and puts the chosen one into play, 5 threat for Technovirus Purge", () => {
    const state = setupGame([CABLE], choosing(PURGE));
    expect(playerSideSchemes(state).map((id) => codeOf(state, id))).toEqual([PURGE]);
    expect(inst(state, purgeOf(state)).threat).toBe(5);
    expect(playerOf(state, P1).deck).not.toContain(purgeOf(state));
    expect(playerOf(state, P1).discard).not.toContain(purgeOf(state));
    // Cable starts in alter-ego form with a hand of 6.
    expect(playerOf(state, P1).identity.form).toBe("alterEgo");
    expect(playerOf(state, P1).hand).toHaveLength(6);
  });

  it("offers every player side scheme the deck holds, and puts a 2-threat scheme into play when chosen", () => {
    let offered: string[] = [];
    const pick: Picker = (s) => {
      if (s.pendingChoice?.prompt.kind === "chooseCards")
        offered = s.pendingChoice.options.map((o) => codeOf(s, o.optionId as InstanceId));
      return choosing("40019")(s);
    };
    const state = setupGame([CABLE], pick);
    // The opening hand may hold some of the four, so the offer is a subset of the deck's four schemes.
    expect(offered.length).toBeGreaterThan(0);
    expect(offered.filter((c) => !SCHEMES_IN_DECK.includes(c))).toEqual([]);
    const inPlay = playerSideSchemes(state);
    expect(inPlay).toHaveLength(1);
    expect(codeOf(state, inPlay[0]!)).toBe("40019");
    expect(inst(state, inPlay[0]!).threat).toBe(2);
  });

  it("shuffles the deck afterwards: deck size is 40 minus the scheme minus the hand", () => {
    const state = setupGame([CABLE], choosing(PURGE));
    const handAndDeck = playerOf(state, P1).hand.length + playerOf(state, P1).deck.length;
    expect(handAndDeck).toBe(40 - 1);
  });

  it("two players: the limit of one holds, and only Cable's Setup puts a scheme into play", () => {
    const state = setupGame([CABLE, SPIDER_MAN], choosing(PURGE));
    expect(playerSideSchemes(state).map((id) => codeOf(state, id))).toEqual([PURGE]);
    expect(inst(state, purgeOf(state)).controllerId).toBe(P1);
    expect(playerOf(state, P2).hand).toHaveLength(6);
  });

  it("the setup is deterministic: replaying the log reproduces the game", () => {
    const config = wave7Scenario("juggernaut", {
      players: [CABLE],
      seed: 3,
      difficulty: "standard",
      modularSetIds: [],
    });
    const created = createGame(config, WAVE7_DEPS);
    if (!created.ok) throw new Error(created.error.message);
    let session = startSession(created.state);
    for (let guard = 0; session.state.pendingChoice && guard < 200; guard++) {
      const choice = session.state.pendingChoice;
      const selected = choosing(PURGE)(session.state);
      const r = sessionApply(
        session,
        {
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: selected,
        },
        WAVE7_DEPS,
      );
      if (!r.ok) throw new Error(r.error.message);
      session = r.session;
    }
    const replayed = replay(session.log, WAVE7_DEPS);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});

describe("Cable: Response after he defeats a side scheme", () => {
  it("his basic thwart defeating a player side scheme readies him", () => {
    const base = heroGame();
    const cable = identityOf(base, P1);
    const staged = patchInstance(base, purgeOf(base), { threat: 2 });
    const { state, offered } = offeredResponse(staged, thwart(P1, cable, purgeOf(staged)));
    expect(offered).toBe(true);
    // Victory 0: the defeated scheme goes to the victory display, and Cable stands ready again.
    expect(state.victoryDisplay).toContain(purgeOf(state));
    expect(state.villainArea).not.toContain(purgeOf(state));
    expect(inst(state, cable).exhausted).toBe(false);
  });

  it("an encounter side scheme counts too", () => {
    const base = heroGame();
    const cable = identityOf(base, P1);
    const { state: withScheme, id: scheme } = encounterCardInVillainArea(base, BREAKIN, 2);
    const { state, offered } = offeredResponse(withScheme, thwart(P1, cable, scheme));
    expect(offered).toBe(true);
    expect(inst(state, cable).exhausted).toBe(false);
  });

  it("thwarting without defeating the scheme does not ready him", () => {
    const base = heroGame();
    const cable = identityOf(base, P1);
    const { state, offered } = offeredResponse(base, thwart(P1, cable, purgeOf(base)));
    expect(offered).toBe(false);
    expect(inst(state, purgeOf(state)).threat).toBe(3);
    expect(inst(state, cable).exhausted).toBe(true);
  });

  it("limit once per phase: a second defeat in the same phase does not ready him again; it works again next round", () => {
    const base = heroGame();
    const cable = identityOf(base, P1);
    const first = patchInstance(base, purgeOf(base), { threat: 2 });
    const one = offeredResponse(first, thwart(P1, cable, purgeOf(first)));
    expect(one.offered).toBe(true);
    expect(inst(one.state, cable).exhausted).toBe(false);
    // Thwart again (exhausting him) and defeat the second scheme: the limit is spent.
    const { state: withScheme, id: scheme } = encounterCardInVillainArea(one.state, BREAKIN, 2);
    const two = offeredResponse(withScheme, thwart(P1, cable, scheme));
    expect(two.offered).toBe(false);
    expect(inst(two.state, cable).exhausted).toBe(true);
    // Next round, a new player phase.
    let next = settle(
      driveEventsPicking(WAVE7_DEPS, two.state, firstLegal, endTurn(P1)).state,
      firstLegal,
      (s) => s.step.phase === "player" && s.round > two.state.round,
      WAVE7_DEPS,
    );
    next = patchInstance(next, identityOf(next, P1), { exhausted: false });
    const { state: another, id: scheme2 } = encounterCardInVillainArea(next, BREAKIN, 2);
    const three = offeredResponse(another, thwart(P1, identityOf(another, P1), scheme2));
    expect(three.offered).toBe(true);
    expect(inst(three.state, identityOf(three.state, P1)).exhausted).toBe(false);
  });

  it("two players: another hero defeating the scheme does not ready Cable", () => {
    const base = heroGame([CABLE, SPIDER_MAN]);
    const cable = identityOf(base, P1);
    const spider = identityOf(base, P2);
    const hero = withForm(patchInstance(base, cable, { exhausted: true }), { heroForm: 0 }, P2);
    const staged = patchInstance(hero, purgeOf(hero), { threat: 1 });
    const turned = driveEventsPicking(WAVE7_DEPS, staged, firstLegal, endTurn(P1)).state;
    const { state, offered } = offeredResponse(turned, thwart(P2, spider, purgeOf(turned)));
    expect(offered).toBe(false);
    expect(inst(state, cable).exhausted).toBe(true);
  });
});
