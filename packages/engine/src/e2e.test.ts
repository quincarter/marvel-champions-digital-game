import { abilityId, flat, type AnyCard, type CardId, type ScalingValue } from "@mc/content";
import type { Command } from "./commands.js";
import { applyCommand, replay, sessionApply, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId, type PlayerId } from "./ids.js";
import { characterProfile, mustInstance, mustPlayer, remainingHitPoints } from "./query.js";
import { createGame, type GameSetupConfig } from "./setup.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import {
  stubAlly,
  stubAttachment,
  stubEvent,
  stubIdentity,
  stubMainScheme,
  stubMinion,
  stubResource,
  stubSupport,
  stubTreachery,
  stubUpgrade,
  stubVillain,
} from "./testing/fixtures.js";

const p1 = playerId("p1");
const p2 = playerId("p2");

const scaling = (base: number, perPlayer: number): ScalingValue => ({ base, perPlayer });

// ---------------------------------------------------------------------------
// Stub content: a Rhino-shaped two-stage villain, a two-stage main scheme, an
// encounter set built around the keywords, and two hero decks.
// ---------------------------------------------------------------------------

/** "Hero Interrupt: when your hero would take damage from an attack, prevent it." */
const BACKFLIP = stubAbility("backflip", {
  trigger: {
    kind: "interrupt",
    forced: false,
    form: "hero",
    on: { on: "dealDamage", fromAttack: true, targetIs: { categories: ["hero"], controller: "you" } },
  },
  effects: [{ kind: "cancelTriggeringEvent" }],
});

/** "Hero Response: after an enemy attacks you, deal 2 damage to the villain." */
const COUNTERBLOW = stubAbility("counterblow", {
  trigger: {
    kind: "response",
    forced: false,
    form: "hero",
    on: { on: "enemyAttack", playerIs: "controller", usesAttackedPlayer: true },
  },
  effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "const", value: 2 } }],
});

const WEB_SHOT = stubAbility("web-shot", {
  trigger: { kind: "action" },
  cost: { spendCounters: { counterType: "webbing", amount: 1 } },
  effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "const", value: 1 } }],
});

const ENERGY_CELL = stubAbility("energy-cell", {
  trigger: { kind: "resource" },
  cost: { exhaustSelf: true },
  generates: 1,
  effects: [],
});

const COMBAT_TRAINING = stubAbility("combat-training", {
  trigger: {
    kind: "constant",
    modifiers: [{ stat: "atk", amount: 1, target: { categories: ["hero"], controller: "you" } }],
  },
  effects: [],
});

/** Villain setup attachment: "Setup. The villain gets +1 ATK." */
const REINFORCED_HIDE = stubAbility("reinforced-hide", {
  trigger: {
    kind: "constant",
    modifiers: [{ stat: "atk", amount: 1, target: { categories: ["villain"] } }],
  },
  effects: [],
});

const DEPS = depsOf(BACKFLIP, COUNTERBLOW, WEB_SHOT, ENERGY_CELL, COMBAT_TRAINING, REINFORCED_HIDE);

const HERO_A = stubIdentity({
  id: "arachnid",
  hp: 10,
  atk: 2,
  thw: 2,
  def: 2,
  rec: 3,
  heroHandSize: 5,
  alterEgoHandSize: 6,
});
const HERO_B = stubIdentity({
  id: "jade",
  hp: 12,
  atk: 3,
  thw: 1,
  def: 1,
  rec: 4,
  heroHandSize: 5,
  alterEgoHandSize: 6,
});

const RESOURCE = stubResource({ id: "res", icons: 1 });
const HEAVY = stubAlly({
  id: "heavy",
  cost: 2,
  atk: 3,
  thw: 1,
  hp: 3,
  resources: 1,
  keywords: [{ name: "overkill" }],
});
const FRAGILE = stubAlly({ id: "fragile", cost: 1, atk: 1, thw: 1, hp: 1, resources: 1 });
/** One event card carrying both a Hero Interrupt and a Hero Response ability. */
const REFLEXES = stubEvent({ id: "reflexes", cost: 1, resources: 1, abilities: [BACKFLIP.ref, COUNTERBLOW.ref] });
const WEB_SHOOTER = stubUpgrade({
  id: "web-shooter",
  cost: 1,
  resources: 1,
  keywords: [{ name: "uses", count: 2, counterType: "webbing" }],
  abilities: [WEB_SHOT.ref],
});
const TRAINING = stubUpgrade({ id: "training", cost: 1, resources: 1, abilities: [COMBAT_TRAINING.ref] });
const RELAY = stubSupport({ id: "relay", cost: 1, resources: 1, abilities: [ENERGY_CELL.ref] });

const GUARD_MINION = stubMinion({
  id: "bodyguard",
  atk: 1,
  sch: 1,
  hp: 2,
  boostIcons: 0,
  keywords: [{ name: "guard" }],
});
const RETALIATE_MINION = stubMinion({
  id: "spiker",
  atk: 1,
  sch: 1,
  hp: 5,
  boostIcons: 0,
  keywords: [{ name: "retaliate", value: 1 }],
});
const TOUGH_MINION = stubMinion({
  id: "armored",
  atk: 1,
  sch: 1,
  hp: 2,
  boostIcons: 0,
  keywords: [{ name: "toughness" }],
});
const SURGE_TREACHERY = stubTreachery({ id: "pressure", boostIcons: 0, keywords: [{ name: "surge" }] });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });
const SHACKLES = stubAttachment({ id: "shackles", attachesTo: "hero", boostIcons: 0 });
const HIDE = stubAttachment({
  id: "hide",
  attachesTo: "villain",
  boostIcons: 0,
  keywords: [{ name: "setup" }],
  abilities: [REINFORCED_HIDE.ref],
});

const RHINO = stubVillain({
  id: "rhino",
  stages: [
    { hp: scaling(3, 3), atk: 1, sch: 2 },
    { hp: scaling(0, 3), atk: 2, sch: 2 },
  ],
});
const BREAKOUT = stubMainScheme({
  id: "breakout",
  stages: [
    { startingThreat: flat(0), targetThreat: scaling(2, 3), acceleration: flat(1) },
    { startingThreat: flat(0), targetThreat: scaling(1, 2), acceleration: flat(1) },
  ],
});

const CARDS: readonly AnyCard[] = [
  HERO_A,
  HERO_B,
  RESOURCE,
  HEAVY,
  FRAGILE,
  REFLEXES,
  WEB_SHOOTER,
  TRAINING,
  RELAY,
  GUARD_MINION,
  RETALIATE_MINION,
  TOUGH_MINION,
  SURGE_TREACHERY,
  FILLER,
  SHACKLES,
  HIDE,
  RHINO,
  BREAKOUT,
];

const copies = (id: CardId, count: number): readonly CardId[] => Array.from({ length: count }, () => id);

/** Deck A leans on the timing-window events and the Uses upgrade. */
const DECK_A: readonly CardId[] = [
  ...copies(RESOURCE.id, 18),
  ...copies(REFLEXES.id, 14),
  ...copies(WEB_SHOOTER.id, 4),
  ...copies(TRAINING.id, 4),
];

/** Deck B leans on allies and the resource-generating support. */
const DECK_B: readonly CardId[] = [
  ...copies(RESOURCE.id, 18),
  ...copies(HEAVY.id, 8),
  ...copies(FRAGILE.id, 6),
  ...copies(RELAY.id, 8),
];

const ENCOUNTER_DECK: readonly CardId[] = [
  ...copies(GUARD_MINION.id, 5),
  ...copies(RETALIATE_MINION.id, 4),
  ...copies(TOUGH_MINION.id, 4),
  ...copies(SURGE_TREACHERY.id, 3),
  ...copies(SHACKLES.id, 1),
  ...copies(FILLER.id, 1),
  HIDE.id,
];

const setupConfig = (seed: number, players: number): GameSetupConfig => ({
  seed,
  cards: CARDS,
  villainCardId: RHINO.id,
  mainSchemeCardId: BREAKOUT.id,
  encounterDeck: ENCOUNTER_DECK,
  players:
    players === 1
      ? [{ identityCardId: HERO_A.id, deck: DECK_A }]
      : [
          { identityCardId: HERO_A.id, deck: DECK_A },
          { identityCardId: HERO_B.id, deck: DECK_B },
        ],
});


// ---------------------------------------------------------------------------
// A scripted driver. Every command goes through the session log, so the whole
// game can be replayed from `initialState` + `commands` at the end.
// ---------------------------------------------------------------------------

interface Driver {
  session: GameSession;
  readonly events: GameEvent[];
}

/** How the script answers the choices the engine parks while a phase resolves. */
interface Policy {
  /** `declareDefender`: an instance id, or "decline". */
  readonly defend?: (state: GameState, playerId: PlayerId) => string;
  /** `chooseTriggers`: option ids (`instanceId:abilityId`) to use, in order. */
  readonly triggers?: (state: GameState, playerId: PlayerId) => readonly string[];
}

const start = (seed: number, players: number): Driver => {
  const result = createGame(setupConfig(seed, players), DEPS);
  if (!result.ok) throw new Error(`setup failed: ${result.error.message}`);
  return { session: startSession(result.state), events: [...result.events] };
};

const state = (driver: Driver): GameState => driver.session.state;

function send(driver: Driver, command: Command): void {
  const result = sessionApply(driver.session, command, DEPS);
  if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.code} — ${result.error.message}`);
  driver.session = result.session;
  driver.events.push(...result.events);
}

function answer(driver: Driver, optionIds: readonly string[]): void {
  const choice = state(driver).pendingChoice;
  if (!choice) throw new Error("no pending choice");
  send(driver, {
    type: "resolveChoice",
    playerId: choice.playerId,
    choiceId: choice.choiceId,
    selectedOptionIds: optionIds,
  });
}

/** Pays exactly `cost` out of the resource cards a `payForCard` prompt offers. */
function payWithResources(current: GameState, options: readonly { optionId: string }[], cost: number): readonly string[] {
  const picked = options
    .filter((option) => {
      const [kind, id] = option.optionId.split(":");
      return kind === "hand" && current.instances[id as InstanceId]?.cardId === RESOURCE.id;
    })
    .slice(0, cost)
    .map((option) => option.optionId);
  if (picked.length < cost) throw new Error(`cannot cover a cost of ${cost}`);
  return picked;
}

function decide(driver: Driver, policy: Policy): readonly string[] {
  const current = state(driver);
  const choice = current.pendingChoice;
  if (!choice) return [];
  switch (choice.prompt.kind) {
    case "declareDefender":
      return [policy.defend?.(current, choice.playerId) ?? "decline"];
    case "chooseTriggers": {
      const wanted = policy.triggers?.(current, choice.playerId) ?? [];
      return wanted.filter((id) => choice.options.some((option) => option.optionId === id));
    }
    case "payForCard":
      return payWithResources(current, choice.options, choice.prompt.cost);
    default:
      return choice.options.slice(0, choice.minSelections).map((option) => option.optionId);
  }
}

/** Answers choices until the game needs a real command again. */
function settle(driver: Driver, policy: Policy = {}): void {
  let guard = 0;
  while (state(driver).pendingChoice && !state(driver).outcome) {
    if (guard++ > 400) throw new Error("choice loop did not settle");
    answer(driver, decide(driver, policy));
  }
}

// --- board queries used by the script -------------------------------------

const heroOf = (current: GameState, player: PlayerId): InstanceId =>
  mustPlayer(current, player).identity.instanceId;

const inHand = (current: GameState, player: PlayerId, card: CardId): InstanceId | undefined =>
  mustPlayer(current, player).hand.find((id) => current.instances[id]?.cardId === card);

const mustInHand = (current: GameState, player: PlayerId, card: CardId): InstanceId => {
  const found = inHand(current, player, card);
  if (!found) throw new Error(`${player} has no ${card} in hand`);
  return found;
};

const inPlay = (current: GameState, player: PlayerId, card: CardId): InstanceId | undefined =>
  mustPlayer(current, player).playArea.find((id) => current.instances[id]?.cardId === card);

const mustInPlay = (current: GameState, player: PlayerId, card: CardId): InstanceId => {
  const found = inPlay(current, player, card);
  if (!found) throw new Error(`${player} has no ${card} in play`);
  return found;
};

function payFor(current: GameState, player: PlayerId, cost: number): readonly { readonly fromHand: InstanceId }[] {
  const ids = mustPlayer(current, player)
    .hand.filter((id) => current.instances[id]?.cardId === RESOURCE.id)
    .slice(0, cost);
  if (ids.length < cost) throw new Error(`${player} cannot pay ${cost}`);
  return ids.map((fromHand) => ({ fromHand }));
}

// --- scripted actions ------------------------------------------------------

function play(driver: Driver, player: PlayerId, card: CardId, cost: number): InstanceId {
  const id = mustInHand(state(driver), player, card);
  send(driver, {
    type: "playCard",
    playerId: player,
    cardInstanceId: id,
    payment: payFor(state(driver), player, cost),
    attachToInstanceId: null,
  });
  settle(driver);
  return id;
}

const changeForm = (driver: Driver, player: PlayerId): void => {
  send(driver, { type: "changeForm", playerId: player });
};

function attack(driver: Driver, player: PlayerId, attacker: InstanceId, target: InstanceId, policy: Policy = {}): void {
  send(driver, { type: "basicAttack", playerId: player, attackerInstanceId: attacker, targetInstanceId: target });
  settle(driver, policy);
}

function useAbility(driver: Driver, player: PlayerId, card: InstanceId, ability: string): void {
  send(driver, {
    type: "useAbility",
    playerId: player,
    cardInstanceId: card,
    abilityId: abilityId(ability),
    payment: [],
  });
  settle(driver);
}

function endTurn(driver: Driver, player: PlayerId, policy: Policy = {}): void {
  send(driver, { type: "endTurn", playerId: player });
  settle(driver, policy);
}

// --- event-stream assertions ----------------------------------------------

const mark = (driver: Driver): number => driver.events.length;
const since = (driver: Driver, from: number): readonly GameEvent[] => driver.events.slice(from);
const kinds = (events: readonly GameEvent[]): readonly string[] => events.map((event) => event.type);

const has = <T extends GameEvent["type"]>(
  events: readonly GameEvent[],
  type: T,
  match: (event: Extract<GameEvent, { type: T }>) => boolean = () => true,
): boolean =>
  events.some((event): boolean => event.type === type && match(event as Extract<GameEvent, { type: T }>));

const triggerOption = (instance: InstanceId, ability: string): string => `${instance}:${ability}`;

const activePlayer = (current: GameState): PlayerId => {
  const step = current.step;
  if (step.phase !== "player" || step.kind !== "turn") throw new Error(`not in a player turn: ${step.kind}`);
  return step.activePlayerId;
};

/** Plays the named in-hand event the first time a window actually offers it. */
function playOnce(card: CardId, ability: string): NonNullable<Policy["triggers"]> {
  let used = false;
  return (current, player) => {
    if (used) return [];
    const id = inHand(current, player, card);
    const option = id ? triggerOption(id, ability) : null;
    if (!option || !current.pendingChoice?.options.some((o) => o.optionId === option)) return [];
    used = true;
    return [option];
  };
}

// ---------------------------------------------------------------------------
// Two players, createGame through a win.
// ---------------------------------------------------------------------------

const SEED = 1383;

test("two players play a full game from createGame through defeating the villain", () => {
  const driver = start(SEED, 2);

  // --- setup: RRG Appendix II step 11 put the Setup-keyword attachment into
  // play, and its constant ability is already modifying the villain's ATK.
  const atSetup = state(driver);
  expect(atSetup.step).toEqual({ phase: "setup", kind: "mulligan", remainingPlayerIds: [p1, p2] });
  const hide = mustInstance(atSetup, atSetup.villain.instanceId).attachments[0] as InstanceId;
  expect(atSetup.instances[hide]?.cardId).toBe(HIDE.id);
  expect(atSetup.encounterDeck).not.toContain(hide);
  expect(characterProfile(atSetup, atSetup.villain.instanceId, DEPS)?.atk).toBe(2);

  // --- mulligan: p1 keeps, p2 pitches a card and draws back up.
  answer(driver, []);
  const pitched = mustInHand(state(driver), p2, HEAVY.id);
  answer(driver, [pitched]);
  expect(mustPlayer(state(driver), p2).hand).toHaveLength(6);
  expect(mustPlayer(state(driver), p2).discard).toContain(pitched);
  expect(state(driver).round).toBe(1);
  expect(activePlayer(state(driver))).toBe(p1);

  const villainId = state(driver).villain.instanceId;
  const p1Hero = heroOf(state(driver), p1);
  const p2Hero = heroOf(state(driver), p2);

  // ======================== round 1 ========================
  // Both players start in alter-ego form and flip to hero.
  expect(mustPlayer(state(driver), p1).identity.form).toBe("alterEgo");
  changeForm(driver, p1);
  expect(mustPlayer(state(driver), p1).identity.form).toBe("hero");

  // RRG "Uses (X 'type')": the upgrade enters play with its counters.
  const usesMark = mark(driver);
  const shooter = play(driver, p1, WEB_SHOOTER.id, 1);
  expect(mustInstance(state(driver), shooter).counters.webbing).toBe(2);
  expect(has(since(driver, usesMark), "counterAdded", (e) => e.counterType === "webbing" && e.amount === 2)).toBe(true);

  attack(driver, p1, p1Hero, villainId);
  expect(remainingHitPoints(state(driver), villainId, DEPS)).toBe(7);
  useAbility(driver, p1, shooter, "web-shot");
  expect(mustInstance(state(driver), shooter).counters.webbing).toBe(1);

  const lastUseMark = mark(driver);
  useAbility(driver, p1, shooter, "web-shot");
  // RRG "Uses": the card is discarded when its last counter is removed.
  expect(has(since(driver, lastUseMark), "cardDiscardedFromPlay", (e) => e.instanceId === shooter)).toBe(true);
  expect(mustPlayer(state(driver), p1).playArea).not.toContain(shooter);
  expect(remainingHitPoints(state(driver), villainId, DEPS)).toBe(5);
  endTurn(driver, p1);

  changeForm(driver, p2);
  const heavy = play(driver, p2, HEAVY.id, 2);
  attack(driver, p2, p2Hero, villainId);
  expect(remainingHitPoints(state(driver), villainId, DEPS)).toBe(2);

  // --- villain phase 1: p1 defends by playing an Interrupt event from hand
  // inside the damage window, which cancels the attack's damage entirely.
  const phaseOne = mark(driver);
  endTurn(driver, p2, { triggers: playOnce(REFLEXES.id, "backflip") });
  const phaseOneEvents = since(driver, phaseOne);
  expect(has(phaseOneEvents, "cardPlayed", (e) => e.cardId === REFLEXES.id && e.playerId === p1)).toBe(true);
  // RRG "Cancel": a canceled effect is treated as never having occurred.
  expect(has(phaseOneEvents, "triggerEvent", (e) => e.phase === "cancelled" && e.event.kind === "dealDamage")).toBe(true);
  expect(mustInstance(state(driver), p1Hero).damage).toBe(0);
  expect(mustInstance(state(driver), p2Hero).damage).toBe(2);

  const round2 = state(driver);
  expect(round2.round).toBe(2);
  // The first player token passed, so p2 leads round 2.
  expect(activePlayer(round2)).toBe(p2);
  const guard = mustInPlay(round2, p1, GUARD_MINION.id);
  const armored = mustInPlay(round2, p2, TOUGH_MINION.id);
  // RRG "Toughness": it entered play with a tough status card on it.
  expect(mustInstance(round2, armored).statuses.tough).toBe(1);

  // ======================== round 2 ========================
  // RRG "Tough": the status prevents all the damage and is then discarded.
  const toughMark = mark(driver);
  attack(driver, p2, p2Hero, armored);
  expect(
    has(since(driver, toughMark), "damagePrevented", (e) => e.targetInstanceId === armored && e.reason === "tough"),
  ).toBe(true);
  expect(mustInstance(state(driver), armored).damage).toBe(0);
  expect(mustInstance(state(driver), armored).statuses.tough).toBe(0);

  // RRG "Overkill": 3 ATK into a 2 HP minion sends the extra point to the villain.
  const overkillMark = mark(driver);
  attack(driver, p2, heavy, armored);
  const overkillEvents = since(driver, overkillMark);
  expect(has(overkillEvents, "characterDefeated", (e) => e.instanceId === armored)).toBe(true);
  expect(has(overkillEvents, "overkillSpilled", (e) => e.toInstanceId === villainId && e.amount === 1)).toBe(true);
  expect(remainingHitPoints(state(driver), villainId, DEPS)).toBe(1);

  // An ally that attacks takes consequential damage, which defeats this one.
  const fragile = play(driver, p2, FRAGILE.id, 1);
  const allyMark = mark(driver);
  attack(driver, p2, fragile, villainId);
  const allyEvents = since(driver, allyMark);
  expect(has(allyEvents, "villainStageAdvanced", (e) => e.stageIndex === 1)).toBe(true);
  expect(has(allyEvents, "characterDefeated", (e) => e.instanceId === fragile)).toBe(true);
  // RRG "Consequential Damage" resolves after the attack it followed.
  expect(kinds(allyEvents).indexOf("villainStageAdvanced")).toBeLessThan(
    allyEvents.findIndex((e) => e.type === "characterDefeated" && e.instanceId === fragile),
  );
  // RRG "Villain": excess damage does not carry over to the next stage.
  expect(mustInstance(state(driver), villainId).damage).toBe(0);
  expect(remainingHitPoints(state(driver), villainId, DEPS)).toBe(6);
  expect(mustPlayer(state(driver), p2).discard).toContain(fragile);
  endTurn(driver, p2);

  // RRG "Guard": p1 has a guard minion engaged, so nothing p1 controls may
  // attack the villain — but the guard minion itself is still a legal target.
  expect(mustInstance(state(driver), guard).engagedWith).toBe(p1);
  const blocked = applyCommand(
    state(driver),
    { type: "basicAttack", playerId: p1, attackerInstanceId: p1Hero, targetInstanceId: villainId },
    DEPS,
  );
  expect(blocked.ok).toBe(false);
  if (!blocked.ok) expect(blocked.error.code).toBe("no_valid_target");
  expect(
    applyCommand(
      state(driver),
      { type: "basicAttack", playerId: p1, attackerInstanceId: p1Hero, targetInstanceId: guard },
      DEPS,
    ).ok,
  ).toBe(true);
  // Thwarting is unaffected by guard.
  send(driver, { type: "basicThwart", playerId: p1, thwarterInstanceId: p1Hero, schemeInstanceId: state(driver).mainScheme.instanceId });
  settle(driver);
  expect(mustInstance(state(driver), state(driver).mainScheme.instanceId).threat).toBe(0);

  // --- villain phase 2: p1 answers the villain's attack with a Response event
  // from hand, and a Surge treachery chains into a second reveal.
  const phaseTwo = mark(driver);
  endTurn(driver, p1, { triggers: playOnce(REFLEXES.id, "counterblow") });
  const phaseTwoEvents = since(driver, phaseTwo);
  expect(has(phaseTwoEvents, "cardPlayed", (e) => e.cardId === REFLEXES.id && e.playerId === p1)).toBe(true);
  expect(has(phaseTwoEvents, "damageDealt", (e) => e.targetInstanceId === villainId && e.amount === 2)).toBe(true);
  expect(has(phaseTwoEvents, "surgeTriggered", (e) => e.playerId === p1)).toBe(true);
  // RRG "Surge": the original card finishes resolving, then the extra card is revealed.
  const surgeAt = phaseTwoEvents.findIndex((e) => e.type === "surgeTriggered");
  expect(
    phaseTwoEvents.slice(surgeAt).some((e) => e.type === "encounterCardRevealed" && e.playerId === p1),
  ).toBe(true);
  expect(mustPlayer(state(driver), p1).playArea.filter((id) => state(driver).instances[id]?.cardId === TOUGH_MINION.id)).toHaveLength(1);
  // The guard minion died last round, so the villain is attackable again.
  expect(remainingHitPoints(state(driver), villainId, DEPS)).toBe(4);

  // ======================== round 3 ========================
  const round3 = state(driver);
  expect(round3.round).toBe(3);
  expect(activePlayer(round3)).toBe(p1);
  const surged = mustInPlay(round3, p1, TOUGH_MINION.id);
  attack(driver, p1, p1Hero, surged);
  expect(mustInstance(state(driver), surged).statuses.tough).toBe(0);
  endTurn(driver, p1);

  attack(driver, p2, heavy, villainId);
  expect(remainingHitPoints(state(driver), villainId, DEPS)).toBe(1);
  attack(driver, p2, p2Hero, surged);
  expect(mustPlayer(state(driver), p1).playArea).not.toContain(surged);
  endTurn(driver, p2);

  // ======================== round 4: retaliate, then the kill ========================
  const round4 = state(driver);
  expect(round4.round).toBe(4);
  expect(activePlayer(round4)).toBe(p2);
  const spiker = mustInPlay(round4, p2, RETALIATE_MINION.id);

  // RRG "Retaliate X": the minion survives the attack and hits the attacker back.
  const retaliateMark = mark(driver);
  attack(driver, p2, p2Hero, spiker);
  const retaliateEvents = since(driver, retaliateMark);
  expect(has(retaliateEvents, "damageDealt", (e) => e.targetInstanceId === spiker && e.amount === 3)).toBe(true);
  expect(
    has(retaliateEvents, "damageDealt", (e) => e.sourceInstanceId === spiker && e.targetInstanceId === p2Hero && e.amount === 1),
  ).toBe(true);

  const winMark = mark(driver);
  attack(driver, p2, heavy, villainId);
  const final = state(driver);
  expect(has(since(driver, winMark), "gameEnded", (e) => e.outcome.result === "win")).toBe(true);
  expect(final.outcome).toEqual({ result: "win", reason: "villainDefeated" });
  expect(final.step).toEqual({ phase: "gameOver", kind: "gameOver" });
  expect(final.villain.defeated).toBe(true);

  // --- the whole game replays from its log to an identical state.
  const replayed = replay(driver.session.log, DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(final);
});



// ---------------------------------------------------------------------------
// One player, setup through a loss.
// ---------------------------------------------------------------------------

test("a solo game is lost when the main scheme completes its last stage", () => {
  const driver = start(SEED, 1);
  answer(driver, []);
  expect(state(driver).round).toBe(1);

  const scheme = state(driver).mainScheme.instanceId;
  // 1 acceleration + the villain's 2 SCH against an alter-ego, each round.
  endTurn(driver, p1);
  expect(mustInstance(state(driver), scheme).threat).toBe(3);
  expect(state(driver).mainScheme.stageIndex).toBe(0);

  const advanceMark = mark(driver);
  endTurn(driver, p1);
  const advanceEvents = since(driver, advanceMark);
  expect(has(advanceEvents, "mainSchemeCompleted", (e) => e.stageIndex === 0)).toBe(true);
  expect(has(advanceEvents, "mainSchemeAdvanced", (e) => e.stageIndex === 1)).toBe(true);
  // RRG "Main Scheme": excess threat is not carried over to the new stage.
  expect(mustInstance(state(driver), scheme).threat).toBe(1);

  const lossMark = mark(driver);
  endTurn(driver, p1);
  expect(has(since(driver, lossMark), "gameEnded", (e) => e.outcome.reason === "mainSchemeCompleted")).toBe(true);
  expect(state(driver).outcome).toEqual({ result: "loss", reason: "mainSchemeCompleted" });

  const replayed = replay(driver.session.log, DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(state(driver));
});
