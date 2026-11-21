/**
 * Competitive card audit, group 3 (docs/competitive-card-audit.md section 3): the Standard PvP cards in a real two-team
 * game (`./two-team.ts`), each distinct card once per printing: Civil War MC56 (registration 56125 to 56128, resistance
 * 56203 to 56206) and the Synthezoid Smackdown MC57 reprints (57036 to 57039, 57078 to 57081). Q15: identical in play.
 * Team one (p1) faces leader one in area one, team two (p2) leader two in area two; each team's villain phase reveals
 * from its own area's encounter deck.
 *
 * Sources: MC56 p. 6 (the enemy leader and the enemy team in a team game), p. 16 (a leader attacking a leader: one
 * boost card from the deck of the area the attacker sits in, no defender), pp. 16-17, 20 (scenario rules override RRG
 * per Golden Rule, RRG p. 4); the cards' printed text (data `cw` / `synthezoid`); RRG v1.8 "Search" p. 39 (shuffle the
 * searched deck on completion), "Boost" p. 11; owner decisions Q5, Q6, Q12, N1, N9, N10 of
 * docs/competitive-mode-plan.md section 1.10.
 */

import type { GameEvent, GameState, InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { inst, playerOf, use, type Picker } from "../../../../testing/harness.js";
import {
  P1,
  P2,
  acceptAll,
  boost,
  endTurn,
  give,
  leadersOf,
  patch,
  play,
  realCards,
  run,
  schemesOf,
  twoTeamGame,
  typedResource,
} from "./two-team.js";

vi.setConfig({ testTimeout: 120_000 });

/** Registration printings and resistance printings; any printing works for either team (Q15). */
const PRINTINGS = [
  { name: "MC56 registration", rc: "56125", wit: "56126", ts: "56127", cs: "56128a", nip: "56128b" },
  { name: "MC56 resistance", rc: "56203", wit: "56204", ts: "56205", cs: "56206a", nip: "56206b" },
  { name: "MC57 registration", rc: "57036", wit: "57037", ts: "57038", cs: "57039a", nip: "57039b" },
  { name: "MC57 resistance", rc: "57078", wit: "57079", ts: "57080", cs: "57081a", nip: "57081b" },
] as const;
const ALL = PRINTINGS.flatMap((p) => [p.rc, p.wit, p.ts, p.cs, p.nip]);

const NB = boost("nb", 0);
const ONE = boost("one", 1);
const THREE = boost("three", 3);
const TOP_A = boost("top-a", 0);
const TOP_B = boost("top-b", 0);
const TOP_C = boost("top-c", 0);
const BELOW = boost("below", 0);
const NB_ID = NB.id as string;
const BOOSTS = [ONE, THREE, TOP_A, TOP_B, TOP_C, BELOW];

function game(options: {
  sizes?: readonly [number, number];
  deckOne?: readonly string[];
  deckTwo?: readonly string[];
}) {
  return twoTeamGame({ ...options, filler: NB, extraCards: [...BOOSTS, ...realCards(...ALL)] });
}
type Game = ReturnType<typeof game>;

const asAlterEgo = (state: GameState, player: typeof P1 | typeof P2): GameState =>
  ({
    ...state,
    players: state.players.map((p) =>
      p.playerId === player ? { ...p, identity: { ...p.identity, form: "alterEgo" } } : p,
    ),
  }) as GameState;

/** Every player of both teams ends the turn; the round runs through both villain phases (team one's first). */
function round(g: Game, pick: Picker = acceptAll, state: GameState = g.state) {
  let current = state;
  const events: GameEvent[] = [];
  for (const player of current.players) {
    const r = run(g.deps, current, pick, endTurn(player.playerId));
    current = r.state;
    events.push(...r.events);
  }
  return { state: current, events };
}

const schemesOfLeader = (events: readonly GameEvent[], leader: InstanceId) =>
  events.flatMap((e) => (e.type === "schemeResolved" && e.enemyInstanceId === leader ? [e] : []));
const attacksOfLeader = (events: readonly GameEvent[], leader: InstanceId) =>
  events.flatMap((e) => (e.type === "attackResolved" && e.enemyInstanceId === leader ? [e] : []));

describe("Righteous Cause (56125, 56203, 57036, 57078): the enemy leader schemes; 2+ on your team, an extra boost card", () => {
  for (const p of PRINTINGS) {
    it(`${p.name}: 1v1: leader one schemes against p1 on its own scheme with one boost card`, () => {
      const g = game({ deckOne: [NB_ID, p.rc, "one", "one", "one"] });
      const { one } = leadersOf(g.state);
      const { one: schemeOne } = schemesOf(g.state);
      const { events } = round(g);
      // Hero form: leader one's activation is an attack; the card's scheme is its only scheme.
      const schemes = schemesOfLeader(events, one);
      expect(schemes).toHaveLength(1);
      expect(schemes[0]).toMatchObject({ schemeInstanceId: schemeOne, baseSch: 1, boostIcons: 1, threatPlaced: 2 });
    });
  }

  it("2v2: a team of two gets an additional boost card for the scheme (two 1-icon cards, SCH 1 + 2); the leader activates once per player first", () => {
    const g = game({ sizes: [2, 2], deckOne: [NB_ID, NB_ID, "56125", NB_ID, "one", "one", "one"] });
    const { one } = leadersOf(g.state);
    const schemes = schemesOfLeader(round(g).events, one);
    expect(schemes).toHaveLength(1);
    expect(schemes[0]).toMatchObject({ baseSch: 1, boostIcons: 2, threatPlaced: 3 });
  });

  it("revealed in team two's area, the enemy leader is leader two, scheming on team two's main scheme", () => {
    const g = game({ deckTwo: [NB_ID, "57078", "one", "one"] });
    const { one, two } = leadersOf(g.state);
    const { two: schemeTwo } = schemesOf(g.state);
    const { events } = round(g);
    expect(schemesOfLeader(events, one)).toHaveLength(0);
    const schemes = schemesOfLeader(events, two);
    expect(schemes).toHaveLength(1);
    expect(schemes[0]).toMatchObject({ schemeInstanceId: schemeTwo, boostIcons: 1 });
  });
});

describe("Whatever It Takes (56126, 56204, 57037, 57079): hero, the enemy leader attacks you; alter-ego, your leader", () => {
  for (const p of PRINTINGS) {
    it(`${p.name}, hero form: leader one attacks p1, once more than its own activation, and does not scheme`, () => {
      const g = game({ deckOne: [NB_ID, p.wit, NB_ID, NB_ID] });
      const { one } = leadersOf(g.state);
      const { events } = round(g);
      const attacks = attacksOfLeader(events, one);
      expect(attacks).toHaveLength(2);
      expect(new Set(attacks.map((a) => a.targetInstanceId))).toEqual(
        new Set([playerOf(g.state, P1).identity.instanceId]),
      );
      expect(schemesOfLeader(events, one)).toHaveLength(0);
    });

    it(`${p.name}, alter-ego form: leader one attacks leader two (no defender), one boost card from area one's deck`, () => {
      const g = game({ deckOne: [NB_ID, p.wit, "three", NB_ID, NB_ID] });
      const start = asAlterEgo(g.state, P1);
      const { one, two } = leadersOf(start);
      const { events, state } = round(g, acceptAll, start);
      const hit = events.filter(
        (e) => e.type === "enemyAttackedEnemy" && e.attackerInstanceId === one && e.targetInstanceId === two,
      );
      expect(hit).toHaveLength(1);
      expect(events.some((e) => e.type === "defenderDeclared")).toBe(false);
      // ATK 2 plus the 3-icon boost card taken from leader one's own deck (the attacker's area).
      expect(inst(state, two).damage).toBe(5);
      expect(attacksOfLeader(events, one)).toHaveLength(0);
    });
  }
});

/** A picker that answers a chooseCards prompt with the cards of these codes, and everything else by `acceptAll`. */
function pickCodes(
  codes: readonly string[],
  seen: { prompts: { player: string; authority: unknown; codes: string[] }[] },
): Picker {
  return (s) => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind !== "chooseCards") return acceptAll(s);
    const codeOf = (o: (typeof choice.options)[number]) =>
      o.ref.kind === "card" ? (s.instances[o.ref.instanceId]!.cardId as string) : "";
    seen.prompts.push({
      player: choice.playerId as string,
      authority: choice.authority,
      codes: choice.options.map(codeOf),
    });
    const wanted = codes[seen.prompts.length - 1]!;
    return [choice.options.find((o) => codeOf(o) === wanted)!.optionId as string];
  };
}

describe("Targeted Strike (56127, 56205, 57038, 57080): the enemy team deals you one of the top 5; Boost: per player on your team", () => {
  for (const p of PRINTINGS) {
    it(`${p.name}: p2 (the enemy team's first player) searches the top 5 of deck one, p1 is dealt the pick; deck one shuffles`, () => {
      const g = game({
        deckOne: [NB_ID, p.ts, "top-a", "top-b", "top-c", "one", "three", "below"],
      });
      const { deckOne, deckTwo } = leadersOf(g.state);
      const seen = { prompts: [] as { player: string; authority: unknown; codes: string[] }[] };
      const { events, state } = round(g, pickCodes(["top-b"], seen));
      expect(seen.prompts).toHaveLength(1);
      expect(seen.prompts[0]).toMatchObject({ player: "p2", authority: "enemyTeam" });
      // Exactly the top five of the encounter deck, not the sixth card down.
      expect(seen.prompts[0]!.codes.sort()).toEqual(["one", "three", "top-a", "top-b", "top-c"]);
      const dealt = events.flatMap((e) => (e.type === "encounterCardDealt" && e.source !== undefined ? [e] : []));
      const pick = dealt.find((e) => inst(state, e.instanceId).cardId === "top-b");
      expect(pick?.playerId).toBe(P1);
      const shuffled = events.flatMap((e) =>
        e.type === "deckShuffled" && e.zone.kind === "encounterDeck" ? [e.zone.deckId as string] : [],
      );
      expect(shuffled).toContain(deckOne as string);
      expect(shuffled).not.toContain(deckTwo as string);
    });
  }

  it("Boost: the card gains one icon for each player on the activating leader's team (1 on a team of one, 2 on two)", () => {
    for (const [sizes, expected] of [
      [[1, 1], 1],
      [[2, 1], 2],
    ] as const) {
      const g = game({ sizes, deckOne: ["57038", NB_ID, NB_ID, NB_ID], deckTwo: [] });
      const { one } = leadersOf(g.state);
      const { events } = round(g);
      expect(attacksOfLeader(events, one)[0], `sizes ${sizes}`).toMatchObject({ boostIcons: expected });
    }
  });
});

const FOUR = boost("four", 4);
const SMASH = "57033";
const FIGHTING_DIRTY = "56208";
const ENERGY = typedResource("res-energy", "energy");
const SEAT_RESOURCES = [1, 2, 3, 4, 5, 6].map(() => ENERGY.id as string);

type Prompts = { player: string; authority: unknown; codes: string[] }[];

/** Two teams with Choosing Sides' `code` revealed from deck one in team one's villain phase (it joins area one). */
function choosingSidesGame(code: string, options: Parameters<typeof game>[0] = {}) {
  const padding = options.sizes?.[0] === 2 ? [NB_ID] : [];
  return twoTeamGame({
    ...options,
    filler: NB,
    extraCards: [...BOOSTS, FOUR, ENERGY, ...realCards(...ALL, SMASH, FIGHTING_DIRTY)],
    // A second seat on team one is dealt the card after Choosing Sides, so one more filler goes under it.
    deckOne: [NB_ID, ...padding, code, ...padding, ...(options.deckOne ?? [])],
    deckTwo: options.deckTwo ?? [],
    seatCards: [SMASH, FIGHTING_DIRTY, ...SEAT_RESOURCES],
  });
}

/** Gives `player` `code` and two energy resources to pay for it (surgery); the paying resources are returned. */
function handWithPayment(state: GameState, player: typeof P1 | typeof P2, code: string) {
  const card = give(state, player, code);
  const first = give(card.state, player, ENERGY.id as string);
  const second = give(first.state, player, ENERGY.id as string, [first.id]);
  return { state: second.state, id: card.id, paid: [first.id, second.id] };
}

describe("Choosing Sides (56128a, 56206a, 57039a, 57081a): the enemy leader takes at most 2 from each attack", () => {
  for (const p of PRINTINGS) {
    it(`${p.name}: joins area one; a 6-damage leader attack on leader one deals 2, on leader two all 6`, () => {
      const g = choosingSidesGame(p.cs, { deckOne: ["four"], deckTwo: [NB_ID, NB_ID, "four"] });
      const { one, two } = leadersOf(g.state);
      const afterRound = round(g).state;
      expect(afterRound.gameAreas[0]!.sideSchemeIds).toHaveLength(1);
      expect(afterRound.gameAreas[1]!.sideSchemeIds).toHaveLength(0);
      // p1: She-Hulk Smash, leader two attacks leader one (the enemy leader Choosing Sides names): 2 + 4, capped at 2.
      const smash = handWithPayment(afterRound, P1, SMASH);
      const capped = run(g.deps, smash.state, acceptAll, play(P1, smash.id, smash.paid));
      expect(inst(capped.state, one).damage).toBe(2);
      // p2: Fighting Dirty, leader one attacks leader two (team two's enemy leader, not Choosing Sides'): 2 + 4.
      const turn = run(g.deps, capped.state, acceptAll, endTurn(P1)).state;
      const dirty = handWithPayment(turn, P2, FIGHTING_DIRTY);
      const open = run(g.deps, dirty.state, acceptAll, play(P2, dirty.id, dirty.paid));
      expect(inst(open.state, two).damage).toBe(6);
    });
  }
});

/** The Choosing Sides of area one, after the round that revealed it, with its threat set to 1. */
function readyToClear(g: Game) {
  const afterRound = round(g).state;
  const [cs] = afterRound.gameAreas[0]!.sideSchemeIds;
  return { state: patch(afterRound, cs!, { threat: 1 }), cs: cs! };
}

const thwartBy = (state: GameState, player: typeof P1 | typeof P2, scheme: InstanceId) =>
  ({
    type: "basicThwart",
    playerId: player,
    thwarterInstanceId: playerOf(state, player).identity.instanceId,
    schemeInstanceId: scheme,
  }) as never;

describe("Choosing Sides' Forced Response: cleared, the enemy team deals 1 per hero of the top 5, then flip", () => {
  for (const p of PRINTINGS) {
    it(`${p.name} 1v1: p2 (enemy team) picks one of the top 5 of deck one for p1, deck one shuffles, the card flips`, () => {
      const g = choosingSidesGame(p.cs, { deckOne: ["top-a", "top-b", "top-c", "one", "three", "below"] });
      const { deckOne } = leadersOf(g.state);
      const { state, cs } = readyToClear(g);
      const seen = { prompts: [] as Prompts };
      const r = run(g.deps, state, pickCodes(["top-c"], seen), thwartBy(state, P1, cs));
      expect(seen.prompts).toHaveLength(1);
      expect(seen.prompts[0]).toMatchObject({ player: "p2", authority: "enemyTeam" });
      expect(seen.prompts[0]!.codes.sort()).toEqual(["one", "three", "top-a", "top-b", "top-c"]);
      const dealt = playerOf(r.state, P1).dealtEncounter;
      expect(dealt.map((i) => inst(r.state, i).cardId)).toEqual(["top-c"]);
      expect(inst(r.state, dealt[0]!).faceup).toBe(false);
      expect(
        r.events.some((e) => e.type === "deckShuffled" && e.zone.kind === "encounterDeck" && e.zone.deckId === deckOne),
      ).toBe(true);
      // The card flipped to its Now It's Personal face and left the scheme list.
      expect(r.state.gameAreas[0]!.sideSchemeIds).not.toContain(cs);
      expect(inst(r.state, cs).cardId).toBe(p.nip);
    });

    // BUG (engine, `relocate` in packages/engine/src/resolve/other-face.ts): a flip to an obligation face falls to the
    // default case, so Now It's Personal stays in the villain area under nobody's control instead of going to the first
    // player ("Give to the first player", MC56 p. 16; the script's `flipCard(self, { controller: firstPlayer })`).
    it.fails(`${p.name} 1v1: the flipped card is given to the first player of the team (p1 controls it, in their play area)`, () => {
      const g = choosingSidesGame(p.cs, { deckOne: ["top-a", "top-b", "top-c", "one", "three", "below"] });
      const { state, cs } = readyToClear(g);
      const r = run(g.deps, state, pickCodes(["top-c"], { prompts: [] }), thwartBy(state, P1, cs));
      expect(inst(r.state, cs).controllerId).toBe(P1);
      expect(playerOf(r.state, P1).playArea).toContain(cs);
    });
  }

  it("2v2: two heroes on the team, so two picks (top 5, then the 4 left), dealt to p1 and p2 in turn", () => {
    const g = choosingSidesGame("56128a", {
      sizes: [2, 2],
      deckOne: ["top-a", "top-b", "top-c", "one", "three", "below"],
    });
    const { state, cs } = readyToClear(g);
    const seen = { prompts: [] as Prompts };
    const actor = (state.step as unknown as { activePlayerId: typeof P1 }).activePlayerId;
    const r = run(g.deps, state, pickCodes(["top-c", "one"], seen), thwartBy(state, actor, cs));
    expect(seen.prompts).toHaveLength(2);
    expect(seen.prompts.map((q) => q.player)).toEqual(["p3", "p3"]);
    expect(seen.prompts[0]!.codes.sort()).toEqual(["one", "three", "top-a", "top-b", "top-c"]);
    expect(seen.prompts[1]!.codes.sort()).toEqual(["one", "three", "top-a", "top-b"]);
    const held = (player: typeof P1) =>
      playerOf(r.state, player).dealtEncounter.map((i) => inst(r.state, i).cardId as string);
    expect([...held(P1), ...held(P2)].sort()).toEqual(["one", "top-c"]);
    expect(held(P1)).toHaveLength(1);
    expect(held(P2)).toHaveLength(1);
  });
});

describe("Now It's Personal (56128b, 56206b, 57039b, 57081b): used, gives the team's players 2 leader cards each", () => {
  for (const p of PRINTINGS) {
    // After the real flip (the card sits in the villain area, see the bug above) the Action still resolves for p1.
    it(`${p.name}: after Choosing Sides is cleared, p1 uses it: removed from the game, 2 of team one's leader cards in hand`, () => {
      const g = choosingSidesGame(p.cs, { deckOne: ["top-a", "top-b", "top-c", "one", "three", "below"] });
      const { state, cs } = readyToClear(g);
      const cleared = run(g.deps, state, pickCodes(["top-c"], { prompts: [] }), thwartBy(state, P1, cs)).state;
      const r = run(g.deps, cleared, acceptAll, use(P1, cs, `${p.nip}.now-its-personal-action`));
      expect(r.state.removedFromGame).toContain(cs);
      const earned = playerOf(r.state, P1).hand.filter((i) =>
        (inst(r.state, i).cardId as string).startsWith("registration-card-"),
      );
      expect(earned).toHaveLength(2);
    });
  }
});
