/**
 * `formChanging`: the interrupt window before an identity changes form. Synthetic supports shaped like "Interrupt: When
 * you change to hero form, …" printed on an alter-ego face (the ability is gated to alter-ego form, so it can only be
 * offered while that face is still the one showing).
 *
 * Sources: RRG 1.8 "Interrupt" (p. 25): an interrupt resolves "immediately before that triggering condition
 * resolves"; "Form, Change Form" (p. 21): once each round, and a change by a card ability does not count against it;
 * "Cost" (p. 14) and "Initiating Abilities" (p. 24, steps 5 to 7): an additional cost is paid before the change. The
 * order built here is cost, interrupt window, the change, then the `formChanged` responses.
 */
import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { Form, GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubSupport } from "./testing/fixtures.js";
import { defaultPick, giveCards, RESOURCE } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const you = { kind: "controller" } as const;
const def = (definition: AbilityDefinition) => definition;
const hitVillain = { kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "const", value: 1 } } as const;

/** "Alter-Ego Interrupt: When you change to hero form, deal 1 damage to the villain. (Limit once per phase.)" */
const HERALD_INTERRUPT = stubAbility(
  "herald.interrupt",
  def({
    trigger: {
      kind: "interrupt",
      forced: false,
      form: "alterEgo",
      on: { on: "formChanging", playerIs: "controller", eventIs: { to: "hero" } },
    },
    limit: { count: 1, period: "phase" },
    effects: [hitVillain],
  }),
);
const HERALD = stubSupport({ id: "herald", cost: 0, abilities: [HERALD_INTERRUPT.ref] });

/** "Hero Response: After you change to hero form, deal 1 damage to the villain." */
const ECHO_RESPONSE = stubAbility(
  "echo.response",
  def({
    trigger: {
      kind: "response",
      forced: false,
      form: "hero",
      on: { on: "formChanged", playerIs: "controller", eventIs: { to: "hero" } },
    },
    effects: [hitVillain],
  }),
);
const ECHO = stubSupport({ id: "echo", cost: 0, abilities: [ECHO_RESPONSE.ref] });

/** "As an additional cost to change form, spend 1 resource." */
const TOLL_COST = stubAbility("toll.constant", {
  trigger: { kind: "constant", rules: [{ kind: "formChangeCost", player: you, cost: { resources: 1 } }] },
  effects: [],
});
const TOLL = stubSupport({ id: "toll", cost: 0, abilities: [TOLL_COST.ref] });

/** "Action: Change form." */
const SWITCH_ACTION = stubAbility("switch.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "changeForm", player: you }],
});
const SWITCH = stubSupport({ id: "switch", cost: 0, abilities: [SWITCH_ACTION.ref] });

const SUPPORTS = [HERALD, ECHO, TOLL, SWITCH];
const deps = depsOf(HERALD_INTERRUPT, ECHO_RESPONSE, TOLL_COST, SWITCH_ACTION);

/** The first turn in alter-ego form with these supports in play. */
function table(...supports: readonly (typeof SUPPORTS)[number][]) {
  let state = gameAtFirstTurn({ cards: SUPPORTS, deps, deck: SUPPORTS.map((card) => card.id) });
  state = { ...state, players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "alterEgo" } })) };
  const ids: Record<string, InstanceId> = {};
  for (const card of supports) {
    const placed = playerCardIntoPlay(state, card.id);
    state = placed.state;
    ids[card.id] = placed.id;
  }
  return { state, ids };
}
const formOf = (state: GameState): Form => mustPlayer(state, P1).identity.form;
const villainDamage = (state: GameState): number => mustInstance(state, state.activeVillainId).damage;

/** Drives the commands, taking every trigger offered (`accept`) and noting the form each trigger prompt was asked in. */
function drive(state: GameState, commands: readonly Command[], accept = true) {
  const asked: { readonly timing: string; readonly form: Form; readonly options: readonly string[] }[] = [];
  const pick = (current: GameState): readonly string[] => {
    const choice = current.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers") {
      const options = choice.options.map((o) => o.optionId);
      asked.push({ timing: choice.prompt.timing, form: formOf(current), options });
      return accept ? options : [];
    }
    if (choice?.prompt.kind === "spendResources") return choice.options.slice(0, 1).map((o) => o.optionId);
    return defaultPick(current);
  };
  const { session, events } = driveSession(startSession(state), deps, commands, pick);
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  return { state: session.state, events, asked };
}
const order = (events: readonly GameEvent[], ...types: readonly GameEvent["type"][]): readonly string[] =>
  events.flatMap((event) => (types.includes(event.type) ? [event.type] : []));
const CHANGE: Command = { type: "changeForm", playerId: P1 };

describe("formChanging: the interrupt window before a change of form", () => {
  it("is offered while the old face still shows, resolves, and then the identity turns", () => {
    const { state, ids } = table(HERALD);
    const run = drive(state, [CHANGE]);
    expect(run.asked).toEqual([{ timing: "interrupt", form: "alterEgo", options: [`${ids.herald}:herald.interrupt`] }]);
    expect(order(run.events, "damageDealt", "formChanged")).toEqual(["damageDealt", "formChanged"]);
    expect(formOf(run.state)).toBe("hero");
    expect(villainDamage(run.state)).toBe(villainDamage(state) + 1);
    // The voluntary change is used once the change has been made.
    expect(mustPlayer(run.state, P1).identity.changedFormThisRound).toBe(true);
  });

  it("declined, the change still happens", () => {
    const { state } = table(HERALD);
    const run = drive(state, [CHANGE], false);
    expect(run.asked).toHaveLength(1);
    expect(formOf(run.state)).toBe("hero");
    expect(villainDamage(run.state)).toBe(villainDamage(state));
  });

  it("the change the other way is not the one it names: no window, the identity turns at once", () => {
    const { state } = table(HERALD);
    const hero: GameState = {
      ...state,
      players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero", heroFormIndex: 0 } })),
    };
    const run = drive(hero, [CHANGE]);
    expect(run.asked).toEqual([]);
    expect(formOf(run.state)).toBe("alterEgo");
  });

  it("with nothing listening no window opens, and a response to the change still answers after it", () => {
    const { state } = table(ECHO);
    const run = drive(state, [CHANGE]);
    expect(run.asked.map((a) => [a.timing, a.form])).toEqual([["response", "hero"]]);
    expect(order(run.events, "damageDealt", "formChanged")).toEqual(["formChanged", "damageDealt"]);
  });

  it("interrupt before the change, response after it", () => {
    const { state } = table(HERALD, ECHO);
    const run = drive(state, [CHANGE]);
    expect(run.asked.map((a) => [a.timing, a.form])).toEqual([
      ["interrupt", "alterEgo"],
      ["response", "hero"],
    ]);
    expect(order(run.events, "damageDealt", "formChanged")).toEqual(["damageDealt", "formChanged", "damageDealt"]);
  });

  it("an additional cost is paid first: cost, then the interrupt, then the change", () => {
    const { state } = table(HERALD, TOLL);
    const dealt = giveCards(state, P1, RESOURCE.id);
    const run = drive(dealt.state, [{ ...CHANGE, payment: [{ fromHand: dealt.ids[0]! }] }]);
    expect(run.asked.map((a) => [a.timing, a.form])).toEqual([["interrupt", "alterEgo"]]);
    const types = run.events.map((event) => event.type);
    const paid = types.indexOf("formChangeCostSettled");
    expect(paid).toBeGreaterThanOrEqual(0);
    expect(paid).toBeLessThan(types.indexOf("damageDealt"));
    expect(types.indexOf("damageDealt")).toBeLessThan(types.indexOf("formChanged"));
    expect(formOf(run.state)).toBe("hero");
  });

  it("a change by a card effect opens the same window, and the limit holds for the phase", () => {
    const { state, ids } = table(HERALD, SWITCH);
    const use: Command = {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: ids.switch!,
      abilityId: SWITCH_ACTION.ref.id,
      payment: [],
    };
    const run = drive(state, [use, use, use]);
    // To hero (offered), back to alter-ego (not named), to hero again (limit once per phase: not offered).
    expect(run.asked.map((a) => [a.timing, a.form])).toEqual([["interrupt", "alterEgo"]]);
    expect(formOf(run.state)).toBe("hero");
    expect(villainDamage(run.state)).toBe(villainDamage(state) + 1);
    // A change by a card ability does not use the round's voluntary change (RRG p. 21).
    expect(mustPlayer(run.state, P1).identity.changedFormThisRound).toBe(false);
  });
});
