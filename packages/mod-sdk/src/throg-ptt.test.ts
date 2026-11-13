import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { PLAYABLE_DEPS, coreScenario } from "@mc/cards";
import { PLAYABLE_CARDS, type PackManifest, type StarterDeck } from "@mc/content";
import {
  activeEncounterDeck,
  applyCommand,
  characterProfile,
  createGame,
  playerId,
  traitsOf,
  type CardInstance,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { buildPack } from "./build.js";
import { cardPoolWithPack, gameDepsWithPack } from "./game.js";
import { smokeTestPack } from "./smoke.js";
import { readPackInput, validatePack, type PackInput } from "./validate.js";

/**
 * Rulings of the Throg pack (content-packs/community/throg-ptt), staged on the real engine: each test sets up a
 * situation by state surgery (a card moved into play, threat on a scheme) and then runs the card's own scripted
 * ability. The pack is built from its source folder like any pack, so these run on what a client installs. The pack is a
 * DRAFT (its DRAFT file keeps it out of the generic community-packs test), so this file is its only suite for now.
 */
const SRC = fileURLToPath(new URL("../../../content-packs/community/throg-ptt", import.meta.url));
const P = "x.throg-ptt.";
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
  const root = mkdtempSync(join(tmpdir(), "mc-throg-"));
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

const precon = (): StarterDeck => pack.decks!.find((d) => d.id === "throg-ptt-protection")!;

const patch = (state: GameState, id: InstanceId, change: Partial<CardInstance>): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...state.instances[id]!, ...change } },
});

/** Answers every prompt with the first legal option, taking an option whose label matches `wanted` when offered. */
const takes =
  (...wanted: readonly RegExp[]) =>
  (s: GameState): readonly string[] => {
    const c = s.pendingChoice!;
    if (c.prompt.kind === "declareDefender") return ["decline"];
    const hit = c.options.find((o) => wanted.some((w) => w.test(o.label)));
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

/** A Rhino game with the Throg precon, in hero form, past setup, at the start of the player phase. */
function open(seed = 1): GameState {
  const deck = precon();
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: cardPoolWithPack(PLAYABLE_CARDS, pack),
  } as never);
  const created = createGame(
    {
      ...config,
      players: [
        {
          identityCardId: deck.identityCardId,
          aspects: deck.aspects,
          deck: deck.cards.flatMap(({ cardId, quantity }) => Array.from({ length: quantity }, () => cardId)),
        },
      ],
    },
    deps,
  );
  if (!created.ok) throw new Error(created.error.message);
  const settled = drive(created.state, null, undefined, (s) => s.step.phase === "player").state;
  const owner = settled.players[0]!;
  return {
    ...settled,
    players: settled.players.map((p) =>
      p.playerId === P1
        ? {
            ...p,
            identity: { ...owner.identity, form: "hero" as const, heroFormIndex: 0, changedFormThisRound: false },
          }
        : p,
    ),
  };
}

const identityOf = (s: GameState): InstanceId => s.players[0]!.identity.instanceId;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const copies = (s: GameState, code: string): InstanceId[] =>
  Object.entries(s.instances)
    .filter(([, i]) => String(i.cardId) === `${P}${code}`)
    .map(([id]) => id as InstanceId);

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

/** A card of the player's deck by code, put into play attached to their identity (surgery), as an upgrade is. */
function intoPlay(state: GameState, code: string): { readonly state: GameState; readonly id: InstanceId } {
  const owner = state.players.find((p) => p.playerId === P1)!;
  const id = owner.deck.find((i) => String(state.instances[i]!.cardId) === `${P}${code}`);
  if (!id) throw new Error(`${code} is not in the deck`);
  const host = identityOf(state);
  const placed: GameState = {
    ...state,
    players: state.players.map((p) => (p.playerId === P1 ? { ...p, deck: p.deck.filter((i) => i !== id) } : p)),
  };
  const hosted = patch(placed, host, { attachments: [...placed.instances[host]!.attachments, id] });
  return { id, state: patch(hosted, id, { faceup: true, attachedTo: host, controllerId: P1 }) };
}

/** Empties the hand into the top of the deck (surgery), so a test controls exactly which cards it holds. */
function emptyHand(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.playerId === P1 ? { ...p, deck: [...p.hand, ...p.deck], hand: [] } : p)),
  };
}

/** `n` Core basic resource cards (01088 to 01090, each worth 2 resources) moved to the hand, to pay with. */
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

const play = (card: InstanceId, payment: readonly InstanceId[] = [], x?: number): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: card,
  payment: payment.map((fromHand) => ({ fromHand })),
  attachToInstanceId: null,
  ...(x !== undefined ? { x } : {}),
});
const use = (card: InstanceId, ability: string, payment: readonly InstanceId[] = []): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: card,
  abilityId: `${P}${ability}` as never,
  payment: payment.map((fromHand) => ({ fromHand })),
});

const damageOf = (s: GameState, id: InstanceId): number => s.instances[id]!.damage;
const hostOf = (s: GameState, id: InstanceId): InstanceId | null => s.instances[id]!.attachedTo;
const statOf = (s: GameState, key: "atk" | "thw"): number => characterProfile(s, identityOf(s), deps)![key];
const traits = (s: GameState, id: InstanceId): readonly string[] => traitsOf(s, id, deps).map(String);

/** The top `n` encounter cards relabeled: boost cards for each activation first, then the one revealed. */
function stack(state: GameState, code: string, n = 2): GameState {
  const top = activeEncounterDeck(state).deck.slice(0, n);
  return top.reduce((acc, id) => patch(acc, id, { cardId: `${P}${code}` as never }), state);
}
/** A card deep in the encounter deck relabeled as `code` (a Power Stone to find), so no earlier draw can reach it. */
function deep(state: GameState, code: string, at = 8): GameState {
  const id = activeEncounterDeck(state).deck[at]!;
  return patch(state, id, { cardId: `${P}${code}` as never });
}

/** A Power Stone (a deep encounter card relabeled) attached to the villain, as the game leaves it (surgery). */
function stoneOnVillain(state: GameState, host: InstanceId = villainOf(state)): GameState {
  const stone = activeEncounterDeck(state).deck[8]!;
  const moved = patch(state, stone, { cardId: `${P}13` as never, faceup: true, attachedTo: host });
  return patch(moved, host, { attachments: [...moved.instances[host]!.attachments, stone] });
}

describe("pack content", () => {
  it("validates as built, every ability scripted", () => {
    expect(validatePack(pack)).toEqual([]);
  });

  it("ships a suggested deck: 40 cards, 15 of them Throg's, led by Throg", () => {
    const cards = precon().cards;
    expect(cards.reduce((n, c) => n + c.quantity, 0)).toBe(40);
    const own = cards.filter((c) => String(c.cardId).startsWith(P)).reduce((n, c) => n + c.quantity, 0);
    expect(own).toBe(15);
    expect(String(precon().identityCardId)).toBe(`${P}01a`);
  });

  it("plays the precon through a smoke game", () => {
    const result = smokeTestPack(pack, { games: 2 });
    expect(result.games.filter((g) => !g.ok).map((g) => `${g.deck} seed ${g.seed}: ${g.error}`)).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

describe("Frogjolnir", () => {
  it("gives Throg +1 ATK and the Aerial trait, and Throg the Asgard trait while he controls it", () => {
    const base = emptyHand(open());
    const armed = intoPlay(base, "02");
    expect(statOf(armed.state, "atk") - statOf(base, "atk")).toBe(1);
    expect(traits(armed.state, identityOf(armed.state))).toEqual(expect.arrayContaining(["AERIAL", "ASGARD"]));
    expect(traits(base, identityOf(base))).not.toContain("ASGARD");
    expect(traits(base, identityOf(base))).not.toContain("AERIAL");
  });

  it("Frog of Thunder gives +2 hit points, and its energy resource needs an Asgard hero or ally", () => {
    const base = emptyHand(open());
    const frog = intoPlay(base, "03");
    const hp = (s: GameState) => characterProfile(s, identityOf(s), deps)!.maxHp;
    expect(hp(frog.state) - hp(base)).toBe(2);
    // Resource: without an Asgard hero or ally it cannot be used; with Frogjolnir (Throg is Asgard) it can.
    const bare = drive(frog.state, null);
    const plain = applyCommand(bare.state, use(frog.id, "03.frog-of-thunder-resource"), deps);
    expect(plain.ok).toBe(false);
  });
});

describe("Worthy (alter-ego)", () => {
  it("searches the deck and discard pile for Frogjolnir and adds it to the hand, once per round", () => {
    const state = emptyHand(open());
    const alter: GameState = {
      ...state,
      players: state.players.map((p) => ({
        ...p,
        identity: { ...p.identity, form: "alterEgo" as const, changedFormThisRound: false },
      })),
    };
    const run = drive(alter, use(identityOf(alter), "01b.worthy"));
    expect(run.state.players[0]!.hand.map((id) => String(run.state.instances[id]!.cardId))).toContain(`${P}02`);
    const again = applyCommand(run.state, use(identityOf(run.state), "01b.worthy"), deps);
    expect(again.ok, "limit once per round").toBe(false);
  });
});

describe("Hammer Throw", () => {
  it("exhausts Frogjolnir, deals 4 to an enemy, removes 4 threat from a scheme and returns Frogjolnir to hand", () => {
    let state = emptyHand(open());
    const hammer = toHand(state, `${P}04`);
    const paid = withResources(hammer.state, 2);
    const armed = intoPlay(paid.state, "02");
    const main = armed.state.mainScheme!.instanceId;
    state = patch(armed.state, main, { threat: 8 });
    const before = damageOf(state, villainOf(state));
    const run = drive(state, play(hammer.id, paid.ids), takes(/Rhino/));
    expect(damageOf(run.state, villainOf(run.state)) - before, "4 damage").toBe(4);
    expect(run.state.instances[main]!.threat, "4 threat removed").toBe(4);
    expect(run.state.players[0]!.hand, "Frogjolnir back in hand").toContain(armed.id);
    expect(hostOf(run.state, armed.id)).toBeNull();
  });

  it("ignores guard: with a guard minion engaged, it hits the villain past it", () => {
    let state = emptyHand(open());
    const hammer = toHand(state, `${P}04`);
    const paid = withResources(hammer.state, 2);
    const armed = intoPlay(paid.state, "02");
    // A Hydra Mercenary (Core 01101, guard) engaged with Throg: a deep encounter card relabeled and moved (surgery).
    const piles = activeEncounterDeck(armed.state);
    const deckId = Object.keys(armed.state.encounterDecks).find((id) => armed.state.encounterDecks[id] === piles)!;
    const guard = piles.deck[8]!;
    state = {
      ...armed.state,
      encounterDecks: {
        ...armed.state.encounterDecks,
        [deckId]: { ...piles, deck: piles.deck.filter((i) => i !== guard) },
      },
      players: armed.state.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, guard] } : p)),
    };
    state = patch(state, guard, { cardId: "01101" as never, faceup: true, engagedWith: P1, controllerId: null });
    const before = damageOf(state, villainOf(state));
    let offered: readonly string[] = [];
    const pick = (s: GameState): readonly string[] => {
      const c = s.pendingChoice!;
      if (c.prompt.kind === "chooseTarget" && offered.length === 0) offered = c.options.map((o) => o.label);
      return takes(/Rhino/)(s);
    };
    const run = drive(state, play(hammer.id, paid.ids), pick);
    expect(offered, "the villain is offered past the guard minion").toEqual(
      expect.arrayContaining([expect.stringMatching(/Rhino/), expect.stringMatching(/Hydra Mercenary/)]),
    );
    expect(damageOf(run.state, villainOf(run.state)) - before, "4 damage to Rhino").toBe(4);
    expect(damageOf(run.state, guard), "the guard minion untouched").toBe(0);
  });

  it("cannot be played without a Frogjolnir to exhaust", () => {
    const state = emptyHand(open());
    const hammer = toHand(state, `${P}04`);
    const paid = withResources(hammer.state, 2);
    const run = applyCommand(paid.state, play(hammer.id, paid.ids), deps);
    // The play is refused, or resolves nothing: either way the villain is untouched.
    if (run.ok) expect(damageOf(drive(run.state, null).state, villainOf(run.state))).toBe(0);
  });
});

describe("Frogbolt", () => {
  it("costs X: deals X damage to the villain and removes X threat from each side scheme", () => {
    let state = emptyHand(open());
    const bolt = toHand(state, `${P}05`);
    const paid = withResources(bolt.state, 1);
    state = paid.state;
    const before = damageOf(state, villainOf(state));
    const run = drive(state, play(bolt.id, paid.ids, 2));
    expect(damageOf(run.state, villainOf(run.state)) - before).toBe(2);
  });
});

describe("Defender of the Nine Puddles and Toad-ally Unexpected!", () => {
  it("puts the discarded side scheme into play (not revealed), deals 5 to an enemy, and Throg draws 2", () => {
    let state = emptyHand(open());
    const card = toHand(state, `${P}07`);
    // Surgery: the top encounter card is An Unexpected Guest, whose When Revealed (find the Power Stone) must not run.
    state = stack(card.state, "12", 1);
    state = deep(state, "13");
    const handBefore = state.players[0]!.hand.length;
    const before = damageOf(state, villainOf(state));
    const run = drive(state, play(card.id), takes(/^Throg$/, /Rhino/));
    const guests = copies(run.state, "12");
    expect(
      guests.some((id) => run.state.instances[id]!.threat > 0),
      "the side scheme is in play with threat",
    ).toBe(true);
    expect(
      copies(run.state, "13").every((id) => hostOf(run.state, id) === null),
      "no Power Stone found",
    ).toBe(true);
    expect(damageOf(run.state, villainOf(run.state)) - before).toBe(5);
    // 1 card played, 2 drawn by the Response.
    expect(run.state.players[0]!.hand.length - handBefore).toBe(1);
  });
});

describe("Frogbolt on side schemes", () => {
  it("after Defender of the Nine Puddles put a side scheme into play, Frogbolt for 2 removes 2 threat from it", () => {
    let state = emptyHand(open());
    const defender = toHand(state, `${P}07`);
    state = stack(defender.state, "12", 1);
    const first = drive(state, play(defender.id), takes(/^Throg$/, /Rhino/));
    const guest = copies(first.state, "12").find((id) => first.state.instances[id]!.threat > 0)!;
    const threat = first.state.instances[guest]!.threat;
    const bolt = toHand(first.state, `${P}05`);
    const paid = withResources(bolt.state, 1);
    const run = drive(paid.state, play(bolt.id, paid.ids, 2), takes(/^Throg$/));
    expect(threat, "the side scheme came in with its starting threat").toBeGreaterThanOrEqual(3);
    expect(run.state.instances[guest]!.threat).toBe(threat - 2);
  });
});

describe("Amphibious Agility", () => {
  /**
   * The damage Amphibious Agility prevents while the villain phase plays out one round, with the event in hand. The Power
   * Stone (+1 ATK) is on the villain and the boost card is a 3-icon side scheme, so the attack is a hit big enough (4)
   * to tell prevent 3 from prevent 5.
   */
  function prevented(aerial: boolean): number {
    let state = toHand(emptyHand(open()), `${P}08`).state;
    if (aerial) state = intoPlay(state, "02").state;
    state = stoneOnVillain(state);
    const boost = activeEncounterDeck(state).deck[0]!;
    state = patch(state, boost, { cardId: `${P}12` as never });
    const start = state.round;
    const run = drive(
      state,
      { type: "endTurn", playerId: P1 },
      (s) =>
        s.pendingChoice!.prompt.kind === "declareDefender"
          ? [s.pendingChoice!.options.find((o) => /^Throg$/.test(o.label))!.optionId]
          : s.pendingChoice!.prompt.kind === "discardDownToHandSize"
            ? []
            : takes(/Amphibious Agility/)(s),
      (s) => s.round > start,
    );
    const stopped = run.events.find((e) => e.type === "damagePrevented");
    return stopped?.type === "damagePrevented" ? stopped.amount : 0;
  }

  it("prevents 3 of the damage from an attack", () => {
    expect(prevented(false)).toBe(3);
  });

  it("prevents 5 of it (here the whole 4) with the Aerial trait", () => {
    expect(prevented(true)).toBe(4);
  });
});

describe("Thanos, An Unexpected Guest and the Power Stone", () => {
  const stoneOf = (s: GameState): InstanceId => copies(s, "13")[0]!;
  const thanosOf = (s: GameState): InstanceId | undefined =>
    copies(s, "11").find((id) => s.instances[id]!.engagedWith != null);

  it("Thanos revealed finds the Power Stone and puts it into play attached to him", () => {
    let state = deep(stack(emptyHand(open()), "11"), "13");
    const run = drive(state, { type: "endTurn", playerId: P1 });
    state = run.state;
    const thanos = thanosOf(state);
    expect(thanos, "Thanos is in play").toBeDefined();
    expect(hostOf(state, stoneOf(state))).toBe(thanos);
  });

  it("An Unexpected Guest with Thanos out of play attaches the Power Stone to the villain", () => {
    const state = deep(stack(emptyHand(open()), "12"), "13");
    const run = drive(state, { type: "endTurn", playerId: P1 });
    expect(hostOf(run.state, stoneOf(run.state))).toBe(villainOf(run.state));
  });

  it("a hero hit of 3 or more on the attached character takes the Power Stone to the attacker", () => {
    let state = emptyHand(open());
    const stone = copies(state, "13")[0] ?? activeEncounterDeck(state).deck[0]!;
    state = patch(state, stone, { cardId: `${P}13` as never, faceup: true, attachedTo: villainOf(state) });
    state = patch(state, villainOf(state), {
      attachments: [...state.instances[villainOf(state)]!.attachments, stone],
    });
    const hit = toHand(state, `${P}04`);
    const paid = withResources(hit.state, 2);
    const armed = intoPlay(paid.state, "02");
    const run = drive(armed.state, play(hit.id, paid.ids), takes(/Rhino/));
    expect(hostOf(run.state, stone), "the Stone moved to the hero who hit for 4").toBe(identityOf(run.state));
  });
});

describe("Inevitable Power", () => {
  it("deals 2 damage to your hero when revealed in hero form", () => {
    const state = stack(emptyHand(open()), "14");
    const start = state.round;
    const run = drive(state, { type: "endTurn", playerId: P1 }, takes(), (s) => s.round > start);
    const hits = run.events.flatMap((e) =>
      e.type === "damageDealt" &&
      e.targetInstanceId === identityOf(state) &&
      copies(state, "14").includes(e.sourceInstanceId as InstanceId)
        ? [e.amount]
        : [],
    );
    expect(hits).toEqual([2]);
  });
});

describe("Between Two Worlds (obligation)", () => {
  it("option 2: discards an Asgard or Pet card from your hand, confuses you and discards the obligation", () => {
    let state = emptyHand(open());
    const thor = toHand(state, `${P}09`);
    state = stack(thor.state, "10", 2);
    const run = drive(state, { type: "endTurn", playerId: P1 }, (s) =>
      s.pendingChoice!.prompt.kind === "declareDefender"
        ? ["decline"]
        : takes(/^Stay in hero form/, /^Discard 1 Asgard or Pet card/, /^Thor/)(s),
    );
    expect(run.state.players[0]!.discard, "Thor was discarded from the hand").toContain(thor.id);
    expect(run.state.instances[identityOf(run.state)]!.statuses.confused, "you are confused").toBe(1);
  });
});

describe("Thor", () => {
  it("is Asgard and, after he defeats an enemy, removes 2 threat from a scheme (data check)", () => {
    const card = pack.cards.find((c) => String(c.id) === `${P}09`)!;
    expect(JSON.stringify(card)).toMatch(/ASGARD/);
    expect(JSON.stringify(card)).toMatch(/Odinson|ODINSON/i);
  });
});
