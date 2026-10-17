/**
 * Rules audit chunk 14 (Glossary: RESTRICTED ... STANDARD SET), engine proofs. Each `it.fails` marks a place the engine
 * does something the RRG 1.8 forbids, and flips to a failure when it is fixed.
 *
 * Reveal / Quickstrike: RRG 1.8 "Quickstrike" (p. 36): "If a minion with the quickstrike keyword is being revealed, the
 * quickstrike keyword resolves after any 'When Revealed' abilities on that minion are resolved." "Reveal" (p. 38) step 3
 * resolves each When Revealed ability. The engine follows FFG's ruling of February 28, 2026 (4) answer 2 instead
 * (quickstrike first), which predates RRG 1.8 (July 2026); under the project's order of authority the RRG decides.
 */
import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "../abilities.js";
import type { GameEvent } from "../events.js";
import { playerId } from "../ids.js";
import { activeEncounterDeck } from "../query.js";
import type { InstanceId } from "../ids.js";
import type { EffectSpec } from "../spec.js";
import { depsOf, stubAbility } from "../testing/abilities.js";
import { runCommands } from "../testing/drive.js";
import { stubMainScheme, stubMinion, stubTreachery, stubVillain } from "../testing/fixtures.js";
import { newGame, withEncounterPiles } from "../testing/scenario.js";

const p1 = playerId("p1");
const mark: EffectSpec = {
  kind: "addCounters",
  target: { kind: "each", query: { categories: ["mainScheme"] } },
  counterType: "revealed",
  amount: { kind: "const", value: 1 },
};
const revealedAbility = stubAbility("sentry.when-revealed", { trigger: { kind: "whenRevealed" }, effects: [mark] });
const SENTRY = stubMinion({
  id: "sentry",
  atk: 1,
  sch: 0,
  hp: 5,
  boostIcons: 0,
  keywords: [{ name: "quickstrike" }],
  abilities: [revealedAbility.ref],
});
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const VILLAIN = stubVillain({ id: "boss", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });
const SCHEME = stubMainScheme({
  id: "calm",
  stages: [{ startingThreat: flat(0), targetThreat: flat(50), acceleration: flat(0) }],
});
const deps: EngineDeps = depsOf(revealedAbility);

describe("Quickstrike on a revealed minion (RRG 1.8 p. 36)", () => {
  it("the minion's When Revealed resolves before its quickstrike attack is initiated", () => {
    const start = newGame({
      players: 1,
      villain: VILLAIN,
      mainScheme: SCHEME,
      deps,
      extraCards: [SENTRY, BLANK],
      encounterDeck: [SENTRY.id, ...Array.from({ length: 15 }, () => BLANK.id)],
    });
    // The sentry second from the top, under the villain's boost card, so the first villain phase reveals it.
    const deck = activeEncounterDeck(start).deck;
    const sentry = deck.find((id) => start.instances[id]?.cardId === SENTRY.id) as InstanceId;
    const [boost, ...rest] = deck.filter((id) => id !== sentry);
    const staged = withEncounterPiles(start, { deck: [boost as InstanceId, sentry, ...rest] });
    const hero = runCommands(staged, deps, { type: "changeForm", playerId: p1 }).state;
    const { events } = runCommands(hero, deps, { type: "endTurn", playerId: p1 });
    const attack = events.findIndex(
      (e: GameEvent) =>
        e.type === "triggerEvent" &&
        e.phase === "initiated" &&
        e.event.kind === "enemyAttack" &&
        hero.instances[e.event.enemyInstanceId]?.cardId === SENTRY.id,
    );
    const revealed = events.findIndex((e) => e.type === "counterAdded" && e.counterType === "revealed");
    expect(attack).toBeGreaterThanOrEqual(0);
    expect(revealed).toBeGreaterThanOrEqual(0);
    expect(revealed).toBeLessThan(attack);
  });
});
