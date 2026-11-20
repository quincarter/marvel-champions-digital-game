/**
 * Competitive card audit, group 2 (docs/competitive-card-audit.md): the resistance side's player cards, the Captain
 * America leader's 56207 to 56210 and the Spider-Woman leader's 56211 to 56214 (MC56 p. 3). Each card is played by the
 * resistance team (p2) in a real two-team game (`./two-team.ts`); for p2 "your leader" is leader one (in the
 * registration team's area) and "the enemy leader" is leader two. p2 acts only after p1 has ended its turn.
 *
 * Sources: the cards' printed text (data `cw`), MC56 p. 16 (a leader attacking a leader: one boost card from the deck of
 * the area the attacker sits in, no defender), pp. 16-17, 20 (scenario rules override RRG per Golden Rule, RRG p. 4);
 * owner decisions Q5, Q6, Q11 (the inactive team's triggered abilities fire in the other team's phase, it takes no
 * actions), N11 of docs/competitive-mode-plan.md section 1.10; RRG v1.8 "Interrupt" p. 24 (a "would" interrupt resolves
 * before the attack initiates), "Response" p. 38, "Engage" (engaging a minion triggers "after a minion engages you").
 */

import { cardId } from "@mc/content";
import type { GameEvent, GameState, InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { firstLegal, inst, playerOf } from "../../../../testing/harness.js";
import {
  P1,
  P2,
  acceptAll,
  attachFromDeck,
  boost,
  boostsDealtTo,
  endTurn,
  give,
  leadersOf,
  patch,
  play,
  realCards,
  resolved,
  run,
  schemesOf,
  stubAttachment,
  twoTeamGame,
  typedResource,
} from "./two-team.js";

vi.setConfig({ testTimeout: 120_000 });

const ENGINE_TESTING = new URL("../../../../../../engine/src/testing/", import.meta.url).href;
const fixtures = (await import(/* @vite-ignore */ `${ENGINE_TESTING}fixtures.ts`)) as {
  readonly stubMinion: (spec: { id: string; atk: number; sch: number; hp: number; boostIcons?: number }) => never;
};

const NO_YOU_MOVE = "56207";
const FIGHTING_DIRTY = "56208";
const RECRUITED_BY_CAP = "56209";
const PEOPLES_HERO = "56210";
const DOUBLE_AGENT = "56211";
const SPIDER_BLAST = "56212";
const HARD_TO_HIT = "56213";
const SECRET_CONTACT = "56214";
const LIE_IN_WAIT = "13017";

const NO_BOOST = boost("no-boost", 0);
const BIG_BOOST = boost("big-boost", 4);
const MENTAL = typedResource("res-mental", "mental");
const ENERGY = typedResource("res-energy", "energy");
const PHYSICAL = typedResource("res-physical", "physical");
/** "Cap's Shield" and "Finesse" stand-ins (the fixture builds no real leader cards) that attach to any card. */
const SHIELD = stubAttachment({ id: "shield", name: "Cap's Shield", attachesTo: { kind: "anyCard" } });
const FINESSE = stubAttachment({ id: "finesse", name: "Finesse", attachesTo: { kind: "anyCard" } });
const MINION = fixtures.stubMinion({ id: "audit-minion", atk: 1, sch: 1, hp: 5, boostIcons: 0 });

const SEAT_CARDS = [
  NO_YOU_MOVE,
  FIGHTING_DIRTY,
  RECRUITED_BY_CAP,
  PEOPLES_HERO,
  DOUBLE_AGENT,
  SPIDER_BLAST,
  HARD_TO_HIT,
  SECRET_CONTACT,
  LIE_IN_WAIT,
  ...[1, 2, 3, 4].flatMap(() => [MENTAL.id as string, ENERGY.id as string, PHYSICAL.id as string]),
];

function game(options: { deckOne?: readonly string[]; deckTwo?: readonly string[] } = {}) {
  return twoTeamGame({
    ...options,
    filler: NO_BOOST,
    extraCards: [
      BIG_BOOST,
      MENTAL,
      ENERGY,
      PHYSICAL,
      SHIELD,
      FINESSE,
      MINION,
      ...realCards(
        NO_YOU_MOVE,
        FIGHTING_DIRTY,
        RECRUITED_BY_CAP,
        PEOPLES_HERO,
        DOUBLE_AGENT,
        SPIDER_BLAST,
        HARD_TO_HIT,
        SECRET_CONTACT,
        LIE_IN_WAIT,
      ),
    ],
    seatCards: SEAT_CARDS,
  });
}

const identityOf = (state: GameState, player: typeof P1 | typeof P2): InstanceId =>
  playerOf(state, player).identity.instanceId;

/** p2's turn: p1 ends its hero turn first. */
const toResistance = (deps: ReturnType<typeof game>["deps"], state: GameState) =>
  run(deps, state, firstLegal, endTurn(P1)).state;

/** Gives p2 `code` and `n` resources of `payCode` (surgery). */
function hand(state: GameState, code: string, payCode: string, n: number) {
  const card = give(state, P2, code);
  const paid: InstanceId[] = [];
  let current = card.state;
  for (let i = 0; i < n; i += 1) {
    const next = give(current, P2, payCode, paid);
    paid.push(next.id);
    current = next.state;
  }
  return { state: current, id: card.id, paid };
}

/** A resource card of p2 spent to pay for an upgrade played on p2's identity: the "after you spend it" trigger. */
function spendResource(deps: ReturnType<typeof game>["deps"], state: GameState, code: string) {
  const upgrade = give(state, P2, "upgrade");
  const resource = give(upgrade.state, P2, code);
  return run(deps, resource.state, acceptAll, play(P2, upgrade.id, [resource.id], identityOf(state, P2)));
}

const hit = (events: readonly GameEvent[], attacker: InstanceId, target: InstanceId) =>
  events.some(
    (e) => e.type === "enemyAttackedEnemy" && e.attackerInstanceId === attacker && e.targetInstanceId === target,
  );

describe("No, You Move! (56207): the enemy leader would attack you; Cap's Shield goes to your leader, who takes it", () => {
  const { state: start, deps } = game({ deckTwo: [BIG_BOOST.id as string, SHIELD.id as string] });
  const { one, two, deckTwo } = leadersOf(start);
  // The Shield is on the other side of the table, on p1's hero (anyGameArea in the card's own query).
  const shield = attachFromDeck(start, deckTwo, SHIELD.id as string, identityOf(start, P1));
  const turn = toResistance(deps, shield.state);
  const given = give(turn, P2, NO_YOU_MOVE);
  const attached = run(deps, given.state, firstLegal, play(P2, given.id, [], identityOf(turn, P2)));
  // p2 ends its turn: team one's villain phase (leader one attacks p1), then team two's (leader two attacks p2).
  const { state, events } = run(deps, attached.state, acceptAll, endTurn(P2));

  it("moves the Shield from p1's hero onto your leader (leader one)", () => {
    expect(inst(state, shield.id).attachedTo).toBe(one);
  });

  it("leader one takes the attack (ATK 2 + 4 boost icons), p2 takes none, one boost card from leader two's deck", () => {
    expect(hit(events, two, one)).toBe(true);
    expect(inst(state, one).damage).toBe(6);
    expect(inst(state, identityOf(state, P2)).damage).toBe(0);
    expect(boostsDealtTo(events, two)).toHaveLength(1);
  });

  it("is discarded after it resolves", () => {
    expect(resolved(events, "56207.no-you-move-forced-interrupt")).toBe(1);
    expect(playerOf(state, P2).discard).toContain(given.id);
  });
});

const PAYERS = { physical: PHYSICAL, mental: MENTAL, energy: ENERGY };
describe.each([
  ["Fighting Dirty (56208)", FIGHTING_DIRTY, "physical", "stunned"],
  ["Spider-Blast (56212)", SPIDER_BLAST, "mental", "confused"],
] as const)("%s: your leader attacks the enemy leader; [%s] applies the rider", (_name, code, type, status) => {
  function attack(payCode: string) {
    const { state: start, deps } = game({ deckOne: [BIG_BOOST.id as string] });
    const { one, two } = leadersOf(start);
    const turn = toResistance(deps, start);
    const given = hand(turn, code, payCode, 2);
    const result = run(deps, given.state, acceptAll, play(P2, given.id, given.paid));
    return { ...result, one, two };
  }

  it("leader one (your leader) attacks leader two with one boost card from its own area's deck (2 + 4), no defender", () => {
    const r = attack(PAYERS[type].id as string);
    expect(hit(r.events, r.one, r.two)).toBe(true);
    expect(r.events.some((e) => e.type === "defenderDeclared")).toBe(false);
    expect(boostsDealtTo(r.events, r.one)).toHaveLength(1);
    expect(inst(r.state, r.two).damage).toBe(6);
  });

  it(`paid with [${type}]: the enemy leader (leader two) is ${status}, your leader is not`, () => {
    const r = attack(PAYERS[type].id as string);
    expect(inst(r.state, r.two).statuses[status]).toBe(1);
    expect(inst(r.state, r.one).statuses[status]).toBe(0);
  });

  it("paid with [energy] only: the attack lands but nothing is applied", () => {
    const r = attack(ENERGY.id as string);
    expect(inst(r.state, r.two).damage).toBe(6);
    expect(inst(r.state, r.two).statuses[status]).toBe(0);
  });
});

describe("Recruited by Cap (56209): a minion engaged with you engages a player on the enemy team", () => {
  function recruit(withLieInWait: boolean) {
    const { state: start, deps } = game({ deckTwo: [MINION.id as string] });
    const { deckTwo } = leadersOf(start);
    let state = start;
    let lie: InstanceId | null = null;
    if (withLieInWait) {
      // p1 attaches Lie in Wait (13017) to its hero in p1's own hero phase: a real play, paid with one resource.
      const card = give(state, P1, LIE_IN_WAIT);
      const pay = give(card.state, P1, ENERGY.id as string);
      state = run(deps, pay.state, firstLegal, play(P1, card.id, [pay.id], identityOf(start, P1))).state;
      lie = card.id;
    }
    state = toResistance(deps, state);
    // A minion engaged with p2 (surgery: no reveal).
    const piles = state.encounterDecks[deckTwo]!;
    const minion = piles.deck.find((i) => state.instances[i]!.cardId === cardId(MINION.id as string))!;
    state = {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckTwo]: { ...piles, deck: piles.deck.filter((i) => i !== minion) },
      },
      players: state.players.map((p) => (p.playerId === P2 ? { ...p, playArea: [...p.playArea, minion] } : p)),
    };
    state = patch(state, minion, { engagedWith: P2, faceup: true });
    const given = hand(state, RECRUITED_BY_CAP, ENERGY.id as string, 3);
    const result = run(deps, given.state, acceptAll, play(P2, given.id, given.paid));
    return { ...result, minion, lie };
  }

  it("the minion moves from p2 to p1, the enemy team's player", () => {
    const r = recruit(false);
    expect(inst(r.state, r.minion).engagedWith).toBe(P1);
  });

  it("cross-turn (Q11): p1's Lie in Wait fires in p2's hero phase, 3 damage to the minion, and is discarded", () => {
    const r = recruit(true);
    expect(inst(r.state, r.minion).engagedWith).toBe(P1);
    expect(inst(r.state, r.minion).damage).toBe(3);
    expect(playerOf(r.state, P1).discard).toContain(r.lie);
  });
});

describe("The People's Hero (56210): after you spend it, your leader gets a facedown boost card", () => {
  const { state: start, deps } = game();
  const { one, two } = leadersOf(start);
  const turn = toResistance(deps, start);
  const { state } = spendResource(deps, turn, PEOPLES_HERO);

  it("leader one (your leader) holds one more facedown boost card; the enemy leader gets none", () => {
    expect(inst(state, one).boostCards.length - inst(turn, one).boostCards.length).toBe(1);
    expect(inst(state, two).boostCards.length).toBe(inst(turn, two).boostCards.length);
  });
});

describe("Double Agent (56211): remove 2 threat from the main scheme, place 2 on your leader's main scheme", () => {
  const { state: start, deps } = game();
  const { one: schemeOne, two: schemeTwo } = schemesOf(start);
  const turn = patch(toResistance(deps, start), schemeTwo, { threat: 5 });
  const given = hand(turn, DOUBLE_AGENT, ENERGY.id as string, 2);
  const { state } = run(deps, given.state, acceptAll, play(P2, given.id, given.paid));

  it("p2's main scheme (the resistance area's) loses 2 and leader one's main scheme gains 2", () => {
    expect(inst(state, schemeTwo).threat).toBe(3);
    expect(inst(state, schemeOne).threat - inst(turn, schemeOne).threat).toBe(2);
  });
});

describe("Hard to Hit (56213): attaches to your leader, tough on entry; after she attacks, 2 skill counters on Finesse", () => {
  const { state: start, deps } = game({ deckOne: [FINESSE.id as string] });
  const { one, two, deckOne } = leadersOf(start);
  const finesse = attachFromDeck(start, deckOne, FINESSE.id as string, one);
  const turn = toResistance(deps, finesse.state);
  const given = hand(turn, HARD_TO_HIT, ENERGY.id as string, 1);
  const played = run(deps, given.state, acceptAll, play(P2, given.id, given.paid, one));

  it("attaches to leader one (your leader) and gives it a tough status card", () => {
    expect(inst(played.state, given.id).attachedTo).toBe(one);
    expect(inst(played.state, one).statuses.tough).toBe(1);
    expect(inst(played.state, two).statuses.tough).toBe(0);
  });

  it("cross-turn (Q11): leader one attacks p1 in team one's villain phase, Finesse gets 2 skill counters, card discarded", () => {
    const { state, events } = run(deps, played.state, acceptAll, endTurn(P2));
    expect(
      events.some(
        (e) => e.type === "attackResolved" && e.enemyInstanceId === one && e.targetInstanceId === identityOf(state, P1),
      ),
    ).toBe(true);
    expect(inst(state, finesse.id).counters["skill"]).toBe(2);
    expect(resolved(events, "56213.hard-to-hit-forced-response")).toBe(1);
    expect(playerOf(state, P2).discard).toContain(given.id);
  });
});

describe("Secret Contact (56214): after you spend it, 2 skill counters on your leader's Finesse", () => {
  const { state: start, deps } = game({ deckOne: [FINESSE.id as string], deckTwo: [FINESSE.id as string] });
  const { one, two, deckOne, deckTwo } = leadersOf(start);
  const mine = attachFromDeck(start, deckOne, FINESSE.id as string, one);
  const enemys = attachFromDeck(mine.state, deckTwo, FINESSE.id as string, two);
  const turn = toResistance(deps, enemys.state);
  const { state } = spendResource(deps, turn, SECRET_CONTACT);

  it("the Finesse on leader one (your leader, the other team's area) gets 2, the enemy leader's none", () => {
    expect(inst(state, mine.id).counters["skill"]).toBe(2);
    expect(inst(state, enemys.id).counters["skill"] ?? 0).toBe(0);
  });
});
