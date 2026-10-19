import {
  activeEncounterDeck,
  activeEncounterDeckId,
  applyCommand,
  characterProfile,
  createGame,
  hasKeyword,
  type Command,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../../testing/staging.js";
import { engageMinion, handWith } from "../../../wave6/mut_gen/project-wideawake-testing.js";
import { WAVE11_CARDS } from "../../cards.js";
import { WAVE11_DEPS } from "../../index.js";
import { wave11Scenario } from "../../setup.js";
import {
  FNE_SCENARIOS_ART_MUSEUM_HEIST as REGISTRY,
  FNE_SCENARIOS_ART_MUSEUM_HEIST_SKIPPED as SKIPPED,
} from "./art-museum-heist.js";

vi.setConfig({ testTimeout: 180_000 });

const MAIN = "60121a";
const OBJECT = "60122";
const POTTERY = "60123";
const SHIELD = "60124";
const LANDSCAPE = "60125";
const THIEF = "60126";
const TUG = "60127";
const ARTS = [OBJECT, POTTERY, SHIELD, LANDSCAPE];
/** A Maggia minion: dealt as filler, it engages the player it is dealt to and does nothing else this phase. */
const ENFORCERS = "60092";
const REFS = [
  "60121a.setup",
  "60121b.art-museum-heist-constant",
  "60121b.art-museum-heist-forced-response",
  "60122.impossible-object-forced-response",
  "60122.impossible-object-action",
  "60123.inspiring-pottery-constant",
  "60123.inspiring-pottery-action",
  "60124.replica-shield-forced-response",
  "60124.replica-shield-action",
  "60125.stunning-landscape-forced-response",
  "60125.stunning-landscape-action",
  "60126.when-revealed",
  "60126.boost",
  "60127.when-revealed",
];
/** Core encounter cards with no boost icon and no boost ability: blank boost cards. */
const BLANKS = ["01187", "01187", "01186", "01186"];

const data = (code: string) => (WAVE11_CARDS as readonly any[]).find((c) => (c.id as string) === code)!;
const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const idOf = (s: GameState, code: string): InstanceId =>
  (Object.keys(s.instances) as InstanceId[]).find((i) => codeOf(s, i) === code)!;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const hero = (s: GameState, p: PlayerId = P1): InstanceId => identityOf(s, p);
const statuses = (s: GameState, id: InstanceId) => inst(s, id).statuses;
/** The codes of the Art attachments on `host`. */
const artOn = (s: GameState, host: InstanceId): string[] =>
  inst(s, host)
    .attachments.map((i) => codeOf(s, i))
    .filter((c) => ARTS.includes(c))
    .sort();
const deckCodes = (s: GameState): string[] => activeEncounterDeck(s).deck.map((i) => codeOf(s, i));
const discardCodes = (s: GameState): string[] => activeEncounterDeck(s).discard.map((i) => codeOf(s, i));
const profile = (s: GameState, id: InstanceId) => characterProfile(s, id, WAVE11_DEPS)!;
/** Who a copy of `code` that is engaged with a player is engaged with (the dealt copy, not another in the deck). */
const engagedCopy = (s: GameState, code: string): PlayerId | null =>
  (Object.keys(s.instances) as InstanceId[]).map((i) => inst(s, i)).find((c) => c.cardId === code && c.engagedWith)
    ?.engagedWith ?? null;
const mainThreat = (s: GameState): number => inst(s, s.mainScheme.instanceId).threat;

/** The scenario builder's game against Hammerhead: Core Spider-Man (and Captain Marvel), heroes in hero form. */
function newGame(opts: { players?: number; seed?: number } = {}): GameState {
  const { players = 1, seed = 1 } = opts;
  const seats = [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }];
  const config = wave11Scenario("art-museum-heist", {
    villainSetId: "hammerhead",
    players: seats.slice(0, players),
    seed,
    difficulty: "standard",
  } as never);
  const created = createGame(config, WAVE11_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  let s = settle(created.state, firstLegal, (st) => st.step.phase === "player", WAVE11_DEPS);
  for (let n = 0; n < players; n++) s = withForm(s, { heroForm: 0 }, n === 0 ? P1 : P2);
  return s;
}

/**
 * Surgery: moves the first copy of `code` to `to` (a card id to attach to, or the bottom of the encounter deck, or its
 * discard pile), taking it off any host it is on. No reveal, no trigger.
 */
function place(state: GameState, code: string, to: InstanceId | "deck" | "discard"): GameState {
  const id = idOf(state, code);
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const old = inst(state, id).attachedTo;
  let next: GameState = {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: {
        deck: [...pile.deck.filter((i) => i !== id), ...(to === "deck" ? [id] : [])],
        discard: [...(to === "discard" ? [id] : []), ...pile.discard.filter((i) => i !== id)],
      },
    },
  };
  if (old) next = patchInstance(next, old, { attachments: inst(next, old).attachments.filter((i) => i !== id) });
  next = patchInstance(next, id, { attachedTo: null, faceup: true, controllerId: null });
  if (to === "deck" || to === "discard") return next;
  next = patchInstance(next, id, { attachedTo: to });
  return patchInstance(next, to, { attachments: [...inst(next, to).attachments.filter((i) => i !== id), id] });
}

/** Every Art attachment off the table and into the encounter deck, and the villain's statuses clear. */
function cleared(state: GameState): GameState {
  let s = state;
  for (const code of ARTS) s = place(s, code, "deck");
  return patchInstance(s, villainOf(s), { statuses: { stunned: 0, confused: 0, tough: 0 } });
}

const declines: Picker = (s) => (s.pendingChoice!.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s));
/** Answers a prompt offering any of `ids` by picking them; every other prompt as `fallback`. */
const picksOr =
  (fallback: Picker, ...ids: readonly string[]): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    const wanted = choice.options.filter((o) => ids.includes(o.optionId as string)).map((o) => o.optionId as string);
    return wanted.length > 0 ? wanted.slice(0, choice.maxSelections) : fallback(s);
  };
/** Picking `ids` while declining every defense: the villain's and the minions' attacks go undefended. */
const picks = (...ids: readonly string[]): Picker => picksOr(declines, ...ids);

/** Defends with a hero when one of `who` is asked to defend, else declines. */
const defendsFor =
  (...who: readonly PlayerId[]): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind !== "declareDefender") return firstLegal(s);
    const defender = choice.options.find((o) => (o.optionId as string) !== "decline");
    return who.includes(choice.playerId) && defender ? [defender.optionId as string] : ["decline"];
  };

/** Every hero defends: no attack of the villain phase is undefended. */
const defending: Picker = defendsFor(P1, P2);

/** `boosts` blank boost cards, then these cards dealt, then the villain phase after every player ends their turn. */
function villainPhase(state: GameState, boosts: number, dealt: readonly string[], pick: Picker = declines) {
  const stacked = stackEncounterDeck(state, ...BLANKS.slice(0, boosts), ...dealt);
  const turns = state.players.map((p) => endTurn(p.playerId));
  return driveEventsPicking(WAVE11_DEPS, stacked, pick, ...turns);
}

/** One command, then every prompt answered by `pick`. */
const drive = (state: GameState, command: Command, pick: Picker = declines): GameState =>
  driveEventsPicking(WAVE11_DEPS, state, pick, command).state;

/** The player's first card printing a [wild] resource, moved to their hand. */
function withWild(state: GameState, player: PlayerId): { state: GameState; ids: InstanceId[] } {
  const owner = playerOf(state, player);
  const id = [...owner.hand, ...owner.deck].find(
    (i) => (state.cardPool[inst(state, i).cardId] as any).resourceIcons?.wild > 0,
  );
  if (!id) throw new Error("no wild resource card in the hand or deck");
  const moved = moveToHand(state, player, inst(state, id).cardId as string);
  return { state: moved.state, ids: [moved.ids[0]!] };
}

describe("registry", () => {
  it("registers every printed ref of the seven cards; nothing is skipped", () => {
    const printed = [MAIN, ...ARTS, THIEF, TUG].flatMap((c) => abilityRefIds(data(c)));
    expect([...printed].sort()).toEqual([...REFS].sort());
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS].sort());
    expect(Object.keys(SKIPPED)).toEqual([]);
  });
  it.each([...REFS])("%s validates", (ref) => {
    expect(validateDefinition(REGISTRY[ref]!), ref).toEqual([]);
  });
});

describe("Art Museum Heist 60121a/b", () => {
  it("60121a.setup: one Art attachment at random is on the villain and the other three are in the encounter deck", () => {
    const seen = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      const s = newGame({ seed });
      const onVillain = artOn(s, villainOf(s));
      expect(onVillain, `seed ${seed}`).toHaveLength(1);
      seen.add(onVillain[0]!);
      expect(
        deckCodes(s)
          .filter((c) => ARTS.includes(c))
          .sort(),
        `seed ${seed}`,
      ).toEqual(ARTS.filter((c) => c !== onVillain[0]).sort());
    }
    // The seeded random pick is not one fixed card.
    expect(seen.size).toBeGreaterThan(1);
  });

  it("60121a.setup: the same seed picks the same Art attachment", () => {
    const a = newGame({ seed: 5 });
    const b = newGame({ seed: 5 });
    expect(artOn(a, villainOf(a))).toEqual(artOn(b, villainOf(b)));
  });
});

describe("Art Museum Heist 60121b acceleration", () => {
  /** Threat the villain phase adds to the main scheme with `n` Art attachments on the villain (hero form: he attacks). */
  const added = (n: number, players = 1) => {
    let s = cleared(newGame({ players }));
    for (const code of ARTS.slice(0, n)) s = place(s, code, villainOf(s));
    s = patchInstance(s, villainOf(s), { statuses: { stunned: 0, confused: 0, tough: 0 } });
    const before = mainThreat(s);
    const run = villainPhase(s, players, Array(players).fill(ENFORCERS));
    return mainThreat(run.state) - before;
  };

  it("60121b.art-museum-heist-constant: X is 1 more than the Art attachments on the villain, per hero", () => {
    expect(added(0)).toBe(1);
    expect(added(1)).toBe(2);
    expect(added(3)).toBe(4);
    expect(added(2, 2)).toBe(6);
  });
});

/** Art attachment -> the status card its Forced Response gives (Inspiring Pottery gives none). */
const GIVES: readonly [string, "confused" | "tough" | "stunned", string][] = [
  [OBJECT, "confused", "60122.impossible-object-forced-response"],
  [SHIELD, "tough", "60124.replica-shield-forced-response"],
  [LANDSCAPE, "stunned", "60125.stunning-landscape-forced-response"],
];
const ACTIONS: readonly [string, "mental" | "wild" | "physical" | "energy", string][] = [
  [OBJECT, "mental", "60122.impossible-object-action"],
  [POTTERY, "wild", "60123.inspiring-pottery-action"],
  [SHIELD, "physical", "60124.replica-shield-action"],
  [LANDSCAPE, "energy", "60125.stunning-landscape-action"],
];

describe("the Art attachments 60122-60125", () => {
  it.each(GIVES)("%s revealed: attaches to the villain and gives it its status card (%s)", (code, status, ref) => {
    const run = villainPhase(cleared(newGame()), 1, [code, ENFORCERS]);
    const villain = villainOf(run.state);
    expect(artOn(run.state, villain), ref).toEqual([code]);
    expect(statuses(run.state, villain)).toEqual({ stunned: 0, confused: 0, tough: 0, [status]: 1 });
    // Surge: the card after it was revealed too.
    expect(engagedCopy(run.state, ENFORCERS)).toBe(P1);
  });

  it("60123.inspiring-pottery-constant: the attached character has stalwart, the villain does not otherwise", () => {
    const bare = cleared(newGame());
    expect(hasKeyword(bare, villainOf(bare), "stalwart", WAVE11_DEPS)).toBe(false);
    const withIt = place(bare, POTTERY, villainOf(bare));
    expect(hasKeyword(withIt, villainOf(withIt), "stalwart", WAVE11_DEPS)).toBe(true);
    expect(hasKeyword(withIt, hero(withIt), "stalwart", WAVE11_DEPS)).toBe(false);
    const onHero = place(withIt, POTTERY, hero(withIt));
    expect(hasKeyword(onHero, hero(onHero), "stalwart", WAVE11_DEPS)).toBe(true);
    expect(hasKeyword(onHero, villainOf(onHero), "stalwart", WAVE11_DEPS)).toBe(false);
  });

  it("the printed +1 SCH is on the villain while attached", () => {
    const bare = cleared(newGame());
    const attached = place(bare, OBJECT, villainOf(bare));
    expect(profile(attached, villainOf(attached)).sch).toBe(profile(bare, villainOf(bare)).sch + 1);
  });

  it.each(ACTIONS)("%s Hero Action by exhausting your hero: attaches to your hero (%s)", (code, _resource, ref) => {
    const base = cleared(newGame());
    const s = place(base, code, villainOf(base));
    const art = idOf(s, code);
    const done = drive(s, use(P1, art, ref, [], undefined, { branch: 1 }));
    expect(inst(done, art).attachedTo).toBe(hero(done));
    expect(inst(done, hero(done)).exhausted).toBe(true);
    expect(artOn(done, villainOf(done))).toEqual([]);
    const given = GIVES.find(([c]) => c === code);
    if (given) expect(statuses(done, hero(done))[given[1]], "the hero got the status card").toBe(1);
    if (given) expect(statuses(done, villainOf(done))[given[1]], "the villain did not").toBe(0);
  });

  // A [wild] resource is a card printing the wild icon: Core's Captain Marvel (Leadership) has one, Spider-Man (Justice) none.
  it.each(ACTIONS)(
    "%s Hero Action by spending a %s resource: attaches to your hero without exhausting it",
    (code, resource, ref) => {
      const actor = resource === "wild" ? P2 : P1;
      const base = cleared(newGame({ players: resource === "wild" ? 2 : 1 }));
      const s = place(base, code, villainOf(base));
      const given = resource === "wild" ? withWild(s, actor) : handWith(s, actor, resource, 1);
      expect(given.ids).toHaveLength(1);
      const art = idOf(given.state, code);
      const payment = given.ids.map((fromHand) => ({ fromHand }));
      const done = drive(given.state, use(actor, art, ref, payment, undefined, { branch: 0 }));
      expect(inst(done, art).attachedTo).toBe(hero(done, actor));
      expect(inst(done, hero(done, actor)).exhausted).toBe(false);
      expect(playerOf(done, actor).hand).not.toContain(given.ids[0]);
    },
  );

  it("60123.inspiring-pottery-action: a non-wild resource cannot pay for it", () => {
    const base = cleared(newGame());
    const s = place(base, POTTERY, villainOf(base));
    const given = handWith(s, P1, "mental", 1);
    const command = use(
      P1,
      idOf(s, POTTERY),
      "60123.inspiring-pottery-action",
      given.ids.map((fromHand) => ({ fromHand })),
      undefined,
      { branch: 0 },
    );
    expect(applyCommand(given.state, command, WAVE11_DEPS).ok).toBe(false);
  });

  it("an exhausted hero with no resource to spend cannot use the Hero Action", () => {
    const base = cleared(newGame());
    const s = patchInstance(place(base, OBJECT, villainOf(base)), hero(base), { exhausted: true });
    const art = idOf(s, OBJECT);
    for (const branch of [0, 1]) {
      const result = applyCommand(
        s,
        use(P1, art, "60122.impossible-object-action", [], undefined, { branch }),
        WAVE11_DEPS,
      );
      expect(result.ok, `branch ${branch}`).toBe(false);
    }
  });

  it("a Hero Action by the second player attaches it to their hero, not the first player's", () => {
    const base = cleared(newGame({ players: 2 }));
    const s = place(base, LANDSCAPE, villainOf(base));
    const art = idOf(s, LANDSCAPE);
    const done = drive(s, use(P2, art, "60125.stunning-landscape-action", [], undefined, { branch: 1 }));
    expect(inst(done, art).attachedTo).toBe(hero(done, P2));
    expect(statuses(done, hero(done, P2)).stunned).toBe(1);
    expect(statuses(done, hero(done, P1)).stunned).toBe(0);
    expect(inst(done, hero(done, P2)).exhausted).toBe(true);
    expect(inst(done, hero(done, P1)).exhausted).toBe(false);
  });

  it("60123.inspiring-pottery-constant: stalwart removes a stunned or confused status card from the character it attaches to", () => {
    const base = cleared(newGame());
    const s = patchInstance(place(base, POTTERY, villainOf(base)), hero(base), {
      statuses: { stunned: 1, confused: 1, tough: 0 },
    });
    const done = drive(s, use(P1, idOf(s, POTTERY), "60123.inspiring-pottery-action", [], undefined, { branch: 1 }));
    expect(inst(done, idOf(done, POTTERY)).attachedTo).toBe(hero(done));
    expect(statuses(done, hero(done))).toMatchObject({ stunned: 0, confused: 0 });
  });
});

describe("Art Museum Heist 60121b Forced Response (undefended attacks)", () => {
  const FR = "60121b.art-museum-heist-forced-response";
  /** Pottery (and Object) on P1's hero; P1 declines every defense. */
  const stolen = (on: readonly string[], pick: Picker = declines, minion = false, boosts = 1) => {
    let s = cleared(newGame());
    for (const code of on) s = place(s, code, hero(s));
    if (minion) s = engageMinion(s, ENFORCERS, P1).state;
    return villainPhase(s, boosts, [], pick).state;
  };

  it(`${FR}: after the villain's undefended attack on your hero, the Art attachment on it goes to the villain`, () => {
    const s = stolen([POTTERY]);
    expect(artOn(s, villainOf(s))).toEqual([POTTERY]);
    expect(artOn(s, hero(s))).toEqual([]);
  });

  it(`${FR}: only one Art attachment moves after one undefended attack, and the player picks which`, () => {
    for (const [wanted, left] of [
      [OBJECT, POTTERY],
      [POTTERY, OBJECT],
    ] as const) {
      const base = cleared(newGame());
      const picked = idOf(base, wanted);
      const s = stolen([OBJECT, POTTERY], picks(picked));
      expect(artOn(s, villainOf(s)), `picked ${wanted}`).toEqual([wanted]);
      expect(artOn(s, hero(s)), `picked ${wanted}`).toEqual([left]);
    }
  });

  it(`${FR}: a second undefended attack (an engaged minion's) moves a second one`, () => {
    const s = stolen([OBJECT, POTTERY], declines, true, 2);
    expect(artOn(s, hero(s))).toEqual([]);
    expect(artOn(s, villainOf(s))).toEqual([OBJECT, POTTERY]);
  });

  it(`${FR}: a defended attack steals nothing`, () => {
    const s = stolen([POTTERY], defendsFor(P1));
    expect(artOn(s, hero(s))).toEqual([POTTERY]);
    expect(artOn(s, villainOf(s))).toEqual([]);
  });

  it(`${FR}: with two players, the Art attachment on the identity that was attacked undefended goes, not the other's`, () => {
    // P1 defends, P2 does not: P2's attachment goes to the villain, P1's stays.
    let s = cleared(newGame({ players: 2 }));
    s = place(place(s, POTTERY, hero(s, P1)), SHIELD, hero(s, P2));
    s = patchInstance(s, villainOf(s), { statuses: { stunned: 0, confused: 0, tough: 0 } });
    const run = villainPhase(s, 2, [ENFORCERS, ENFORCERS], defendsFor(P1));
    expect(artOn(run.state, hero(run.state, P1))).toEqual([POTTERY]);
    expect(artOn(run.state, hero(run.state, P2))).toEqual([]);
    expect(artOn(run.state, villainOf(run.state))).toEqual([SHIELD]);
    // The other way round.
    const other = villainPhase(s, 2, [ENFORCERS, ENFORCERS], defendsFor(P2));
    expect(artOn(other.state, hero(other.state, P1))).toEqual([]);
    expect(artOn(other.state, hero(other.state, P2))).toEqual([SHIELD]);
    expect(artOn(other.state, villainOf(other.state))).toEqual([POTTERY]);
  });

  it(`${FR}: nothing to steal is no problem`, () => {
    const s = stolen([]);
    expect(artOn(s, villainOf(s))).toEqual([]);
  });

  it(`${FR}: the stolen piece gives its status card to the villain, as it attaches`, () => {
    const s = stolen([LANDSCAPE]);
    expect(artOn(s, villainOf(s))).toEqual([LANDSCAPE]);
    expect(statuses(s, villainOf(s)).stunned).toBe(1);
  });
});

describe("Art Thief 60126", () => {
  const WHEN = "60126.when-revealed";
  const BOOST = "60126.boost";
  const reveal = (s: GameState, pick: Picker = defending) => villainPhase(s, 1, [THIEF], pick);
  const thiefEngaged = (s: GameState) => engagedCopy(s, THIEF);

  it(`${WHEN}: attaches the Art attachment the revealing player picks from the encounter deck and discard pile`, () => {
    for (const wanted of [LANDSCAPE, SHIELD]) {
      const base = place(cleared(newGame()), LANDSCAPE, "discard");
      const run = reveal(base, picksOr(defending, idOf(base, wanted)));
      expect(artOn(run.state, villainOf(run.state)), wanted).toEqual([wanted]);
      const status = wanted === LANDSCAPE ? "stunned" : "tough";
      expect(statuses(run.state, villainOf(run.state))[status], `${wanted} gave its status card`).toBe(1);
      expect(thiefEngaged(run.state)).toBe(P1);
    }
  });

  it(`${WHEN}: finding one leaves the Art attachments on identities where they are`, () => {
    let s = place(cleared(newGame()), POTTERY, "deck");
    s = place(s, POTTERY, hero(s));
    const run = reveal(s, picksOr(defending, idOf(s, LANDSCAPE)));
    expect(artOn(run.state, hero(run.state))).toEqual([POTTERY]);
    expect(artOn(run.state, villainOf(run.state))).toEqual([LANDSCAPE]);
  });

  it(`${WHEN}: with none in the deck or discard, moves one from an identity to the villain (the player picks)`, () => {
    let s = cleared(newGame());
    s = place(place(s, POTTERY, hero(s)), SHIELD, hero(s));
    s = place(place(s, OBJECT, villainOf(s)), LANDSCAPE, villainOf(s));
    s = patchInstance(s, villainOf(s), { statuses: { stunned: 0, confused: 0, tough: 0 } });
    expect(
      deckCodes(s)
        .concat(discardCodes(s))
        .filter((c) => ARTS.includes(c)),
    ).toEqual([]);
    const run = reveal(s, picksOr(defending, idOf(s, SHIELD)));
    expect(artOn(run.state, hero(run.state))).toEqual([POTTERY]);
    expect(artOn(run.state, villainOf(run.state))).toEqual([OBJECT, SHIELD, LANDSCAPE]);
    expect(statuses(run.state, villainOf(run.state)).tough).toBe(1);
    expect(thiefEngaged(run.state)).toBe(P1);
  });

  it(`${WHEN}: with none anywhere to move, it only enters play`, () => {
    let s = cleared(newGame());
    for (const code of ARTS) s = place(s, code, villainOf(s));
    const run = reveal(s);
    expect(artOn(run.state, villainOf(run.state))).toEqual([...ARTS].sort());
    expect(thiefEngaged(run.state)).toBe(P1);
  });

  it(`${BOOST}: a boost card moves an Art attachment from an identity to the villain`, () => {
    let s = cleared(newGame());
    s = place(s, POTTERY, hero(s));
    // The hero defends, so the main scheme's own Forced Response cannot be what moves it.
    const stacked = stackEncounterDeck(s, THIEF, ENFORCERS);
    const run = driveEventsPicking(WAVE11_DEPS, stacked, defendsFor(P1), endTurn(P1));
    expect(artOn(run.state, villainOf(run.state))).toEqual([POTTERY]);
    expect(artOn(run.state, hero(run.state))).toEqual([]);
  });

  it(`${BOOST}: with no Art attachment on an identity it does nothing`, () => {
    const s = cleared(newGame());
    const stacked = stackEncounterDeck(s, THIEF, ENFORCERS);
    const run = driveEventsPicking(WAVE11_DEPS, stacked, defendsFor(P1), endTurn(P1));
    expect(artOn(run.state, villainOf(run.state))).toEqual([]);
  });
});

describe("Tug of War 60127", () => {
  const WHEN = "60127.when-revealed";
  /** Answers the spend prompt with these hand cards (none: declines it), everything else as `declines`. */
  const spends =
    (...ids: readonly InstanceId[]): Picker =>
    (s) =>
      s.pendingChoice!.prompt.kind === "spendResources" ? ids.map((i) => `hand:${i}`) : defending(s);
  const physical = (s: GameState, player: PlayerId, n = 3) => handWith(s, player, "physical", n);
  const withHand = (s: GameState, player: PlayerId, hand: readonly InstanceId[]): GameState => ({
    ...s,
    players: s.players.map((p) => (p.playerId === player ? { ...p, hand: [...hand] } : p)),
  });

  it(`${WHEN}: spending three physical resources moves an Art attachment from the villain to your identity, with no surge`, () => {
    const cl = cleared(newGame());
    const base = place(cl, POTTERY, villainOf(cl));
    const paid = physical(base, P1);
    expect(paid.ids).toHaveLength(3);
    const run = villainPhase(paid.state, 1, [TUG, ENFORCERS], spends(...paid.ids));
    expect(artOn(run.state, hero(run.state))).toEqual([POTTERY]);
    expect(artOn(run.state, villainOf(run.state))).toEqual([]);
    for (const id of paid.ids) expect(playerOf(run.state, P1).hand).not.toContain(id);
    // No surge: the next card was not revealed.
    expect(deckCodes(run.state)).toContain(ENFORCERS);
    expect(engagedCopy(run.state, ENFORCERS)).toBeNull();
  });

  it(`${WHEN}: the Art attachment it moves picks the status card of its new host (Replica Shield: tough on the hero)`, () => {
    const base = cleared(newGame());
    const placed = place(base, SHIELD, villainOf(base));
    const paid = physical(placed, P1);
    const run = villainPhase(paid.state, 1, [TUG, ENFORCERS], spends(...paid.ids));
    expect(artOn(run.state, hero(run.state))).toEqual([SHIELD]);
    expect(statuses(run.state, hero(run.state)).tough).toBe(1);
  });

  it(`${WHEN}: declining to spend moves an Art attachment from an identity to the villain, and the card gains surge`, () => {
    const base = cleared(newGame());
    const placed = place(base, OBJECT, hero(base));
    const withSome = place(placed, POTTERY, villainOf(base));
    const paid = physical(withSome, P1);
    const run = villainPhase(paid.state, 1, [TUG, ENFORCERS], spends());
    expect(artOn(run.state, villainOf(run.state))).toEqual([OBJECT, POTTERY]);
    expect(artOn(run.state, hero(run.state))).toEqual([]);
    for (const id of paid.ids) expect(playerOf(run.state, P1).hand).toContain(id);
    // Surge: the next card was revealed.
    expect(engagedCopy(run.state, ENFORCERS)).toBe(P1);
  });

  it(`${WHEN}: without three physical resources to spend there is no choice: the Otherwise happens`, () => {
    const base = cleared(newGame());
    const placed = place(place(base, OBJECT, hero(base)), POTTERY, villainOf(base));
    const poor = withHand(placed, P1, []);
    const run = villainPhase(poor, 1, [TUG, ENFORCERS], spends());
    expect(artOn(run.state, villainOf(run.state))).toEqual([OBJECT, POTTERY]);
    expect(engagedCopy(run.state, ENFORCERS)).toBe(P1);
  });

  it(`${WHEN}: with no Art attachment on the villain there is nothing to buy: the Otherwise happens`, () => {
    const base = cleared(newGame());
    const placed = place(base, OBJECT, hero(base));
    const paid = physical(placed, P1);
    // Offered no spend (a spend would have taken the three cards); the attachment goes to the villain.
    const run = villainPhase(paid.state, 1, [TUG, ENFORCERS], spends(...paid.ids));
    expect(artOn(run.state, villainOf(run.state))).toEqual([OBJECT]);
    for (const id of paid.ids) expect(playerOf(run.state, P1).hand).toContain(id);
    expect(engagedCopy(run.state, ENFORCERS)).toBe(P1);
  });

  it(`${WHEN}: "you" is the player it is dealt to: the second player pays and receives the attachment`, () => {
    const base = cleared(newGame({ players: 2 }));
    const placed = place(base, POTTERY, villainOf(base));
    const paid = physical(placed, P2);
    expect(paid.ids).toHaveLength(3);
    const run = villainPhase(paid.state, 2, [ENFORCERS, TUG], spends(...paid.ids));
    expect(artOn(run.state, hero(run.state, P2))).toEqual([POTTERY]);
    expect(artOn(run.state, hero(run.state, P1))).toEqual([]);
    for (const id of paid.ids) expect(playerOf(run.state, P2).hand).not.toContain(id);
  });
});

/** Records who is asked each choice that offers one of these Art attachment ids. */
function recording(ids: readonly string[], inner: Picker): { pick: Picker; askedOf: PlayerId[] } {
  const askedOf: PlayerId[] = [];
  const pick: Picker = (st) => {
    const choice = st.pendingChoice!;
    if (choice.options.some((o) => ids.includes(o.optionId as string))) askedOf.push(choice.playerId);
    return inner(st);
  };
  return { pick, askedOf };
}

describe('the first player makes the Art attachment choices (RRG 1.8 "First Player", p. 19)', () => {
  it("60121b.art-museum-heist-forced-response: P2 is attacked undefended, P1 chooses which of P2's pieces moves", () => {
    let s = cleared(newGame({ players: 2 }));
    s = place(place(s, OBJECT, hero(s, P2)), POTTERY, hero(s, P2));
    const { pick, askedOf } = recording([idOf(s, OBJECT), idOf(s, POTTERY)], picksOr(defendsFor(P1), idOf(s, POTTERY)));
    const run = villainPhase(s, 2, [ENFORCERS, ENFORCERS], pick);
    expect(askedOf).toEqual([P1]);
    expect(artOn(run.state, villainOf(run.state))).toEqual([POTTERY]);
    expect(artOn(run.state, hero(run.state, P2))).toEqual([OBJECT]);
  });

  it("60126.when-revealed: dealt to P2, P1 picks the piece from the encounter deck", () => {
    const s = place(cleared(newGame({ players: 2 })), LANDSCAPE, "discard");
    const ids = ARTS.map((c) => idOf(s, c));
    const { pick, askedOf } = recording(ids, picksOr(defending, idOf(s, LANDSCAPE)));
    const run = villainPhase(s, 2, [ENFORCERS, THIEF], pick);
    expect(askedOf).toEqual([P1]);
    expect(artOn(run.state, villainOf(run.state))).toEqual([LANDSCAPE]);
  });

  it("60127.when-revealed: P2 decides to spend, P1 picks which piece P2 takes", () => {
    let s = cleared(newGame({ players: 2 }));
    s = place(place(s, POTTERY, villainOf(s)), OBJECT, villainOf(s));
    const paid = handWith(s, P2, "physical", 3);
    const spendAll: Picker = (st) =>
      st.pendingChoice!.prompt.kind === "spendResources" ? paid.ids.map((i) => `hand:${i}`) : defending(st);
    const { pick, askedOf } = recording([idOf(s, POTTERY), idOf(s, OBJECT)], picksOr(spendAll, idOf(s, POTTERY)));
    const run = villainPhase(paid.state, 2, [ENFORCERS, TUG], pick);
    expect(askedOf).toEqual([P1]);
    expect(artOn(run.state, hero(run.state, P2))).toEqual([POTTERY]);
    expect(artOn(run.state, villainOf(run.state))).toEqual([OBJECT]);
  });
});

describe("60121a.setup: the piece placed at setup is a card attaching to the villain", () => {
  const GIVEN: Record<string, "confused" | "tough" | "stunned" | null> = {
    [OBJECT]: "confused",
    [SHIELD]: "tough",
    [LANDSCAPE]: "stunned",
    [POTTERY]: null,
  };
  it("its own Forced Response fires: the villain starts the first player phase with that status card", () => {
    const seen = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      const s = newGame({ seed });
      const [code] = artOn(s, villainOf(s));
      seen.add(code!);
      const status = GIVEN[code!];
      const got = statuses(s, villainOf(s));
      expect(got.stunned, `seed ${seed} ${code}`).toBe(status === "stunned" ? 1 : 0);
      expect(got.confused, `seed ${seed} ${code}`).toBe(status === "confused" ? 1 : 0);
      expect(got.tough, `seed ${seed} ${code}`).toBe(status === "tough" ? 1 : 0);
    }
    expect(seen.size).toBeGreaterThan(2);
  });
});

describe("Art attachment edge cases", () => {
  it("60125.stunning-landscape-forced-response: Inspiring Pottery on the villain (stalwart) blocks the stun", () => {
    const base = cleared(newGame());
    const s = place(base, POTTERY, villainOf(base));
    const run = villainPhase(s, 1, [LANDSCAPE, ENFORCERS]);
    expect(artOn(run.state, villainOf(run.state))).toEqual([POTTERY, LANDSCAPE]);
    expect(statuses(run.state, villainOf(run.state)).stunned).toBe(0);
  });

  it("60122.impossible-object-action: P2 cannot use it on a piece attached to P1's hero", () => {
    const base = cleared(newGame({ players: 2 }));
    const s = place(base, OBJECT, hero(base, P1));
    const command = use(P2, idOf(s, OBJECT), "60122.impossible-object-action", [], undefined, { branch: 1 });
    expect(applyCommand(s, command, WAVE11_DEPS).ok).toBe(false);
  });

  it("60127.when-revealed: with no Art attachment on any identity or the villain, the Otherwise still gives surge", () => {
    const s = cleared(newGame());
    const run = villainPhase(s, 1, [TUG, ENFORCERS]);
    expect(engagedCopy(run.state, ENFORCERS)).toBe(P1);
  });
});
