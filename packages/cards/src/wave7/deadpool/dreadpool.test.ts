import {
  activeEncounterDeckId,
  activeVillain,
  applyCommand,
  characterProfile,
  createGame,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  action,
  dealDamage,
  enemyAttack,
  each,
  exists,
  ifThen,
  query,
  revealEncounterCard,
  theVillain,
  whenDefeated,
  you,
  yourIdentity,
} from "../../dsl/index.js";
import { defineAbilities, validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  settle,
  use,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, withDamage, withForm } from "../../testing/staging.js";
import { WAVE7_ABILITIES, wave7Scenario } from "../index.js";
import { DREADPOOL } from "./dreadpool.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Dreadpool set (44037-44042), docs/phase7-wave7.md §3.74, §3.44, Q44 = A. Every game here seats Deadpool's 'Pool
 * deck (`deadpool-pool`), so the set is really included at setup: one Crisis of Infinite Deadpools in the encounter deck
 * and the other six cards set aside. Juggernaut is the scenario (a villain that cannot be stunned, with no encounter
 * rules of its own that matter here).
 *
 * To reveal a card without a villain phase, three inert Deadpool / Spider-Man cards are given test-double abilities
 * (`FIXTURES`): playing 44003 (cost 0) reveals the top card of the encounter deck for its controller, 01005 does the
 * same for the Spider-Man seat, 44004 (cost 0) has Dreadpool attack, 44006 (cost 1) has the villain attack (no boost
 * card). Dogpool 44013 and Lady Deadpool 44016 print a When Defeated that is another group's script; here it is blank.
 */
const CRISIS = "44037";
const DREADPOOL_MINION = "44038";
const DEEDS = "44039";
const RAY = "44040";
const POOLIZED = "44041";
const METACIDAL = "44042";
const SET_CODES = [CRISIS, DREADPOOL_MINION, DEEDS, RAY, POOLIZED, POOLIZED, METACIDAL];

const DOGPOOL = "44013"; // ally, cost 3, DEADPOOL CORPS, 4 hp, toughness, retaliate 1
const LADY_DEADPOOL = "44016"; // ally, cost 4, THW 2, ATK 2, 3 hp, DEADPOOL CORPS
const BLACK_CAT = "01002"; // ally, cost 2, 2 hp
const JESSICA_JONES = "01059"; // ally, cost 3, 3 hp, THW 1?

const DOGPOOL_QUERY = query("ally", { name: "Dogpool" });
const DREADPOOL_QUERY_MINION = query("minion", { name: "Dreadpool" });
const REVEAL_P1 = "44003.exhausting-personality-action";
const REVEAL_P2 = "01005.swinging-web-kick-action";
const DREADPOOL_ATTACKS = "44004.maximum-effort-action";
const VILLAIN_ATTACKS = "44006.yoo-hoo-action";
const DEAL_20_TO_YOU = "44020.get-rage-y-action";
const FIXTURES = defineAbilities({
  [REVEAL_P1]: action(revealEncounterCard(you)),
  [REVEAL_P2]: action(revealEncounterCard(you)),
  // With Dogpool in play Dreadpool attacks Dogpool (the attacked character is the ally itself), else the player.
  [DREADPOOL_ATTACKS]: action(
    ifThen(
      exists(DOGPOOL_QUERY),
      enemyAttack(each(DREADPOOL_QUERY_MINION), { noBoost: true, targetCharacter: each(DOGPOOL_QUERY) }),
      enemyAttack(each(DREADPOOL_QUERY_MINION), { noBoost: true }),
    ),
  ),
  [VILLAIN_ATTACKS]: action(enemyAttack(theVillain, { noBoost: true })),
  [DEAL_20_TO_YOU]: action(dealDamage(20, yourIdentity)),
  "44013.when-defeated": whenDefeated(),
  "44016.when-defeated": whenDefeated(),
});
const DEPS: EngineDeps = { abilities: { ...WAVE7_ABILITIES, ...FIXTURES } };

const POOL_SEAT = { starterDeckId: "deadpool-pool" } as const;
const SPIDER_SEAT = { starterDeckId: "core-spider-man-justice" } as const;
type Seat = typeof POOL_SEAT | typeof SPIDER_SEAT;

const cache = new Map<string, GameState>();
/** Juggernaut past setup, hero forms, no threat on the main scheme (so nothing completes it). Cached: states are immutable. */
function baseGame(players: readonly Seat[]): GameState {
  const key = players.map((p) => p.starterDeckId).join("+");
  const hit = cache.get(key);
  if (hit) return hit;
  const config = wave7Scenario("juggernaut", { players, seed: 1, difficulty: "standard", modularSetIds: [] });
  const created = createGame(config, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  let s = settle(created.state, firstLegal, (x) => x.step.phase === "player", DEPS);
  s = patchInstance(s, s.mainScheme.instanceId, { threat: 0 });
  for (const p of s.players) s = withForm(s, { heroForm: 0 }, p.playerId);
  cache.set(key, s);
  return s;
}

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const codes = (s: GameState, ids: readonly InstanceId[]): string[] => ids.map((id) => codeOf(s, id));
const piles = (s: GameState) => s.encounterDecks[activeEncounterDeckId(s)]!;
const inDeck = (s: GameState) => codes(s, piles(s).deck);
const inDiscard = (s: GameState) => codes(s, piles(s).discard);
const aside = (s: GameState) => codes(s, s.encounterSetAside);
const everywhere = (s: GameState, code: string) =>
  (Object.keys(s.instances) as InstanceId[]).filter((id) => codeOf(s, id) === code);
const idOf = (s: GameState, code: string): InstanceId => {
  const hit = everywhere(s, code)[0];
  if (!hit) throw new Error(`no ${code}`);
  return hit;
};
const events = <T extends GameEvent["type"]>(run: readonly GameEvent[], type: T) =>
  run.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const revealedCodes = (run: readonly GameEvent[]) =>
  events(run, "encounterCardRevealed").map((e) => e.cardId as string);
const villainArea = (s: GameState) => codes(s, s.villainArea);
const engagedWith = (s: GameState, id: InstanceId): PlayerId | null => inst(s, id).engagedWith ?? null;
const threat = (s: GameState, id: InstanceId) => inst(s, id).threat;
const damageOf = (s: GameState, id: InstanceId) => inst(s, id).damage;
const hostOf = (s: GameState, id: InstanceId) => inst(s, id).attachedTo ?? null;
const removed = (s: GameState): string[] => codes(s, s.removedFromGame);

/** Puts one copy of `code` on top of the active encounter deck, from the set-aside area, the deck or the discard pile. */
function onTop(state: GameState, code: string): GameState {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const wanted = (id: InstanceId) => codeOf(state, id) === code;
  const fromAside = state.encounterSetAside.find(wanted);
  const id = fromAside ?? pile.deck.find(wanted) ?? pile.discard.find(wanted);
  if (!id) throw new Error(`no ${code} to stack`);
  return {
    ...state,
    encounterSetAside: state.encounterSetAside.filter((i) => i !== id),
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { deck: [id, ...pile.deck.filter((i) => i !== id)], discard: pile.discard.filter((i) => i !== id) },
    },
  };
}

/** A copy of `code` from `player`'s deck, hand or discard put straight into their play area (surgery: no cost, no enter-play). */
function ownCardInPlay(state: GameState, player: PlayerId, code: string): { state: GameState; id: InstanceId } {
  const given = moveToHand(state, player, code);
  const id = given.ids[0]!;
  const seat = playerOf(given.state, player);
  return {
    id,
    state: {
      ...given.state,
      players: given.state.players.map((p) =>
        p.playerId === player ? { ...p, hand: seat.hand.filter((i) => i !== id), playArea: [...seat.playArea, id] } : p,
      ),
      instances: {
        ...given.state.instances,
        [id]: { ...given.state.instances[id]!, faceup: true, controllerId: player },
      },
    },
  };
}
const withAllies = (state: GameState, ...allies: readonly [PlayerId, string][]): GameState =>
  allies.reduce((s, [player, code]) => ownCardInPlay(s, player, code).state, state);

interface Run {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  readonly prompts: readonly { readonly kind: string; readonly player: PlayerId; readonly labels: readonly string[] }[];
}
interface Plan {
  /** Label (start) of the option to pick at a prompt; the first offered otherwise. */
  readonly pick?: readonly string[];
  /** Defenders, one per defender prompt (only if offered); nobody otherwise. */
  readonly defenders?: readonly InstanceId[];
}
function drive(state: GameState, plan: Plan, ...commands: Parameters<typeof driveEventsPicking>[3][]): Run {
  const prompts: { kind: string; player: PlayerId; labels: readonly string[] }[] = [];
  const picks = [...(plan.pick ?? [])];
  const defenders = [...(plan.defenders ?? [])];
  const pick: Picker = (s) => {
    const choice = s.pendingChoice!;
    prompts.push({ kind: choice.prompt.kind, player: choice.playerId, labels: choice.options.map((o) => o.label) });
    switch (choice.prompt.kind) {
      case "declareDefender": {
        const next = defenders.shift();
        return [next && choice.options.some((o) => o.optionId === next) ? next : "decline"];
      }
      case "chooseTriggers":
        return [];
      default: {
        const hit = picks[0] ? choice.options.find((o) => o.label.startsWith(picks[0]!)) : undefined;
        if (hit) {
          picks.shift();
          return [hit.optionId];
        }
        return firstLegal(s);
      }
    }
  };
  const { state: after, events: log } = driveEventsPicking(DEPS, state, pick, ...commands);
  return { state: after, events: log, prompts };
}

/** `player` plays the reveal event of their deck: the top card of the encounter deck is revealed by them. */
function revealBy(state: GameState, player: PlayerId, plan: Plan = {}): Run {
  const code = hasCard(state, player, "44003") ? "44003" : "01005";
  const given = moveToHand(state, player, code);
  const id = given.ids[0]!;
  const cost = (state.cardPool[state.instances[id]!.cardId] as { cost?: number }).cost ?? 0;
  return drive(given.state, plan, play(player, id, payWith(given.state, player, cost, [id])));
}
const hasCard = (s: GameState, player: PlayerId, code: string) => {
  const p = playerOf(s, player);
  return [...p.hand, ...p.deck, ...p.discard].some((id) => codeOf(s, id) === code);
};
/** Stacks `code` on top of the encounter deck and has `player` reveal it. */
const revealCode = (state: GameState, code: string, player: PlayerId = P1, plan: Plan = {}): Run =>
  revealBy(onTop(state, code), player, plan);

describe("the Dreadpool registry", () => {
  const REFS = [
    "44037.when-revealed",
    "44038.dreadpool-constant",
    "44038.when-defeated",
    "44039.when-revealed",
    "44040.anti-regeneration-ray-forced-interrupt",
    "44040.anti-regeneration-ray-action",
    "44041.pool-ized-constant",
    "44041.when-revealed",
    "44042.when-revealed",
  ];
  it.each(REFS)("%s validates", (id) => {
    expect(validateDefinition(DREADPOOL[id]!)).toEqual([]);
  });
  it("holds exactly the nine refs of the set", () => {
    expect(Object.keys(DREADPOOL).sort()).toEqual([...REFS].sort());
  });
});

describe("Crisis of Infinite Deadpools (44037)", () => {
  it("setup: one Crisis in the encounter deck, six cards set aside, in a game that seats the 'Pool deck", () => {
    const s = baseGame([POOL_SEAT]);
    const all = [...inDeck(s), ...inDiscard(s)].filter((c) => SET_CODES.includes(c));
    expect(all).toEqual([CRISIS]);
    expect(aside(s).sort()).toEqual([DREADPOOL_MINION, DEEDS, RAY, POOLIZED, POOLIZED, METACIDAL].sort());
  });
  it("setup, 2 players (Deadpool second): still one Crisis in the deck and six cards set aside", () => {
    const s = baseGame([SPIDER_SEAT, POOL_SEAT]);
    expect([...inDeck(s), ...inDiscard(s)].filter((c) => SET_CODES.includes(c))).toEqual([CRISIS]);
    expect(aside(s)).toHaveLength(6);
  });
  it("revealed: Dreadpool is revealed, then Dreadful Deeds; the other four cards are shuffled in; Crisis is removed from the game", () => {
    const base = baseGame([POOL_SEAT]);
    const run = revealCode(base, CRISIS);
    expect(revealedCodes(run.events)).toEqual([CRISIS, DREADPOOL_MINION, DEEDS]);
    const s = run.state;
    expect(aside(s)).toEqual([]);
    expect([...inDeck(s), ...inDiscard(s)].filter((c) => SET_CODES.includes(c)).sort()).toEqual(
      [RAY, POOLIZED, POOLIZED, METACIDAL].sort(),
    );
    expect(inDeck(s)).not.toContain(CRISIS);
    expect(inDiscard(s)).not.toContain(CRISIS);
    expect(removed(s)).toContain(CRISIS);
    expect(villainArea(s)).toContain(DEEDS);
    expect(codes(s, playerOf(s, P1).playArea)).toContain(DREADPOOL_MINION);
    expect(engagedWith(s, idOf(s, DREADPOOL_MINION))).toBe(P1);
  });
  it("the deck is shuffled after the four cards go in: it holds the old cards plus exactly four", () => {
    const base = baseGame([POOL_SEAT]);
    const before = piles(base).deck.length + piles(base).discard.length;
    const run = revealCode(base, CRISIS);
    expect(events(run.events, "deckShuffled").length).toBeGreaterThan(0);
    expect(piles(run.state).deck.length + piles(run.state).discard.length).toBe(before - 1 + 4);
  });
});

const afterCache = new Map<string, GameState>();
/** The game once Crisis has been revealed by the first player: Dreadpool engaged, Dreadful Deeds in the villain area. */
function afterCrisis(players: readonly Seat[]): GameState {
  const key = players.map((p) => p.starterDeckId).join("+");
  const hit = afterCache.get(key);
  if (hit) return hit;
  const s = revealCode(baseGame(players), CRISIS, P1).state;
  afterCache.set(key, s);
  return s;
}
/** Hero forms again (a form is not touched by Crisis, but the helper is explicit about what the next test starts from). */
const asHero = (s: GameState): GameState => s.players.reduce((x, p) => withForm(x, { heroForm: 0 }, p.playerId), s);
/** Surgery: gives `player` a copy of `code` in play by relabeling a card of their deck. */
function relabeledInPlay(state: GameState, player: PlayerId, code: string): { state: GameState; id: InstanceId } {
  const owner = playerOf(state, player);
  const spare = owner.deck[owner.deck.length - 1]!;
  const relabeled = patchInstance(state, spare, { cardId: code as never });
  return ownCardInPlay(relabeled, player, code);
}

describe("Dreadful Deeds (44039)", () => {
  const deeds = (s: GameState) => idOf(s, DEEDS);
  it("1 player, no 'Pool card in play: 2 threat (its printed starting threat) and none added", () => {
    const run = revealCode(baseGame([POOL_SEAT]), DEEDS);
    expect(threat(run.state, deeds(run.state))).toBe(2);
    expect(villainArea(run.state)).toContain(DEEDS);
  });
  it("1 player controlling a 'Pool ally (Dogpool): 2 + 2 = 4 threat", () => {
    const base = withAllies(baseGame([POOL_SEAT]), [P1, DOGPOOL]);
    const run = revealCode(base, DEEDS);
    expect(threat(run.state, deeds(run.state))).toBe(4);
  });
  it("1 player controlling two 'Pool cards: still 2 for that player (2 + 2 = 4)", () => {
    const base = withAllies(baseGame([POOL_SEAT]), [P1, DOGPOOL], [P1, LADY_DEADPOOL]);
    const run = revealCode(base, DEEDS);
    expect(threat(run.state, deeds(run.state))).toBe(4);
  });
  it("2 players, only Deadpool's player controls a 'Pool card: 4 threat", () => {
    const base = withAllies(baseGame([POOL_SEAT, SPIDER_SEAT]), [P1, DOGPOOL]);
    const run = revealCode(base, DEEDS, P2);
    expect(threat(run.state, deeds(run.state))).toBe(4);
  });
  it("2 players, both controlling a 'Pool card: 2 + 2 + 2 = 6 threat", () => {
    const base = baseGame([POOL_SEAT, SPIDER_SEAT]);
    const first = ownCardInPlay(base, P1, DOGPOOL).state;
    const both = relabeledInPlay(first, P2, LADY_DEADPOOL).state;
    const run = revealCode(both, DEEDS);
    expect(threat(run.state, deeds(run.state))).toBe(6);
  });
  it("a 'Pool card in hand or in the deck is not controlled: 2 players, none in play, 2 threat", () => {
    const run = revealCode(baseGame([POOL_SEAT, SPIDER_SEAT]), DEEDS);
    expect(threat(run.state, deeds(run.state))).toBe(2);
  });
});

describe("Dreadpool (44038)", () => {
  it("revealed by the first player in a 1-player game: engaged with them", () => {
    const s = afterCrisis([POOL_SEAT]);
    const id = idOf(s, DREADPOOL_MINION);
    expect(engagedWith(s, id)).toBe(P1);
  });
  it("2 players, Deadpool second: Crisis revealed by Deadpool's player, yet Dreadpool engages the first player", () => {
    const base = baseGame([SPIDER_SEAT, POOL_SEAT]);
    const run = revealCode(base, CRISIS, P2);
    expect(revealedCodes(run.events)).toEqual([CRISIS, DREADPOOL_MINION, DEEDS]);
    expect(engagedWith(run.state, idOf(run.state, DREADPOOL_MINION))).toBe(P1);
    expect(codes(run.state, playerOf(run.state, P1).playArea)).toContain(DREADPOOL_MINION);
    expect(codes(run.state, playerOf(run.state, P2).playArea)).not.toContain(DREADPOOL_MINION);
  });
});

/** `player`'s hero basic-attacks `target`; the picker defaults apply. */
const attack = (state: GameState, player: PlayerId, target: InstanceId, plan: Plan = {}): Run =>
  drive(state, plan, {
    type: "basicAttack",
    playerId: player,
    attackerInstanceId: identityOf(state, player),
    targetInstanceId: target,
  });
/** P1 has ended their turn, so it is `player`'s (the 2-player game's second turn). */
const withTurnOf = (s: GameState, player: PlayerId): GameState => (player === P1 ? s : drive(s, {}, endTurn(P1)).state);
const dealt = (s: GameState, player: PlayerId): string[] => codes(s, playerOf(s, player).dealtEncounter);
/** Every player ends their turn: the villain phase, with each player's dealt cards revealed. */
const endRound = (state: GameState, plan: Plan = {}): Run => {
  const step = state.step;
  const active = step.phase === "player" && step.kind === "turn" ? step.activePlayerId : P1;
  const order = state.players.map((p) => p.playerId);
  return drive(state, plan, ...order.slice(order.indexOf(active)).map((p) => endTurn(p)));
};

describe("Dreadpool (44038): When Defeated", () => {
  it("1 player: Deadpool's basic attack (ATK 2) defeats him (3 hit points, 2 already); he is dealt to Deadpool's player facedown, not discarded", () => {
    const s0 = afterCrisis([POOL_SEAT]);
    const id = idOf(s0, DREADPOOL_MINION);
    const run = attack(asHero(withDamage(s0, id, 2)), P1, id);
    expect(dealt(run.state, P1)).toEqual([DREADPOOL_MINION]);
    expect(inDiscard(run.state)).not.toContain(DREADPOOL_MINION);
    expect(codes(run.state, playerOf(run.state, P1).playArea)).not.toContain(DREADPOOL_MINION);
    expect(inst(run.state, id).faceup).toBe(false);
  });
  it("one hit short of defeat (1 damage already, ATK 2 makes 3 of 3) is still a defeat; 0 damage already is not (2 of 3)", () => {
    const s0 = asHero(afterCrisis([POOL_SEAT]));
    const id = idOf(s0, DREADPOOL_MINION);
    const alive = attack(s0, P1, id);
    expect(damageOf(alive.state, id)).toBe(2);
    expect(dealt(alive.state, P1)).toEqual([]);
    expect(codes(alive.state, playerOf(alive.state, P1).playArea)).toContain(DREADPOOL_MINION);
    const dead = attack(withDamage(s0, id, 1), P1, id);
    expect(dealt(dead.state, P1)).toEqual([DREADPOOL_MINION]);
  });
  it("he returns: revealed in the next villain phase by the player who defeated him, and engages the first player", () => {
    const s0 = afterCrisis([POOL_SEAT]);
    const id = idOf(s0, DREADPOOL_MINION);
    const defeated = attack(asHero(withDamage(s0, id, 2)), P1, id).state;
    const run = endRound(onTop(defeated, METACIDAL), {});
    expect(revealedCodes(run.events)).toContain(DREADPOOL_MINION);
    expect(codes(run.state, playerOf(run.state, P1).playArea)).toContain(DREADPOOL_MINION);
    expect(engagedWith(run.state, id)).toBe(P1);
    expect(damageOf(run.state, id)).toBe(0);
  });
  it("2 players: Spider-Man's player (second) defeats him and is dealt him; revealing him, he engages the first player (Deadpool's), not them", () => {
    const s0 = afterCrisis([POOL_SEAT, SPIDER_SEAT]);
    const id = idOf(s0, DREADPOOL_MINION);
    const defeated = attack(withTurnOf(asHero(withDamage(s0, id, 2)), P2), P2, id).state;
    expect(dealt(defeated, P2)).toEqual([DREADPOOL_MINION]);
    expect(dealt(defeated, P1)).toEqual([]);
    const run = endRound(defeated);
    expect(revealedCodes(run.events)).toContain(DREADPOOL_MINION);
    const reveal = events(run.events, "encounterCardRevealed").find((e) => e.cardId === DREADPOOL_MINION)!;
    expect(reveal.playerId).toBe(P2);
    expect(engagedWith(run.state, id)).toBe(P1);
  });
  it("2 players: Deadpool's player defeating him is dealt him, not the other player", () => {
    const s0 = afterCrisis([POOL_SEAT, SPIDER_SEAT]);
    const id = idOf(s0, DREADPOOL_MINION);
    const defeated = attack(asHero(withDamage(s0, id, 2)), P1, id).state;
    expect(dealt(defeated, P1)).toEqual([DREADPOOL_MINION]);
    expect(dealt(defeated, P2)).toEqual([]);
  });
});

const RAY_INTERRUPT = "44040.anti-regeneration-ray-forced-interrupt";
const RAY_ACTION = "44040.anti-regeneration-ray-action";

/** `player` plays the cost-`cost` event `code` from their deck. */
function playCode(state: GameState, player: PlayerId, code: string, cost: number, plan: Plan = {}): Run {
  const given = moveToHand(state, player, code);
  const id = given.ids[0]!;
  return drive(given.state, plan, play(player, id, payWith(given.state, player, cost, [id])));
}
const resolved = (run: Run, ability: string) =>
  events(run.events, "abilityResolved").filter((e) => e.abilityId === ability).length;
const formOf = (s: GameState, p = P1) => playerOf(s, p).identity.form;
const rayOf = (s: GameState) => idOf(s, RAY);

describe("Anti-Regeneration Ray (44040)", () => {
  it("revealed with Dreadpool in play: attached to Dreadpool", () => {
    const s0 = afterCrisis([POOL_SEAT]);
    const run = revealCode(s0, RAY);
    expect(hostOf(run.state, rayOf(run.state))).toBe(idOf(run.state, DREADPOOL_MINION));
  });
  it("revealed with no Dreadpool in play: attached to the villain", () => {
    const run = revealCode(baseGame([POOL_SEAT]), RAY);
    expect(hostOf(run.state, rayOf(run.state))).toBe(activeVillain(run.state).instanceId);
  });
});

/** Dreadpool, with the Ray on him. */
const rayedDreadpool = (players: readonly Seat[] = [POOL_SEAT]): GameState =>
  revealCode(afterCrisis(players), RAY).state;
/** The villain, with the Ray on it (no Dreadpool in play). */
const rayedVillain = (players: readonly Seat[] = [POOL_SEAT]): GameState => revealCode(baseGame(players), RAY).state;
const hitPoints = (s: GameState, p = P1): number => damageOf(s, identityOf(s, p));
const hurt = (s: GameState, n: number, p = P1): GameState => withDamage(s, identityOf(s, p), n);

describe("Anti-Regeneration Ray (44040): the forced interrupt", () => {
  it("Dreadpool (ATK 2, +1 from the Ray = 3) attacks Deadpool: 3 damage, and the Ray's interrupt resolves once", () => {
    const run = playCode(asHero(rayedDreadpool()), P1, "44004", 0);
    expect(hitPoints(run.state)).toBe(3);
    expect(resolved(run, RAY_INTERRUPT)).toBe(1);
  });
  it("without the Ray Dreadpool deals 2 (so the +1 is the Ray's)", () => {
    const run = playCode(asHero(afterCrisis([POOL_SEAT])), P1, "44004", 0);
    expect(hitPoints(run.state)).toBe(2);
  });
  it("Deadpool's text box is blank for the attack: at 1 hit point left he is defeated, not regenerated (eliminated)", () => {
    const run = playCode(hurt(asHero(rayedDreadpool()), 8), P1, "44004", 0);
    expect(playerOf(run.state, P1).eliminated).toBe(true);
    expect(run.state.outcome).not.toBeNull();
  });
  it("control: the same hit without the Ray regenerates him (hit points 1, alter-ego form, +1 acceleration token)", () => {
    const s0 = hurt(asHero(afterCrisis([POOL_SEAT])), 8);
    const tokens = s0.mainScheme.accelerationTokens;
    const run = playCode(s0, P1, "44004", 0);
    expect(playerOf(run.state, P1).eliminated).toBe(false);
    expect(hitPoints(run.state)).toBe(8);
    expect(formOf(run.state)).toBe("alterEgo");
    expect(run.state.mainScheme.accelerationTokens).toBe(tokens + 1);
  });
  it("the blank lasts only until the end of the attack: afterward 20 damage from a card is regenerated again", () => {
    const first = playCode(asHero(rayedDreadpool()), P1, "44004", 0);
    expect(hitPoints(first.state)).toBe(3);
    const second = playCode(first.state, P1, "44020", 0);
    expect(playerOf(second.state, P1).eliminated).toBe(false);
    expect(hitPoints(second.state)).toBe(8);
    expect(formOf(second.state)).toBe("alterEgo");
  });
  it("on the villain (no Dreadpool): the villain's attack blanks Deadpool the same way, and gets +1 ATK", () => {
    const run = playCode(hurt(asHero(rayedVillain()), 8), P1, "44006", 1);
    expect(playerOf(run.state, P1).eliminated).toBe(true);
    const plain = playCode(asHero(rayedVillain()), P1, "44006", 1);
    const control = playCode(asHero(baseGame([POOL_SEAT])), P1, "44006", 1);
    expect(hitPoints(plain.state) - hitPoints(control.state)).toBe(1);
    expect(resolved(plain, RAY_INTERRUPT)).toBe(1);
  });
  it("the attacked ally's text box is blank: Dreadpool attacks Dogpool (4 hit points), whose retaliate 1 then does not hit him", () => {
    const rayed = withAllies(asHero(rayedDreadpool()), [P1, DOGPOOL]);
    const run = playCode(rayed, P1, "44004", 0);
    expect(damageOf(run.state, idOf(run.state, DOGPOOL))).toBe(3);
    expect(damageOf(run.state, idOf(run.state, DREADPOOL_MINION))).toBe(0);
    const plain = withAllies(asHero(afterCrisis([POOL_SEAT])), [P1, DOGPOOL]);
    const control = playCode(plain, P1, "44004", 0);
    expect(damageOf(control.state, idOf(control.state, DOGPOOL))).toBe(2);
    expect(damageOf(control.state, idOf(control.state, DREADPOOL_MINION))).toBe(1);
  });
  it("alter-ego Wade Wilson attacked: a non-villain character, so the interrupt is heard and nothing is lost", () => {
    const run = playCode(withForm(rayedDreadpool(), "alterEgo", P1), P1, "44004", 0);
    expect(resolved(run, RAY_INTERRUPT)).toBe(1);
    expect(hitPoints(run.state)).toBe(3);
  });
});

/** Surgery: `player`'s first three hand cards are an [energy], a [mental] and a [physical] resource. */
function withEmp(state: GameState, player: PlayerId): { state: GameState; paid: readonly InstanceId[] } {
  const hand = playerOf(state, player).hand.slice(0, 3);
  let s = state;
  ["01088", "01089", "01090"].forEach((code, i) => {
    s = patchInstance(s, hand[i]!, { cardId: code as never });
  });
  return { state: s, paid: hand };
}
const takeRay = (state: GameState, player: PlayerId, plan: Plan = {}): Run => {
  const { state: s, paid } = withEmp(state, player);
  return drive(
    s,
    plan,
    use(
      player,
      rayOf(s),
      RAY_ACTION,
      paid.map((fromHand) => ({ fromHand })),
    ),
  );
};

describe("Anti-Regeneration Ray (44040): Hero Action", () => {
  it("spend [energy][mental][physical]: the Ray moves from Dreadpool to your identity and the 3 cards are spent", () => {
    const s0 = asHero(rayedDreadpool());
    const handBefore = playerOf(s0, P1).hand.length;
    const run = takeRay(s0, P1);
    expect(hostOf(run.state, rayOf(run.state))).toBe(identityOf(run.state, P1));
    expect(playerOf(run.state, P1).hand.length).toBe(handBefore - 3);
    expect(codes(run.state, inst(run.state, identityOf(run.state, P1)).attachments)).toContain(RAY);
    expect(inst(run.state, idOf(run.state, DREADPOOL_MINION)).attachments).toEqual([]);
  });
  it("then Deadpool has +1 ATK (a basic attack deals 3) and the interrupt is heard against a minion", () => {
    const took = takeRay(asHero(rayedDreadpool()), P1).state;
    const dp = idOf(took, DREADPOOL_MINION);
    const run = attack(took, P1, dp);
    expect(resolved(run, RAY_INTERRUPT)).toBe(1);
    // Deadpool's ATK is 2 + 1 from the Ray: the 3 damage defeat Dreadpool (3 hit points), and his text box is blank
    // for the attack, defeat included: no When Defeated, so he is discarded rather than dealt to Deadpool's player.
    expect(dealt(run.state, P1)).toEqual([]);
    expect(inDiscard(run.state)).toContain(DREADPOOL_MINION);
  });
  it("Deadpool attacking the villain: the interrupt is not heard (the villain is not a non-villain character)", () => {
    const took = takeRay(asHero(rayedDreadpool()), P1).state;
    const run = attack(took, P1, activeVillain(took).instanceId);
    expect(resolved(run, RAY_INTERRUPT)).toBe(0);
  });
  it("alter-ego form: the Hero Action is not offered", () => {
    const { state: s, paid } = withEmp(withForm(rayedDreadpool(), "alterEgo", P1), P1);
    const refused = applyCommand(
      s,
      use(
        P1,
        rayOf(s),
        RAY_ACTION,
        paid.map((fromHand) => ({ fromHand })),
      ),
      DEPS,
    );
    expect(refused.ok).toBe(false);
  });
  it("2 players: the second player (Spider-Man) takes the Ray onto their own identity, and Deadpool's player loses nothing", () => {
    const s0 = withTurnOf(asHero(rayedDreadpool([POOL_SEAT, SPIDER_SEAT])), P2);
    const run = takeRay(s0, P2);
    expect(hostOf(run.state, rayOf(run.state))).toBe(identityOf(run.state, P2));
    expect(playerOf(run.state, P1).hand.length).toBe(playerOf(s0, P1).hand.length);
  });
});

/**
 * Juggernaut puts its own ally, Hope Summers (40130), into the first player's play area, so it is a candidate for
 * "the ally with the highest cost". Surgery: she goes to the encounter discard pile, for the no-ally case.
 */
const HOPE = "40130";
function withoutHope(state: GameState): GameState {
  const id = idOf(state, HOPE);
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, playArea: p.playArea.filter((i) => i !== id) })),
    encounterDecks: { ...state.encounterDecks, [deckId]: { ...pile, discard: [...pile.discard, id] } },
    instances: { ...state.instances, [id]: { ...state.instances[id]!, controllerId: null } },
  };
}
const treated = (s: GameState, id: InstanceId) => inst(s, id).treatedAs;
const poolizedOn = (s: GameState, host: InstanceId): InstanceId[] =>
  inst(s, host).attachments.filter((a) => codeOf(s, a) === POOLIZED);

describe("'Pool-ized (44041)", () => {
  it("1 player, allies Dogpool (cost 3) and Lady Deadpool (cost 4): attached to Lady, who engages her controller and is a 'POOL minion", () => {
    const s0 = withAllies(asHero(baseGame([POOL_SEAT])), [P1, DOGPOOL], [P1, LADY_DEADPOOL]);
    const run = revealCode(s0, POOLIZED);
    const lady = idOf(run.state, LADY_DEADPOOL);
    expect(poolizedOn(run.state, lady)).toHaveLength(1);
    expect(engagedWith(run.state, lady)).toBe(P1);
    expect(treated(run.state, lady)?.kind).toBe("minion");
    expect(treated(run.state, lady)?.traits.map(String)).toEqual(["POOL"]);
    expect(poolizedOn(run.state, idOf(run.state, DOGPOOL))).toEqual([]);
    expect(engagedWith(run.state, idOf(run.state, DOGPOOL))).toBeNull();
  });
  it("the attached minion's SCH is its printed THW (Lady Deadpool: 2) and ATK is her own 2", () => {
    const s0 = withAllies(asHero(baseGame([POOL_SEAT])), [P1, LADY_DEADPOOL]);
    const run = revealCode(s0, POOLIZED);
    const profile = characterProfile(run.state, idOf(run.state, LADY_DEADPOOL), DEPS)!;
    expect(profile.kind).toBe("minion");
    expect(profile.sch).toBe(2);
    expect(profile.atk).toBe(2);
  });
  it("a second 'Pool-ized skips an ally that already has one: it goes to Dogpool, the next highest", () => {
    const s0 = withAllies(asHero(baseGame([POOL_SEAT])), [P1, DOGPOOL], [P1, LADY_DEADPOOL]);
    const once = revealCode(s0, POOLIZED).state;
    const twice = revealCode(once, POOLIZED).state;
    expect(poolizedOn(twice, idOf(twice, LADY_DEADPOOL))).toHaveLength(1);
    expect(poolizedOn(twice, idOf(twice, DOGPOOL))).toHaveLength(1);
    expect(engagedWith(twice, idOf(twice, DOGPOOL))).toBe(P1);
  });
  // Wave 9 Q22: the surge deals the next card facedown; outside step four it is not revealed at once.
  it("no ally in play: it is not attached, gains surge, and the next card is dealt facedown (Metacidal Tendencies)", () => {
    const stacked = onTop(onTop(withoutHope(asHero(baseGame([POOL_SEAT]))), METACIDAL), POOLIZED);
    const revealed = revealBy(stacked, P1);
    expect(revealedCodes(revealed.events)).toEqual([POOLIZED]);
    expect(revealed.events.filter((e) => e.type === "surgeTriggered")).toHaveLength(1);
    expect(revealed.state.players[0]!.dealtEncounter).toEqual([idOf(revealed.state, METACIDAL)]);
    expect(poolizedOn(revealed.state, idOf(revealed.state, POOLIZED))).toEqual([]);
    expect(hostOf(revealed.state, idOf(revealed.state, POOLIZED))).toBeNull();
  });
  it("2 players: allies in several seats are all candidates, and it engages its controller, not the player who revealed it", () => {
    const s0 = withAllies(asHero(baseGame([POOL_SEAT, SPIDER_SEAT])), [P1, DOGPOOL], [P2, BLACK_CAT]);
    const run = revealCode(s0, POOLIZED, P2);
    const dog = idOf(run.state, DOGPOOL);
    expect(poolizedOn(run.state, dog)).toHaveLength(1);
    expect(engagedWith(run.state, dog)).toBe(P1);
    expect(engagedWith(run.state, idOf(run.state, BLACK_CAT))).toBeNull();
  });
  it("2 players, a tie for the highest cost (Dogpool and Jessica Jones, both 3): the first player chooses", () => {
    const s0 = withAllies(asHero(baseGame([POOL_SEAT, SPIDER_SEAT])), [P1, DOGPOOL], [P2, JESSICA_JONES]);
    const jones = idOf(s0, JESSICA_JONES);
    const run = revealCode(s0, POOLIZED, P2, { pick: ["Jessica"] });
    const chooser = run.prompts.find((p) => p.labels.some((l) => l.startsWith("Jessica")));
    expect(chooser?.player).toBe(P1);
    expect(poolizedOn(run.state, jones)).toHaveLength(1);
    expect(engagedWith(run.state, jones)).toBe(P2);
  });
});

const tokens = (s: GameState) => s.mainScheme.accelerationTokens;

describe("Metacidal Tendencies (44042)", () => {
  it("1 player, Deadpool in hero form (DEADPOOL CORPS), no Dreadpool: he takes 2 damage and no token is placed", () => {
    const s0 = asHero(baseGame([POOL_SEAT]));
    const run = revealCode(s0, METACIDAL);
    expect(hitPoints(run.state)).toBe(2);
    expect(tokens(run.state)).toBe(tokens(s0));
  });
  it("with Dreadpool in play: 3 damage (and Dreadpool himself, not DEADPOOL CORPS, takes none)", () => {
    const s0 = asHero(afterCrisis([POOL_SEAT]));
    const run = revealCode(s0, METACIDAL);
    expect(hitPoints(run.state)).toBe(3);
    expect(damageOf(run.state, idOf(run.state, DREADPOOL_MINION))).toBe(0);
    expect(tokens(run.state)).toBe(tokens(s0));
  });
  it("alter-ego Wade Wilson (MERCENARY, MUTANT) and no DEADPOOL CORPS ally: no damage, so 1 acceleration token is placed", () => {
    const s0 = withForm(baseGame([POOL_SEAT]), "alterEgo", P1);
    const run = revealCode(s0, METACIDAL);
    expect(hitPoints(run.state)).toBe(0);
    expect(tokens(run.state)).toBe(tokens(s0) + 1);
  });
  it("alter-ego with Dreadpool in play and no Corps ally: still no damage (3 instead of 2 changes nothing), 1 token", () => {
    const s0 = withForm(afterCrisis([POOL_SEAT]), "alterEgo", P1);
    const run = revealCode(s0, METACIDAL);
    expect(tokens(run.state)).toBe(tokens(s0) + 1);
  });
  it("alter-ego with a DEADPOOL CORPS ally (Dogpool, 4 hit points): the ally takes 2 and no token is placed", () => {
    const s0 = withAllies(withForm(baseGame([POOL_SEAT]), "alterEgo", P1), [P1, DOGPOOL]);
    const run = revealCode(s0, METACIDAL);
    expect(damageOf(run.state, idOf(run.state, DOGPOOL))).toBe(2);
    expect(tokens(run.state)).toBe(tokens(s0));
  });
  it("each Corps character: Deadpool (hero) and two allies take 3 with Dreadpool in play; Lady Deadpool (3 hit points) is defeated", () => {
    const s0 = withAllies(asHero(afterCrisis([POOL_SEAT])), [P1, DOGPOOL], [P1, LADY_DEADPOOL]);
    const run = revealCode(s0, METACIDAL);
    expect(hitPoints(run.state)).toBe(3);
    expect(damageOf(run.state, idOf(run.state, DOGPOOL))).toBe(3);
    expect(codes(run.state, playerOf(run.state, P1).playArea)).not.toContain(LADY_DEADPOOL);
    expect(tokens(run.state)).toBe(tokens(s0));
  });
  it("2 players: only the Corps characters take damage (Deadpool, hero form); Spider-Man and his ally Black Cat take none", () => {
    const s0 = withAllies(asHero(baseGame([POOL_SEAT, SPIDER_SEAT])), [P2, BLACK_CAT]);
    const run = revealCode(s0, METACIDAL, P2);
    expect(hitPoints(run.state, P1)).toBe(2);
    expect(hitPoints(run.state, P2)).toBe(0);
    expect(damageOf(run.state, idOf(run.state, BLACK_CAT))).toBe(0);
    expect(tokens(run.state)).toBe(tokens(s0));
  });
  it("2 players, Deadpool in alter-ego form and only Spider-Man's side Corps-free: no damage, 1 token", () => {
    const s0 = withForm(withAllies(baseGame([POOL_SEAT, SPIDER_SEAT]), [P2, BLACK_CAT]), "alterEgo", P1);
    const run = revealCode(s0, METACIDAL, P2);
    expect(tokens(run.state)).toBe(tokens(s0) + 1);
  });
  it("lethal for The Regeneratin' Degenerate: Deadpool at 8 of 9 takes 2, regenerates (hit points 1, alter-ego, +1 token)", () => {
    const s0 = hurt(asHero(baseGame([POOL_SEAT])), 8);
    const run = revealCode(s0, METACIDAL);
    expect(hitPoints(run.state)).toBe(8);
    expect(formOf(run.state)).toBe("alterEgo");
    expect(tokens(run.state)).toBe(tokens(s0) + 1);
  });
});

describe("Crisis of Infinite Deadpools (44037) as a boost card", () => {
  it("flipped as the villain's boost card it does nothing: 2 boost icons, the set stays aside, Crisis is discarded", () => {
    const s0 = patchInstance(asHero(baseGame([POOL_SEAT])), baseGame([POOL_SEAT]).mainScheme.instanceId, { threat: 0 });
    const stacked = onTop(s0, CRISIS);
    const run = endRound(stacked);
    expect(events(run.events, "boostCardFlipped").map((e) => codeOf(run.state, e.instanceId))).toEqual([CRISIS]);
    expect(inDiscard(run.state)).toContain(CRISIS);
    expect(aside(run.state).sort()).toEqual([DREADPOOL_MINION, DEEDS, RAY, POOLIZED, POOLIZED, METACIDAL].sort());
    expect(villainArea(run.state)).not.toContain(DEEDS);
    expect(removed(run.state)).not.toContain(CRISIS);
  });
  it("the boost adds its 2 icons to the villain's attack", () => {
    const s0 = asHero(baseGame([POOL_SEAT]));
    const withBoost = endRound(onTop(s0, CRISIS));
    const hit = events(withBoost.events, "damageDealt").find(
      (e) => e.sourceInstanceId === activeVillain(s0).instanceId,
    );
    const atk = characterProfile(s0, activeVillain(s0).instanceId, DEPS)!.atk;
    expect(hit?.amount).toBe(atk + 2);
  });
});
