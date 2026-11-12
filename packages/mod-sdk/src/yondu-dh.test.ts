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
 * Rulings of the Yondu pack (content-packs/community/yondu-dh), staged on the real engine: each test sets up a
 * situation by state surgery (a card moved into play, damage on a character) and then runs the card's own scripted
 * ability. The pack is built from its source folder like any pack, so these run on what a client installs. The pack is a
 * DRAFT (its DRAFT file keeps it out of the generic community-packs test), so this file is its only suite for now.
 */
const SRC = fileURLToPath(new URL("../../../content-packs/community/yondu-dh", import.meta.url));
const P = "x.yondu-dh.";
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
  const root = mkdtempSync(join(tmpdir(), "mc-yondu-"));
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

const precon = (): StarterDeck => pack.decks!.find((d) => d.id === "yondu-dh-aggression")!;

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

/** A Rhino game with the Yondu precon, in hero form, past setup, at the start of the player phase. */
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

/**
 * A card of the player's deck by code, put into play (surgery): attached to `host` (in the host's `attachments`, with
 * its `attachedTo` set, as the engine keeps an attached card), or in the player's play area for `null`. An earlier
 * version set only `attachedTo` and left the card in the play area, which is why `hasAttachment` (it reads the host's
 * `attachments`) seemed not to see the arrow; `query({ host })` reads `attachedTo` and did.
 */
function intoPlay(
  state: GameState,
  code: string,
  host: InstanceId | null,
): { readonly state: GameState; readonly id: InstanceId } {
  const owner = state.players.find((p) => p.playerId === P1)!;
  const id = owner.deck.find((i) => String(state.instances[i]!.cardId) === `${P}${code}`);
  if (!id) throw new Error(`${code} is not in the deck`);
  const placed: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1
        ? { ...p, deck: p.deck.filter((i) => i !== id), playArea: host === null ? [...p.playArea, id] : p.playArea }
        : p,
    ),
  };
  const hosted =
    host === null ? placed : patch(placed, host, { attachments: [...placed.instances[host]!.attachments, id] });
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

const use = (card: InstanceId, ability: string, payment: readonly InstanceId[] = []): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: card,
  abilityId: `${P}${ability}` as never,
  payment: payment.map((fromHand) => ({ fromHand })),
});
const play = (card: InstanceId, payment: readonly InstanceId[] = []): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: card,
  payment: payment.map((fromHand) => ({ fromHand })),
  attachToInstanceId: null,
});

const damageOf = (s: GameState, id: InstanceId): number => s.instances[id]!.damage;
const hostOf = (s: GameState, id: InstanceId): InstanceId | null => s.instances[id]!.attachedTo;

describe("pack content", () => {
  it("validates as built, every ability scripted", () => {
    expect(validatePack(pack)).toEqual([]);
  });

  it("ships the authors' precon: 40 cards, 15 of them Yondu's, led by Yondu", () => {
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

describe("the Yaka Arrow moving between characters (Tahlei)", () => {
  /** Yondu with Tahlei and the arrow in play, the arrow on `arrowOn`, a hand of nothing. */
  function table(arrowOn: "identity" | "villain") {
    let state = emptyHand(open());
    const tahlei = intoPlay(state, "11", identityOf(state));
    state = tahlei.state;
    const arrow = intoPlay(state, "12", arrowOn === "identity" ? identityOf(state) : villainOf(state));
    return { state: arrow.state, tahlei: tahlei.id, arrow: arrow.id };
  }

  it("attached to an enemy: D'ast Whistlin' deals that enemy 1 damage (Response, after the attach)", () => {
    const t = table("identity");
    const before = damageOf(t.state, villainOf(t.state));
    const run = drive(
      t.state,
      use(t.tahlei, "11.tahlei-action"),
      takes(/Attach the Yaka Arrow to an enemy/, /^Yondu$/),
    );
    expect(hostOf(run.state, t.arrow), "the arrow is on the villain").toBe(villainOf(run.state));
    expect(damageOf(run.state, villainOf(run.state)) - before, "1 damage from D'ast Whistlin'").toBe(1);
  });

  it("attached to your identity: heals 1 damage from Yondu", () => {
    const t = table("villain");
    const hurt = patch(t.state, identityOf(t.state), { damage: 3 });
    const run = drive(
      hurt,
      use(t.tahlei, "11.tahlei-action"),
      takes(/Attach the Yaka Arrow to your identity/, /^Yondu$/),
    );
    expect(hostOf(run.state, t.arrow)).toBe(identityOf(run.state));
    expect(damageOf(run.state, identityOf(run.state))).toBe(2);
  });

  it("add it to your hand: the arrow leaves play", () => {
    const t = table("villain");
    const run = drive(t.state, use(t.tahlei, "11.tahlei-action"), takes(/Add the Yaka Arrow to your hand/));
    expect(run.state.players[0]!.hand).toContain(t.arrow);
  });

  it("Yaka Arrow on Yondu: +1 THW and +1 ATK; on an enemy: nothing", () => {
    const base = emptyHand(open());
    const on = intoPlay(base, "12", identityOf(base));
    const off = intoPlay(base, "12", villainOf(base));
    expect(statOf(on.state, "atk") - statOf(off.state, "atk")).toBe(1);
    expect(statOf(on.state, "thw") - statOf(off.state, "thw")).toBe(1);
  });
});

/** Yondu's current ATK or THW, from the engine's own derived stats. */
function statOf(state: GameState, key: "atk" | "thw"): number {
  const profile = characterProfile(state, identityOf(state), deps)!;
  return profile[key];
}

describe("events", () => {
  it("Cheap Shot stuns the enemy and deals 6 damage to it only if the arrow is attached", () => {
    for (const armed of [true, false]) {
      let state = emptyHand(open());
      const shot = toHand(state, `${P}02`);
      const paid = withResources(shot.state, 1);
      state = paid.state;
      if (armed) state = intoPlay(state, "12", villainOf(state)).state;
      const before = damageOf(state, villainOf(state));
      const run = drive(state, play(shot.id, paid.ids), takes(/^Yondu$/));
      const villain = run.state.instances[villainOf(run.state)]!;
      expect(damageOf(run.state, villainOf(run.state)) - before, armed ? "6 + 1 D'ast is not due" : "no damage").toBe(
        armed ? 6 : 0,
      );
      expect(JSON.stringify(villain.statuses ?? villain)).toMatch(/stun/i);
    }
  });

  it("Whistle While You Work (errata): with the arrow in play attaches it to Yondu and readies him; otherwise summons it to hand", () => {
    // In play on the villain.
    let state = emptyHand(open());
    const card = toHand(state, `${P}04`);
    const paid = withResources(card.state, 1);
    const arrow = intoPlay(paid.state, "12", villainOf(paid.state));
    const used = drive(arrow.state, play(card.id, paid.ids), takes(/^Yondu$/));
    expect(hostOf(used.state, arrow.id), "attached to Yondu").toBe(identityOf(used.state));
    // Not in play: found into the hand.
    state = emptyHand(open());
    const card2 = toHand(state, `${P}04`);
    const paid2 = withResources(card2.state, 1);
    const found = drive(paid2.state, play(card2.id, paid2.ids));
    const arrowCard = copies(found.state, "12")[0]!;
    expect(found.state.players[0]!.hand).toContain(arrowCard);
  });

  it("Tough Motherlover gives Yondu a tough status card, and draws only with the arrow in hand", () => {
    for (const hasArrow of [true, false]) {
      let state = emptyHand(open());
      const card = toHand(state, `${P}05`);
      const paid = withResources(card.state, 1);
      state = paid.state;
      if (hasArrow) state = toHand(state, `${P}12`).state;
      const handBefore = state.players[0]!.hand.length;
      const run = drive(state, play(card.id, paid.ids));
      expect(run.events.filter((e) => e.type === "cardDrawn")).toHaveLength(hasArrow ? 1 : 0);
      expect(run.state.players[0]!.hand.length).toBe(handBefore - 1 - paid.ids.length + (hasArrow ? 1 : 0));
    }
  });
});

describe("Invest", () => {
  it("spending 2 resources (one basic resource card) attaches the arrow to an enemy or your identity; spending 4 draws 5", () => {
    for (const cardsSpent of [1, 2]) {
      let state = emptyHand(open());
      const invest = intoPlay(state, "09", identityOf(state));
      const arrow = intoPlay(invest.state, "12", identityOf(state));
      const paid = withResources(arrow.state, cardsSpent);
      const run = drive(paid.state, use(invest.id, "09.invest-action", paid.ids), takes(/Rhino/));
      if (cardsSpent === 1) expect(hostOf(run.state, arrow.id), "moved onto the villain").toBe(villainOf(run.state));
      else expect(run.events.filter((e) => e.type === "cardDrawn")).toHaveLength(5);
    }
  });
});

describe("Sav'rkk and the nemesis set", () => {
  const savrkkOf = (s: GameState): InstanceId | undefined =>
    copies(s, "15").find((id) => s.instances[id]!.engagedWith !== undefined && s.instances[id]!.engagedWith !== null);

  /** The top `n` encounter cards relabeled: boost cards for each activation first (the villain, then each minion), then the one revealed. */
  function stack(state: GameState, code: string, n = 2): GameState {
    const top = activeEncounterDeck(state).deck.slice(0, n);
    return top.reduce((acc, id) => patch(acc, id, { cardId: `${P}${code}` as never }), state);
  }

  it("Savage Destruction with Sav'rkk out of play summons and reveals him, with the Sword-Gun-Arm attached", () => {
    const run = drive(stack(emptyHand(open()), "18"), { type: "endTurn", playerId: P1 });
    const savrkk = savrkkOf(run.state);
    expect(savrkk, "Sav'rkk is in play engaged with the player").toBeDefined();
    const arms = copies(run.state, "16").filter((id) => hostOf(run.state, id) === savrkk);
    expect(arms, "Sword-Gun-Arm attached to Sav'rkk").toHaveLength(1);
  });

  it("Hard to Kill with Sav'rkk in play heals him 2 (and does not summon another)", () => {
    const first = drive(stack(emptyHand(open()), "18"), { type: "endTurn", playerId: P1 });
    const savrkk = savrkkOf(first.state)!;
    // Yondu is healed (surgery) so the two attacks of the villain phase do not eliminate him before the reveal.
    const hurt = patch(patch(first.state, savrkk, { damage: 3 }), identityOf(first.state), { damage: 0 });
    const next = drive(stack(hurt, "17", 3), { type: "endTurn", playerId: P1 });
    expect(copies(next.state, "15")).toHaveLength(1);
    expect(damageOf(next.state, savrkk)).toBeLessThanOrEqual(1);
  });
});

describe("Ravager Redshirts", () => {
  /** The labels of every prompt met, and the damage dealt to Yondu, while the villain phase plays out one round. */
  function villainPhase(arrowOnVillain: boolean) {
    let state = emptyHand(open());
    state = intoPlay(state, "08", null).state;
    // The villain's boost card is the same in both runs: a Savage Destruction (1 boost icon, no boost ability).
    const boost = activeEncounterDeck(state).deck[0]!;
    state = patch(state, boost, { cardId: `${P}18` as never });
    if (arrowOnVillain) state = intoPlay(state, "12", villainOf(state)).state;
    const offered: string[] = [];
    const start = state.round;
    const run = drive(
      state,
      { type: "endTurn", playerId: P1 },
      (s) => {
        const c = s.pendingChoice!;
        offered.push(...c.options.map((o) => o.label));
        return takes(/Ravager Redshirts/)(s);
      },
      (s) => s.round > start,
    );
    const damage = run.events.flatMap((e) =>
      e.type === "damageDealt" && e.targetInstanceId === identityOf(state) ? [e.amount] : [],
    );
    return { offered, damage };
  }

  it("with the arrow on the attacking enemy, prevents up to 2 of the damage; without it the interrupt is not offered", () => {
    const armed = villainPhase(true);
    const bare = villainPhase(false);
    expect(armed.offered).toContain("Ravager Redshirts");
    expect(bare.offered).not.toContain("Ravager Redshirts");
    expect(armed.damage[0]).toBe(bare.damage[0]! - 2);
  });
});

describe("Twirlin' and Whirlin'", () => {
  /** Plays it with `cards` basic resource cards (2 resources each, all overpaid at cost 0); the arrow starts on Yondu. */
  function played(cards: number, pick: (s: GameState) => readonly string[]) {
    let state = emptyHand(open());
    const event = toHand(state, `${P}06`);
    const arrow = intoPlay(event.state, "12", identityOf(event.state));
    const paid = withResources(arrow.state, cards);
    const run = drive(paid.state, play(event.id, paid.ids), pick);
    return { run, arrow: arrow.id };
  }

  it("with nothing overpaid attaches the arrow once", () => {
    const { run, arrow } = played(0, takes(/Rhino/));
    expect(hostOf(run.state, arrow)).toBe(villainOf(run.state));
    expect(run.events.filter((e) => e.type === "triggerEvent" && e.event.kind === "cardAttached")).toHaveLength(1);
  });

  it("each overpaid resource may repeat it: 2 overpaid resources, all taken, attach it 3 times", () => {
    // Alternates the host (Rhino, Yondu, Rhino): an arrow put back where it already is is not attached anew.
    let hosts = 0;
    const { run } = played(1, (s) =>
      s.pendingChoice!.prompt.kind === "chooseTarget"
        ? takes(hosts++ % 2 === 0 ? /Rhino/ : /^Yondu$/)(s)
        : takes(/^Repeat/, /^Yondu$/)(s),
    );
    expect(run.events.filter((e) => e.type === "triggerEvent" && e.event.kind === "cardAttached")).toHaveLength(3);
  });
});

describe("Yaka Arrow: 'cannot be attached to cards unless it is in play'", () => {
  it("played from hand it enters play attached to nothing, in Yondu's play area, with no host asked for; no bonus", () => {
    let state = emptyHand(open());
    const arrow = toHand(state, `${P}12`);
    const paid = withResources(arrow.state, 1);
    state = paid.state;
    const kinds: string[] = [];
    const run = drive(state, play(arrow.id, paid.ids), (s) => {
      kinds.push(s.pendingChoice!.prompt.kind);
      return takes()(s);
    });
    expect(kinds).not.toContain("chooseTarget");
    expect(hostOf(run.state, arrow.id)).toBeNull();
    expect(run.state.players[0]!.playArea).toContain(arrow.id);
    expect(statOf(run.state, "atk")).toBe(statOf(state, "atk"));
  });

  it("then Whistle While You Work attaches it to Yondu, with the +1 ATK", () => {
    let state = emptyHand(open());
    const arrow = intoPlay(state, "12", null);
    const card = toHand(arrow.state, `${P}04`);
    const paid = withResources(card.state, 1);
    state = paid.state;
    const run = drive(state, play(card.id, paid.ids), takes(/^Yondu$/));
    expect(hostOf(run.state, arrow.id)).toBe(identityOf(run.state));
    expect(statOf(run.state, "atk") - statOf(state, "atk")).toBe(1);
  });
});

describe("D'ast Whistlin': the arrow removed from an enemy", () => {
  /** Yondu with Tahlei on him and the arrow on the villain. */
  function onVillain() {
    let state = emptyHand(open());
    const tahlei = intoPlay(state, "11", identityOf(state));
    state = tahlei.state;
    const arrow = intoPlay(state, "12", villainOf(state));
    return { state: arrow.state, tahlei: tahlei.id, arrow: arrow.id };
  }

  it("moved from the villain to Yondu: the villain takes 1 (removed), and Yondu heals 1 (attached to him)", () => {
    const t = onVillain();
    const hurt = patch(t.state, identityOf(t.state), { damage: 3 });
    const before = damageOf(hurt, villainOf(hurt));
    const run = drive(
      hurt,
      use(t.tahlei, "11.tahlei-action"),
      takes(/Attach the Yaka Arrow to your identity/, /^Yondu$/),
    );
    expect(hostOf(run.state, t.arrow)).toBe(identityOf(run.state));
    expect(damageOf(run.state, villainOf(run.state)) - before).toBe(1);
    expect(damageOf(run.state, identityOf(run.state))).toBe(2);
  });

  it("returned to hand from the villain: the villain takes 1", () => {
    const t = onVillain();
    const before = damageOf(t.state, villainOf(t.state));
    const run = drive(t.state, use(t.tahlei, "11.tahlei-action"), takes(/Add the Yaka Arrow to your hand/, /^Yondu$/));
    expect(run.state.players[0]!.hand).toContain(t.arrow);
    expect(damageOf(run.state, villainOf(run.state)) - before).toBe(1);
  });
});

describe("Jackpot!: 'treat the next card you spend as if it has double the resources'", () => {
  it("spent for one card, it doubles the next card spent in a later payment: a 1-resource card pays a 2-cost card", () => {
    let state = emptyHand(open());
    const motherlover = toHand(state, `${P}05`);
    const jackpot = toHand(motherlover.state, `${P}07`);
    const redshirts = toHand(jackpot.state, `${P}08`);
    const cheapShot = toHand(redshirts.state, `${P}02`);
    state = cheapShot.state;
    const first = drive(state, play(motherlover.id, [jackpot.id]), takes(/Jackpot/));
    expect(first.events.some((e) => e.type === "lastingEffectAdded")).toBe(true);
    const second = drive(first.state, play(redshirts.id, [cheapShot.id]), takes(/Jackpot/));
    expect(second.state.players[0]!.playArea).toContain(redshirts.id);
    expect(second.events.flatMap((e) => (e.type === "spentCardDoubled" ? [e.instanceId] : []))).toEqual([cheapShot.id]);
  });
});

describe("Sav'rkk: 'upgrades cannot be removed from Sav'rkk'", () => {
  it("the arrow on him stays: Tahlei cannot return it to hand", () => {
    const base = emptyHand(open());
    const top = activeEncounterDeck(base).deck.slice(0, 2);
    const stacked = top.reduce((acc, id) => patch(acc, id, { cardId: `${P}18` as never }), base);
    const revealed = drive(stacked, { type: "endTurn", playerId: P1 });
    const savrkk = copies(revealed.state, "15").find((id) => revealed.state.instances[id]!.engagedWith)!;
    expect(savrkk).toBeDefined();
    let state = patch(revealed.state, identityOf(revealed.state), { damage: 0 });
    const tahlei = intoPlay(state, "11", identityOf(state));
    state = tahlei.state;
    const arrow = intoPlay(state, "12", savrkk);
    const run = drive(arrow.state, use(tahlei.id, "11.tahlei-action"), takes(/Add the Yaka Arrow to your hand/));
    expect(hostOf(run.state, arrow.id)).toBe(savrkk);
    expect(run.events.some((e) => e.type === "leavePlayBlocked" && e.instanceId === arrow.id)).toBe(true);
  });
});

describe("Summon: everywhere in or out of play", () => {
  it("Whistle While You Work finds the arrow removed from the game and adds it to the hand", () => {
    let state = emptyHand(open());
    const arrowId = state.players[0]!.deck.find((i) => String(state.instances[i]!.cardId) === `${P}12`)!;
    state = {
      ...state,
      players: state.players.map((p) => ({ ...p, deck: p.deck.filter((i) => i !== arrowId) })),
      removedFromGame: [...state.removedFromGame, arrowId],
    };
    const card = toHand(state, `${P}04`);
    const paid = withResources(card.state, 1);
    const run = drive(paid.state, play(card.id, paid.ids));
    expect(run.state.players[0]!.hand).toContain(arrowId);
  });
});
