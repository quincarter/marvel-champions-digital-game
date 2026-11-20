/**
 * Discounts whose printed text says "played", not "you play", name no player (#888): the next or first matching card
 * any player plays uses them. Avengers Tower ("the next Avenger ally played this phase"), Sure Gamble, Welcome Aboard,
 * Soup Kitchen, and Steve Rogers' Living Legend ("the first ally played each round": RRG 1.8 FAQ "Steve Rogers (#1B)",
 * p. 59; FAQ 1.2, Caleb: "If you are Captain America when the first ally is played, then nobody gets a discount that
 * round"). Compare Helicarrier's "that player plays", which stays per player.
 */
import { playCostOf, type GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { PLAYABLE_DEPS } from "./playable/index.js";
import { endTurn, moveToHand, P1, P2, payWith, play, playerOf } from "./testing/harness.js";
import { wave1Scenario } from "./wave1/setup.js";
import { runWave1, startWave1Game, WAVE1_DEPS } from "./wave1/testing.js";

describe("#888: a discount for the card 'played' is for any player", () => {
  it.each([
    "03024.avengers-tower-action",
    "21020.avengers-tower-action",
    "16169.sure-gamble-action",
    "20027.welcome-aboard-action",
    "53007.soup-kitchen-action",
  ])("%s waits for any player's play", (id) => {
    const definition = PLAYABLE_DEPS.abilities[id];
    expect(definition).toBeDefined();
    expect(JSON.stringify(definition)).toContain('"kind":"reduceNextCardCost"');
    expect(JSON.stringify(definition)).toContain('"anyPlayer":true');
  });

  it("Living Legend discounts the first ally another player plays that round, and not their second", () => {
    const start = startWave1Game(
      wave1Scenario("rhino", {
        players: [{ starterDeckId: "cap-leadership" }, { starterDeckId: "core-spider-man-justice" }],
        seed: 11,
      }),
    );
    const p2Turn = runWave1(start, endTurn(P1));
    const given = moveToHand(p2Turn, P2, "01002", "01058"); // Black Cat (2), Daredevil (4)
    const [blackCat, daredevil] = given.ids as [never, never];
    expect(playCostOf(given.state, P2, blackCat, WAVE1_DEPS)).toMatchObject({ printed: 2, current: 1 });

    const played = runWave1(given.state, play(P2, blackCat, payWith(given.state, P2, 1, [blackCat, daredevil])));
    expect(playerOf(played, P2).playArea).toContain(blackCat);
    expect(playCostOf(played, P2, daredevil, WAVE1_DEPS)).toMatchObject({ printed: 4, current: 4 });
  });

  it("an ally played by a player eliminated since is still the round's first: Living Legend stays spent", () => {
    const start = startWave1Game(
      wave1Scenario("rhino", {
        players: [{ starterDeckId: "cap-leadership" }, { starterDeckId: "core-spider-man-justice" }],
        seed: 11,
      }),
    );
    const p2Turn = runWave1(start, endTurn(P1));
    const given = moveToHand(p2Turn, P2, "01002"); // Black Cat (2)
    const [blackCat] = given.ids as [never];
    const played = runWave1(given.state, play(P2, blackCat, payWith(given.state, P2, 1, [blackCat])));
    // P2 is then eliminated (RRG 1.8 "Player Elimination", p. 34); their play still counted this round.
    const out = { ...played, players: played.players.map((p) => (p.playerId === P2 ? { ...p, eliminated: true } : p)) };
    const mine = moveToHand(out, P1, "03013"); // Squirrel Girl (2)
    const [squirrelGirl] = mine.ids as [never];
    expect(playCostOf(mine.state, P1, squirrelGirl, WAVE1_DEPS)).toMatchObject({ printed: 2, current: 2 });
  });

  describe("in The Once and Future Kang's split game areas (docs/phase7-wave2.md §3.1)", () => {
    const split = (state: GameState): GameState => ({
      ...state,
      gameAreas: [P1, P2].map((player, n) => ({
        areaId: `area-${n + 1}` as never,
        playerIds: [player],
        mainScheme: null,
        villainIds: [],
        activeVillainId: null,
        sideSchemeIds: [],
        formerSchemeIds: [],
      })),
      nextGameAreaSeq: 3,
    });
    const start = () =>
      runWave1(
        startWave1Game(
          wave1Scenario("rhino", {
            players: [{ starterDeckId: "cap-leadership" }, { starterDeckId: "core-spider-man-justice" }],
            seed: 11,
          }),
        ),
        endTurn(P1),
      );
    const squirrelGirlCost = (state: GameState) => {
      const mine = moveToHand(state, P1, "03013"); // Squirrel Girl (2)
      return playCostOf(mine.state, P1, mine.ids[0]!, WAVE1_DEPS);
    };

    it("an ally played before the split is still the round's first after its player ends up in the other area", () => {
      const given = moveToHand(start(), P2, "01002"); // Black Cat (2)
      const [blackCat] = given.ids as [never];
      const played = runWave1(given.state, play(P2, blackCat, payWith(given.state, P2, 1, [blackCat])));
      expect(squirrelGirlCost(split(played))).toMatchObject({ printed: 2, current: 2 });
    });

    it("an ally played in the other area after the split leaves Steve Rogers' area its first ally", () => {
      const given = moveToHand(split(start()), P2, "01002");
      const [blackCat] = given.ids as [never];
      // Steve Rogers is in the other area, so his Living Legend does not reach this play.
      expect(playCostOf(given.state, P2, blackCat, WAVE1_DEPS)).toMatchObject({ printed: 2, current: 2 });
      const played = runWave1(given.state, play(P2, blackCat, payWith(given.state, P2, 2, [blackCat])));
      expect(playerOf(played, P2).playArea).toContain(blackCat);
      expect(squirrelGirlCost(played)).toMatchObject({ printed: 2, current: 1 });
    });
  });
});
