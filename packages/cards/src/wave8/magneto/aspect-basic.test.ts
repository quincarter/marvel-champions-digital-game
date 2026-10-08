import {
  CYCLOPS_CARDS,
  MAGNETO_CARDS,
  MAGNETO_STARTER_DECKS,
  WAVE7_CARDS,
  cardId,
  type AnyCard,
  type DeckContents,
} from "@mc/content";
import {
  activeEncounterDeck,
  activeEncounterDeckId,
  applyCommand,
  cardsInPlay,
  characterProfile,
  createGame,
  traitsOf,
  validateDeck,
  type Command,
  type EngineDeps,
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
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  play,
  playerOf,
  settle,
  stackEncounterDeck,
  runWith,
  use,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, withDamage, withForm } from "../../testing/staging.js";
import { wave1Scenario } from "../../wave1/setup.js";
import { WAVE7_ABILITIES, wave7StarterDeckSetup } from "../../wave7/index.js";
import { MAGNETO_ASPECT_BASIC, MAGNETO_ASPECT_BASIC_SKIPPED } from "./aspect-basic.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Magneto pack aspect and basic cards (49012 to 49026, 49033 to 49037), docs/phase7-wave8.md §7.5, §3.78, §3.81.
 * Magneto's real `magneto-leadership` starter deck against Rhino through `createGame` (the engine given this module's
 * registry on top of every earlier wave). His kit is another module and is not scripted here, so the abilities of his
 * own cards (Magnetic Pull and the rest) are inert. Cards that work from any deck are also played from a Core hero's
 * seat: Spider-Man (Justice precon) or Captain Marvel (Leadership precon), the cards added to the deck illegally
 * (`requireLegalDecks: false`).
 */
const KID_OMEGA = "49013.kid-omega-response";
const PHOENIX = "49014.phoenix-response";
const CYCLOPS = "49015.cyclops-response";
const WSD_CONSTANT = "49016.wont-stay-down-constant";
const WSD_ACTION = "49016.wont-stay-down-action";
const SQUARED = "49017.squared-off-action";
const NOBLE = "49018.noble-sacrifice-action";
const GOT_THIS = "49019.you-got-this-response";
const RECRUITS = "49020.when-defeated";
const QUEEN_CONSTANT = "49021.white-queen-constant";
const QUEEN_RESPONSE = "49021.white-queen-response";
const FACE = "49022.face-the-past-action";
const DEFT = "49023.deft-focus-action";
const SURGE = "49033.surge-constant";
const ANOLE = "49034.anole-constant";
const BLING = "49035.bling-constant";
const INDRA = "49036.indra-constant";
const ATOM = "49037.children-of-the-atom-constant";
const M_REF = "49012.m-response";
const ALL_REFS = [
  M_REF,
  KID_OMEGA,
  PHOENIX,
  CYCLOPS,
  WSD_CONSTANT,
  WSD_ACTION,
  SQUARED,
  NOBLE,
  GOT_THIS,
  RECRUITS,
  QUEEN_CONSTANT,
  QUEEN_RESPONSE,
  FACE,
  DEFT,
  SURGE,
  ANOLE,
  BLING,
  INDRA,
  ATOM,
];

const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE7_ABILITIES, MAGNETO_ASPECT_BASIC) };
const POOL: readonly AnyCard[] = [
  ...WAVE7_CARDS,
  ...MAGNETO_CARDS,
  ...CYCLOPS_CARDS.filter((c) => !WAVE7_CARDS.some((w) => w.id === c.id)),
];
const BY_ID = new Map(POOL.map((c) => [c.id as string, c]));

const PRECON = MAGNETO_STARTER_DECKS.find((d) => d.id === "magneto-leadership")!;
const PRECON_DECK = PRECON.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId));
const NEW_ALLIES = ["49033", "49034", "49035", "49036"];

// Encounter cards used as stacked top cards (Core, Rhino unless noted).
const ADVANCE = "01186"; // 0 icons, Standard: the villain schemes
const MELTER = "01132"; // Masters of Evil: minion ATK 3, 5 hit points, 0 icons, no Guard
const MERCENARY = "01101"; // Rhino: minion ATK 1, 3 hit points, 1 icon, Guard
const SANDMAN = "01102"; // Rhino: ELITE minion ATK 3, 4 hit points, 2 icons, Toughness
const BREAKIN = "01107"; // Rhino: side scheme, 2 icons
const CROWD_CONTROL = "01108"; // Rhino: side scheme, 2 icons
const EXODUS = "49028"; // Magneto's nemesis minion (steady, toughness, villainous)

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const encounterDiscard = (s: GameState): string[] => activeEncounterDeck(s).discard.map((id) => codeOf(s, id));
const inPlay = (s: GameState, code: string): InstanceId[] => cardsInPlay(s).filter((id) => codeOf(s, id) === code);
const setAsideCodes = (s: GameState): string[] => s.encounterSetAside.map((id) => codeOf(s, id)).sort();
const accepted = (s: GameState, c: Command, deps: EngineDeps = DEPS): boolean => applyCommand(s, c, deps).ok;
/** Why the engine refused a command ("" if it did not). */
const refusal = (s: GameState, c: Command, deps: EngineDeps = DEPS): string => {
  const r = applyCommand(s, c, deps);
  return r.ok ? "" : r.error.message;
};
const profile = (s: GameState, id: InstanceId, deps: EngineDeps = DEPS) => characterProfile(s, id, deps)!;
const handCodes = (s: GameState, p: PlayerId = P1): string[] => playerOf(s, p).hand.map((id) => codeOf(s, id));
const typeOf = (s: GameState, id: InstanceId): string => (BY_ID.get(codeOf(s, id)) as { type: string }).type;

type Seat = { readonly kind: "mg" | "sm" | "cm" | "x23"; readonly extra: readonly string[] };
/** Magneto's Leadership precon (hero form: THW 2, ATK 2, DEF 2, 10 hit points). */
const MG = (...extra: string[]): Seat => ({ kind: "mg", extra });
/** Spider-Man (Justice precon): no X-MEN or MUTANT trait. */
const SM = (...extra: string[]): Seat => ({ kind: "sm", extra });
/** Captain Marvel (Leadership precon): a Core Leadership seat, so Leadership cards are legal in her deck. */
const CM = (...extra: string[]): Seat => ({ kind: "cm", extra });

/** X-23 (Aggression precon): an X-FORCE identity, so "X-Force or X-Men" cards play from her seat. */
const X23 = (...extra: string[]): Seat => ({ kind: "x23", extra });

const CORE_DECK = { sm: "core-spider-man-justice", cm: "core-captain-marvel-leadership" } as const;

/**
 * The seats against Rhino, through setup, in whatever form setup leaves. `legal: false` seats decks holding cards off
 * their aspect or an extra copy, which `createGame` otherwise refuses. Masters of Evil joins as the modular set (minions
 * with 0 icons).
 */
function setupGame(seats: readonly Seat[] = [MG()], seed = 1, legal = true): GameState {
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed,
    difficulty: "standard",
    modularSetIds: ["masters_of_evil", "legions_of_hydra"],
    cardPool: POOL,
  });
  const players = seats.map((seat) => {
    const x23 = seat.kind === "x23" ? wave7StarterDeckSetup("x-23-aggression") : undefined;
    const base =
      seat.kind === "mg"
        ? { identityCardId: PRECON.identityCardId, aspects: PRECON.aspects, deck: PRECON_DECK }
        : x23
          ? {
              identityCardId: x23.identityCardId,
              ...(x23.aspects ? { aspects: x23.aspects } : {}),
              deck: x23.deck.map((c) => cardId(c as string)),
            }
          : coreScenario("rhino", {
              players: [{ starterDeckId: CORE_DECK[seat.kind as "sm" | "cm"] }],
              seed,
              modularSetIds: [],
            }).players[0]!;
    return { ...base, deck: [...base.deck, ...seat.extra.map((code) => cardId(code))] };
  });
  const created = createGame({ ...config, players, requireLegalDecks: legal }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}
/** Hero form for these seats (setup leaves everyone in alter-ego form). */
const heroGame = (seats: readonly Seat[] = [MG()], seed = 1, legal = true): GameState =>
  seats.reduce<GameState>(
    (s, _seat, i) => withForm(s, { heroForm: 0 }, i === 0 ? P1 : P2),
    setupGame(seats, seed, legal),
  );

const iconsOf = (s: GameState, id: InstanceId): number => {
  const card = BY_ID.get(codeOf(s, id)) as {
    resourceIcons?: Record<string, number>;
    producesIcons?: Record<string, number>;
  };
  return Object.values(card.resourceIcons ?? card.producesIcons ?? {}).reduce((a, b) => a + b, 0);
};
/** Moves a player's hand to the bottom of the deck, then these cards (and `fillers` pay cards) into the hand. */
function stage(
  state: GameState,
  codes: readonly string[],
  fillers = 5,
  p: PlayerId = P1,
): { readonly state: GameState; readonly ids: readonly InstanceId[]; readonly fill: readonly InstanceId[] } {
  // Linked allies already taken into the hand stay there: they are not part of the deck and must not go back into it.
  const linked = (s: GameState, id: InstanceId): boolean => NEW_ALLIES.includes(codeOf(s, id));
  const cleared: GameState = {
    ...state,
    players: state.players.map((pl) =>
      pl.playerId === p
        ? {
            ...pl,
            deck: [...pl.deck, ...pl.hand.filter((id) => !linked(state, id))],
            hand: pl.hand.filter((id) => linked(state, id)),
          }
        : pl,
    ),
  };
  const given = moveToHand(cleared, p, ...codes);
  const fill = playerOf(given.state, p)
    .deck.filter(
      (id) =>
        iconsOf(given.state, id) > 0 &&
        typeOf(given.state, id) !== "hero_identity" &&
        !NEW_ALLIES.includes(codeOf(given.state, id)),
    )
    .filter(
      (id) => typeOf(given.state, id) !== "resource" || !["49024", "49025", "49026"].includes(codeOf(given.state, id)),
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

// ---------------------------------------------------------------------------
// Pickers: a rule answers the prompt it understands, anything else is declined like `firstLegal`.
// ---------------------------------------------------------------------------
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
/** Chooses the option of a `chooseOption` prompt whose label contains `text`. */
const option =
  (text: string): Rule =>
  (s) => {
    const choice = s.pendingChoice;
    if (choice?.prompt.kind !== "chooseOption") return undefined;
    const hit = choice.options.find((o) => o.label.includes(text));
    return hit ? [hit.optionId] : undefined;
  };
/** Spends the hand cards (by instance id) at a `spendResources` prompt. */
const spendCards =
  (...ids: readonly string[]): Rule =>
  (s) => {
    const choice = s.pendingChoice;
    if (choice?.prompt.kind !== "spendResources") return undefined;
    const hits = ids.map((id) => `hand:${id}`).filter((id) => choice.options.some((o) => o.optionId === id));
    return hits.length > 0 ? hits : undefined;
  };
/** Declares the first character offered as the defender (an attack must be defended when only one can). */
const defendWithAnyone: Rule = (s) => {
  const choice = s.pendingChoice;
  if (choice?.prompt.kind !== "declareDefender") return undefined;
  const hit = choice.options.find((o) => o.optionId !== "decline");
  return hit ? [hit.optionId] : undefined;
};
/** Every prompt kind and option list the picker saw, for tests that assert what was offered. */
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

/** Plays `code` from the staged hand paying `cost` with pay cards (resource cards first), none of them in `except`. */
function playStaged(
  s: GameState,
  code: string,
  cost: number,
  o: {
    pick?: Picker;
    p?: PlayerId;
    except?: readonly InstanceId[];
    pay?: readonly InstanceId[];
    deps?: EngineDeps;
    costChoices?: Record<string, readonly InstanceId[]>;
    attach?: InstanceId;
  } = {},
): { readonly state: GameState; readonly id: InstanceId; readonly events: readonly unknown[] } {
  const p = o.p ?? P1;
  const given = moveToHand(s, p, code);
  const id = given.ids[0]!;
  const payers =
    o.pay ??
    playerOf(given.state, p)
      .hand.filter(
        (h) =>
          h !== id &&
          !(o.except ?? []).includes(h) &&
          !NEW_ALLIES.includes(codeOf(given.state, h)) &&
          iconsOf(given.state, h) > 0,
      )
      .slice(0, cost);
  if (payers.length < cost) throw new Error(`not enough resource cards to pay ${cost} for ${code}`);
  const { state, events } = driveEventsPicking(
    o.deps ?? DEPS,
    given.state,
    o.pick ?? firstLegal,
    play(p, id, payers, {
      ...(o.costChoices ? { costChoices: o.costChoices } : {}),
      ...(o.attach ? { attachToInstanceId: o.attach } : {}),
    }),
  );
  return { state, id, events };
}

/**
 * Surgery: a minion from the encounter deck into this player's play area, engaged and faceup, as if it had been put
 * into play.
 */
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

/** Plays these allies from the hand (their costs paid by pay cards), declining every Response. Returns each id. */
function allies(s0: GameState, codes: readonly string[], p: PlayerId = P1): { state: GameState; ids: InstanceId[] } {
  let state = s0;
  const ids: InstanceId[] = [];
  for (const code of codes) {
    const cost = (BY_ID.get(code) as { cost: number }).cost;
    const staged = stage(state, [code], 5, p);
    const played = playStaged(staged.state, code, cost, { p, except: staged.ids });
    state = played.state;
    ids.push(played.id);
  }
  return { state, ids };
}

describe("aspect-basic registry", () => {
  it.each(ALL_REFS)("%s validates", (id) => {
    expect(validateDefinition(MAGNETO_ASPECT_BASIC[id]!)).toEqual([]);
  });
  it("holds exactly these refs, M's and \"You Got This!\"'s included; nothing is skipped", () => {
    expect(Object.keys(MAGNETO_ASPECT_BASIC).sort()).toEqual([...ALL_REFS].sort());
    expect(Object.keys(MAGNETO_ASPECT_BASIC_SKIPPED)).toEqual([]);
  });
  it("every ability ref the 20 cards name is registered or skipped, none twice", () => {
    const ids = [
      "49012",
      "49013",
      "49014",
      "49015",
      "49016",
      "49017",
      "49018",
      "49019",
      "49020",
      "49021",
      "49022",
      "49023",
      "49024",
      "49025",
      "49026",
      "49033",
      "49034",
      "49035",
      "49036",
      "49037",
    ];
    const named = ids.flatMap((id) =>
      ((BY_ID.get(id) as unknown as { abilities: { id: string }[] }).abilities ?? []).map((a) => a.id as string),
    );
    expect(named.sort()).toEqual([...ALL_REFS].sort());
  });
  it("Deft Focus (49023) is the very definition of the card it reprints, gmw 16024 (one script, two ids)", () => {
    expect(MAGNETO_ASPECT_BASIC[DEFT]).toBe(WAVE7_ABILITIES["16024.deft-focus-action"]);
  });
  it("Energy, Genius and Strength (49024 to 49026) print no ability; each is 2 resources of its type", () => {
    for (const [code, icon] of [
      ["49024", "energy"],
      ["49025", "mental"],
      ["49026", "physical"],
    ] as const) {
      const card = BY_ID.get(code) as unknown as { abilities: unknown[]; producesIcons: Record<string, number> };
      expect(card.abilities).toEqual([]);
      expect(card.producesIcons).toEqual({ [icon]: 2 });
    }
  });
  it("the data the scripts rest on: costs, stats, traits and keywords of the allies", () => {
    const row = (code: string) => {
      const c = BY_ID.get(code) as unknown as Record<string, unknown>;
      return {
        cost: c["cost"],
        thw: c["thw"],
        atk: c["atk"],
        hp: c["hp"],
        traits: (c["traits"] as string[]).map(String),
        keywords: (c["keywords"] as { name: string }[]).map((k) => k.name),
      };
    };
    expect(row("49012")).toEqual({ cost: 4, thw: 2, atk: 3, hp: 4, traits: ["PSIONIC", "X-MEN"], keywords: [] });
    expect(row("49013")).toEqual({ cost: 2, thw: 2, atk: 2, hp: 2, traits: ["PSIONIC", "X-MEN"], keywords: [] });
    expect(row("49014")).toEqual({ cost: 3, thw: 2, atk: 1, hp: 3, traits: ["PSIONIC", "X-MEN"], keywords: [] });
    expect(row("49015")).toEqual({ cost: 3, thw: 2, atk: 2, hp: 2, traits: ["X-MEN"], keywords: [] });
    expect(row("49021")).toEqual({ cost: 3, thw: 2, atk: 1, hp: 3, traits: ["PSIONIC", "X-MEN"], keywords: [] });
    for (const code of NEW_ALLIES) {
      expect(row(code)).toEqual({ cost: 2, thw: 2, atk: 2, hp: 2, traits: ["NEW", "X-MEN"], keywords: ["linked"] });
    }
  });
});

// ---------------------------------------------------------------------------
// M (49012)
// ---------------------------------------------------------------------------
describe("M (49012): after she enters play, defeat a minion with fewer remaining hit points than she has", () => {
  const cast = (damageOnMinion: number, code = MERCENARY, seat: Seat = MG()) => {
    const hero = heroGame([seat]);
    const staged = stage(hero, ["49012"]);
    const eng = engage(staged.state, code);
    const hurt = withDamage(eng.state, eng.id, damageOnMinion);
    const probe = spy(picker(accept(M_REF), take(eng.id)));
    const played = playStaged(hurt, "49012", 4, { except: staged.ids, pick: probe.pick });
    return { ...played, minion: eng.id, seen: probe.seen, before: hurt };
  };

  it("declined, she is a plain ally: THW 2, ATK 3, 4 hit points, cost 4 paid, the minion untouched", () => {
    const hero = heroGame();
    const staged = stage(hero, ["49012"]);
    const eng = engage(staged.state, MERCENARY);
    const probe = spy(picker());
    const { state, id } = playStaged(eng.state, "49012", 4, { except: staged.ids, pick: probe.pick });
    expect(offered(probe.seen, M_REF)).toBe(true);
    expect(playerOf(state, P1).playArea).toContain(id);
    expect(profile(state, id)).toMatchObject({ thw: 2, atk: 3, maxHp: 4 });
    expect(inst(state, eng.id).damage).toBe(0);
    expect(playerOf(state, P1).playArea).toContain(eng.id);
  });
  it("a 3-hit-point minion (fewer than her 4) is defeated after she enters play", () => {
    const { state, minion } = cast(0);
    expect(playerOf(state, P1).playArea).not.toContain(minion);
    expect(encounterDiscard(state)).toContain(MERCENARY);
  });
  it("Sandman, 4 hit points (not fewer), is no target and the Response is not offered; with 1 damage he is, and falls", () => {
    const survives = cast(0, SANDMAN);
    expect(offered(survives.seen, M_REF)).toBe(false);
    expect(playerOf(survives.state, P1).playArea).toContain(survives.minion);
    const damaged = cast(1, SANDMAN);
    expect(offered(damaged.seen, M_REF)).toBe(true);
    expect(playerOf(damaged.state, P1).playArea).not.toContain(damaged.minion);
  });
  it("only the minions the comparison allows are offered: a Mercenary (3) beside a Sandman (4)", () => {
    const hero = heroGame();
    const staged = stage(hero, ["49012"]);
    const merc = engage(staged.state, MERCENARY);
    const sand = engage(merc.state, SANDMAN);
    const probe = spy(picker(accept(M_REF), take(sand.id, merc.id)));
    const { state } = playStaged(sand.state, "49012", 4, { except: staged.ids, pick: probe.pick });
    const asked = probe.seen.filter((p) => p.kind === "chooseTarget");
    for (const prompt of asked) expect(prompt.options).not.toContain(sand.id);
    expect(playerOf(state, P1).playArea).toContain(sand.id);
    expect(playerOf(state, P1).playArea).not.toContain(merc.id);
  });
  it("the defeat is not damage, so a tough status card does not stop it (Sandman, 1 damage taken, tough card on him)", () => {
    const hero = heroGame();
    const staged = stage(hero, ["49012"]);
    const eng = engage(staged.state, SANDMAN);
    const armored = patchInstance(withDamage(eng.state, eng.id, 1), eng.id, {
      statuses: { ...inst(eng.state, eng.id).statuses, tough: 1 },
    });
    const { state } = playStaged(armored, "49012", 4, {
      except: staged.ids,
      pick: picker(accept(M_REF), take(eng.id)),
    });
    expect(playerOf(state, P1).playArea).not.toContain(eng.id);
    expect(encounterDiscard(state)).toContain(SANDMAN);
  });
  it("from Captain Marvel's seat: the same, cost 4 paid", () => {
    const { state, minion, id } = cast(0, MERCENARY, CM("49012"));
    expect(playerOf(state, P1).playArea).toContain(id);
    expect(playerOf(state, P1).playArea).not.toContain(minion);
  });
});

// ---------------------------------------------------------------------------
// Kid Omega (49013)
// ---------------------------------------------------------------------------
describe("Kid Omega (49013): spend an energy resource for 1 damage to each enemy, or a mental for 1 threat from each scheme", () => {
  /** Kid Omega, an energy, a mental and a physical resource card staged; Mercenary engaged and Break-In (2 threat) in play. */
  function omega(seat: Seat = MG(), legal = true) {
    const hero = heroGame([seat], 1, legal);
    const staged = stage(hero, ["49013", "49024", "49025", "49026"]);
    const eng = engage(staged.state, MERCENARY);
    const scheme = patchInstance(eng.state, eng.state.mainScheme.instanceId, { threat: 6 });
    const [kid, energy, mental, physical] = staged.ids as [InstanceId, InstanceId, InstanceId, InstanceId];
    return { state: scheme, kid, energy, mental, physical, fill: staged.fill, mercenary: eng.id };
  }
  const cast = (o: ReturnType<typeof omega>, rules: readonly Rule[]) => {
    const probe = spy(picker(...rules));
    const played = playStaged(o.state, "49013", 2, { pay: o.fill.slice(0, 2), pick: probe.pick });
    return { ...played, seen: probe.seen };
  };

  it("cost 2: she enters play, THW 2 ATK 2 with 2 hit points; offered both bullets when both resources are in hand", () => {
    const o = omega();
    const { state, seen, id } = cast(o, [accept(KID_OMEGA)]);
    expect(playerOf(state, P1).playArea).toContain(id);
    expect(profile(state, id)).toMatchObject({ thw: 2, atk: 2, maxHp: 2 });
    const ask = seen.find((p) => p.kind === "chooseOption")!;
    expect(ask.options).toHaveLength(2);
  });
  it("energy bullet: the energy card is spent and 1 damage is dealt to Rhino and to the engaged minion", () => {
    const o = omega();
    const rhino = o.state.activeVillainId!;
    const { state } = cast(o, [accept(KID_OMEGA), option("energy"), spendCards(o.energy)]);
    expect(playerOf(state, P1).discard).toContain(o.energy);
    expect(playerOf(state, P1).hand).not.toContain(o.energy);
    expect(inst(state, rhino).damage).toBe(1);
    expect(inst(state, o.mercenary).damage).toBe(1);
    expect(inst(state, state.mainScheme.instanceId).threat).toBe(6);
  });
  it("the damage is not an attack: Mercenary's (not Guard-sensitive) 3 hit points take exactly 1, nobody else is hurt", () => {
    const o = omega();
    const { state } = cast(o, [accept(KID_OMEGA), option("energy"), spendCards(o.energy)]);
    expect(inst(state, identityOf(state)).damage).toBe(0);
    expect(inst(state, o.kid).damage).toBe(0);
  });
  it("mental bullet: the mental card is spent and 1 threat leaves each scheme (main scheme 6 to 5, a side scheme 3 to 2)", () => {
    const o = omega();
    const side = patchInstance(o.state, o.state.mainScheme.instanceId, { threat: 6 });
    const withSide = (() => {
      const pile = activeEncounterDeck(side);
      const id = pile.deck.find((i) => codeOf(side, i) === BREAKIN)!;
      return {
        id,
        state: {
          ...side,
          encounterDecks: {
            ...side.encounterDecks,
            [activeEncounterDeckId(side)]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard },
          },
          villainArea: [...side.villainArea, id],
          instances: { ...side.instances, [id]: { ...side.instances[id]!, faceup: true, threat: 3 } },
        },
      };
    })();
    const { state } = cast({ ...o, state: withSide.state }, [
      accept(KID_OMEGA),
      option("mental"),
      spendCards(o.mental),
    ]);
    expect(playerOf(state, P1).discard).toContain(o.mental);
    expect(inst(state, state.mainScheme.instanceId).threat).toBe(5);
    expect(inst(state, withSide.id).threat).toBe(2);
    expect(inst(state, state.activeVillainId!).damage).toBe(0);
  });
  it("declined: nothing is spent, no damage, no threat removed", () => {
    const o = omega();
    const { state } = cast(o, []);
    expect(playerOf(state, P1).hand).toEqual(expect.arrayContaining([o.energy, o.mental, o.physical]));
    expect(inst(state, state.activeVillainId!).damage).toBe(0);
    expect(inst(state, state.mainScheme.instanceId).threat).toBe(6);
  });
  it("from Captain Marvel's seat (a Core Leadership seat): the energy bullet works the same", () => {
    const o = omega(CM("49013", "49024", "49025", "49026"), false);
    const rhino = o.state.activeVillainId!;
    const probe = spy(picker(accept(KID_OMEGA), option("energy"), spendCards(o.energy)));
    const { state } = playStaged(o.state, "49013", 2, { pay: o.fill.slice(0, 2), pick: probe.pick });
    expect(inst(state, rhino).damage).toBe(1);
    expect(playerOf(state, P1).discard).toContain(o.energy);
  });
});

/** Pays the first offered `payForCard` card, skipping those in `except` (a Response event's printed cost). */
const payOne =
  (except: readonly string[] = []): Rule =>
  (s) =>
    s.pendingChoice?.prompt.kind === "payForCard"
      ? s.pendingChoice.options
          .map((o) => o.optionId)
          .filter((o) => !except.includes(o))
          .slice(0, 1)
      : undefined;
/** Spends one hand card (not in `except`) at a `spendResources` prompt, the way an effect that plays a card for less asks. */
const spendOne =
  (except: readonly string[] = []): Rule =>
  (s) =>
    s.pendingChoice?.prompt.kind === "spendResources"
      ? s.pendingChoice.options
          .map((o) => o.optionId)
          .filter((o) => !except.includes(o.replace(/^hand:/, "")))
          .slice(0, 1)
      : undefined;
const basicAttack = (
  s: GameState,
  target: InstanceId,
  attacker: InstanceId = identityOf(s),
  p: PlayerId = P1,
): Command => ({
  type: "basicAttack",
  playerId: p,
  attackerInstanceId: attacker,
  targetInstanceId: target,
});
const basicThwart = (
  s: GameState,
  scheme: InstanceId,
  thwarter: InstanceId = identityOf(s),
  p: PlayerId = P1,
): Command => ({
  type: "basicThwart",
  playerId: p,
  thwarterInstanceId: thwarter,
  schemeInstanceId: scheme,
});
const ready = (s: GameState, id: InstanceId): GameState => patchInstance(s, id, { exhausted: false });
const mainOf = (s: GameState): InstanceId => s.mainScheme.instanceId;

// ---------------------------------------------------------------------------
// Phoenix (49014)
// ---------------------------------------------------------------------------
describe("Phoenix (49014): ready an X-MEN ally and heal 1 from it", () => {
  /** Kid Omega (X-MEN) in play, exhausted and damaged by 1, then Phoenix staged. */
  function phoenix(seat: Seat = MG()) {
    const base = allies(heroGame([seat]), ["49013"]);
    const kid = base.ids[0]!;
    const hurt = patchInstance(base.state, kid, { exhausted: true, damage: 1 });
    const staged = stage(hurt, ["49014"]);
    return { staged, kid };
  }
  it("cost 3: Kid Omega (exhausted, 1 damage) is readied and healed; Phoenix is THW 2, ATK 1 with 3 hit points", () => {
    const { staged, kid } = phoenix();
    const { state, id } = playStaged(staged.state, "49014", 3, {
      except: staged.ids,
      pick: picker(accept(PHOENIX), take(kid)),
    });
    expect(inst(state, kid)).toMatchObject({ exhausted: false, damage: 0 });
    expect(profile(state, id)).toMatchObject({ thw: 2, atk: 1, maxHp: 3 });
  });
  it("declined: Kid Omega stays exhausted with 1 damage", () => {
    const { staged, kid } = phoenix();
    const { state } = playStaged(staged.state, "49014", 3, { except: staged.ids });
    expect(inst(state, kid)).toMatchObject({ exhausted: true, damage: 1 });
  });
  it("she can choose herself, and the other X-MEN ally is untouched", () => {
    const { staged, kid } = phoenix();
    const seen = spy(picker(accept(PHOENIX)));
    const { state, id } = playStaged(staged.state, "49014", 3, { except: staged.ids, pick: seen.pick });
    const ask = seen.seen.find((p) => p.kind === "chooseTarget")!;
    expect(ask.options).toEqual(expect.arrayContaining([kid, id]));
    expect(inst(state, kid)).toMatchObject({ exhausted: false, damage: 0 });
  });
  it("only X-MEN allies are offered: Maria Hill (S.H.I.E.L.D.) is not among the choices", () => {
    const hero = heroGame([MG("01067")], 1, false);
    const hill = allies(hero, ["01067"]);
    const staged = stage(hill.state, ["49014"]);
    const probe = spy(picker(accept(PHOENIX)));
    const { id } = playStaged(staged.state, "49014", 3, { except: staged.ids, pick: probe.pick });
    const ask = probe.seen.find((p) => p.kind === "chooseTarget")!;
    expect(ask.options).toEqual([id]);
  });
  it("another player's X-MEN ally can be chosen: Captain Marvel's seat plays Phoenix and heals Magneto's Kid Omega", () => {
    const base = allies(heroGame([MG(), CM("49014")]), ["49013"]);
    const kid = base.ids[0]!;
    const hurt = patchInstance(base.state, kid, { exhausted: true, damage: 1 });
    const turn2 = runWith(DEPS, hurt, endTurn(P1));
    expect(turn2.step).toMatchObject({ activePlayerId: P2 });
    const staged = stage(turn2, ["49014"], 5, P2);
    const { state } = playStaged(staged.state, "49014", 3, {
      p: P2,
      except: staged.ids,
      pick: picker(accept(PHOENIX), take(kid)),
    });
    expect(inst(state, kid)).toMatchObject({ exhausted: false, damage: 0, controllerId: P1 });
  });
});

// ---------------------------------------------------------------------------
// Cyclops (49015), Q46 = A
// ---------------------------------------------------------------------------
describe("Cyclops (49015): the chosen enemy takes 1 more damage from every instance of attack damage this phase (Q46 = A)", () => {
  const RICOCHET = "33009"; // Cyclops (hero): 3 damage to an enemy, then 3 to an enemy with an upgrade attached (two instances)
  const UPGRADE = "33006";
  /** Cyclops played with Melter (a minion with no Guard) engaged; chooses Rhino, Melter, or declines. */
  function cyclops(choose: "villain" | "minion" | null, seat: Seat = MG(), legal = true) {
    const hero = heroGame([seat], 1, legal);
    const staged = stage(hero, ["49015"]);
    const eng = engage(staged.state, MELTER);
    const rhino = eng.state.activeVillainId!;
    const target = choose === "minion" ? eng.id : rhino;
    const probe = spy(picker(...(choose === null ? [] : [accept(CYCLOPS), take(target)])));
    const played = playStaged(eng.state, "49015", 3, { except: staged.ids, pick: probe.pick });
    return { ...played, rhino, melter: eng.id, seen: probe.seen };
  }
  const attackFrom = (s: GameState, target: InstanceId, attacker?: InstanceId, p: PlayerId = P1) =>
    driveEventsPicking(
      DEPS,
      ready(s, attacker ?? identityOf(s, p)),
      firstLegal,
      basicAttack(s, target, attacker ?? identityOf(s, p), p),
    ).state;

  it("cost 3: Cyclops enters with THW 2, ATK 2, 2 hit points; a basic attack of ATK 2 on the chosen Rhino deals 3 (2 + 1)", () => {
    const c = cyclops("villain");
    expect(profile(c.state, c.id)).toMatchObject({ thw: 2, atk: 2, maxHp: 2 });
    expect(inst(attackFrom(c.state, c.rhino), c.rhino).damage).toBe(3);
  });
  it("declined: the same attack deals 2", () => {
    const c = cyclops(null);
    expect(inst(attackFrom(c.state, c.rhino), c.rhino).damage).toBe(2);
  });
  it("an enemy not chosen takes the printed amount: Rhino chosen, Melter attacked for 2", () => {
    const c = cyclops("villain");
    expect(inst(attackFrom(c.state, c.melter), c.melter).damage).toBe(2);
  });
  it("the bonus follows the enemy, whoever attacks: Cyclops himself (ATK 2) attacks the chosen Melter for 3", () => {
    const c = cyclops("minion");
    const after = attackFrom(c.state, c.melter, c.id);
    expect(inst(after, c.melter).damage).toBe(3);
  });
  it("Q46 = A, an attack of several instances: Ricochet Beam (3 then 3) on Rhino, who holds an upgrade, deals 4 + 4 = 8, not 6 or 7", () => {
    const hero = heroGame([MG(RICOCHET, UPGRADE)], 1, false);
    const staged = stage(hero, ["49015", RICOCHET, UPGRADE]);
    const rhino = staged.state.activeVillainId!;
    const upgradeId = staged.ids[2]!;
    const attached = patchInstance(
      patchInstance(
        {
          ...staged.state,
          players: staged.state.players.map((p) => ({ ...p, hand: p.hand.filter((h) => h !== upgradeId) })),
        },
        upgradeId,
        { attachedTo: rhino },
      ),
      rhino,
      { attachments: [...inst(staged.state, rhino).attachments, upgradeId] },
    );
    const plain = playStaged(attached, RICOCHET, 2, { except: staged.ids, pick: picker(take(rhino)) });
    expect(inst(plain.state, rhino).damage).toBe(6);
    const withCyclops = playStaged(attached, "49015", 3, {
      except: staged.ids,
      pick: picker(accept(CYCLOPS), take(rhino)),
    });
    const played = playStaged(withCyclops.state, RICOCHET, 2, { except: staged.ids, pick: picker(take(rhino)) });
    expect(inst(played.state, rhino).damage).toBe(8);
  });
  it("damage that is not an attack is not increased: Kid Omega's 1 damage to each enemy stays 1", () => {
    const hero = heroGame([MG()]);
    const staged = stage(hero, ["49015", "49013", "49024"]);
    const rhino = staged.state.activeVillainId!;
    const c = playStaged(staged.state, "49015", 3, { except: staged.ids, pick: picker(accept(CYCLOPS), take(rhino)) });
    const k = playStaged(c.state, "49013", 2, {
      except: staged.ids,
      pick: picker(accept(KID_OMEGA), option("energy"), spendCards(staged.ids[2]!)),
    });
    expect(inst(k.state, rhino).damage).toBe(1);
  });
  it("it reaches every player's attacks and lasts to the end of the phase: Spider-Man (ATK 2) attacks Rhino in his own turn for 3", () => {
    const hero = heroGame([MG(), SM()]);
    const staged = stage(hero, ["49015"]);
    const rhino = staged.state.activeVillainId!;
    const c = playStaged(staged.state, "49015", 3, { except: staged.ids, pick: picker(accept(CYCLOPS), take(rhino)) });
    const turn2 = runWith(DEPS, c.state, endTurn(P1));
    expect(profile(turn2, identityOf(turn2, P2)).atk).toBe(2);
    expect(inst(attackFrom(turn2, rhino, undefined, P2), rhino).damage).toBe(3);
  });
  it("it ends with the phase: after the villain phase the next hero attack deals the printed 2", () => {
    const c = cyclops("villain");
    const ended = settle(
      runWith(DEPS, stackEncounterDeck(c.state, ADVANCE, ADVANCE), endTurn(P1)),
      picker(defendWithAnyone),
      (s) => s.step.phase === "player" && s.round > c.state.round,
      DEPS,
    );
    const before = inst(ended, c.rhino).damage;
    const after = attackFrom(withForm(ended, { heroForm: 0 }), c.rhino);
    expect(inst(after, c.rhino).damage - before).toBe(2);
  });
  it("from Captain Marvel's seat (Core Leadership): the same bonus on top of her ATK", () => {
    const c = cyclops("villain", CM("49015"), false);
    const atk = profile(c.state, identityOf(c.state)).atk;
    expect(inst(attackFrom(c.state, c.rhino), c.rhino).damage).toBe(atk + 1);
  });
});

// ---------------------------------------------------------------------------
// Won't Stay Down (49016)
// ---------------------------------------------------------------------------
describe("Won't Stay Down (49016): play only with an X-FORCE or X-MEN identity; discard it to return such an ally", () => {
  const WSD = "49016";
  /** The support played in hero form (Magneto is X-MEN), Kid Omega and Maria Hill in the discard pile. */
  function wsd(seat: Seat = MG(), form: "hero" | "alterEgo" = "hero") {
    const base = form === "hero" ? heroGame([seat], 1, seat.kind === "mg") : setupGame([seat], 1, seat.kind === "mg");
    const staged = stage(base, [WSD]);
    return { staged };
  }
  const toDiscard = (s: GameState, ...codes: string[]): GameState => {
    const given = moveToHand(s, P1, ...codes);
    return {
      ...given.state,
      players: given.state.players.map((p) =>
        p.playerId === P1
          ? { ...p, hand: p.hand.filter((h) => !given.ids.includes(h)), discard: [...p.discard, ...given.ids] }
          : p,
      ),
    };
  };

  it("data: Condition, cost 1, Max 1 per player; played in Magneto's hero form (X-MEN) it enters play for 1", () => {
    const { staged } = wsd();
    const { state, id } = playStaged(staged.state, WSD, 1, { except: staged.ids });
    expect(playerOf(state, P1).playArea).toContain(id);
    expect(playerOf(state, P1).hand).toHaveLength(playerOf(staged.state, P1).hand.length - 2);
  });
  it("Erik Lehnsherr (alter-ego, MUTANT only, no X-MEN trait) cannot play it", () => {
    const { staged } = wsd(MG(), "alterEgo");
    const given = moveToHand(staged.state, P1, WSD);
    expect(
      accepted(given.state, play(P1, given.ids[0]!, [playerOf(given.state, P1).hand.find((h) => h !== given.ids[0])!])),
    ).toBe(false);
  });
  it("Spider-Man (neither trait) cannot play it; X-23 (X-FORCE) can", () => {
    const sm = wsd(SM(WSD));
    const g = moveToHand(sm.staged.state, P1, WSD);
    expect(accepted(g.state, play(P1, g.ids[0]!, [playerOf(g.state, P1).hand.find((h) => h !== g.ids[0])!]))).toBe(
      false,
    );
    const x = wsd(X23(WSD));
    const { state, id } = playStaged(x.staged.state, WSD, 1, { except: x.staged.ids });
    expect(playerOf(state, P1).playArea).toContain(id);
  });
  it("Max 1 per player: a second copy cannot be played while the first is in play", () => {
    const { staged } = wsd();
    const first = playStaged(staged.state, WSD, 1, { except: staged.ids });
    const second = moveToHand(first.state, P1, WSD);
    const pay = playerOf(second.state, P1).hand.find((h) => h !== second.ids[0])!;
    expect(accepted(second.state, play(P1, second.ids[0]!, [pay]))).toBe(false);
  });
  it("Alter-Ego Action: back in Erik Lehnsherr's form, discard it to return Kid Omega (X-MEN) from the discard pile to hand; Maria Hill is not offered", () => {
    const { staged } = wsd(MG());
    const played = playStaged(staged.state, WSD, 1, { except: staged.ids });
    const erik = withForm(toDiscard(played.state, "49013", "49017"), "alterEgo");
    const probe = spy(picker());
    const { state } = driveEventsPicking(DEPS, erik, probe.pick, use(P1, played.id, WSD_ACTION));
    const ask = probe.seen.find((p) => p.kind === "chooseCards")!;
    expect(ask.options.map((o) => codeOf(erik, o as InstanceId))).toEqual(["49013"]);
    expect(handCodes(state)).toContain("49013");
    expect(playerOf(state, P1).discard.map((id) => codeOf(state, id))).toContain("49016");
    expect(playerOf(state, P1).playArea).not.toContain(played.id);
  });
  it("no X-MEN or X-FORCE ally in the discard pile (only Maria Hill): the ability has no valid target and is refused, the support stays", () => {
    const hero = heroGame([MG("01067")], 1, false);
    const staged = stage(hero, [WSD, "01067"]);
    const played = playStaged(staged.state, WSD, 1, { except: staged.ids });
    const erik = withForm(toDiscard(played.state, "01067"), "alterEgo");
    expect(accepted(erik, use(P1, played.id, WSD_ACTION))).toBe(false);
    expect(playerOf(erik, P1).playArea).toContain(played.id);
  });
  it("it is an Alter-Ego Action: refused in hero form", () => {
    const { staged } = wsd(MG());
    const played = playStaged(staged.state, WSD, 1, { except: staged.ids });
    const s = toDiscard(played.state, "49013");
    expect(accepted(s, use(P1, played.id, WSD_ACTION))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Squared Off (49017)
// ---------------------------------------------------------------------------
describe("Squared Off (49017): discard until a minion, put it into play engaged, then play an ally for 3 less", () => {
  const SQUARED_CODE = "49017";
  function squared(seat: Seat = MG(), legal = true) {
    const hero = heroGame([seat], 1, legal);
    return stage(hero, [SQUARED_CODE, "49014", "49012", "49013"]);
  }
  const playIt = (s: GameState, stack: readonly string[], pick: Picker) => {
    const stacked = stackEncounterDeck(s, ...stack);
    const given = moveToHand(stacked, P1, SQUARED_CODE);
    return {
      ...driveEventsPicking(DEPS, given.state, pick, play(P1, given.ids[0]!, [])),
      before: given.state,
      id: given.ids[0]!,
    };
  };

  it("cost 0: two non-minions are discarded, Melter is put into play engaged and not revealed, and Phoenix (cost 3) is played for 0", () => {
    const st = squared();
    const [, phoenixId] = st.ids as [InstanceId, InstanceId, InstanceId, InstanceId, ...InstanceId[]];
    const handBefore = playerOf(st.state, P1).hand.length;
    const r = playIt(st.state, [BREAKIN, CROWD_CONTROL, MELTER], picker(take(phoenixId)));
    const melter = inPlay(r.state, MELTER)[0]!;
    expect(playerOf(r.state, P1).playArea).toContain(melter);
    expect(inst(r.state, melter).engagedWith).toBe(P1);
    expect(encounterDiscard(r.state).sort()).toEqual([BREAKIN, CROWD_CONTROL].sort());
    expect(playerOf(r.state, P1).playArea).toContain(phoenixId);
    // Squared Off and Phoenix left the hand; nothing was paid for either.
    expect(playerOf(r.state, P1).hand).toHaveLength(handBefore - 2);
    expect(playerOf(r.state, P1).discard).toContain(r.id);
  });
  it("M (cost 4) is played for 1: exactly one hand card is paid", () => {
    const st = squared();
    const mId = st.ids[2]!;
    const handBefore = playerOf(st.state, P1).hand.length;
    const r = playIt(st.state, [MELTER], picker(take(mId), spendOne(st.ids)));
    expect(playerOf(r.state, P1).playArea).toContain(mId);
    // Squared Off, M and one payment card.
    expect(playerOf(r.state, P1).hand).toHaveLength(handBefore - 3);
  });
  it("Kid Omega (cost 2) is played for 0, not for a negative cost: no payment is asked", () => {
    const st = squared();
    const kid = st.ids[3]!;
    const handBefore = playerOf(st.state, P1).hand.length;
    const r = playIt(st.state, [MELTER], picker(take(kid)));
    expect(playerOf(r.state, P1).playArea).toContain(kid);
    expect(playerOf(r.state, P1).hand).toHaveLength(handBefore - 2);
  });
  it("only allies are offered from the hand: the events and resources staged beside them are not", () => {
    const st = squared();
    const probe = spy(picker(take(st.ids[1]!)));
    playIt(st.state, [MELTER], probe.pick);
    const ask = probe.seen.find((p) => p.kind === "chooseCards" || p.kind === "chooseTarget")!;
    const offeredCodes = ask.options.map((o) => codeOf(st.state, o.replace(/^hand:/, "") as InstanceId));
    expect(offeredCodes.every((c) => ["49012", "49013", "49014"].includes(c))).toBe(true);
    expect(offeredCodes.sort()).toEqual(["49012", "49013", "49014"]);
  });
  it("no ally in hand: the minion still enters play engaged and nothing else happens", () => {
    const hero = heroGame([MG()]);
    const noAllies = stage(hero, [SQUARED_CODE]);
    const r = playIt(noAllies.state, [MELTER], firstLegal);
    expect(inPlay(r.state, MELTER)).toHaveLength(1);
    expect(inst(r.state, inPlay(r.state, MELTER)[0]!).engagedWith).toBe(P1);
  });
  it("an encounter deck with no minion: the cost is not paid, so no minion and no ally", () => {
    const st = squared();
    const s = st.state;
    const deckId = activeEncounterDeckId(s);
    const pile = s.encounterDecks[deckId]!;
    const noMinions = {
      ...s,
      encounterDecks: {
        ...s.encounterDecks,
        [deckId]: {
          deck: pile.deck.filter((i) => typeOf(s, i) !== "minion"),
          discard: pile.discard.filter((i) => typeOf(s, i) !== "minion"),
        },
      },
    };
    const given = moveToHand(noMinions, P1, SQUARED_CODE);
    const { state } = driveEventsPicking(DEPS, given.state, firstLegal, play(P1, given.ids[0]!, []));
    expect(playerOf(state, P1).playArea.filter((i) => typeOf(state, i) === "ally")).toEqual([]);
    expect(cardsInPlay(state).filter((i) => typeOf(state, i) === "minion")).toEqual([]);
  });
  it("the ally limit still applies: with three allies in play the fourth ally played for less makes the player discard one", () => {
    const base = allies(heroGame([MG()]), ["49013", "49014", "49015"]);
    const st = stage(base.state, [SQUARED_CODE, "49012"]);
    const probe = spy(picker(take(st.ids[1]!), spendOne(st.ids)));
    const r = playIt(st.state, [MELTER], probe.pick);
    const over = probe.seen.find((p) => p.kind === "discardOverAllyLimit")!;
    expect(over.options).toHaveLength(4);
    expect(over.options).toContain(st.ids[1]!);
    expect(playerOf(r.state, P1).playArea.filter((i) => typeOf(r.state, i) === "ally")).toHaveLength(3);
  });
  it("it is a Hero Action: refused in alter-ego form", () => {
    const st = stage(setupGame([MG()]), [SQUARED_CODE]);
    expect(accepted(stackEncounterDeck(st.state, MELTER), play(P1, st.ids[0]!, []))).toBe(false);
  });
  it("from Captain Marvel's seat: Phoenix (added) is played for 0", () => {
    const st = squared(CM(SQUARED_CODE, "49014", "49012", "49013"), false);
    const r = playIt(st.state, [MELTER], picker(take(st.ids[1]!)));
    expect(playerOf(r.state, P1).playArea).toContain(st.ids[1]!);
  });
});

// ---------------------------------------------------------------------------
// Noble Sacrifice (49018)
// ---------------------------------------------------------------------------
describe("Noble Sacrifice (49018): discard an ally you control to heal its printed hit points from your hero and give a tough card", () => {
  const NOBLE_CODE = "49018";
  /** The hero with 6 damage, the given allies in play, Noble Sacrifice in hand. */
  function noble(allyCodes: readonly string[], seat: Seat = MG(), legal = true) {
    const base = allies(heroGame([seat], 1, legal), allyCodes);
    const hurt = withDamage(base.state, identityOf(base.state), 6);
    return { ...stage(hurt, [NOBLE_CODE]), allyIds: base.ids };
  }
  const cast = (n: ReturnType<typeof noble>, pick: Picker) =>
    playStaged(n.state, NOBLE_CODE, 1, { except: n.ids, pick });

  it("cost 1: Phoenix (printed 3 hit points) is discarded, 3 damage is healed (6 to 3) and the hero gets a tough card", () => {
    const n = noble(["49014"]);
    const { state } = cast(n, picker(take(n.allyIds[0]!)));
    expect(inst(state, identityOf(state)).damage).toBe(3);
    expect(inst(state, identityOf(state)).statuses.tough).toBe(1);
    expect(playerOf(state, P1).playArea).not.toContain(n.allyIds[0]!);
    expect(playerOf(state, P1).discard).toContain(n.allyIds[0]!);
  });
  it("the printed number is healed whatever damage the ally carries: Phoenix with 2 damage still heals 3", () => {
    const n = noble(["49014"]);
    const hurtAlly = patchInstance(n.state, n.allyIds[0]!, { damage: 2 });
    const { state } = playStaged(hurtAlly, NOBLE_CODE, 1, { except: n.ids, pick: picker(take(n.allyIds[0]!)) });
    expect(inst(state, identityOf(state)).damage).toBe(3);
  });
  it("healing stops at the damage there is: Kid Omega heals 2 of 1 damage", () => {
    const n = noble(["49013"]);
    const light = withDamage(n.state, identityOf(n.state), 1);
    const { state } = playStaged(light, NOBLE_CODE, 1, { except: n.ids, pick: picker(take(n.allyIds[0]!)) });
    expect(inst(state, identityOf(state)).damage).toBe(0);
    expect(inst(state, identityOf(state)).statuses.tough).toBe(1);
  });
  it("with two allies the player chooses which one is discarded, the other stays in play", () => {
    const n = noble(["49013", "49014"]);
    const { state } = playStaged(n.state, NOBLE_CODE, 1, {
      except: n.ids,
      costChoices: { discarded: [n.allyIds[0]!] },
    });
    expect(playerOf(state, P1).playArea).not.toContain(n.allyIds[0]!);
    expect(playerOf(state, P1).playArea).toContain(n.allyIds[1]!);
    expect(inst(state, identityOf(state)).damage).toBe(4);
  });
  it("no ally in play: the cost cannot be paid, so the event is refused and nothing is healed", () => {
    const n = noble([]);
    expect(accepted(n.state, play(P1, n.ids[0]!, [n.fill[0]!]))).toBe(false);
  });
  it("it is a Hero Action: refused in alter-ego form", () => {
    const base = allies(heroGame([MG()]), ["49014"]);
    const erik = withForm(withDamage(base.state, identityOf(base.state), 6), "alterEgo");
    const st = stage(erik, [NOBLE_CODE]);
    expect(accepted(st.state, play(P1, st.ids[0]!, [st.fill[0]!]))).toBe(false);
  });
  it("another player's ally cannot be discarded: only allies the player controls", () => {
    const n = noble(["49014"], MG());
    const probe = spy(picker(take(n.allyIds[0]!)));
    cast(n, probe.pick);
    const ask = probe.seen.find((p) => p.kind === "chooseCards" || p.kind === "chooseTarget");
    expect(ask === undefined || ask.options.every((o) => o === n.allyIds[0]!)).toBe(true);
  });
  it("from Captain Marvel's seat: Kid Omega (added) is discarded for 2 healed", () => {
    const n = noble(["49013"], CM("49013", NOBLE_CODE), false);
    const { state } = cast(n, picker(take(n.allyIds[0]!)));
    expect(inst(state, identityOf(state)).damage).toBe(4);
    expect(inst(state, identityOf(state)).statuses.tough).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// "You Got This!" (49019)
// ---------------------------------------------------------------------------
describe('"You Got This!" (49019): discard an ally to add its matching power to the hero\'s basic thwart or attack, and ready the hero', () => {
  const GOT_DEPS: EngineDeps = DEPS;
  const GOT = "49019";
  /** The given allies in play and the event in hand; Rhino and the main scheme at known values. */
  function got(allyCodes: readonly string[], seat: Seat = MG(), legal = true) {
    const base = allies(heroGame([seat], 1, legal), allyCodes);
    const withScheme = patchInstance(base.state, mainOf(base.state), { threat: 10 });
    const st = stage(withScheme, [GOT]);
    return { ...st, allyIds: base.ids, rhino: st.state.activeVillainId! };
  }
  const attackWith = (g: ReturnType<typeof got>, ally: InstanceId | null, o: { decline?: boolean } = {}) => {
    const probe = spy(picker(...(o.decline ? [] : [accept(GOT_THIS), payOne(g.ids)]), ...(ally ? [take(ally)] : [])));
    const r = driveEventsPicking(GOT_DEPS, g.state, probe.pick, basicAttack(g.state, g.rhino));
    return { ...r, seen: probe.seen };
  };
  const thwartWith = (g: ReturnType<typeof got>, ally: InstanceId | null) => {
    const probe = spy(picker(accept(GOT_THIS), payOne(g.ids), ...(ally ? [take(ally)] : [])));
    const r = driveEventsPicking(GOT_DEPS, g.state, probe.pick, basicThwart(g.state, mainOf(g.state)));
    return { ...r, seen: probe.seen };
  };

  it("pinned data: Leadership event, cost 1, Hero Response; the discard is its cost, with the ally's powers recorded", () => {
    const card = BY_ID.get("49019") as unknown as {
      cost: number;
      aspect: string;
      type: string;
      text: { current: string };
    };
    expect(card).toMatchObject({ cost: 1, aspect: "leadership", type: "event" });
    expect(card.text.current).toContain("Hero Response: After you exhaust your hero to make a basic thwart or attack");
    expect(MAGNETO_ASPECT_BASIC[GOT_THIS]!.cost?.discardCards).toMatchObject({
      slot: "discarded",
      snapshotStats: true,
    });
  });
  it("attack: Magneto ATK 2 + Kid Omega ATK 2 = 4; the ally is discarded, the event is paid (1) and discarded, the hero is ready", () => {
    const g = got(["49013"]);
    const r = attackWith(g, g.allyIds[0]!);
    expect(inst(r.state, g.rhino).damage).toBe(4);
    expect(playerOf(r.state, P1).discard).toEqual(expect.arrayContaining([g.allyIds[0]!, g.ids[0]!]));
    expect(inst(r.state, identityOf(r.state)).exhausted).toBe(false);
  });
  it("attack with Phoenix (ATK 1): 2 + 1 = 3", () => {
    const g = got(["49014"]);
    expect(inst(attackWith(g, g.allyIds[0]!).state, g.rhino).damage).toBe(3);
  });
  it("thwart: the matching power, THW: Magneto THW 2 + Phoenix THW 2 = 4 threat removed (10 to 6)", () => {
    const g = got(["49014"]);
    const r = thwartWith(g, g.allyIds[0]!);
    expect(inst(r.state, mainOf(r.state)).threat).toBe(6);
    expect(inst(r.state, identityOf(r.state)).exhausted).toBe(false);
  });
  it("the matching power is the power in use: with Phoenix (THW 2, ATK 1) the attack adds 1 and the thwart adds 2", () => {
    const g = got(["49014"]);
    const a = attackWith(g, g.allyIds[0]!);
    const t = thwartWith(g, g.allyIds[0]!);
    expect(inst(a.state, g.rhino).damage).toBe(3);
    expect(10 - inst(t.state, mainOf(t.state)).threat).toBe(4);
  });
  it("for this use only: the readied hero's next basic attack deals the printed 2", () => {
    const g = got(["49013"]);
    const r = attackWith(g, g.allyIds[0]!);
    const next = driveEventsPicking(GOT_DEPS, r.state, firstLegal, basicAttack(r.state, g.rhino));
    expect(inst(next.state, g.rhino).damage).toBe(4 + 2);
  });
  it("declined: a plain attack of 2, the event stays in hand and the ally stays in play", () => {
    const g = got(["49013"]);
    const r = attackWith(g, null, { decline: true });
    expect(inst(r.state, g.rhino).damage).toBe(2);
    expect(playerOf(r.state, P1).hand).toContain(g.ids[0]!);
    expect(playerOf(r.state, P1).playArea).toContain(g.allyIds[0]!);
  });
  it("with no ally in play it is not offered: the cost cannot be paid", () => {
    const g = got([]);
    const r = attackWith(g, null);
    expect(offered(r.seen, GOT_THIS)).toBe(false);
    expect(inst(r.state, g.rhino).damage).toBe(2);
    expect(playerOf(r.state, P1).hand).toContain(g.ids[0]!);
  });
  it("not offered for the hero's basic defense", () => {
    const g = got(["49013"]);
    const probe = spy(picker(accept(GOT_THIS), payOne(g.ids), take(g.allyIds[0]!), defendWithAnyone));
    let state = runWith(GOT_DEPS, stackEncounterDeck(g.state, BREAKIN, CROWD_CONTROL), endTurn(P1));
    state = settle(state, probe.pick, undefined, GOT_DEPS);
    expect(offered(probe.seen, GOT_THIS)).toBe(false);
  });
  it("not offered for an ally's basic attack (the ally is not the hero)", () => {
    const g = got(["49013", "49014"]);
    const probe = spy(picker(accept(GOT_THIS), payOne(g.ids)));
    driveEventsPicking(GOT_DEPS, g.state, probe.pick, basicAttack(g.state, g.rhino, g.allyIds[0]!));
    expect(offered(probe.seen, GOT_THIS)).toBe(false);
  });
  it("it is a Hero Response: in alter-ego form there is no basic attack to answer", () => {
    const g = got(["49013"]);
    const erik = withForm(g.state, "alterEgo");
    expect(accepted(erik, basicAttack(erik, g.rhino), GOT_DEPS)).toBe(false);
  });
  it("from Captain Marvel's seat: her ATK plus the added ally's ATK", () => {
    const g = got(["49013"], CM("49013", GOT), false);
    const cmAtk = profile(g.state, identityOf(g.state), GOT_DEPS).atk;
    const r = attackWith(g, g.allyIds[0]!);
    expect(inst(r.state, g.rhino).damage).toBe(cmAtk + 2);
  });
});

// ---------------------------------------------------------------------------
// White Queen (49021)
// ---------------------------------------------------------------------------
describe("White Queen (49021): play only with an X-FORCE or X-MEN identity; discard a status card from a character", () => {
  const QUEEN = "49021";
  const withStatus = (
    s: GameState,
    id: InstanceId,
    statuses: Partial<Record<"stunned" | "confused" | "tough", number>>,
  ) => patchInstance(s, id, { statuses: { ...inst(s, id).statuses, ...statuses } });
  /** White Queen staged, Rhino stunned and tough, the hero confused. */
  function queen(seat: Seat = MG(), legal = true) {
    const hero = heroGame([seat], 1, legal);
    const staged = stage(hero, [QUEEN]);
    const rhino = staged.state.activeVillainId!;
    const loaded = withStatus(withStatus(staged.state, rhino, { stunned: 1, tough: 1 }), identityOf(staged.state), {
      confused: 1,
    });
    return { staged: { ...staged, state: loaded }, rhino };
  }

  it("cost 3: Magneto (X-MEN) plays her; she is THW 2, ATK 1 with 3 hit points; she removes the hero's confused status card", () => {
    const { staged } = queen();
    const hero = identityOf(staged.state);
    const { state, id } = playStaged(staged.state, QUEEN, 3, {
      except: staged.ids,
      pick: picker(accept(QUEEN_RESPONSE), take(hero)),
    });
    expect(profile(state, id)).toMatchObject({ thw: 2, atk: 1, maxHp: 3 });
    expect(inst(state, hero).statuses.confused).toBe(0);
    expect(inst(state, state.activeVillainId!).statuses).toMatchObject({ stunned: 1, tough: 1 });
  });
  it("an enemy's status card can be the one discarded: Rhino has stunned and tough, the player picks which; only that one goes", () => {
    const { staged, rhino } = queen();
    const probe = spy(picker(accept(QUEEN_RESPONSE), take(rhino), option("stunned")));
    const { state } = playStaged(staged.state, QUEEN, 3, { except: staged.ids, pick: probe.pick });
    const ask = probe.seen.find((p) => p.kind === "chooseOption")!;
    expect(ask.options).toHaveLength(2);
    expect(inst(state, rhino).statuses).toMatchObject({ stunned: 0, tough: 1 });
    expect(inst(state, identityOf(state)).statuses.confused).toBe(1);
  });
  it("a character with one status card is not asked which: the hero's confused card is discarded at once", () => {
    const { staged } = queen();
    const probe = spy(picker(accept(QUEEN_RESPONSE), take(identityOf(staged.state))));
    playStaged(staged.state, QUEEN, 3, { except: staged.ids, pick: probe.pick });
    expect(probe.seen.some((p) => p.kind === "chooseOption")).toBe(false);
  });
  it("only characters with a status card are offered: the hero and Rhino, not White Queen herself", () => {
    const { staged, rhino } = queen();
    const probe = spy(picker(accept(QUEEN_RESPONSE)));
    const { id } = playStaged(staged.state, QUEEN, 3, { except: staged.ids, pick: probe.pick });
    const ask = probe.seen.find((p) => p.kind === "chooseTarget")!;
    expect(ask.options.sort()).toEqual([identityOf(staged.state), rhino].sort());
    expect(ask.options).not.toContain(id);
  });
  it("with no status card anywhere, nothing is offered and nothing changes", () => {
    const hero = heroGame([MG()]);
    const staged = stage(hero, [QUEEN]);
    const probe = spy(picker(accept(QUEEN_RESPONSE)));
    const { state, id } = playStaged(staged.state, QUEEN, 3, { except: staged.ids, pick: probe.pick });
    expect(playerOf(state, P1).playArea).toContain(id);
    expect(probe.seen.some((p) => p.kind === "chooseTarget" || p.kind === "chooseOption")).toBe(false);
  });
  it("declined: every status card stays", () => {
    const { staged, rhino } = queen();
    const { state } = playStaged(staged.state, QUEEN, 3, { except: staged.ids });
    expect(inst(state, rhino).statuses).toMatchObject({ stunned: 1, tough: 1 });
    expect(inst(state, identityOf(state)).statuses.confused).toBe(1);
  });
  it("Erik Lehnsherr (MUTANT, no X-MEN trait) cannot play her; Magneto can", () => {
    const erik = stage(setupGame([MG()]), [QUEEN]);
    expect(refusal(erik.state, play(P1, erik.ids[0]!, erik.fill.slice(0, 3)))).toMatch(/play restriction/i);
    const hero = stage(heroGame([MG()]), [QUEEN]);
    expect(accepted(hero.state, play(P1, hero.ids[0]!, hero.fill.slice(0, 3)))).toBe(true);
  });
  it("Spider-Man (neither trait) cannot play her", () => {
    const sm = stage(heroGame([SM(QUEEN)], 1, false), [QUEEN]);
    expect(accepted(sm.state, play(P1, sm.ids[0]!, sm.fill.slice(0, 3)))).toBe(false);
  });
  it("X-23, an X-FORCE identity with no X-MEN trait, can play her", () => {
    const x = stage(heroGame([X23(QUEEN)], 1, false), [QUEEN]);
    expect(traitsOf(x.state, identityOf(x.state), DEPS).map(String)).toContain("X-FORCE");
    expect(traitsOf(x.state, identityOf(x.state), DEPS).map(String)).not.toContain("X-MEN");
    expect(accepted(x.state, play(P1, x.ids[0]!, x.fill.slice(0, 3)))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Face the Past (49022)
// ---------------------------------------------------------------------------
describe("Face the Past (49022): find your nemesis minion, reveal it, ready your hero and draw 3, no attacking the villain this phase", () => {
  const FACE_CODE = "49022";
  /** Hero form, exhausted, Face the Past in hand; Exodus is set aside by setup. */
  function face(seat: Seat = MG(), legal = true) {
    const hero = heroGame([seat], 1, legal);
    const exhausted = patchInstance(hero, identityOf(hero), { exhausted: true });
    return stage(exhausted, [FACE_CODE]);
  }
  const exodusIds = (s: GameState): InstanceId[] =>
    Object.values(s.instances)
      .filter((i) => i.cardId === cardId(EXODUS))
      .map((i) => i.instanceId);
  /** Moves Exodus from the player's set-aside area to the top of the encounter deck, or into its discard pile. */
  function relocate(s: GameState, to: "deck" | "discard"): GameState {
    const id = exodusIds(s)[0]!;
    const deckId = activeEncounterDeckId(s);
    const pile = s.encounterDecks[deckId]!;
    return {
      ...s,
      players: s.players.map((p) => ({ ...p, setAside: p.setAside.filter((i) => i !== id) })),
      encounterDecks: {
        ...s.encounterDecks,
        [deckId]:
          to === "deck"
            ? { deck: [id, ...pile.deck], discard: pile.discard }
            : { deck: pile.deck, discard: [id, ...pile.discard] },
      },
    };
  }
  const cast = (st: ReturnType<typeof face>, pick: Picker = firstLegal) =>
    driveEventsPicking(DEPS, st.state, pick, play(P1, st.ids[0]!, []));

  it("setup sets Exodus aside for Magneto (one copy, in his own set-aside area)", () => {
    const st = face();
    expect(playerOf(st.state, P1).setAside.map((i) => codeOf(st.state, i))).toContain(EXODUS);
  });
  it("cost 0: Exodus is revealed into play engaged with Magneto with a tough card (Toughness), the hero is ready, 3 cards are drawn", () => {
    const st = face();
    const handBefore = playerOf(st.state, P1).hand.length;
    const { state } = cast(st);
    const exodus = inPlay(state, EXODUS)[0]!;
    expect(inst(state, exodus)).toMatchObject({ engagedWith: P1, faceup: true });
    expect(inst(state, exodus).statuses.tough).toBe(1);
    expect(inst(state, identityOf(state)).exhausted).toBe(false);
    expect(playerOf(state, P1).hand).toHaveLength(handBefore - 1 + 3);
    expect(playerOf(state, P1).setAside.map((i) => codeOf(state, i))).not.toContain(EXODUS);
  });
  it("Remove this card from the game: it is not in the discard pile but removed from the game", () => {
    const st = face();
    const { state } = cast(st);
    expect(state.removedFromGame).toContain(st.ids[0]!);
    expect(playerOf(state, P1).discard).not.toContain(st.ids[0]!);
  });
  it("this phase the player cannot attack the villain, with the hero or an ally; Exodus can be attacked", () => {
    const st = face(MG());
    const r = cast(st);
    const rhino = r.state.activeVillainId!;
    const exodus = inPlay(r.state, EXODUS)[0]!;
    expect(refusal(r.state, basicAttack(r.state, rhino))).not.toBe("");
    expect(accepted(r.state, basicAttack(r.state, exodus))).toBe(true);
    const withAlly = allies(r.state, ["49013"]);
    expect(
      accepted(ready(withAlly.state, withAlly.ids[0]!), basicAttack(withAlly.state, rhino, withAlly.ids[0]!)),
    ).toBe(false);
    expect(
      accepted(ready(withAlly.state, withAlly.ids[0]!), basicAttack(withAlly.state, exodus, withAlly.ids[0]!)),
    ).toBe(true);
  });
  it("the restriction ends with the phase: the next round the hero attacks Rhino again", () => {
    const st = face();
    const r = cast(st);
    const rhino = r.state.activeVillainId!;
    const ended = settle(
      runWith(DEPS, stackEncounterDeck(r.state, ADVANCE, ADVANCE), endTurn(P1)),
      picker(defendWithAnyone),
      (s) => s.step.phase === "player" && s.round > r.state.round,
      DEPS,
    );
    const hero = withForm(ended, { heroForm: 0 });
    const guards = cardsInPlay(hero).filter((i) => typeOf(hero, i) === "minion" && codeOf(hero, i) !== EXODUS);
    expect(guards).toEqual([]);
    expect(accepted(ready(hero, identityOf(hero)), basicAttack(hero, rhino))).toBe(true);
  });
  it("Exodus in the encounter deck is found there, and the deck is shuffled", () => {
    const st = face();
    const moved = relocate(st.state, "deck");
    const { state } = cast({ ...st, state: moved });
    expect(inPlay(state, EXODUS)).toHaveLength(1);
    expect(activeEncounterDeck(state).deck.map((i) => codeOf(state, i))).not.toContain(EXODUS);
  });
  it("Exodus in the encounter discard pile is found there", () => {
    const st = face();
    const moved = relocate(st.state, "discard");
    const { state } = cast({ ...st, state: moved });
    expect(inPlay(state, EXODUS)).toHaveLength(1);
    expect(encounterDiscard(state)).not.toContain(EXODUS);
  });
  it("with Exodus already in play it is not playable: it is not a find, the three areas do not hold him", () => {
    const st = face();
    const id = exodusIds(st.state)[0]!;
    const engaged = {
      ...st.state,
      players: st.state.players.map((p) => ({
        ...p,
        setAside: p.setAside.filter((i) => i !== id),
        playArea: [...p.playArea, id],
      })),
      instances: { ...st.state.instances, [id]: { ...st.state.instances[id]!, engagedWith: P1, faceup: true } },
    };
    expect(inPlay(engaged, EXODUS)).toHaveLength(1);
    expect(accepted(engaged, play(P1, st.ids[0]!, []))).toBe(false);
  });
  it("it is a Hero Action: refused in alter-ego form", () => {
    const st = stage(setupGame([MG()]), [FACE_CODE]);
    expect(accepted(st.state, play(P1, st.ids[0]!, []))).toBe(false);
  });
  it("Max 1 per deck: a deck with two copies is illegal; the precon with one is legal", () => {
    const base: DeckContents = { identityCardId: PRECON.identityCardId, aspects: PRECON.aspects, cards: PRECON.cards };
    expect(validateDeck(base, POOL)).toEqual({ ok: true });
    const two: DeckContents = {
      ...base,
      cards: base.cards.map((l) => (l.cardId === cardId(FACE_CODE) ? { ...l, quantity: 2 } : l)),
    };
    const verdict = validateDeck(two, POOL);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.problems.some((p) => p.cardIds.includes(cardId(FACE_CODE)))).toBe(true);
  });
  it("from Captain Marvel's seat (Face the Past added): her own nemesis minion is the one revealed, not Exodus", () => {
    const st = face(CM(FACE_CODE), false);
    const { state } = cast(st);
    expect(inPlay(state, EXODUS)).toHaveLength(0);
    const nemesis = cardsInPlay(state).filter(
      (i) => typeOf(state, i) === "minion" && inst(state, i).engagedWith === P1,
    );
    expect(nemesis).toHaveLength(1);
    expect(inst(state, identityOf(state)).exhausted).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Face the Past in The Wrecking Crew (ruling January 17, 2026 - Ruling 5)
// ---------------------------------------------------------------------------
describe("Face the Past in The Wrecking Crew (Breakout): only the active villain's encounter deck is interacted with", () => {
  /** Magneto's precon in the four-villain scenario; the engine's pool gets the Magneto cards on top of the scenario's. */
  function breakout(): GameState {
    const config = wave1Scenario("breakout", { players: [{ starterDeckId: "core-spider-man-justice" }], seed: 5 });
    const players = [{ identityCardId: PRECON.identityCardId, aspects: PRECON.aspects, deck: PRECON_DECK }];
    // The scenario's data says `usesIdentityEncounterSets: false`, so a real Breakout game sets no nemesis set aside and
    // there is nothing for Face the Past to find; the ruling says the card can be played there, so the fixture turns
    // the identity sets on (reported to the main session as a data question).
    const created = createGame(
      { ...config, cards: [...config.cards, ...MAGNETO_CARDS], players, includeIdentitySets: true },
      DEPS,
    );
    if (!created.ok) throw new Error(created.error.message);
    return withForm(
      settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS),
      { heroForm: 0 },
    );
  }
  it("four villains each have an encounter deck, and the active villain's is the one the event reads", () => {
    const s = breakout();
    expect(Object.keys(s.encounterDecks).length).toBeGreaterThanOrEqual(4);
    expect(s.activeVillainId).not.toBeNull();
  });
  it("Exodus found in the set-aside area is revealed; defeated, he goes to the active villain's discard pile and no other deck's", () => {
    const s0 = breakout();
    const st = stage(s0, ["49022"]);
    const { state } = driveEventsPicking(DEPS, st.state, firstLegal, play(P1, st.ids[0]!, []));
    const exodus = inPlay(state, EXODUS)[0]!;
    expect(inst(state, exodus).engagedWith).toBe(P1);
    const activeDeck = activeEncounterDeckId(state);
    const dying = patchInstance(patchInstance(state, exodus, { damage: 5 }), exodus, {
      damage: 5,
      statuses: { ...inst(state, exodus).statuses, tough: 0 },
    });
    const after = driveEventsPicking(DEPS, dying, firstLegal, basicAttack(dying, exodus)).state;
    expect(inPlay(after, EXODUS)).toHaveLength(0);
    for (const [id, pile] of Object.entries(after.encounterDecks)) {
      const holds = pile.discard.some((i) => codeOf(after, i) === EXODUS);
      expect(holds, `encounter deck ${id}`).toBe(id === activeDeck);
    }
  });
});

// ---------------------------------------------------------------------------
// Deft Focus (49023)
// ---------------------------------------------------------------------------
describe("Deft Focus (49023), reprint of gmw 16024: exhaust to reduce the next SUPERPOWER card this turn by 1", () => {
  const DEFT_CODE = "49023";
  const SWINGING_WEB_KICK = "01005"; // Spider-Man: cost 3, SUPERPOWER
  /** Spider-Man (Justice, Deft Focus added: it is Basic by erratum, legal in any aspect) with Deft Focus in play. */
  function deft() {
    const hero = heroGame([SM(DEFT_CODE, DEFT_CODE, SWINGING_WEB_KICK)], 1, false);
    const staged = stage(hero, [DEFT_CODE, SWINGING_WEB_KICK]);
    const played = playStaged(staged.state, DEFT_CODE, 1, { except: staged.ids, attach: identityOf(staged.state) });
    return { ...played, kick: staged.ids[1]!, staged };
  }

  it("Spider-Man's Justice precon with three Deft Focus in place of three of its cards is legal (Basic, not Protection: the scan misprints the aspect)", () => {
    const sm = coreScenario("rhino", {
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 1,
      cardPool: POOL,
    }).players[0]!;
    const counted = new Map<string, number>();
    for (const c of sm.deck) counted.set(c as string, (counted.get(c as string) ?? 0) + 1);
    const lines = [...counted].map(([c, n]) => ({ cardId: cardId(c), quantity: n }));
    const base: DeckContents = { identityCardId: sm.identityCardId, aspects: sm.aspects ?? [], cards: lines };
    expect(validateDeck(base, POOL)).toEqual({ ok: true });
    // Three fewer copies of the cards at the end of the list, three Deft Focus instead.
    let remove = 3;
    const trimmed = [...lines].reverse().map((l) => {
      const take = Math.min(remove, l.quantity);
      remove -= take;
      return { ...l, quantity: l.quantity - take };
    });
    const swapped: DeckContents = {
      ...base,
      cards: [...trimmed.filter((l) => l.quantity > 0), { cardId: cardId(DEFT_CODE), quantity: 3 }],
    };
    expect(validateDeck(swapped, POOL)).toEqual({ ok: true });
  });
  /** `n` cards worth exactly one resource each, moved into the hand from the deck. */
  const onePips = (s: GameState, n: number): { state: GameState; ids: InstanceId[] } => {
    const ids = playerOf(s, P1)
      .deck.filter((id) => iconsOf(s, id) === 1 && typeOf(s, id) !== "hero_identity")
      .slice(0, n);
    if (ids.length < n) throw new Error("not enough one-resource cards in the deck");
    return {
      ids,
      state: {
        ...s,
        players: s.players.map((p) =>
          p.playerId === P1 ? { ...p, deck: p.deck.filter((i) => !ids.includes(i)), hand: [...p.hand, ...ids] } : p,
        ),
      },
    };
  };
  it("cost 1: it attaches to the hero; the Hero Action exhausts it, and Swinging Web Kick (cost 3) is then paid with 2 one-resource cards", () => {
    const d = deft();
    expect(inst(d.state, d.id).attachedTo).toBe(identityOf(d.state));
    const used = driveEventsPicking(DEPS, d.state, firstLegal, use(P1, d.id, DEFT));
    expect(inst(used.state, d.id).exhausted).toBe(true);
    const rhino = used.state.activeVillainId!;
    const pips = onePips(used.state, 3);
    expect(accepted(pips.state, play(P1, d.kick, pips.ids.slice(0, 1)))).toBe(false);
    const { state } = driveEventsPicking(DEPS, pips.state, picker(take(rhino)), play(P1, d.kick, pips.ids.slice(0, 2)));
    expect(playerOf(state, P1).discard).toContain(d.kick);
    expect(inst(state, rhino).damage).toBeGreaterThan(0);
  });
  it("without using it, the same card needs all 3 one-resource cards: 2 are refused, 3 accepted", () => {
    const d = deft();
    const pips = onePips(d.state, 3);
    expect(accepted(pips.state, play(P1, d.kick, pips.ids.slice(0, 2)))).toBe(false);
    expect(accepted(pips.state, play(P1, d.kick, pips.ids.slice(0, 3)))).toBe(true);
  });
  it("only the next SUPERPOWER card: Swinging Web Kick used the reduction, so a second SUPERPOWER card costs its full price", () => {
    const d = deft();
    const used = driveEventsPicking(DEPS, d.state, firstLegal, use(P1, d.id, DEFT)).state;
    const copy = playerOf(used, P1).deck.find((i) => codeOf(used, i) === SWINGING_WEB_KICK)!;
    const second = {
      ids: [copy],
      state: {
        ...used,
        players: used.players.map((p) =>
          p.playerId === P1 ? { ...p, deck: p.deck.filter((i) => i !== copy), hand: [...p.hand, copy] } : p,
        ),
      },
    };
    const cost = (BY_ID.get(SWINGING_WEB_KICK) as { cost: number }).cost;
    expect(cost).toBe(3);
    const pips = onePips(second.state, 2 + cost);
    const first = driveEventsPicking(
      DEPS,
      pips.state,
      picker(take(used.activeVillainId!)),
      play(P1, d.kick, pips.ids.slice(0, 2)),
    ).state;
    expect(playerOf(first, P1).discard).toContain(d.kick);
    expect(accepted(first, play(P1, second.ids[0]!, pips.ids.slice(2, 2 + cost - 1)))).toBe(false);
  });
  it("Max 1 per player: a second Deft Focus cannot be played while the first is in play", () => {
    const d = deft();
    const second = moveToHand(d.state, P1, DEFT_CODE);
    const pay = playerOf(second.state, P1).hand.find((h) => h !== second.ids[0] && iconsOf(second.state, h) > 0)!;
    expect(
      accepted(second.state, play(P1, second.ids[0]!, [pay], { attachToInstanceId: identityOf(second.state) })),
    ).toBe(false);
  });
  it("the Hero Action is refused in alter-ego form", () => {
    const d = deft();
    expect(accepted(withForm(d.state, "alterEgo"), use(P1, d.id, DEFT))).toBe(false);
  });
  it("in Magneto's Leadership deck it is the same card: a Hero Action that exhausts it", () => {
    const hero = heroGame([MG()]);
    const staged = stage(hero, [DEFT_CODE]);
    const played = playStaged(staged.state, DEFT_CODE, 1, { except: staged.ids, attach: identityOf(staged.state) });
    const used = driveEventsPicking(DEPS, played.state, firstLegal, use(P1, played.id, DEFT));
    expect(inst(used.state, played.id).exhausted).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// New Recruits (49020) and the four Linked allies (49033 to 49036): docs/phase7-wave8.md §3.78
// ---------------------------------------------------------------------------
/** Answers a chooseCards prompt with the set-aside card of the code this prompt's player is to take. */
const takeCodes =
  (picks: Readonly<Record<string, string>>): Rule =>
  (s) => {
    const choice = s.pendingChoice;
    if (choice?.prompt.kind !== "chooseCards") return undefined;
    const want = picks[choice.playerId as string];
    const hit = want ? choice.options.find((o) => codeOf(s, o.optionId as InstanceId) === want) : undefined;
    return hit ? [hit.optionId] : undefined;
  };
/** Surgery: a set-aside linked ally into a player's hand as the real defeat leaves it (ownership included). */
function linkedToHand(s: GameState, code: string, p: PlayerId = P1): { state: GameState; id: InstanceId } {
  const id = s.encounterSetAside.find((i) => codeOf(s, i) === code)!;
  return {
    id,
    state: {
      ...s,
      encounterSetAside: s.encounterSetAside.filter((i) => i !== id),
      players: s.players.map((pl) => (pl.playerId === p ? { ...pl, hand: [...pl.hand, id] } : pl)),
      instances: { ...s.instances, [id]: { ...s.instances[id]!, ownerId: p, controllerId: p, faceup: true } },
    },
  };
}

describe("New Recruits (49020): a player side scheme that, defeated, gives each player a set-aside NEW ally", () => {
  /** Magneto (and the others) in hero form with New Recruits played (cost 0). `threat` patches its threat down for a one-thwart defeat. */
  function recruits(seats: readonly Seat[] = [MG()], legal = true) {
    const hero = heroGame(seats, 1, legal);
    const staged = stage(hero, ["49020"]);
    const played = playStaged(staged.state, "49020", 0, { except: staged.ids });
    return { ...played, before: staged.state };
  }
  /** The scheme thwarted to defeat (patched to 2 threat first), the players taking these codes. */
  function defeated(seats: readonly Seat[], picks: Readonly<Record<string, string>>, legal = true) {
    const r = recruits(seats, legal);
    const low = patchInstance(r.state, r.id, { threat: 2 });
    const done = driveEventsPicking(DEPS, low, picker(takeCodes(picks)), basicThwart(low, r.id));
    return { ...r, state: done.state, low };
  }

  it("setup: Magneto's deck holds New Recruits, so the four NEW allies are set aside (one of each), owned by nobody, in no deck or hand", () => {
    const s = heroGame([MG()]);
    expect(setAsideCodes(s)).toEqual(NEW_ALLIES);
    expect(s.encounterSetAside.every((id) => s.instances[id]!.ownerId === null)).toBe(true);
    const p = playerOf(s, P1);
    expect(p.hand.length + p.deck.length).toBe(40);
    expect([...p.hand, ...p.deck].some((id) => NEW_ALLIES.includes(codeOf(s, id)))).toBe(false);
  });
  it("a deck without New Recruits sets none aside (Spider-Man's)", () => {
    expect(setAsideCodes(heroGame([SM()]))).toEqual([]);
  });
  it("validateDeck: the precon is legal; adding one Linked ally reports exactly `linked_card`, in words naming the keyword", () => {
    const base: DeckContents = { identityCardId: PRECON.identityCardId, aspects: PRECON.aspects, cards: PRECON.cards };
    expect(validateDeck(base, POOL)).toEqual({ ok: true });
    for (const code of NEW_ALLIES) {
      const deck: DeckContents = { ...base, cards: [...base.cards, { cardId: cardId(code), quantity: 1 }] };
      const verdict = validateDeck(deck, POOL);
      expect(verdict.ok).toBe(false);
      if (verdict.ok) continue;
      expect(verdict.problems.map((p) => p.code)).toEqual(["linked_card"]);
      expect(verdict.problems[0]!.message).toContain("Linked");
      expect(verdict.problems[0]!.cardIds).toEqual([cardId(code)]);
    }
  });
  it("cost 0: it enters the villain area with 2 threat (1 player), is unique, with Victory 0", () => {
    const r = recruits();
    expect(r.state.villainArea).toContain(r.id);
    expect(inst(r.state, r.id).threat).toBe(2);
    const card = BY_ID.get("49020") as unknown as { unique: boolean; keywords: { name: string; value?: number }[] };
    expect(card.unique).toBe(true);
    expect(card.keywords).toEqual([{ name: "victory", value: 0 }]);
  });
  it("two players: 4 threat (2 per player)", () => {
    const r = recruits([MG(), SM()]);
    expect(inst(r.state, r.id).threat).toBe(4);
  });
  it("Erik Lehnsherr (MUTANT, no X-MEN trait) cannot play it; nor can Spider-Man or X-23 (X-FORCE only)", () => {
    const erik = stage(setupGame([MG()]), ["49020"]);
    expect(refusal(erik.state, play(P1, erik.ids[0]!, []))).toMatch(/play only if your identity has the X-MEN trait/i);
    const sm = stage(heroGame([SM("49020")], 1, false), ["49020"]);
    expect(accepted(sm.state, play(P1, sm.ids[0]!, []))).toBe(false);
    const x = stage(heroGame([X23("49020")], 1, false), ["49020"]);
    expect(accepted(x.state, play(P1, x.ids[0]!, []))).toBe(false);
  });
  it("anyone may thwart it: one thwart of 2 leaves it with 0 and it goes to the victory display, not the discard pile", () => {
    const r = defeated([MG()], { p1: "49033" });
    expect(r.state.victoryDisplay).toContain(r.id);
    expect(r.state.villainArea).not.toContain(r.id);
    expect(playerOf(r.state, P1).discard).not.toContain(r.id);
  });
  it("a thwart that leaves threat does not trigger it: 2 threat minus 1 is 1 and nobody takes an ally", () => {
    const r = recruits();
    const patched = patchInstance(r.state, r.id, { threat: 3 });
    const { state } = driveEventsPicking(DEPS, patched, picker(takeCodes({ p1: "49033" })), basicThwart(patched, r.id));
    expect(inst(state, r.id).threat).toBe(1);
    expect(setAsideCodes(state)).toEqual(NEW_ALLIES);
  });
  it("solo: defeated, the player takes the ally they choose into hand and owns it; three remain set aside", () => {
    const r = defeated([MG()], { p1: "49034" });
    const hand = playerOf(r.state, P1).hand.filter((id) => NEW_ALLIES.includes(codeOf(r.state, id)));
    expect(hand.map((id) => codeOf(r.state, id))).toEqual(["49034"]);
    expect(inst(r.state, hand[0]!)).toMatchObject({ ownerId: P1, controllerId: P1 });
    expect(setAsideCodes(r.state)).toEqual(["49033", "49035", "49036"]);
    expect(setAsideCodes(r.state)).not.toContain("49034");
  });
  it("solo: the player is asked among exactly the four (they are not forced to the first)", () => {
    const r = recruits();
    const low = patchInstance(r.state, r.id, { threat: 2 });
    const probe = spy(picker(takeCodes({ p1: "49036" })));
    const { state } = driveEventsPicking(DEPS, low, probe.pick, basicThwart(low, r.id));
    const ask = probe.seen.find((p) => p.kind === "chooseCards")!;
    expect(ask.options.map((o) => codeOf(low, o as InstanceId)).sort()).toEqual(NEW_ALLIES);
    expect(handCodes(state)).toContain("49036");
  });
  it("two players: 4 threat; each takes a different ally into hand and owns it", () => {
    const r = defeated([MG(), SM()], { p1: "49033", p2: "49034" });
    expect(handCodes(r.state, P1).filter((c) => NEW_ALLIES.includes(c))).toEqual(["49033"]);
    expect(handCodes(r.state, P2).filter((c) => NEW_ALLIES.includes(c))).toEqual(["49034"]);
    const surge = playerOf(r.state, P1).hand.find((id) => codeOf(r.state, id) === "49033")!;
    const anole = playerOf(r.state, P2).hand.find((id) => codeOf(r.state, id) === "49034")!;
    expect(inst(r.state, surge).ownerId).toBe(P1);
    expect(inst(r.state, anole).ownerId).toBe(P2);
    expect(setAsideCodes(r.state)).toEqual(["49035", "49036"]);
  });
  it("two players: Spider-Man's Anole has THW 2 (no bonus) and counts against his ally limit, so a fourth ally makes him discard one", () => {
    const seats = [MG(), SM("49013", "49014", "49015")];
    const r = defeated(seats, { p1: "49033", p2: "49034" }, false);
    const turn2 = runWith(DEPS, r.state, endTurn(P1));
    const three = allies(turn2, ["49013", "49014", "49015"], P2);
    const anole = playerOf(three.state, P2).hand.find((id) => codeOf(three.state, id) === "49034")!;
    const probe = spy(picker());
    const pay = playerOf(three.state, P2)
      .hand.filter((h) => h !== anole && iconsOf(three.state, h) > 0)
      .slice(0, 2);
    const played = driveEventsPicking(DEPS, three.state, probe.pick, play(P2, anole, pay));
    expect(profile(played.state, anole)).toMatchObject({ thw: 2, atk: 2, maxHp: 2 });
    const over = probe.seen.find((p) => p.kind === "discardOverAllyLimit")!;
    expect(over.options).toHaveLength(4);
    expect(over.options).toContain(anole);
    expect(playerOf(played.state, P2).playArea.filter((i) => typeOf(played.state, i) === "ally")).toHaveLength(3);
  });
  it("Surge played by Magneto (X-MEN) for 2: ATK 3, THW 2, 2 hit points, and the hero hand is smaller by Surge and the 2 paid", () => {
    const r = defeated([MG()], { p1: "49033" });
    const surge = playerOf(r.state, P1).hand.find((id) => codeOf(r.state, id) === "49033")!;
    const handBefore = playerOf(r.state, P1).hand.length;
    const pay = playerOf(r.state, P1)
      .hand.filter((h) => h !== surge && iconsOf(r.state, h) > 0)
      .slice(0, 2);
    const { state } = driveEventsPicking(DEPS, r.state, firstLegal, play(P1, surge, pay));
    expect(profile(state, surge)).toMatchObject({ thw: 2, atk: 3, maxHp: 2 });
    expect(playerOf(state, P1).hand).toHaveLength(handBefore - 3);
  });
  it("Surge as a fourth ally: with Kid Omega, Phoenix and Cyclops in play nobody is discarded; a fifth, ordinary ally forces a discard that cannot be Surge", () => {
    const base = allies(defeated([MG()], { p1: "49033" }).state, ["49013", "49014", "49015"]);
    const surge = playerOf(base.state, P1).hand.find((id) => codeOf(base.state, id) === "49033")!;
    const pay = playerOf(base.state, P1)
      .hand.filter((h) => h !== surge && iconsOf(base.state, h) > 0)
      .slice(0, 2);
    const probe = spy(picker());
    const withSurge = driveEventsPicking(DEPS, base.state, probe.pick, play(P1, surge, pay));
    expect(probe.seen.some((p) => p.kind === "discardOverAllyLimit")).toBe(false);
    const inPlayAllies = playerOf(withSurge.state, P1).playArea.filter((i) => typeOf(withSurge.state, i) === "ally");
    expect(inPlayAllies).toHaveLength(4);
    const queen = stage(withSurge.state, ["49021"]);
    const probe2 = spy(picker());
    const withQueen = playStaged(queen.state, "49021", 3, { except: queen.ids, pick: probe2.pick });
    const over = probe2.seen.find((p) => p.kind === "discardOverAllyLimit")!;
    expect(over.options).not.toContain(surge);
    expect(over.options).toHaveLength(4);
    expect(playerOf(withQueen.state, P1).playArea).toContain(surge);
  });
  it("Anole: THW 3 for Magneto (2 + 1 while he has the X-MEN trait); Indra 4 hit points (2 + 2)", () => {
    const a = defeated([MG()], { p1: "49034" });
    const anole = playerOf(a.state, P1).hand.find((id) => codeOf(a.state, id) === "49034")!;
    const pay = playerOf(a.state, P1)
      .hand.filter((h) => h !== anole && iconsOf(a.state, h) > 0)
      .slice(0, 2);
    const played = driveEventsPicking(DEPS, a.state, firstLegal, play(P1, anole, pay));
    expect(profile(played.state, anole)).toMatchObject({ thw: 3, atk: 2, maxHp: 2 });
    const i = defeated([MG()], { p1: "49036" });
    const indra = playerOf(i.state, P1).hand.find((id) => codeOf(i.state, id) === "49036")!;
    const payI = playerOf(i.state, P1)
      .hand.filter((h) => h !== indra && iconsOf(i.state, h) > 0)
      .slice(0, 2);
    const playedI = driveEventsPicking(DEPS, i.state, firstLegal, play(P1, indra, payI));
    expect(profile(playedI.state, indra)).toMatchObject({ thw: 2, atk: 2, maxHp: 4 });
  });
  it("Bling! played by Magneto enters with a tough status card; the bonus is toughness", () => {
    const r = defeated([MG()], { p1: "49035" });
    const bling = playerOf(r.state, P1).hand.find((id) => codeOf(r.state, id) === "49035")!;
    const pay = playerOf(r.state, P1)
      .hand.filter((h) => h !== bling && iconsOf(r.state, h) > 0)
      .slice(0, 2);
    const { state } = driveEventsPicking(DEPS, r.state, firstLegal, play(P1, bling, pay));
    expect(inst(state, bling).statuses.tough).toBe(1);
    expect(profile(state, bling)).toMatchObject({ thw: 2, atk: 2, maxHp: 2 });
  });
  it("Bling! played by Spider-Man gets no tough status card and counts against his limit", () => {
    const seats = [MG(), SM()];
    const r = defeated(seats, { p1: "49033", p2: "49035" });
    const turn2 = runWith(DEPS, r.state, endTurn(P1));
    const bling = playerOf(turn2, P2).hand.find((id) => codeOf(turn2, id) === "49035")!;
    const pay = playerOf(turn2, P2)
      .hand.filter((h) => h !== bling && iconsOf(turn2, h) > 0)
      .slice(0, 2);
    const { state } = driveEventsPicking(DEPS, turn2, firstLegal, play(P2, bling, pay));
    expect(inst(state, bling).statuses.tough).toBe(0);
  });
  it("unique: two decks hold New Recruits (eight set aside), both take Surge, and player 2 cannot play hers while player 1's Surge is in play", () => {
    const seats = [MG(), SM("49020")];
    const start = heroGame(seats, 1, false);
    expect(setAsideCodes(start)).toEqual([...NEW_ALLIES, ...NEW_ALLIES].sort());
    const r = defeated(seats, { p1: "49033", p2: "49033" }, false);
    expect(setAsideCodes(r.state)).toEqual(["49034", "49034", "49035", "49035", "49036", "49036"]);
    const s1 = playerOf(r.state, P1).hand.find((id) => codeOf(r.state, id) === "49033")!;
    const pay1 = playerOf(r.state, P1)
      .hand.filter((h) => h !== s1 && iconsOf(r.state, h) > 0)
      .slice(0, 2);
    const first = driveEventsPicking(DEPS, r.state, firstLegal, play(P1, s1, pay1)).state;
    const turn2 = runWith(DEPS, first, endTurn(P1));
    const s2 = playerOf(turn2, P2).hand.find((id) => codeOf(turn2, id) === "49033")!;
    const pay2 = playerOf(turn2, P2)
      .hand.filter((h) => h !== s2 && iconsOf(turn2, h) > 0)
      .slice(0, 2);
    expect(refusal(turn2, play(P2, s2, pay2))).toMatch(/unique/i);
  });
  it("Noble Sacrifice heals Indra's printed hit points: 2, not the 4 she has", () => {
    const r = defeated([MG()], { p1: "49036" });
    const indra = playerOf(r.state, P1).hand.find((id) => codeOf(r.state, id) === "49036")!;
    const pay = playerOf(r.state, P1)
      .hand.filter((h) => h !== indra && iconsOf(r.state, h) > 0)
      .slice(0, 2);
    const inPlayIndra = driveEventsPicking(DEPS, r.state, firstLegal, play(P1, indra, pay)).state;
    const hurt = withDamage(inPlayIndra, identityOf(inPlayIndra), 6);
    const staged = stage(hurt, ["49018"]);
    const { state } = playStaged(staged.state, "49018", 1, { except: staged.ids, pick: picker(take(indra)) });
    expect(inst(state, identityOf(state)).damage).toBe(4);
  });
  it('"You Got This!" and Surge with her bonus (ATK 3 in play): her power as it stood in play is added, 2 + 3 = 5', () => {
    const r = defeated([MG()], { p1: "49033" });
    const surge = playerOf(r.state, P1).hand.find((id) => codeOf(r.state, id) === "49033")!;
    const pay = playerOf(r.state, P1)
      .hand.filter((h) => h !== surge && iconsOf(r.state, h) > 0)
      .slice(0, 2);
    const played = driveEventsPicking(DEPS, r.state, firstLegal, play(P1, surge, pay)).state;
    expect(profile(played, surge).atk).toBe(3);
    const staged = stage(ready(played, identityOf(played)), ["49019"]);
    const rhino = staged.state.activeVillainId!;
    const { state } = driveEventsPicking(
      DEPS,
      staged.state,
      picker(accept(GOT_THIS), payOne(staged.ids), take(surge)),
      basicAttack(staged.state, rhino),
    );
    expect(inst(state, rhino).damage).toBe(5);
    expect(playerOf(state, P1).discard).toContain(surge);
  });
  it("New Recruits with a second player side scheme in play: the limit (1 for one or two players) discards one of the two", () => {
    const TRAP = "41016"; // Lay the Trap (`psylocke`): another player side scheme
    const base = stage(heroGame([MG(TRAP)], 1, false), [TRAP, "49020"]);
    const trap = playStaged(base.state, TRAP, 1, { except: base.ids });
    const again = stage(trap.state, ["49020"]);
    const probe = spy(picker(take(trap.id)));
    const nr = playStaged(again.state, "49020", 0, { except: again.ids, pick: probe.pick });
    expect(probe.seen.some((p) => p.options.includes(trap.id) && p.options.includes(nr.id))).toBe(true);
    expect(nr.state.villainArea).toContain(nr.id);
    expect(nr.state.villainArea).not.toContain(trap.id);
    expect(playerOf(nr.state, P1).discard).toContain(trap.id);
    expect(nr.state.victoryDisplay).not.toContain(trap.id);
  });
  it("a discarded New Recruits gives no ally: the player keeps Lay the Trap, discards New Recruits, and the set-aside area is untouched", () => {
    const TRAP = "41016";
    const base = stage(heroGame([MG(TRAP)], 1, false), ["49020", TRAP]);
    const nr = playStaged(base.state, "49020", 0, { except: base.ids });
    const trapStage = stage(nr.state, [TRAP]);
    const { state } = playStaged(trapStage.state, TRAP, 1, { except: trapStage.ids, pick: picker(take(nr.id)) });
    expect(playerOf(state, P1).discard).toContain(nr.id);
    expect(state.victoryDisplay).not.toContain(nr.id);
    expect(setAsideCodes(state)).toEqual(NEW_ALLIES);
    expect(handCodes(state).filter((c) => NEW_ALLIES.includes(c))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Children of the Atom (49037) and the Linked allies' trait condition
// ---------------------------------------------------------------------------
describe("Children of the Atom (49037): X-FACTOR, X-FORCE and X-MEN characters you control gain all three traits", () => {
  const ATOM_CODE = "49037";
  const traitsNamed = (s: GameState, id: InstanceId): string[] => traitsOf(s, id, DEPS).map(String);
  /** The seat in hero form with Children of the Atom in hand; `Hill` is S.H.I.E.L.D., with none of the three traits. */
  function atom(seat: Seat, legal = false) {
    return stage(heroGame([seat], 1, legal), [ATOM_CODE]);
  }
  const playAtom = (st: ReturnType<typeof atom>) => playStaged(st.state, ATOM_CODE, 1, { except: st.ids });
  /** Surgery: Children of the Atom leaves play for its owner's discard pile. */
  const withoutAtom = (s: GameState, id: InstanceId): GameState => ({
    ...s,
    players: s.players.map((p) =>
      p.playArea.includes(id) ? { ...p, playArea: p.playArea.filter((i) => i !== id), discard: [...p.discard, id] } : p,
    ),
  });

  it("data: Basic support, cost 1, no printed traits, Max 1 per player and playable under any player's control", () => {
    const card = BY_ID.get(ATOM_CODE) as unknown as {
      aspect: string;
      cost: number;
      traits: string[];
      playRestrictions: Record<string, unknown>;
    };
    expect(card).toMatchObject({ aspect: "basic", cost: 1, traits: [] });
    expect(card.playRestrictions).toEqual({ anyPlayerControl: true, maxPerPlayer: 1 });
  });
  it("X-23 (X-FORCE) has X-FORCE only; with Children in play her identity also has X-MEN and X-FACTOR", () => {
    const st = atom(X23(ATOM_CODE));
    const hero = identityOf(st.state);
    expect(traitsNamed(st.state, hero)).toContain("X-FORCE");
    expect(traitsNamed(st.state, hero)).not.toContain("X-MEN");
    expect(traitsNamed(st.state, hero)).not.toContain("X-FACTOR");
    const { state } = playAtom(st);
    expect(traitsNamed(state, hero)).toEqual(expect.arrayContaining(["X-FORCE", "X-MEN", "X-FACTOR"]));
  });
  it("Magneto (X-MEN) gains X-FORCE and X-FACTOR; Kid Omega (X-MEN) too; Maria Hill (none of the three) gains nothing", () => {
    const base = allies(heroGame([MG("01067", ATOM_CODE)], 1, false), ["49013", "01067"]);
    const [kid, hill] = base.ids as [InstanceId, InstanceId];
    const st = stage(base.state, [ATOM_CODE]);
    expect(traitsNamed(st.state, kid)).not.toContain("X-FORCE");
    const { state } = playAtom(st);
    expect(traitsNamed(state, identityOf(state))).toEqual(expect.arrayContaining(["X-MEN", "X-FORCE", "X-FACTOR"]));
    expect(traitsNamed(state, kid)).toEqual(expect.arrayContaining(["X-MEN", "X-FORCE", "X-FACTOR", "PSIONIC"]));
    expect(traitsNamed(state, hill)).toEqual(["S.H.I.E.L.D."]);
  });
  it("only characters you control: another player's X-MEN ally is not touched", () => {
    const seats = [X23(ATOM_CODE), MG()];
    const base = heroGame(seats, 1, false);
    const st = stage(base, [ATOM_CODE]);
    const { state } = playAtom(st);
    expect(traitsNamed(state, identityOf(state, P2))).toEqual(["X-MEN"]);
    expect(traitsNamed(state, identityOf(state, P1))).toContain("X-MEN");
  });
  it("Max 1 per player: a second copy is refused while the first is in play", () => {
    const st = atom(X23(ATOM_CODE, ATOM_CODE));
    const first = playAtom(st);
    const second = moveToHand(first.state, P1, ATOM_CODE);
    const pay = playerOf(second.state, P1).hand.find((h) => h !== second.ids[0] && iconsOf(second.state, h) > 0)!;
    expect(accepted(second.state, play(P1, second.ids[0]!, [pay]))).toBe(false);
  });
  it("it lets an X-FORCE identity play New Recruits and White Queen: refused before, accepted after (reads the identity as it stands)", () => {
    const st = stage(heroGame([X23(ATOM_CODE, "49020")], 1, false), [ATOM_CODE, "49020"]);
    const nr = st.ids[1]!;
    expect(accepted(st.state, play(P1, nr, []))).toBe(false);
    const { state } = playAtom(st);
    expect(accepted(state, play(P1, nr, []))).toBe(true);
  });
  it("with Children out of play again the identity loses the traits and New Recruits is refused again", () => {
    const st = stage(heroGame([X23(ATOM_CODE, "49020")], 1, false), [ATOM_CODE, "49020"]);
    const played = playAtom(st);
    const gone = withoutAtom(played.state, played.id);
    expect(traitsNamed(gone, identityOf(gone))).not.toContain("X-MEN");
    expect(accepted(gone, play(P1, st.ids[1]!, []))).toBe(false);
  });
});

describe("the Linked allies' MUTANT or X-MEN condition follows the identity as it stands (docs/phase7-wave8.md §3.78)", () => {
  const ATOM_CODE = "49037";
  /** X-23 (X-FORCE, not X-MEN) holding Surge/Anole/Bling!/Indra she took from the set-aside area, Children in her hand. */
  function xSeat(take: readonly string[], extras: readonly string[] = []) {
    let state = heroGame([X23(ATOM_CODE, "49020", ...extras)], 1, false);
    expect(setAsideCodes(state).filter((c) => NEW_ALLIES.includes(c))).toEqual(NEW_ALLIES);
    for (const code of take) state = linkedToHand(state, code).state;
    return stage(state, [ATOM_CODE]);
  }
  const playLinked = (st: GameState, code: string, pick: Picker = firstLegal) => {
    const id = playerOf(st, P1).hand.find((h) => codeOf(st, h) === code)!;
    const pay = playerOf(st, P1)
      .hand.filter((h) => h !== id && !NEW_ALLIES.includes(codeOf(st, h)) && iconsOf(st, h) > 0)
      .slice(0, 2);
    return { ...driveEventsPicking(DEPS, st, pick, play(P1, id, pay)), id };
  };
  const playAtomNow = (st: ReturnType<typeof xSeat>) => playStaged(st.state, ATOM_CODE, 1, { except: st.ids });
  const withoutAtom = (s: GameState, id: InstanceId): GameState => ({
    ...s,
    players: s.players.map((p) =>
      p.playArea.includes(id) ? { ...p, playArea: p.playArea.filter((i) => i !== id), discard: [...p.discard, id] } : p,
    ),
  });

  it("Surge for X-23: ATK 2 (no bonus) without Children, ATK 3 with Children in play, ATK 2 again when it leaves", () => {
    const st = xSeat(["49033"]);
    const plain = playLinked(st.state, "49033");
    expect(profile(plain.state, plain.id).atk).toBe(2);
    const atom = playAtomNow(st);
    const buffed = playLinked(atom.state, "49033");
    expect(profile(buffed.state, buffed.id).atk).toBe(3);
    const gone = withoutAtom(buffed.state, atom.id);
    expect(profile(gone, buffed.id).atk).toBe(2);
  });
  it("the ally limit: Surge is counted for X-23 without Children (three allies plus Surge: she must discard one) and not counted with it", () => {
    const run = (withAtom: boolean) => {
      const st = xSeat(["49033"], ["49013", "49014", "49015"]);
      const start = withAtom ? playAtomNow(st).state : st.state;
      const three = allies(start, ["49013", "49014", "49015"]);
      const probe = spy(picker());
      const out = playLinked(three.state, "49033", probe.pick);
      return { out, over: probe.seen.find((p) => p.kind === "discardOverAllyLimit") };
    };
    const without = run(false);
    expect(without.over).toBeDefined();
    expect(without.over!.options).toHaveLength(4);
    const withAtom = run(true);
    expect(withAtom.over).toBeUndefined();
    expect(
      playerOf(withAtom.out.state, P1).playArea.filter((i) => typeOf(withAtom.out.state, i) === "ally"),
    ).toHaveLength(4);
  });
  it("Bling! played with Children in play enters with a tough card; played before it gets none, and gaining Toughness later gives none", () => {
    const withAtom = xSeat(["49035"]);
    const atom = playAtomNow(withAtom);
    const blingWith = playLinked(atom.state, "49035");
    expect(inst(blingWith.state, blingWith.id).statuses.tough).toBe(1);
    const without = xSeat(["49035"]);
    const blingWithout = playLinked(without.state, "49035");
    expect(inst(blingWithout.state, blingWithout.id).statuses.tough).toBe(0);
    const then = playStaged(blingWithout.state, ATOM_CODE, 1, { except: [blingWithout.id, ...without.ids] });
    expect(inst(then.state, blingWithout.id).statuses.tough).toBe(0);
  });
  it("Indra has 4 hit points with Children; when it leaves play with 3 damage on her, she is defeated at once", () => {
    const st = xSeat(["49036"]);
    const atom = playAtomNow(st);
    const indra = playLinked(atom.state, "49036");
    expect(profile(indra.state, indra.id).maxHp).toBe(4);
    const hurt = patchInstance(indra.state, indra.id, { damage: 3 });
    const gone = withoutAtom(hurt, atom.id);
    expect(profile(gone, indra.id).maxHp).toBe(2);
    // A command lets the state checks run.
    const ready1 = ready(gone, identityOf(gone));
    const after = driveEventsPicking(DEPS, ready1, firstLegal, basicAttack(ready1, ready1.activeVillainId!)).state;
    expect(playerOf(after, P1).playArea).not.toContain(indra.id);
    expect(playerOf(after, P1).discard).toContain(indra.id);
  });
  it("Anole's THW bonus and Indra's hit points are for MUTANT or X-MEN only: Erik Lehnsherr, in alter-ego form, has MUTANT and the bonus holds", () => {
    const base = linkedToHand(setupGame([MG()]), "49034");
    const id = playerOf(base.state, P1).hand.find((h) => codeOf(base.state, h) === "49034")!;
    const pay = playerOf(base.state, P1)
      .hand.filter((h) => h !== id && iconsOf(base.state, h) > 0)
      .slice(0, 2);
    const { state } = driveEventsPicking(DEPS, base.state, firstLegal, play(P1, id, pay));
    expect(playerOf(state, P1).identity.form).toBe("alterEgo");
    expect(profile(state, id).thw).toBe(3);
  });
});
