import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { PLAYABLE_DEPS, coreScenario } from "@mc/cards";
import { PLAYABLE_CARDS, type PackManifest, type StarterDeck } from "@mc/content";
import {
  activeAbilityRefs,
  activeEncounterDeck,
  applyCommand,
  createGame,
  maxHitPoints,
  playerId,
  textBoxBlankFor,
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
import { readPackInput, type PackInput } from "./validate.js";

/**
 * Targeted engine tests for Gwenpool (by PatataSaurio): the speech bubbles, the cards that count, filter and resolve
 * them, Out of the Game, and the nemesis set. Each plays the pack's real abilities on the real engine against the Core
 * Rhino scenario, with the state set up by surgery (cards relabeled or moved into play) where a scenario would take
 * many turns.
 */
const SRC = fileURLToPath(new URL("../../../content-packs/community/gwenpool-ptt", import.meta.url));
const P = "x.gwenpool-ptt.";
const P1 = playerId("p1");
/** A Core Rhino encounter card with no boost icons and nothing that matters when it is boosted (Hard to Keep Down). */
const BLANK = "01104";

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

let pack: PackInput;
let deps: EngineDeps;
const scratch: string[] = [];
beforeAll(async () => {
  const root = mkdtempSync(join(tmpdir(), "mc-gwenpool-"));
  scratch.push(root);
  const src = join(root, "src");
  cpSync(SRC, src, { recursive: true });
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
    if (path !== "pack.json" && !path.endsWith(".zip")) files.set(path, new Uint8Array(readFileSync(full)));
  }
  pack = readPackInput(manifest, files);
  deps = gameDepsWithPack(PLAYABLE_DEPS, pack);
});
afterAll(() => {
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
});

const precon = (): StarterDeck => pack.decks!.find((d) => d.id === "gwenpool-ptt-aggression")!;

const patch = (state: GameState, id: InstanceId, change: Partial<CardInstance>): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...state.instances[id]!, ...change } },
});

const quiet = (s: GameState): readonly string[] => {
  const c = s.pendingChoice!;
  if (c.prompt.kind === "declareDefender") return ["decline"];
  return c.options.slice(0, c.minSelections).map((o) => o.optionId);
};

/** Answers every prompt with the first legal option, taking an option whose label matches `wanted` when offered. */
const takes =
  (...wanted: readonly RegExp[]) =>
  (s: GameState): readonly string[] => {
    const c = s.pendingChoice!;
    if (c.prompt.kind === "declareDefender") return ["decline"];
    const hit = c.options.find((o) => wanted.some((w) => w.test(o.label)));
    return hit && c.minSelections <= 1 && c.maxSelections >= 1 ? [hit.optionId] : quiet(s);
  };

/** Applies a command and answers every prompt with `pick`, collecting the events. */
function drive(
  state: GameState,
  command: Command | null,
  pick: (s: GameState) => readonly string[] = quiet,
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

/** A Rhino game with the Gwenpool precon, in hero form, past setup, at the start of the player phase. */
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
  return inForm(emptyHand(settled), "hero");
}

const inForm = (state: GameState, form: "hero" | "alterEgo"): GameState => ({
  ...state,
  players: state.players.map((p) => ({
    ...p,
    identity: { ...p.identity, form, heroFormIndex: 0, changedFormThisRound: false },
  })),
});

const identityOf = (s: GameState): InstanceId => s.players[0]!.identity.instanceId;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;

/** Empties the hand into the top of the deck (surgery), so a test controls exactly which cards it holds. */
function emptyHand(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.playerId === P1 ? { ...p, deck: [...p.hand, ...p.deck], hand: [] } : p)),
  };
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

/** A card of the player's deck by code, put into their play area (surgery); an upgrade is attached to the identity. */
function intoPlay(
  state: GameState,
  code: string,
  upgrade = false,
): { readonly state: GameState; readonly id: InstanceId } {
  const owner = state.players.find((p) => p.playerId === P1)!;
  const id = owner.deck.find((i) => String(state.instances[i]!.cardId) === `${P}${code}`);
  if (!id) throw new Error(`${code} is not in the deck`);
  const placed: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1 ? { ...p, deck: p.deck.filter((i) => i !== id), playArea: [...p.playArea, id] } : p,
    ),
  };
  return {
    id,
    state: patch(placed, id, { faceup: true, ...(upgrade ? { attachedTo: identityOf(state) } : {}) }),
  };
}

/** The top `n` encounter cards relabeled as `code`. */
function stackTop(state: GameState, code: string, n: number, from = 0): GameState {
  const top = activeEncounterDeck(state).deck.slice(from, from + n);
  return top.reduce((acc, id) => patch(acc, id, { cardId: code as never }), state);
}

/** The top encounter card relabeled as `code` and put into play engaged with P1 (surgery: no reveal). */
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

/** The top encounter card relabeled as the side scheme `code` and put into the villain area with `threat` on it. */
function conjureSideScheme(
  state: GameState,
  code: string,
  threat: number,
): { readonly state: GameState; readonly id: InstanceId } {
  const pile = activeEncounterDeck(state);
  const spare = pile.deck[0]!;
  const deckId = Object.keys(state.encounterDecks)[0]!;
  return {
    id: spare,
    state: {
      ...patch(state, spare, { cardId: code as never, faceup: true, threat }),
      villainArea: [...state.villainArea, spare],
      encounterDecks: { ...state.encounterDecks, [deckId]: { deck: pile.deck.slice(1), discard: pile.discard } },
    },
  };
}

const play = (id: InstanceId, payment: readonly InstanceId[] = []): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: id,
  payment: payment.map((fromHand) => ({ fromHand })),
  attachToInstanceId: null,
});

const use = (
  state: GameState,
  card: InstanceId,
  abilityId: string,
  costChoices?: Record<string, readonly InstanceId[]>,
): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: card,
  abilityId: abilityId as never,
  payment: [],
  ...(costChoices ? { costChoices: costChoices as never } : {}),
});

const damageTo = (events: readonly GameEvent[], target: InstanceId): number[] =>
  events.flatMap((e) => (e.type === "damageDealt" && e.targetInstanceId === target ? [e.amount] : []));

const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);

/** A table with Batroc and Comic Shop in play: pink bubbles are the hero's 2, Batroc's and Comic Shop's. */
function withFriends(): { readonly state: GameState; readonly batroc: InstanceId; readonly shop: InstanceId } {
  const base = open();
  const batroc = intoPlay(base, "02");
  const shop = intoPlay(batroc.state, "10");
  return { state: shop.state, batroc: batroc.id, shop: shop.id };
}

describe("the pack builds with its bubbles", () => {
  it("tags every pink bubble on the player cards and every purple bubble on the nemesis cards", () => {
    // Every ability id on every card face: the identity's two faces and the other cards' own list.
    type Listed = { readonly abilities?: readonly { readonly id: string }[] };
    const abilities = pack.cards.flatMap((card) => {
      const faces = card as unknown as Listed & { readonly hero?: Listed; readonly alterEgo?: Listed };
      return [...(faces.abilities ?? []), ...(faces.hero?.abilities ?? []), ...(faces.alterEgo?.abilities ?? [])];
    });
    const ids = abilities.map((a) => String(a.id));
    expect(ids.filter((id) => id.endsWith("pink-bubble") || id.endsWith("pink-bubble-2"))).toHaveLength(12);
    expect(ids.filter((id) => id.endsWith("purple-bubble"))).toHaveLength(4);
  });
});

describe("Reading the comic: resolve one pink bubble of your choice", () => {
  it("offers every pink bubble in play (flavor ones too), resolves only the one picked, once per round", () => {
    const { state, batroc } = withFriends();
    const scheme = state.mainScheme.instanceId;
    const staged = patch(state, scheme, { threat: 6 });
    const hero = identityOf(staged);
    const offered: string[] = [];
    const run = drive(staged, use(staged, hero, `${P}01a.reading-the-comic`), (s) => {
      const c = s.pendingChoice!;
      if (c.prompt.kind !== "chooseOption") return quiet(s);
      offered.push(...c.options.map((o) => o.optionId));
      return [c.options.find((o) => o.optionId.endsWith(`${batroc}:${P}02.pink-bubble`))!.optionId];
    });
    // The hero's two bubbles, Batroc's and Comic Shop's.
    expect(offered).toHaveLength(4);
    expect(run.state.instances[scheme]!.threat, "Batroc's bubble removes 2 threat from a scheme").toBe(4);
    expect(
      run.events.filter((e) => e.type === "cardDrawn"),
      "the hero's draw bubble did not resolve",
    ).toEqual([]);
    expect(damageTo(run.events, villainOf(staged)), "Comic Shop's bubble did not resolve").toEqual([]);
    const again = applyCommand(run.state, use(run.state, hero, `${P}01a.reading-the-comic`), deps);
    expect(again.ok, "limit once per round").toBe(false);
  });

  it("the hero's own bubble draws a card; Comic Shop's deals 2 damage to an enemy", () => {
    const { state } = withFriends();
    const hero = identityOf(state);
    const draws = drive(state, use(state, hero, `${P}01a.reading-the-comic`), (s) => {
      const c = s.pendingChoice!;
      const hit =
        c.prompt.kind === "chooseOption" ? c.options.find((o) => o.optionId.endsWith("01a.pink-bubble")) : null;
      return hit ? [hit.optionId] : quiet(s);
    });
    expect(draws.events.filter((e) => e.type === "cardDrawn")).toHaveLength(1);

    const hits = drive(state, use(state, hero, `${P}01a.reading-the-comic`), (s) => {
      const c = s.pendingChoice!;
      const hit =
        c.prompt.kind === "chooseOption" ? c.options.find((o) => o.optionId.endsWith("10.pink-bubble")) : null;
      return hit ? [hit.optionId] : quiet(s);
    });
    expect(damageTo(hits.events, villainOf(state))).toEqual([2]);
  });
});

describe("Precise Cut and Plot Armor count your pink bubbles", () => {
  /** Precise Cut (cost 2) paid with two more Precise Cuts; the damage Rhino took. */
  function preciseCut(base: GameState): number {
    const cut = toHand(base, `${P}03`);
    const a = toHand(cut.state, `${P}03`);
    const b = toHand(a.state, `${P}03`);
    const run = drive(b.state, play(cut.id, [a.id, b.id]), quiet);
    return sum(damageTo(run.events, villainOf(base)));
  }

  it("Precise Cut deals 2 plus 1 for each pink bubble you control", () => {
    const alone = open();
    // The hero's 2 bubbles: 2 + 2.
    expect(preciseCut(alone)).toBe(4);
    // Batroc's and Comic Shop's join: 2 + 4.
    expect(preciseCut(withFriends().state)).toBe(6);
  });

  it("Precise Cut counts none of the hero's bubbles while Game Rules blanks her text box", () => {
    const blanked = conjureSideScheme(withFriends().state, `${P}12`, 4).state;
    // Only Batroc's and Comic Shop's: 2 + 2.
    expect(preciseCut(blanked)).toBe(4);
  });

  /** The first undefended Rhino attack of the villain phase (boost 3 from a relabeled Game Rules), Plot Armor in hand. */
  function firstHit(base: GameState, withArmor: boolean): number {
    let state = stackTop(base, "01104", 1);
    state = patch(state, activeEncounterDeck(state).deck[0]!, { cardId: `${P}12` as never });
    if (withArmor) state = toHand(state, `${P}04`).state;
    const start = state.round;
    const run = drive(
      state,
      { type: "endTurn", playerId: P1 },
      (s) => {
        const c = s.pendingChoice!;
        if (c.prompt.kind === "declareDefender") return ["decline"];
        const hit = s.step.phase === "villain" ? c.options.find((o) => /Plot Armor/.test(o.label)) : undefined;
        return hit ? [hit.optionId] : quiet(s);
      },
      (s) => s.round > start,
    );
    return damageTo(run.events, identityOf(base))[0]!;
  }

  it("Plot Armor prevents 1 damage for each pink bubble you control", () => {
    const base = withFriends().state;
    const control = firstHit(base, false);
    expect(control, "Rhino 2 + a boost card of 3 icons").toBe(5);
    // The hero's 2, Batroc's and Comic Shop's: 4 of the 5 are prevented.
    expect(firstHit(base, true)).toBe(1);
    // The hero's 2 alone: 2 of the 5 are prevented.
    expect(firstHit(open(), true)).toBe(3);
  });
});

describe("Too Much Pink", () => {
  /** Too Much Pink in play (the top encounter card relabeled, as an obligation sits in its player's area). */
  function withObligation(state: GameState) {
    return conjure(state, `${P}11`);
  }

  it("raises the cost of a support, upgrade or ally with a pink bubble by 2, and no event's", () => {
    const base = withObligation(open());
    const batroc = toHand(base.state, `${P}02`);
    // Cost 2 + 2: two resources are not enough, four are.
    const cards: InstanceId[] = [];
    let state = batroc.state;
    for (const code of [`${P}03`, `${P}03`, `${P}03`, `${P}04`]) {
      const next = toHand(state, code);
      cards.push(next.id);
      state = next.state;
    }
    const two = applyCommand(state, play(batroc.id, cards.slice(0, 2)), deps);
    expect(two.ok, "Batroc costs 4 now").toBe(false);
    const four = applyCommand(state, play(batroc.id, cards), deps);
    expect(four.ok, four.ok ? "" : four.error.message).toBe(true);
    // An event with a pink bubble is not raised: Secrets From The Comics costs its printed 2.
    const secrets = toHand(state, `${P}05`);
    const event = applyCommand(secrets.state, play(secrets.id, cards.slice(0, 2)), deps);
    expect(event.ok, event.ok ? "" : event.error.message).toBe(true);
    // Without the obligation Batroc costs 2.
    const free = toHand(emptyHand(open()), `${P}02`);
    const p1 = toHand(free.state, `${P}03`);
    const p2 = toHand(p1.state, `${P}03`);
    const cheap = applyCommand(p2.state, play(free.id, [p1.id, p2.id]), deps);
    expect(cheap.ok, cheap.ok ? "" : cheap.error.message).toBe(true);
  });

  it("Alter-Ego Action: discard 2 cards with pink bubbles to discard it; a basic card does not count", () => {
    const base = inForm(withObligation(open()).state, "alterEgo");
    const obligation = Object.values(base.instances).find((i) => String(i.cardId) === `${P}11`)!.instanceId;
    const haymaker = toHand(base, "01087");
    const armor = toHand(haymaker.state, `${P}04`);
    const refused = applyCommand(
      armor.state,
      use(armor.state, obligation, `${P}11.too-much-pink-action`, { discard: [haymaker.id, armor.id] }),
      deps,
    );
    expect(refused.ok, "Haymaker has no pink bubble").toBe(false);
    const cut = toHand(armor.state, `${P}03`);
    const run = drive(
      cut.state,
      use(cut.state, obligation, `${P}11.too-much-pink-action`, { discard: [cut.id, armor.id] }),
    );
    expect(run.state.players[0]!.discard).toEqual(expect.arrayContaining([cut.id, armor.id]));
    expect(run.state.players[0]!.playArea).not.toContain(obligation);
  });
});

describe("Evil Gwenpool", () => {
  it("gets +1 hit point for each purple bubble in play, its own included", () => {
    const evil = conjure(open(), `${P}13`);
    // Printed 3 + its own bubble.
    expect(maxHitPoints(evil.state, evil.id, deps)).toBe(4);
    // Game Rules' bubble joins.
    const rules = conjureSideScheme(evil.state, `${P}12`, 4);
    expect(maxHitPoints(rules.state, evil.id, deps)).toBe(5);
  });

  it("after it attacks you, resolves every purple bubble in play: 2 damage to you, and a random discard", () => {
    const evil = conjure(open(), `${P}13`);
    const rules = conjureSideScheme(evil.state, `${P}12`, 4);
    // Rhino is stunned; the boost cards are blank, so Evil Gwenpool (ATK 0) deals no damage itself.
    let state = stackTop(rules.state, BLANK, 8);
    state = patch(state, villainOf(state), {
      statuses: { ...state.instances[villainOf(state)]!.statuses, stunned: 1 },
    });
    const hand = ["03", "03", "04", "05", "06"].reduce((acc, code) => toHand(acc, `${P}${code}`).state, state);
    const start = hand.round;
    const run = drive(hand, { type: "endTurn", playerId: P1 }, quiet, (s) => s.round > start);
    expect(damageTo(run.events, identityOf(hand))).toEqual([2]);
    const refilled = run.events.findIndex((e) => e.type === "handRefilled");
    const discarded = run.events
      .slice(refilled)
      .filter((e) => e.type === "cardMoved" && e.from.kind === "hand" && e.to.kind === "discard");
    expect(discarded, "Game Rules' bubble discards 1 card at random from your hand").toHaveLength(1);
  });
});

describe("That's Not How the Game Ends", () => {
  it("replaces the defeat: her hit point dial is 1, it leaves the game, and every pink bubble resolves, its own too", () => {
    const base = withFriends();
    const upgrade = intoPlay(base.state, "09", true);
    // Rhino's attack (2 + a 3-icon boost card) is defeating: she has 2 hit points left.
    // Rhino's boost card has 3 icons (Game Rules relabeled); the cards under it are the obligation, which does nothing
    // when revealed, so the card the bubble reveals changes nothing else.
    let state = stackTop(upgrade.state, `${P}11`, 5, 1);
    state = patch(state, activeEncounterDeck(state).deck[0]!, { cardId: `${P}12` as never });
    state = patch(state, identityOf(state), { damage: 7 });
    state = patch(state, state.mainScheme.instanceId, { threat: 3 });
    const start = state.round;
    const run = drive(state, { type: "endTurn", playerId: P1 }, takes(/That's Not How/), (s) => s.round > start);
    expect(run.state.removedFromGame).toContain(upgrade.id);
    const at = run.events.findIndex(
      (e) => e.type === "cardMoved" && e.instanceId === upgrade.id && e.to.kind === "removedFromGame",
    );
    expect(at).toBeGreaterThan(-1);
    const after = run.events.slice(at);
    expect(run.state.instances[identityOf(state)]!.damage, "hit point dial set to 1: 8 damage of 9").toBe(8);
    expect(
      after.filter((e) => e.type === "cardDrawn"),
      "the hero's pink bubble draws",
    ).toHaveLength(1);
    expect(
      after.filter((e) => e.type === "threatRemoved" && e.amount === 2),
      "Batroc's pink bubble",
    ).toHaveLength(1);
    expect(damageTo(after, villainOf(state)), "Comic Shop's pink bubble").toContain(2);
    expect(
      after.filter((e) => e.type === "encounterCardRevealed"),
      "its own bubble reveals the top encounter card",
    ).not.toHaveLength(0);
  });

  it("is not offered for a defeat that is not an enemy attack (Evil Gwenpool's bubble is damage, not an attack)", () => {
    const evil = conjure(open(), `${P}13`);
    const rules = conjureSideScheme(evil.state, `${P}12`, 4);
    const upgrade = intoPlay(rules.state, "09", true);
    let state = stackTop(upgrade.state, BLANK, 8);
    state = patch(state, villainOf(state), {
      statuses: { ...state.instances[villainOf(state)]!.statuses, stunned: 1 },
    });
    // 8 damage of 9: Evil Gwenpool's own 2 damage (its attack deals 0) defeats her, and the card does not answer it.
    state = patch(state, identityOf(state), { damage: 8 });
    const start = state.round;
    const run = drive(state, { type: "endTurn", playerId: P1 }, takes(/That's Not How/), (s) => s.round > start);
    expect(run.state.outcome).toMatchObject({ result: "loss" });
    expect(run.state.removedFromGame).not.toContain(upgrade.id);
  });
});

describe("Out of the Game", () => {
  it("plays another player phase in place of the villain phase: no threat, same round, round limits not refreshed", () => {
    const base = intoPlay(open(), "07", true);
    const hero = identityOf(base.state);
    // Reading the comic is limited once per round: use it now, before the extra phase.
    const used = drive(base.state, use(base.state, hero, `${P}01a.reading-the-comic`), quiet).state;
    const threat = used.instances[used.mainScheme.instanceId]!.threat;
    const round = used.round;
    const run = drive(
      used,
      { type: "endTurn", playerId: P1 },
      quiet,
      (s) => s.step.phase === "player" && s.step.kind === "turn",
    );
    expect(run.state.round, "the round did not end").toBe(round);
    expect(run.state.removedFromGame).toContain(base.id);
    expect(run.state.instances[used.mainScheme.instanceId]!.threat, "no threat placed").toBe(threat);
    expect(run.events.filter((e) => e.type === "threatPlaced")).toEqual([]);
    expect(run.events.filter((e) => e.type === "encounterCardRevealed")).toEqual([]);
    expect(run.events.filter((e) => e.type === "roundStarted")).toEqual([]);
    const again = applyCommand(run.state, use(run.state, hero, `${P}01a.reading-the-comic`), deps);
    expect(again.ok, "the once-per-round limit did not refresh").toBe(false);
    // The next end of turn runs the villain phase and the round ends as usual.
    const next = drive(run.state, { type: "endTurn", playerId: P1 }, quiet, (s) => s.round > round);
    expect(next.state.round).toBe(round + 1);
    expect(next.events.filter((e) => e.type === "threatPlaced").length).toBeGreaterThan(0);
  });
});

describe("Game Rules", () => {
  it("blanks her hero side only: Reading the comic is gone in hero form, That's not fair! stays in alter-ego form", () => {
    const rules = conjureSideScheme(open(), `${P}12`, 4);
    const hero = identityOf(rules.state);
    expect(textBoxBlankFor(rules.state, hero, deps), "hero form: blank").toBe(true);
    expect(activeAbilityRefs(rules.state, hero, deps).map((r) => r.id)).not.toContain(`${P}01a.reading-the-comic`);
    const blocked = applyCommand(rules.state, use(rules.state, hero, `${P}01a.reading-the-comic`), deps);
    expect(blocked.ok).toBe(false);
    const egoState = inForm(rules.state, "alterEgo");
    expect(textBoxBlankFor(egoState, hero, deps), "alter-ego form: text in force").toBe(false);
    expect(activeAbilityRefs(egoState, hero, deps).map((r) => r.id)).toContain(`${P}01b.thats-not-fair`);
    // And back to hero form: blank again.
    expect(textBoxBlankFor(inForm(egoState, "hero"), hero, deps)).toBe(true);
  });

  it("cannot leave play while Evil Gwenpool is in play", () => {
    /** The only threat is removed by a thwart of the hero (THW 1). */
    const thwartIt = (state: GameState, scheme: InstanceId) =>
      drive(state, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identityOf(state),
        schemeInstanceId: scheme,
      } as never);
    const noEvil = conjureSideScheme(open(), `${P}12`, 1);
    expect(thwartIt(noEvil.state, noEvil.id).state.villainArea, "defeated without Evil Gwenpool").not.toContain(
      noEvil.id,
    );
    const evil = conjure(open(), `${P}13`);
    const withEvil = conjureSideScheme(evil.state, `${P}12`, 1);
    const held = thwartIt(withEvil.state, withEvil.id);
    expect(held.state.villainArea, "stays in play with Evil Gwenpool in play").toContain(withEvil.id);
  });
});

describe('"I Found You" and "Hello Again"', () => {
  /** The top two encounter cards are `code`; the real Evil Gwenpool is somewhere in the nemesis-shuffled encounter deck. */
  function reveal(base: GameState, code: string, evilInDeck = true) {
    // The first two cards are Rhino's boost card and the card dealt (as Night Thrasher's Practice test); a boost card
    // resolves nothing, so both being the treachery leaves one reveal.
    let state = stackTop(base, code, 2);
    state = stackTop(state, BLANK, 1, 2);
    // Evil Gwenpool starts set aside (RRG 1.8 "Nemesis Encounter Set", p. 30); these cards find her in the deck or the
    // discard pile, so she is placed in the deck here, as after she was defeated and shuffled back.
    if (evilInDeck) state = stackTop(state, `${P}13`, 1, 10);
    const start = state.round;
    return drive(state, { type: "endTurn", playerId: P1 }, quiet, (s) => s.round > start);
  }
  const evilsIn = (s: GameState) =>
    Object.values(s.instances).filter(
      (i) => String(i.cardId) === `${P}13` && s.players[0]!.playArea.includes(i.instanceId),
    );

  it("I Found You puts Evil Gwenpool into play engaged with you even in alter-ego form, and shuffles", () => {
    const run = reveal(inForm(open(), "alterEgo"), `${P}14`);
    const evil = evilsIn(run.state);
    expect(evil, "Evil Gwenpool entered play").toHaveLength(1);
    expect(evil[0]!.engagedWith).toBe(P1);
  });

  it("with Evil Gwenpool already in play it does nothing; Hello Again then discards a random upgrade from your hand", () => {
    const base = conjure(open(), `${P}13`).state;
    // A hand of exactly one upgrade and four events, so the end-of-turn draw adds nothing.
    let state = base;
    const handbook = toHand(state, `${P}08`);
    state = handbook.state;
    for (const code of ["03", "03", "03", "04"]) state = toHand(state, `${P}${code}`).state;
    const run = reveal(state, `${P}15`, false);
    expect(evilsIn(run.state), "no second Evil Gwenpool").toHaveLength(1);
    expect(run.state.players[0]!.discard, "the only upgrade in hand was discarded").toContain(handbook.id);
  });
});

describe("That Shouldn't Be There", () => {
  /** The event played with every prompt answered by `answer` (the option labels and the targets offered). */
  function cast(state: GameState, answer: (c: NonNullable<GameState["pendingChoice"]>) => string | undefined) {
    const event = toHand(state, `${P}06`);
    const pay1 = toHand(event.state, `${P}03`);
    const pay2 = toHand(pay1.state, `${P}03`);
    return drive(pay2.state, play(event.id, [pay1.id, pay2.id]), (s) => {
      const c = s.pendingChoice!;
      if (c.prompt.kind === "declareDefender") return ["decline"];
      const hit = answer(c);
      return hit !== undefined ? [hit] : quiet(s);
    });
  }
  const labelled = (c: NonNullable<GameState["pendingChoice"]>, label: RegExp) =>
    c.options.find((o) => label.test(o.label))?.optionId;
  const optionFor = (c: NonNullable<GameState["pendingChoice"]>, id: InstanceId) =>
    c.options.find((o) => o.optionId === id)?.optionId;

  it("moves 1 threat from one scheme to another", () => {
    const side = conjureSideScheme(open(), `${P}12`, 3);
    const main = side.state.mainScheme.instanceId;
    const before = side.state.instances[main]!.threat;
    // The source prompt offers the schemes holding threat (take it from the side scheme), the target prompt the main one.
    let asked = 0;
    const run = cast(side.state, (c) => {
      const option = labelled(c, /^Move 1 threat/);
      if (option !== undefined) return option;
      asked++;
      return asked === 1 ? optionFor(c, side.id) : optionFor(c, main);
    });
    expect(run.state.instances[side.id]!.threat).toBe(2);
    expect(run.state.instances[main]!.threat).toBe(before + 1);
  });

  it("moves a status card from one character to another (the stun leaves Rhino for Evil Gwenpool)", () => {
    const evil = conjure(open(), `${P}13`);
    const rhino = villainOf(evil.state);
    const stunned = patch(evil.state, rhino, { statuses: { ...evil.state.instances[rhino]!.statuses, stunned: 1 } });
    let asked = 0;
    const run = cast(stunned, (c) => {
      const option = labelled(c, /^Move 1 stunned status card/);
      if (option !== undefined) return option;
      asked++;
      return asked === 1 ? optionFor(c, rhino) : optionFor(c, evil.id);
    });
    expect(run.state.instances[rhino]!.statuses.stunned).toBe(0);
    expect(run.state.instances[evil.id]!.statuses.stunned).toBe(1);
  });
});

describe("Marvel Champions Handbook", () => {
  it("offers only the keywords and traits a card in play has, and the chosen card loses it until the end of the round", () => {
    const base = intoPlay(open(), "08", true);
    const rhino = villainOf(base.state);
    expect(traitsOf(base.state, rhino, deps).map(String)).toContain("BRUTE");
    const labels: string[] = [];
    const run = drive(base.state, use(base.state, base.id, `${P}08.marvel-champions-handbook-action`), (s) => {
      const c = s.pendingChoice!;
      if (c.prompt.kind === "chooseOption" && c.options.some((o) => o.label.startsWith("Ignore "))) {
        labels.push(...c.options.map((o) => o.label));
        return [c.options.find((o) => o.label === "Ignore the BRUTE trait on a card")!.optionId];
      }
      return quiet(s);
    });
    // Rhino is a Brute and a Criminal, the hero an Avenger and a Guardian; nothing in play is Elite or has guard.
    expect(labels).toContain("Ignore the AVENGER trait on a card");
    expect(labels).not.toContain("Ignore the ELITE trait on a card");
    expect(labels).not.toContain("Ignore guard on a card");
    expect(traitsOf(run.state, rhino, deps).map(String), "Rhino ignores Brute").not.toContain("BRUTE");
    expect(traitsOf(run.state, rhino, deps).map(String), "his other traits stay").toContain("CRIMINAL");
    expect(run.state.instances[base.id]!.exhausted).toBe(true);
    // Until the end of the round only: the next round he is a Brute again.
    const round = run.state.round;
    const later = drive(run.state, { type: "endTurn", playerId: P1 }, quiet, (s) => s.round > round);
    expect(traitsOf(later.state, rhino, deps).map(String)).toContain("BRUTE");
  });
});
