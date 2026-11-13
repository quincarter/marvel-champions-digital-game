import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { PLAYABLE_DEPS } from "@mc/cards";
import { type PackManifest } from "@mc/content";
import {
  activeEncounterDeck,
  activeEncounterDeckId,
  applyCommand,
  characterProfile,
  createGame,
  playerId,
  type CardInstance,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { buildPack } from "./build.js";
import { gameDepsWithPack, scenarioWithPacks } from "./game.js";
import { readPackInput, type PackInput } from "./validate.js";
import { dropMissingCover } from "./fixtures/drop-missing-cover.js";

/**
 * Rulings of the Mephisto pack (content-packs/community/mephisto-nep), staged on the real engine: each test sets up a
 * situation by state surgery (a card relabeled at the top of the encounter deck, damage on a character) and then runs
 * the card's own scripted ability. The pack is built from its source folder like any pack, so these run on what a client
 * installs.
 */
const SRC = fileURLToPath(new URL("../../../content-packs/community/mephisto-nep", import.meta.url));
const P = "x.mephisto-nep.";
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
  // The art is not in git: build from a copy without the alternate-art list, as community-packs.test.ts does.
  const root = mkdtempSync(join(tmpdir(), "mc-mephisto-"));
  scratch.push(root);
  const src = join(root, "src");
  cpSync(SRC, src, { recursive: true });
  dropMissingCover(src);
  if (!existsSync(join(src, "alt-art"))) {
    const file = join(src, "pack.json");
    const manifest = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
    delete manifest.altArt;
    writeFileSync(file, JSON.stringify(manifest));
  }
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

/**
 * A Mephisto game (standard unless `expert`), the seats' precons, past setup, at the start of the player phase, every
 * player in hero form.
 */
function open(
  opts: {
    readonly seed?: number;
    readonly expert?: boolean;
    readonly seats?: number;
    readonly modular?: readonly string[];
  } = {},
): GameState {
  const decks = ["core-spider-man-justice", "core-iron-man-aggression", "core-black-panther-protection"];
  const config = scenarioWithPacks(
    "mephisto-nep-mephisto",
    {
      players: decks.slice(0, opts.seats ?? 1).map((starterDeckId) => ({ starterDeckId })),
      seed: opts.seed ?? 1,
      difficulty: opts.expert ? "expert" : "standard",
      ...(opts.modular ? { modularSetIds: opts.modular } : {}),
    },
    [pack],
  );
  const created = createGame(config, deps);
  if (!created.ok) throw new Error(created.error.message);
  const settled = drive(created.state, null, takes(), (s) => s.step.phase === "player").state;
  return {
    ...settled,
    players: settled.players.map((p) => ({
      ...p,
      identity: { ...p.identity, form: "hero" as const, heroFormIndex: 0, changedFormThisRound: false },
    })),
  };
}

const identityOf = (s: GameState, n = 0): InstanceId => s.players[n]!.identity.instanceId;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const inPlay = (s: GameState, code: string): InstanceId[] =>
  Object.entries(s.instances)
    .filter(([, i]) => String(i.cardId) === `${P}${code}`)
    .map(([id]) => id as InstanceId);
const damnation = (s: GameState): readonly InstanceId[] => s.scenarioAreas?.Damnation ?? [];

/**
 * The top cards of the encounter deck relabeled as `codes`, in order, to be dealt in the villain phase. The villain's own
 * activation takes the first as its boost card (`04`, a Hell Lord with no boost icons, is the filler for it), so the card
 * to reveal is the second.
 */
function stackDeck(state: GameState, codes: readonly string[]): GameState {
  const top = activeEncounterDeck(state).deck.slice(0, codes.length);
  return top.reduce((acc, id, i) => patch(acc, id, { cardId: `${P}${codes[i]}` as never }), state);
}
/**
 * A card to be revealed by the next villain phase: after a boost-free boost card for the villain's activation, unless a
 * Bargain attachment keeps Mephisto from activating (Devil's Pacts), when no boost card is dealt.
 */
const revealing = (state: GameState, code: string): GameState => {
  const controlsBargain = Object.values(state.instances).some(
    (i) =>
      i.attachedTo !== null &&
      String(i.cardId).startsWith(P) &&
      ["05", "06", "07", "08", "09", "10", "11", "24", "26", "27", "28", "29", "43"].some(
        (c) => String(i.cardId) === `${P}${c}`,
      ),
  );
  return stackDeck(state, controlsBargain ? [code] : ["04", code]);
};

/** Ends the turn and plays the villain phase through to the start of the next round's player phase. */
function toNextRound(
  state: GameState,
  pick: (s: GameState) => readonly string[] = takes(),
): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  const round = state.round;
  void round;
  return drive(state, { type: "endTurn", playerId: P1 }, pick);
}

describe("setup", () => {
  it("puts Gateway to Corruption into play, sets the Hell Lord aside and creates the empty Damnation area", () => {
    const state = open();
    expect(inPlay(state, "03a").length).toBe(1);
    const gateway = inPlay(state, "03a")[0]!;
    expect(state.encounterSetAside, "Hell Lord is set aside").toContain(inPlay(state, "04")[0]!);
    expect(activeEncounterDeck(state).deck).not.toContain(inPlay(state, "04")[0]!);
    expect(state.scenarioAreas?.Damnation, "Damnation area exists and is empty").toEqual([]);
    expect(state.instances[gateway]!.cardId).toBe(`${P}03a`);
    void activeEncounterDeckId;
  });
});

const hostedOn = (s: GameState, host: InstanceId, code: string): InstanceId | undefined =>
  Object.entries(s.instances).find(([, i]) => i.attachedTo === host && String(i.cardId) === `${P}${code}`)?.[0] as
    | InstanceId
    | undefined;
/** Enemy attacks resolved (a hero in hero form is attacked when the villain activates against them). */
const activations = (events: readonly GameEvent[]): number => events.filter((e) => e.type === "attackResolved").length;
const ACCEPT = takes("Attach this card");
const REFUSE = takes("Do not attach");

/** A game where P1's identity carries Bargain attachment `code`, accepted in the first villain phase; round 2, player phase. */
function withBargain(code: string, base: GameState = open()): GameState {
  const next = toNextRound(revealing(base, code), ACCEPT);
  expect(hostedOn(next.state, identityOf(next.state), code), `${code} attached`).toBeDefined();
  return next.state;
}

describe("Bargain attachments", () => {
  it("accepted: it attaches to your identity (+2 hand size for Endless Greed) and Mephisto does not activate for it", () => {
    const first = toNextRound(revealing(open(), "05"), ACCEPT);
    expect(hostedOn(first.state, identityOf(first.state), "05"), "attached to the identity").toBeDefined();
    expect(activations(first.events), "only the villain phase's own activation").toBe(1);
    const second = toNextRound(first.state, takes("Do not"));
    const refills = second.events.flatMap((e) => (e.type === "handRefilled" ? [e.handSize] : []));
    expect(refills).toContain(7);
  });

  it("refused: it is discarded and Mephisto activates against you", () => {
    const next = toNextRound(revealing(open(), "05"), REFUSE);
    expect(hostedOn(next.state, identityOf(next.state), "05")).toBeUndefined();
    expect(activations(next.events), "the villain phase's activation and the penalty's").toBe(2);
  });
});

describe("Hidden Clause and Devil's Pacts", () => {
  it("stage 1B: at the end of your turn, 1[per_hero] card from the top of your deck goes facedown into Damnation", () => {
    const state = withBargain("05");
    const next = toNextRound(state);
    expect(damnation(next.state).length).toBe(1);
    const card = damnation(next.state)[0]!;
    expect(next.state.players[0]!.deck).not.toContain(card);
    expect(next.state.instances[card]!.faceup).toBe(false);
  });

  it("two Bargain attachments resolve it twice", () => {
    const two = withBargain("06", withBargain("05"));
    expect(damnation(toNextRound(two).state).length - damnation(two).length, "each Bargain resolves it once").toBe(2);
  });

  it("Devil's Pacts: while you control a Bargain, Mephisto does not activate against you and heals 1[per_hero] instead", () => {
    const state = withBargain("05");
    const hurt = patch(state, villainOf(state), { damage: 3 });
    const next = toNextRound(hurt);
    expect(activations(next.events), "Mephisto did not activate").toBe(0);
    expect(next.state.instances[villainOf(next.state)]!.damage, "healed 1").toBe(2);
  });

  it("Devil's Pacts: with no damage to heal it places 1 threat on the main scheme for each Bargain attachment in play", () => {
    const state = withBargain("05");
    const next = toNextRound(state);
    const placed = next.events.flatMap((e) => (e.type === "threatPlaced" ? [e.amount] : []));
    expect(placed).toContain(1);
  });
});

describe("Damnation", () => {
  /** `n` cards of P1's deck moved into Damnation by surgery. */
  const fill = (state: GameState, n: number): GameState => {
    const player = state.players[0]!;
    const moved = player.deck.slice(0, n);
    return {
      ...state,
      players: state.players.map((p) => (p.playerId === P1 ? { ...p, deck: p.deck.slice(n) } : p)),
      scenarioAreas: { ...state.scenarioAreas, Damnation: [...damnation(state), ...moved] },
    };
  };

  it("10[per_hero] cards in Damnation lose the game: the 10th card from Hidden Clause does, the 9th does not", () => {
    const state = fill(withBargain("05"), 8);
    const nine = toNextRound(state);
    expect(damnation(nine.state).length).toBe(9);
    expect(nine.state.outcome, "9 cards in Damnation for 1 hero").toBeNull();
    const ten = toNextRound(nine.state);
    expect(damnation(ten.state).length).toBe(10);
    expect(ten.state.outcome?.result).toBe("loss");
  });

  it("with 2 heroes the line is 20 cards", () => {
    const base = open({ seats: 2 });
    const fillBoth = (state: GameState, n: number): GameState =>
      state.players.reduce((acc, p) => {
        const moved = p.deck.slice(0, n);
        return {
          ...acc,
          players: acc.players.map((q) => (q.playerId === p.playerId ? { ...q, deck: q.deck.slice(n) } : q)),
          scenarioAreas: { ...acc.scenarioAreas, Damnation: [...(acc.scenarioAreas?.Damnation ?? []), ...moved] },
        };
      }, state);
    const eighteen = fillBoth(base, 9);
    expect(damnation(eighteen).length).toBe(18);
    expect(toNextRound(eighteen).state.outcome).toBeNull();
    const twenty = fillBoth(base, 10);
    expect(damnation(twenty).length).toBe(20);
    expect(toNextRound(twenty).state.outcome?.result).toBe("loss");
  });

  it("Gateway to Corruption: a card set aside from a player's deck goes facedown into Damnation instead", () => {
    // Soul Gambling (30) sets aside X[per_hero] cards for X corrupt counters on the player's Bargain attachments.
    const state = withBargain("26");
    const bargain = hostedOn(state, identityOf(state), "26")!;
    const counted = patch(state, bargain, { counters: { corrupt: 2 } });
    const next = toNextRound(revealing(counted, "30"));
    expect(
      damnation(next.state).length,
      "Hidden Clause (1) and 2 corrupt counters: 2 cards set aside into Damnation",
    ).toBe(3);
    expect(next.state.players[0]!.setAside.length, "nothing stayed in the set-aside area").toBe(
      counted.players[0]!.setAside.length,
    );
  });
});

/** A minion (relabeled from the top of the encounter deck) put into play engaged with P1 (surgery: no reveal). */
function conjure(
  state: GameState,
  code: string,
  stats: { readonly atk?: number; readonly hp?: number } = {},
): { readonly state: GameState; readonly id: InstanceId } {
  const pile = activeEncounterDeck(state);
  const spare = pile.deck[0]!;
  const full = code.length > 5 ? code : `${P}${code}`;
  const patched: GameState = {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [activeEncounterDeckId(state)]: { deck: pile.deck.slice(1), discard: pile.discard },
    },
    players: state.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, spare] } : p)),
    cardPool: {
      ...state.cardPool,
      [full]: {
        ...state.cardPool[full]!,
        ...(stats.atk !== undefined ? { atk: stats.atk } : {}),
        ...(stats.hp !== undefined ? { hp: stats.hp } : {}),
      } as never,
    },
    instances: {
      ...state.instances,
      [spare]: { ...state.instances[spare]!, cardId: full as never, faceup: true, engagedWith: P1 },
    },
  };
  return { state: patched, id: spare };
}

const damageTo = (events: readonly GameEvent[], target: InstanceId): number[] =>
  events.flatMap((e) => (e.type === "damageDealt" && e.targetInstanceId === target ? [e.amount] : []));
const damageFrom = (events: readonly GameEvent[], source: InstanceId, target: InstanceId): number[] =>
  events.flatMap((e) =>
    e.type === "damageDealt" && e.sourceInstanceId === source && e.targetInstanceId === target ? [e.amount] : [],
  );

describe("Slothful Endurance (10)", () => {
  /** A Demon Soldier with 1 ATK engaged with P1 while Slothful Endurance (or nothing) is on P1's identity. */
  function attackedBy(withSlothful: boolean, defend: boolean) {
    const base = withSlothful ? withBargain("10") : open();
    const minion = conjure(base, "33", { atk: 1 });
    const staged = stackDeck(minion.state, ["04"]);
    const pick = (s: GameState): readonly string[] => {
      const c = s.pendingChoice!;
      if (c.prompt.kind === "declareDefender") return [defend ? identityOf(s) : "decline"];
      return takes()(s);
    };
    return { id: identityOf(staged), run: toNextRound(staged, pick), minion: minion.id };
  }

  it("raises damage from an attack to your identity DEF (doubled to 6): 1 damage becomes 6", () => {
    const plain = attackedBy(false, false);
    expect(damageFrom(plain.run.events, plain.minion, plain.id), "without Slothful Endurance").toEqual([1]);
    const slothful = attackedBy(true, false);
    // Core Spider-Man has 3 DEF, doubled to 6: any attack that deals damage deals at least 6.
    expect(damageFrom(slothful.run.events, slothful.minion, slothful.id)).toEqual([6]);
  });

  it("does not raise damage that a defense or prevention takes to 0", () => {
    const defended = attackedBy(true, true);
    expect(damageFrom(defended.run.events, defended.minion, defended.id).filter((n) => n > 0)).toEqual([]);
  });
});

describe("Famished Power (27) and Shackled Wrath (09)", () => {
  /** A basic attack by P1 on a 9-hit-point minion, taking Famished Power's interrupt when it is offered. */
  function attackDamage(state: GameState): { readonly damage: number; readonly state: GameState } {
    const minion = conjure(state, "33", { hp: 9 });
    const pick = takes("27.interrupt", "Add your THW");
    const attacked = drive(
      minion.state,
      { type: "basicAttack", playerId: P1, attackerInstanceId: identityOf(minion.state), targetInstanceId: minion.id },
      pick,
    );
    return { damage: damageTo(attacked.events, minion.id).reduce((a, b) => a + b, 0), state: attacked.state };
  }

  it("combines two basic powers for one use (ATK + THW) for a corrupt counter", () => {
    const plain = attackDamage(open());
    const famished = withBargain("27");
    const combined = attackDamage(famished);
    // Core Spider-Man: ATK 2, THW 1, so the combined attack deals 3.
    expect(combined.damage).toBe(plain.damage + 1);
    const bargain = hostedOn(combined.state, identityOf(combined.state), "27")!;
    expect(combined.state.instances[bargain]!.counters.corrupt, "a corrupt counter paid for it").toBe(1);
  });

  it("with Shackled Wrath, the doubling comes after the sum: (ATK + THW) x 2 (RRG Modifiers order)", () => {
    const plain = attackDamage(open());
    const both = withBargain("27", withBargain("09"));
    const shackledOnly = attackDamage(withBargain("09"));
    expect(shackledOnly.damage, "Shackled Wrath doubles the ATK").toBe(plain.damage * 2);
    expect(attackDamage(both).damage, "(2 + 1) x 2").toBe((plain.damage + 1) * 2);
  });
});

describe("Main scheme stage 3B", () => {
  const atStage3 = (state: GameState, threat: number): GameState => {
    const { faceupSide: _faceup, ...scheme } = state.mainScheme!;
    void _faceup;
    return patch({ ...state, mainScheme: { ...scheme, stageIndex: 2 } }, state.mainScheme!.instanceId, { threat });
  };

  it("the players win the game when there is no threat on it", () => {
    const state = atStage3(open(), 1);
    const thwarted = drive(state, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(state),
      schemeInstanceId: state.mainScheme!.instanceId,
    });
    expect(thwarted.state.outcome?.result).toBe("win");
  });

  it("the players lose the game when the stage is completed", () => {
    const state = atStage3(open(), 17);
    const next = toNextRound(state);
    expect(next.state.outcome).toEqual({ result: "loss", reason: "mainSchemeCompleted" });
  });
});

describe("Gateway to Corruption flips to Hell on stage 3A", () => {
  it("completing 2B reveals Hellbound Obsession, which flips the environment; Hell then places an acceleration token", () => {
    const state = open();
    const { faceupSide: _faceup, ...scheme } = state.mainScheme!;
    void _faceup;
    const gateway = inPlay(state, "03a")[0]!;
    // Stage 2B one threat short of its target: step one of the villain phase completes it and advances to 3A.
    const staged = patch({ ...state, mainScheme: { ...scheme, stageIndex: 1 } }, state.mainScheme!.instanceId, {
      threat: 8,
    });
    const next = toNextRound(staged);
    expect(next.state.mainScheme!.stageIndex, "stage 3").toBe(2);
    expect(next.state.instances[gateway]!.flipped, "the Gateway flipped to Hell").toBe(true);
    expect(next.state.instances[gateway]!.counters.acceleration, "Hell's token at the end of the round").toBe(1);
  });
});

describe("Facedown Mystic minions from the discard pile (Call of the Demoness, 42)", () => {
  it("each has 1 SCH, 1 ATK and 1 hit point, and Spawn Magic reveals 2 more", () => {
    const first = toNextRound(revealing(open(), "42"));
    const pile = activeEncounterDeck(first.state);
    const call = inPlay(first.state, "42").find((id) => !pile.discard.includes(id) && !pile.deck.includes(id));
    expect(call, "Call of the Demoness is in play").toBeDefined();
    // The next villain phase begins: the first player puts their top discard card facedown, engaged, as a Mystic minion.
    const second = toNextRound(first.state);
    const minions = Object.entries(second.state.instances).filter(
      ([, i]) => i.facedownAs !== null && i.facedownAs !== undefined,
    );
    expect(minions.length).toBe(1);
    const [minionId] = minions[0]!;
    const attack = second.events.flatMap((e) =>
      e.type === "attackResolved" && e.enemyInstanceId === minionId ? [e.baseAtk] : [],
    );
    expect(attack, "its base ATK is 1").toEqual([1]);
    const attacked = drive(second.state, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(second.state),
      targetInstanceId: minionId as InstanceId,
    });
    const profile = characterProfile(second.state, minionId as InstanceId, deps)!;
    expect([profile.atk, profile.sch, profile.maxHp], "base ATK, SCH and hit points of 1").toEqual([1, 1, 1]);
    expect(damageTo(attacked.events, minionId as InstanceId).length, "the attack hit it").toBe(1);
    expect(attacked.state.instances[minionId]!.home.kind, "defeated and out of play").not.toBe("play");
  });
});

describe("every encounter card can be revealed", () => {
  const CODES = [
    "12",
    "13",
    "14",
    "15",
    "16",
    "17",
    "18",
    "19",
    "20",
    "21",
    "22",
    "23",
    "24",
    "25",
    "26",
    "27",
    "28",
    "29",
    "30",
    "31",
    "32",
    "33",
    "34",
    "35",
    "36",
    "37",
    "38",
    "39",
    "40",
    "41",
    "42",
    "43",
    "44",
    "05",
    "06",
    "07",
    "08",
    "09",
    "10",
    "11",
  ];
  const alterEgo = (s: GameState): GameState => ({
    ...s,
    players: s.players.map((p) => ({ ...p, identity: { ...p.identity, form: "alterEgo" as const, heroFormIndex: 0 } })),
  });
  for (const code of CODES) {
    for (const [label, stage] of [
      ["hero form", (s: GameState) => s],
      ["alter-ego form", alterEgo],
    ] as const) {
      it(`${code} in ${label}: reveals and the round plays on, with and without a Bargain attachment`, () => {
        const bare = stage(open());
        const withOne = stage(withBargain("05"));
        for (const state of [bare, withOne]) {
          const next = toNextRound(revealing(state, code));
          expect(next.state.pendingChoice).toBeNull();
        }
      });
    }
  }
});

describe("Hell Lord (04)", () => {
  /** Spider-Man (ATK 2) attacks the expert-game Mephisto II, which carries the Hell Lord from the start. */
  const hit = (state: GameState) =>
    drive(state, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(state),
      targetInstanceId: villainOf(state),
    });

  it("Mephisto II finds it in the set-aside area and attaches it to himself", () => {
    const state = open({ expert: true });
    expect(inPlay(state, "04").some((id) => state.instances[id]!.attachedTo === villainOf(state))).toBe(true);
  });

  it("reduces the damage Mephisto takes from an identity by 1 for each Bargain attachment it controls", () => {
    const plain = open({ expert: true });
    expect(damageTo(hit(plain).events, villainOf(plain))).toEqual([2]);
    const bargained = withBargain("05", plain);
    expect(damageTo(hit(bargained).events, villainOf(bargained))).toEqual([1]);
  });

  it("after the attack, for each Bargain attachment, a card in Damnation goes back into its owner's deck", () => {
    const bargained = withBargain("05", open({ expert: true }));
    const card = bargained.players[0]!.deck[0]!;
    const staged: GameState = {
      ...bargained,
      players: bargained.players.map((p) => ({ ...p, deck: p.deck.slice(1) })),
      scenarioAreas: { ...bargained.scenarioAreas, Damnation: [card] },
    };
    const after = hit(staged).state;
    expect(damnation(after)).toEqual([]);
    expect(after.players[0]!.deck).toContain(card);
  });
});

/** `n` cards of P1's deck moved into Damnation by surgery. */
const fillDamnation = (state: GameState, n: number): GameState => {
  const moved = state.players[0]!.deck.slice(0, n);
  return {
    ...state,
    players: state.players.map((p) => (p.playerId === P1 ? { ...p, deck: p.deck.slice(n) } : p)),
    scenarioAreas: { ...state.scenarioAreas, Damnation: [...damnation(state), ...moved] },
  };
};
const threatPlacedOn = (events: readonly GameEvent[], scheme: InstanceId): number[] =>
  events.flatMap((e) => (e.type === "threatPlaced" && e.schemeInstanceId === scheme ? [e.amount] : []));

describe("Treacheries and side schemes", () => {
  it("Alter the Deal: shuffles your Bargain into the encounter deck, resolves Hidden Clause for it, attaches the next one found", () => {
    const state = withBargain("05");
    const before = damnation(state).length;
    // The Bargain shuffled into the deck may be the one found again: either way one Bargain ends up attached.
    const staged = stackDeck(state, ["16", "12", "06"]);
    const next = toNextRound(staged);
    const attached = bargainsOn(next.state);
    expect(attached.length, "one Bargain attachment was found in the encounter deck and attached").toBe(1);
    // The turn's Hidden Clause (1 Bargain) and Alter the Deal's (1 Bargain shuffled).
    expect(damnation(next.state).length - before).toBe(2);
  });

  it("Dark Compulsions: a player with a Bargain resolves Hidden Clause; with none, cards in Damnation can go back", () => {
    const state = withBargain("05");
    const before = damnation(state).length;
    const next = toNextRound(revealing(state, "17"));
    expect(damnation(next.state).length - before, "turn-end clause and the treachery's").toBe(2);
    const bare = fillDamnation(open(), 3);
    const back = toNextRound(revealing(bare, "17"));
    expect(damnation(back.state).length, "1[per_hero] card looked at and shuffled back").toBe(2);
  });

  it("Hotel Inferno: places 6 threat on the main scheme for every 6 cards in Damnation (9 cards: 6)", () => {
    const state = fillDamnation(open(), 9);
    const next = toNextRound(revealing(state, "15"));
    expect(threatPlacedOn(next.events, state.mainScheme!.instanceId)).toContain(6);
  });

  it("Culling the Damned: a Mystic minion defeated puts a scorned counter on it", () => {
    const withScheme = toNextRound(revealing(open(), "13")).state;
    const scheme = inPlay(withScheme, "13")[0]!;
    const minion = conjure(withScheme, "33", { hp: 1 });
    const hit = drive(minion.state, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(minion.state),
      targetInstanceId: minion.id,
    });
    expect(hit.state.instances[scheme]!.counters.scorned).toBe(1);
  });

  it("Exposing Intentions: a card put into Damnation from your deck puts 1 additional card there", () => {
    const state = toNextRound(revealing(withBargain("05"), "14")).state;
    const before = damnation(state).length;
    const next = toNextRound(state);
    expect(damnation(next.state).length - before, "Hidden Clause's card and 1 additional").toBe(2);
  });
});

describe("Blackheart (22)", () => {
  /** Blackheart in play, engaged with P1, who carries Endless Greed; `damage` on him. */
  const staged = (damage: number) => {
    const bargained = withBargain("05");
    const minion = conjure(bargained, "22");
    return { ...minion, state: patch(minion.state, minion.id, { damage }) };
  };
  const useAction = (s: GameState, id: InstanceId) =>
    drive(s, {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: id,
      abilityId: `${P}22.action` as never,
      payment: [],
      costChoices: { sacrifice: [hostedOn(s, identityOf(s), "05")!] },
    });

  it("Action: discard a Bargain attachment to heal 3 damage from him", () => {
    const { state, id } = staged(5);
    const used = useAction(state, id);
    expect(used.state.instances[id]!.damage).toBe(2);
    expect(hostedOn(used.state, identityOf(used.state), "05"), "the Bargain was discarded").toBeUndefined();
  });

  it("Action: with no damage to heal, he is given a tough status card", () => {
    const { state, id } = staged(0);
    const used = useAction(state, id);
    expect(used.state.instances[id]!.statuses.tough).toBe(1);
  });

  /** Lilith (villainous, so dealt a boost card) engaged with P1, who carries Endless Greed; Blackheart on top of the deck. */
  const boosting = (form: "hero" | "alterEgo") => {
    const bargained = withBargain("05");
    const minion = conjure(bargained, "41", { atk: 1 });
    const formed: GameState = {
      ...minion.state,
      players: minion.state.players.map((p) => ({ ...p, identity: { ...p.identity, form, heroFormIndex: 0 } })),
    };
    return { lilith: minion.id, state: stackDeck(formed, ["22"]) };
  };

  it("Boost: discard a Bargain to cancel the attack and put him into play engaged with you", () => {
    const { lilith, state } = boosting("hero");
    const next = toNextRound(state, takes("Discard a Bargain"));
    expect(hostedOn(next.state, identityOf(next.state), "05"), "the Bargain was discarded").toBeUndefined();
    const blackheart = inPlay(next.state, "22").find((id) => next.state.instances[id]!.engagedWith === P1);
    expect(blackheart, "Blackheart is engaged with you").toBeDefined();
    const cancelled = next.events.find((e) => e.type === "activationCancelled" && e.enemyInstanceId === lilith);
    expect(cancelled, "the attack was cancelled").toMatchObject({ activation: "attack", byInstanceId: blackheart });
    expect(damageFrom(next.events, lilith, identityOf(next.state)), "Lilith dealt no damage").toEqual([]);
    expect(
      next.events.some((e) => e.type === "damagePrevented"),
      "cancelled, not prevented",
    ).toBe(false);
    expect(next.events.some((e) => e.type === "attackResolved" && e.enemyInstanceId === lilith)).toBe(false);
  });

  it("Boost: discard a Bargain to cancel a scheme activation (no threat placed)", () => {
    const { lilith, state } = boosting("alterEgo");
    const bargain = hostedOn(state, identityOf(state), "05")!;
    const next = toNextRound(state, takes("Discard a Bargain"));
    // Blackheart then schemes in his own right and can complete stage 1, whose stage 2 finds the Bargain again: read the
    // discard from the log.
    expect(next.events.some((e) => e.type === "cardDiscardedFromPlay" && e.instanceId === bargain)).toBe(true);
    expect(inPlay(next.state, "22").some((id) => next.state.instances[id]!.engagedWith === P1)).toBe(true);
    expect(next.events.find((e) => e.type === "activationCancelled" && e.enemyInstanceId === lilith)).toMatchObject({
      activation: "scheme",
    });
    expect(next.events.some((e) => e.type === "schemeResolved" && e.enemyInstanceId === lilith)).toBe(false);
  });

  it("Boost: declining leaves the attack to resolve, and Blackheart is discarded as a boost card", () => {
    const { lilith, state } = boosting("hero");
    const next = toNextRound(state, takes("Do not discard"));
    expect(hostedOn(next.state, identityOf(next.state), "05"), "the Bargain stays").toBeDefined();
    expect(inPlay(next.state, "22").some((id) => next.state.instances[id]!.engagedWith === P1)).toBe(false);
    expect(next.events.some((e) => e.type === "activationCancelled")).toBe(false);
    expect(next.events.some((e) => e.type === "attackResolved" && e.enemyInstanceId === lilith)).toBe(true);
  });
});

describe("Mother of Demons", () => {
  /** Lilith's attacks against P1 over the two rounds after she is revealed. */
  const lilithAttacks = (state: GameState): number => {
    const revealed = toNextRound(revealing(state, "41"));
    const lilith = inPlay(revealed.state, "41")[0]!;
    const later = toNextRound(toNextRound(revealed.state).state);
    const all = [...revealed.events, ...later.events];
    return all.filter((e) => e.type === "attackResolved" && e.enemyInstanceId === lilith).length;
  };

  it("Lilin Remaking: Lilith cannot activate against you (she does against a player with another Bargain)", () => {
    expect(lilithAttacks(withBargain("05")), "control: Lilith attacks").toBeGreaterThan(0);
    expect(lilithAttacks(withBargain("43"))).toBe(0);
  });

  it("Spawn Magic: with Call of the Demoness in play it puts the top 2 cards of your discard pile in as facedown minions", () => {
    const stocked = (s: GameState): GameState => {
      const moved = s.players[0]!.deck.slice(0, 8);
      return {
        ...s,
        players: s.players.map((p) => ({ ...p, deck: p.deck.slice(8), discard: [...moved, ...p.discard] })),
      };
    };
    const withCall = stocked(toNextRound(revealing(open(), "42")).state);
    const facedown = (s: GameState) => Object.values(s.instances).filter((i) => i.facedownAs != null).length;
    const next = toNextRound(revealing(withCall, "44"));
    // 1 from Call's own Forced Response when the villain phase begins and 2 from Spawn Magic.
    expect(facedown(next.state) - facedown(withCall)).toBe(3);
  });
});

/** The Bargain attachments on P1's identity, by card id. */
function bargainsOn(s: GameState): string[] {
  const identity = identityOf(s);
  return Object.values(s.instances)
    .filter(
      (i) =>
        i.attachedTo === identity &&
        (s.cardPool[String(i.cardId)] as { traits?: readonly string[] } | undefined)?.traits?.includes("BARGAIN"),
    )
    .map((i) => String(i.cardId));
}

describe("Bargain responses at the start of your turn", () => {
  it("After your turn begins, discard a sin: Mephisto activates against you and its boost icons are applied as a boost card", () => {
    const next = toNextRound(revealing(open(), "05"), takes("Attach this card", "05.response"));
    expect(bargainsOn(next.state), "the sin was discarded").toEqual([]);
    const attacks = next.events.flatMap((e) => (e.type === "attackResolved" ? [e.boostIcons] : []));
    // Mephisto's own attack of the villain phase, then the one from the response with Endless Greed's 3 boost icons.
    expect(attacks.length).toBe(2);
    expect(Math.max(...attacks)).toBeGreaterThanOrEqual(3);
  });

  it("a Corruptive Offers attachment sets aside X[per_hero] cards for its corrupt counters when discarded (into Damnation)", () => {
    const state = withBargain("26");
    const bargain = hostedOn(state, identityOf(state), "26")!;
    const counted = patch(state, bargain, { counters: { corrupt: 2 } });
    const next = toNextRound(counted, takes("26.response"));
    expect(bargainsOn(next.state)).not.toContain(`${P}26`);
    // The turn-end Hidden Clause and the 2 cards set aside.
    expect(damnation(next.state).length).toBe(3);
  });
});

describe("more card rulings", () => {
  it("Gluttonous Restoration (06): a basic recovery restores your alter-ego to its printed hit points", () => {
    const bargained = withBargain("06");
    const alter: GameState = {
      ...bargained,
      players: bargained.players.map((p) => ({
        ...p,
        identity: { ...p.identity, form: "alterEgo" as const, heroFormIndex: 0 },
      })),
    };
    const hurt = patch(alter, identityOf(alter), { damage: 8 });
    const recovered = drive(
      hurt,
      { type: "basicRecover", playerId: P1, healerInstanceId: identityOf(hurt) } as never,
      takes("06.alter-ego-interrupt"),
    );
    expect(recovered.state.instances[identityOf(recovered.state)]!.damage).toBe(0);
  });

  it("Demon Amalgam (31): enters with a damned counter for each Mystic minion in the encounter discard pile, +1 hit point each", () => {
    const state = open();
    const deckId = activeEncounterDeckId(state);
    const pile = activeEncounterDeck(state);
    const [a, b] = pile.deck;
    const staged: GameState = {
      ...patch(patch(state, a!, { cardId: `${P}33` as never }), b!, { cardId: `${P}33` as never }),
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: pile.deck.slice(2), discard: [a!, b!, ...pile.discard] },
      },
    };
    const next = toNextRound(revealing(staged, "31"));
    const amalgam = inPlay(next.state, "31")[0]!;
    expect(next.state.instances[amalgam]!.counters.damned).toBe(2);
    const without = patch(next.state, amalgam, { counters: {} });
    expect(
      characterProfile(next.state, amalgam, deps)!.maxHp - characterProfile(without, amalgam, deps)!.maxHp,
      "+1 hit point for each damned counter",
    ).toBe(2);
  });

  it("Demonized (37): the top ally of your deck is discarded and put into play engaged with you as a Mystic minion", () => {
    const state = open();
    const allyCard = Object.values(state.cardPool).find((c) => c.type === "ally" && String(c.id).length === 5)!;
    const top = state.players[0]!.deck[0]!;
    const staged = patch(state, top, { cardId: allyCard.id as never });
    const next = toNextRound(revealing(staged, "37"));
    expect(next.state.instances[top]!.engagedWith, "the ally is engaged with you").toBe(P1);
    expect(hostedOn(next.state, top, "37"), "Demonized is attached to it").toBeDefined();
    expect(characterProfile(next.state, top, deps)!.kind).toBe("minion");
  });

  it("Deathless Persistence (26): when your character would be defeated, a corrupt counter heals 1 damage instead", () => {
    const bargained = withBargain("26");
    const minion = conjure(bargained, "41", { atk: 1 });
    const hp = characterProfile(minion.state, identityOf(minion.state), deps)!.maxHp;
    const staged = stackDeck(patch(minion.state, identityOf(minion.state), { damage: hp - 1 }), ["04"]);
    const next = toNextRound(staged, takes("26.interrupt"));
    expect(next.state.outcome, "not defeated").toBeNull();
    const bargain = hostedOn(next.state, identityOf(next.state), "26")!;
    expect(next.state.instances[bargain]!.counters.corrupt).toBeGreaterThanOrEqual(1);
  });
});

describe("main scheme stages", () => {
  const atStage = (state: GameState, stageIndex: number, threat: number): GameState => {
    const { faceupSide: _faceup, ...scheme } = state.mainScheme!;
    void _faceup;
    return patch({ ...state, mainScheme: { ...scheme, stageIndex } }, state.mainScheme!.instanceId, { threat });
  };

  it("completing 1B reveals Fiendish Investment: each player searches the encounter deck for a Bargain attachment and reveals it", () => {
    const state = atStage(open(), 0, 5);
    const next = toNextRound(state);
    expect(next.state.mainScheme!.stageIndex, "stage 2").toBe(1);
    expect(bargainsOn(next.state).length, "a Bargain was found, revealed and accepted").toBeGreaterThanOrEqual(1);
  });

  it("Hidden Clause scales with the stage: 3[per_hero] cards on stage 3B", () => {
    const bargained = withBargain("05");
    const staged = atStage(bargained, 2, 3);
    const before = damnation(staged).length;
    const next = toNextRound(staged);
    expect(damnation(next.state).length - before).toBe(3);
  });
});

describe("Lusting Existence (07)", () => {
  it("Action: exhaust an identity-specific card you control to ready your identity", () => {
    const state = withBargain("07");
    const hand = state.players[0]!.hand;
    const tracer = hand.find((id) => String(state.instances[id]!.cardId) === "01007");
    expect(tracer, "Spider-Tracer (identity-specific) in hand").toBeDefined();
    const staged: GameState = {
      ...patch(patch(state, tracer!, { faceup: true, controllerId: P1 }), identityOf(state), { exhausted: true }),
      players: state.players.map((p) => ({
        ...p,
        hand: p.hand.filter((id) => id !== tracer),
        playArea: [...p.playArea, tracer!],
      })),
    };
    const bargain = hostedOn(staged, identityOf(staged), "07")!;
    const used = drive(staged, {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: bargain,
      abilityId: `${P}07.action` as never,
      payment: [],
      costChoices: { exhausted: [tracer!] },
    });
    expect(used.state.instances[identityOf(used.state)]!.exhausted).toBe(false);
    expect(used.state.instances[tracer!]!.exhausted).toBe(true);
  });
});

describe("Condemned Soul Portal (40)", () => {
  it("a printed non-Elite Mystic minion that is defeated is shuffled into the encounter deck instead of discarded", () => {
    const withPortal = toNextRound(revealing(open(), "40")).state;
    expect(
      inPlay(withPortal, "40").some((id) => withPortal.instances[id]!.faceup),
      "the portal is in play",
    ).toBe(true);
    const minion = conjure(withPortal, "33", { hp: 1 });
    const hit = drive(minion.state, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(minion.state),
      targetInstanceId: minion.id,
    });
    const pile = activeEncounterDeck(hit.state);
    expect(pile.deck, "back in the encounter deck").toContain(minion.id);
    expect(pile.discard).not.toContain(minion.id);
  });
});
