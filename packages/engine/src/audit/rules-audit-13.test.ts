/**
 * Rules audit chunk 13 (Glossary: PREVENT ... RESPONSE). Audit proofs only: each `it.fails` marks a place the engine
 * does something the RRG 1.8 forbids, and flips to a failure when it is fixed.
 *
 * RRG 1.8 "Quickstrike" (p. 36): "If a minion with the quickstrike keyword is being revealed, the quickstrike keyword
 * resolves after any 'When Revealed' abilities on that minion are resolved." The engine resolves it first
 * (`resolve/reveal.ts` stage `quickstrike`), following ruling Feb 28, 2026 (4) answer 2, which is older than RRG 1.8
 * (July 2026) and, by the project owner's order of authority, loses to it.
 */
import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "../abilities.js";
import type { Command } from "../commands.js";
import type { GameEvent } from "../events.js";
import { playerId, type InstanceId } from "../ids.js";
import { activeEncounterDeck } from "../query.js";
import type { GameState } from "../state.js";
import { depsOf, stubAbility } from "../testing/abilities.js";
import { runCommands } from "../testing/drive.js";
import { stubMainScheme, stubMinion, stubTreachery, stubVillain } from "../testing/fixtures.js";
import { newGame, withEncounterPiles } from "../testing/scenario.js";

const p1 = playerId("p1");
const WHEN_REVEALED = stubAbility("c13-sentry.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [
    {
      kind: "addCounters",
      target: { kind: "each", query: { categories: ["mainScheme"] } },
      counterType: "revealed",
      amount: { kind: "const", value: 1 },
    },
  ],
});
const VILLAIN = stubVillain({ id: "c13-boss", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });
const SCHEME = stubMainScheme({
  id: "c13-calm",
  stages: [{ startingThreat: flat(0), targetThreat: flat(50), acceleration: flat(0) }],
});
const BLANK = stubTreachery({ id: "c13-blank", boostIcons: 0 });
const SENTRY = stubMinion({
  id: "c13-sentry",
  atk: 1,
  sch: 0,
  hp: 5,
  boostIcons: 0,
  keywords: [{ name: "quickstrike" }],
  abilities: [WHEN_REVEALED.ref],
});
const deps: EngineDeps = depsOf(WHEN_REVEALED);

function game(): GameState {
  const start = newGame({
    players: 1,
    villain: VILLAIN,
    mainScheme: SCHEME,
    deps,
    extraCards: [SENTRY, BLANK],
    encounterDeck: [SENTRY.id, ...Array.from({ length: 15 }, () => BLANK.id)],
  });
  const deck = activeEncounterDeck(start).deck;
  const sentry = deck.find((id) => start.instances[id]?.cardId === SENTRY.id) as InstanceId;
  const [boost, ...rest] = deck.filter((id) => id !== sentry);
  return withEncounterPiles(start, { deck: [boost as InstanceId, sentry, ...rest] });
}

describe("RRG 1.8 p. 36 Quickstrike on a revealed minion", () => {
  it("resolves after the minion's When Revealed, not before", () => {
    const toHero: Command = { type: "changeForm", playerId: p1 };
    const endTurn: Command = { type: "endTurn", playerId: p1 };
    const hero = runCommands(game(), deps, toHero).state;
    const { state, events } = runCommands(hero, deps, endTurn);
    const attackInitiated = events.findIndex(
      (e: GameEvent) =>
        e.type === "triggerEvent" &&
        e.phase === "initiated" &&
        e.event.kind === "enemyAttack" &&
        state.instances[e.event.enemyInstanceId]?.cardId === SENTRY.id,
    );
    const revealed = events.findIndex((e) => e.type === "counterAdded" && e.counterType === "revealed");
    expect(attackInitiated).toBeGreaterThanOrEqual(0);
    expect(revealed).toBeGreaterThanOrEqual(0);
    expect(revealed).toBeLessThan(attackInitiated);
  });
});
