/**
 * docs/phase7-wave8.md §3.64: `EffectSpec basicPowerBy` and `Predicate canUseBasicPower`. "Choose a player → that
 * player makes a basic attack or thwart with a character they control. That character gets +1 THW and +1 ATK for this
 * use." (Cell Phone, `jubilee` 47019.)
 *
 * Sources: RRG 1.8 "Basic Power" (p. 10); "Attack (Player Ability Type)" (p. 10: "A character must exhaust to use
 * this power"); "Thwart" (p. 44); "Guard" (p. 22); "Crisis Icon" (p. 14); "Stun, Stunned" (p. 41); "Cost" (p. 13);
 * "Initiating Abilities" (p. 24).
 *
 * Synthetic cards, two seats. The stub hero has THW 2, ATK 2; the stub ally THW 1, ATK 2, 3 hit points and 1
 * consequential damage for either power. Player 1 is the active player and controls the phone; player 2 controls the
 * ally, so every power player 2 makes here is made outside their own turn.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { characterProfile, mustInstance, mustPlayer } from "./query.js";
import type { PlayerRef, Predicate } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubMinion, stubResource, stubSideScheme, stubSupport } from "./testing/fixtures.js";
import { ALLY, defaultPick, giveCard } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  P1,
  P2,
  playerCardIntoPlay,
} from "./testing/wave3.js";
import { TREACHERY } from "./testing/scenario.js";

const def = (definition: AbilityDefinition) => definition;
const POWERS = ["attack", "thwart"] as const;
const each: PlayerRef = { kind: "each" };
const scoped: PlayerRef = { kind: "scoped" };
const can = (player: PlayerRef): Predicate => ({ kind: "canUseBasicPower", player, powers: POWERS });

/** Cell Phone's text without its uses: offered only while some player can, and only such a player is chosen. */
const CALL = stubAbility(
  "phone.action",
  def({
    trigger: { kind: "action", while: can(each) },
    effects: [
      {
        kind: "choosePlayer",
        slot: "player",
        chooser: { kind: "controller" },
        among: { kind: "where", predicate: can(scoped) },
      },
      {
        kind: "basicPowerBy",
        player: { kind: "slot", slot: "player" },
        powers: POWERS,
        bonus: { thw: 1, atk: 1 },
      },
    ],
  }),
);
/** The bare effect aimed at player 2, with no gate: what the effect does when that player has no legal use. */
const ORDER = stubAbility(
  "order.action",
  def({
    trigger: { kind: "action" },
    effects: [{ kind: "basicPowerBy", player: { kind: "id", playerId: P2 }, powers: POWERS, bonus: { atk: 1 } }],
  }),
);
/** Synch's shape: "When your ally uses a basic attack or thwart, it gets +1 for this use." */
const HEAR = stubAbility(
  "listener.interrupt",
  def({
    trigger: {
      kind: "interrupt",
      forced: true,
      on: {
        on: "basicPowerUsing",
        targetIs: { categories: ["ally"], controller: "you" },
        eventIs: { power: ["thwart", "attack"] },
      },
    },
    effects: [{ kind: "modifyBasicPower", amount: { kind: "const", value: 1 } }],
  }),
);
/** "As an additional cost for this character to make a basic attack, spend 1 resource." */
const TAX = stubAbility(
  "taxed.constant",
  def({
    trigger: { kind: "constant", basicPowerCosts: [{ power: "attack", cost: { resources: 1 } }] },
    effects: [],
  }),
);
/** "As an additional cost to thwart this scheme, you must spend a [energy] resource." */
const TOLL = stubAbility(
  "toll.constant",
  def({
    trigger: {
      kind: "constant",
      rules: [{ kind: "additionalThwartCost", scheme: { self: true }, resources: { energy: 1 } }],
    },
    effects: [],
  }),
);

/** Wasp's shape: "This character may divide her basic attack among any number of enemies." */
const SPLIT = stubAbility(
  "splitter.constant",
  def({
    trigger: { kind: "constant", rules: [{ kind: "divideBasicPower", power: "attack", target: { self: true } }] },
    effects: [],
  }),
);

const PHONE = stubSupport({ id: "phone", cost: 0, abilities: [CALL.ref] });
const SPLITTER = stubAlly({ id: "splitter", cost: 0, atk: 2, thw: 1, hp: 3, abilities: [SPLIT.ref] });
const THUG = stubMinion({ id: "thug", atk: 1, sch: 1, hp: 10 });
const ORDERS = stubSupport({ id: "order", cost: 0, abilities: [ORDER.ref] });
const LISTENER = stubSupport({ id: "listener", cost: 0, abilities: [HEAR.ref] });
const TAXED = stubAlly({ id: "taxed", cost: 0, atk: 2, thw: null, hp: 3, abilities: [TAX.ref] });
const BODYGUARD = stubMinion({ id: "bodyguard", atk: 1, sch: 1, hp: 10, keywords: [{ name: "guard" }] });
const CRISIS = stubSideScheme({ id: "crisis", startingThreat: 3, icons: ["crisis"] });
const TOLLED = stubSideScheme({ id: "tolled", startingThreat: 6, abilities: [TOLL.ref] });
const SPARK = stubResource({ id: "spark", icons: 0, produces: { energy: 1 } });

const deps: EngineDeps = depsOf(CALL, ORDER, HEAR, TAX, TOLL, SPLIT);

interface Setup {
  readonly state: GameState;
  readonly phone: InstanceId;
  readonly order: InstanceId;
  /** Player 2's ally. */
  readonly ally: InstanceId;
  readonly villain: InstanceId;
  readonly main: InstanceId;
}

const patch = (state: GameState, id: InstanceId, change: Partial<GameState["instances"][string]>): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), ...change } },
});
const heroForm = (state: GameState, ...players: readonly PlayerId[]): GameState => ({
  ...state,
  players: state.players.map((p) =>
    players.includes(p.playerId) ? { ...p, identity: { ...p.identity, form: "hero" as const } } : p,
  ),
});
const identityOf = (state: GameState, player: PlayerId) => mustPlayer(state, player).identity.instanceId;

/** Both identities in alter-ego form (they cannot attack or thwart); player 2's ally ready; 6 threat on the main scheme. */
function setup(): Setup {
  const base = gameAtFirstTurn({
    players: 2,
    cards: [PHONE, ORDERS, LISTENER, TAXED, BODYGUARD, CRISIS, TOLLED, SPARK, SPLITTER, THUG],
    deps,
    deck: [PHONE.id, ORDERS.id, LISTENER.id, TAXED.id, SPARK.id, SPLITTER.id],
    encounter: [BODYGUARD.id, CRISIS.id, TOLLED.id, THUG.id, ...copiesOf(TREACHERY.id, 26)],
  });
  const phone = playerCardIntoPlay(base, PHONE.id);
  const order = playerCardIntoPlay(phone.state, ORDERS.id);
  const ally = playerCardIntoPlay(order.state, ALLY.id, P2);
  const main = ally.state.mainScheme.instanceId;
  return {
    state: patch(ally.state, main, { threat: 6 }),
    phone: phone.id,
    order: order.id,
    ally: ally.id,
    villain: ally.state.villains[0]!.instanceId,
    main,
  };
}

const use = (card: InstanceId, ability: StubAbility): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: card,
  abilityId: ability.ref.id as Extract<Command, { type: "useAbility" }>["abilityId"],
  payment: [],
});

interface Plan {
  readonly player?: PlayerId;
  /** `attack:<id>` or `thwart:<id>`. */
  readonly power?: string;
  readonly target?: string;
  /** Several targets, in order: a division (a character who may divide the power). */
  readonly targets?: readonly string[];
  /** The answer to the `divide` choice that follows: option ids `<target>#<n>`. */
  readonly shares?: readonly string[];
  /** Answer a `spendResources` prompt with every option (true) or nothing (false, the default). */
  readonly pay?: boolean;
}
/** Answers this effect's prompts as planned and records every prompt it saw; anything else as `defaultPick`. */
function planned(plan: Plan) {
  const seen: NonNullable<GameState["pendingChoice"]>[] = [];
  const pick = (state: GameState): readonly string[] => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    seen.push(choice);
    const kind = choice.prompt.kind;
    if (kind === "choosePlayer" && plan.player) return [plan.player];
    if (kind === "chooseBasicPower" && plan.power) return [plan.power];
    if (kind === "chooseBasicPowerTarget" && plan.targets) return plan.targets;
    if (kind === "chooseBasicPowerTarget" && plan.target) return [plan.target];
    if (kind === "divide" && plan.shares) return plan.shares;
    if (kind === "spendResources") return plan.pay ? choice.options.map((o) => o.optionId) : [];
    return defaultPick(state);
  };
  return { pick, seen };
}
function run(state: GameState, plan: Plan, ...commands: readonly Command[]) {
  const { pick, seen } = planned(plan);
  const { session, events } = driveSession(startSession(state), deps, commands, pick);
  return { session, state: session.state, events, seen };
}
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const prompt = <K extends string>(seen: readonly NonNullable<GameState["pendingChoice"]>[], kind: K) =>
  seen.find((choice) => choice.prompt.kind === kind);
const optionIds = (choice: NonNullable<GameState["pendingChoice"]> | undefined) =>
  (choice?.options ?? []).map((o) => o.optionId);

describe("basicPowerBy — 'that player makes a basic attack or thwart with a character they control' (§3.64)", () => {
  it("the chosen player picks character, power and target; the ally exhausts, deals ATK 2 + 1 and takes 1", () => {
    const s = setup();
    const { state, events, seen } = run(
      s.state,
      { player: P2, power: `attack:${s.ally}`, target: s.villain },
      use(s.phone, CALL),
    );
    // Player 2, who is not the active player, is the one asked, and must pick: the text has no "may".
    const power = prompt(seen, "chooseBasicPower");
    expect(power?.playerId).toBe(P2);
    expect(power?.minSelections).toBe(1);
    expect(optionIds(power)).toEqual([`attack:${s.ally}`, `thwart:${s.ally}`]);
    const target = prompt(seen, "chooseBasicPowerTarget");
    expect(target?.playerId).toBe(P2);
    expect(target?.prompt).toEqual({ kind: "chooseBasicPowerTarget", power: "attack", characterInstanceId: s.ally });
    expect(optionIds(target)).toEqual([s.villain]);
    expect(of(events, "basicPowerInstructed")).toEqual([
      {
        type: "basicPowerInstructed",
        playerId: P2,
        characterInstanceId: s.ally,
        power: "attack",
        targetInstanceId: s.villain,
        sourceInstanceId: s.phone,
      },
    ]);
    expect(mustInstance(state, s.ally).exhausted).toBe(true);
    expect(mustInstance(state, s.villain).damage).toBe(3);
    expect(mustInstance(state, s.ally).damage).toBe(1);
  });

  it("a thwart removes THW 1 + 1; the bonus was on that use only and is gone when it ends", () => {
    const s = setup();
    const { state, events } = run(
      s.state,
      { player: P2, power: `thwart:${s.ally}`, target: s.main },
      use(s.phone, CALL),
    );
    expect(mustInstance(state, s.main).threat).toBe(4);
    expect(mustInstance(state, s.ally).exhausted).toBe(true);
    // Both bonuses started with the thwart's event and ended with it.
    expect(of(events, "lastingEffectRetimed")).toHaveLength(2);
    expect(of(events, "lastingEffectEnded").map((e) => e.reason)).toEqual(["expired", "expired"]);
    expect(state.lastingEffects).toEqual([]);
    expect(characterProfile(state, s.ally, deps)?.atk).toBe(2);
    expect(characterProfile(state, s.ally, deps)?.thw).toBe(1);
  });

  it("the bonus is on the chosen character alone: another character's basic attack that turn is unchanged", () => {
    const s = setup();
    const hero = heroForm(s.state, P1);
    const after = run(hero, { player: P2, power: `attack:${s.ally}`, target: s.villain }, use(s.phone, CALL)).state;
    const me = identityOf(after, P1);
    const then = run(
      after,
      {},
      { type: "basicAttack", playerId: P1, attackerInstanceId: me, targetInstanceId: s.villain },
    ).state;
    expect(mustInstance(then, s.villain).damage - mustInstance(after, s.villain).damage).toBe(2);
  });

  it("is a basic power to every reader: 'when your ally uses a basic attack' adds its +1 (2 + 1 + 1 = 4)", () => {
    const s = setup();
    const listening = playerCardIntoPlay(s.state, LISTENER.id, P2).state;
    const { state } = run(listening, { player: P2, power: `attack:${s.ally}`, target: s.villain }, use(s.phone, CALL));
    expect(mustInstance(state, s.villain).damage).toBe(4);
  });

  it("the controller may choose themself: a ready hero thwarts for THW 2 + 1 and exhausts", () => {
    const s = setup();
    const hero = heroForm(s.state, P1);
    const me = identityOf(hero, P1);
    const { state, seen } = run(hero, { player: P1, power: `thwart:${me}`, target: s.main }, use(s.phone, CALL));
    expect(optionIds(prompt(seen, "choosePlayer"))).toEqual([P1, P2]);
    expect(prompt(seen, "chooseBasicPower")?.playerId).toBe(P1);
    expect(mustInstance(state, s.main).threat).toBe(3);
    expect(mustInstance(state, me).exhausted).toBe(true);
    expect(mustInstance(state, s.ally).exhausted).toBe(false);
  });

  it("a player with no ready character cannot be chosen; with no such player the action is refused", () => {
    const s = setup();
    const spent = patch(s.state, s.ally, { exhausted: true });
    // Nobody can: both identities are alter-egos and the only ally is exhausted.
    const refused = applyCommand(spent, use(s.phone, CALL), deps);
    expect(refused.ok).toBe(false);
    // Player 1 in hero form is then the only eligible player, bound without asking.
    const hero = heroForm(spent, P1);
    const me = identityOf(hero, P1);
    const { state, seen } = run(hero, { power: `attack:${me}`, target: s.villain }, use(s.phone, CALL));
    expect(prompt(seen, "choosePlayer")).toBeUndefined();
    expect(optionIds(prompt(seen, "chooseBasicPower"))).toEqual([`attack:${me}`, `thwart:${me}`]);
    expect(mustInstance(state, s.villain).damage).toBe(3);
    // An exhausted hero is no candidate either (RRG 1.8 p. 10: "A character must exhaust to use this power").
    expect(applyCommand(patch(hero, me, { exhausted: true }), use(s.phone, CALL), deps).ok).toBe(false);
  });

  it("the bare effect on a player with no legal use does nothing and says so", () => {
    const s = setup();
    const spent = patch(s.state, s.ally, { exhausted: true });
    const { state, events, seen } = run(spent, {}, use(s.order, ORDER));
    expect(seen).toEqual([]);
    expect(of(events, "basicPowerNotMade")).toEqual([
      { type: "basicPowerNotMade", playerId: P2, sourceInstanceId: s.order, reason: "noLegalUse" },
    ]);
    expect(of(events, "basicPowerInstructed")).toEqual([]);
    expect(mustInstance(state, s.villain).damage).toBe(0);
    expect(state.lastingEffects).toEqual([]);
    expect(state.stack).toEqual([]);
  });

  it("guard holds: with a guard minion engaged with that player, the villain is no target", () => {
    const s = setup();
    const guarded = minionEngagedWith(s.state, BODYGUARD.id, P2);
    const { state, seen } = run(
      guarded.state,
      { player: P2, power: `attack:${s.ally}`, target: guarded.id },
      use(s.phone, CALL),
    );
    expect(optionIds(prompt(seen, "chooseBasicPowerTarget"))).toEqual([guarded.id]);
    expect(mustInstance(state, guarded.id).damage).toBe(3);
    expect(mustInstance(state, s.villain).damage).toBe(0);
  });

  it("a crisis icon holds: the main scheme is no target of the thwart, the crisis scheme is", () => {
    const s = setup();
    const crisis = encounterCardInVillainArea(s.state, CRISIS.id, 3);
    const { state, seen } = run(
      crisis.state,
      { player: P2, power: `thwart:${s.ally}`, target: crisis.id },
      use(s.phone, CALL),
    );
    expect(optionIds(prompt(seen, "chooseBasicPowerTarget"))).toEqual([crisis.id]);
    expect(mustInstance(state, crisis.id).threat).toBe(1);
    expect(mustInstance(state, s.main).threat).toBe(6);
  });

  it("a stunned character attacks: the stunned card is discarded, it exhausts, no damage, and the bonus ends", () => {
    const s = setup();
    const stunned = patch(s.state, s.ally, { statuses: { stunned: 1, confused: 0, tough: 0 } });
    const { state, events } = run(
      stunned,
      { player: P2, power: `attack:${s.ally}`, target: s.villain },
      use(s.phone, CALL),
    );
    expect(mustInstance(state, s.ally).statuses.stunned).toBe(0);
    expect(mustInstance(state, s.ally).exhausted).toBe(true);
    expect(mustInstance(state, s.villain).damage).toBe(0);
    // Not considered to have attacked: no consequential damage, and the +1s never started.
    expect(mustInstance(state, s.ally).damage).toBe(0);
    expect(of(events, "lastingEffectRetimed")).toEqual([]);
    expect(state.lastingEffects).toEqual([]);
    // Readied, its own next basic attack on its controller's turn would have no bonus left to pick up.
    expect(characterProfile(patch(state, s.ally, { exhausted: false }), s.ally, deps)?.atk).toBe(2);
  });

  it("a power with its own resource cost asks the chosen player to pay; unpaid, nothing of it happens", () => {
    const s = setup();
    const taxed = playerCardIntoPlay(patch(s.state, s.ally, { exhausted: true }), TAXED.id, P2);
    const plan = { player: P2, power: `attack:${taxed.id}`, target: s.villain };
    const paid = run(taxed.state, { ...plan, pay: true }, use(s.phone, CALL));
    expect(prompt(paid.seen, "spendResources")?.playerId).toBe(P2);
    expect(mustInstance(paid.state, s.villain).damage).toBe(3);
    expect(mustInstance(paid.state, taxed.id).exhausted).toBe(true);
    expect(mustPlayer(paid.state, P2).hand.length).toBeLessThan(mustPlayer(taxed.state, P2).hand.length);

    const unpaid = run(taxed.state, { ...plan, pay: false }, use(s.phone, CALL));
    expect(of(unpaid.events, "basicPowerNotMade").map((e) => e.reason)).toEqual(["costNotPaid"]);
    expect(mustInstance(unpaid.state, s.villain).damage).toBe(0);
    expect(mustInstance(unpaid.state, taxed.id).exhausted).toBe(false);
    expect(mustPlayer(unpaid.state, P2).hand).toEqual(mustPlayer(taxed.state, P2).hand);
    expect(unpaid.state.lastingEffects).toEqual([]);
    // A player who could not pay it at all has no legal use of that power.
    const broke = {
      ...taxed.state,
      players: taxed.state.players.map((p) => (p.playerId === P2 ? { ...p, hand: [] } : p)),
    };
    expect(applyCommand(broke, use(s.phone, CALL), deps).ok).toBe(false);
  });

  it("a scheme's additional thwart cost is asked of that player as usual: paid, THW 1 + 1 comes off; declined, nothing", () => {
    const s = setup();
    const tolled = encounterCardInVillainArea(s.state, TOLLED.id, 6);
    const funded = giveCard(tolled.state, P2, SPARK.id).state;
    const plan = { player: P2, power: `thwart:${s.ally}`, target: tolled.id };
    const paid = run(funded, { ...plan, pay: true }, use(s.phone, CALL));
    expect(of(paid.events, "thwartCostAsked")).toHaveLength(1);
    expect(mustInstance(paid.state, tolled.id).threat).toBe(4);
    expect(mustInstance(paid.state, s.ally).exhausted).toBe(true);
    expect(paid.state.lastingEffects).toEqual([]);

    const declined = run(funded, { ...plan, pay: false }, use(s.phone, CALL));
    expect(mustInstance(declined.state, tolled.id).threat).toBe(6);
    expect(mustInstance(declined.state, s.ally).exhausted).toBe(false);
    // The +1s were for a use that never happened: they do not wait for the ally's next basic power.
    expect(declined.state.lastingEffects).toEqual([]);
  });

  it("replays deep-equal", () => {
    const s = setup();
    const hero = heroForm(playerCardIntoPlay(s.state, LISTENER.id, P2).state, P1);
    const { session } = run(
      hero,
      { player: P2, power: `thwart:${s.ally}`, target: s.main },
      use(s.phone, CALL),
      use(s.order, ORDER),
    );
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});

/**
 * Owner decision, 2026-10-08 (docs/phase7-wave8.md §4.1 row 82): a character who may divide its basic power may
 * divide it when Cell Phone has them make it. The card prints "makes a basic attack or thwart"; RRG 1.8 FAQ "Wasp
 * (#1C)" (p. 61) treats her divided attack as her basic attack. No official source speaks of a basic power made on a
 * card's instruction. Before the decision the power was made undivided, with no way to divide it.
 */
describe("basicPowerBy: a character who may divide the basic power may divide it (row 82)", () => {
  /** Player 2 also controls the dividing ally (ATK 2), with a minion engaged with them beside the villain. */
  function split() {
    const s = setup();
    const splitter = playerCardIntoPlay(s.state, SPLITTER.id, P2);
    const thug = minionEngagedWith(splitter.state, THUG.id, P2);
    return { ...s, state: thug.state, splitter: splitter.id, thug: thug.id };
  }

  it("two targets and their shares: ATK 2 + 1 is divided 2 and 1, one attack on each in the order chosen", () => {
    const s = split();
    const { state, events, seen } = run(
      s.state,
      {
        player: P2,
        power: `attack:${s.splitter}`,
        targets: [s.villain, s.thug],
        shares: [`${s.villain}#1`, `${s.villain}#2`, `${s.thug}#1`],
      },
      use(s.phone, CALL),
    );
    const targets = prompt(seen, "chooseBasicPowerTarget");
    expect(targets?.prompt).toMatchObject({ mayDivide: true });
    expect(targets).toMatchObject({ minSelections: 1, maxSelections: 2 });
    const shares = prompt(seen, "divide");
    expect(shares?.prompt).toEqual({ kind: "divide", what: "damage", amount: 3, eachAtLeast: 1 });
    expect(shares).toMatchObject({ playerId: P2, minSelections: 3, maxSelections: 3 });
    // Each target can take all but the 1 the other must get.
    expect(optionIds(shares)).toEqual([`${s.villain}#1`, `${s.villain}#2`, `${s.thug}#1`, `${s.thug}#2`]);
    expect(mustInstance(state, s.villain).damage).toBe(2);
    expect(mustInstance(state, s.thug).damage).toBe(1);
    expect(mustInstance(state, s.splitter).exhausted).toBe(true);
    expect(of(events, "basicPowerInstructed")).toEqual([
      expect.objectContaining({
        characterInstanceId: s.splitter,
        power: "attack",
        targetInstanceId: s.villain,
        divide: [
          { targetInstanceId: s.villain, amount: 2 },
          { targetInstanceId: s.thug, amount: 1 },
        ],
      }),
    ]);
    // The +1 was for this use: nothing is left waiting.
    expect(state.lastingEffects).toEqual([]);
    expect(state.stack).toEqual([]);
  });

  it("one target chosen: the power is made undivided for ATK 2 + 1, and no division is asked", () => {
    const s = split();
    const { state, seen } = run(
      s.state,
      { player: P2, power: `attack:${s.splitter}`, targets: [s.thug] },
      use(s.phone, CALL),
    );
    expect(prompt(seen, "divide")).toBeUndefined();
    expect(mustInstance(state, s.thug).damage).toBe(3);
    expect(mustInstance(state, s.villain).damage).toBe(0);
  });

  it("a share of 0 for a chosen target is refused and the choice stays open", () => {
    const s = split();
    let state = s.state;
    const step = (command: Command): void => {
      const result = applyCommand(state, command, deps);
      if (!result.ok) throw new Error(result.error.message);
      state = result.state;
    };
    const answer = (selectedOptionIds: readonly string[]): Command => ({
      type: "resolveChoice",
      playerId: state.pendingChoice!.playerId,
      choiceId: state.pendingChoice!.choiceId,
      selectedOptionIds,
    });
    // Player 2 is the only player who can make a basic power, so no player is asked for.
    step(use(s.phone, CALL));
    expect(state.pendingChoice?.prompt.kind).toBe("chooseBasicPower");
    step(answer([`attack:${s.splitter}`]));
    step(answer([s.villain, s.thug]));
    expect(state.pendingChoice?.prompt.kind).toBe("divide");
    const none = applyCommand(state, answer([`${s.villain}#1`, `${s.villain}#2`, `${s.villain}#3`]), deps);
    expect(none.ok).toBe(false);
    // Fewer points than there are to divide.
    expect(applyCommand(state, answer([`${s.villain}#1`, `${s.thug}#1`]), deps).ok).toBe(false);
    expect(state.pendingChoice?.prompt.kind).toBe("divide");
    step(answer([`${s.villain}#1`, `${s.thug}#1`, `${s.thug}#2`]));
    expect(mustInstance(state, s.villain).damage).toBe(1);
    expect(mustInstance(state, s.thug).damage).toBe(2);
  });

  it("a character with no such rule gets one target and no `mayDivide`, as before", () => {
    const s = split();
    const { state, seen } = run(
      s.state,
      { player: P2, power: `attack:${s.ally}`, target: s.villain },
      use(s.phone, CALL),
    );
    const targets = prompt(seen, "chooseBasicPowerTarget");
    expect(targets?.prompt).toEqual({ kind: "chooseBasicPowerTarget", power: "attack", characterInstanceId: s.ally });
    expect(targets).toMatchObject({ minSelections: 1, maxSelections: 1 });
    expect(mustInstance(state, s.villain).damage).toBe(3);
  });

  it("her thwart is not hers to divide (the rule names her attack): one scheme", () => {
    const s = split();
    const crisis = encounterCardInVillainArea(s.state, TOLLED.id, 6);
    const { seen } = run(
      crisis.state,
      { player: P2, power: `thwart:${s.splitter}`, target: s.main },
      use(s.phone, CALL),
    );
    expect(prompt(seen, "chooseBasicPowerTarget")).toMatchObject({ maxSelections: 1 });
    expect(prompt(seen, "chooseBasicPowerTarget")?.prompt).not.toHaveProperty("mayDivide");
  });

  it("replays deep-equal", () => {
    const s = split();
    const { session } = run(
      s.state,
      {
        player: P2,
        power: `attack:${s.splitter}`,
        targets: [s.thug, s.villain],
        shares: [`${s.thug}#1`, `${s.villain}#1`, `${s.villain}#2`],
      },
      use(s.phone, CALL),
    );
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
