/**
 * Forced Actions, the Crown's each-player cost and Seduced's attack refusal on the board's view models, from a real
 * Enchantress game (`store/dev-enchantress-game.ts`): round 3 with a Kiss of Temptation owed and the Crown on
 * Enchantress, then round 4 with Seduced on the hero.
 */
import { abilityId } from "@mc/content";
import { legalActions, type GameEvent, type GameState, type InstanceId, type LegalAction } from "@mc/engine";
import { describe, expect, test } from "vitest";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { CROWN, KISS, SEDUCED, startEnchantressGame } from "../store/dev-enchantress-game.js";
import { nextTurn } from "../store/dev-game-steps.js";
import { SessionStore } from "../store/session-store.js";
import { abilityLabelOf } from "./ability-label.js";
import { attackBarName, attackRefusalWording } from "./attack-bar.js";
import { characterPanel } from "./board-model.js";
import { promptTitleOf, FORCED_ACTION_TITLE } from "./choice-source.js";
import { describeCost } from "./cost-choice-model.js";
import { FORCED_ACTION_CODE, isForcedAbility, owedForcedActions, withForcedActions } from "./forced-actions.js";
import { highlights } from "./highlights.js";
import { inspectModel } from "./inspect-model.js";
import { logLine } from "./log-lines.js";

const code = (game: GameState, id: InstanceId): string => game.instances[id]!.cardId as string;
const onIdentity = (game: GameState, cardCode: string): InstanceId =>
  game.instances[game.players[0]!.identity.instanceId]!.attachments.find((id) => code(game, id) === cardCode)!;

async function opened() {
  const store = new SessionStore(new LocalEngineHost());
  await startEnchantressGame(store);
  return store;
}
const turnOf = (store: SessionStore) => {
  const actions = store.state.legal!.actions;
  if (actions.kind !== "turn") throw new Error(actions.kind);
  return actions;
};
/** The legal entry that uses a Forced Action (the Crown's Hero Action is a legal ability too). */
const forcedEntry = (store: SessionStore): LegalAction | undefined =>
  turnOf(store).legal.find((e) => e.action.kind === "useAbility" && isForcedAbility(POOL_DEPS, e.action.abilityId));
const lines = (events: readonly GameEvent[], game: GameState) =>
  events.flatMap((event) => {
    const beat = logLine(event, game, game.players[0]!.playerId, POOL_DEPS);
    return beat ? [beat.text] : [];
  });

describe("a Forced Action owed on the board", () => {
  test("the card is marked, End Turn is refused with a reason naming it, and Inspect says it must be used", async () => {
    const store = await opened();
    const game = store.state.game!;
    const actions = turnOf(store);
    const kiss = onIdentity(game, KISS);
    const owed = owedForcedActions(actions, POOL_DEPS);
    expect(owed.map((o) => o.instanceId)).toEqual([kiss]);
    expect(isForcedAbility(POOL_DEPS, owed[0]!.abilityId)).toBe(true);

    const marks = withForcedActions(highlights(actions), actions, game, POOL_DEPS);
    expect(marks.owed?.has(kiss)).toBe(true);
    const end = marks.basics.find((b) => b.action === "endTurn")!;
    expect(end.enabled).toBe(false);
    expect(end.code).toBe(FORCED_ACTION_CODE);
    expect(end.reason).toBe("Use first: Kiss of Temptation");

    const model = inspectModel(game, kiss, actions, game.players[0]!.playerId, POOL_DEPS);
    expect(model.forcedNote).toMatch(/must use it before your turn ends/);
    expect(model.abilities.length).toBeGreaterThan(0);
  }, 120_000);

  test("once it is used nothing is owed and End Turn is open", async () => {
    const store = await opened();
    const use = forcedEntry(store) as LegalAction;
    const events: GameEvent[] = [];
    store.subscribe((s) => events.push(...s.lastEvents));
    await store.dispatch(use.example);
    await nextTurn(store);
    const game = store.state.game!;
    const actions = turnOf(store);
    expect(owedForcedActions(actions, POOL_DEPS)).toEqual([]);
    const marks = withForcedActions(highlights(actions), actions, game, POOL_DEPS);
    expect(marks.basics.find((b) => b.action === "endTurn")!.enabled).toBe(true);
    expect(lines(events, game).some((text) => /Kiss of Temptation: Forced Action used/.test(text))).toBe(true);
    const kiss = onIdentity(game, KISS);
    expect(inspectModel(game, kiss, actions, game.players[0]!.playerId, POOL_DEPS).forcedNote).toMatch(
      /if you are able/,
    );
  }, 120_000);

  test("the log tells owed Forced Actions, a counter limit and hidden reverses in the board's voice", async () => {
    const store = await opened();
    const game = store.state.game!;
    const me = game.players[0]!.playerId;
    const kiss = onIdentity(game, KISS);
    const abilityIdOf = forcedEntry(store)!.action;
    if (abilityIdOf.kind !== "useAbility") throw new Error("no ability");
    const owed = logLine(
      {
        type: "forcedActionsRequired",
        actions: [{ playerId: me, instanceId: kiss, abilityId: abilityIdOf.abilityId }],
      },
      game,
      me,
      POOL_DEPS,
    );
    expect(owed?.text).toBe("Forced Action owed, you: Kiss of Temptation. Use it to end the phase.");
    const limit = logLine(
      { type: "countersNotPlaced", instanceId: kiss, counterType: "synergy", amount: 2, reason: "limit" },
      game,
      me,
      POOL_DEPS,
    );
    expect(limit?.text).toBe("2 synergy counters not placed on Kiss of Temptation (its limit).");
  }, 120_000);

  test("the end-of-phase prompt reads as 'you must use one'", () => {
    expect(promptTitleOf({ kind: "chooseOption", forcedAction: true }, POOL_DEPS, undefined)).toBe(FORCED_ACTION_TITLE);
    expect(promptTitleOf({ kind: "chooseOption" }, POOL_DEPS, undefined)).toBe("Choose one");
  });
});

describe("the Crown's each-player cost and Seduced's refusal", () => {
  test("the Crown's Hero Action says what each player pays", async () => {
    const store = await opened();
    const game = store.state.game!;
    const villain = game.villains[0]!.instanceId;
    const crown = game.instances[villain]!.attachments.find((id) => code(game, id) === CROWN)!;
    const id = abilityId("55016.crown-of-the-enchantress-action");
    expect(abilityLabelOf(game, crown, id, POOL_DEPS)).toBe(
      "Crown of the Enchantress — each player exhausts, takes 1 damage",
    );
    expect(describeCost(POOL_DEPS.abilities[id]!.cost!)).toBe("each player exhausts, takes 1 damage");
    expect(characterPanel(game, villain, POOL_DEPS).attachments.some((a) => a.instanceId === crown)).toBe(true);
  }, 120_000);

  test("Seduced bars basic attacks and the refusal names it through the engine", async () => {
    const store = await opened();
    // Round 3 to round 4: use the Kiss, end the turn; Seduced is revealed in the villain phase.
    let seduced: InstanceId | undefined;
    for (let guard = 0; guard < 12 && !seduced; guard++) {
      const turn = await nextTurn(store);
      if (!turn) break;
      const use = turn.legal.find(
        (e) => e.action.kind === "useAbility" && isForcedAbility(POOL_DEPS, e.action.abilityId),
      );
      const end = turn.legal.find((e) => e.action.kind === "endTurn");
      await store.dispatch((use ?? end)!.example);
      const game = store.state.game!;
      seduced = game.instances[game.players[0]!.identity.instanceId]!.attachments.find(
        (id) => code(game, id) === SEDUCED,
      );
    }
    expect(seduced, "Seduced reached the hero").toBeDefined();
    const turn = await nextTurn(store);
    const game = store.state.game!;
    const hero = game.players[0]!.identity.instanceId;
    expect(attackBarName(game, hero, POOL_DEPS)).toBe("Seduced");
    const refused = legalActions(game, game.players[0]!.playerId, POOL_DEPS);
    if (refused.kind !== "turn") throw new Error(refused.kind);
    const attack = refused.illegal.find((e) => e.action.kind === "basicAttack");
    expect(attack?.message).toBe("Seduced: you cannot make basic attacks");
    expect(attackRefusalWording(game, POOL_DEPS, hero, attack!.message)).toBe("Seduced: you cannot make basic attacks");
    expect(turn).not.toBeNull();
  }, 180_000);
});
