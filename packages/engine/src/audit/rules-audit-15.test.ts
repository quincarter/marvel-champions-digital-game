/**
 * Rules audit chunk 15 (Glossary: STAR ICON ... TEMPORARY). Audit proofs only: each `it.fails` marks a place the engine
 * does something the RRG 1.8 forbids, and flips to a failure when it is fixed.
 *
 * RRG 1.8 "Teamwork (Trait)" (p. 43): "If a minion with the teamwork keyword is being revealed, the teamwork keyword
 * resolves after any 'When Revealed' abilities on that minion are resolved." The engine resolves it first
 * (`resolve/reveal.ts` stage `quickstrike`, `teamworkFrame`), by the project owner's own ruling recorded in
 * docs/phase7-wave6.md section 4.1 Q2 and pinned by `teamwork.test.ts` > "resolves before the minion's When Revealed".
 * That ruling copies ruling Feb 28, 2026 (4) answer 2 (quickstrike), which is older than RRG 1.8 (July 2026); no FFG
 * ruling covers teamwork. Same shape as the chunk 13 Quickstrike finding (`rules-audit-13.test.ts`).
 */
import { flat, trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "../abilities.js";
import type { Command } from "../commands.js";
import { playerId, type InstanceId } from "../ids.js";
import { activeEncounterDeck, mustInstance } from "../query.js";
import type { GameState } from "../state.js";
import { depsOf, stubAbility } from "../testing/abilities.js";
import { runCommands } from "../testing/drive.js";
import { stubMainScheme, stubMinion, stubTreachery, stubVillain } from "../testing/fixtures.js";
import { newGame, withEncounterPiles } from "../testing/scenario.js";

const p1 = playerId("p1");
const ACOLYTE = trait("ACOLYTE");
const teamwork = { name: "teamwork", sharedTrait: ACOLYTE } as const;
const WHEN_REVEALED = stubAbility("c15-recruit.when-revealed", {
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
const VILLAIN = stubVillain({ id: "c15-boss", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });
const SCHEME = stubMainScheme({
  id: "c15-calm",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
const BLANK = stubTreachery({ id: "c15-blank", boostIcons: 0 });
const RECRUIT = stubMinion({
  id: "c15-recruit",
  traits: [ACOLYTE],
  atk: 1,
  sch: 1,
  hp: 5,
  boostIcons: 0,
  keywords: [teamwork],
  abilities: [WHEN_REVEALED.ref],
});
const PARTNER = stubMinion({ id: "c15-partner", traits: [ACOLYTE], atk: 0, sch: 0, hp: 5, boostIcons: 0 });
const deps: EngineDeps = depsOf(WHEN_REVEALED);

function game(): GameState {
  const start = newGame({
    players: 1,
    villain: VILLAIN,
    mainScheme: SCHEME,
    deps,
    extraCards: [RECRUIT, PARTNER, BLANK],
    encounterDeck: [RECRUIT.id, PARTNER.id, ...Array.from({ length: 15 }, () => BLANK.id)],
  });
  const deck = activeEncounterDeck(start).deck;
  const pick = (cardId: string) => deck.find((id) => start.instances[id]?.cardId === cardId) as InstanceId;
  const recruit = pick(RECRUIT.id);
  const partner = pick(PARTNER.id);
  const [boost, ...rest] = deck.filter((id) => id !== recruit && id !== partner);
  const surgery = withEncounterPiles(start, { deck: [boost as InstanceId, recruit, ...rest] });
  // The partner is already in play, engaged with p1 (test surgery, as teamwork.test.ts does).
  return {
    ...surgery,
    players: surgery.players.map((p) => (p.playerId === p1 ? { ...p, playArea: [...p.playArea, partner] } : p)),
    instances: {
      ...surgery.instances,
      [partner]: { ...mustInstance(surgery, partner), faceup: true, engagedWith: p1, controllerId: null },
    },
  };
}

describe("RRG 1.8 p. 43 Teamwork on a revealed minion", () => {
  it("resolves after the minion's When Revealed, not before", () => {
    const toHero: Command = { type: "changeForm", playerId: p1 };
    const endTurn: Command = { type: "endTurn", playerId: p1 };
    const hero = runCommands(game(), deps, toHero).state;
    const { events } = runCommands(hero, deps, endTurn);
    const keyword = events.findIndex((e) => e.type === "keywordResolved");
    const revealed = events.findIndex((e) => e.type === "counterAdded" && e.counterType === "revealed");
    expect(keyword).toBeGreaterThanOrEqual(0); // teamwork did fire (control: a partner ACOLYTE is in play)
    expect(revealed).toBeGreaterThanOrEqual(0);
    expect(revealed).toBeLessThan(keyword);
  });
});
