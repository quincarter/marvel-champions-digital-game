import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { PLAYABLE_DEPS, coreScenario } from "@mc/cards";
import { PLAYABLE_CARDS, type PackManifest, type PlayerCard, type StarterDeck } from "@mc/content";
import {
  applyCommand,
  createGame,
  validateDeck,
  playerId,
  activeEncounterDeck,
  type CardInstance,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { buildPack } from "./build.js";
import { cardPoolWithPack, gameDepsWithPack } from "./game.js";
import { readPackInput, type PackInput } from "./validate.js";
import { dropMissingCover } from "./fixtures/drop-missing-cover.js";

const SRC = fileURLToPath(new URL("../../../content-packs/community/night-thrasher-dh", import.meta.url));
const P = "x.night-thrasher-dh.";
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
  const root = mkdtempSync(join(tmpdir(), "mc-night-thrasher-"));
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

const precon = (): StarterDeck => pack.decks!.find((d) => d.id === "night-thrasher-dh-aggression")!;

const patch = (state: GameState, id: InstanceId, change: Partial<CardInstance>): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...state.instances[id]!, ...change } },
});

/** Applies a command and answers every prompt with `pick`, collecting the events. */
function drive(
  state: GameState,
  command: Command | null,
  pick: (s: GameState) => readonly string[] = (s) => {
    const c = s.pendingChoice!;
    if (c.prompt.kind === "declareDefender") return ["decline"];
    return c.options.slice(0, c.minSelections).map((o) => o.optionId);
  },
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

/** A Rhino game with the Night Thrasher precon, in hero form, past setup, at the start of the player phase. */
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

const boardOf = (s: GameState): InstanceId =>
  Object.values(s.instances).find((i) => String(i.cardId) === `${P}02a`)!.instanceId;

/** The top `n` cards of the encounter deck relabeled as `code`. */
function stackTop(state: GameState, code: string, n: number): GameState {
  const top = activeEncounterDeck(state).deck.slice(0, n);
  return top.reduce((acc, id) => patch(acc, id, { cardId: code as never }), state);
}

const damageToIdentity = (events: readonly GameEvent[], s: GameState): number[] =>
  events.flatMap((e) => (e.type === "damageDealt" && e.targetInstanceId === identityOf(s) ? [e.amount] : []));

const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const faceOf = (s: GameState, id: InstanceId): boolean => s.instances[id]!.flipped;

/** A card of the player's deck by code, moved to their hand (surgery: no draw effects). `skip` copies are passed over. */
function toHand(
  state: GameState,
  code: string,
  player: typeof P1 = P1,
): { readonly state: GameState; readonly id: InstanceId } {
  const owner = state.players.find((p) => p.playerId === player)!;
  const id = owner.deck.find((i) => String(state.instances[i]!.cardId) === code);
  if (!id) throw new Error(`${code} is not in the deck`);
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === player ? { ...p, deck: p.deck.filter((i) => i !== id), hand: [...p.hand, id] } : p,
      ),
    },
  };
}

/** Empties the hand into the top of the deck (surgery), so a test controls exactly which cards it holds. */
function emptyHand(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.playerId === P1 ? { ...p, deck: [...p.hand, ...p.deck], hand: [] } : p)),
  };
}

const play = (id: InstanceId, payment: readonly InstanceId[] = []): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: id,
  payment: payment.map((fromHand) => ({ fromHand })),
  attachToInstanceId: null,
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

/** A Rhino game, P1 playing Night Thrasher with `Rhino` in the villain's slot, and the Battle Board on `face`. */
function withBoard(face: "vehicle" | "weapon"): GameState {
  const state = emptyHand(open());
  return patch(state, boardOf(state), { flipped: face === "weapon" });
}

describe("Battle Board: Agile 1 (front, Vehicle)", () => {
  /** Rhino's first attack of the villain phase, answered by `defend` or not; its boost card shows no icons. */
  function firstAttack(face: "vehicle" | "weapon", defend: boolean) {
    const state = stackTop(withBoard(face), `${P}15`, 1);
    const start = state.round;
    const events: GameEvent[] = [];
    drive(
      state,
      { type: "endTurn", playerId: P1 },
      (s) => {
        const c = s.pendingChoice!;
        if (c.prompt.kind === "declareDefender")
          return defend ? [c.options.find((o) => o.optionId !== "decline")!.optionId] : ["decline"];
        return c.options.slice(0, c.minSelections).map((o) => o.optionId);
      },
      (s) => s.round > start,
    ).events.forEach((e) => events.push(e));
    const firstDamage = events.findIndex((e) => e.type === "damageDealt" && e.targetInstanceId === identityOf(state));
    const before = events.slice(0, firstDamage);
    return {
      dealt: (events[firstDamage] as Extract<GameEvent, { type: "damageDealt" }>).amount,
      prevented: before.some((e) => e.type === "damagePrevented"),
    };
  }

  it("reduces the damage of an undefended villain attack by 1", () => {
    const front = firstAttack("vehicle", false);
    const back = firstAttack("weapon", false);
    expect(front.prevented).toBe(true);
    expect(back.prevented).toBe(false);
    expect(front.dealt).toBe(back.dealt - 1);
  });

  it("does not reduce the damage of an attack Night Thrasher defends (only his DEF does)", () => {
    const front = firstAttack("vehicle", true);
    expect(front.prevented).toBe(false);
    // Rhino's attack (2) less the hero's printed DEF 1: agile would make it 0.
    expect(front.dealt).toBe(1);
  });
});

describe("Kickflip: cost after a Night Thrasher event", () => {
  /** Three Kickflips in hand (one to play first, one to play second, spare ones to pay with) or Haymaker first. */
  it("costs 0 after Night Thrasher's own event is the last card played this round", () => {
    let state = withBoard("vehicle");
    const first = toHand(state, `${P}05`);
    const second = toHand(first.state, `${P}05`);
    const pay = toHand(second.state, `${P}05`);
    state = pay.state;
    const played = drive(state, play(first.id, [pay.id]), takes());
    // The second Kickflip is paid with nothing: its 1 cost is reduced to 0.
    const next = applyCommand(played.state, play(second.id), deps);
    expect(next.ok, next.ok ? "" : next.error.message).toBe(true);
  });

  it("still costs 1 after another card (a basic event) was the last one played", () => {
    let state = withBoard("vehicle");
    const haymaker = toHand(state, "01087");
    const kick = toHand(haymaker.state, `${P}05`);
    const payA = toHand(kick.state, `${P}05`);
    const payB = toHand(payA.state, `${P}05`);
    const payC = toHand(payB.state, `${P}05`);
    state = payC.state;
    // Haymaker costs 2: two Kickflips are discarded for their [physical] resources.
    const played = drive(state, play(haymaker.id, [payA.id, payB.id]), takes());
    expect(played.state.players[0]!.discard).toContain(haymaker.id);
    const free = applyCommand(played.state, play(kick.id), deps);
    expect(free.ok, "Kickflip is not free after a Haymaker").toBe(false);
    const paid = applyCommand(played.state, play(kick.id, [payC.id]), deps);
    expect(paid.ok, paid.ok ? "" : paid.error.message).toBe(true);
  });
});

/** Disaster (cost 2) played from the given face, paid with two Kickflips from hand. */
function playDisaster(face: "vehicle" | "weapon", pick = takes()) {
  const base = withBoard(face);
  const scheme = base.mainScheme!.instanceId;
  const staged = patch(base, scheme, { threat: 6 });
  const disaster = toHand(staged, `${P}03`);
  const payA = toHand(disaster.state, `${P}05`);
  const payB = toHand(payA.state, `${P}05`);
  const run = drive(payB.state, play(disaster.id, [payA.id, payB.id]), pick);
  return { ...run, scheme, board: boardOf(base), villain: villainOf(base), before: staged };
}

describe("Battle Board: Disaster reads the face after the flip", () => {
  it("Vehicle front -> flips to the Weapon back: deals 4 damage to an enemy (an attack), removes no threat", () => {
    const run = playDisaster("vehicle");
    expect(faceOf(run.state, run.board), "flipped to the back").toBe(true);
    expect(
      run.events.some((e) => e.type === "damageDealt" && e.targetInstanceId === run.villain && e.amount === 4),
      "4 damage to Rhino",
    ).toBe(true);
    expect(run.state.instances[run.scheme]!.threat, "no threat removed").toBe(6);
  });

  it("Weapon back -> flips to the Vehicle front: removes 3 threat from a scheme, deals no damage", () => {
    const run = playDisaster("weapon");
    expect(faceOf(run.state, run.board), "flipped to the front").toBe(false);
    expect(run.state.instances[run.scheme]!.threat).toBe(3);
    expect(run.events.some((e) => e.type === "damageDealt" && e.targetInstanceId === run.villain)).toBe(false);
  });

  it("the Vehicle front's Response (after you flip to this side) removes 1 more threat when taken", () => {
    const run = playDisaster("weapon", takes(/battle-board-response|Battle Board/i));
    expect(run.state.instances[run.scheme]!.threat, "3 from Disaster, 1 from the Response").toBe(2);
  });

  it("the Weapon back's Hero Response (after you flip to this side) deals 1 damage to an enemy when taken", () => {
    const run = playDisaster("vehicle", takes(/battle-board-response|Battle Board/i));
    const hits = run.events.filter((e) => e.type === "damageDealt" && e.targetInstanceId === run.villain);
    expect(hits.map((e) => (e as { amount: number }).amount).sort()).toEqual([1, 4]);
  });
});

describe("Varial Heelflip", () => {
  it("after you play a Skill card, flips the Battle Board (once per phase)", () => {
    const base = withBoard("vehicle");
    const first = toHand(base, `${P}05`);
    const second = toHand(first.state, `${P}05`);
    const pay = toHand(second.state, `${P}05`);
    // The window lists the card with the ability: Varial Heelflip is the identity's ("Night Thrasher").
    const takeHeelflip = takes(/^Night Thrasher$/);
    // Kickflip flips the board itself (front -> back); Varial Heelflip, taken, flips it again (back -> front).
    const one = drive(pay.state, play(first.id, [pay.id]), takeHeelflip);
    expect(faceOf(one.state, boardOf(base)), "Kickflip and Varial Heelflip: front again").toBe(false);
    // Limit once per phase: the second Skill card's Heelflip is not offered, so only Kickflip flips (front -> back).
    const two = drive(one.state, play(second.id), takeHeelflip);
    expect(faceOf(two.state, boardOf(base)), "only Kickflip flipped it").toBe(true);
  });
});

describe("Cemented: each player who discarded treats its text box as blank, the others do not", () => {
  const P2 = playerId("p2");

  /** Night Thrasher (P1) and Spider-Man (P2), both in hero form, with Cemented (2 threat) in play. */
  function cementedTable(): { readonly state: GameState; readonly cemented: InstanceId } {
    const deck = precon();
    const config = coreScenario("rhino", {
      players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-spider-man-justice" }],
      seed: 1,
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
          config.players[1]!,
        ],
      },
      deps,
    );
    if (!created.ok) throw new Error(created.error.message);
    const settled = drive(created.state, null, undefined, (s) => s.step.phase === "player").state;
    const top = activeEncounterDeck(settled).deck[0]!;
    const withCemented: GameState = {
      ...patch(settled, top, { cardId: `${P}14` as never, faceup: true, threat: 2 }),
      villainArea: [...settled.villainArea, top],
      encounterDecks: {
        ...settled.encounterDecks,
        [Object.keys(settled.encounterDecks)[0]!]: {
          ...Object.values(settled.encounterDecks)[0]!,
          deck: Object.values(settled.encounterDecks)[0]!.deck.slice(1),
        },
      },
      players: settled.players.map((p) => ({
        ...p,
        identity: { ...p.identity, form: "hero" as const, heroFormIndex: 0, changedFormThisRound: false },
      })),
    };
    return { state: withCemented, cemented: top };
  }

  const tryBasicAttack = (state: GameState, player: typeof P1) =>
    applyCommand(
      state,
      {
        type: "basicAttack",
        playerId: player,
        attackerInstanceId: state.players.find((p) => p.playerId === player)!.identity.instanceId,
        targetInstanceId: villainOf(state),
      },
      deps,
    );
  /** The player's basic attack on the villain, on their own turn (the other player's turn is ended first when it is theirs). */
  const basicAttack = (state: GameState, player: typeof P1) => {
    const first = tryBasicAttack(state, player);
    if (first.ok || !/turn/.test(first.error.message)) return first;
    const other = state.players.find((p) => p.playerId !== player)!.playerId;
    const ended = drive(state, { type: "endTurn", playerId: other }, (s) => {
      const c = s.pendingChoice!;
      if (c.prompt.kind === "declareDefender") return ["decline"];
      return c.options.slice(0, c.minSelections).map((o) => o.optionId);
    });
    return tryBasicAttack(ended.state, player);
  };

  it("while Cemented's text is in force nobody can make a basic attack with their hero", () => {
    const table = cementedTable();
    const mine = basicAttack(table.state, P1);
    expect(mine.ok).toBe(false);
    expect(mine.ok ? "" : mine.error.message).not.toMatch(/turn/);
    const theirs = basicAttack(table.state, P2);
    expect(theirs.ok).toBe(false);
    expect(theirs.ok ? "" : theirs.error.message).not.toMatch(/turn/);
    // Control: without Cemented the same attack is legal.
    expect(basicAttack({ ...table.state, villainArea: [] }, P1).ok).toBe(true);
  });

  it("Night Thrasher's player discards and may attack; Spider-Man's player does not and still cannot", () => {
    const table = cementedTable();
    const choose = (s: GameState): readonly string[] => {
      const c = s.pendingChoice!;
      const wantsDiscard = c.playerId === P1;
      const hit = c.options.find((o) => (wantsDiscard ? /^Discard 1 card/ : /^Do not discard$/).test(o.label));
      return hit ? [hit.optionId] : c.options.slice(0, c.minSelections).map((o) => o.optionId);
    };
    const used = drive(
      table.state,
      {
        type: "useAbility",
        playerId: P1,
        cardInstanceId: table.cemented,
        abilityId: `${P}14.cemented-action` as never,
        payment: [],
      },
      choose,
    );
    expect(used.state.players.find((p) => p.playerId === P1)!.hand.length, "P1 discarded 1 card").toBe(
      table.state.players.find((p) => p.playerId === P1)!.hand.length - 1,
    );
    expect(used.state.players.find((p) => p.playerId === P2)!.hand.length, "P2 kept their hand").toBe(
      table.state.players.find((p) => p.playerId === P2)!.hand.length,
    );
    const mine = basicAttack(used.state, P1);
    expect(mine.ok, mine.ok ? "" : mine.error.message).toBe(true);
    const theirs = basicAttack(used.state, P2);
    expect(theirs.ok, "Spider-Man's player is still bound by Cemented").toBe(false);
    expect(theirs.ok ? "" : theirs.error.message).not.toMatch(/turn/);
    // Control: without Cemented Spider-Man's player can.
    expect(basicAttack({ ...used.state, villainArea: [] }, P2).ok).toBe(true);
  });

  it("the blank ends with the phase: Night Thrasher cannot basic attack again in the next round", () => {
    const table = cementedTable();
    const choose = (s: GameState): readonly string[] => {
      const c = s.pendingChoice!;
      const hit = c.options.find((o) => (c.playerId === P1 ? /^Discard 1 card/ : /^Do not discard$/).test(o.label));
      return hit ? [hit.optionId] : c.options.slice(0, c.minSelections).map((o) => o.optionId);
    };
    const used = drive(
      table.state,
      {
        type: "useAbility",
        playerId: P1,
        cardInstanceId: table.cemented,
        abilityId: `${P}14.cemented-action` as never,
        payment: [],
      },
      choose,
    );
    const round = used.state.round;
    const quiet = (s: GameState): readonly string[] => {
      const c = s.pendingChoice!;
      if (c.prompt.kind === "declareDefender") return ["decline"];
      return c.options.slice(0, c.minSelections).map((o) => o.optionId);
    };
    const p1Done = drive(used.state, { type: "endTurn", playerId: P1 }, quiet);
    const next = drive(p1Done.state, { type: "endTurn", playerId: P2 }, quiet, (s) => s.round > round);
    expect(next.state.round, "the next round began").toBeGreaterThan(round);
    // The text box is blank for Night Thrasher's player only until the end of that phase.
    const again = basicAttack(next.state, P1);
    expect(again.ok, "Cemented binds Night Thrasher's player again").toBe(false);
    // Control: with Cemented gone the same attack is legal, so Cemented is what stopped it.
    const control = basicAttack(
      { ...next.state, villainArea: next.state.villainArea.filter((i) => i !== table.cemented) },
      P1,
    );
    expect(control.ok, control.ok ? "" : control.error.message).toBe(true);
  });
});

const quiet = (s: GameState): readonly string[] => {
  const c = s.pendingChoice!;
  if (c.prompt.kind === "declareDefender") return ["decline"];
  return c.options.slice(0, c.minSelections).map((o) => o.optionId);
};

describe("Practice (obligation)", () => {
  /** Practice is the second card of the encounter deck: the first is Rhino's boost card, the second is dealt. */
  function revealPractice(pick: (s: GameState) => readonly string[]) {
    const state = stackTop(withBoard("vehicle"), `${P}12`, 2);
    const start = state.round;
    return { start: state, ...drive(state, { type: "endTurn", playerId: P1 }, pick, (s) => s.round > start) };
  }

  it("lets the player stop the Battle Board flipping until the next villain phase, then discards itself", () => {
    const run = revealPractice((s) => {
      const c = s.pendingChoice!;
      const hit = c.options.find((o) => /cannot flip the Battle Board|^Stay in hero form/.test(o.label));
      return hit ? [hit.optionId] : quiet(s);
    });
    const board = boardOf(run.start);
    // Disaster cannot flip the board: it stays on the front, and the Vehicle branch (3 threat) is the one read.
    const scheme = run.state.mainScheme!.instanceId;
    let state = patch(run.state, scheme, { threat: 6 });
    const disaster = toHand(emptyHand(state), `${P}03`);
    const payA = toHand(disaster.state, `${P}05`);
    const payB = toHand(payA.state, `${P}05`);
    const played = drive(payB.state, play(disaster.id, [payA.id, payB.id]), quiet);
    expect(faceOf(played.state, board), "the flip was stopped").toBe(false);
    expect(played.state.instances[scheme]!.threat, "Vehicle: 3 threat removed").toBe(3);
    // The next villain phase begins: the lock is cleared.
    state = played.state;
    const round = state.round;
    const next = drive(state, { type: "endTurn", playerId: P1 }, quiet, (s) => s.round > round);
    // The lasting lock ended as the villain phase began: Disaster flips the board again.
    const again = toHand(emptyHand(next.state), `${P}03`);
    const payC = toHand(again.state, `${P}05`);
    const payD = toHand(payC.state, `${P}05`);
    const replayed = drive(payD.state, play(again.id, [payC.id, payD.id]), quiet);
    expect(faceOf(replayed.state, board), "the lock ended with the villain phase").toBe(true);
  });

  it("offers to discard a card from hand to remove itself from the game, and in alter-ego form to exhaust Dwayne", () => {
    const run = revealPractice((s) => {
      const c = s.pendingChoice!;
      const hit = c.options.find((o) => /^Discard 1 card from your hand|^Stay in hero form/.test(o.label));
      return hit ? [hit.optionId] : quiet(s);
    });
    const practice = Object.values(run.state.instances).find((i) => String(i.cardId) === `${P}12`);
    expect(practice).toBeDefined();
  });
});

describe("Tailblock (Hero Interrupt)", () => {
  /** Rhino's undefended attacks of the villain phase, with Tailblock in hand and played at the first one. */
  function withTailblock(face: "vehicle" | "weapon") {
    const base = stackTop(withBoard(face), `${P}15`, 1);
    const tail = toHand(base, `${P}07`);
    const pay = toHand(tail.state, `${P}05`);
    const start = pay.state.round;
    const run = drive(
      pay.state,
      { type: "endTurn", playerId: P1 },
      (s) => {
        const c = s.pendingChoice!;
        if (c.prompt.kind === "declareDefender") return ["decline"];
        // The end-of-turn "discard any number of cards" prompt lists Tailblock too: only the villain phase's window counts.
        const hit = s.step.phase === "villain" ? c.options.find((o) => /Tailblock/.test(o.label)) : undefined;
        return hit ? [hit.optionId] : c.options.slice(0, c.minSelections).map((o) => o.optionId);
      },
      (s) => s.round > start,
    );
    return {
      tail: tail.id,
      state: run.state,
      dealt: damageToIdentity(run.events, base),
      drawn: run.events.filter((e) => e.type === "cardDrawn").length,
    };
  }

  it("Vehicle: prevents 1 of the damage (with Agile 1, the first attack's 2 is 0) and draws 2 cards", () => {
    const run = withTailblock("vehicle");
    expect(run.state.players[0]!.discard).toContain(run.tail);
    // Rhino attacks twice this round: the first (2) is reduced by Agile and by Tailblock to nothing, the second is not.
    expect(run.dealt).toEqual([2]);
  });

  it("Weapon: prevents 3 of the damage, and draws nothing extra", () => {
    const vehicle = withTailblock("vehicle");
    const weapon = withTailblock("weapon");
    expect(weapon.state.players[0]!.discard).toContain(weapon.tail);
    expect(weapon.dealt, "the first attack's 2 is all prevented").toEqual([3]);
    expect(vehicle.drawn - weapon.drawn, "Vehicle draws 2 cards, Weapon none").toBe(2);
  });
});

describe("Dwayne Taylor: Manual", () => {
  it("shuffles X Skill cards from hand into the deck and draws X cards (once per round)", () => {
    const base = emptyHand(open());
    const alterEgo: GameState = {
      ...base,
      players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "alterEgo" as const } })),
    };
    const a = toHand(alterEgo, `${P}05`);
    const b = toHand(a.state, `${P}05`);
    const other = toHand(b.state, "01087");
    const command: Command = {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: identityOf(other.state),
      abilityId: `${P}01b.manual` as never,
      payment: [],
    };
    // Both Kickflips (Skill) are offered, the Haymaker (not Skill) is not: take every card offered.
    const offered: string[] = [];
    const run = drive(other.state, command, (s) => {
      const c = s.pendingChoice!;
      offered.push(...c.options.map((o) => o.label));
      return c.options.map((o) => o.optionId);
    });
    expect(offered.filter((l) => l === "Kickflip")).toHaveLength(2);
    expect(offered).not.toContain("Haymaker");
    expect(
      run.events.filter((e) => e.type === "cardDrawn"),
      "drew X = 2 cards",
    ).toHaveLength(2);
    expect(run.state.players[0]!.hand, "the hand is the same size as before").toHaveLength(3);
    const again = applyCommand(run.state, command, deps);
    expect(again.ok, "limit once per round").toBe(false);
  });
});

describe("Melon Grab", () => {
  const cast = (face: "vehicle" | "weapon") => {
    const base = withBoard(face);
    const grab = toHand(base, `${P}06`);
    // Melon Grab costs 3: three Kickflips pay.
    const p1 = toHand(grab.state, `${P}05`);
    const p2 = toHand(p1.state, `${P}05`);
    const p3 = toHand(p2.state, `${P}05`);
    const prompts: string[] = [];
    const run = drive(p3.state, play(grab.id, [p1.id, p2.id, p3.id]), (s) => {
      prompts.push(`${s.pendingChoice!.prompt.kind}:${s.pendingChoice!.options.map((o) => o.label).join(",")}`);
      return quiet(s);
    });
    return { run, prompts, villain: villainOf(base) };
  };

  it("Vehicle: 8 damage that can be divided among enemies (the player is asked to divide)", () => {
    const { run, villain } = cast("vehicle");
    const dealt = run.events
      .filter((e) => e.type === "damageDealt" && e.targetInstanceId === villain)
      .reduce((n, e) => n + (e as { amount: number }).amount, 0);
    expect(dealt).toBe(8);
  });

  it("Weapon: 8 damage to one enemy, with piercing and overkill", () => {
    const { run, villain } = cast("weapon");
    const dealt = run.events
      .filter((e) => e.type === "damageDealt" && e.targetInstanceId === villain)
      .reduce((n, e) => n + (e as { amount: number }).amount, 0);
    expect(dealt).toBe(8);
  });
});

/** A copy of an encounter card relabeled as `code`, put into play engaged with P1 (surgery: no reveal). */
function conjure(state: GameState, code: string): { readonly state: GameState; readonly id: InstanceId } {
  const pile = activeEncounterDeck(state);
  const spare = pile.deck[0]!;
  const deckId = Object.keys(state.encounterDecks)[0]!;
  return {
    id: spare,
    state: {
      ...state,
      encounterDecks: { ...state.encounterDecks, [deckId]: { deck: pile.deck.slice(1), discard: pile.discard } },
      players: state.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, spare] } : p)),
      instances: {
        ...state.instances,
        [spare]: { ...state.instances[spare]!, cardId: code as never, faceup: true, engagedWith: P1 },
      },
    },
  };
}

describe("Terrax the Tamer, Cosmic Ax and Cosmic Connection", () => {
  /** Terrax in play; the two boost cards of the villain phase are blank, the Cosmic Ax is third from the top. */
  function terraxActivates() {
    const base = withBoard("weapon");
    const terrax = conjure(base, `${P}13`);
    const stacked = stackTop(terrax.state, `${P}15`, 2);
    const ax = activeEncounterDeck(stacked).deck[2]!;
    const state = patch(stacked, ax, { cardId: `${P}16` as never });
    const start = state.round;
    const run = drive(state, { type: "endTurn", playerId: P1 }, quiet, (s) => s.round > start);
    return { ...run, terrax: terrax.id, ax };
  }

  it("Terrax, after he activates, discards 8 cards from the encounter deck and reveals the Cosmic Ax found there", () => {
    const run = terraxActivates();
    const ax = run.state.instances[run.ax]!;
    expect(ax.attachedTo, "the Ax was revealed and attached to Terrax").toBe(run.terrax);
  });

  it("Cosmic Connection takes 3 indirect damage with the Ax in play and a Weapon card (the Battle Board's back) in play", () => {
    const first = terraxActivates();
    // Round two: both enemies are stunned, so the only damage is the Connection's.
    const rested = patch(patch(first.state, identityOf(first.state), { damage: 0 }), first.terrax, {
      statuses: { ...first.state.instances[first.terrax]!.statuses, stunned: 1 },
    });
    const quieted = patch(rested, villainOf(rested), {
      statuses: { ...rested.instances[villainOf(rested)]!.statuses, stunned: 1 },
    });
    const state = stackTop(quieted, `${P}15`, 12);
    const start = state.round;
    const run = drive(state, { type: "endTurn", playerId: P1 }, quiet, (s) => s.round > start);
    // Indirect damage: dealt to Night Thrasher by the Connection (not by an attacker), 3 of it, and no surge.
    const indirect = run.events.filter(
      (e) =>
        e.type === "damageDealt" &&
        e.targetInstanceId === identityOf(state) &&
        e.sourceInstanceId !== null &&
        String(state.instances[e.sourceInstanceId]?.cardId) === `${P}15`,
    );
    expect(indirect.map((e) => (e as { amount: number }).amount)).toEqual([3]);
    expect(
      run.events.filter((e) => e.type === "surgeTriggered"),
      "no surge: the damage was taken",
    ).toHaveLength(0);
  });

  it("Cosmic Connection gains surge without the Cosmic Ax in play", () => {
    const base = stackTop(withBoard("weapon"), `${P}15`, 3);
    const start = base.round;
    const run = drive(base, { type: "endTurn", playerId: P1 }, quiet, (s) => s.round > start);
    expect(run.events.filter((e) => e.type === "surgeTriggered").length).toBeGreaterThanOrEqual(1);
  });
});

describe("pack content", () => {
  it("ships the suggested deck: the Battle Board (permanent) plus 40 counted cards, 15 of them Night Thrasher's", () => {
    const cards = precon().cards;
    const counted = cards.filter((c) => String(c.cardId) !== `${P}02a`);
    expect(counted.reduce((n, c) => n + c.quantity, 0)).toBe(40);
    expect(cards.find((c) => String(c.cardId) === `${P}02a`)?.quantity).toBe(1);
    const own = counted.filter((c) => String(c.cardId).startsWith(P)).reduce((n, c) => n + c.quantity, 0);
    expect(own).toBe(15);
    expect(precon().name).toMatch(/suggested/i);
  });

  it("scripts every ability, and Tech Deck is the identity's deckbuilding allowance", () => {
    const identity = pack.cards.find((c) => String(c.id) === `${P}01a`)!;
    expect("deckbuilding" in identity ? identity.deckbuilding?.offAspectAllowance : undefined).toEqual({
      anyTrait: ["SKILL"],
      maxCards: 4,
    });
  });

  it("Tech Deck lets in an off-aspect Skill card of any type, and refuses a card without the trait", () => {
    const pool = cardPoolWithPack(PLAYABLE_CARDS, pack);
    const deck = precon();
    // The precon is Aggression; Justice, Leadership and Protection cards are off-aspect for it.
    const offAspect = (skill: boolean, type: PlayerCard["type"]) =>
      pool.find(
        (c): c is PlayerCard =>
          "deckLimit" in c &&
          c.type === type &&
          ["justice", "leadership", "protection"].includes(String(c.aspect)) &&
          c.traits.includes("SKILL" as never) === skill &&
          !deck.cards.some((entry) => entry.cardId === c.id),
      )!;
    const problemsWith = (card: PlayerCard) => {
      const verdict = validateDeck(
        {
          identityCardId: deck.identityCardId,
          aspects: deck.aspects,
          cards: [...deck.cards, { cardId: card.id, quantity: 1 }],
        },
        pool,
      );
      return verdict.ok ? [] : verdict.problems.filter((p) => p.cardIds?.includes(card.id));
    };
    const skillEvent = offAspect(true, "event");
    const plainEvent = offAspect(false, "event");
    expect(skillEvent, "a Skill event of another aspect").toBeDefined();
    expect(problemsWith(skillEvent)).toEqual([]);
    expect(problemsWith(plainEvent).map((p) => p.code)).toContain("aspect_restriction");
  });
});
