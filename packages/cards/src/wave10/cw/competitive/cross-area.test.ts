/**
 * Cross-area cards in a real two-team game (docs/competitive-mode-plan.md milestone M3): each card's script played on
 * the engine's competitive fixture (`packages/engine/src/testing/team.ts`), where the registration team (p1) faces
 * leader one in its area and the resistance team (p2) faces leader two in the other. So for p1 "the enemy leader" is
 * leader one and "your leader" is leader two, and the other way round for p2.
 *
 * Sources: MC56 pp. 16-17, 20 (scenario rules override RRG per Golden Rule, RRG p. 4); the rules expert's readings of
 * 2026-11-20 (a minion attacking a leader gets a boost card only if villainous, RRG v1.8 Attack (Enemy Activation)
 * p. 8 step 1; a "would" interrupt resolves before the attack initiates, RRG v1.8 Interrupt p. 24); N1, N5, Q5, Q6, Q17
 * per owner decision 2026-11-20.
 */

import { cardId, type AnyCard, type CardId } from "@mc/content";
import {
  cardsInPlay,
  type AbilityDefinition,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { firstLegal, inst, playerOf, type Picker } from "../../../testing/harness.js";
import { driveEventsPicking } from "../../../testing/staging.js";
import { WAVE10_CARDS } from "../../cards.js";
import { WAVE10_DEPS } from "../../testing.js";

vi.setConfig({ testTimeout: 120_000 });

const ENGINE_TESTING = new URL("../../../../../engine/src/testing/", import.meta.url).href;
interface Fixture {
  readonly competitiveGame: (options?: {
    readonly sizes?: readonly [number, number];
    readonly deps?: EngineDeps;
    readonly extraCards?: readonly AnyCard[];
    readonly encounterDecks?: readonly [readonly CardId[], readonly CardId[]];
    readonly deck?: readonly CardId[];
  }) => GameState;
}
interface Fixtures {
  readonly stubTreachery: (spec: { id: string; boostIcons?: number }) => AnyCard;
  readonly stubAttachment: (spec: {
    id: string;
    name?: string;
    attachesTo?: unknown;
    keywords?: readonly { name: string }[];
  }) => AnyCard;
  readonly stubEvent: (spec: { id: string; cost?: number; abilities?: readonly { id: string }[] }) => AnyCard;
  readonly stubSupport: (spec: { id: string; cost: number; abilities?: readonly { id: string }[] }) => AnyCard;
}
interface Scenario {
  readonly DEFAULT_DECK: readonly CardId[];
  readonly ALLY: AnyCard;
  readonly UPGRADE: AnyCard;
}
const { competitiveGame } = (await import(/* @vite-ignore */ `${ENGINE_TESTING}team.ts`)) as Fixture;
const { stubTreachery, stubAttachment, stubEvent, stubSupport } = (await import(
  /* @vite-ignore */ `${ENGINE_TESTING}fixtures.ts`
)) as Fixtures;
const { DEFAULT_DECK, ALLY, UPGRADE } = (await import(/* @vite-ignore */ `${ENGINE_TESTING}scenario.ts`)) as Scenario;

const P1 = "p1" as PlayerId;
const P2 = "p2" as PlayerId;

const PROVOKED_RESPONSE = "56133";
const NO_YOU_MOVE = "56207";
const THE_FUTURIST = "56129";
const VENOM = "56087";
const IRON_FIST = "56190";
const EXCESSIVE_FORCE = "56090";
const DRAFTED = "56080";
const BULLSEYE = "56088";
const NEIGHBORHOOD_HERO = "56183";
const SWITCHING_SIDES = "56158";
const CLOAK = "56194";
const DARKFORCE = "56196";
const TASKMASTER = "57022";
const MIMICKED_MOVE = "57025";

/** A boost filler with 4 icons, so a leader's attack (ATK 2) deals 6. */
const BIG_BOOST = stubTreachery({ id: "big-boost", boostIcons: 4 });
/** A boost filler with no icons. */
const NO_BOOST = stubTreachery({ id: "no-boost", boostIcons: 0 });
/** "Cap's Shield" stand-in: a card of that title that can attach to any card, so it may go onto a stub leader. */
const SHIELD = stubAttachment({ id: "shield", name: "Cap's Shield", attachesTo: { kind: "anyCard" } });
const PLAIN_ATTACHMENT = stubAttachment({ id: "plain-attachment", attachesTo: { kind: "anyCard" } });
const PERMANENT_ATTACHMENT = stubAttachment({
  id: "permanent-attachment",
  attachesTo: { kind: "anyCard" },
  keywords: [{ name: "permanent" }],
});
/** "Defeat that card." for a test to end a card's time in play by the engine's own pipeline. */
const DEFEAT: AbilityDefinition = {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "chooseTarget",
      slot: "x",
      query: { categories: ["ally", "minion"], anyGameArea: true },
      chooser: { kind: "controller" },
    },
    { kind: "defeat", target: { kind: "slot", slot: "x" } },
  ],
} as never;
const DEFEATER = stubEvent({ id: "defeater", cost: 0, abilities: [{ id: "defeater.action" }] });

const REAL: readonly AnyCard[] = WAVE10_CARDS;

/**
 * Stand-ins carrying a real card's ability, one in each seat's play area, to count where and when it resolves: Public
 * Outrage 56122b (Protect Secret Identities 57044b reuses it), Superhero Jailbreak 56202b, Vision's flip 57040, Cut Off
 * Support 56063b (Open Rebellion 56172b is the same definition), Tigra's On the Hunt 56001a.
 */
const CARRIED = {
  outrage: "56122b.public-outrage-forced-response",
  jailbreak: "56202b.superhero-jailbreak-forced-response",
  vision: "57040.vision-forced-response",
  cutOff: "56063b.cut-off-support-forced-interrupt",
  hunt: "56001a.on-the-hunt",
} as const;
const CARRIERS = Object.entries(CARRIED).map(([key, ref]) =>
  stubSupport({ id: `carrier-${key}`, cost: 0, abilities: [{ id: ref }] }),
);
const ASSESS = stubEvent({ id: "assess", cost: 0, abilities: [{ id: "56053.assess-the-situation-action" }] });

const real = (...codes: readonly string[]): readonly AnyCard[] =>
  codes.map((code) => REAL.find((card) => (card.id as string) === code)!);

const deps: EngineDeps = {
  ...WAVE10_DEPS,
  abilities: {
    ...WAVE10_DEPS.abilities,
    "defeater.action": DEFEAT,
  },
};

interface Options {
  readonly deckOne?: readonly string[];
  readonly deckTwo?: readonly string[];
  readonly hand?: readonly string[];
}
const fill = (cards: readonly string[], filler = NO_BOOST.id as string): CardId[] =>
  [...cards, ...Array.from({ length: 12 }, () => filler)].map((code) => cardId(code));

const EXTRA = [
  BIG_BOOST,
  NO_BOOST,
  SHIELD,
  PLAIN_ATTACHMENT,
  PERMANENT_ATTACHMENT,
  DEFEATER,
  ...CARRIERS,
  ASSESS,
  ...real(
    PROVOKED_RESPONSE,
    NO_YOU_MOVE,
    THE_FUTURIST,
    VENOM,
    IRON_FIST,
    EXCESSIVE_FORCE,
    DRAFTED,
    BULLSEYE,
    NEIGHBORHOOD_HERO,
    SWITCHING_SIDES,
    CLOAK,
    DARKFORCE,
    TASKMASTER,
    MIMICKED_MOVE,
  ),
];

/** The two-team fixture with these encounter decks (top first) and every seat's deck holding these cards. */
function game(options: Options = {}): GameState {
  const hand = options.hand ?? [];
  const state = competitiveGame({
    deps,
    extraCards: EXTRA,
    encounterDecks: [fill(options.deckOne ?? []), fill(options.deckTwo ?? [])],
    deck: [...DEFAULT_DECK, ...hand.map((code) => cardId(code)), cardId(DEFEATER.id), cardId(DEFEATER.id)],
  });
  // Each encounter deck in the listed order (setup shuffled it).
  const ordered = (deckId: string, codes: readonly string[]) => {
    const piles = state.encounterDecks[deckId]!;
    const ids: InstanceId[] = [];
    for (const code of codes) {
      const id = piles.deck.find((i) => state.instances[i]!.cardId === cardId(code) && !ids.includes(i));
      if (id) ids.push(id);
    }
    return { ...piles, deck: [...ids, ...piles.deck.filter((i) => !ids.includes(i))] };
  };
  const [one, two] = state.villains;
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [one!.encounterDeckId]: ordered(one!.encounterDeckId, options.deckOne ?? []),
      [two!.encounterDeckId]: ordered(two!.encounterDeckId, options.deckTwo ?? []),
    },
  };
}

const leaders = (state: GameState) => {
  const [one, two] = state.villains;
  return { one: one!.instanceId, two: two!.instanceId, deckOne: one!.encounterDeckId, deckTwo: two!.encounterDeckId };
};
/** The main scheme of each team's area: team one's (leader one's), then team two's. */
const schemes = (state: GameState) => {
  const all = [state.mainScheme, ...(state.extraMainSchemes ?? [])];
  const of = (area: (typeof state.gameAreas)[number]) =>
    (area.mainScheme ?? all.find((scheme) => scheme.gameAreaId === area.areaId))!.instanceId;
  return { one: of(state.gameAreas[0]!), two: of(state.gameAreas[1]!) };
};

/** Both seats in hero form, or `p1` in alter-ego form when `p1AlterEgo`. */
function forms(state: GameState, p1AlterEgo = false): GameState {
  return {
    ...state,
    players: state.players.map((p) => ({
      ...p,
      identity: { ...p.identity, form: p.playerId === P1 && p1AlterEgo ? "alterEgo" : "hero" },
    })),
  } as GameState;
}

/** Moves a card from a seat's deck, hand or discard into their play area, under their control (surgery). */
function intoPlay(state: GameState, player: PlayerId, code: string): { state: GameState; id: InstanceId } {
  const seat = playerOf(state, player);
  const id = [...seat.hand, ...seat.deck, ...seat.discard].find((i) => state.instances[i]!.cardId === cardId(code))!;
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === player
          ? {
              ...p,
              hand: p.hand.filter((i) => i !== id),
              deck: p.deck.filter((i) => i !== id),
              discard: p.discard.filter((i) => i !== id),
              playArea: [...p.playArea, id],
            }
          : p,
      ),
      instances: { ...state.instances, [id]: { ...state.instances[id]!, controllerId: player, faceup: true } },
    },
  };
}

/** Takes an encounter card out of encounter deck `deckId` (surgery). */
function takeEncounter(state: GameState, deckId: string, code: string): { state: GameState; id: InstanceId } {
  const piles = state.encounterDecks[deckId]!;
  const id = piles.deck.find((i) => state.instances[i]!.cardId === cardId(code));
  if (!id) throw new Error(`no ${code} in encounter deck ${deckId}`);
  return {
    id,
    state: {
      ...state,
      encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck: piles.deck.filter((i) => i !== id) } },
    },
  };
}

/** A minion from deck `deckId`, engaged with `player` (surgery: no reveal). */
function engaged(state: GameState, deckId: string, code: string, player: PlayerId) {
  const taken = takeEncounter(state, deckId, code);
  const s = taken.state;
  return {
    id: taken.id,
    state: {
      ...s,
      players: s.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, taken.id] } : p)),
      instances: { ...s.instances, [taken.id]: { ...s.instances[taken.id]!, engagedWith: player, faceup: true } },
    },
  };
}

/** Attaches the card `id` (out of play) to `host` (surgery). */
function attached(state: GameState, id: InstanceId, host: InstanceId): GameState {
  return {
    ...state,
    instances: {
      ...state.instances,
      [id]: { ...state.instances[id]!, attachedTo: host, faceup: true },
      [host]: { ...state.instances[host]!, attachments: [...state.instances[host]!.attachments, id] },
    },
  };
}

/** Accepts optional triggers, pays a spend with everything offered, otherwise the first legal option. */
const payAll: Picker = (s) => {
  const choice = s.pendingChoice!;
  if (choice.prompt.kind === "spendResources") return choice.options.map((o) => o.optionId as string);
  if (choice.prompt.kind === "chooseTriggers") return choice.options.map((o) => o.optionId as string);
  return firstLegal(s);
};

/** Plays the rest of the round: p1 ends its turn, p2 ends its turn, both villain phases. */
function round(state: GameState, pick: Picker = firstLegal) {
  return driveEventsPicking(deps, state, pick, { type: "endTurn", playerId: P1 }, { type: "endTurn", playerId: P2 });
}

/** Events of team one's villain phase only (up to the switch to team two's villain phase). */
function teamOneVillainPhase(events: readonly GameEvent[]): readonly GameEvent[] {
  const start = events.findIndex((e) => e.type === "activeTeamChanged" && e.phase === "villain");
  const end = events.findIndex((e, i) => i > start && e.type === "activeTeamChanged");
  return events.slice(start, end < 0 ? undefined : end);
}

const boostsDealtTo = (events: readonly GameEvent[], enemy: InstanceId) =>
  events.filter((e) => e.type === "boostCardDealt" && e.enemyInstanceId === enemy);

const playCard = (state: GameState, player: PlayerId, code: string, pick: Picker = firstLegal, cost = 0) => {
  const seat = playerOf(state, player);
  const id = [...seat.hand, ...seat.deck].find((i) => state.instances[i]!.cardId === cardId(code))!;
  const inHand: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player
        ? { ...p, deck: p.deck.filter((i) => i !== id), hand: [...p.hand.filter((i) => i !== id), id] }
        : p,
    ),
  };
  const others = playerOf(inHand, player).hand.filter((i) => i !== id);
  return driveEventsPicking(deps, inHand, pick, {
    type: "playCard",
    playerId: player,
    cardInstanceId: id,
    payment: (cost > 0 ? others : []).map((i) => ({ fromHand: i })),
    attachToInstanceId: null,
  } as never);
};

describe("Provoked Response (56133): the enemy leader's attack on you goes to your leader, at most 3 damage", () => {
  const start = forms(game({ hand: [PROVOKED_RESPONSE], deckOne: [BIG_BOOST.id] }));
  const placed = intoPlay(start, P1, PROVOKED_RESPONSE);
  const { state, events } = round(placed.state);
  const { one, two, deckOne } = leaders(state);
  const phase = teamOneVillainPhase(events);

  it("leader one attacks leader two instead, and leader two takes 3 of the 6 (ATK 2 + 4 boost icons)", () => {
    expect(
      phase.some((e) => e.type === "enemyAttackedEnemy" && e.attackerInstanceId === one && e.targetInstanceId === two),
    ).toBe(true);
    expect(inst(state, two).damage).toBe(3);
    expect(phase.some((e) => e.type === "damagePrevented" && e.targetInstanceId === two && e.amount === 3)).toBe(true);
  });

  it("deals no damage to you, deals exactly one boost card, from the deck of the leader's area, and is discarded", () => {
    expect(inst(state, playerOf(state, P1).identity.instanceId).damage).toBe(0);
    const dealt = boostsDealtTo(phase, one);
    expect(dealt).toHaveLength(1);
    expect(state.encounterDecks[deckOne]!.discard).toContain((dealt[0] as { instanceId: InstanceId }).instanceId);
    expect(playerOf(state, P1).discard).toContain(placed.id);
  });

  it("the cap is for that attack alone: no lasting rule is left", () => {
    expect(state.lastingEffects.filter((e) => JSON.stringify(e).includes("maxDamageTakenPerAttack"))).toEqual([]);
  });
});

describe("No, You Move! (56207): Cap's Shield goes to your leader, who takes the attack, with one boost card", () => {
  const start = forms(game({ hand: [NO_YOU_MOVE], deckOne: [BIG_BOOST.id], deckTwo: [SHIELD.id] }));
  const placed = intoPlay(start, P1, NO_YOU_MOVE);
  const shield = takeEncounter(placed.state, leaders(start).deckTwo, SHIELD.id);
  const staged = attached(shield.state, shield.id, playerOf(start, P2).identity.instanceId);
  const { state, events } = round(staged);
  const { one, two } = leaders(state);
  const phase = teamOneVillainPhase(events);

  it("moves the Shield from the other side of the table onto your leader", () => {
    expect(inst(state, shield.id).attachedTo).toBe(two);
  });

  it("leader two takes the attack (ATK 2 + 4), you take none, and one boost card was dealt", () => {
    expect(inst(state, two).damage).toBe(6);
    expect(inst(state, playerOf(state, P1).identity.instanceId).damage).toBe(0);
    expect(boostsDealtTo(phase, one)).toHaveLength(1);
    expect(JSON.stringify(phase)).toContain(`"boostPlayerId":"${P1}"`);
  });
});

describe("The Futurist (56129): your leader schemes across the table, with no boost card", () => {
  const start = game({ hand: [THE_FUTURIST] });
  const { one: schemeOne, two: schemeTwo } = schemes(start);
  const { state, events } = playCard(start, P1, THE_FUTURIST, firstLegal, 2);
  const { two } = leaders(state);

  it("places leader two's SCH on the main scheme of its own area, and none on yours", () => {
    expect(inst(state, schemeTwo).threat - inst(start, schemeTwo).threat).toBe(1);
    expect(inst(state, schemeOne).threat).toBe(inst(start, schemeOne).threat);
    expect(events.some((e) => e.type === "schemeResolved" && e.enemyInstanceId === two)).toBe(true);
  });

  it("deals it no boost card", () => {
    expect(boostsDealtTo(events, two)).toEqual([]);
  });
});

describe.each([
  ["Venom (56087)", VENOM],
  ["Iron Fist (56190)", IRON_FIST],
])("%s attacks your leader with no boost card (not villainous)", (_name, code) => {
  // p1 in alter-ego form, so leader one schemes; then Venom/Iron Fist is dealt to p1 and revealed.
  const start = forms(game({ deckOne: [NO_BOOST.id, code] }), true);
  const { state, events } = round(start);
  const { two } = leaders(state);
  const minion = Object.values(state.instances).find((i) => i.cardId === cardId(code))!.instanceId;

  it("deals leader two its ATK (3), and gives the minion no boost card", () => {
    expect(
      events.some(
        (e) => e.type === "enemyAttackedEnemy" && e.attackerInstanceId === minion && e.targetInstanceId === two,
      ),
    ).toBe(true);
    expect(inst(state, two).damage).toBe(3);
    expect(boostsDealtTo(events, minion)).toEqual([]);
  });
});

describe.each([
  ["Venom (56087)", VENOM],
  ["Iron Fist (56190)", IRON_FIST],
])("%s with your leader out of play: Otherwise, it activates against you (as Provoked Response)", (_name, code) => {
  // Leader two has left play (defeated in a villain phase, MC56 p. 17): "your leader" names no card in play.
  const fresh = forms(game({ deckOne: [NO_BOOST.id, code] }), true);
  const gone = leaders(fresh).two;
  const start: GameState = {
    ...fresh,
    villains: fresh.villains.map((v) => (v.instanceId === gone ? { ...v, defeated: true } : v)),
  };
  const { events } = round(start);
  const minion = Object.values(start.instances).find((i) => i.cardId === cardId(code))!.instanceId;

  it("makes no attack on a leader, and activates against p1 (in alter-ego form: it schemes)", () => {
    expect(events.some((e) => e.type === "enemyAttackedEnemy" && e.attackerInstanceId === minion)).toBe(false);
    expect(events).toContainEqual(expect.objectContaining({ type: "schemeResolved", enemyInstanceId: minion }));
  });
});

describe("Taskmaster (57022) under Mimicked Move (57025): a villainous minion's attack on your leader gets one boost card", () => {
  // Boost cards for leader one's and Taskmaster's schemes, Mimicked Move dealt to p1, then the attack's boost card.
  const start = forms(game({ deckOne: [NO_BOOST.id, NO_BOOST.id, MIMICKED_MOVE, BIG_BOOST.id, TASKMASTER] }), true);
  const taskmaster = engaged(start, leaders(start).deckOne, TASKMASTER, P1);
  const { state, events } = round(taskmaster.state);
  const { two, deckOne } = leaders(state);
  const phase = teamOneVillainPhase(events);

  it("deals Taskmaster one boost card from the deck of his area, turned by your team's first player", () => {
    // From Mimicked Move's reveal on (his own scheme activation in step 2 had its boost card too).
    const reveal = phase.findIndex((e) => e.type === "encounterCardRevealed" && e.cardId === cardId(MIMICKED_MOVE));
    expect(reveal).toBeGreaterThan(0);
    const dealt = boostsDealtTo(phase.slice(reveal), taskmaster.id);
    expect(dealt).toHaveLength(1);
    expect(state.encounterDecks[deckOne]!.discard).toContain((dealt[0] as { instanceId: InstanceId }).instanceId);
    expect(
      phase.some(
        (e) => e.type === "enemyAttackedEnemy" && e.attackerInstanceId === taskmaster.id && e.targetInstanceId === two,
      ),
    ).toBe(true);
    expect(JSON.stringify(phase)).toContain(`"boostPlayerId":"${P1}"`);
  });
});

describe("Excessive Force (56090) as a boost card: the enemy leader then attacks your leader with no boost card", () => {
  const start = forms(game({ deckOne: [EXCESSIVE_FORCE] }));
  const { state, events } = round(start);
  const { one, two } = leaders(state);
  const phase = teamOneVillainPhase(events);

  it("leader one attacks leader two for its ATK alone, and only the attack on you was dealt a boost card", () => {
    expect(
      phase.some((e) => e.type === "enemyAttackedEnemy" && e.attackerInstanceId === one && e.targetInstanceId === two),
    ).toBe(true);
    expect(inst(state, two).damage).toBe(2);
    expect(boostsDealtTo(phase, one)).toHaveLength(1);
  });
});

describe("Drafted (56080)", () => {
  it("the enemy team attaches it to a minion engaged with them, and that minion engages you", () => {
    const start = forms(game({ deckOne: [NO_BOOST.id, DRAFTED], deckTwo: [VENOM, IRON_FIST] }), true);
    const minion = engaged(start, leaders(start).deckTwo, VENOM, P2);
    const other = engaged(minion.state, leaders(start).deckTwo, IRON_FIST, P2);
    const asked: string[] = [];
    const pick: Picker = (s) => {
      if (s.pendingChoice?.authority === "enemyTeam") asked.push(s.pendingChoice.playerId);
      return firstLegal(s);
    };
    const { state } = round(other.state, pick);
    // Two minions engaged with p2: the enemy team's first player chooses (N1).
    expect(asked).toContain(P2);
    expect(inst(state, minion.id).engagedWith).toBe(P1);
    expect(playerOf(state, P1).playArea).toContain(minion.id);
    const drafted = Object.values(state.instances).find((i) => i.cardId === cardId(DRAFTED))!;
    expect(drafted.attachedTo).toBe(minion.id);
  });

  it("with no minion engaged with the enemy team, Otherwise: discards until a minion and attaches to it", () => {
    const start = forms(game({ deckOne: [NO_BOOST.id, DRAFTED, NO_BOOST.id, CLOAK] }), true);
    const { state } = round(start);
    const cloak = Object.values(state.instances).find((i) => i.cardId === cardId(CLOAK))!;
    const drafted = Object.values(state.instances).find((i) => i.cardId === cardId(DRAFTED))!;
    expect(drafted.attachedTo).toBe(cloak.instanceId);
  });

  it("a drafted minion defeated goes to the discard pile of the deck it came from", () => {
    const start = forms(game({ deckOne: [NO_BOOST.id, DRAFTED], deckTwo: [VENOM] }), true);
    const minion = engaged(start, leaders(start).deckTwo, VENOM, P2);
    const drafted = round(minion.state).state;
    // Next round, p1 defeats it.
    const { state } = playCard(drafted, P1, DEFEATER.id, (s) =>
      s.pendingChoice?.options.some((o) => o.optionId === minion.id) ? [minion.id] : firstLegal(s),
    );
    const { deckOne, deckTwo } = leaders(state);
    expect(cardsInPlay(state)).not.toContain(minion.id);
    expect(state.encounterDecks[deckTwo]!.discard).toContain(minion.id);
    expect(state.encounterDecks[deckOne]!.discard).not.toContain(minion.id);
  });
});

describe("Bullseye (56088): the enemy team discards an attachment from your leader", () => {
  it("offers the enemy team's first player the attachments on your leader, a permanent one left out", () => {
    const start = forms(
      game({ deckOne: [NO_BOOST.id, BULLSEYE], deckTwo: [PLAIN_ATTACHMENT.id, PERMANENT_ATTACHMENT.id] }),
      true,
    );
    const { two, deckTwo } = leaders(start);
    const plain = takeEncounter(start, deckTwo, PLAIN_ATTACHMENT.id);
    const permanent = takeEncounter(plain.state, deckTwo, PERMANENT_ATTACHMENT.id);
    const staged = attached(attached(permanent.state, plain.id, two), permanent.id, two);
    const offered: (readonly string[])[] = [];
    const pick: Picker = (s) => {
      if (s.pendingChoice?.authority === "enemyTeam")
        offered.push(s.pendingChoice.options.map((o) => o.optionId as string));
      return firstLegal(s);
    };
    const { state } = round(staged, pick);
    // One attachment only (the permanent one is no target), so it may be bound without asking.
    expect(offered.flat()).not.toContain(permanent.id);
    expect(inst(state, two).attachments).toEqual([permanent.id]);
  });

  it("Otherwise, with no attachment on your leader: discards an upgrade you control", () => {
    const start = forms(game({ deckOne: [NO_BOOST.id, BULLSEYE], hand: [UPGRADE.id as string] }), true);
    const placed = intoPlay(start, P1, UPGRADE.id as string);
    const { state } = round(placed.state);
    expect(playerOf(state, P1).discard).toContain(placed.id);
  });
});

describe("Neighborhood Hero (56183)", () => {
  const withThreat = (threat: number) => {
    const start = forms(game({ deckOne: [NO_BOOST.id, NEIGHBORHOOD_HERO] }), true);
    const { two } = schemes(start);
    return { start: { ...start, instances: { ...start.instances, [two]: { ...start.instances[two]!, threat } } }, two };
  };
  const heroScheme = (s: GameState) => Object.values(s.instances).find((i) => i.cardId === cardId(NEIGHBORHOOD_HERO))!;

  it("with no threat on your leader's main scheme, Otherwise: places 2 per hero (1 player: 2) on itself", () => {
    const { start, two } = withThreat(0);
    const { state, events } = round(start);
    expect(events.some((e) => e.type === "threatRemoved" && e.schemeInstanceId === two)).toBe(false);
    const printed = REAL.find((c) => (c.id as string) === NEIGHBORHOOD_HERO) as unknown as {
      startingThreat?: { base: number };
    };
    expect(heroScheme(state).threat).toBe((printed.startingThreat?.base ?? 2) + 2);
  });

  it("with 1 threat there, moves that 1 across the table", () => {
    const { start } = withThreat(1);
    const before = start;
    const { state, events } = round(start);
    const moved = events.filter((e) => e.type === "threatRemoved" && e.schemeInstanceId === schemes(before).two);
    expect(moved.map((e) => (e as { amount: number }).amount)).toEqual([1]);
    const printed = REAL.find((c) => (c.id as string) === NEIGHBORHOOD_HERO) as unknown as {
      startingThreat?: { base: number };
    };
    expect(heroScheme(state).threat).toBe((printed.startingThreat?.base ?? 2) + 1);
  });
});

describe("Cloak (56194): 'remove 2 threat from your leader's main scheme' is the other side's scheme", () => {
  it("removes 2 from leader two's main scheme, not from yours", () => {
    const start = forms(game({ deckOne: [NO_BOOST.id, CLOAK] }), true);
    const { one, two } = schemes(start);
    const { events } = round(start);
    const removed = events.filter((e) => e.type === "threatRemoved");
    expect(removed.filter((e) => e.schemeInstanceId === two).map((e) => (e as { amount: number }).amount)).toEqual([2]);
    expect(removed.filter((e) => e.schemeInstanceId === one)).toEqual([]);
  });
});

describe("Darkforce (56196): after the attached leader schemes, that much threat leaves your leader's main scheme", () => {
  it("removes from leader two's main scheme what leader one's scheme placed on yours", () => {
    const start = forms(game({ deckOne: [NO_BOOST.id, DARKFORCE] }), true);
    const { one } = leaders(start);
    const { one: schemeOne, two: schemeTwo } = schemes(start);
    const taken = takeEncounter(start, leaders(start).deckOne, DARKFORCE);
    const staged = attached(taken.state, taken.id, one);
    const withThreat = {
      ...staged,
      instances: { ...staged.instances, [schemeTwo]: { ...staged.instances[schemeTwo]!, threat: 5 } },
    };
    const { events } = round(withThreat);
    const scheme = events.find((e) => e.type === "schemeResolved" && e.enemyInstanceId === one) as
      | { threatPlaced: number; schemeInstanceId: InstanceId }
      | undefined;
    expect(scheme?.schemeInstanceId).toBe(schemeOne);
    const removed = events.filter((e) => e.type === "threatRemoved" && e.schemeInstanceId === schemeTwo);
    expect(removed.map((e) => (e as { amount: number }).amount)).toEqual([scheme!.threatPlaced]);
  });
});

describe("Switching Sides (56158): the enemy team may pay the ally's cost and take control of it (Q17, N1)", () => {
  const start = forms(game({ deckOne: [NO_BOOST.id, SWITCHING_SIDES], hand: [ALLY.id as string] }), true);
  const placed = intoPlay(start, P1, ALLY.id as string);
  const { state } = round(placed.state, payAll);

  it("p1 discards the ally, then p2 (the enemy team) pays its cost and puts it into play under their control", () => {
    expect(playerOf(state, P2).playArea).toContain(placed.id);
    expect(inst(state, placed.id).controllerId).toBe(P2);
    expect(inst(state, placed.id).ownerId).toBe(P1);
  });

  it("when it leaves play it goes to its owner's discard pile", () => {
    const { state: after } = playCard(state, P1, DEFEATER.id, (s) =>
      s.pendingChoice?.options.some((o) => o.optionId === placed.id) ? [placed.id] : firstLegal(s),
    );
    expect(playerOf(after, P1).discard).toContain(placed.id);
    expect(playerOf(after, P2).discard).not.toContain(placed.id);
  });

  it("declined, the ally stays in p1's discard pile", () => {
    const { state: declined } = round(placed.state, (s) =>
      s.pendingChoice?.prompt.kind === "spendResources" ? [] : firstLegal(s),
    );
    expect(playerOf(declined, P1).discard).toContain(placed.id);
    expect(cardsInPlay(declined)).not.toContain(placed.id);
  });
});

describe("each side's phases on real cards (Q3 B, Q11 A; the rules expert's card list)", () => {
  const resolvedBy = (events: readonly GameEvent[], ref: string) =>
    events.flatMap((e) => (e.type === "abilityResolved" && e.abilityId === ref ? [e.controllerId ?? "none"] : []));
  const withCarriers = (state: GameState): GameState =>
    CARRIERS.reduce(
      (s, card) => intoPlay(intoPlay(s, P1, card.id as string).state, P2, card.id as string).state,
      state,
    );
  const hand = CARRIERS.flatMap((card) => [card.id as string]);

  it("'after resolving step 1 of the villain phase' resolves once a round on each side, in its own villain phase", () => {
    const start = withCarriers(forms(game({ hand }), true));
    const { events } = round(start, payAll);
    for (const ref of [CARRIED.outrage, CARRIED.jailbreak, CARRIED.vision])
      expect(resolvedBy(events, ref)).toEqual([P1, P2]);
  });

  it("a once-per-phase forced interrupt (Cut Off Support) resolves in each team's own villain phase", () => {
    const start = withCarriers(forms(game({ hand }), true));
    const { events } = round(start, payAll);
    expect(resolvedBy(events, CARRIED.cutOff).sort()).toEqual([P1, P2]);
  });

  it("'after the player phase begins' (Tigra's On the Hunt) answers only her own team's player phase", () => {
    const start = withCarriers(forms(game({ hand, deckOne: [VENOM], deckTwo: [IRON_FIST] }), true));
    const one = engaged(start, leaders(start).deckOne, VENOM, P1);
    const two = engaged(one.state, leaders(start).deckTwo, IRON_FIST, P2);
    const { events } = round(two.state, payAll);
    // Team two's player phase this round, then team one's next round: each side once, its own.
    expect(resolvedBy(events, CARRIED.hunt)).toEqual([P2, P1]);
  });

  it("Assess the Situation (56053) played in your hero phase ends at the end of your own hero phase", () => {
    const start = forms(game({ hand: [ASSESS.id as string] }));
    const played = playCard(start, P1, ASSESS.id as string);
    const added = played.events.find((e) => e.type === "lastingEffectAdded")!;
    const id = (added as { effect: { id: string } }).effect.id;
    const { events } = driveEventsPicking(deps, played.state, firstLegal, { type: "endTurn", playerId: P1 });
    const ended = events.findIndex((e) => e.type === "lastingEffectEnded" && e.id === id);
    const teamTwoHero = events.findIndex((e) => e.type === "activeTeamChanged" && e.phase === "player");
    expect(ended).toBeGreaterThanOrEqual(0);
    expect(ended).toBeLessThan(teamTwoHero);
  });
});
