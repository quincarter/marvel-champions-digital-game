import { AOA_CARDS } from "@mc/content";
import { activeVillain, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  mainThreat,
  P1,
  patchInstance,
  playerOf,
  putOnTopOfDeck,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking } from "../../../testing/staging.js";
import { AOA_BASIC_CAMPAIGN, AOA_BASIC_CAMPAIGN_SKIPPED } from "./aoa-basic-campaign.js";
import { CAMPAIGN_DEPS, campaignGame } from "./testing.js";

const DESTINY = "45172";
const BLINK = "45173";
const MORPH = "45174";
const XMAN = "45175";
const CODES = ["45171a", DESTINY, BLINK, MORPH, XMAN, "45176"];
const REGISTERED = ["45172.destiny-response", "45173.blink-response", "45174.morph-response", "45175.x-man-response"];
const refs = AOA_CARDS.filter((c) => CODES.includes(c.id as string)).flatMap((c) => abilityRefIds(c));

/** Accepts an optional response (the first offered option that is not the pass) when one is offered. */
const accept: Picker = (state) => {
  const choice = state.pendingChoice;
  if (choice?.prompt.kind === "chooseTriggers") return [choice.options[0]!.optionId];
  return firstLegal(state);
};
const decline: Picker = (state) => {
  const choice = state.pendingChoice;
  if (choice?.prompt.kind === "chooseTriggers") return [];
  return firstLegal(state);
};

/** The ally drawn at the end of the player phase: hand emptied, the ally on top of the deck, then the turn ends. */
function drawn(code: string, pick: Picker, setup: (s: GameState) => GameState = (s) => s) {
  let game = campaignGame({ deck: [code] });
  const owner = playerOf(game, P1);
  game = {
    ...game,
    players: game.players.map((p) =>
      p.playerId === P1 ? { ...p, hand: [], discard: [...p.discard, ...owner.hand] } : p,
    ),
  };
  const staged = putOnTopOfDeck(setup(game), P1, code);
  const run = driveEventsPicking(CAMPAIGN_DEPS, staged.state, pick, endTurn(P1));
  return { ...run, ally: staged.ids[0]!, before: staged.state };
}
const resolved = (events: readonly GameEvent[], ref: string) =>
  events.filter((e) => e.type === "abilityResolved" && e.abilityId === ref).length;
const villainOf = (s: GameState): InstanceId => activeVillain(s)!.instanceId;

describe("registry", () => {
  it("registers the four allies' responses as valid definitions; Mission Team and Desperate Measures are skipped", () => {
    expect(Object.keys(AOA_BASIC_CAMPAIGN).sort()).toEqual([...REGISTERED].sort());
    for (const [id, def] of Object.entries(AOA_BASIC_CAMPAIGN)) expect(validateDefinition(def), id).toEqual([]);
    expect([...Object.keys(AOA_BASIC_CAMPAIGN), ...Object.keys(AOA_BASIC_CAMPAIGN_SKIPPED)].sort()).toEqual(
      [...refs].sort(),
    );
    expect(Object.keys(AOA_BASIC_CAMPAIGN_SKIPPED).sort()).toEqual([
      "45171a.mission-team-action",
      "45171a.mission-team-constant",
      "45171b.mission-team-action",
      "45171b.mission-team-constant",
      "45176.desperate-measures-constant",
    ]);
    for (const [id, reason] of Object.entries(AOA_BASIC_CAMPAIGN_SKIPPED)) expect(reason, id).toMatch(/task/);
  });
});

describe("the campaign allies' Responses when they enter a hand (45172 to 45175)", () => {
  it("Destiny: accepted, removes 2 threat from the main scheme", () => {
    const run = drawn(DESTINY, accept, (s) => patchInstance(s, s.mainScheme.instanceId, { threat: 6 }));
    expect(resolved(run.events, "45172.destiny-response")).toBe(1);
    expect(playerOf(run.state, P1).hand).toContain(run.ally);
    const removed = run.events.filter((e) => e.type === "threatRemoved");
    expect(removed).toHaveLength(1);
    expect(removed[0]).toMatchObject({ schemeInstanceId: run.before.mainScheme.instanceId, amount: 2 });
    expect(mainThreat(run.before)).toBe(6);
  });

  it("Destiny: it is a Response, so declining leaves the threat alone", () => {
    const run = drawn(DESTINY, decline, (s) => patchInstance(s, s.mainScheme.instanceId, { threat: 6 }));
    expect(resolved(run.events, "45172.destiny-response")).toBe(0);
    expect(playerOf(run.state, P1).hand).toContain(run.ally);
  });

  it("Blink: accepted, deals 2 damage to the villain", () => {
    const run = drawn(BLINK, accept);
    expect(resolved(run.events, "45173.blink-response")).toBe(1);
    const dealt = run.events.filter((e) => e.type === "damageDealt" && e.sourceInstanceId === run.ally);
    expect(dealt).toEqual([
      { type: "damageDealt", targetInstanceId: villainOf(run.before), amount: 2, sourceInstanceId: run.ally },
    ]);
  });

  it("Morph: accepted, confuses the villain", () => {
    const run = drawn(MORPH, accept);
    expect(resolved(run.events, "45174.morph-response")).toBe(1);
    expect(run.events.filter((e) => e.type === "statusGiven")).toMatchObject([
      { instanceId: villainOf(run.before), status: "confused" },
    ]);
  });

  it("X-Man: accepted, gives the player's identity a tough status card", () => {
    const run = drawn(XMAN, accept);
    expect(resolved(run.events, "45175.x-man-response")).toBe(1);
    expect(inst(run.state, identityOf(run.state, P1)).statuses.tough).toBe(1);
  });

  it("the ally is not in play: it stays in the hand either way", () => {
    for (const code of [BLINK, MORPH, XMAN]) {
      const run = drawn(code, decline);
      expect(playerOf(run.state, P1).hand, code).toContain(run.ally);
      expect(instancesOf(run.state, code)).toContain(run.ally);
    }
  });
});
