import { activeVillain } from "./query.js";
import { flat, type CardId } from "@mc/content";
import type { Command } from "./commands.js";
import { applyCommand } from "./engine.js";
import { playerId, type InstanceId } from "./ids.js";
import { characterProfile, mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import {
  stubAlly,
  stubEvent,
  stubMainScheme,
  stubMinion,
  stubSideScheme,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { giveCards, newGame, RESOURCE, runWith, settle, TREACHERY } from "./testing/scenario.js";
import { encounterCardInVillainArea, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

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
    {
      kind: "chooseTarget",
      slot: "a",
      chooser: { kind: "controller" },
      query: { categories: ["ally"], controller: "you" },
    },
    {
      kind: "thwart",
      target: { kind: "mainScheme" },
      amount: { kind: "const", value: 2 },
      thwarter: { kind: "slot", slot: "a" },
    },
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
  const play = (id: InstanceId): Command => ({
    type: "playCard",
    playerId: p1,
    cardInstanceId: id,
    payment: [],
    attachToInstanceId: null,
  });
  return { deps, state: runWith(deps, given.state, play(hulk), play(pacifist)), hulk, pacifist, order, play };
}

test("an ally with a printed '—' THW cannot make a basic thwart, and stays ready", () => {
  const { deps, state, hulk } = start();
  const result = applyCommand(
    state,
    { type: "basicThwart", playerId: p1, thwarterInstanceId: hulk, schemeInstanceId: state.mainScheme.instanceId },
    deps,
  );
  expect(result.ok).toBe(false);
  expect(mustInstance(state, hulk).exhausted).toBe(false);
});

test("an ally with a printed '—' ATK cannot make a basic attack", () => {
  const { deps, state, pacifist } = start();
  const result = applyCommand(
    state,
    {
      type: "basicAttack",
      playerId: p1,
      attackerInstanceId: pacifist,
      targetInstanceId: activeVillain(state).instanceId,
    },
    deps,
  );
  expect(result.ok).toBe(false);
});

test("a '(thwart)' effect made by a character with a '—' THW removes no threat", () => {
  const { deps, state, hulk, pacifist, order, play } = start();
  const atChoice = runWith(deps, state, play(order));
  expect(atChoice.pendingChoice?.options.map((o) => o.optionId)).toEqual(expect.arrayContaining([hulk, pacifist]));
  const byHulk = applyCommand(
    atChoice,
    {
      type: "resolveChoice",
      playerId: p1,
      choiceId: atChoice.pendingChoice?.choiceId as never,
      selectedOptionIds: [hulk],
    },
    deps,
  );
  expect(byHulk.ok && threat(byHulk.state)).toBe(5);
  const byPacifist = applyCommand(
    atChoice,
    {
      type: "resolveChoice",
      playerId: p1,
      choiceId: atChoice.pendingChoice?.choiceId as never,
      selectedOptionIds: [pacifist],
    },
    deps,
  );
  expect(byPacifist.ok && threat(byPacifist.state)).toBe(3);
});

test("an enemy with a printed '—' SCH skips its scheme activation; an 'X' stat has a base of 0", () => {
  const idler = stubMinion({ id: "idler", atk: 1, sch: null, hp: 3, boostIcons: 0 });
  const titan = stubMinion({ id: "titan", atk: "X", sch: 1, hp: 6, boostIcons: 0 });
  const deps = depsOf();
  const state = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [idler, titan, BLANK],
    encounterDeck: copies(idler.id, 20),
    deps,
  });
  const roundTwo = settle(runWith(deps, state, { type: "endTurn", playerId: p1 }), undefined, deps);
  expect(mustPlayer(roundTwo, p1).playArea.some((id) => roundTwo.instances[id]?.cardId === idler.id)).toBe(true);
  // Round 2: the engaged idler activates against an alter-ego (a scheme) — and places nothing.
  const roundThree = settle(runWith(deps, roundTwo, { type: "endTurn", playerId: p1 }), undefined, deps);
  expect(threat(roundThree)).toBe(5);

  const withTitan = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [titan, BLANK],
    encounterDeck: copies(titan.id, 20),
    deps,
  });
  const titanRound = settle(runWith(deps, withTitan, { type: "endTurn", playerId: p1 }), undefined, deps);
  const titanId = mustPlayer(titanRound, p1).playArea.find(
    (id) => titanRound.instances[id]?.cardId === titan.id,
  ) as InstanceId;
  expect(characterProfile(titanRound, titanId, deps)?.atk).toBe(0);
  expect(characterProfile(titanRound, titanId, deps)?.missing).toEqual([]);
});

describe("a character with a dash THW cannot thwart The Red House (ruling June 17, 2025)", () => {
  // "Hulk cannot thwart The Red House; a character needs to be able to initiate a thwart against The Red House before
  // triggering its interrupt to use their ATK, and since Hulk has a 'dash' (-) value for his THW, he cannot exhaust to
  // initiate a basic thwart this way." Assault is different (always in effect): a dash-THW character can thwart it.
  // RRG 1.8 p. 44 "Thwart" says a basic thwart needs the character's THW; the RRG does not address this card.
  /** "Interrupt: When a character thwarts this side scheme, they may use their ATK instead of their THW" (The Red House). */
  const MAY_USE_ATK = stubAbility("optional.constant", {
    trigger: { kind: "constant", rules: [{ kind: "thwartWithAtk", scheme: { self: true } }] },
    effects: [],
  });
  const HOUSE = stubSideScheme({ id: "house", startingThreat: 10, abilities: [MAY_USE_ATK.ref] });
  /** The Hulk ally shape: ATK 4, THW "dash". */
  const HULK_ATK_4 = stubAlly({ id: "hulk-atk-4", cost: 0, atk: 4, thw: null, hp: 5 });
  const houseDeps = depsOf(MAY_USE_ATK);

  it("an ally with THW dash and ATK 4 using ATK against the Red House is refused", () => {
    let state = gameAtFirstTurn({
      cards: [HULK_ATK_4, HOUSE],
      deps: houseDeps,
      deck: [HULK_ATK_4.id],
      encounter: [HOUSE.id, ...copies(TREACHERY.id, 29)],
    });
    state = playerCardIntoPlay(state, HULK_ATK_4.id).state;
    const hulk = mustPlayer(state, P1).playArea.find(
      (id) => mustInstance(state, id).cardId === HULK_ATK_4.id,
    ) as InstanceId;
    const house = encounterCardInVillainArea(state, HOUSE.id, 10);
    const command: Command = {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: hulk,
      schemeInstanceId: house.id,
      useAtk: true,
    };
    // Refused (the engine used to let the thwart through, ATK 4 removing 4 threat); the scheme keeps its 10 threat.
    const result = applyCommand(house.state, command, houseDeps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("cannot initiate a thwart");
    expect(mustInstance(house.state, house.id).threat).toBe(10);
    expect(mustInstance(house.state, hulk).exhausted).toBe(false);
  });
});
