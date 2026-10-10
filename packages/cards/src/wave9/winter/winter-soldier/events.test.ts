import { WINTER_CARDS, cardId, type EventCard } from "@mc/content";
import { legalActions, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  firstLegal,
  inst,
  moveToHand,
  patchInstance,
  play,
  playerOf,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking } from "../../../testing/staging.js";
import { WS_DEPS, engageMinion, wsGame, wsHeroGame } from "../testing.js";
import { WINTER_SOLDIER_EVENTS, WINTER_SOLDIER_EVENTS_SKIPPED } from "./events.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Winter Soldier's events (54004 to 54006), docs/phase7-wave9.md section 8.4. Electrical Discharge is scripted and
 * tested clause by clause; Arm Block and Metal Punch are skipped (their "if you exhausted Cybernetic Arm to pay"
 * rider has no engine predicate), so the skip reasons are asserted and the riders are `it.todo`.
 *
 * Payment cards are Core resources: Energy 01088 ([energy]), Genius 01089 ([mental]), Strength 01090 ([physical]).
 * Rhino (stage I) has 14 hit points; Hydra Mercenary 01101 (guard) 3; Shocker 01103 3.
 */
const DISCHARGE = "54006.electrical-discharge-action";
const ARM_BLOCK = "54004.arm-block-constant";
const METAL_PUNCH = "54005.metal-punch-action";
const ENERGY = "01088";
const GENIUS = "01089";
const STRENGTH = "01090";
const MERCENARY = "01101";
const SHOCKER = "01103";

const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const stunnedOf = (s: GameState, id: InstanceId): number => inst(s, id).statuses.stunned;
const inPlay = (s: GameState, id: string): boolean => playerOf(s, P1).playArea.includes(id as InstanceId);
const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const discardCodes = (s: GameState): string[] => playerOf(s, P1).discard.map((id) => codeOf(s, id));

/**
 * Plays Electrical Discharge paid with exactly the cards `payers` (card codes): the first hand cards are turned into
 * those cards by test surgery (the printed deck holds no resource cards), the event is moved into hand.
 */
function discharge(state: GameState, payers: readonly string[], pick: Picker = firstLegal) {
  const event = moveToHand(state, P1, "54006");
  const hand = playerOf(event.state, P1).hand.filter((id) => id !== event.ids[0]);
  const paying = hand.slice(0, payers.length);
  const s = paying.reduce((acc, id, n) => patchInstance(acc, id, { cardId: cardId(payers[n]!) }), event.state);
  return driveEventsPicking(WS_DEPS, s, pick, play(P1, event.ids[0]!, paying));
}

const offered = (s: GameState, id: InstanceId): boolean => {
  const legal = legalActions(s, P1, WS_DEPS);
  if (legal.kind !== "turn") throw new Error(legal.kind);
  return legal.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === id);
};

/** Answers a target prompt with `target` when offered. */
const targeting =
  (target: string): Picker =>
  (s) => {
    const hit = s.pendingChoice!.options.find((o) => o.optionId === target);
    return hit ? [hit.optionId] : firstLegal(s);
  };

const card = (code: string) => WINTER_CARDS.find((c) => c.id === cardId(code)) as EventCard;

describe("Winter Soldier events registry", () => {
  it("Electrical Discharge validates as a Hero Action labeled (attack); the other two are skipped with written reasons", () => {
    expect(Object.keys(WINTER_SOLDIER_EVENTS)).toEqual([DISCHARGE]);
    expect(validateDefinition(WINTER_SOLDIER_EVENTS[DISCHARGE]!)).toEqual([]);
    expect(WINTER_SOLDIER_EVENTS[DISCHARGE]!.trigger).toMatchObject({ kind: "action", form: "hero" });
    expect(WINTER_SOLDIER_EVENTS[DISCHARGE]!.label).toEqual(["attack"]);
    expect(Object.keys(WINTER_SOLDIER_EVENTS_SKIPPED).sort()).toEqual([ARM_BLOCK, METAL_PUNCH]);
    for (const reason of Object.values(WINTER_SOLDIER_EVENTS_SKIPPED)) expect(reason).toContain("Cybernetic Arm");
  });
  it("the printed data names exactly these refs, with costs 1, 3 and 2", () => {
    for (const [code, ref, cost] of [
      ["54004", ARM_BLOCK, 1],
      ["54005", METAL_PUNCH, 3],
      ["54006", DISCHARGE, 2],
    ] as const) {
      expect(card(code).abilities.map((a) => a.id as string)).toEqual([ref]);
      expect(card(code).cost).toBe(cost);
    }
    expect(card("54006").traits.map(String)).toContain("ATTACK");
  });
});

describe(`${DISCHARGE} (Electrical Discharge 54006): 4 damage to an enemy; paid with [energy], stun it`, () => {
  it("costs 2: two cards are discarded to pay, the event goes to the discard pile", () => {
    const { state } = discharge(wsHeroGame(), [GENIUS, STRENGTH]);
    expect(discardCodes(state)).toEqual(expect.arrayContaining(["54006", GENIUS, STRENGTH]));
    expect(discardCodes(state)).toHaveLength(3);
  });
  it("paid with two [energy] resources: Rhino takes exactly 4 and is stunned", () => {
    const s = wsHeroGame();
    const { state, events } = discharge(s, [ENERGY, ENERGY]);
    expect(inst(state, villainOf(state)).damage).toBe(4);
    expect(stunnedOf(state, villainOf(state))).toBe(1);
    const attacks = events.filter(
      (e) => e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "attack",
    );
    expect(attacks).toMatchObject([{ event: { amount: 4, basic: false } }]);
  });
  it("paid with one [energy] and one [mental]: one [energy] is enough to stun", () => {
    const { state } = discharge(wsHeroGame(), [ENERGY, GENIUS]);
    expect(inst(state, villainOf(state)).damage).toBe(4);
    expect(stunnedOf(state, villainOf(state))).toBe(1);
  });
  it("paid with [mental] and [physical] only: 4 damage and no stun", () => {
    const { state } = discharge(wsHeroGame(), [GENIUS, STRENGTH]);
    expect(inst(state, villainOf(state)).damage).toBe(4);
    expect(stunnedOf(state, villainOf(state))).toBe(0);
  });
  it("a wild resource counts as [energy]: The Power of Aggression 01055 ([wild]) plus [mental] stuns", () => {
    const { state } = discharge(wsHeroGame(), ["01055", GENIUS]);
    expect(inst(state, villainOf(state)).damage).toBe(4);
    expect(stunnedOf(state, villainOf(state))).toBe(1);
  });
  it("a minion chosen as the target: Shocker (3 hit points) is defeated, and Rhino is untouched and not stunned", () => {
    const s = engageMinion(wsHeroGame(), SHOCKER, "shocker");
    const { state } = discharge(s, [ENERGY, ENERGY], targeting("shocker"));
    expect(inPlay(state, "shocker")).toBe(false);
    expect(inst(state, villainOf(state)).damage).toBe(0);
    expect(stunnedOf(state, villainOf(state))).toBe(0);
  });
  it("defeating a minion: no overkill, so the 1 excess damage is not dealt to anything else", () => {
    const s = engageMinion(wsHeroGame(), MERCENARY, "merc");
    const { state } = discharge(s, [ENERGY, ENERGY], targeting("merc"));
    expect(inPlay(state, "merc")).toBe(false);
    expect(inst(state, villainOf(state)).damage).toBe(0);
    expect(playerOf(state, P1).discard.length).toBe(3);
  });
  it("guard: with Hydra Mercenary engaged only it can be chosen, and Rhino takes nothing and is not stunned", () => {
    const s = engageMinion(wsHeroGame(), MERCENARY, "merc");
    const seen: string[][] = [];
    const { state } = discharge(s, [ENERGY, ENERGY], (st) => {
      seen.push(st.pendingChoice!.options.map((o) => o.label));
      return firstLegal(st);
    });
    expect(seen[0]).toEqual(["Hydra Mercenary"]);
    expect(inPlay(state, "merc")).toBe(false);
    expect(inst(state, villainOf(state)).damage).toBe(0);
    expect(stunnedOf(state, villainOf(state))).toBe(0);
  });
  it("is a Hero Action: not offered in alter-ego form, offered in hero form", () => {
    const alterEgo = moveToHand(wsGame(), P1, "54006");
    expect(offered(alterEgo.state, alterEgo.ids[0]!)).toBe(false);
    const hero = moveToHand(wsHeroGame(), P1, "54006");
    expect(offered(hero.state, hero.ids[0]!)).toBe(true);
  });
});

describe("Arm Block 54004 and Metal Punch 54005 (skipped: no engine record of what produced a paid resource)", () => {
  it.todo(
    "Arm Block: when an enemy attacks, deal 3 damage to it (Hydra Mercenary 3 hit points is defeated, Rhino takes 3)",
  );
  it.todo("Arm Block paid by exhausting Cybernetic Arm: all damage from that attack is prevented, damage still dealt");
  it.todo("Arm Block paid without the Arm: the attacking enemy takes 3 and the attack still hits");
  it.todo(
    "Arm Block against Black Widow's forced interrupt with A.I.M. Grunt discarded (ruling January 17, 2026 - Ruling 2)",
  );
  it.todo("Metal Punch costs 3, deals exactly 7 damage to an enemy; with the Arm exhausted the attack gains overkill");
});
