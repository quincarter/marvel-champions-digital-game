import { JUBILEE_CARDS, WAVE7_CARDS, WAVE8_STARTER_DECKS, cardId, type AnyCard } from "@mc/content";
import {
  activeEncounterDeck,
  activeEncounterDeckId,
  applyCommand,
  cardsInPlay,
  characterProfile,
  createGame,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../core/setup.js";
import { mergeRegistries } from "../../dsl/index.js";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  play,
  playerOf,
  settle,
  use,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../testing/staging.js";
import { WAVE7_ABILITIES } from "../../wave7/index.js";
import { JUBILEE_ABILITIES } from "./index.js";
import { JUBILEE_ASPECT_BASIC, JUBILEE_ASPECT_BASIC_DRAFTS, JUBILEE_ASPECT_BASIC_SKIPPED } from "./aspect-basic.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Jubilee pack aspect and basic cards (47011 to 47022, 47028, 47029), docs/phase7-wave8.md §7.3, §3.62, §3.67, §3.70.
 * Jubilee's real `jubilee-justice` starter deck (one X-MEN hero, MUTANT) against Rhino through `coreScenario`, with the
 * card under test added to the deck, the engine given every wave 8 script. Every payment is real hand cards.
 */
const JUBILEE = WAVE8_STARTER_DECKS.find((d) => d.id === "jubilee-justice")!;
const DECK = JUBILEE.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId));
/** Every earlier wave plus this pack; no other wave 8 pack, so another pack's unfinished script cannot reach these tests. */
const ABILITIES = mergeRegistries(WAVE7_ABILITIES, JUBILEE_ABILITIES);
const DEPS: EngineDeps = { abilities: ABILITIES };
/** The unregistered drafts added on top, to prove what they do and where they stop. */
const DRAFT_DEPS: EngineDeps = { abilities: { ...ABILITIES, ...JUBILEE_ASPECT_BASIC_DRAFTS } };
/** Wave 7 (Core and every earlier pack, X-FORCE allies among them) and this pack. */
const POOL: readonly AnyCard[] = [...WAVE7_CARDS, ...JUBILEE_CARDS];
const BY_ID = new Map(POOL.map((c) => [c.id as string, c]));

const HUSK = "47012.husk-interrupt";
const REGISTERED = [
  HUSK,
  "47013.disguise-action",
  "47014.waylay-response",
  "47015.three-steps-ahead-action",
  "47016.when-defeated",
  "47017.the-power-of-justice-constant",
  "47018.synch-interrupt",
  "47020.x-gene-resource",
  "47021.multitalented-constant",
  "47022.unlikely-duo-action",
  "47029.serve-and-protect-interrupt",
];

// Encounter cards used as enemies, by what they do (Core).
const MERCENARY = "01101"; // Rhino: minion ATK 1, 3 hit points, Guard
const SHOCKER = "01103"; // Rhino: minion, 3 hit points
const BREAKIN = "01107"; // Rhino: side scheme

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const accepted = (s: GameState, c: Command): boolean => applyCommand(s, c, DEPS).ok;
const profile = (s: GameState, id: InstanceId) => characterProfile(s, id, DEPS)!;

function setupGame(extra: readonly string[] = [], seats = 1, seed = 1, spiderExtra: readonly string[] = []): GameState {
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: POOL,
  });
  const jubilee = {
    identityCardId: JUBILEE.identityCardId,
    aspects: JUBILEE.aspects,
    deck: [...DECK, ...extra.map((code) => cardId(code))],
  };
  const second = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed,
    modularSetIds: [],
  }).players[0]!;
  // Two seats: Spider-Man (seat 1, with `spiderExtra`) and Jubilee (seat 2).
  const spider = { ...second, deck: [...second.deck, ...spiderExtra.map((code) => cardId(code))] };
  const players = seats === 1 ? [jubilee] : [spider, jubilee];
  const created = createGame({ ...config, players, requireLegalDecks: false }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}
/** Jubilee (seat 1) in hero form. */
const heroGame = (extra: readonly string[] = [], seats = 1): GameState =>
  withForm(setupGame(extra, seats), { heroForm: 0 }, P1);

const iconsOf = (s: GameState, id: InstanceId): number => {
  const card = BY_ID.get(codeOf(s, id)) as {
    resourceIcons?: Record<string, number>;
    producesIcons?: Record<string, number>;
  };
  return Object.values(card.resourceIcons ?? card.producesIcons ?? {}).reduce((a, b) => a + b, 0);
};

/** Moves a player's hand to the bottom of the deck, then these cards (and `fillers` resource cards) into the hand. */
function stage(
  state: GameState,
  codes: readonly string[],
  fillers = 4,
  p: PlayerId = P1,
): { readonly state: GameState; readonly ids: readonly InstanceId[]; readonly fill: readonly InstanceId[] } {
  const cleared: GameState = {
    ...state,
    players: state.players.map((pl) => (pl.playerId === p ? { ...pl, deck: [...pl.deck, ...pl.hand], hand: [] } : pl)),
  };
  const given = moveToHand(cleared, p, ...codes);
  const fill = playerOf(given.state, p)
    .deck.filter(
      (id) =>
        iconsOf(given.state, id) > 0 &&
        !(BY_ID.get(codeOf(given.state, id)) as { type: string }).type.startsWith("hero") &&
        !given.ids.includes(id),
    )
    .slice(0, fillers);
  return {
    ids: given.ids,
    fill,
    state: {
      ...given.state,
      players: given.state.players.map((pl) =>
        pl.playerId === p
          ? { ...pl, deck: pl.deck.filter((id) => !fill.includes(id)), hand: [...pl.hand, ...fill] }
          : pl,
      ),
    },
  };
}

type Rule = (s: GameState) => readonly string[] | undefined;
const picker =
  (...rules: readonly Rule[]): Picker =>
  (s) => {
    for (const rule of rules) {
      const answer = rule(s);
      if (answer) return answer;
    }
    return firstLegal(s);
  };
/** Accepts the offered ability whose id contains `ref`. */
const accept =
  (ref: string): Rule =>
  (s) => {
    if (s.pendingChoice?.prompt.kind !== "chooseTriggers") return undefined;
    const hits = s.pendingChoice.options.filter((o) => o.optionId.includes(ref)).map((o) => o.optionId);
    return hits.length > 0 ? hits : undefined;
  };
/** Chooses these cards (or targets) whenever they are offered. */
const take =
  (...ids: readonly string[]): Rule =>
  (s) => {
    const choice = s.pendingChoice;
    if (!choice || (choice.prompt.kind !== "chooseCards" && choice.prompt.kind !== "chooseTarget")) return undefined;
    const hits = ids.filter((id) => choice.options.some((o) => o.optionId === id));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : undefined;
  };
/** Answers the prompt of this kind with these option ids when all are offered. */
const answerKind =
  (kind: string, ...ids: readonly string[]): Rule =>
  (s) => {
    const choice = s.pendingChoice;
    if (!choice || choice.prompt.kind !== kind) return undefined;
    return ids.every((id) => choice.options.some((o) => o.optionId === id)) ? ids : undefined;
  };
/** Every prompt kind and option list the picker saw. */
function spy(pick: Picker): { readonly pick: Picker; readonly seen: { kind: string; options: string[] }[] } {
  const seen: { kind: string; options: string[] }[] = [];
  return {
    seen,
    pick: (s) => {
      const c = s.pendingChoice!;
      seen.push({ kind: c.prompt.kind, options: c.options.map((o) => o.optionId) });
      return pick(s);
    },
  };
}
const offered = (seen: readonly { kind: string; options: string[] }[], ref: string): boolean =>
  seen.some((p) => p.kind === "chooseTriggers" && p.options.some((o) => o.includes(ref)));

/** Plays `code` from the hand paying `cost` with hand cards that print resources (not `except`). */
function playStaged(
  s: GameState,
  code: string,
  cost: number,
  o: { pick?: Picker; attach?: InstanceId; p?: PlayerId; except?: readonly InstanceId[] } = {},
): { readonly state: GameState; readonly id: InstanceId } {
  const p = o.p ?? P1;
  const given = moveToHand(s, p, code);
  const id = given.ids[0]!;
  const payers = playerOf(given.state, p)
    .hand.filter((h) => h !== id && !(o.except ?? []).includes(h) && iconsOf(given.state, h) > 0)
    .slice(0, cost);
  if (payers.length < cost) throw new Error(`not enough resource cards to pay ${cost} for ${code}`);
  const { state } = driveEventsPicking(
    DEPS,
    given.state,
    o.pick ?? firstLegal,
    play(p, id, payers, o.attach ? { attachToInstanceId: o.attach } : {}),
  );
  return { state, id };
}

/** Surgery: a minion from the encounter deck or discard into this player's play area, engaged and faceup. */
function engage(
  state: GameState,
  code: string,
  p: PlayerId = P1,
): { readonly state: GameState; readonly id: InstanceId } {
  const pile = activeEncounterDeck(state);
  const id = pile.deck.find((i) => codeOf(state, i) === code) ?? pile.discard.find((i) => codeOf(state, i) === code);
  if (!id) throw new Error(`no ${code} in the encounter deck or discard`);
  const deckId = activeEncounterDeckId(state);
  return {
    id,
    state: {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      },
      players: state.players.map((pl) => (pl.playerId === p ? { ...pl, playArea: [...pl.playArea, id] } : pl)),
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, engagedWith: p, faceup: true, controllerId: null },
      },
    },
  };
}
const status = (s: GameState, id: InstanceId, name: "stunned" | "confused" | "tough", n: number): GameState =>
  patchInstance(s, id, { statuses: { ...inst(s, id).statuses, [name]: n } });
const attackBy = (s: GameState, attacker: InstanceId, target: InstanceId, p: PlayerId = P1): Command => ({
  type: "basicAttack",
  playerId: p,
  attackerInstanceId: attacker,
  targetInstanceId: target,
});
const thwartBy = (s: GameState, thwarter: InstanceId, scheme: InstanceId, p: PlayerId = P1): Command => ({
  type: "basicThwart",
  playerId: p,
  thwarterInstanceId: thwarter,
  schemeInstanceId: scheme,
});
const mainOf = (s: GameState): InstanceId => s.mainScheme.instanceId;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;

describe("aspect-basic registry", () => {
  it.each(REGISTERED)("%s validates", (id) => {
    expect(validateDefinition(JUBILEE_ASPECT_BASIC[id]!)).toEqual([]);
  });
  it("registers exactly these refs; every other ref of the 14 cards is skipped with a reason", () => {
    expect(Object.keys(JUBILEE_ASPECT_BASIC).sort()).toEqual([...REGISTERED].sort());
    const refs = POOL.filter((c) =>
      [
        "47011",
        "47012",
        "47013",
        "47014",
        "47015",
        "47016",
        "47017",
        "47018",
        "47019",
        "47020",
        "47021",
        "47022",
        "47028",
        "47029",
      ].includes(c.id as string),
    ).flatMap((c) => (c as unknown as { abilities: { id: string }[] }).abilities.map((a) => a.id));
    expect(refs.filter((r) => !(r in JUBILEE_ASPECT_BASIC)).sort()).toEqual(
      Object.keys(JUBILEE_ASPECT_BASIC_SKIPPED).sort(),
    );
  });
  it("the two reprints are the very definitions of the cards they reprint", () => {
    expect(JUBILEE_ASPECT_BASIC["47017.the-power-of-justice-constant"]).toBe(
      ABILITIES["01062.the-power-of-justice-constant"],
    );
    expect(JUBILEE_ASPECT_BASIC["47020.x-gene-resource"]).toBe(ABILITIES["38019.x-gene-resource"]);
  });
});

/** Hero Jubilee with these cards in the deck and `cost` of her hand left to pay for them. */
function withAlly(code: string, cost: number, extra: readonly string[] = []) {
  const base = stage(heroGame([code, ...extra]), [code, ...extra], 8);
  const played = playStaged(base.state, code, cost);
  return { state: played.state, ally: played.id, jubilee: identityOf(played.state) };
}

describe("Chamber (47011): takes 1 less consequential damage after he attacks a confused enemy", () => {
  it("is a 4-cost ally with THW 2 and ATK 2", () => {
    const { state, ally } = withAlly("47011", 4);
    expect(playerOf(state, P1).playArea).toContain(ally);
    expect(profile(state, ally)).toMatchObject({ atk: 2, thw: 2 });
  });
  it("the draft: attacking a confused villain, no consequential damage and the confused card stays", () => {
    const a = withAlly("47011", 4);
    const rhino = villainOf(a.state);
    const s = status(a.state, rhino, "confused", 1);
    const after = driveEventsPicking(DRAFT_DEPS, s, firstLegal, attackBy(s, a.ally, rhino)).state;
    expect(inst(after, rhino).damage).toBe(2);
    expect(inst(after, a.ally).damage).toBe(0);
    expect(inst(after, rhino).statuses.confused).toBe(1);
  });
  it("the draft: an enemy that is not confused costs him 1, and so does a thwart", () => {
    const a = withAlly("47011", 4);
    const rhino = villainOf(a.state);
    const hit = driveEventsPicking(DRAFT_DEPS, a.state, firstLegal, attackBy(a.state, a.ally, rhino)).state;
    expect(inst(hit, a.ally).damage).toBe(1);
    const s = patchInstance(status(a.state, rhino, "confused", 1), mainOf(a.state), { threat: 5 });
    const thwarted = driveEventsPicking(DRAFT_DEPS, s, firstLegal, thwartBy(s, a.ally, mainOf(s))).state;
    expect(inst(thwarted, a.ally).damage).toBe(1);
  });
  it("today, with the ref left unregistered, he takes the 1 even from a confused villain", () => {
    const a = withAlly("47011", 4);
    const rhino = villainOf(a.state);
    const s = status(a.state, rhino, "confused", 1);
    const after = driveEventsPicking(DEPS, s, firstLegal, attackBy(s, a.ally, rhino)).state;
    expect(inst(after, a.ally).damage).toBe(1);
  });
  /** Shocker (3 hit points) with 2 damage and a confused card is defeated by Chamber's 2 ATK. */
  function killingBlow(deps: EngineDeps) {
    const a = withAlly("47011", 4);
    const e = engage(a.state, SHOCKER);
    const s = status(patchInstance(e.state, e.id, { damage: 2 }), e.id, "confused", 1);
    const after = driveEventsPicking(deps, s, firstLegal, attackBy(s, a.ally, e.id)).state;
    return { after, ally: a.ally, enemy: e.id };
  }
  it("the draft, today: the attack that defeats the confused enemy loses the reduction (1 damage)", () => {
    const k = killingBlow(DRAFT_DEPS);
    expect(playerOf(k.after, P1).playArea).not.toContain(k.enemy);
    expect(inst(k.after, k.ally).damage).toBe(1);
  });
  it.fails("Q38 = A: the attack that defeats the confused enemy keeps the reduction (0 damage)", () => {
    const k = killingBlow(DRAFT_DEPS);
    expect(playerOf(k.after, P1).playArea).not.toContain(k.enemy);
    expect(inst(k.after, k.ally).damage).toBe(0);
  });
});

/** Replaces a player's hand with exactly these cards (by code); the old hand goes to the bottom of the deck. */
function handOnly(s: GameState, ...codes: readonly string[]): GameState {
  const cleared: GameState = {
    ...s,
    players: s.players.map((p) => (p.playerId === P1 ? { ...p, hand: [], deck: [...p.deck, ...p.hand] } : p)),
  };
  return moveToHand(cleared, P1, ...codes).state;
}
const threatOf = (s: GameState, id: InstanceId = mainOf(s)): number => inst(s, id).threat;

describe("Synch (47018): Interrupt, when you use a basic power, exhaust Synch -> +1 to that power for this use", () => {
  function board() {
    const a = withAlly("47018", 3);
    return { ...a, rhino: villainOf(a.state) };
  }
  it("accepted on Jubilee's basic attack: ATK + 1 and Synch exhausted; declined: ATK only", () => {
    const b = board();
    const atk = profile(b.state, b.jubilee).atk;
    const yes = driveEventsPicking(
      DEPS,
      b.state,
      picker(accept("47018.synch-interrupt")),
      attackBy(b.state, b.jubilee, b.rhino),
    ).state;
    expect(inst(yes, b.rhino).damage).toBe(atk + 1);
    expect(inst(yes, b.ally).exhausted).toBe(true);
    const no = driveEventsPicking(DEPS, b.state, firstLegal, attackBy(b.state, b.jubilee, b.rhino)).state;
    expect(inst(no, b.rhino).damage).toBe(atk);
    expect(inst(no, b.ally).exhausted).toBe(false);
  });
  it("also on her basic thwart: THW + 1", () => {
    const b = board();
    const s = patchInstance(b.state, mainOf(b.state), { threat: 8 });
    const thw = profile(s, b.jubilee).thw;
    const after = driveEventsPicking(
      DEPS,
      s,
      picker(accept("47018.synch-interrupt")),
      thwartBy(s, b.jubilee, mainOf(s)),
    ).state;
    expect(threatOf(after)).toBe(8 - (thw + 1));
  });
  it("is not offered for Synch's own power, nor when Synch is exhausted", () => {
    const b = board();
    const own = spy(picker(accept("47018.synch-interrupt")));
    driveEventsPicking(DEPS, b.state, own.pick, attackBy(b.state, b.ally, b.rhino));
    expect(offered(own.seen, "47018.synch-interrupt")).toBe(false);
    const tired = patchInstance(b.state, b.ally, { exhausted: true });
    const probe = spy(firstLegal);
    driveEventsPicking(DEPS, tired, probe.pick, attackBy(tired, b.jubilee, b.rhino));
    expect(offered(probe.seen, "47018.synch-interrupt")).toBe(false);
  });
  it("cannot be played by an identity without the X-MEN trait (Spider-Man); Jubilee (X-MEN) plays it above", () => {
    const base = setupGame(["47018"], 2, 1, ["47018"]);
    const spider = stage(base, ["47018"], 4, P1);
    const result = applyCommand(spider.state, play(P1, spider.ids[0]!, [...spider.fill.slice(0, 3)]), DEPS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/X-MEN/i);
  });
});

describe("Husk (47012): Interrupt, when she uses a basic power, spend up to 3 resources", () => {
  /** Husk in play with 1 damage on her and 10 threat on the main scheme; the hand is exactly `cards`. */
  function board(...cards: readonly string[]) {
    const a = withAlly("47012", 4, ["01090"]);
    const state = handOnly(
      patchInstance(patchInstance(a.state, mainOf(a.state), { threat: 10 }), a.ally, { damage: 1 }),
      ...cards,
    );
    return { ...a, state, hand: [...playerOf(state, P1).hand] };
  }
  const pays = (ids: readonly InstanceId[]): Rule => answerKind("payForAbility", ...ids.map((id) => `hand:${id}`));
  const thwartWith = (b: ReturnType<typeof board>, ...rules: readonly Rule[]) =>
    driveEventsPicking(DEPS, b.state, picker(accept(HUSK), ...rules), thwartBy(b.state, b.ally, mainOf(b.state))).state;

  it("is a 4-cost ally with THW 2", () => {
    const b = board();
    expect(profile(b.state, b.ally)).toMatchObject({ thw: 2 });
    expect(playerOf(b.state, P1).playArea).toContain(b.ally);
  });
  it("Plasmoid Energy ([energy][mental]): 3 threat removed, 1 damage healed (then 1 consequential damage)", () => {
    const b = board("47010a");
    const after = thwartWith(b, pays(b.hand));
    expect(threatOf(after)).toBe(10 - 3);
    expect(inst(after, b.ally).damage).toBe(1 - 1 + 1);
    expect(inst(after, b.ally).exhausted).toBe(true);
    expect(playerOf(after, P1).hand).toEqual([]);
  });
  it("[physical] alone (Strength): 2 removed, and she readies after the thwart and its consequential damage", () => {
    const b = board("01090");
    const after = thwartWith(b, pays(b.hand));
    expect(threatOf(after)).toBe(10 - 2);
    expect(inst(after, b.ally).damage).toBe(1 + 1);
    expect(inst(after, b.ally).exhausted).toBe(false);
  });
  it("Plasmoid Energy c ([mental][physical]): heals, readies, and no bonus", () => {
    const b = board("47010c");
    const after = thwartWith(b, pays(b.hand));
    expect(threatOf(after)).toBe(10 - 2);
    expect(inst(after, b.ally).damage).toBe(1);
    expect(inst(after, b.ally).exhausted).toBe(false);
  });
  it("declined at the trigger prompt, or by paying nothing: 2 removed, nothing spent, she stays exhausted", () => {
    const b = board("47010a");
    const declined = driveEventsPicking(DEPS, b.state, firstLegal, thwartBy(b.state, b.ally, mainOf(b.state))).state;
    expect(threatOf(declined)).toBe(10 - 2);
    expect(playerOf(declined, P1).hand).toEqual(b.hand);
    const none = thwartWith(b, answerKind("payForAbility"));
    expect(threatOf(none)).toBe(10 - 2);
    expect(playerOf(none, P1).hand).toEqual(b.hand);
    expect(inst(none, b.ally).exhausted).toBe(true);
  });
  it("on her basic attack: [energy] adds 1 to ATK", () => {
    const b = board("47010a");
    const rhino = villainOf(b.state);
    const after = driveEventsPicking(
      DEPS,
      b.state,
      picker(accept(HUSK), pays(b.hand)),
      attackBy(b.state, b.ally, rhino),
    ).state;
    expect(inst(after, rhino).damage).toBe(profile(b.state, b.ally).atk + 1);
  });
  it("a wild is declared before it is read: [energy] gives +1, [mental] heals, [physical] readies", () => {
    const b = board("47020");
    const declare =
      (type: string): Rule =>
      (s) =>
        s.pendingChoice?.prompt.kind === "declareWildTypes" ? [`0:${type}`] : undefined;
    const by = (type: string) => thwartWith(b, declare(type), pays(b.hand));
    expect(threatOf(by("energy"))).toBe(10 - 3);
    expect(inst(by("mental"), b.ally).damage).toBe(1);
    expect(inst(by("physical"), b.ally).exhausted).toBe(false);
  });
});

describe("Disguise (47013): Action (thwart), exhaust Disguise and your identity -> remove 2 threat from a scheme", () => {
  function board(hero = true) {
    const base = stage(hero ? heroGame(["47013"]) : setupGame(["47013"]), ["47013"], 3);
    const played = playStaged(base.state, "47013", 1);
    return {
      state: patchInstance(played.state, mainOf(played.state), { threat: 5 }),
      card: played.id,
      jubilee: identityOf(played.state),
    };
  }
  const useIt = (b: ReturnType<typeof board>, pick: Picker = firstLegal) =>
    driveEventsPicking(DEPS, b.state, pick, use(P1, b.card, "47013.disguise-action")).state;

  it("is attached to its controller's identity and removes 2 threat, exhausting both", () => {
    const b = board();
    expect(inst(b.state, b.card).attachedTo ?? identityOf(b.state)).toBe(b.jubilee);
    const after = useIt(b);
    expect(threatOf(after)).toBe(3);
    expect(inst(after, b.card).exhausted).toBe(true);
    expect(inst(after, b.jubilee).exhausted).toBe(true);
  });
  it("works in alter-ego form too (the Action names no form)", () => {
    const b = board(false);
    expect(threatOf(useIt(b))).toBe(3);
  });
  it("cannot be used with the identity exhausted or itself exhausted", () => {
    const b = board();
    const a = patchInstance(b.state, b.jubilee, { exhausted: true });
    expect(accepted(a, use(P1, b.card, "47013.disguise-action"))).toBe(false);
    const c = patchInstance(b.state, b.card, { exhausted: true });
    expect(accepted(c, use(P1, b.card, "47013.disguise-action"))).toBe(false);
  });
  it("is a thwart by her identity: it can be chosen against a side scheme", () => {
    const b = board();
    const side = engageScheme(b.state);
    const after = useIt({ ...b, state: side.state }, picker(take(side.id)));
    expect(threatOf(after, side.id)).toBe(1);
    expect(threatOf(after)).toBe(5);
  });
});

/** Surgery: Breakin' & Takin' (3 threat) from the encounter deck into the villain area. */
function engageScheme(state: GameState): { readonly state: GameState; readonly id: InstanceId } {
  const pile = activeEncounterDeck(state);
  const id = pile.deck.find((i) => codeOf(state, i) === BREAKIN)!;
  const deckId = activeEncounterDeckId(state);
  return {
    id,
    state: {
      ...patchInstance(state, id, { threat: 3, faceup: true }),
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard },
      },
      villainArea: [...state.villainArea, id],
    },
  };
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/** One resource of each kind, by the card that prints exactly that (all in the deck as extras). */
const E = "47019"; // Cell Phone [energy]
const M = "47013"; // Disguise [mental]
const PH = "47014"; // Waylay [physical]
const W = "47020"; // X-Gene [wild]

/** Replaces the hand with exactly these cards (by code, in order). */
function handOf(s: GameState, ...codes: readonly string[]): { state: GameState; ids: InstanceId[] } {
  const cleared: GameState = {
    ...s,
    players: s.players.map((p) => (p.playerId === P1 ? { ...p, hand: [], deck: [...p.deck, ...p.hand] } : p)),
  };
  const moved = moveToHand(cleared, P1, ...codes);
  return { state: moved.state, ids: [...moved.ids] };
}
/** Answers successive prompts of `kind` with these selections in order. */
const inOrder = (kind: string, ...answers: readonly (readonly string[])[]): Rule => {
  let n = 0;
  return (s) => {
    const choice = s.pendingChoice;
    if (!choice || choice.prompt.kind !== kind) return undefined;
    const answer = answers[n++];
    return answer && answer.every((id) => choice.options.some((o) => o.optionId === id)) ? answer : undefined;
  };
};
/** Declares each wild of a `declareWildTypes` prompt, in order. */
const declare =
  (...types: readonly string[]): Rule =>
  (s) =>
    s.pendingChoice?.prompt.kind === "declareWildTypes" ? types.map((t, i) => `${i}:${t}`) : undefined;

/** Plays `event` from a hand of exactly it and `payers`, paying with all of them. */
function cast(s: GameState, event: string, payers: readonly string[], pick: Picker = firstLegal) {
  const staged = handOf(s, event, ...payers);
  const [id, ...paid] = staged.ids as [InstanceId, ...InstanceId[]];
  const run = driveEventsPicking(DEPS, staged.state, pick, play(P1, id, paid));
  return { ...run, id, start: staged.state };
}
const EXTRAS = ["47014", "47014", "47013", "47013", "47019", "47019", "47019", "47020", "47020", "01090"];
const eventGame = (event: string, ...more: readonly string[]) => heroGame([event, event, ...EXTRAS, ...more]);

describe("Waylay (47014): Hero Response (attack), after your hero thwarts, 4 damage to an enemy (7 if it removed the last threat)", () => {
  /** Jubilee in hero form with Waylay in the deck and a hand of Waylay plus three resources; Shocker (3 hp) engaged. */
  function board(threat: number, side = false) {
    const g = eventGame("47014");
    const e = engage(g, SHOCKER);
    const scheme = side ? engageScheme(e.state) : { state: e.state, id: mainOf(e.state) };
    const s = patchInstance(scheme.state, scheme.id, { threat });
    const staged = handOf(s, "47014", E, M, W);
    const [waylay, ...paid] = staged.ids as [InstanceId, ...InstanceId[]];
    return { state: staged.state, waylay, paid, scheme: scheme.id, shocker: e.id, jubilee: identityOf(s) };
  }
  const pay =
    (b: { readonly waylay: InstanceId }): Rule =>
    (s) =>
      s.pendingChoice?.prompt.kind === "payForCard"
        ? s.pendingChoice.options
            .map((o) => o.optionId)
            .filter((o) => o !== b.waylay)
            .slice(0, 3)
        : undefined;
  const thwartAndWaylay = (b: ReturnType<typeof board>, ...rules: readonly Rule[]) =>
    driveEventsPicking(
      DEPS,
      b.state,
      picker(accept("47014.waylay-response"), pay(b), declare("physical"), ...rules),
      thwartBy(b.state, b.jubilee, b.scheme),
    );

  it("4 damage to the enemy she chooses when the thwart leaves threat behind", () => {
    const b = board(5, true);
    const rhino = villainOf(b.state);
    const { state } = thwartAndWaylay(b, take(rhino));
    expect(inst(state, rhino).damage).toBe(4);
    expect(playerOf(state, P1).discard).toContain(b.waylay);
  });
  it("7 damage when the thwart removed the last threat from a scheme", () => {
    const b = board(1, true);
    const rhino = villainOf(b.state);
    const { state } = thwartAndWaylay(b, take(rhino));
    expect(inst(state, b.scheme).threat).toBe(0);
    expect(inst(state, rhino).damage).toBe(7);
  });
  it("answers a (thwart) ability of the hero too, and a defeated minion can be the target", () => {
    const b = board(5, true);
    const { state } = thwartAndWaylay(b, take(b.shocker));
    expect(playerOf(state, P1).playArea).not.toContain(b.shocker);
  });
  it("guard restricts the choice: with a guard minion engaged, the villain is not offered", () => {
    const g = eventGame("47014");
    const guard = engage(g, MERCENARY);
    const s = patchInstance(guard.state, mainOf(guard.state), { threat: 5 });
    const staged = handOf(s, "47014", E, M, W);
    const b = { state: staged.state, waylay: staged.ids[0]!, jubilee: identityOf(s), scheme: mainOf(s), paid: [] };
    const probe = spy(picker(accept("47014.waylay-response"), pay(b), declare("physical")));
    driveEventsPicking(DEPS, b.state, probe.pick, thwartBy(b.state, b.jubilee, b.scheme));
    const targets = probe.seen.find((p) => p.kind === "chooseTarget")!;
    expect(targets.options).toEqual([guard.id]);
  });
  it("Q48 = A: the label makes it one attack by Jubilee on the enemy, and its 4 damage is attack damage", () => {
    const b = board(5, true);
    const rhino = villainOf(b.state);
    const { events } = thwartAndWaylay(b, take(rhino));
    const attacks = events.flatMap((e) =>
      e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "attack" ? [e.event] : [],
    );
    expect(attacks).toHaveLength(1);
    expect(attacks[0]).toMatchObject({ attackerInstanceId: b.jubilee, labeled: true });
    expect(attacks[0]!.attacked).toEqual([rhino]);
    expect(attacks[0]!.results?.damage).toBe(4);
  });
  it("is not offered after an attack, only after a thwart", () => {
    const b = board(5, true);
    const probe = spy(picker(accept("47014.waylay-response")));
    driveEventsPicking(DEPS, b.state, probe.pick, attackBy(b.state, b.jubilee, villainOf(b.state)));
    expect(offered(probe.seen, "47014.waylay-response")).toBe(false);
  });
});

describe("Three Steps Ahead (47015): Hero Action (thwart), for each different resource type that paid, remove 2 threat from a scheme", () => {
  function board() {
    const g = eventGame("47015");
    const side = engageScheme(patchInstance(g, mainOf(g), { threat: 10 }));
    return { state: side.state, side: side.id, main: mainOf(side.state) };
  }
  const schemes = (b: ReturnType<typeof board>, ...ids: readonly string[]) =>
    inOrder("chooseTarget", ...ids.map((id) => [id]));

  it("[energy] [mental] [physical]: three types, three removals of 2 (the same scheme may be chosen again)", () => {
    const b = board();
    const { state } = cast(b.state, "47015", [E, M, PH], picker(schemes(b, b.main, b.main, b.side)));
    expect(threatOf(state, b.main)).toBe(10 - 4);
    expect(threatOf(state, b.side)).toBe(3 - 2);
  });
  it("[energy] twice: one type, one removal of 2", () => {
    const b = board();
    const { state } = cast(b.state, "47015", [E, E, E], picker(schemes(b, b.main)));
    expect(threatOf(state, b.main)).toBe(8);
  });
  it("[energy] [mental] and a wild declared [physical]: three removals", () => {
    const b = board();
    const run = cast(b.state, "47015", [E, M, W], picker(declare("physical"), schemes(b, b.main, b.main, b.main)));
    expect(threatOf(run.state, b.main)).toBe(10 - 6);
  });
  it("the wild declared [energy] duplicates a type: two removals; left [wild] it is a type of its own: three", () => {
    const b = board();
    const energy = cast(b.state, "47015", [E, M, W], picker(declare("energy"), schemes(b, b.main, b.main)));
    expect(threatOf(energy.state, b.main)).toBe(10 - 4);
    const wild = cast(b.state, "47015", [E, M, W], picker(declare("wild"), schemes(b, b.main, b.main, b.main)));
    expect(threatOf(wild.state, b.main)).toBe(10 - 6);
  });
  it("all the removals are one thwart: Waylay's 'after your hero thwarts' is offered once, not three times", () => {
    const b = board();
    const staged = handOf(b.state, "47015", E, M, PH, "47014", E, M, W);
    const [event, e1, m1, p1, waylay, ...rest] = staged.ids as InstanceId[];
    const probe = spy(
      picker(
        schemes(b, b.main, b.side, b.main),
        accept("47014.waylay-response"),
        (s) =>
          s.pendingChoice?.prompt.kind === "payForCard"
            ? s.pendingChoice.options
                .map((o) => o.optionId)
                .filter((o) => o !== waylay)
                .slice(0, 3)
            : undefined,
        declare("physical"),
      ),
    );
    driveEventsPicking(DEPS, staged.state, probe.pick, play(P1, event!, [e1!, m1!, p1!]));
    expect(rest).toHaveLength(3);
    expect(
      probe.seen.filter(
        (p) => p.kind === "chooseTriggers" && p.options.some((o) => o.includes("47014.waylay-response")),
      ),
    ).toHaveLength(1);
  });
  it("Shopping-Spree style bars apply: a hero cannot remove threat from a scheme that bars heroes (thwart label)", () => {
    // The label makes each removal a thwart by her identity; a side scheme whose threat only an alter-ego may remove is
    // not offered. Shopping Spree 47003 is that scheme.
    const g = eventGame("47015", "47003");
    const spree = playStaged(stage(g, ["47003"], 2).state, "47003", 0);
    const s = patchInstance(spree.state, mainOf(spree.state), { threat: 10 });
    const probe = spy(picker());
    cast(s, "47015", [E, E, E], probe.pick);
    const targets = probe.seen.find((p) => p.kind === "chooseTarget")!;
    expect(targets.options).toEqual([mainOf(s)]);
  });
});

describe("Multitalented (47021): Hero Action (attack/thwart), if you paid using at least 1 [physical] / [mental] / [energy]", () => {
  function board() {
    const g = eventGame("47021");
    const jubilee = identityOf(g);
    const hurt = patchInstance(patchInstance(g, mainOf(g), { threat: 6 }), jubilee, { damage: 3 });
    return { state: hurt, jubilee, rhino: villainOf(hurt), main: mainOf(hurt) };
  }
  const run = (b: ReturnType<typeof board>, payers: readonly string[], ...rules: readonly Rule[]) =>
    cast(b.state, "47021", payers, picker(...rules, take(b.rhino), take(b.main)));

  it("one card of each type: 2 damage to an enemy, 2 threat from a scheme, 2 healed from her identity", () => {
    const b = board();
    const { state } = run(b, [E, M, PH]);
    expect(inst(state, b.rhino).damage).toBe(2);
    expect(threatOf(state, b.main)).toBe(4);
    expect(inst(state, b.jubilee).damage).toBe(1);
  });
  it("[physical] only (Waylay and Strength): 2 damage and nothing else", () => {
    const b = board();
    const { state } = run(b, [PH, "01090"]);
    expect(inst(state, b.rhino).damage).toBe(2);
    expect(threatOf(state, b.main)).toBe(6);
    expect(inst(state, b.jubilee).damage).toBe(3);
  });
  it("[energy] and [mental] only: 2 threat and 2 healed, no damage", () => {
    const b = board();
    const { state } = run(b, [E, M, M]);
    expect(inst(state, b.rhino).damage).toBe(0);
    expect(threatOf(state, b.main)).toBe(4);
    expect(inst(state, b.jubilee).damage).toBe(1);
  });
  it("a wild is declared: [mental] gives the threat line, [physical] the damage line, left [wild] none", () => {
    const b = board();
    const mental = run(b, [PH, PH, W], declare("mental"));
    expect(inst(mental.state, b.rhino).damage).toBe(2);
    expect(threatOf(mental.state, b.main)).toBe(4);
    expect(inst(mental.state, b.jubilee).damage).toBe(3);
    const left = run(b, [PH, PH, W], declare("wild"));
    expect(inst(left.state, b.rhino).damage).toBe(2);
    expect(threatOf(left.state, b.main)).toBe(6);
    expect(inst(left.state, b.jubilee).damage).toBe(3);
  });
  it("is both an attack and a thwart: a stunned identity cancels all of it and loses the status card", () => {
    const b = board();
    const stunned = { ...b, state: status(b.state, b.jubilee, "stunned", 1) };
    const { state } = run(stunned, [E, M, PH]);
    expect(inst(state, b.rhino).damage).toBe(0);
    expect(threatOf(state, b.main)).toBe(6);
    expect(inst(state, b.jubilee).statuses.stunned).toBe(0);
  });
  it("Q48 = A: its damage line is one attack by Jubilee; with no [physical] paid there is no damage and no attack", () => {
    const b = board();
    const attacksIn = (events: readonly GameEvent[]) =>
      events.flatMap((e) =>
        e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "attack" ? [e.event] : [],
      );
    const attacks = attacksIn(run(b, [PH, "01090"]).events);
    expect(attacks).toHaveLength(1);
    expect(attacks[0]).toMatchObject({ attackerInstanceId: b.jubilee, labeled: true });
    expect(attacks[0]!.attacked).toEqual([b.rhino]);
    expect(attacks[0]!.results?.damage).toBe(2);
    expect(attacksIn(run(b, [E, M, M]).events)).toEqual([]);
  });
});

/** Team-Up needs Wolverine: his ally card (47002) is played first. */
function withWolverine(): GameState {
  const staged = stage(eventGame("47022", "47002"), ["47002"], 6);
  return playStaged(staged.state, "47002", 4).state;
}

describe("Unlikely Duo (47022): Hero Action (attack), confuse an enemy, then 4 damage to a confused enemy", () => {
  /** Jubilee in hero form; Shocker (3 hp) engaged; Team-Up (Jubilee and Wolverine) is deck data. */
  function board() {
    const e = engage(withWolverine(), SHOCKER);
    return { state: e.state, shocker: e.id, rhino: villainOf(e.state), jubilee: identityOf(e.state) };
  }
  const duo = (b: ReturnType<typeof board>, confuseIt: InstanceId, hitIt: InstanceId, state = b.state) => {
    const staged = handOf(state, "47022", E, M);
    const [id, ...paid] = staged.ids as [InstanceId, ...InstanceId[]];
    return driveEventsPicking(
      DEPS,
      staged.state,
      picker(inOrder("chooseTarget", [confuseIt], [hitIt])),
      play(P1, id, paid),
    );
  };

  it("confuses the villain and deals it 4 damage; the confused card stays", () => {
    const b = board();
    const { state } = duo(b, b.rhino, b.rhino);
    expect(inst(state, b.rhino).damage).toBe(4);
    expect(inst(state, b.rhino).statuses.confused).toBe(1);
  });
  it("the 4 damage may go to another confused enemy: confuse one, and one already confused takes it", () => {
    const b = board();
    const pre = status(b.state, b.shocker, "confused", 1);
    const { state } = duo(b, b.rhino, b.shocker, pre);
    expect(inst(state, b.rhino).statuses.confused).toBe(1);
    expect(inst(state, b.rhino).damage).toBe(0);
    expect(playerOf(state, P1).playArea).not.toContain(b.shocker);
  });
  it("only a confused enemy is a target of the damage: the unconfused minion is not offered", () => {
    const b = board();
    const probe = spy(picker(inOrder("chooseTarget", [b.rhino], [b.rhino])));
    const staged = handOf(b.state, "47022", E, M);
    const [id, ...paid] = staged.ids as [InstanceId, ...InstanceId[]];
    driveEventsPicking(DEPS, staged.state, probe.pick, play(P1, id, paid));
    const targets = probe.seen.filter((p) => p.kind === "chooseTarget");
    expect(targets[0]!.options.sort()).toEqual([b.rhino, b.shocker].sort());
    expect(targets[1]!.options).toEqual([b.rhino]);
  });
  it("is an attack: Jubilee's guard rule holds (a guard minion hides the villain as the confused target)", () => {
    const guard = engage(withWolverine(), MERCENARY);
    const rhino = villainOf(guard.state);
    const probe = spy(picker(inOrder("chooseTarget", [rhino], [guard.id])));
    const staged = handOf(guard.state, "47022", E, M);
    const [id, ...paid] = staged.ids as [InstanceId, ...InstanceId[]];
    const { state } = driveEventsPicking(DEPS, staged.state, probe.pick, play(P1, id, paid));
    expect(inst(state, rhino).statuses.confused).toBe(1);
    const second = probe.seen.filter((p) => p.kind === "chooseTarget")[1];
    expect(second === undefined || !second.options.includes(rhino)).toBe(true);
  });
  it("carries the Team-Up (Jubilee and Wolverine) keyword", () => {
    const card = BY_ID.get("47022") as unknown as { keywords: { name: string; names?: string[] }[] };
    expect(card.keywords).toEqual([{ name: "teamUp", names: ["Jubilee", "Wolverine"] }]);
  });
});

describe("Serve and Protect (47029): Alliance, Hero Interrupt, exhaust an X-FORCE and an X-MEN character -> prevent that threat, a tough card each", () => {
  const SIRYN = "42012"; // Protection ally, X-FORCE
  /** Jubilee (hero form, X-MEN) with Siryn (X-FORCE) in play and the event in hand with two payers; main scheme at 2. */
  function board(copies = 1) {
    const g = heroGame(["47029", ...Array.from({ length: copies - 1 }, () => "47029"), SIRYN, E, E, M, M]);
    const staged = stage(g, [SIRYN], 6);
    const siryn = playStaged(staged.state, SIRYN, 4);
    const hand = handOf(siryn.state, "47029", E, M);
    return { state: hand.state, siryn: siryn.id, jubilee: identityOf(hand.state), hand: hand.ids };
  }
  /**
   * Ends her turn and walks the villain phase, answering what is asked. Rhino is stunned (the activation just loses the
   * card), so a tough card given at step one is still there afterwards. `before` may change the state when a prompt opens.
   */
  function villainPhase(b: ReturnType<typeof board>, before: (s: GameState) => GameState, ...rules: readonly Rule[]) {
    const pick = picker(...rules);
    const seen: { kind: string; options: string[] }[] = [];
    const ended = applyCommand(
      status(b.state, villainOf(b.state), "stunned", 1),
      { type: "endTurn", playerId: P1 },
      DEPS,
    );
    if (!ended.ok) throw new Error(ended.error.message);
    let state = ended.state;
    for (let guard = 0; state.pendingChoice && guard < 50; guard++) {
      state = before(state);
      const c = state.pendingChoice!;
      seen.push({ kind: c.prompt.kind, options: c.options.map((o) => o.optionId) });
      const r = applyCommand(
        state,
        { type: "resolveChoice", playerId: c.playerId, choiceId: c.choiceId, selectedOptionIds: [...pick(state)] },
        DEPS,
      );
      if (!r.ok) throw new Error(`resolveChoice rejected: ${r.error.message}`);
      state = r.state;
    }
    return { state, seen };
  }
  const same = (s: GameState) => s;
  const payForIt =
    (b: ReturnType<typeof board>): Rule =>
    (s) =>
      s.pendingChoice?.prompt.kind === "payForCard"
        ? s.pendingChoice.options
            .map((o) => o.optionId)
            .filter((o) => o !== b.hand[0])
            .slice(0, 2)
        : undefined;

  it("prevents the threat the villain's scheme would place, and gives Siryn and Jubilee a tough status each", () => {
    const b = board();
    const run = villainPhase(b, same, accept("47029.serve-and-protect-interrupt"), payForIt(b));
    expect(threatOf(run.state)).toBe(threatOf(b.state));
    expect(inst(run.state, b.siryn).statuses.tough).toBe(1);
    expect(inst(run.state, b.jubilee).statuses.tough).toBe(1);
    expect(playerOf(run.state, P1).discard).toContain(b.hand[0]);
  });
  it("declined: the threat is placed and nobody gets a tough card", () => {
    const b = board();
    const run = villainPhase(b, same);
    expect(threatOf(run.state)).toBeGreaterThan(threatOf(b.state));
    expect(inst(run.state, b.siryn).statuses.tough).toBe(0);
    expect(inst(run.state, b.jubilee).statuses.tough).toBe(0);
    expect(offered(run.seen, "47029.serve-and-protect-interrupt")).toBe(true);
  });
  it("one character cannot pay both halves: without an X-FORCE character it is not offered", () => {
    const g = heroGame(["47029", E, E, M, M]);
    const hand = handOf(g, "47029", E, M);
    const b = { state: hand.state, siryn: identityOf(g), jubilee: identityOf(g), hand: hand.ids };
    const run = villainPhase(b, same, accept("47029.serve-and-protect-interrupt"));
    expect(offered(run.seen, "47029.serve-and-protect-interrupt")).toBe(false);
    expect(threatOf(run.state)).toBeGreaterThan(threatOf(b.state));
  });
  it("with Siryn exhausted (when the prompt opens) it cannot be used: the threat is placed and nobody is made tough", () => {
    const b = board();
    const tire = (s: GameState) =>
      s.pendingChoice?.prompt.kind === "chooseTriggers" ? patchInstance(s, b.siryn, { exhausted: true }) : s;
    const run = villainPhase(b, tire, accept("47029.serve-and-protect-interrupt"), payForIt(b));
    expect(threatOf(run.state)).toBeGreaterThan(threatOf(b.state));
    expect(inst(run.state, b.jubilee).statuses.tough).toBe(0);
  });
});

describe("Generation X (47016): 3 threat per player, Victory 0, When Defeated each player may fetch an identity-specific event", () => {
  /** Jubilee in hero form with Generation X in play (3 threat); her deck holds her nine events. */
  function board(threat = 1) {
    const g = heroGame(["47016"]);
    const staged = stage(g, ["47016"], 2);
    const played = playStaged(staged.state, "47016", 0);
    return {
      state: patchInstance(played.state, played.id, { threat }),
      entered: inst(played.state, played.id).threat,
      scheme: played.id,
      jubilee: identityOf(played.state),
    };
  }
  const identityEvents = (s: GameState, zone: "deck" | "discard"): InstanceId[] =>
    playerOf(s, P1)[zone].filter((id) => {
      const c = BY_ID.get(codeOf(s, id)) as { type: string } | undefined;
      return (
        c?.type === "event" &&
        ["47006", "47007a", "47007b", "47007c", "47008a", "47008b", "47008c", "47009"].includes(codeOf(s, id))
      );
    });

  it("comes into play with 3 threat for one player", () => {
    const b = board(3);
    const card = BY_ID.get("47016") as unknown as { startingThreat: { perPlayer: number } };
    expect(card.startingThreat.perPlayer).toBe(3);
    expect(b.entered).toBe(3);
    expect(cardsInPlay(b.state)).toContain(b.scheme);
  });
  it("defeating it lets her take one identity-specific event from her deck into her hand", () => {
    const b = board();
    const wanted = identityEvents(b.state, "deck")[0]!;
    const handBefore = playerOf(b.state, P1).hand.length;
    const after = driveEventsPicking(DEPS, b.state, picker(take(wanted)), thwartBy(b.state, b.jubilee, b.scheme)).state;
    expect(playerOf(after, P1).hand).toContain(wanted);
    expect(playerOf(after, P1).hand.length).toBe(handBefore + 1);
    expect(playerOf(after, P1).playArea).not.toContain(b.scheme);
  });
  it("the search reaches her discard pile too, and only identity-specific events are offered", () => {
    const b = board();
    const id = identityEvents(b.state, "deck")[0]!;
    const s = {
      ...b.state,
      players: b.state.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: p.deck.filter((i) => i !== id), discard: [...p.discard, id] } : p,
      ),
    };
    const probe = spy(picker(take(id)));
    const after = driveEventsPicking(DEPS, s, probe.pick, thwartBy(s, b.jubilee, b.scheme)).state;
    expect(playerOf(after, P1).hand).toContain(id);
    const offeredIds = probe.seen.find((p) => p.kind === "chooseCards")!.options;
    expect(offeredIds).toContain(id);
    expect(offeredIds.every((o) => codeOf(s, o as InstanceId).startsWith("470"))).toBe(true);
  });
  it("she may decline: nothing is added", () => {
    const b = board();
    const handBefore = playerOf(b.state, P1).hand.length;
    const after = driveEventsPicking(DEPS, b.state, firstLegal, thwartBy(b.state, b.jubilee, b.scheme)).state;
    expect(playerOf(after, P1).hand.length).toBe(handBefore);
  });
  it("Generation X's +1 THW for X-MEN characters has no script (skipped), so a basic thwart against it removes just THW", () => {
    const b = board(5);
    const thw = profile(b.state, b.jubilee).thw;
    const after = driveEventsPicking(DEPS, b.state, firstLegal, thwartBy(b.state, b.jubilee, b.scheme)).state;
    expect(threatOf(after, b.scheme)).toBe(5 - thw);
  });
  it("the draft (an always-on +1 THW) gives it against Generation X, but also against the main scheme", () => {
    const b = board(5);
    const thw = profile(b.state, b.jubilee).thw;
    const main = patchInstance(b.state, mainOf(b.state), { threat: 5 });
    const draftThwart = (scheme: InstanceId) =>
      driveEventsPicking(DRAFT_DEPS, main, firstLegal, thwartBy(main, b.jubilee, scheme)).state;
    expect(threatOf(draftThwart(b.scheme), b.scheme)).toBe(5 - (thw + 1));
    expect(threatOf(draftThwart(mainOf(main)))).toBe(5 - (thw + 1));
  });
  it.fails("the printed text: +1 THW against Generation X only, none against the main scheme (no thwart-in-progress predicate)", () => {
    const b = board(5);
    const thw = profile(b.state, b.jubilee).thw;
    const main = patchInstance(b.state, mainOf(b.state), { threat: 5 });
    const draftThwart = (scheme: InstanceId) =>
      driveEventsPicking(DRAFT_DEPS, main, firstLegal, thwartBy(main, b.jubilee, scheme)).state;
    expect(threatOf(draftThwart(b.scheme), b.scheme)).toBe(5 - (thw + 1));
    expect(threatOf(draftThwart(mainOf(main)))).toBe(5 - thw);
  });
});

describe("Mutant Mayhem (47028): Alliance, return an X-FORCE ally and an X-MEN ally -> those players play them for free (NOT registered)", () => {
  const SIRYN = "42012"; // X-FORCE ally, cost 4
  /** Siryn (X-FORCE) in play, Mutant Mayhem and three payers in hand; no X-MEN ally. */
  function board() {
    const g = heroGame(["47028", SIRYN, E, E, M, M]);
    const siryn = playStaged(stage(g, [SIRYN], 6).state, SIRYN, 4);
    const hand = handOf(siryn.state, "47028", E, M, PH);
    return { state: hand.state, siryn: siryn.id, mayhem: hand.ids[0]!, paid: hand.ids.slice(1) };
  }
  it("is not registered: with the shipped scripts the card has no ability and its text does nothing", () => {
    expect("47028.mutant-mayhem-action" in JUBILEE_ASPECT_BASIC).toBe(false);
    expect("47028.mutant-mayhem-action" in JUBILEE_ASPECT_BASIC_SKIPPED).toBe(true);
  });
  it("the draft (choose and return as effects) is playable with no X-MEN ally to return: the cost is not enforced", () => {
    const b = board();
    expect(accepted(b.state, play(P1, b.mayhem, [...b.paid]))).toBe(true);
  });
  it.fails("printed: with no X-MEN ally to return the cost cannot be paid, so the card is not playable", () => {
    const b = board();
    const draft = { ...b, state: b.state };
    expect(applyCommand(draft.state, play(P1, b.mayhem, [...b.paid]), DRAFT_DEPS).ok).toBe(false);
  });
});

describe("Cell Phone (47019): Uses 3; exhaust, remove a charge, choose a player -> they make a basic attack or thwart (NOT registered)", () => {
  /** Wolverine (ally, ATK 3?) ready beside an exhausted Jubilee, Cell Phone in play. */
  function board() {
    const g = heroGame(["47019", "47002", E, E, M, M]);
    const phone = playStaged(stage(g, ["47019"], 6).state, "47019", 2);
    const wolverine = playStaged(phone.state, "47002", 4);
    const jubilee = identityOf(wolverine.state);
    return {
      state: patchInstance(wolverine.state, jubilee, { exhausted: true }),
      phone: phone.id,
      wolverine: wolverine.id,
      jubilee,
    };
  }
  it("is not registered: no ability, and the card still enters play with its three charge counters", () => {
    expect("47019.cell-phone-action" in JUBILEE_ASPECT_BASIC).toBe(false);
    const b = board();
    expect(inst(b.state, b.phone).counters.charge).toBe(3);
  });
  it("the draft only exhausts, spends a counter and makes a 1-damage DSL attack by the identity", () => {
    const b = board();
    const after = driveEventsPicking(
      DRAFT_DEPS,
      b.state,
      firstLegal,
      use(P1, b.phone, "47019.cell-phone-action"),
    ).state;
    expect(inst(after, b.phone).counters.charge).toBe(2);
    expect(inst(after, b.phone).exhausted).toBe(true);
    expect(inst(after, villainOf(after)).damage).toBe(1);
    expect(inst(after, b.wolverine).exhausted).toBe(false);
  });
  it.fails("printed: a chosen player's character makes a basic attack at +1 ATK (Wolverine attacks, exhausts, deals his ATK + 1)", () => {
    const b = board();
    const after = driveEventsPicking(
      DRAFT_DEPS,
      b.state,
      firstLegal,
      use(P1, b.phone, "47019.cell-phone-action"),
    ).state;
    expect(inst(after, b.wolverine).exhausted).toBe(true);
    expect(inst(after, villainOf(after)).damage).toBe(profile(b.state, b.wolverine).atk + 1);
  });
});

describe("The Power of Justice (47017) and X-Gene (47020): the reprints work as the cards they copy", () => {
  it("X-Gene needs a MUTANT identity: refused in hero form (X-MEN), played in alter-ego form (Jubilation Lee)", () => {
    const hero = stage(heroGame(["47020"]), ["47020"], 2);
    const refused = applyCommand(hero.state, play(P1, hero.ids[0]!, [hero.fill[0]!]), DEPS);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.message).toMatch(/MUTANT/);
    const ego = stage(setupGame(["47020"]), ["47020"], 2);
    const played = playStaged(ego.state, "47020", 1);
    expect(cardsInPlay(played.state)).toContain(played.id);
  });
  it("X-Gene generates a [wild] for an identity-specific event only (a Jubilee event, not a Core one)", () => {
    const ego = stage(setupGame(["47020"]), ["47020"], 2);
    const gene = playStaged(ego.state, "47020", 1);
    const def = ABILITIES["47020.x-gene-resource"] as unknown as { generatesFor?: { identitySetOf?: unknown } };
    expect(JSON.stringify(def)).toContain("identitySetOf");
    expect(inst(gene.state, gene.id).exhausted).toBe(false);
  });
  it("The Power of Justice doubles its resources for a Justice card: Three Steps Ahead (cost 3) is paid with it and one card", () => {
    const g = heroGame(["47017", "47015", E]);
    const staged = handOf(g, "47015", "47017", E);
    const [steps, justice, e] = staged.ids as [InstanceId, InstanceId, InstanceId];
    const doubled = applyCommand(
      staged.state,
      { ...play(P1, steps, [justice, e]), wildAs: ["energy", "mental"] } as Command,
      DEPS,
    );
    expect(doubled.ok).toBe(true);
    const plain = handOf(g, "47015", E, M);
    expect(accepted(plain.state, { ...play(P1, plain.ids[0]!, [plain.ids[1]!, plain.ids[2]!]) })).toBe(false);
  });
});
