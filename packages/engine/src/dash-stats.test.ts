import { activeVillain } from "./query.js";
import { flat, type CardId } from "@mc/content";
import type { Command } from "./commands.js";
import { applyCommand } from "./engine.js";
import { playerId, type InstanceId } from "./ids.js";
import { characterProfile, mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAlly, stubEvent, stubMainScheme, stubMinion, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { giveCards, newGame, RESOURCE, runWith, settle } from "./testing/scenario.js";

// Schema `PrintedStat`: a printed "—" is not a 0 — the character can't use that power at all.
const p1 = playerId("p1");
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(5), targetThreat: flat(40), acceleration: flat(0) }],
});
const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const copies = (id: CardId, n = 4): readonly CardId[] => Array.from({ length: n }, () => id);
const threat = (state: GameState) => mustInstance(state, state.mainScheme.instanceId).threat;

const HULK = stubAlly({ id: "hulk", cost: 0, atk: 3, thw: null, hp: 5 });
const PACIFIST = stubAlly({ id: "pacifist", cost: 0, atk: null, thw: 1, hp: 3 });
const allyThwart = stubAbility("ally-thwart", {
  trigger: { kind: "action" },
  effects: [
    { kind: "chooseTarget", slot: "a", chooser: { kind: "controller" }, query: { categories: ["ally"], controller: "you" } },
    { kind: "thwart", target: { kind: "mainScheme" }, amount: { kind: "const", value: 2 }, thwarter: { kind: "slot", slot: "a" } },
  ],
});
const ORDER = stubEvent({ id: "order", cost: 0, abilities: [allyThwart.ref] });

function start() {
  const deps = depsOf(allyThwart);
  const state = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [HULK, PACIFIST, ORDER, BLANK],
    deck: [...copies(HULK.id), ...copies(PACIFIST.id), ...copies(ORDER.id), ...copies(RESOURCE.id, 10)],
    encounterDeck: copies(BLANK.id, 20),
    deps,
  });
  const given = giveCards(state, p1, "hulk", "pacifist", "order");
  const [hulk, pacifist, order] = given.ids as [InstanceId, InstanceId, InstanceId];
  const play = (id: InstanceId): Command => ({ type: "playCard", playerId: p1, cardInstanceId: id, payment: [], attachToInstanceId: null });
  return { deps, state: runWith(deps, given.state, play(hulk), play(pacifist)), hulk, pacifist, order, play };
}

test("an ally with a printed '—' THW cannot make a basic thwart, and stays ready", () => {
  const { deps, state, hulk } = start();
  const result = applyCommand(state, { type: "basicThwart", playerId: p1, thwarterInstanceId: hulk, schemeInstanceId: state.mainScheme.instanceId }, deps);
  expect(result.ok).toBe(false);
  expect(mustInstance(state, hulk).exhausted).toBe(false);
});

test("an ally with a printed '—' ATK cannot make a basic attack", () => {
  const { deps, state, pacifist } = start();
  const result = applyCommand(state, { type: "basicAttack", playerId: p1, attackerInstanceId: pacifist, targetInstanceId: activeVillain(state).instanceId }, deps);
  expect(result.ok).toBe(false);
});

test("a '(thwart)' effect made by a character with a '—' THW removes no threat", () => {
  const { deps, state, hulk, pacifist, order, play } = start();
  const atChoice = runWith(deps, state, play(order));
  expect(atChoice.pendingChoice?.options.map((o) => o.optionId)).toEqual(expect.arrayContaining([hulk, pacifist]));
  const byHulk = applyCommand(atChoice, { type: "resolveChoice", playerId: p1, choiceId: atChoice.pendingChoice?.choiceId as never, selectedOptionIds: [hulk] }, deps);
  expect(byHulk.ok && threat(byHulk.state)).toBe(5);
  const byPacifist = applyCommand(atChoice, { type: "resolveChoice", playerId: p1, choiceId: atChoice.pendingChoice?.choiceId as never, selectedOptionIds: [pacifist] }, deps);
  expect(byPacifist.ok && threat(byPacifist.state)).toBe(3);
});

test("an enemy with a printed '—' SCH skips its scheme activation; an 'X' stat has a base of 0", () => {
  const idler = stubMinion({ id: "idler", atk: 1, sch: null, hp: 3, boostIcons: 0 });
  const titan = stubMinion({ id: "titan", atk: "X", sch: 1, hp: 6, boostIcons: 0 });
  const deps = depsOf();
  const state = newGame({ villain: VILLAIN, mainScheme: SCHEME, extraCards: [idler, titan, BLANK], encounterDeck: copies(idler.id, 20), deps });
  const roundTwo = settle(runWith(deps, state, { type: "endTurn", playerId: p1 }), undefined, deps);
  expect(mustPlayer(roundTwo, p1).playArea.some((id) => roundTwo.instances[id]?.cardId === idler.id)).toBe(true);
  // Round 2: the engaged idler activates against an alter-ego (a scheme) — and places nothing.
  const roundThree = settle(runWith(deps, roundTwo, { type: "endTurn", playerId: p1 }), undefined, deps);
  expect(threat(roundThree)).toBe(5);

  const withTitan = newGame({ villain: VILLAIN, mainScheme: SCHEME, extraCards: [titan, BLANK], encounterDeck: copies(titan.id, 20), deps });
  const titanRound = settle(runWith(deps, withTitan, { type: "endTurn", playerId: p1 }), undefined, deps);
  const titanId = mustPlayer(titanRound, p1).playArea.find((id) => titanRound.instances[id]?.cardId === titan.id) as InstanceId;
  expect(characterProfile(titanRound, titanId, deps)?.atk).toBe(0);
  expect(characterProfile(titanRound, titanId, deps)?.missing).toEqual([]);
});
