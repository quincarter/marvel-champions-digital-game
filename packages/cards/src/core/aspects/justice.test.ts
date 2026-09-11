import { coreScenario } from "../setup.js";
import {
  answer,
  endTurn,
  firstLegal,
  inst,
  mainThreat,
  moveToHand,
  P1,
  payWith,
  play,
  playerOf,
  run,
  settle,
  stackEncounterDeck,
  startCoreGame,
  toHero,
} from "../../testing/harness.js";

const spiderManVsRhino = () => startCoreGame(coreScenario("rhino", { players: [{ starterDeckId: "core-spider-man-justice" }], seed: 11 }));

describe("Justice", () => {
  it("Interrogation Room: after you defeat a minion, exhaust it → remove 1 threat from a scheme", () => {
    const round2 = settle(run(stackEncounterDeck(spiderManVsRhino(), "01186", "01101"), endTurn()));
    const mercenary = playerOf(round2, P1).playArea.find((id) => inst(round2, id).cardId === "01101");
    expect(mercenary).toBeDefined();
    const given = moveToHand(round2, P1, "01063", "01005"); // Interrogation Room, Swinging Web Kick
    const [room, kick] = given.ids as [never, never];
    const withRoom = run(given.state, toHero(), play(P1, room, payWith(given.state, P1, 1, given.ids)));
    const before = mainThreat(withRoom);
    const targeting = run(withRoom, play(P1, kick, payWith(withRoom, P1, 3, [kick])));
    // Guard: the Hydra Mercenary is the only enemy Spider-Man may attack.
    expect(targeting.pendingChoice?.options.map((o) => o.optionId)).toEqual([mercenary]);
    const roomOption = `${room}:01063.interrogation-room-response`;
    const offered = settle(answer(targeting, [mercenary as string]), firstLegal, (s) => s.pendingChoice?.options.some((o) => o.optionId === roomOption) ?? false);
    const after = settle(answer(offered, [roomOption]));
    expect(after.encounterDiscard).toContain(mercenary);
    expect(inst(after, room).exhausted).toBe(true);
    expect(mainThreat(after)).toBe(before - 1);
  });
});
