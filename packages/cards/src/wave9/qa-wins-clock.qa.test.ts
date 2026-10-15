/**
 * Rules QA, "can each wave 9 scenario be won": the printed clock of each scenario's main scheme, read off the card
 * scans
 * (assets/card-art/bundles/cards/<id>.png, checked 2026-10-11) and compared with what the engine puts on the table for
 * one
 * to four players. A clock that ran harsher than printed would show here first: a per-player value applied twice, an
 * acceleration counted wrong, or a value read from the wrong side.
 *
 * Printed (starting threat / target threat / escalation, all per hero unless noted; the escalation is the "+N" on the
 * scheme's lower right, placed in step 1 of the villain phase, RRG 1.8 "Main Scheme" p. 27):
 * - Black Widow, The Widow's Web 50067b: 2 / 10 / +X, "X is Black Widow's stage number" (stage I: +1).
 * - Batroc, Infiltrate A.I.M. Island Embassy 50087b: 6 / 12 / +1.
 * - M.O.D.O.K., Upgrading Adaptoids 50104b: 1 / 7 / +1.
 * - Thunderbolts, Apprehending Rogue Agents 50130b: 1 / 11 / +1.
 * - Baron Zemo, Zemo's Manipulations 50167b: 2 / 12 / +2.
 * - God of Lies, Mischief and Mayhem 55033b: 0 / 8 / +1 per hero; Worlds Collide 55028b: target 2 per group (MC55 p.
 * 21).
 */
import { cardOf, cardsInPlay, createGame, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { DEPS, SEATS, idleRounds, openScenario, targetThreatOf } from "./qa-gaps.shared.js";
import { wave9Scenario } from "./setup.js";

vi.setConfig({ testTimeout: 300_000 });

const PRINTED: readonly (readonly [scenario: string, start: number, target: number, escalation: number])[] = [
  ["black-widow", 2, 10, 1],
  ["batroc", 6, 12, 1],
  ["modok", 1, 7, 1],
  ["thunderbolts", 1, 11, 1],
  ["baron-zemo", 2, 12, 2],
  ["god-of-lies", 0, 8, 1],
];

/** Acceleration icons printed on the cards in play: a minion's `schemeIcons`, a side scheme's `icons` (RRG 1.8 p. 3). */
const accelerationIconsInPlay = (s: ReturnType<typeof openScenario>): number =>
  cardsInPlay(s).filter((id) => {
    const card = cardOf(s, id) as { schemeIcons?: readonly string[]; icons?: readonly string[] } | undefined;
    return (card?.schemeIcons ?? card?.icons ?? []).includes("acceleration");
  }).length;

describe("the printed clock of each main scheme, one to four players", () => {
  for (const [scenario, start, target, escalation] of PRINTED)
    for (const n of [1, 2, 3, 4])
      it(`${scenario}, ${n} player(s): ${start * n} threat of ${target * n}, then +${escalation * n} (and +1 per acceleration icon in play) in the first villain phase`, () => {
        // The starting threat is the first threat placed on the main scheme, before the scenario's own Setup resolves
        // (M.O.D.O.K.'s four Adaptoids add theirs during setup, which no player card ability interrupts: RRG 1.8 p. 4).
        const created = createGame(wave9Scenario(scenario, { players: SEATS.slice(0, n), seed: 1 }), DEPS);
        if (!created.ok) throw new Error(created.error.message);
        const startingPlacement = created.events.find(
          (e) => e.type === "threatPlaced" && e.schemeInstanceId === created.state.mainScheme.instanceId,
        );
        expect(startingPlacement?.type === "threatPlaced" ? startingPlacement.amount : 0, "starting threat").toBe(
          start * n,
        );
        const initial = openScenario(scenario, n);
        const main: InstanceId = initial.mainScheme.instanceId;
        expect(targetThreatOf(initial), "target threat").toBe(target * n);
        const played = idleRounds(initial, 2);
        const placed = played.events.find((e) => e.type === "threatPlaced" && e.schemeInstanceId === main);
        expect(
          placed,
          "the first threat of the villain phase is the escalation, placed before any activation",
        ).toMatchObject({
          type: "threatPlaced",
          amount: escalation * n + accelerationIconsInPlay(initial),
        });
      });
});
