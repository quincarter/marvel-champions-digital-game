/**
 * An enemy attack whose target player is eliminated partway through ends (`endedByTargetElimination`,
 * `resolve/enemy-activation.ts`). Synthetic cards only.
 *
 * RRG 1.8 "Player Elimination" (p. 34): "If a player is eliminated in the middle of an attack, that attack ends", and
 * "Eliminated players no longer participate in the game". FFG ruling (RRG 1.0-1.4 rulings, "Expansion card questions
 * part 5", question 3, scenario 4): "if a defending hero was defeated during the boost card step … the attack will not
 * deal any damage at the end because the target player was eliminated".
 *
 * Issue #1012 §1 (game d635a07d): Crossbones' Machine Gun interrupt eliminated Quicksilver as Crossbones attacked him;
 * the eliminated player was then asked to declare a defender, picked the other player's ally, and the attack dealt it
 * damage.
 */
import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "../abilities.js";
import type { Command } from "../commands.js";
import { replay, startSession } from "../engine.js";
import type { GameEvent } from "../events.js";
import type { InstanceId } from "../ids.js";
import { locateCard, mustInstance, mustPlayer } from "../query.js";
import type { EffectSpec } from "../spec.js";
import type { GameState } from "../state.js";
import { depsOf, stubAbility, type StubAbility } from "../testing/abilities.js";
import { driveSession } from "../testing/drive.js";
import { stubAlly, stubMainScheme, stubSupport, stubTreachery, stubVillain } from "../testing/fixtures.js";
import { defaultPick } from "../testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "../testing/wave3.js";

const KILL = 99;
const villainAttacksYou = stubAbility("attack-me.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "enemyAttack", enemies: { kind: "villain" }, against: { kind: "controller" } }],
});
/** "Forced Interrupt: When the villain attacks, deal 99 damage to the attacked character." (Machine Gun's place.) */
const GUNFIRE = stubAbility("gunfire.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "enemyAttack", sourceIs: { categories: ["villain"] } } },
  effects: [{ kind: "dealDamage", target: { kind: "eventTarget" }, amount: { kind: "const", value: KILL } }],
});
/** "Boost: Deal 99 damage to your hero." ("You" is the defending player, RRG 1.8 "Defend, Defense", p. 16.) */
const AMBUSH_BOOST = stubAbility("ambush.boost", {
  trigger: { kind: "boost" },
  effects: [
    {
      kind: "dealDamage",
      target: { kind: "identityOf", player: { kind: "controller" } },
      amount: { kind: "const", value: KILL },
    } satisfies EffectSpec,
  ],
});

/** "Boost: Deal 99 damage to the first player's hero." (P1, the attacked player, whoever defends.) */
const STRAFE_BOOST = stubAbility("strafe.boost", {
  trigger: { kind: "boost" },
  effects: [
    {
      kind: "dealDamage",
      target: { kind: "identityOf", player: { kind: "firstPlayer" } },
      amount: { kind: "const", value: KILL },
    } satisfies EffectSpec,
  ],
});

const SCHEME = stubMainScheme({
  id: "plot",
  stages: [{ startingThreat: flat(0), targetThreat: flat(90), acceleration: flat(0) }],
});
const BLANK = stubTreachery({ id: "blank", boostIcons: 1 });
const AMBUSH = stubTreachery({ id: "ambush", boostIcons: 1, abilities: [AMBUSH_BOOST.ref] });
const STRAFE = stubTreachery({ id: "strafe", boostIcons: 1, abilities: [STRAFE_BOOST.ref] });
/** P2's ally, which P1 could declare as the defender of an attack against P1 (the d635a07d Gambit). */
const WALL = stubAlly({ id: "wall", cost: 0, atk: 1, thw: 1, hp: 30 });
const BUTTON = stubSupport({ id: "attack-me", cost: 0, abilities: [villainAttacksYou.ref] });

const deps: EngineDeps = depsOf(villainAttacksYou, GUNFIRE, AMBUSH_BOOST, STRAFE_BOOST);

/**
 * Two players in hero form on P1's turn; P2 has the Wall in play and P1 the support whose action has the villain
 * attack P1. `interrupt` puts the Gunfire on the villain; `boost` is the encounter deck's only card.
 */
function table(options: { readonly interrupt: boolean; readonly boost: "blank" | "ambush" | "strafe" }) {
  const villain = stubVillain({
    id: "boss",
    stages: [{ hp: flat(40), atk: 3, sch: 1, abilities: options.interrupt ? [GUNFIRE.ref] : [] }],
  });
  const boostCard = options.boost === "ambush" ? AMBUSH : options.boost === "strafe" ? STRAFE : BLANK;
  const base = gameAtFirstTurn({
    cards: [villain, SCHEME, BLANK, AMBUSH, STRAFE, WALL, BUTTON],
    deps,
    players: 2,
    villain,
    mainScheme: SCHEME,
    deck: [WALL.id, BUTTON.id],
    encounter: copiesOf(boostCard.id, 30),
  });
  const heroes: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  };
  const wall = playerCardIntoPlay(heroes, WALL.id, P2);
  const button = playerCardIntoPlay(wall.state, BUTTON.id, P1);
  expect(button.state.step).toMatchObject({ phase: "player", activePlayerId: P1 });
  return { state: button.state, wall: wall.id, button: button.id };
}

/** Uses the button; Declare Defender is answered by `defend` (an instance id, or "decline"). */
function attack(
  options: { readonly interrupt: boolean; readonly boost: "blank" | "ambush" | "strafe" },
  defend: (state: GameState) => string = () => "decline",
) {
  const start = table(options);
  const command: Command = {
    type: "useAbility",
    playerId: P1,
    cardInstanceId: start.button,
    abilityId: (villainAttacksYou as StubAbility).ref.id as Extract<Command, { type: "useAbility" }>["abilityId"],
    payment: [],
  };
  const pick = (state: GameState): readonly string[] =>
    state.pendingChoice?.prompt.kind === "declareDefender" ? [defend(state)] : defaultPick(state);
  const run = driveSession(startSession(start.state), deps, [command], pick);
  const replayed = replay(run.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(run.session.state);
  return { state: run.session.state, events: run.events, wall: start.wall };
}

const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const defenderPrompts = (events: readonly GameEvent[]) =>
  of(events, "choiceRequested").filter((e) => e.choice.prompt.kind === "declareDefender");
const heroOf = (state: GameState, player: typeof P1): InstanceId => mustPlayer(state, player).identity.instanceId;
const wallOf = (state: GameState): InstanceId =>
  Object.values(state.instances).find((i) => i.cardId === WALL.id && i.faceup)!.instanceId;

describe("an enemy attack whose target player is eliminated ends (RRG 1.8 'Player Elimination', p. 34)", () => {
  it("eliminated in the attack's interrupt window: no boost card, nobody asked to defend, no damage (#1012)", () => {
    const { state, events, wall } = attack({ interrupt: true, boost: "blank" }, wallOf);
    expect(of(events, "playerEliminated")).toMatchObject([{ playerId: P1 }]);
    expect(defenderPrompts(events)).toEqual([]);
    expect(of(events, "boostCardDealt")).toEqual([]);
    expect(of(events, "activationSkipped")).toMatchObject([{ activation: "attack", reason: "targetEliminated" }]);
    expect(mustInstance(state, wall).damage).toBe(0);
    expect(mustInstance(state, wall).exhausted).toBe(false);
    expect(mustPlayer(state, P2).eliminated).toBe(false);
    expect(state.outcome).toBeNull();
    expect(state.pendingChoice?.playerId ?? P2).not.toBe(P1);
  });

  it("the defending hero is eliminated by a boost ability: the attack deals no damage and its boost card is discarded", () => {
    const { state, events } = attack({ interrupt: false, boost: "ambush" }, (s) => heroOf(s, P1));
    expect(of(events, "defenderDeclared")).toMatchObject([{ defenderInstanceId: heroOf(state, P1) }]);
    expect(of(events, "playerEliminated")).toMatchObject([{ playerId: P1 }]);
    expect(of(events, "activationSkipped")).toMatchObject([{ activation: "attack", reason: "targetEliminated" }]);
    // The only damage dealt is the boost ability's; the attack's own is never dealt.
    expect(of(events, "damageDealt").map((e) => e.amount)).toEqual([KILL]);
    const boss = Object.values(state.instances).find((i) => i.cardId === "boss")!;
    expect(boss.boostCards).toEqual([]);
    const [given] = of(events, "boostCardDealt");
    expect(locateCard(state, given!.instanceId)).toMatchObject({ kind: "encounterDiscard" });
    expect(state.outcome).toBeNull();
  });

  // RRG p. 34 says "a player": the attacked player's elimination ends the attack even once the other player's ally has
  // defended it and that player has become its target (rules-expert, #1012).
  it("the attacked player is eliminated after another player's ally defended: the attack ends and the ally takes nothing", () => {
    const { state, events, wall } = attack({ interrupt: false, boost: "strafe" }, wallOf);
    expect(of(events, "defenderDeclared")).toMatchObject([{ defenderInstanceId: wall }]);
    expect(of(events, "playerEliminated")).toMatchObject([{ playerId: P1 }]);
    expect(of(events, "activationSkipped")).toMatchObject([{ activation: "attack", reason: "targetEliminated" }]);
    expect(mustInstance(state, wall).damage).toBe(0);
  });

  it("control: without the elimination the attacked player is asked, may defend with the other player's ally, and it takes the damage", () => {
    const { state, events, wall } = attack({ interrupt: false, boost: "blank" }, wallOf);
    const [prompt] = defenderPrompts(events);
    expect(prompt?.choice.playerId).toBe(P1);
    expect(of(events, "activationSkipped")).toEqual([]);
    expect(mustInstance(state, wall).damage).toBe(4);
    expect(mustPlayer(state, P1).eliminated).toBe(false);
  });
});
