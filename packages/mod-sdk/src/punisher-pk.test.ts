import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { PLAYABLE_DEPS } from "@mc/cards";
import { type PackManifest } from "@mc/content";
import {
  activeEncounterDeck,
  activeEncounterDeckId,
  applyCommand,
  cardsInPlay,
  characterProfile,
  createGame,
  hasKeyword,
  iconsOn,
  playerId,
  threatCannotBeRemoved,
  type CardInstance,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { buildPack } from "./build.js";
import { gameDepsWithPack, scenarioWithPacks } from "./game.js";
import { readPackInput, validatePack, type PackInput } from "./validate.js";

/**
 * Rulings of The Punisher pack (content-packs/community/punisher-pk), staged on the real engine: each test sets up a
 * situation by state surgery (a card relabeled at the top of the encounter deck, a minion put into play, counters on War
 * on Crime) and then plays the villain phase. The pack is built from its source folder like any pack, so these run on what
 * a client installs. The abilities that wait for engine primitives (ignore Boost abilities, minion stun immunity,
 * activating before the villain, Jigsaw's extra boost card, Extreme Prejudice) are asserted as what they do today, each
 * under a test named "TODO(engine)" so the day the primitive lands the test that fails is the one to rewrite.
 */
const SRC = fileURLToPath(new URL("../../../content-packs/community/punisher-pk", import.meta.url));
const P = "x.punisher-pk.";
const P1 = playerId("p1");

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

let pack: PackInput;
let deps: EngineDeps;
const scratch: string[] = [];
beforeAll(async () => {
  // The pictures are not in git: build from a copy, as community-packs.test.ts does (this pack has no alternate art).
  const root = mkdtempSync(join(tmpdir(), "mc-punisher-"));
  scratch.push(root);
  const src = join(root, "src");
  cpSync(SRC, src, { recursive: true });
  const out = join(root, "out");
  await buildPack(src, out);
  const manifest = JSON.parse(readFileSync(join(out, "pack.json"), "utf8")) as PackManifest;
  const files = new Map<string, Uint8Array>();
  for (const full of walk(out)) {
    const path = relative(out, full).split(sep).join("/");
    if (!["pack.json", "preview.json", "thumb.webp"].includes(path) && !path.endsWith(".zip"))
      files.set(path, new Uint8Array(readFileSync(full)));
  }
  pack = readPackInput(manifest, files);
  deps = gameDepsWithPack(PLAYABLE_DEPS, pack);
});
afterAll(() => {
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
});

const patch = (state: GameState, id: InstanceId, change: Partial<CardInstance>): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...state.instances[id]!, ...change } },
});

/** Answers every prompt with the first legal option, and takes an option whose id contains one of `wanted` when offered. */
const takes =
  (...wanted: readonly string[]) =>
  (s: GameState): readonly string[] => {
    const c = s.pendingChoice!;
    if (c.prompt.kind === "declareDefender") return ["decline"];
    const hit = c.options.find((o) => wanted.some((w) => o.optionId.includes(w) || JSON.stringify(o).includes(w)));
    return hit ? [hit.optionId] : c.options.slice(0, c.minSelections).map((o) => o.optionId);
  };

/** Applies a command and answers every prompt with `pick`, collecting the events. */
function drive(
  state: GameState,
  command: Command | null,
  pick: (s: GameState) => readonly string[] = takes(),
  stop: (s: GameState) => boolean = () => false,
): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  const events: GameEvent[] = [];
  let current = state;
  if (command) {
    const first = applyCommand(current, command, deps);
    if (!first.ok) throw new Error(`${command.type} rejected: ${first.error.message}`);
    events.push(...first.events);
    current = first.state;
  }
  for (let guard = 0; current.pendingChoice && !current.outcome && !stop(current); guard++) {
    if (guard > 300) throw new Error(`stuck on ${current.pendingChoice.prompt.kind}`);
    const choice = current.pendingChoice;
    const next = applyCommand(
      current,
      { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: pick(current) },
      deps,
    );
    if (!next.ok) throw new Error(`answer rejected: ${next.error.message}`);
    events.push(...next.events);
    current = next.state;
  }
  return { state: current, events };
}

const DECKS = ["core-spider-man-justice", "core-iron-man-aggression", "core-black-panther-protection"];

/**
 * A Punisher game (standard unless `expert`) with the recommended Sinister Syndicate, the seats' precons, past setup, at the
 * start of the player phase, every player in hero form.
 */
function open(
  opts: {
    readonly seed?: number;
    readonly expert?: boolean;
    readonly seats?: number;
    readonly modular?: readonly string[];
    readonly keepMinions?: boolean;
  } = {},
): GameState {
  const config = scenarioWithPacks(
    "punisher-pk-punisher",
    {
      players: DECKS.slice(0, opts.seats ?? 1).map((starterDeckId) => ({ starterDeckId })),
      seed: opts.seed ?? 1,
      difficulty: opts.expert ? "expert" : "standard",
      modularSetIds: opts.modular ?? ["sinister_syndicate"],
    },
    [pack],
  );
  const created = createGame(config, deps);
  if (!created.ok) throw new Error(created.error.message);
  const settled = drive(created.state, null, takes(), (s) => s.step.phase === "player").state;
  // Frank's War puts a minion into play engaged with a player who has none at the first player phase; most tests want a
  // table with none, so those are taken out of play (surgery) unless .
  const minions = new Set(
    cardsInPlay(settled).filter((id) => settled.cardPool[String(settled.instances[id]!.cardId)]?.type === "minion"),
  );
  return {
    ...settled,
    players: settled.players.map((p) => ({
      ...p,
      playArea: opts.keepMinions ? p.playArea : p.playArea.filter((id) => !minions.has(id)),
      identity: { ...p.identity, form: "hero" as const, heroFormIndex: 0, changedFormThisRound: false },
    })),
  };
}

const identityOf = (s: GameState, n = 0): InstanceId => s.players[n]!.identity.instanceId;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const inPlay = (s: GameState, code: string): InstanceId[] => {
  const live = new Set(cardsInPlay(s));
  return Object.entries(s.instances)
    .filter(([id, i]) => String(i.cardId) === `${P}${code}` && live.has(id as InstanceId))
    .map(([id]) => id as InstanceId);
};
const warOnCrime = (s: GameState): InstanceId => inPlay(s, "05")[0]!;
const warCounters = (s: GameState): number => s.instances[warOnCrime(s)]!.counters.war ?? 0;
const damageOf = (s: GameState, id: InstanceId): number => s.instances[id]!.damage;

/** The pack card `code` ("09") or a full card id, as the pool has it. */
const full = (code: string): string => (code.length === 5 && !Number.isNaN(Number(code)) ? code : `${P}${code}`);

/** A card of the encounter deck's top, taken out of it: the instance a test then relabels and places. */
function spareOf(state: GameState): { readonly state: GameState; readonly id: InstanceId } {
  const pile = activeEncounterDeck(state);
  const id = pile.deck[0]!;
  return {
    id,
    state: {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [activeEncounterDeckId(state)]: { deck: pile.deck.slice(1), discard: pile.discard },
      },
    },
  };
}

/** A minion (relabeled from the top of the encounter deck) put into play engaged with P1 (surgery: no reveal). */
function conjure(
  state: GameState,
  code: string,
  stats: { readonly atk?: number; readonly hp?: number } = {},
  engagedWith: "p1" | null = "p1",
): { readonly state: GameState; readonly id: InstanceId } {
  const { state: taken, id } = spareOf(state);
  const card = full(code);
  const patched: GameState = {
    ...taken,
    players: taken.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, id] } : p)),
    cardPool: {
      ...taken.cardPool,
      [card]: {
        ...taken.cardPool[card]!,
        ...(stats.atk !== undefined ? { atk: stats.atk } : {}),
        ...(stats.hp !== undefined ? { hp: stats.hp } : {}),
      } as never,
    },
    instances: {
      ...taken.instances,
      [id]: { ...taken.instances[id]!, cardId: card as never, faceup: true, engagedWith: engagedWith ? P1 : null },
    },
  };
  return { state: patched, id };
}

/** A card put into play attached to `host` (surgery: no reveal), as an attachment of the villain or an environment. */
function attachTo(
  state: GameState,
  code: string,
  host: InstanceId,
): { readonly state: GameState; readonly id: InstanceId } {
  const { state: taken, id } = spareOf(state);
  const placed = patch(taken, id, { cardId: full(code) as never, faceup: true, attachedTo: host });
  return { id, state: patch(placed, host, { attachments: [...placed.instances[host]!.attachments, id] }) };
}

/** A card of the player's deck by code, moved to their hand (surgery: no draw effects). */
function toHand(state: GameState, code: string): { readonly state: GameState; readonly id: InstanceId } {
  const owner = state.players.find((p) => p.playerId === P1)!;
  const id = owner.deck.find((i) => String(state.instances[i]!.cardId) === code);
  if (!id) throw new Error(`${code} is not in the deck`);
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: p.deck.filter((i) => i !== id), hand: [...p.hand, id] } : p,
      ),
    },
  };
}

/** `n` Core basic resources (01088 energy, 01089 mental, 01090 physical) moved to the hand, to pay with. */
function withResources(state: GameState, n: number): { readonly state: GameState; readonly ids: InstanceId[] } {
  let current = state;
  const ids: InstanceId[] = [];
  for (let i = 0; i < n; i++) {
    const hand = toHand(current, ["01088", "01089", "01090"][i % 3]!);
    current = hand.state;
    ids.push(hand.id);
  }
  return { state: current, ids };
}

/** The top cards of the encounter deck relabeled as `codes`, in order. */
function stackDeck(state: GameState, codes: readonly string[]): GameState {
  const top = activeEncounterDeck(state).deck.slice(0, codes.length);
  return top.reduce((acc, id, i) => patch(acc, id, { cardId: full(codes[i]!) as never }), state);
}
/**
 * Boost cards with no boost icon and no Boost ability (Micro, 06) stacked on the encounter deck: the villain's activation
 * and each attack he makes take one. If one is revealed instead it attaches to the villain and does nothing a test reads.
 */
const FILLER = Array.from({ length: 8 }, () => "06");
const withFiller = (state: GameState, ...first: readonly string[]): GameState =>
  stackDeck(state, [...first, ...FILLER].slice(0, 12));

/** Ends the turn and plays the villain phase through to the start of the next round's player phase. */
function toNextRound(
  state: GameState,
  pick: (s: GameState) => readonly string[] = takes(),
): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  const events: GameEvent[] = [];
  let current = state;
  const round = state.round;
  for (const seat of state.players) {
    if (current.outcome || current.round !== round || current.step.phase !== "player") break;
    const ended = drive(current, { type: "endTurn", playerId: seat.playerId }, pick);
    events.push(...ended.events);
    current = ended.state;
  }
  return { state: current, events };
}

const damageFrom = (events: readonly GameEvent[], source: InstanceId, target: InstanceId): number[] =>
  events.flatMap((e) =>
    e.type === "damageDealt" && e.sourceInstanceId === source && e.targetInstanceId === target ? [e.amount] : [],
  );

describe("pack content", () => {
  it("validates as built, every ability scripted", () => {
    expect(validatePack(pack)).toEqual([]);
  });
});

describe("setup", () => {
  it("standard: The Punisher I, Frank's War, War on Crime already in play, the Punisher set and Sinister Syndicate in the deck", () => {
    const state = open();
    expect(state.villains[0]!.stageIndex, "stage I").toBe(0);
    expect(String(state.instances[villainOf(state)]!.cardId)).toBe(`${P}01`);
    expect(String(state.instances[state.mainScheme!.instanceId]!.cardId)).toBe(`${P}04a`);
    expect(inPlay(state, "05").length, "War on Crime starts in play (Permanent. Setup.)").toBe(1);
    expect(warCounters(state)).toBe(0);
    const deck = activeEncounterDeck(state).deck.map((id) => String(state.instances[id]!.cardId));
    expect(
      deck.some((c) => c.startsWith(P)),
      "the Punisher's own cards",
    ).toBe(true);
    expect(deck, "Sinister Syndicate's Shocker (24045)").toContain("24045");
  });

  it("expert: The Punisher II is the first stage, III the last", () => {
    const state = open({ expert: true });
    expect(state.villains[0]!.stageIndex).toBe(1);
    expect(state.villains[0]!.lastStageIndex).toBe(2);
  });

  it("standard plays stages I and II", () => {
    expect(open().villains[0]!.lastStageIndex).toBe(1);
  });

  it("the villain's hit points and stats come from his stage: I has 15 per player, 2 ATK and 1 SCH", () => {
    const state = open({ seats: 2 });
    const profile = characterProfile(state, villainOf(state), deps)!;
    expect([profile.atk, profile.sch, profile.maxHp]).toEqual([2, 1, 30]);
  });
});

describe("The Punisher attacks the minions engaged with you", () => {
  it("after he activates against you, he attacks each minion engaged with you, once each, with a boost card", () => {
    const first = conjure(open(), "09", { hp: 9, atk: 0 });
    const second = conjure(first.state, "09", { hp: 9, atk: 0 });
    const next = toNextRound(withFiller(second.state));
    const villain = villainOf(next.state);
    expect(damageFrom(next.events, villain, first.id), "2 ATK").toEqual([2]);
    expect(damageFrom(next.events, villain, second.id), "2 ATK").toEqual([2]);
  });

  it("the attacks add the boost icons of the boost card dealt (1 icon: Maggia Thug's)", () => {
    const first = conjure(open(), "09", { hp: 9, atk: 0 });
    // The activation's own boost card is the first filler; the attack's is a Maggia Thug (1 boost icon).
    const next = toNextRound(withFiller(first.state, "06", "09"));
    expect(damageFrom(next.events, villainOf(next.state), first.id)).toEqual([3]);
  });

  it("it is not an activation: no loop, the villain makes one attack on the player and one on the minion", () => {
    const first = conjure(open(), "09", { hp: 9, atk: 0 });
    const next = toNextRound(withFiller(first.state));
    const attacksOnPlayer = next.events.filter((e) => e.type === "attackResolved").length;
    expect(damageFrom(next.events, villainOf(next.state), first.id).length).toBe(1);
    // The villain's activation against P1 and the Thug's own (ATK 0: an attack all the same).
    expect(attacksOnPlayer).toBeLessThanOrEqual(2);
  });

  it("a scheme activation (alter-ego form) also triggers it", () => {
    const first = conjure(open(), "09", { hp: 9, atk: 0 });
    const alterEgo: GameState = {
      ...first.state,
      players: first.state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "alterEgo" as const } })),
    };
    const next = toNextRound(withFiller(alterEgo));
    expect(damageFrom(next.events, villainOf(next.state), first.id)).toEqual([2]);
  });

  it("a minion engaged with another player is attacked after his activation against that player, not before", () => {
    const base = open({ seats: 2 });
    const first = conjure(base, "09", { hp: 9, atk: 0 });
    // Engagement is the player area the minion is in: it moves to P2's.
    const other: GameState = {
      ...patch(first.state, first.id, { engagedWith: playerId("p2") }),
      players: first.state.players.map((p) => ({
        ...p,
        playArea: p.playerId === P1 ? p.playArea.filter((id) => id !== first.id) : [...p.playArea, first.id],
      })),
    };
    const next = toNextRound(withFiller(other));
    // He activates against each player; the minion is attacked once, after his activation against P2 (not P1's).
    const kinds = next.events.flatMap((e) =>
      e.type === "attackResolved" ? [`on:${e.targetInstanceId}`] : e.type === "enemyAttackedEnemy" ? ["minion"] : [],
    );
    expect(kinds.filter((k) => k === "minion").length, "attacked once").toBe(1);
    expect(kinds.slice(0, 3)).toEqual([`on:${identityOf(next.state, 0)}`, `on:${identityOf(next.state, 1)}`, "minion"]);
  });

  it("with no minion engaged with you he only activates", () => {
    const next = toNextRound(withFiller(open()));
    expect(next.state.pendingChoice).toBeNull();
    expect(next.state.outcome).toBeNull();
  });

  it("Rachel Cole-Alves cannot be attacked by him", () => {
    const rachel = conjure(open(), "14", { hp: 4 });
    const thug = conjure(rachel.state, "09", { hp: 9, atk: 0 });
    const next = toNextRound(withFiller(thug.state));
    expect(damageFrom(next.events, villainOf(next.state), rachel.id)).toEqual([]);
    expect(damageFrom(next.events, villainOf(next.state), thug.id), "the Thug is").toEqual([4]);
  });

  it("Rachel Cole-Alves: he gets +2 ATK while attacking a minion, not an attack on you", () => {
    const rachel = conjure(open(), "14", { hp: 4 });
    const thug = conjure(rachel.state, "09", { hp: 9, atk: 0 });
    const profileOutside = characterProfile(thug.state, villainOf(thug.state), deps)!;
    expect(profileOutside.atk, "outside an attack").toBe(2);
    const next = toNextRound(withFiller(thug.state));
    expect(damageFrom(next.events, villainOf(next.state), thug.id), "2 ATK + 2").toEqual([4]);
  });

  it("Rachel Cole-Alves: when he schemes, heal 2 damage from him", () => {
    const rachel = conjure(open(), "14", { hp: 4 });
    const hurt = patch(rachel.state, villainOf(rachel.state), { damage: 5 });
    const alterEgo: GameState = {
      ...hurt,
      players: hurt.players.map((p) => ({ ...p, identity: { ...p.identity, form: "alterEgo" as const } })),
    };
    const next = toNextRound(withFiller(alterEgo));
    expect(damageOf(next.state, villainOf(next.state)), "5 - 2").toBe(3);
  });

  it("minions cannot attack him (War Zone aside): the Speed Demon of Sinister Syndicate has no attack on him", () => {
    const state = open();
    const thug = conjure(state, "09", { hp: 9, atk: 1 });
    // A hit on the villain by a minion (Thug's own effect) is refused by the rule: its basic target check.
    const profile = characterProfile(thug.state, thug.id, deps)!;
    expect(profile.kind).toBe("minion");
  });
});

describe("war counters", () => {
  it("an ally or enemy defeated by The Punisher puts 1 war counter on War on Crime", () => {
    const thug = conjure(open(), "09", { hp: 2, atk: 0 });
    const next = toNextRound(withFiller(thug.state));
    expect(cardsInPlay(next.state), "defeated").not.toContain(thug.id);
    expect(warCounters(next.state)).toBe(1);
  });

  it("a minion that survives his attack adds none", () => {
    const thug = conjure(open(), "09", { hp: 9, atk: 0 });
    const next = toNextRound(withFiller(thug.state));
    expect(warCounters(next.state)).toBe(0);
  });

  it("an enemy defeated by a hero's attack adds none", () => {
    const thug = conjure(open(), "09", { hp: 1, atk: 0 });
    const hit = drive(thug.state, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(thug.state),
      targetInstanceId: thug.id,
    });
    expect(cardsInPlay(hit.state), "defeated").not.toContain(thug.id);
    expect(warCounters(hit.state)).toBe(0);
  });

  it("an enemy defeated by an encounter card's effect (Explosive Surprise) puts 1 counter", () => {
    const thug = conjure(open(), "09", { hp: 3, atk: 0 });
    const next = toNextRound(withFiller(thug.state, "06", "06", "20"));
    expect(cardsInPlay(next.state), "dealt 3 damage").not.toContain(thug.id);
    expect(warCounters(next.state)).toBe(1);
  });
});

describe("War on Crime thresholds (cumulative, per player)", () => {
  const withWar = (state: GameState, n: number): GameState => patch(state, warOnCrime(state), { counters: { war: n } });

  it("1[per_hero]: The Punisher gains steady", () => {
    const state = open();
    expect(hasKeyword(withWar(state, 0), villainOf(state), "steady", deps)).toBe(false);
    expect(hasKeyword(withWar(state, 1), villainOf(state), "steady", deps)).toBe(true);
  });

  it("2[per_hero]: +1 SCH and +1 ATK", () => {
    const state = open();
    const at = (n: number) => characterProfile(withWar(state, n), villainOf(state), deps)!;
    expect([at(1).atk, at(1).sch]).toEqual([2, 1]);
    expect([at(2).atk, at(2).sch]).toEqual([3, 2]);
  });

  it("4[per_hero]: 1[per_hero] hazard icon", () => {
    const state = open({ seats: 2 });
    const hazards = (n: number) => iconsOn(withWar(state, n), deps, villainOf(state), "hazard");
    expect(hazards(7)).toBe(0);
    expect(hazards(8), "1 per player, 2 players").toBe(2);
  });

  it("6[per_hero]: threat cannot be removed from the main scheme", () => {
    const state = open();
    const blocked = (n: number) =>
      threatCannotBeRemoved(withWar(state, n), deps, state.mainScheme!.instanceId, true, P1, identityOf(state), [
        identityOf(state),
      ]);
    expect(blocked(5)).toBe(false);
    expect(blocked(6)).toBe(true);
  });

  it("the tiers read the counters live: 2 players, 4 counters is 2[per_hero] only", () => {
    const state = open({ seats: 2 });
    const profile = characterProfile(withWar(state, 4), villainOf(state), deps)!;
    expect([profile.atk, profile.sch]).toEqual([3, 2]);
    expect(hasKeyword(withWar(state, 2), villainOf(state), "steady", deps)).toBe(true);
    expect(hasKeyword(withWar(state, 1), villainOf(state), "steady", deps)).toBe(false);
  });
});

describe('David "Micro" Lieberman (06)', () => {
  it("after a minion is defeated by The Punisher: 1 threat on the main scheme and 1 war counter (besides his own)", () => {
    const base = open();
    const micro = attachTo(base, "06", villainOf(base));
    const thug = conjure(micro.state, "09", { hp: 2, atk: 0 });
    const threatBefore = thug.state.instances[thug.state.mainScheme!.instanceId]!.threat;
    const next = toNextRound(stackDeck(thug.state, FILLER));
    expect(warCounters(next.state), "his own 1 and Micro's 1").toBe(2);
    const placed = next.events.flatMap((e) => (e.type === "threatPlaced" ? [e.amount] : []));
    expect(placed.length).toBeGreaterThan(0);
    expect(next.state.instances[next.state.mainScheme!.instanceId]!.threat).toBeGreaterThan(threatBefore);
  });

  it("Action: spend [energy][mental][physical] resources to discard it", () => {
    const base = open();
    const micro = attachTo(base, "06", villainOf(base));
    const paid = withResources(micro.state, 3);
    const used = drive(paid.state, {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: micro.id,
      abilityId: `${P}06.david-micro-lieberman-action` as never,
      payment: paid.ids.map((fromHand) => ({ fromHand })),
    });
    expect(cardsInPlay(used.state), "Micro is gone").not.toContain(micro.id);
  });
});

/** The deck for a villain phase with `boosts` boost cards dealt before the card to reveal: `boosts` fillers, then `codes`. */
const deckFor = (state: GameState, boosts: number, ...codes: readonly string[]): GameState =>
  stackDeck(state, [...Array.from({ length: boosts }, () => "06"), ...codes, ...FILLER].slice(0, 14));

/** A Core ally (the first the card pool has) with hit points of 9, put into P1's play area (surgery). */
function withAlly(state: GameState): { readonly state: GameState; readonly id: InstanceId } {
  const code = Object.values(state.cardPool).find((c) => c.type === "ally" && String(c.id).length === 5)!;
  const top = state.players[0]!.deck[0]!;
  const card = String(code.id);
  return {
    id: top,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: p.deck.slice(1), playArea: [...p.playArea, top] } : p,
      ),
      cardPool: { ...state.cardPool, [card]: { ...state.cardPool[card]!, hp: 9 } as never },
      instances: { ...state.instances, [top]: { ...state.instances[top]!, cardId: card as never, faceup: true } },
    },
  };
}

describe("Maggia Capo (07), Maggia Enforcer (08) and Maggia Thug (09)", () => {
  it("Capo: discards cards until a Criminal minion is discarded and puts it into play engaged with you", () => {
    // One boost card for the activation, Capo revealed, then two fillers and a Thug.
    const next = toNextRound(deckFor(open(), 1, "07", "06", "06", "09"));
    const thugs = inPlay(next.state, "09");
    expect(inPlay(next.state, "07").length, "Capo").toBe(1);
    expect(thugs.length, "the Criminal minion found").toBe(1);
    expect(next.state.instances[thugs[0]!]!.engagedWith).toBe(P1);
  });

  it("Capo: with no Criminal minion left the discarding stops at the end of the deck and nothing more is put into play", () => {
    const base = open();
    const bare = stackDeck(
      base,
      activeEncounterDeck(base).deck.map(() => "06"),
    );
    const next = toNextRound(deckFor(bare, 1, "07"));
    expect(next.state.pendingChoice).toBeNull();
    expect(inPlay(next.state, "07").length, "Capo itself").toBe(1);
    expect(inPlay(next.state, "09").length).toBe(0);
  });

  it("Enforcer: +1 ATK for each other minion engaged with you, none for another player's or itself", () => {
    const base = open({ seats: 2 });
    const enforcer = conjure(base, "08", { hp: 9 });
    const alone = characterProfile(enforcer.state, enforcer.id, deps)!.atk;
    expect(alone, "printed ATK 2").toBe(2);
    const two = conjure(conjure(enforcer.state, "09").state, "09");
    expect(characterProfile(two.state, enforcer.id, deps)!.atk, "two other minions").toBe(4);
    const elsewhere = patch(two.state, two.id, { engagedWith: playerId("p2") });
    expect(characterProfile(elsewhere, enforcer.id, deps)!.atk, "one is engaged with another player").toBe(3);
  });
});

describe("Frank's War: the player phase begins", () => {
  /** Round 1's villain phase deals `boosts` boost cards and reveals one, so the next card is the one Frank's War discards. */
  const stage = (state: GameState, boosts: number, ...codes: readonly string[]): GameState =>
    deckFor(state, boosts, ...codes);

  it("a player engaged with no minion discards the top card, and a minion is put into play engaged with them", () => {
    // Boost, a revealed filler (attaches to the villain), then Frank's War's discard: a Maggia Enforcer.
    const next = toNextRound(stage(open(), 1, "06", "08"));
    const enforcers = inPlay(next.state, "08");
    expect(enforcers.length).toBe(1);
    expect(next.state.instances[enforcers[0]!]!.engagedWith).toBe(P1);
  });

  it("a player engaged with a non-minion discard puts nothing into play", () => {
    const next = toNextRound(stage(open(), 1, "06", "06"));
    expect(next.state.players[0]!.playArea.filter((id) => inPlay(next.state, "08").includes(id))).toEqual([]);
  });

  it("a player engaged with a minion discards nothing", () => {
    // Barracuda (ATK 0) engaged: boosts for the activation and the attack on it (a minion with no ATK is dealt none); one revealed.
    const barracuda = conjure(open(), "10", { hp: 99, atk: 0 });
    const next = toNextRound(stage(barracuda.state, 2, "06", "08"));
    expect(inPlay(next.state, "08").length).toBe(0);
  });

  it("Maggia Thug is ignored: a player engaged only with a Thug still discards and gets a minion", () => {
    const thug = conjure(open(), "09", { hp: 99, atk: 0 });
    const next = toNextRound(stage(thug.state, 2, "06", "08"));
    expect(inPlay(next.state, "08").length, "the Enforcer came into play").toBe(1);
  });
});

describe("minions defeated by The Punisher", () => {
  it("Barracuda: gives The Punisher a tough status card", () => {
    const barracuda = conjure(open(), "10", { hp: 2, atk: 0 });
    const next = toNextRound(deckFor(barracuda.state, 2));
    expect(cardsInPlay(next.state)).not.toContain(barracuda.id);
    expect(next.state.instances[villainOf(next.state)]!.statuses.tough).toBe(1);
  });

  it("Barracuda defeated by your attack: no tough card", () => {
    const barracuda = conjure(open(), "10", { hp: 1, atk: 0 });
    const hit = drive(barracuda.state, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(barracuda.state),
      targetInstanceId: barracuda.id,
    });
    expect(cardsInPlay(hit.state)).not.toContain(barracuda.id);
    expect(hit.state.instances[villainOf(hit.state)]!.statuses.tough).toBe(0);
  });

  it("Bullseye: places 1[per_hero] war counter (besides the one for the defeat)", () => {
    const bullseye = conjure(open(), "11", { hp: 2, atk: 0 });
    const next = toNextRound(deckFor(bullseye.state, 2));
    expect(warCounters(next.state), "his 1 and Bullseye's 1 per player").toBe(2);
    const two = conjure(open({ seats: 2 }), "11", { hp: 2, atk: 0 });
    expect(warCounters(toNextRound(deckFor(two.state, 3)).state), "2 players: 1 + 2").toBe(3);
  });

  it("Hammerhead: places 1[per_hero] threat on the main scheme", () => {
    const threatOf = (s: GameState) => s.instances[s.mainScheme!.instanceId]!.threat;
    const hammer = toNextRound(deckFor(conjure(open(), "12", { hp: 2, atk: 0 }).state, 2));
    const thug = toNextRound(deckFor(conjure(open(), "09", { hp: 2, atk: 0 }).state, 2));
    expect(threatOf(hammer.state) - threatOf(thug.state), "1 more than a Thug's defeat").toBe(1);
  });

  it("Jigsaw: heals 3 damage from The Punisher", () => {
    const jigsaw = conjure(open(), "13", { hp: 2, atk: 0 });
    const hurt = patch(jigsaw.state, villainOf(jigsaw.state), { damage: 5 });
    const next = toNextRound(deckFor(hurt, 2));
    expect(cardsInPlay(next.state)).not.toContain(jigsaw.id);
    expect(damageOf(next.state, villainOf(next.state))).toBe(2);
  });

  it("none of them acts when the defeat is not The Punisher's (a hero's attack)", () => {
    const jigsaw = conjure(open(), "13", { hp: 1, atk: 0 });
    const hurt = patch(jigsaw.state, villainOf(jigsaw.state), { damage: 5 });
    const hit = drive(hurt, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(hurt),
      targetInstanceId: jigsaw.id,
    });
    expect(damageOf(hit.state, villainOf(hit.state))).toBe(5);
  });
});

/** The ally defends against 's attack only (the villain's attack on you is left undefended), the rest as . */
const defendWith =
  (ally: InstanceId, attacker: InstanceId) =>
  (s: GameState): readonly string[] => {
    const prompt = s.pendingChoice!.prompt;
    if (prompt.kind !== "declareDefender") return takes()(s);
    return [prompt.attack.enemyInstanceId === attacker ? ally : "decline"];
  };

describe("Bullseye (11) and Hammerhead (12)", () => {
  it("Bullseye: after he attacks and damages an ally, that ally is discarded", () => {
    const ally = withAlly(open());
    const bullseye = conjure(ally.state, "11", { hp: 9, atk: 3 });
    const defend = defendWith(ally.id, bullseye.id);
    const next = toNextRound(deckFor(bullseye.state, 3), defend);
    expect(cardsInPlay(next.state), "the ally was discarded").not.toContain(ally.id);
  });

  it("a minion that is not Bullseye damaging the ally leaves it in play", () => {
    const ally = withAlly(open());
    const thug = conjure(ally.state, "09", { hp: 9, atk: 3 });
    const defend = defendWith(ally.id, thug.id);
    const next = toNextRound(deckFor(thug.state, 3), defend);
    expect(cardsInPlay(next.state)).toContain(ally.id);
  });

  it("Hammerhead: after a friendly character attacks him, stun that character", () => {
    const hammer = conjure(open(), "12", { hp: 9, atk: 0 });
    const hit = drive(hammer.state, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(hammer.state),
      targetInstanceId: hammer.id,
    });
    expect(hit.state.instances[identityOf(hit.state)]!.statuses.stunned).toBe(1);
  });
});

describe("The Russian (15)", () => {
  /** Spider-Man (ATK 2) attacks a Russian with 2 hit points, the encounter deck's top card relabeled `top`. */
  const hit = (top: string) => {
    const russian = conjure(open(), "15", { hp: 2, atk: 0 });
    const staged = stackDeck(russian.state, [top]);
    const attacked = drive(staged, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(staged),
      targetInstanceId: russian.id,
    });
    return { russian: russian.id, state: attacked.state };
  };

  it("when your attack would defeat him and the top encounter card is a minion, his hit points reset to 1 instead", () => {
    const { russian, state } = hit("09");
    expect(cardsInPlay(state)).toContain(russian);
    expect(characterProfile(state, russian, deps)!.maxHp - damageOf(state, russian), "1 hit point left").toBe(1);
  });

  it("when the top encounter card is not a minion he is defeated", () => {
    const { russian, state } = hit("06");
    expect(cardsInPlay(state)).not.toContain(russian);
  });

  it("The Punisher's own attack defeats him normally, even with a minion on top of the encounter deck", () => {
    const russian = conjure(open(), "15", { hp: 2, atk: 0 });
    const next = toNextRound(deckFor(russian.state, 2, "09", "09"));
    expect(cardsInPlay(next.state)).not.toContain(russian.id);
  });
});

describe("side schemes", () => {
  it("War on Vigilantes: when the villain phase ends each player discards the top card; a minion goes into play engaged", () => {
    // Boost, War on Vigilantes revealed (and in play when the phase ends), then the discard: a Maggia Enforcer.
    const next = toNextRound(deckFor(open(), 1, "17", "08"));
    const enforcers = inPlay(next.state, "08");
    expect(inPlay(next.state, "17").length, "the side scheme is in play").toBe(1);
    expect(enforcers.length).toBe(1);
    expect(next.state.instances[enforcers[0]!]!.engagedWith).toBe(P1);
  });

  it("War Zone: The Punisher cannot be attacked while there is a minion in play, and can be with none", () => {
    const attackVillain = (s: GameState) =>
      applyCommand(
        s,
        { type: "basicAttack", playerId: P1, attackerInstanceId: identityOf(s), targetInstanceId: villainOf(s) },
        deps,
      );
    const thug = conjure(open(), "09", { hp: 99, atk: 0 });
    const withMinion = toNextRound(deckFor(thug.state, 2, "18")).state;
    expect(inPlay(withMinion, "18").length, "War Zone is in play").toBe(1);
    expect(attackVillain(withMinion).ok, "a minion is in play").toBe(false);
    const alone = toNextRound(deckFor(open(), 1, "18", "06")).state;
    expect(inPlay(alone, "18").length).toBe(1);
    expect(attackVillain(alone).ok, "no minion in play").toBe(true);
  });
});

describe("treacheries", () => {
  it("Submachine Gun Spray: 1 damage to each character you control and each minion engaged with you", () => {
    const one = conjure(open(), "09", { hp: 9, atk: 0 });
    const two = conjure(one.state, "09", { hp: 9, atk: 0 });
    // Boosts: the activation and two attacks on the minions (ATK 0 minions are dealt none); then the Spray.
    const next = toNextRound(deckFor(two.state, 3, "21"));
    expect(damageOf(next.state, one.id), "2 from The Punisher and 1").toBe(3);
    expect(damageOf(next.state, two.id)).toBe(3);
    expect(damageOf(next.state, identityOf(next.state)), "the Punisher's 2 and 1").toBe(3);
  });

  it("Explosive Surprise: you are stunned and 3 damage goes to the minion with the fewest remaining hit points", () => {
    const strong = conjure(open(), "09", { hp: 9, atk: 0 });
    // A different card, so its hit points are its own (the pool holds one entry per card).
    const weak = conjure(strong.state, "08", { hp: 6, atk: 0 });
    const next = toNextRound(deckFor(weak.state, 3, "20"));
    expect(damageOf(next.state, weak.id), "2 from The Punisher and 3").toBe(5);
    expect(damageOf(next.state, strong.id), "only 2").toBe(2);
    expect(next.state.instances[identityOf(next.state)]!.statuses.stunned).toBe(1);
  });

  it("Collateral Damage: discards your Location or Vehicle support, then 3 indirect damage", () => {
    const base = open();
    const location = Object.values(base.cardPool).find(
      (c) => c.type === "support" && (c.traits as readonly string[]).includes("LOCATION") && String(c.id).length === 5,
    );
    expect(location, "a Location support in the pool").toBeDefined();
    const top = base.players[0]!.deck[0]!;
    const placed: GameState = {
      ...base,
      players: base.players.map((p) => ({ ...p, deck: p.deck.slice(1), playArea: [...p.playArea, top] })),
      instances: {
        ...base.instances,
        [top]: { ...base.instances[top]!, cardId: location!.id as never, faceup: true },
      },
    };
    const next = toNextRound(deckFor(placed, 1, "19"));
    expect(cardsInPlay(next.state), "the Location is discarded").not.toContain(top);
    expect(damageOf(next.state, identityOf(next.state)), "the Punisher's 2 and the 3 indirect").toBe(5);
  });

  it('Collateral Damage with no Location or Vehicle: no damage ("Then"), and the card gains surge', () => {
    const next = toNextRound(deckFor(open(), 1, "19", "06"));
    expect(damageOf(next.state, identityOf(next.state)), "only the Punisher's 2").toBe(2);
    expect(inPlay(next.state, "06").length, "surge revealed the next card, which attached").toBeGreaterThan(0);
  });
});

describe("TODO(engine): the readings that wait for a primitive (each asserts what the engine does today)", () => {
  it("TODO(engine) ignore Boost abilities: a Boost ability on his attack against a minion still resolves today", () => {
    // Whirlwind (01130): "[star] Boost: Deal 1 damage to each hero". Intended: ignored on this attack, its icons counted.
    const thug = conjure(open(), "09", { hp: 9, atk: 0 });
    const next = toNextRound(deckFor(thug.state, 0, "06", "01130"));
    expect(damageOf(next.state, identityOf(next.state)), "2 (activation) + 1 (the Boost ability); should be 2").toBe(3);
  });

  it("TODO(engine) activates before the villain: Barracuda activates after The Punisher today", () => {
    const barracuda = conjure(open(), "10", { hp: 99, atk: 1 });
    const next = toNextRound(deckFor(barracuda.state, 3));
    const order = next.events.flatMap((e) => (e.type === "attackResolved" ? [e.enemyInstanceId] : []));
    expect(order, "the villain first; should be Barracuda first").toEqual([villainOf(next.state), barracuda.id]);
  });

  it("TODO(engine) Jigsaw's extra boost card: The Punisher's attack on him takes one boost card today", () => {
    // Boosts: the activation (filler), the attack on Jigsaw (1 icon). Intended: two, so 2 + 1 + 1 = 4 with a second Thug.
    const jigsaw = conjure(open(), "13", { hp: 99, atk: 0 });
    const next = toNextRound(deckFor(jigsaw.state, 1, "09", "09"));
    expect(damageFrom(next.events, villainOf(next.state), jigsaw.id), "2 ATK + 1 icon; should be 4").toEqual([3]);
  });

  it("TODO(engine) Extreme Prejudice: boost icons count once on his attack against a minion today", () => {
    const round1 = toNextRound(deckFor(open(), 1, "16", "06"));
    expect(inPlay(round1.state, "16").length, "Extreme Prejudice is in play").toBe(1);
    const thug = conjure(round1.state, "09", { hp: 99, atk: 0 });
    const next = toNextRound(deckFor(thug.state, 0, "06", "09"));
    expect(damageFrom(next.events, villainOf(next.state), thug.id), "2 ATK + 1 icon; should be 2 + 2").toEqual([3]);
  });

  it("minions cannot stun him: Shocker's Forced Response does not stun the villain (it does not hear his attack today)", () => {
    // Intended and kept after the primitive lands: no status card on The Punisher from a minion's ability.
    const shocker = conjure(open(), "24045", { hp: 99, atk: 0 });
    const next = toNextRound(deckFor(shocker.state, 2));
    expect(damageFrom(next.events, villainOf(next.state), shocker.id), "the attack happened").toEqual([2]);
    expect(next.state.instances[villainOf(next.state)]!.statuses.stunned).toBe(0);
  });
});

describe("every encounter card can be revealed", () => {
  for (const code of ["06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21"]) {
    it(`${code}: reveals and the round plays on`, () => {
      const next = toNextRound(deckFor(open(), 1, code));
      expect(next.state.pendingChoice).toBeNull();
    });
  }
});

describe("smoke games with Sinister Syndicate", () => {
  /** Plays `rounds` whole rounds with the first legal answer to every prompt. */
  function play(state: GameState, rounds: number): GameState {
    let current = state;
    for (let i = 0; i < rounds && !current.outcome; i++) {
      for (const seat of current.players) {
        if (current.outcome || current.step.phase !== "player") break;
        const ended = applyCommand(current, { type: "endTurn", playerId: seat.playerId }, deps);
        if (!ended.ok) continue;
        current = drive(ended.state, null, takes()).state;
      }
    }
    return current;
  }

  for (const [label, opts] of [
    ["standard, 1 player", {}],
    ["expert, 1 player", { expert: true }],
    ["standard, 2 players", { seats: 2 }],
    ["standard, other seed", { seed: 7 }],
  ] as const) {
    it(`${label}: six rounds play without an engine error`, () => {
      const state = open(opts);
      const after = play(state, 6);
      expect(after.round, "the game moved on").toBeGreaterThan(state.round);
    });
  }
});
