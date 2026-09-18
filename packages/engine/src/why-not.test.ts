/**
 * `explainQuery` / `choiceExclusions` — "why isn't that a legal target?"
 *
 * RRG 1.8 "Choose (Game Element)" (p. 13) and "Target" (p. 42): a choice is made among the elements an effect's own
 * wording admits, so the honest answer to "why not that one?" is the clause of that wording which rejected it.
 * Page numbers are the printed ones in `mc_rulesreference_v18_compressed.pdf`.
 */

import { flat, type CardId } from "@mc/content";
import type { Command } from "./commands.js";
import { playerId } from "./ids.js";
import { activeVillain, mustPlayer } from "./query.js";
import { cardsInPlay, explainQuery, matchesQuery, type EffectContext } from "./select.js";
import type { TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAlly, stubEvent, stubMainScheme, stubMinion, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { giveCard, newGame, payFor, resolvePending, RESOURCE, run, runWith, settle, settleUntil } from "./testing/scenario.js";
import { choiceExclusions } from "./why-not.js";

const p1 = playerId("p1");
const p2 = playerId("p2");
const endTurn = (player = p1): Command => ({ type: "endTurn", playerId: player });
const toHero = (player = p1): Command => ({ type: "changeForm", playerId: player });

const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(200), atk: 2, sch: 1 }] });
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(200), acceleration: flat(0) }],
});
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const deckOf = (id: CardId, count = 24): readonly CardId[] => Array.from({ length: count }, () => id);

// ---------------------------------------------------------------------------
// One implementation: the filter and the explanation are the same function.
// ---------------------------------------------------------------------------

test("matchesQuery is exactly 'explainQuery found nothing', for every card in play and a spread of queries", () => {
  const state = run(newGame({ villain: VILLAIN, mainScheme: SCHEME }), toHero());
  const context: EffectContext = { selfInstanceId: null, controllerId: p1, event: null, bindings: {} };
  const queries: readonly TargetQuery[] = [
    {},
    { categories: ["enemy"] },
    { categories: ["character"], controller: "you" },
    { categories: ["scheme"], hasThreat: true },
    { exhausted: false },
    { exhausted: true },
    { damaged: true },
    { engagedWith: "you" },
    { trait: "nothing" as never },
    { withoutTrait: "nothing" as never },
    { name: "not a card" },
    { owner: "you" },
    { maxPrintedCost: 0 },
    { hasAnyStatus: true },
    { hasStatus: "tough" },
  ];

  for (const query of queries) {
    for (const id of cardsInPlay(state)) {
      expect(matchesQuery(state, id, query, context), `${id} / ${JSON.stringify(query)}`).toBe(
        explainQuery(state, id, query, context) === null,
      );
    }
  }
});

test("each clause reports itself, and the first clause that rejects is the one reported", () => {
  const state = run(newGame({ villain: VILLAIN, mainScheme: SCHEME }), toHero());
  const context: EffectContext = { selfInstanceId: null, controllerId: p1, event: null, bindings: {} };
  const villain = activeVillain(state).instanceId;
  const hero = mustPlayer(state, p1).identity.instanceId;

  expect(explainQuery(state, villain, { categories: ["ally"] }, context)).toBe("wrongCategory");
  expect(explainQuery(state, villain, { controller: "you" }, context)).toBe("wrongController");
  expect(explainQuery(state, hero, { controller: "encounter" }, context)).toBe("wrongController");
  expect(explainQuery(state, villain, { exhausted: true }, context)).toBe("ready");
  expect(explainQuery(state, villain, { damaged: true }, context)).toBe("notDamaged");
  expect(explainQuery(state, state.mainScheme.instanceId, { hasThreat: true }, context)).toBe("noThreat");
  expect(explainQuery(state, villain, { hasStatus: "stunned" }, context)).toBe("missingStatus");
  expect(explainQuery(state, villain, { name: "Nobody" }, context)).toBe("wrongName");
  expect(explainQuery(state, villain, { self: true }, context)).toBe("wrongSelf");

  // Categories are checked before controller, so a villain asked for "an ally you control" reports the category.
  expect(explainQuery(state, villain, { categories: ["ally"], controller: "you" }, context)).toBe("wrongCategory");
  // And a match reports nothing at all.
  expect(explainQuery(state, villain, { categories: ["villain"] }, context)).toBeNull();
});

// ---------------------------------------------------------------------------
// The open choice's own universe. RRG 1.8 "Guard" (p. 21) for the defended villain.
// ---------------------------------------------------------------------------

/** An ability that asks the player to choose an enemy, played as an event so the choice parks on its effects frame. */
const chooseEnemy = stubAbility("choose-enemy", {
  trigger: { kind: "action", form: "hero" },
  effects: [
    { kind: "chooseTarget", slot: "enemy", chooser: { kind: "controller" }, query: { categories: ["enemy"] } },
    { kind: "dealDamage", target: { kind: "slot", slot: "enemy" }, amount: { kind: "const", value: 1 } },
  ],
});
const PICK = stubEvent({ id: "pick", cost: 0, abilities: [chooseEnemy.ref] });

test("the options and the exclusions together are the whole visible universe, with no card in both", () => {
  const deps = depsOf(chooseEnemy);
  const start = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [BLANK, PICK],
    encounterDeck: deckOf(BLANK.id),
    deck: [...deckOf(RESOURCE.id, 18), ...deckOf(PICK.id, 6)],
    deps,
  });
  const given = giveCard(start, p1, PICK.id);
  const state = runWith(deps, given.state, toHero(), {
    type: "playCard",
    playerId: p1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  });

  expect(state.pendingChoice?.prompt.kind).toBe("chooseTarget");
  const offered = (state.pendingChoice?.options ?? []).flatMap((option) => (option.ref.kind === "card" ? [option.ref.instanceId] : []));
  const exclusions = choiceExclusions(state, deps);

  const universe = cardsInPlay(state);
  expect([...offered, ...exclusions.map((entry) => entry.instanceId)].sort()).toEqual([...universe].sort());
  expect(offered.some((id) => exclusions.some((entry) => entry.instanceId === id))).toBe(false);

  // "An enemy": the villain is the only one in play, so everything else is out for the same reason.
  expect(offered).toEqual([activeVillain(state).instanceId]);
  for (const entry of exclusions) expect(entry.reason).toBe("wrongCategory");
});

test("a guard minion is why the villain is not a target of an attack the player could otherwise make", () => {
  const guard = stubMinion({ id: "guard", atk: 0, sch: 0, hp: 4, boostIcons: 0, keywords: [{ name: "guard" }] });
  const attackAn = stubAbility("attack-an-enemy", {
    trigger: { kind: "action", form: "hero" },
    label: ["attack"],
    effects: [
      {
        kind: "chooseTarget",
        slot: "enemy",
        chooser: { kind: "controller" },
        query: { categories: ["enemy"], attackableBy: { kind: "identityOf", player: { kind: "controller" } } },
      },
      { kind: "attack", target: { kind: "slot", slot: "enemy" }, amount: { kind: "const", value: 1 } },
    ],
  });
  const SWING = stubEvent({ id: "swing", cost: 0, abilities: [attackAn.ref] });
  const deps = depsOf(attackAn);
  const start = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [guard, SWING],
    encounterDeck: deckOf(guard.id),
    deck: [...deckOf(RESOURCE.id, 18), ...deckOf(SWING.id, 6)],
    deps,
  });
  const roundTwo = runWith(deps, settle(runWith(deps, start, endTurn()), undefined, deps), toHero());
  const given = giveCard(roundTwo, p1, SWING.id);
  const state = runWith(deps, given.state, {
    type: "playCard",
    playerId: p1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  });

  const exclusions = choiceExclusions(state, deps);
  const villain = exclusions.find((entry) => entry.instanceId === activeVillain(state).instanceId);
  // RRG 1.8 "Guard" (p. 21): "The engaged player cannot attack any villain."
  expect(villain?.reason).toBe("cannotBeAttacked");
});

// ---------------------------------------------------------------------------
// The defend prompt's own filters. RRG 1.8 p. 9 step 2, p. 16 "Defend, Defense".
// ---------------------------------------------------------------------------

const ALLY = stubAlly({ id: "buddy", cost: 2, atk: 1, thw: 1, hp: 3, resources: 1 });

/** A two-seat game whose deck holds the ally above, so a seat can put one in play. */
const twoSeatGame = (): GameState =>
  newGame({
    players: 2,
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [BLANK, ALLY],
    encounterDeck: deckOf(BLANK.id),
    deck: [...deckOf(RESOURCE.id, 18), ...deckOf(ALLY.id, 6)],
  });

test("an alter-ego cannot defend, and that is what the prompt's exclusions say", () => {
  // RRG 1.8 "Defend, Defense" (p. 16) and p. 9 step 2: a player exhausts a *hero* or an ally as the defender.
  const played = run(twoSeatGame(), toHero(p1), endTurn(p1), endTurn(p2));
  const atDefense = settleUntil(played, "declareDefender");
  expect(atDefense.pendingChoice?.prompt.kind).toBe("declareDefender");

  const reasons = new Map(choiceExclusions(atDefense).map((entry) => [entry.instanceId, entry.reason]));
  expect(reasons.get(mustPlayer(atDefense, p2).identity.instanceId)).toBe("alterEgoForm");
  // The villain and the schemes could never defend, so nothing is fabricated for them.
  expect(reasons.has(activeVillain(atDefense).instanceId)).toBe(false);
  expect(reasons.has(atDefense.mainScheme.instanceId)).toBe(false);
});

test("an ally that already defended this phase is excluded as exhausted, not silently missing", () => {
  const start = twoSeatGame();
  const given = giveCard(start, p1, ALLY.id);
  const played = run(
    given.state,
    toHero(p1),
    { type: "playCard", playerId: p1, cardInstanceId: given.id, payment: payFor(given.state, p1, 2), attachToInstanceId: null },
    endTurn(p1),
    toHero(p2),
    endTurn(p2),
  );

  // Both seats are in hero form, so the villain attacks each of them; the ally defends the first attack.
  const first = settleUntil(played, "declareDefender");
  expect(first.pendingChoice?.options.map((option) => option.optionId)).toContain(given.id);
  const second = settleUntil(resolvePending(first, [given.id]), "declareDefender");
  expect(second.pendingChoice?.prompt.kind).toBe("declareDefender");

  const reasons = new Map(choiceExclusions(second).map((entry) => [entry.instanceId, entry.reason]));
  expect(reasons.get(given.id)).toBe("exhausted");
});

test("nothing is reported for a prompt whose universe is not the cards in play", () => {
  const atMulligan = newGame({ villain: VILLAIN, mainScheme: SCHEME });
  expect(choiceExclusions(atMulligan)).toEqual([]);

  const atDiscard = run(atMulligan, endTurn(p1));
  expect(atDiscard.pendingChoice?.prompt.kind).toBe("discardDownToHandSize");
  expect(choiceExclusions(atDiscard)).toEqual([]);
  expect(choiceExclusions(resolvePending(atDiscard, []))).toEqual([]);
});
