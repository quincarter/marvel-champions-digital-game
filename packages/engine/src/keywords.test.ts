import { flat, type AnyCard, type CardId, type KeywordInstance } from "@mc/content";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { statusActive } from "./keywords.js";
import { mustInstance, mustPlayer } from "./query.js";
import { createGame } from "./setup.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import {
  stubAlly,
  stubEvent,
  stubMainScheme,
  stubMinion,
  stubSupport,
  stubTreachery,
  stubUpgrade,
  stubVillain,
} from "./testing/fixtures.js";
import { HERO, RESOURCE, defaultPick, newGame, resolvePending, runWith, settle, settleUntil } from "./testing/scenario.js";

const p1 = playerId("p1");
const endTurn = { type: "endTurn", playerId: p1 } as const;
const toHero = { type: "changeForm", playerId: p1 } as const;

const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(50), atk: 2, sch: 1 }] });
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(60), acceleration: flat(0) }],
});
const deckOf = (id: CardId, count = 20): readonly CardId[] => Array.from({ length: count }, () => id);

/** A state plus every event produced getting there, so ordering can be asserted. */
interface Trace {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

function go(trace: Trace, deps: EngineDeps, ...commands: readonly Command[]): Trace {
  let current = trace.state;
  const events = [...trace.events];
  for (const command of commands) {
    const result = applyCommand(current, command, deps);
    if (!result.ok) throw new Error(`${command.type}: ${result.error.code} — ${result.error.message}`);
    current = result.state;
    events.push(...result.events);
  }
  return { state: current, events };
}

/** Answers pending choices with `pick` until the game needs a command again. */
function auto(trace: Trace, deps: EngineDeps, pick = defaultPick): Trace {
  let current = trace;
  let guard = 0;
  while (current.state.pendingChoice && !current.state.outcome) {
    if (guard++ > 200) throw new Error("choice loop did not settle");
    const choice = current.state.pendingChoice;
    current = go(current, deps, {
      type: "resolveChoice",
      playerId: choice.playerId,
      choiceId: choice.choiceId,
      selectedOptionIds: pick(current.state),
    });
  }
  return current;
}

const trace = (state: GameState): Trace => ({ state, events: [] });

const damagedInOrder = (events: readonly GameEvent[]): readonly InstanceId[] =>
  events.filter((e): e is Extract<GameEvent, { type: "damageDealt" }> => e.type === "damageDealt").map((e) => e.targetInstanceId);

// ---------------------------------------------------------------------------
// Multi-target effects resolve in the order the effect listed them.
// ---------------------------------------------------------------------------

test("an effect that damages several targets resolves them first-listed first", () => {
  const ability = stubAbility("sweep", {
    trigger: { kind: "action" },
    effects: [
      {
        kind: "chooseTarget",
        slot: "victims",
        chooser: { kind: "controller" },
        query: { categories: ["minion"] },
        count: 2,
      },
      { kind: "dealDamage", target: { kind: "slot", slot: "victims" }, amount: { kind: "const", value: 1 } },
    ],
  });
  const event = stubEvent({ id: "sweep-card", cost: 0, resources: 1, abilities: [ability.ref] });
  const minion = stubMinion({ id: "thug", atk: 0, sch: 0, hp: 5, boostIcons: 0 });
  const deps = depsOf(ability);
  const start = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [event, minion],
    deck: deckOf(event.id, 24),
    encounterDeck: deckOf(minion.id),
    deps,
  });

  const roundTwo = settle(runWith(deps, start, endTurn), undefined, deps);
  const roundThree = settle(runWith(deps, roundTwo, endTurn), undefined, deps);
  const minions = mustPlayer(roundThree, p1).playArea.filter(
    (id) => roundThree.instances[id]?.cardId === minion.id,
  );
  expect(minions).toHaveLength(2);
  const [first, second] = minions as [InstanceId, InstanceId];

  const card = mustPlayer(roundThree, p1).hand.find((id) => roundThree.instances[id]?.cardId === event.id);
  const played = go(trace(roundThree), deps, {
    type: "playCard",
    playerId: p1,
    cardInstanceId: card as InstanceId,
    payment: [],
    attachToInstanceId: null,
  });
  // The chooser names them second-then-first; that is the order they take damage in.
  const choice = played.state.pendingChoice;
  const resolved = go(played, deps, {
    type: "resolveChoice",
    playerId: p1,
    choiceId: choice?.choiceId as never,
    selectedOptionIds: [second, first],
  });
  expect(damagedInOrder(resolved.events.slice(played.events.length))).toEqual([second, first]);
});

// ---------------------------------------------------------------------------
// Restricted
// ---------------------------------------------------------------------------

const RESTRICTED_UPGRADE = stubUpgrade({
  id: "restricted-gear",
  cost: 0,
  resources: 1,
  keywords: [{ name: "restricted" }],
});

// RRG "Restricted": a player cannot control more than two at a time.
test("playing a third restricted card is rejected", () => {
  const start = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [RESTRICTED_UPGRADE],
    deck: deckOf(RESTRICTED_UPGRADE.id, 24),
  });
  const held = (state: GameState): InstanceId =>
    mustPlayer(state, p1).hand.find((id) => state.instances[id]?.cardId === RESTRICTED_UPGRADE.id) as InstanceId;

  const playIt = (state: GameState): Command => ({
    type: "playCard",
    playerId: p1,
    cardInstanceId: held(state),
    payment: [],
    attachToInstanceId: null,
  });

  let current = start;
  current = go(trace(current), { abilities: {} }, playIt(current)).state;
  current = go(trace(current), { abilities: {} }, playIt(current)).state;
  const third = applyCommand(current, playIt(current));
  expect(third.ok).toBe(false);
  if (!third.ok) expect(third.error.code).toBe("no_valid_target");
});

// RRG "Restricted": if a player ever controls a third, they discard down to two.
test("a third restricted card put into play parks a discard-down-to-two choice", () => {
  const setupCard = stubSupport({
    id: "restricted-setup",
    cost: 0,
    resources: 1,
    keywords: [{ name: "restricted" }, { name: "setup" }],
  });
  const result = createGame({
    seed: 4,
    cards: [setupCard, RESOURCE, VILLAIN, SCHEME, HERO],
    villainCardId: VILLAIN.id,
    mainSchemeCardId: SCHEME.id,
    encounterDeck: [],
    players: [{ identityCardId: HERO.id, deck: [...deckOf(setupCard.id, 3), ...deckOf(RESOURCE.id, 10)] }],
  });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  const choice = result.state.pendingChoice;
  expect(choice?.prompt).toEqual({ kind: "discardRestricted", limit: 2 });
  expect(choice?.minSelections).toBe(1);

  const after = resolvePending(result.state, [choice?.options[0]?.optionId as string]);
  expect(mustPlayer(after, p1).playArea).toHaveLength(2);
});

// ---------------------------------------------------------------------------
// Status keywords
// ---------------------------------------------------------------------------

const STUN = stubAbility("stun-them", {
  trigger: { kind: "action" },
  effects: [
    { kind: "chooseTarget", slot: "victim", chooser: { kind: "controller" }, query: { categories: ["minion"] } },
    { kind: "giveStatus", target: { kind: "slot", slot: "victim" }, status: "stunned" },
  ],
});
const STUN_CARD = stubEvent({ id: "stun-card", cost: 0, resources: 1, abilities: [STUN.ref] });

function withMinionInPlay(minionId: CardId, extra: readonly AnyCard[]) {
  const deps = depsOf(STUN);
  const start = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [STUN_CARD, ...extra],
    deck: deckOf(STUN_CARD.id, 24),
    encounterDeck: deckOf(minionId),
    deps,
  });
  const roundTwo = settle(runWith(deps, start, endTurn), undefined, deps);
  const minion = mustPlayer(roundTwo, p1).playArea.find((id) => roundTwo.instances[id]?.cardId === minionId);
  return { deps, state: roundTwo, minion: minion as InstanceId };
}

const stunCommand = (state: GameState): Command => ({
  type: "playCard",
  playerId: p1,
  cardInstanceId: mustPlayer(state, p1).hand.find((id) => state.instances[id]?.cardId === STUN_CARD.id) as InstanceId,
  payment: [],
  attachToInstanceId: null,
});

// RRG "Stalwart": the character cannot be stunned or confused at all.
test("a stalwart character cannot be given a stun status", () => {
  const stalwart = stubMinion({ id: "stalwart-thug", atk: 1, sch: 1, hp: 5, boostIcons: 0, keywords: [{ name: "stalwart" }] });
  const { deps, state, minion } = withMinionInPlay(stalwart.id, [stalwart]);
  const stunned = auto(go(trace(state), deps, stunCommand(state)), deps, (s) =>
    s.pendingChoice?.prompt.kind === "chooseTarget" ? [minion] : defaultPick(s),
  );
  expect(mustInstance(stunned.state, minion).statuses.stunned).toBe(0);
  expect(stunned.events.some((e) => e.type === "statusGiven")).toBe(false);
});

// RRG "Steady": it takes two status cards of a type before the character has that status.
test("a steady character holds two stun cards and is not stunned until the second", () => {
  const steady = stubMinion({ id: "steady-thug", atk: 1, sch: 1, hp: 5, boostIcons: 0, keywords: [{ name: "steady" }] });
  const { deps, state, minion } = withMinionInPlay(steady.id, [steady]);
  const pick = (s: GameState): readonly string[] =>
    s.pendingChoice?.prompt.kind === "chooseTarget" ? [minion] : defaultPick(s);

  const once = auto(go(trace(state), deps, stunCommand(state)), deps, pick);
  expect(mustInstance(once.state, minion).statuses.stunned).toBe(1);
  expect(statusActive(once.state, minion, "stunned")).toBe(false);
  const twice = auto(go(once, deps, stunCommand(once.state)), deps, pick);
  expect(mustInstance(twice.state, minion).statuses.stunned).toBe(2);
  expect(statusActive(twice.state, minion, "stunned")).toBe(true);

  // A third is refused: two is the cap.
  const thrice = auto(go(twice, deps, stunCommand(twice.state)), deps, pick);
  expect(mustInstance(thrice.state, minion).statuses.stunned).toBe(2);
});

// ---------------------------------------------------------------------------
// Permanent
// ---------------------------------------------------------------------------

// RRG "Permanent": the card cannot leave play, so a discard effect does nothing.
test("a permanent card cannot be discarded from play", () => {
  const ability = stubAbility("self-destruct", {
    trigger: { kind: "action" },
    effects: [{ kind: "discardFromPlay", target: { kind: "self" } }],
  });
  const support = stubSupport({
    id: "permanent-support",
    cost: 0,
    resources: 1,
    keywords: [{ name: "permanent" }],
    abilities: [ability.ref],
  });
  const deps = depsOf(ability);
  const start = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [support],
    deck: deckOf(support.id, 24),
    deps,
  });
  const supportId = mustPlayer(start, p1).hand.find((id) => start.instances[id]?.cardId === support.id) as InstanceId;
  const played = runWith(deps, start, {
    type: "playCard",
    playerId: p1,
    cardInstanceId: supportId,
    payment: [],
    attachToInstanceId: null,
  });
  const after = runWith(deps, played, {
    type: "useAbility",
    playerId: p1,
    cardInstanceId: supportId,
    abilityId: ability.ref.id,
    payment: [],
  });
  expect(mustPlayer(after, p1).playArea).toContain(supportId);
  expect(mustPlayer(after, p1).discard).not.toContain(supportId);
});

// ---------------------------------------------------------------------------
// Peril
// ---------------------------------------------------------------------------

// RRG "Peril": while the card resolves, only the resolving player decides.
test("a choice made while a peril card resolves is marked sole-decider", () => {
  const ability = stubAbility("peril-choice", {
    trigger: { kind: "whenRevealed" },
    effects: [
      { kind: "chooseTarget", slot: "victim", chooser: { kind: "eventPlayer" }, query: { categories: ["hero", "alterEgo"] } },
      { kind: "dealDamage", target: { kind: "slot", slot: "victim" }, amount: { kind: "const", value: 1 } },
    ],
  });
  const treachery = stubTreachery({ id: "peril-card", boostIcons: 0, keywords: [{ name: "peril" }], abilities: [ability.ref] });
  const deps = depsOf(ability);
  const start = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [treachery],
    encounterDeck: deckOf(treachery.id),
    deps,
  });
  const atChoice = settleUntil(runWith(deps, start, endTurn), "chooseTarget", deps);
  expect(atChoice.pendingChoice?.prompt.kind).toBe("chooseTarget");
  expect(atChoice.pendingChoice?.soleDecider).toBe(true);
});

// ---------------------------------------------------------------------------
// Incite X
// ---------------------------------------------------------------------------

// RRG "Incite X": revealing the card places X threat on the main scheme.
test("incite places its threat on the main scheme when the card is revealed", () => {
  const treachery = stubTreachery({ id: "incite-card", boostIcons: 0, keywords: [{ name: "incite", value: 3 }] });
  const start = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [treachery],
    encounterDeck: deckOf(treachery.id),
  });
  const after = settle(runWith({ abilities: {} }, start, endTurn));
  // 0 acceleration + villain SCH 1 against the alter-ego + 3 incite.
  expect(mustInstance(after, after.mainScheme.instanceId).threat).toBe(4);
});

// ---------------------------------------------------------------------------
// Quickstrike
// ---------------------------------------------------------------------------

const quickstrikeDamage = (keywords: readonly KeywordInstance[]): number => {
  const minion = stubMinion({ id: "striker", atk: 3, sch: 1, hp: 5, boostIcons: 0, keywords });
  const start = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [minion],
    encounterDeck: deckOf(minion.id),
  });
  const after = settle(runWith({ abilities: {} }, start, toHero, endTurn));
  return mustInstance(after, mustPlayer(after, p1).identity.instanceId).damage;
};

// RRG "Quickstrike": the minion attacks the player it just engaged, in hero form.
test("a quickstrike minion attacks the player it engages as it enters play", () => {
  const withQuickstrike = quickstrikeDamage([{ name: "quickstrike" }]);
  const without = quickstrikeDamage([]);
  expect(withQuickstrike - without).toBe(3);
});

test("a quickstrike minion does not attack a player in alter-ego form", () => {
  const minion = stubMinion({ id: "striker", atk: 3, sch: 1, hp: 5, boostIcons: 0, keywords: [{ name: "quickstrike" }] });
  const start = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [minion],
    encounterDeck: deckOf(minion.id),
  });
  const after = settle(runWith({ abilities: {} }, start, endTurn));
  expect(mustInstance(after, mustPlayer(after, p1).identity.instanceId).damage).toBe(0);
});

// ---------------------------------------------------------------------------
// Piercing and Ranged
// ---------------------------------------------------------------------------

const attackWithAlly = (
  allyKeywords: readonly KeywordInstance[],
  minionKeywords: readonly KeywordInstance[],
): { readonly minionDamage: number; readonly allyDamage: number } => {
  const ally = stubAlly({ id: "gunner", cost: 0, atk: 2, thw: 1, hp: 5, resources: 1, keywords: allyKeywords, consequentialAttack: 0 });
  const minion = stubMinion({ id: "target", atk: 0, sch: 0, hp: 9, boostIcons: 0, keywords: minionKeywords });
  const start = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [ally, minion],
    deck: deckOf(ally.id, 24),
    encounterDeck: deckOf(minion.id),
  });
  const roundTwo = settle(runWith({ abilities: {} }, start, endTurn));
  const minionId = mustPlayer(roundTwo, p1).playArea.find((id) => roundTwo.instances[id]?.cardId === minion.id) as InstanceId;
  const allyId = mustPlayer(roundTwo, p1).hand.find((id) => roundTwo.instances[id]?.cardId === ally.id) as InstanceId;
  const after = settle(
    runWith(
      { abilities: {} },
      roundTwo,
      { type: "playCard", playerId: p1, cardInstanceId: allyId, payment: [], attachToInstanceId: null },
      { type: "basicAttack", playerId: p1, attackerInstanceId: allyId, targetInstanceId: minionId },
    ),
  );
  return {
    minionDamage: mustInstance(after, minionId).damage,
    allyDamage: mustInstance(after, allyId).damage,
  };
};

// RRG "Piercing": tough is discarded before damage, so it prevents nothing.
test("a piercing attack strips tough and still deals its damage", () => {
  const piercing = attackWithAlly([{ name: "piercing" }], [{ name: "toughness" }]);
  expect(piercing.minionDamage).toBe(2);
  const plain = attackWithAlly([], [{ name: "toughness" }]);
  expect(plain.minionDamage).toBe(0);
});

// RRG "Ranged": an attack with ranged ignores the retaliate keyword.
test("a ranged attack ignores retaliate", () => {
  const ranged = attackWithAlly([{ name: "ranged" }], [{ name: "retaliate", value: 2 }]);
  expect(ranged.allyDamage).toBe(0);
  const plain = attackWithAlly([], [{ name: "retaliate", value: 2 }]);
  expect(plain.allyDamage).toBe(2);
});

// ---------------------------------------------------------------------------
// Villainous
// ---------------------------------------------------------------------------

// RRG "Villainous": the minion is given a boost card for every activation,
// scheming included — not just when it attacks.
test("a villainous minion gets a boost card when it schemes", () => {
  const boosted = (keywords: readonly KeywordInstance[]): number => {
    const minion = stubMinion({ id: "schemer", atk: 1, sch: 2, hp: 5, boostIcons: 2, keywords });
    const start = newGame({
      villain: VILLAIN,
      mainScheme: SCHEME,
      extraCards: [minion],
      encounterDeck: deckOf(minion.id, 30),
    });
    const roundTwo = settle(runWith({ abilities: {} }, start, endTurn));
    const before = mustInstance(roundTwo, roundTwo.mainScheme.instanceId).threat;
    const roundThree = settle(runWith({ abilities: {} }, roundTwo, endTurn));
    return mustInstance(roundThree, roundThree.mainScheme.instanceId).threat - before;
  };
  // Villain SCH 1 + its 2-icon boost card, then the minion's SCH 2 (+2 if villainous).
  expect(boosted([{ name: "villainous" }]) - boosted([])).toBe(2);
});
