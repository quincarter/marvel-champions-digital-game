/**
 * Rules QA, "can each wave 9 scenario be won": God of Lies, Single Group Mode (MC55 pp. 9-10, 18-21; 55027a to
 * 55033b), standard mode, four players.
 *
 * No honest win was found. SEARCH (offline, not re-run here): 88 games at 1 to 4 players (22 each, the same pool,
 * seeds 1 and 2): 0 wins. Every one was lost to Worlds Collide, in rounds 3 to 9; the most damage dealt to an Avatar
 * was 56 of 60 and Loki himself never took any. Every game was played from the printed setup with the natural shuffle
 * by the purposeful player of `qa-wins.shared.ts`.
 *
 * Where the games end, and why (the pinned line: Captain America, Thor, Hulk, Spider-Man, seed 1): the win is Loki,
 * God of Lies defeated (20 per hero = 80, 55027b), and the only damage Loki ever takes is the shatter counters of an
 * Avatar that would be defeated (5 per hero = 20 per Avatar, plus 2 or 3 for each Elite minion or side scheme that
 * places them). The table needs four Avatars down; in three rounds it put 49 of 60 on the first and Loki took none.
 * Meanwhile Worlds Collide (target "2 per group", 55028b scan, so 2 in Single Group Mode, MC55 p. 21) takes one threat
 * for each Mischief and Mayhem completion (55033b) and one for each identity that would be defeated (the identity goes
 * to alter-ego at 1 hit point instead). In round 3 one ability would have defeated all four identities, each adding 1:
 * the target of 2 was passed at the second and the count reached 4 before play stopped (MC55 p. 21: 'each group in
 * the middle of a villain phase must finish any abilities currently resolving, then stop play immediately'). Two
 * incidents in a whole game is the printed budget in Single Group Mode. The card says so; it is flagged in the report
 * as a balance question for the owner, not an engine fault.
 *
 * The line was re-pinned twice as rules changed the game it plays: when a removal of threat stopped being legal with
 * no threat to remove (RRG 1.8 "Target", p. 42), and when Defender of the Nine Realms (in Thor's deck) stopped being
 * playable with no threat on the main scheme (RRG 1.8 "Cost", p. 13). The line before the second change ran six
 * rounds, shattered one Avatar (Loki at 22) and lost to one completion and one defeated identity.
 */
import { replay } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { DEPS } from "./qa-gaps.shared.js";
import { DECKS, ledgerTable, runLine, type Line } from "./qa-wins.shared.js";

vi.setConfig({ testTimeout: 600_000 });

const LINE: Line = {
  scenario: "god-of-lies",
  team: [DECKS.captainAmericaProtection, DECKS.thorJustice, DECKS.hulkJustice, DECKS.spiderManLeadership],
  seed: 1,
  policy: { margin: 4, attack: "smart", thwart: "smart" },
};
let memo: ReturnType<typeof runLine> | undefined;
const played = () => (memo ??= runLine(LINE));

describe("God of Lies, Single Group Mode, four players (Captain America + Thor + Hulk + Spider-Man, seed 1)", () => {
  it("is lost in round 3 when Worlds Collide passes its target of 2 (55028b: 'If this stage is completed, the players lose the game')", () => {
    const run = played();
    expect(run.outcome).toMatchObject({ result: "loss", reason: "cardAbility" });
    expect(run.rounds).toBe(3);
    const shared = run.events.filter((e) => e.type === "sharedStateChanged").at(-1);
    expect(shared).toMatchObject({
      shared: { villainDamage: 0, villainHp: 80, schemeThreat: 4, schemeTarget: 2, status: "lost" },
    });
  });

  it("threat in and out per round: [round, heroes removed, villain phase placed, villain phase removed, damage to the Avatar, damage to the players]", () => {
    expect(ledgerTable(played().ledger)).toEqual([
      [1, 0, 4, 0, 17, 2],
      [2, 3, 5, 0, 15, 9],
      [3, 5, 6, 0, 17, 30],
    ]);
  });

  it("no Avatar shattered: Loki the Miscreant 55030a (60 hit points) is at 49 damage and Loki took none", () => {
    const state = played().session.state;
    expect(state.instances[state.activeVillainId]!.damage).toBe(49);
    const shared = played()
      .events.filter((e) => e.type === "sharedStateChanged")
      .at(-1);
    expect(shared).toMatchObject({ shared: { villainDamage: 0 } });
  });

  it("Worlds Collide takes four threat in round 3: each of the four identities would be defeated by one ability (55033b's Forced Interrupt)", () => {
    let round = 0;
    const incidents: string[] = [];
    for (const e of played().events) {
      if (e.type === "roundStarted") round = e.round;
      if (e.type === "sharedEventEmitted" && e.event.type === "sharedSchemeThreatPlaced")
        incidents.push(`${e.event.cause}@${round}x${e.event.amount}`);
    }
    expect(incidents).toEqual(Array.from({ length: 4 }, () => "identityDefeated@3x1"));
  });

  it("the log replays deep-equal", () => {
    const run = played();
    const replayed = replay(run.session.log, DEPS);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(run.session.state);
  });
});
