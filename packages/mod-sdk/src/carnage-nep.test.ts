import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { PLAYABLE_DEPS, coreScenario } from "@mc/cards";
import { PLAYABLE_CARDS, type PackManifest, type StarterDeck } from "@mc/content";
import {
  applyCommand,
  createGame,
  playerId,
  activeEncounterDeck,
  activeEncounterDeckId,
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

/**
 * Rulings of the Carnage pack (content-packs/community/carnage-nep), staged on the real engine: each test sets up a
 * situation by state surgery (a damaged villain, a card in hand) and then runs the card's own scripted ability. The
 * pack is built from its source folder like any pack, so these run on what a client installs.
 */
const SRC = fileURLToPath(new URL("../../../content-packs/community/carnage-nep", import.meta.url));
const P = "x.carnage-nep.";
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
  const root = mkdtempSync(join(tmpdir(), "mc-carnage-"));
  scratch.push(root);
  const src = join(root, "src");
  cpSync(SRC, src, { recursive: true });
  if (!existsSync(join(src, "alt-art"))) {
    const file = join(src, "pack.json");
    const manifest = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
    delete manifest.altArt;
    const { writeFileSync } = await import("node:fs");
    writeFileSync(file, JSON.stringify(manifest));
  }
  const out = join(root, "out");
  await buildPack(src, out);
  const manifest = JSON.parse(readFileSync(join(out, "pack.json"), "utf8")) as PackManifest;
  const files = new Map<string, Uint8Array>();
  for (const full of walk(out)) {
    const path = relative(out, full).split(sep).join("/");
    if (path !== "pack.json" && !path.endsWith(".zip")) files.set(path, new Uint8Array(readFileSync(full)));
  }
  pack = readPackInput(manifest, files);
  deps = gameDepsWithPack(PLAYABLE_DEPS, pack);
});
afterAll(() => {
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
});

const precon = (): StarterDeck => pack.decks!.find((d) => d.id === "carnage-nep-aggression")!;

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

/** A Rhino game with the Carnage precon, in hero form, past setup, at the start of the player phase. */
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

/** A minion (relabeled from the top of the encounter deck) put into play engaged with P1 (surgery: no reveal). */
function conjure(state: GameState, code: string): { readonly state: GameState; readonly id: InstanceId } {
  const pile = activeEncounterDeck(state);
  const spare = pile.deck[0]!;
  const patched: GameState = {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [activeEncounterDeckId(state)]: { deck: pile.deck.slice(1), discard: pile.discard },
    },
    players: state.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, spare] } : p)),
    instances: {
      ...state.instances,
      [spare]: { ...state.instances[spare]!, cardId: code as never, faceup: true, engagedWith: P1 },
    },
  };
  return { state: patched, id: spare };
}

/** The top `n` cards of the encounter deck relabeled as `code` (they stay in the deck, to be dealt or used as boost cards). */
function stackTop(state: GameState, code: string, n: number): GameState {
  const top = activeEncounterDeck(state).deck.slice(0, n);
  return top.reduce((acc, id) => patch(acc, id, { cardId: code as never }), state);
}

/** Carnage's basic attack (2 ATK) on the target, staged one hit point short of defeat, so the blow has 1 excess. */
function killingBlow(
  state: GameState,
  target: InstanceId,
  pick?: (s: GameState) => readonly string[],
): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  const printed = state.cardPool[String(state.instances[target]!.cardId)]!;
  const hp = printed.type === "minion" ? printed.hp : 0;
  const staged = patch(state, target, { damage: hp - 1 });
  return drive(
    staged,
    { type: "basicAttack", playerId: P1, attackerInstanceId: identityOf(staged), targetInstanceId: target },
    pick,
  );
}

/** Ends the turn and plays the villain phase through to the start of the next round's player phase. */
function toNextRound(state: GameState): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  const round = state.round;
  return drive(state, { type: "endTurn", playerId: P1 }, undefined, (s) => s.round > round);
}

const damageToIdentityFromIdentity = (events: readonly GameEvent[], s: GameState): number[] =>
  events.flatMap((e) =>
    e.type === "damageDealt" && e.targetInstanceId === identityOf(s) && e.sourceInstanceId === identityOf(s)
      ? [e.amount]
      : [],
  );

describe("Carnage identity", () => {
  it("Need to Kill: with no enemy defeated this round, Carnage takes damage equal to his ATK at the end of the round", () => {
    const state = open();
    const { state: after, events } = toNextRound(state);
    expect(after.round).toBeGreaterThan(state.round);
    expect(damageToIdentityFromIdentity(events, state)).toEqual([2]);
  });

  it("Need to Kill: an enemy defeated this round (an attack of Carnage's) means no damage, and the count is cleared", () => {
    const state = open();
    const staged = conjure(state, "32093");
    const hit = killingBlow(staged.state, staged.id);
    expect(
      hit.events.some((e) => e.type === "counterAdded"),
      "Need to Kill counted the defeat",
    ).toBe(true);
    const next = toNextRound(hit.state);
    expect(damageToIdentityFromIdentity([...hit.events, ...next.events], state)).toEqual([]);
    // The next round has no defeat, so Need to Kill bites again: the count of the first round did not carry over.
    const again = toNextRound(patch(next.state, identityOf(state), { damage: 0 }));
    expect(damageToIdentityFromIdentity(again.events, state)).toEqual([2]);
  });

  it("Death-Dealer: after Carnage defeats an enemy, he heals 1 damage per point of excess damage (optional response)", () => {
    const state = open();
    const staged = conjure(patch(state, identityOf(state), { damage: 5 }), "32093");
    const useResponse = (s: GameState): readonly string[] => {
      const c = s.pendingChoice!;
      const hit = c.options.find((o) => o.optionId.includes("death-dealer"));
      return hit ? [hit.optionId] : c.options.slice(0, c.minSelections).map((o) => o.optionId);
    };
    const hit = killingBlow(staged.state, staged.id, useResponse);
    expect(hit.state.instances[identityOf(state)]!.damage).toBe(4);
  });
});

/** A copy of a pack card from P1's deck put straight into play (surgery: no cost, no enter-play effects). */
function intoPlay(state: GameState, code: string): { readonly state: GameState; readonly id: InstanceId } {
  const id = state.players[0]!.deck.find((i) => String(state.instances[i]!.cardId) === `${P}${code}`)!;
  expect(id, `${code} in the deck`).toBeDefined();
  return {
    id,
    state: {
      ...patch(state, id, { faceup: true, controllerId: P1 }),
      players: state.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: p.deck.filter((i) => i !== id), playArea: [...p.playArea, id] } : p,
      ),
    },
  };
}

describe("Spider-Man (ally)", () => {
  it("exhausts and takes 1 damage to prevent all of Need to Kill's damage to Carnage", () => {
    const staged = intoPlay(open(), "02");
    const useSpiderMan = (s: GameState): readonly string[] => {
      const c = s.pendingChoice!;
      const hit = c.options.find((o) => o.optionId.includes("spider-man-interrupt"));
      return hit ? [hit.optionId] : c.options.slice(0, c.minSelections).map((o) => o.optionId);
    };
    const next = drive(
      staged.state,
      { type: "endTurn", playerId: P1 },
      useSpiderMan,
      (s) => s.round > staged.state.round,
    );
    const spider = next.state.instances[staged.id]!;
    expect(spider.damage, "Spider-Man took 1 damage as the cost").toBe(1);
    expect(damageToIdentityFromIdentity(next.events, staged.state)).toEqual([]);
    expect(next.events.some((e) => e.type === "damagePrevented")).toBe(true);
  });
});

/** Answers every prompt with the first legal option, and takes an option whose id contains `wanted` when offered. */
const takes =
  (...wanted: readonly string[]) =>
  (s: GameState): readonly string[] => {
    const c = s.pendingChoice!;
    if (c.prompt.kind === "declareDefender") return ["decline"];
    const hit = c.options.find((o) => wanted.some((w) => o.optionId.includes(w)));
    return hit ? [hit.optionId] : c.options.slice(0, c.minSelections).map((o) => o.optionId);
  };

const damageBy = (events: readonly GameEvent[], source: InstanceId, target: InstanceId): number[] =>
  events.flatMap((e) =>
    e.type === "damageDealt" && e.sourceInstanceId === source && e.targetInstanceId === target ? [e.amount] : [],
  );

describe("Torment (nemesis minion)", () => {
  it("cancels his attack and discards an ally with the same classification as the attacked character", () => {
    const withSpider = intoPlay(open(), "02");
    const torment = conjure(withSpider.state, `${P}15`);
    const next = drive(torment.state, { type: "endTurn", playerId: P1 }, takes(), (s) => s.round > torment.state.round);
    const player = next.state.players[0]!;
    expect(player.discard, "Spider-Man (identity-specific, like Carnage) was discarded instead").toContain(
      withSpider.id,
    );
    expect(damageBy(next.events, torment.id, identityOf(next.state)), "Torment's attack was cancelled").toEqual([]);
  });

  it("is not cancelled when no ally or Persona support matches: his attack goes through", () => {
    const torment = conjure(open(), `${P}15`);
    const next = drive(torment.state, { type: "endTurn", playerId: P1 }, takes(), (s) => s.round > torment.state.round);
    expect(damageBy(next.events, torment.id, identityOf(next.state)).length).toBeGreaterThan(0);
  });
});

describe("Murderous Nature (attachment)", () => {
  /**
   * A Sentinel engaged with Carnage, Murderous Nature dealt to Carnage in the first villain phase and attached to the
   * minion by its "Attach to a non-Elite minion" text, then the second round's events (where the minion attacks).
   * `villainDamage` is staged on the villain.
   */
  function secondRound(villainDamage: number) {
    const minion = conjure(open(), "32093");
    const staged = patch(stackTop(minion.state, `${P}22`, 4), villainOf(minion.state), { damage: villainDamage });
    const first = drive(staged, { type: "endTurn", playerId: P1 }, takes(), (s) => s.round > staged.round);
    const attached = Object.values(first.state.instances).find(
      (i) => String(i.cardId) === `${P}22` && i.attachedTo === minion.id,
    );
    expect(attached, "Murderous Nature attached to the minion in the first villain phase").toBeDefined();
    // Rhino is stunned for the second round, so its attack (boosted by the stacked cards) is not what is measured.
    const quiet = patch(first.state, villainOf(first.state), {
      statuses: { ...first.state.instances[villainOf(first.state)]!.statuses, stunned: 1 },
    });
    const second = drive(quiet, { type: "endTurn", playerId: P1 }, takes(), (s) => s.round > quiet.round);
    return { minion: minion.id, state: second.state, events: second.events };
  }

  it("makes the attached minion attack the character with the fewest remaining hit points: a friendly one", () => {
    const run = secondRound(0);
    expect(damageBy(run.events, run.minion, identityOf(run.state)).length, "hit Carnage").toBeGreaterThan(0);
  });

  it("... or another enemy, when that one has the fewest: the villain, one hit point from defeat", () => {
    const run = secondRound(13);
    expect(damageBy(run.events, run.minion, villainOf(run.state)).length, "hit the villain").toBeGreaterThan(0);
    expect(damageBy(run.events, run.minion, identityOf(run.state)), "not the hero").toEqual([]);
  });
});

describe("Muse (minion)", () => {
  /**
   * Muse (ATK raised to 3 by surgery, so a blow can carry excess; 4 damage on him) engaged with Carnage in the villain
   * phase, Rhino stunned, the other characters staged by `stage`. The author's answer (relayed 2026-11-11): he
   * attacks ANY other character with the fewest remaining hit points.
   */
  function museRoundFrom(base: GameState, stage: (s: GameState) => GameState) {
    const conjured = conjure(base, `${P}19`);
    const code = `${P}19`;
    let state: GameState = {
      ...conjured.state,
      cardPool: {
        ...conjured.state.cardPool,
        [code]: { ...conjured.state.cardPool[code]!, atk: 3 } as never,
      },
    };
    state = patch(state, conjured.id, { damage: 4 });
    state = patch(state, villainOf(state), {
      statuses: { ...state.instances[villainOf(state)]!.statuses, stunned: 1 },
    });
    state = stage(state);
    const run = drive(state, { type: "endTurn", playerId: P1 }, takes(), (s) => s.round > state.round);
    return { muse: conjured.id, state: run.state, events: run.events };
  }
  const toughOn = (s: GameState, id: InstanceId): number => s.instances[id]?.statuses?.tough ?? 0;
  const healedFromMuse = (r: { muse: InstanceId; state: GameState }): number =>
    4 - (r.state.instances[r.muse]?.damage ?? 0);

  it("attacks an ally with the fewest remaining hit points, with piercing, and heals the excess when it defeats it", () => {
    const spider = intoPlay(open(), "02");
    const r = museRoundFrom(spider.state, (s) =>
      patch(s, spider.id, { damage: 3, statuses: { ...s.instances[spider.id]!.statuses, tough: 1 } }),
    );
    expect(damageBy(r.events, r.muse, spider.id).length, "hit the ally").toBeGreaterThan(0);
    expect(damageBy(r.events, r.muse, identityOf(r.state)), "not the hero").toEqual([]);
    expect(toughOn(r.state, spider.id), "piercing discarded its tough status").toBe(0);
    expect(r.state.players[0]!.discard, "the ally was defeated").toContain(spider.id);
    // The ally had 1 hit point left: every point of the blow beyond the first is excess, healed from Muse.
    expect(healedFromMuse(r)).toBe(damageBy(r.events, r.muse, spider.id)[0]! - 1);
  });

  it("attacks another minion with the fewest remaining hit points (enemy attacks enemy), with piercing and the heal", () => {
    const sentinel = conjure(open(), "32093");
    const r = museRoundFrom(sentinel.state, (s) =>
      patch(s, sentinel.id, {
        damage: (s.cardPool["32093"] as { hp: number }).hp - 1,
        statuses: { ...s.instances[sentinel.id]!.statuses, tough: 1 },
      }),
    );
    expect(damageBy(r.events, r.muse, sentinel.id), "ATK 3, no boost card").toEqual([3]);
    expect(damageBy(r.events, r.muse, identityOf(r.state)), "not the hero").toEqual([]);
    expect(toughOn(r.state, sentinel.id), "the attack had piercing").toBe(0);
    expect(healedFromMuse(r), "2 excess damage healed from Muse").toBe(2);
  });

  it("attacks the villain when it has the fewest remaining hit points", () => {
    const r = museRoundFrom(open(), (s) => patch(s, villainOf(s), { damage: 13 }));
    expect(damageBy(r.events, r.muse, villainOf(r.state)).length, "hit the villain").toBeGreaterThan(0);
    expect(damageBy(r.events, r.muse, identityOf(r.state)), "not the hero").toEqual([]);
  });

  it("attacks Carnage when he has the fewest remaining hit points", () => {
    const r = museRoundFrom(open(), (s) => patch(s, identityOf(s), { damage: 5 }));
    expect(damageBy(r.events, r.muse, identityOf(r.state)).length, "hit the hero").toBeGreaterThan(0);
    expect(healedFromMuse(r), "no excess, no heal").toBe(0);
  });
});

describe("pack content", () => {
  it("ships the suggested deck as a legal 40-card deck of 15 Carnage cards and 25 base cards", () => {
    const cards = precon().cards;
    expect(cards.reduce((n, c) => n + c.quantity, 0)).toBe(40);
    const own = cards.filter((c) => String(c.cardId).startsWith(P)).reduce((n, c) => n + c.quantity, 0);
    expect(own).toBe(15);
    expect(precon().name).toMatch(/suggested/i);
  });

  it("scripts both of Klyntar Bond's abilities", () => {
    const klyntar = pack.cards.find((c) => String(c.id) === `${P}09`)!;
    const ids = "abilities" in klyntar ? klyntar.abilities.map((a) => String(a.id)) : [];
    expect(ids).toEqual([`${P}09.klyntar-bond-interrupt`, `${P}09.klyntar-bond-resource`]);
  });
});
