import { NCRAWLER_CARDS, NCRAWLER_STARTER_DECKS, WAVE7_CARDS, cardId, type AnyCard } from "@mc/content";
import {
  activeEncounterDeck,
  activeEncounterDeckId,
  applyCommand,
  cardsInPlay,
  characterProfile,
  createGame,
  traitsOf,
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
import { driveEventsPicking, encounterCardInVillainArea, withDamage, withForm } from "../../testing/staging.js";
import { WAVE7_ABILITIES } from "../../wave7/index.js";
import { NCRAWLER_ASPECT_BASIC } from "./aspect-basic.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Nightcrawler pack aspect and basic cards (48012 to 48025, 48031, 48032), docs/phase7-wave8.md §7.4, §3.74, §3.81.
 * Nightcrawler's real Protection precon against Rhino through `coreScenario`, the engine given this module's registry on
 * top of every earlier wave. Cards that work from any deck are also played with Spider-Man in the seat.
 */
const NORTHSTAR = "48013.northstar-interrupt";
const FORTUNE = "48014.change-of-fortune-response";
const CONTROL = "48015.under-control-response";
const BUB = "48016.come-get-me-bub-action";
const PUNCH = "48017.powerful-punch-constant";
const RIPOSTE = "48018.riposte-interrupt";
const PROTECTION = "48019.the-power-of-protection-constant";
const XMEN_RESPONSE = "48020.astonishing-x-men-response";
const XMEN_DEFEATED = "48020.when-defeated";
const GAMBIT_X = "48021.gambit-constant";
const GAMBIT_RESPONSE = "48021.gambit-response";
const MOIRA = "48022.moira-mactaggert-response";
const COMBINE = "48031.combine-forces-action";
const GUNBOAT = "48032.gunboat-diplomacy-constant";
const ALL_REFS = [
  "48012.rogue-action",
  NORTHSTAR,
  FORTUNE,
  CONTROL,
  BUB,
  PUNCH,
  RIPOSTE,
  PROTECTION,
  XMEN_RESPONSE,
  XMEN_DEFEATED,
  GAMBIT_X,
  GAMBIT_RESPONSE,
  MOIRA,
  COMBINE,
  GUNBOAT,
];

const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE7_ABILITIES, NCRAWLER_ASPECT_BASIC) };
const POOL: readonly AnyCard[] = [...WAVE7_CARDS, ...NCRAWLER_CARDS];
const BY_ID = new Map(POOL.map((c) => [c.id as string, c]));

const PRECON = NCRAWLER_STARTER_DECKS.find((d) => d.id === "nightcrawler-protection")!;
const PRECON_DECK = PRECON.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId));

// Encounter cards used as stacked top cards, by printed boost icons (Core).
const ADVANCE = "01186"; // 0 icons, Standard: the villain schemes
const MERCENARY = "01101"; // Rhino: minion ATK 1, 3 hit points, 1 icon, Guard
const SANDMAN = "01102"; // Rhino: ELITE minion ATK 3, 4 hit points, 2 icons, Toughness
const BREAKIN = "01107"; // Rhino: side scheme, 2 icons
const RADIOACTIVE_MAN = "01129"; // Masters of Evil: ELITE minion ATK 1, 7 hit points, 0 icons and a star Boost
const MELTER = "01132"; // Masters of Evil: minion ATK 3, 5 hit points, 0 icons
const LEGIONS = "01180"; // Legions of Hydra: side scheme, 3 icons

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const encounterTop = (s: GameState, n: number): string[] =>
  activeEncounterDeck(s)
    .deck.slice(0, n)
    .map((id) => codeOf(s, id));
const encounterDiscard = (s: GameState): string[] => activeEncounterDeck(s).discard.map((id) => codeOf(s, id));
const inPlay = (s: GameState, code: string): InstanceId[] => cardsInPlay(s).filter((id) => codeOf(s, id) === code);
const accepted = (s: GameState, c: Command, deps: EngineDeps = DEPS): boolean => applyCommand(s, c, deps).ok;
const profile = (s: GameState, id: InstanceId, deps: EngineDeps = DEPS) => characterProfile(s, id, deps)!;

type Seat = { readonly kind: "nc" | "core" | "bp"; readonly extra: readonly string[] };
const NC = (...extra: string[]): Seat => ({ kind: "nc", extra });
/** Spider-Man (Justice precon): hero DEF 3. */
const CORE = (...extra: string[]): Seat => ({ kind: "core", extra });
/** Black Panther (Protection precon): hero DEF 2, so a Protection card is legal in his deck. */
const BP = (...extra: string[]): Seat => ({ kind: "bp", extra });

/** Masters of Evil (Radioactive Man, Melter: minions with 0 icons, ATK 1 and 3) and Legions of Hydra (a 3-icon scheme) join Rhino's game. */
const MODULAR = ["masters_of_evil", "legions_of_hydra"] as const;

/**
 * Nightcrawler (and optionally Spider-Man, Justice precon) against Rhino, through setup, in whatever form setup leaves.
 * `legal: false` seats a deck holding cards off its aspect (an Aggression or Justice event in his Protection deck), which
 * `coreScenario` otherwise refuses.
 */
function setupGame(
  seats: readonly Seat[] = [NC()],
  modular: readonly string[] = MODULAR,
  seed = 1,
  legal = true,
): GameState {
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed,
    difficulty: "standard",
    modularSetIds: modular,
    cardPool: POOL,
  });
  const players = seats.map((seat) => {
    const base =
      seat.kind === "nc"
        ? { identityCardId: PRECON.identityCardId, aspects: PRECON.aspects, deck: PRECON_DECK }
        : coreScenario("rhino", {
            players: [
              { starterDeckId: seat.kind === "bp" ? "core-black-panther-protection" : "core-spider-man-justice" },
            ],
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
const heroGame = (
  seats: readonly Seat[] = [NC()],
  modular: readonly string[] = MODULAR,
  seed = 1,
  legal = true,
): GameState =>
  seats.reduce<GameState>(
    (s, _seat, i) => withForm(s, { heroForm: 0 }, i === 0 ? P1 : P2),
    setupGame(seats, modular, seed, legal),
  );

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
  const owner = playerOf(state, p);
  const cleared: GameState = {
    ...state,
    players: state.players.map((pl) => (pl.playerId === p ? { ...pl, deck: [...pl.deck, ...pl.hand], hand: [] } : pl)),
  };
  const given = moveToHand(cleared, p, ...codes);
  const fill = playerOf(given.state, p)
    .deck.filter(
      (id) =>
        iconsOf(given.state, id) > 0 &&
        !(BY_ID.get(codeOf(given.state, id)) as { type: string }).type.startsWith("hero"),
    )
    .slice(0, fillers);
  void owner;
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
/** Declares this character as the defender when asked. */
const defend =
  (id: InstanceId): Rule =>
  (s) =>
    s.pendingChoice?.prompt.kind === "declareDefender" && s.pendingChoice.options.some((o) => o.optionId === id)
      ? [id]
      : undefined;
/** Pays for a card played from a trigger with the first `n` offered hand cards not listed in `except`. */
const pay =
  (n: number, except: readonly string[] = []): Rule =>
  (s) =>
    s.pendingChoice?.prompt.kind === "payForCard"
      ? s.pendingChoice.options
          .map((o) => o.optionId)
          .filter((o) => !except.includes(o))
          .slice(0, n)
      : undefined;
/** Divides points as `{ threat: { [instanceId]: points }, damage: { ... } }`, whichever the prompt asks for. */
const divideAs =
  (shares: Readonly<Record<string, Readonly<Record<string, number>>>>): Rule =>
  (s) => {
    const prompt = s.pendingChoice?.prompt as { kind: string; what?: string } | undefined;
    if (prompt?.kind !== "divide" || !prompt.what || !shares[prompt.what]) return undefined;
    return Object.entries(shares[prompt.what]!).flatMap(([id, n]) =>
      Array.from({ length: n }, (_, i) => `${id}#${i + 1}`),
    );
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

/** Plays `code` from the staged hand paying `cost` with fillers. */
function playStaged(
  s: GameState,
  code: string,
  cost: number,
  o: {
    pick?: Picker;
    attach?: InstanceId;
    p?: PlayerId;
    except?: readonly InstanceId[];
    costChoices?: Record<string, readonly InstanceId[]>;
  } = {},
): { readonly state: GameState; readonly id: InstanceId; readonly events: readonly unknown[] } {
  const p = o.p ?? P1;
  const given = moveToHand(s, p, code);
  const id = given.ids[0]!;
  const payers = playerOf(given.state, p)
    .hand.filter((h) => h !== id && !(o.except ?? []).includes(h) && iconsOf(given.state, h) > 0)
    .slice(0, cost);
  if (payers.length < cost) throw new Error(`not enough resource cards to pay ${cost} for ${code}`);
  const { state, events } = driveEventsPicking(
    DEPS,
    given.state,
    o.pick ?? firstLegal,
    play(p, id, payers, {
      ...(o.attach ? { attachToInstanceId: o.attach } : {}),
      ...(o.costChoices ? { costChoices: o.costChoices } : {}),
    }),
  );
  return { state, id, events };
}

describe("aspect-basic registry", () => {
  it.each(ALL_REFS)("%s validates", (id) => {
    expect(validateDefinition(NCRAWLER_ASPECT_BASIC[id]!)).toEqual([]);
  });
  it("holds exactly these refs, Rogue's included", () => {
    expect(Object.keys(NCRAWLER_ASPECT_BASIC).sort()).toEqual([...ALL_REFS].sort());
    expect("48012.rogue-action" in NCRAWLER_ASPECT_BASIC).toBe(true);
  });
  it("the three reprints are the very definitions of the cards they reprint (one script, two ids)", () => {
    expect(NCRAWLER_ASPECT_BASIC[PUNCH]).toBe(WAVE7_ABILITIES["32014.powerful-punch-constant"]);
    expect(NCRAWLER_ASPECT_BASIC[PROTECTION]).toBe(WAVE7_ABILITIES["01079.the-power-of-protection-constant"]);
    expect(NCRAWLER_ASPECT_BASIC[MOIRA]).toBe(WAVE7_ABILITIES["38018.moira-mactaggert-response"]);
  });
  it("Change of Fortune's trigger is the identity's defeat in the villain phase: the defeating source is never an ally (RRG p. 49)", () => {
    const definition = NCRAWLER_ASPECT_BASIC[FORTUNE]!;
    const trigger = definition.trigger as { on: { sourceIs?: unknown; playerIs?: string }; while?: unknown };
    expect(trigger.on.playerIs).toBe("controller");
    expect(trigger.on.sourceIs).toEqual({ not: { categories: ["ally"] } });
    expect(trigger.while).toEqual({ kind: "gameStep", phase: "villain" });
  });
  it("Energy, Genius and Strength (48023 to 48025) print no ability; each is 2 resources of its type", () => {
    for (const [code, icon] of [
      ["48023", "energy"],
      ["48024", "mental"],
      ["48025", "physical"],
    ] as const) {
      const card = BY_ID.get(code) as unknown as { abilities: unknown[]; producesIcons: Record<string, number> };
      expect(card.abilities).toEqual([]);
      expect(card.producesIcons).toEqual({ [icon]: 2 });
    }
  });
});

describe("Gambit (48021): tucks an encounter card, reads its boost icons as his base THW and ATK (§3.74 proof)", () => {
  /** Gambit played in hero form with these three encounter cards on top, tucking `choose` (a code) when `accepting`. */
  function gambit(
    top: readonly string[],
    choose: string | null,
    seats: readonly Seat[] = [NC()],
  ): { state: GameState; id: InstanceId; before: GameState; seen: { kind: string; options: string[] }[] } {
    const base = stackEncounterDeck(heroGame(seats, MODULAR), ...top);
    const staged = stage(base, ["48021"]).state;
    const probe = spy(
      picker(
        ...(choose === null
          ? []
          : [
              accept(GAMBIT_RESPONSE),
              (s: GameState) => {
                const c = s.pendingChoice;
                if (c?.prompt.kind !== "chooseCards") return undefined;
                const hit = c.options.find((o) => o.label === (BY_ID.get(choose) as { name: string }).name);
                return hit ? [hit.optionId] : undefined;
              },
            ]),
      ),
    );
    const { state, id } = playStaged(staged, "48021", 3, { pick: probe.pick });
    return { state, id, before: staged, seen: probe.seen };
  }

  it("cost 3: he enters play, the player is asked among exactly the top 3 encounter cards, and the one tucked is under him", () => {
    const { state, id, before, seen } = gambit([RADIOACTIVE_MAN, ADVANCE, BREAKIN, MERCENARY], BREAKIN);
    expect(playerOf(state, P1).playArea).toContain(id);
    expect(playerOf(state, P1).hand).toHaveLength(playerOf(before, P1).hand.length - 4);
    const ask = seen.find((p) => p.kind === "chooseCards")!;
    expect(ask.options).toHaveLength(3);
    expect(ask.options.map((o) => codeOf(before, o as InstanceId))).toEqual([RADIOACTIVE_MAN, ADVANCE, BREAKIN]);
    expect(inst(state, id).tucked.map((t) => codeOf(state, t))).toEqual([BREAKIN]);
    // The two not chosen are still the top two cards, in their order, and the fourth is next.
    expect(encounterTop(state, 3)).toEqual([RADIOACTIVE_MAN, ADVANCE, MERCENARY]);
    expect(encounterTop(before, 4)).toEqual([RADIOACTIVE_MAN, ADVANCE, BREAKIN, MERCENARY]);
  });
  it("a 2-icon card under him: THW 2 and ATK 2 (X is the printed boost icons)", () => {
    const { state, id } = gambit([ADVANCE, BREAKIN, RADIOACTIVE_MAN], BREAKIN);
    expect(profile(state, id)).toMatchObject({ thw: 2, atk: 2 });
  });
  it("a 3-icon card: THW 3 and ATK 3", () => {
    const { state, id } = gambit([ADVANCE, LEGIONS, RADIOACTIVE_MAN], LEGIONS);
    expect(profile(state, id)).toMatchObject({ thw: 3, atk: 3 });
  });
  it("a 0-icon card with a star Boost (Radioactive Man): THW 0 and ATK 0, a star is no icon", () => {
    const { state, id } = gambit([RADIOACTIVE_MAN, ADVANCE, BREAKIN], RADIOACTIVE_MAN);
    expect(profile(state, id)).toMatchObject({ thw: 0, atk: 0 });
  });
  it("the Response is optional: declined, nothing is tucked, the deck is untouched and X is 0", () => {
    const { state, id, before } = gambit([ADVANCE, BREAKIN, RADIOACTIVE_MAN], null);
    expect(inst(state, id).tucked).toEqual([]);
    expect(encounterTop(state, 3)).toEqual(encounterTop(before, 3));
    expect(profile(state, id)).toMatchObject({ thw: 0, atk: 0 });
  });
  it("with a Core hero in the seat (Spider-Man): the same, 2 icons give 2 and 2", () => {
    const { state, id } = gambit([ADVANCE, BREAKIN, RADIOACTIVE_MAN], BREAKIN, [CORE("48021")]);
    expect(inst(state, id).tucked.map((t) => codeOf(state, t))).toEqual([BREAKIN]);
    expect(profile(state, id)).toMatchObject({ thw: 2, atk: 2 });
  });
  it("his 0 THW thwarts nothing and he takes 1 consequential damage for it", () => {
    const { state: s0, id } = gambit([RADIOACTIVE_MAN, ADVANCE, BREAKIN], RADIOACTIVE_MAN);
    const staged = encounterCardInVillainArea(s0, LEGIONS, 4);
    const ready = patchInstance(staged.state, id, { exhausted: false });
    const { state } = driveEventsPicking(DEPS, ready, firstLegal, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: id,
      schemeInstanceId: staged.id,
    });
    expect(inst(state, staged.id).threat).toBe(4);
    expect(inst(state, id).damage).toBe(1);
  });
  it("defeated, the card under him goes to the encounter discard pile", () => {
    const { state: s0, id } = gambit([ADVANCE, BREAKIN, RADIOACTIVE_MAN], BREAKIN);
    const tucked = inst(s0, id).tucked[0]!;
    const dying = patchInstance(s0, id, { damage: 3 });
    const { state } = driveEventsPicking(DEPS, dying, firstLegal, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(dying),
      targetInstanceId: dying.activeVillainId!,
    });
    expect(playerOf(state, P1).playArea).not.toContain(id);
    expect(activeEncounterDeck(state).discard).toContain(tucked);
    expect(playerOf(state, P1).discard).toContain(id);
  });
});

const CROWD_CONTROL = "01108"; // Rhino: side scheme, 2 icons: a benign card to be dealt after the activation under test
const HARD_TO_KEEP_DOWN = "01104"; // Rhino: treachery, 0 icons

/**
 * The hero ends their turn and the villain phase runs with `stack` on top of the encounter deck (the first card is the
 * villain's boost card). Answers prompts with `pick` until the prompts stop or `stop` holds.
 */
function villainPhase(
  s: GameState,
  stack: readonly string[],
  pick: Picker,
  more: readonly Command[] = [],
): {
  readonly state: GameState;
  readonly seen: { kind: string; options: string[] }[];
  readonly events: readonly { type: string; [key: string]: unknown }[];
} {
  const probe = spy(pick);
  const events: { type: string; [key: string]: unknown }[] = [];
  let state = stackEncounterDeck(s, ...stack);
  for (const command of [endTurn(P1), ...more]) {
    const result = applyCommand(state, command, DEPS);
    if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.message}`);
    events.push(...(result.events as typeof events));
    state = result.state;
  }
  while (state.pendingChoice && !state.outcome) {
    const choice = state.pendingChoice;
    const result = applyCommand(
      state,
      {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: probe.pick(state),
      },
      DEPS,
    );
    if (!result.ok) throw new Error(`choice rejected: ${result.error.message}`);
    events.push(...(result.events as typeof events));
    state = result.state;
  }
  return { state, seen: probe.seen, events };
}

describe("Northstar (48013): cancel the icons of a boost card for 1 damage to him", () => {
  const withNorthstar = (seats: readonly Seat[] = [NC()], hero = true): { state: GameState; id: InstanceId } => {
    const base = hero ? heroGame(seats) : setupGame(seats);
    const staged = stage(base, ["48013"]).state;
    const played = playStaged(staged, "48013", 3);
    return { state: played.state, id: played.id };
  };

  it("Rhino attacks Nightcrawler with a 2-icon boost card: cancelled, no damage (2 ATK against 3 DEF), Northstar takes 1", () => {
    const { state: s, id } = withNorthstar();
    expect(inst(s, id).damage).toBe(0);
    const { state, seen } = villainPhase(s, [BREAKIN, CROWD_CONTROL], picker(defend(identityOf(s)), accept(NORTHSTAR)));
    expect(offered(seen, NORTHSTAR)).toBe(true);
    expect(inst(state, identityOf(state)).damage).toBe(0);
    expect(inst(state, id).damage).toBe(1);
    expect(encounterDiscard(state)).toContain(BREAKIN);
  });
  it("declined: the 2 icons count and Nightcrawler takes 2 + 2 - 3 = 1, Northstar takes none", () => {
    const { state: s, id } = withNorthstar();
    const { state } = villainPhase(s, [BREAKIN, CROWD_CONTROL], picker(defend(identityOf(s))));
    expect(inst(state, identityOf(state)).damage).toBe(1);
    expect(inst(state, id).damage).toBe(0);
  });
  it("a boost card with no icons is not offered and costs no damage (Attacrobatics, RRG p. 59)", () => {
    const { state: s, id } = withNorthstar();
    const { state, seen } = villainPhase(
      s,
      [HARD_TO_KEEP_DOWN, BREAKIN],
      picker(defend(identityOf(s)), accept(NORTHSTAR)),
    );
    expect(offered(seen, NORTHSTAR)).toBe(false);
    expect(inst(state, id).damage).toBe(0);
  });
  it("a scheme activation's boost card is not answered: Rhino schemes against the alter-ego", () => {
    const { state: s, id } = withNorthstar([NC()], false);
    expect(playerOf(s, P1).identity.form).toBe("alterEgo");
    const { state, seen } = villainPhase(s, [BREAKIN, CROWD_CONTROL], picker(accept(NORTHSTAR)));
    expect(offered(seen, NORTHSTAR)).toBe(false);
    expect(inst(state, id).damage).toBe(0);
    expect(encounterDiscard(state)).toContain(BREAKIN);
  });
  it("answers an attack on another player: two players, Spider-Man is attacked second, both boost cards are cancelled", () => {
    const seats = [NC(), CORE()];
    const { state: s, id } = withNorthstar(seats);
    const ready = withForm(s, { heroForm: 0 }, P2);
    // He is used on the two stacked boost cards only: a third attack comes from the deal, and he has 3 hit points.
    let uses = 0;
    const northstarTwice: Rule = (st) => {
      const hit = accept(NORTHSTAR)(st);
      if (!hit) return undefined;
      return ++uses <= 2 ? hit : [];
    };
    const probe = spy(picker(defend(identityOf(ready)), northstarTwice));
    let state = runWith(DEPS, stackEncounterDeck(ready, BREAKIN, CROWD_CONTROL), endTurn(P1), endTurn(P2));
    state = settle(state, probe.pick, undefined, DEPS);
    const offers = probe.seen.filter(
      (p) => p.kind === "chooseTriggers" && p.options.some((o) => o.includes(NORTHSTAR)),
    );
    expect(offers.length).toBeGreaterThanOrEqual(2);
    expect(inst(state, id).damage).toBe(2);
    expect(encounterDiscard(state)).toEqual(expect.arrayContaining([BREAKIN, CROWD_CONTROL]));
  });
});

const HARD_BOOST_0 = HARD_TO_KEEP_DOWN;

/** Surgery: a minion from the encounter deck into this player's play area, engaged and faceup, as if it had been put into play. */
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
/** Rhino's next activation is stunned away, so a villain phase under test starts with the minions. */
const rhinoStunned = (s: GameState): GameState =>
  patchInstance(s, s.activeVillainId!, { statuses: { ...inst(s, s.activeVillainId!).statuses, stunned: 1 } });

describe("Riposte (48018): +2 DEF, and 3 damage to the attacker if you take none", () => {
  const withRiposte = (seats: readonly Seat[] = [NC()]) => stage(heroGame(seats), ["48018"]);

  it("Rhino (ATK 2, boost 0) against DEF 3 + 2: no damage; Rhino takes 3, Riposte is paid with 1 card and discarded", () => {
    const { state: s, ids } = withRiposte();
    const { state, seen } = villainPhase(
      s,
      [HARD_BOOST_0, BREAKIN],
      picker(defend(identityOf(s)), accept(RIPOSTE), pay(1)),
    );
    expect(offered(seen, RIPOSTE)).toBe(true);
    expect(inst(state, state.activeVillainId!).damage).toBe(3);
    expect(inst(state, identityOf(state)).damage).toBe(0);
    expect(playerOf(state, P1).discard).toContain(ids[0]);
    expect(playerOf(state, P1).discard).toHaveLength(2);
  });
  it("the +2 DEF is for that attack: a 2-icon boost card makes Rhino 4 against DEF 5, still no damage", () => {
    const { state: s } = withRiposte();
    const { state } = villainPhase(s, [BREAKIN, CROWD_CONTROL], picker(defend(identityOf(s)), accept(RIPOSTE), pay(1)));
    expect(inst(state, identityOf(state)).damage).toBe(0);
    expect(inst(state, state.activeVillainId!).damage).toBe(3);
  });
  it("Nightcrawler against Rhino (ATK 2) with a 3-icon boost card: 5 against DEF 5 is no damage, so Rhino takes 3", () => {
    const { state: s } = withRiposte();
    const { state } = villainPhase(s, [LEGIONS, CROWD_CONTROL], picker(defend(identityOf(s)), accept(RIPOSTE), pay(1)));
    expect(inst(state, identityOf(state)).damage).toBe(0);
    expect(inst(state, state.activeVillainId!).damage).toBe(3);
  });
  it("damage taken: Black Panther (DEF 2 + 2) against 2 + 3 icons takes 1 and the attacker is not hurt", () => {
    const { state: s } = withRiposte([BP("48018")]);
    const { state, seen } = villainPhase(
      s,
      [LEGIONS, CROWD_CONTROL],
      picker(defend(identityOf(s)), accept(RIPOSTE), pay(1)),
    );
    expect(offered(seen, RIPOSTE)).toBe(true);
    expect(inst(state, identityOf(state)).damage).toBe(1);
    // Only Black Panther's own Retaliate 1 hurt Rhino: Riposte's 3 damage needs the attack to deal none.
    expect(inst(state, state.activeVillainId!).damage).toBe(1);
  });
  it("without Riposte the same attack deals 5 - 2 = 3 to Black Panther", () => {
    const s = heroGame([BP()]);
    const { state } = villainPhase(s, [LEGIONS, CROWD_CONTROL], picker(defend(identityOf(s))));
    expect(inst(state, identityOf(state)).damage).toBe(3);
  });
  it("only when the hero defends: with no defender declared it is not offered", () => {
    const { state: s } = withRiposte();
    const { seen } = villainPhase(s, [HARD_BOOST_0, BREAKIN], picker(accept(RIPOSTE), pay(1)));
    expect(offered(seen, RIPOSTE)).toBe(false);
  });
  it("it is an interrupt, not an action: it cannot be played in the player phase", () => {
    const { state: s, ids } = withRiposte();
    expect(accepted(s, play(P1, ids[0]!, [playerOf(s, P1).hand.find((h) => h !== ids[0])!]))).toBe(false);
  });
  it("Black Panther (Core, Protection) plays it too: his DEF 2 + 2 stops Rhino's 2, and Rhino takes 3 + 1 (his Retaliate 1)", () => {
    const { state: s } = withRiposte([BP("48018")]);
    const { state, seen } = villainPhase(
      s,
      [HARD_BOOST_0, CROWD_CONTROL],
      picker(defend(identityOf(s)), accept(RIPOSTE), pay(1)),
    );
    expect(offered(seen, RIPOSTE)).toBe(true);
    expect(inst(state, identityOf(state)).damage).toBe(0);
    expect(inst(state, state.activeVillainId!).damage).toBe(4);
  });
});

/** Declares `defender` only against `enemy`'s attack; any other attack goes undefended. */
const defendAgainst =
  (enemy: InstanceId, defender: InstanceId): Rule =>
  (st) => {
    const c = st.pendingChoice;
    if (c?.prompt.kind !== "declareDefender") return undefined;
    const attacker = (c.prompt as unknown as { attack: { enemyInstanceId: string } }).attack.enemyInstanceId;
    return attacker === enemy && c.options.some((o) => o.optionId === defender) ? [defender] : ["decline"];
  };

describe("Under Control (48015): 4 damage to the attached minion after a hero defends its attack and takes none", () => {
  const SHOCKER = "01103"; // Rhino: minion ATK 2, 3 hit points, 2 icons
  /** Melter engaged with Nightcrawler (or another hero) and Under Control attached, Rhino stunned so only minions activate. */
  function attached(seat: Seat = NC(), extraMinion?: string) {
    const base = stage(heroGame([seat]), ["48015"]).state;
    const melter = engage(base, MELTER);
    const other = extraMinion ? engage(melter.state, extraMinion) : undefined;
    const placed = playStaged(other?.state ?? melter.state, "48015", 0, { attach: melter.id });
    return { state: rhinoStunned(placed.state), melter: melter.id, control: placed.id, other: other?.id };
  }

  it("cost 0: attached to the minion, nothing paid; Melter (ATK 3) against DEF 3 deals no damage, so it takes 4 (5 hit points)", () => {
    const { state: s, melter, control } = attached();
    expect(inst(s, control).attachedTo).toBe(melter);
    expect(playerOf(s, P1).hand).toHaveLength(4);
    const { state, seen } = villainPhase(s, [CROWD_CONTROL, BREAKIN], picker(defend(identityOf(s)), accept(CONTROL)));
    expect(offered(seen, CONTROL)).toBe(true);
    expect(inst(state, identityOf(state)).damage).toBe(0);
    expect(inst(state, melter).damage).toBe(4);
    expect(inst(state, control).attachedTo).toBe(melter);
  });
  it("declined: Melter takes nothing", () => {
    const { state: s, melter } = attached();
    const { state } = villainPhase(s, [CROWD_CONTROL, BREAKIN], picker(defend(identityOf(s))));
    expect(inst(state, melter).damage).toBe(0);
  });
  it("the defender took damage: Black Panther (DEF 2) takes 1, it is not offered, Melter has only his Retaliate 1", () => {
    const { state: s, melter } = attached(BP("48015"));
    const { state, seen } = villainPhase(s, [CROWD_CONTROL, BREAKIN], picker(defend(identityOf(s)), accept(CONTROL)));
    expect(offered(seen, CONTROL)).toBe(false);
    expect(inst(state, identityOf(state)).damage).toBe(1);
    expect(inst(state, melter).damage).toBe(1);
  });
  it("no hero defended: Melter hits Nightcrawler for 3 and the Response is not offered", () => {
    const { state: s, melter } = attached();
    const { state, seen } = villainPhase(s, [CROWD_CONTROL, BREAKIN], picker(accept(CONTROL)));
    expect(offered(seen, CONTROL)).toBe(false);
    expect(inst(state, identityOf(state)).damage).toBe(3);
    expect(inst(state, melter).damage).toBe(0);
  });
  it("only the attached minion's attack: a defense against another minion (Hydra Mercenary) offers nothing", () => {
    const { state: s, melter, other } = attached(NC(), MERCENARY);
    const { state, seen } = villainPhase(
      s,
      [CROWD_CONTROL, BREAKIN],
      picker(defendAgainst(other!, identityOf(s)), accept(CONTROL)),
    );
    expect(offered(seen, CONTROL)).toBe(false);
    expect(inst(state, melter).damage).toBe(0);
    expect(inst(state, other!).damage).toBe(0);
  });
  it("Max 1 per minion: a second copy cannot be attached to the same minion", () => {
    const base = stage(heroGame(), ["48015"]).state;
    const melter = engage(base, MELTER);
    const first = playStaged(melter.state, "48015", 0, { attach: melter.id });
    const second = moveToHand(first.state, P1, "48015");
    expect(accepted(second.state, play(P1, second.ids[0]!, [], { attachToInstanceId: melter.id }))).toBe(false);
  });
  it("it attaches to a minion only: not to the villain, not to a hero", () => {
    const base = stage(heroGame(), ["48015"]).state;
    const given = moveToHand(base, P1, "48015");
    expect(
      accepted(given.state, play(P1, given.ids[0]!, [], { attachToInstanceId: given.state.activeVillainId! })),
    ).toBe(false);
    expect(accepted(given.state, play(P1, given.ids[0]!, [], { attachToInstanceId: identityOf(given.state) }))).toBe(
      false,
    );
  });
  it("works from any deck: with Black Panther (DEF 2) Shocker (ATK 2) is stopped, offered, and 4 damage defeats its 3 hit points", () => {
    const base = stage(heroGame([BP("48015")]), ["48015"]).state;
    const shocker = engage(base, SHOCKER);
    const placed = playStaged(shocker.state, "48015", 0, { attach: shocker.id });
    const s = rhinoStunned(placed.state);
    const { state, seen } = villainPhase(s, [CROWD_CONTROL, BREAKIN], picker(defend(identityOf(s)), accept(CONTROL)));
    expect(offered(seen, CONTROL)).toBe(true);
    expect(inst(state, identityOf(state)).damage).toBe(0);
    expect(playerOf(state, P1).playArea).not.toContain(shocker.id);
    expect(encounterDiscard(state)).toContain(SHOCKER);
    expect(playerOf(state, P1).discard).toContain(placed.id);
  });
});

describe('"Come Get Me, Bub!" (48016): discard until a minion, put it into play engaged, then heal 3 and give tough', () => {
  const SHOCKER = "01103";
  const bub = (seat: Seat = NC(), damage = 4) => {
    const s = stage(heroGame([seat]), ["48016"]).state;
    return withDamage(s, identityOf(s), damage);
  };
  const playBub = (s: GameState, stack: readonly string[]) => {
    const staged = stackEncounterDeck(s, ...stack);
    const given = moveToHand(staged, P1, "48016");
    const { state } = driveEventsPicking(DEPS, given.state, firstLegal, play(P1, given.ids[0]!, []));
    return { state, before: given.state, id: given.ids[0]! };
  };

  it("cost 0: two non-minions are discarded, the minion is put into play engaged with you, 4 damage heals 3 and a tough card is given", () => {
    const { state, before, id } = playBub(bub(), [BREAKIN, CROWD_CONTROL, MERCENARY]);
    const minion = inPlay(state, MERCENARY)[0]!;
    expect(playerOf(state, P1).playArea).toContain(minion);
    expect(inst(state, minion).engagedWith).toBe(P1);
    expect(encounterDiscard(state).sort()).toEqual([BREAKIN, CROWD_CONTROL].sort());
    expect(activeEncounterDeck(state).deck).toHaveLength(activeEncounterDeck(before).deck.length - 3);
    expect(inst(state, identityOf(state)).damage).toBe(1);
    expect(inst(state, identityOf(state)).statuses.tough).toBe(1);
    expect(playerOf(state, P1).discard).toContain(id);
    expect(playerOf(state, P1).hand).toHaveLength(playerOf(before, P1).hand.length - 1);
  });
  it("healing stops at the damage there is: 2 damage heals 2", () => {
    const { state } = playBub(bub(NC(), 2), [MERCENARY]);
    expect(inst(state, identityOf(state)).damage).toBe(0);
    expect(inst(state, identityOf(state)).statuses.tough).toBe(1);
  });
  it("the minion is not revealed: Shocker's When Revealed (1 damage to each hero) does not happen", () => {
    const { state } = playBub(bub(), [SHOCKER]);
    expect(inst(state, identityOf(state)).damage).toBe(1);
    expect(inPlay(state, SHOCKER)).toHaveLength(1);
  });
  it("Toughness answers the entering: Sandman arrives with a tough status card", () => {
    const { state } = playBub(bub(), [SANDMAN]);
    expect(inst(state, inPlay(state, SANDMAN)[0]!).statuses.tough).toBe(1);
    expect(inst(state, identityOf(state)).statuses.tough).toBe(1);
  });
  it("an encounter deck with no minion: the cost is not paid, so there is no heal, no tough card and no minion", () => {
    const s = bub();
    const deckId = activeEncounterDeckId(s);
    const pile = s.encounterDecks[deckId]!;
    const noMinions = {
      ...s,
      encounterDecks: {
        ...s.encounterDecks,
        [deckId]: {
          deck: pile.deck.filter((i) => (BY_ID.get(codeOf(s, i)) as { type: string }).type !== "minion"),
          discard: pile.discard.filter((i) => (BY_ID.get(codeOf(s, i)) as { type: string }).type !== "minion"),
        },
      },
    };
    const given = moveToHand(noMinions, P1, "48016");
    const { state } = driveEventsPicking(DEPS, given.state, firstLegal, play(P1, given.ids[0]!, []));
    expect(inst(state, identityOf(state)).damage).toBe(4);
    expect(inst(state, identityOf(state)).statuses.tough).toBe(0);
    expect(
      playerOf(state, P1).playArea.filter((i) => (BY_ID.get(codeOf(state, i)) as { type: string }).type === "minion"),
    ).toEqual([]);
  });
  it("it is a Hero Action: refused in alter-ego form", () => {
    const s = stage(setupGame(), ["48016"]).state;
    const given = moveToHand(stackEncounterDeck(s, MERCENARY), P1, "48016");
    expect(accepted(given.state, play(P1, given.ids[0]!, []))).toBe(false);
  });
  it("works from any deck: Black Panther (Protection precon) heals 3 of 5 damage and gets a tough card", () => {
    const { state } = playBub(bub(BP("48016"), 5), [MERCENARY]);
    expect(inst(state, identityOf(state)).damage).toBe(2);
    expect(inst(state, identityOf(state)).statuses.tough).toBe(1);
    expect(inPlay(state, MERCENARY)).toHaveLength(1);
  });
});

describe("Change of Fortune (48014): after you defeat an enemy in the villain phase, exhaust it to draw 2", () => {
  /** Change of Fortune in play (cost 1) with Mercenary engaged, Rhino stunned, and these cards staged in hand. */
  function fortune(seat: Seat, hand: readonly string[], mercenaryDamage = 0) {
    const base = stage(heroGame([seat]), ["48014", ...hand]).state;
    const merc = engage(base, MERCENARY);
    const played = playStaged(merc.state, "48014", 1, {
      except: hand.map((h) => moveToHand(merc.state, P1, h).ids[0]!),
    });
    return {
      state: rhinoStunned(patchInstance(played.state, merc.id, { damage: mercenaryDamage })),
      merc: merc.id,
      fortune: played.id,
    };
  }
  const handAndDeck = (s: GameState) => ({ hand: playerOf(s, P1).hand.length, deck: playerOf(s, P1).deck.length });

  it("Riposte's 3 damage defeats Hydra Mercenary (3 hit points) in the villain phase: draw 2, Change of Fortune exhausted", () => {
    const { state: s, merc, fortune: card } = fortune(NC(), ["48018"]);
    expect(inst(s, card).exhausted).toBe(false);
    const before = handAndDeck(s);
    const { state, seen } = villainPhase(
      s,
      [CROWD_CONTROL, BREAKIN],
      picker(defendAgainst(merc, identityOf(s)), accept(RIPOSTE), pay(1), accept(FORTUNE)),
    );
    expect(offered(seen, FORTUNE)).toBe(true);
    expect(encounterDiscard(state)).toContain(MERCENARY);
    expect(inst(state, card).exhausted).toBe(true);
    // Riposte and its payment left the hand (-2), the 2 cards drawn came back; the end of the round then refills the hand to 5.
    expect(handAndDeck(state).deck).toBeLessThan(before.deck);
  });
  it("its Retaliate counts too: Black Panther's Retaliate 1 defeats a Mercenary left with 1 hit point; exactly 2 cards are drawn for it", () => {
    const { state: s, merc, fortune: card } = fortune(BP("48014"), [], 2);
    const { state, seen, events } = villainPhase(
      s,
      [CROWD_CONTROL, BREAKIN],
      picker(defendAgainst(merc, identityOf(s)), accept(FORTUNE)),
    );
    expect(offered(seen, FORTUNE)).toBe(true);
    expect(encounterDiscard(state)).toContain(MERCENARY);
    expect(inst(state, card).exhausted).toBe(true);
    const at = events.findIndex((e) => e.type === "abilityResolved" && e.abilityId === FORTUNE);
    expect(at).toBeGreaterThan(-1);
    const drawn = events.slice(at).filter((e) => e.type === "cardDrawn");
    // The two it draws come right after it; the end of the round draws none more (the hand is back at its limit of 5).
    expect(events.slice(at, at + 6).filter((e) => e.type === "cardDrawn")).toHaveLength(2);
    expect(drawn).toHaveLength(2);
  });
  it("declined: Change of Fortune stays ready and the end of the round alone refills the hand", () => {
    const { state: s, merc, fortune: card } = fortune(BP("48014"), [], 2);
    const { state, events } = villainPhase(s, [CROWD_CONTROL, BREAKIN], picker(defendAgainst(merc, identityOf(s))));
    expect(encounterDiscard(state)).toContain(MERCENARY);
    expect(inst(state, card).exhausted).toBe(false);
    expect(events.some((e) => e.type === "abilityResolved" && e.abilityId === FORTUNE)).toBe(false);
  });
  it("it exhausts: a second defeat in the same villain phase does not offer it again", () => {
    const base = stage(heroGame([BP("48014")]), ["48014"]).state;
    const first = engage(base, MERCENARY);
    const second = engage(first.state, MERCENARY);
    const placed = playStaged(second.state, "48014", 1);
    const wounded = patchInstance(patchInstance(placed.state, first.id, { damage: 2 }), second.id, { damage: 2 });
    // Black Panther defends the first attack (Retaliate 1 defeats it), is attacked again by the second while exhausted
    // (Retaliate 1 defeats that one too).
    const { state, seen, events } = villainPhase(
      rhinoStunned(wounded),
      [CROWD_CONTROL, BREAKIN],
      picker(defendAgainst(first.id, identityOf(wounded)), accept(FORTUNE)),
    );
    expect(encounterDiscard(state)).toEqual(expect.arrayContaining([MERCENARY]));
    expect(encounterDiscard(state).filter((c) => c === MERCENARY)).toHaveLength(2);
    expect(seen.filter((p) => p.kind === "chooseTriggers" && p.options.some((o) => o.includes(FORTUNE)))).toHaveLength(
      1,
    );
    expect(events.filter((e) => e.type === "abilityResolved" && e.abilityId === FORTUNE)).toHaveLength(1);
  });
  it("in the player phase it is not offered: Nightcrawler's own basic attack defeats the wounded Mercenary", () => {
    const { state: s, merc } = fortune(NC(), [], 2);
    const probe = spy(picker(accept(FORTUNE)));
    const { state } = driveEventsPicking(DEPS, s, probe.pick, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(s),
      targetInstanceId: merc,
    });
    expect(encounterDiscard(state)).toContain(MERCENARY);
    expect(offered(probe.seen, FORTUNE)).toBe(false);
  });
  it("Max 1 per player: a second copy is not played", () => {
    const { state: s } = fortune(BP("48014", "48014"), []);
    const second = moveToHand(s, P1, "48014");
    const pay1 = playerOf(second.state, P1).hand.find((h) => h !== second.ids[0])!;
    expect(accepted(second.state, play(P1, second.ids[0]!, [pay1]))).toBe(false);
  });
});

describe("Powerful Punch (48017), reprint of 32014: 4 damage to an enemy that initiates an attack", () => {
  it("Rhino's attack: cost 2 paid, Rhino takes 4, the event is discarded, and Nightcrawler still defends", () => {
    const { state: s, ids } = stage(heroGame(), ["48017"]);
    const { state, seen } = villainPhase(
      s,
      [HARD_BOOST_0, BREAKIN],
      picker(accept(PUNCH), pay(2), defend(identityOf(s))),
    );
    expect(offered(seen, PUNCH)).toBe(true);
    expect(inst(state, state.activeVillainId!).damage).toBe(4);
    expect(inst(state, identityOf(state)).damage).toBe(0);
    expect(playerOf(state, P1).discard).toContain(ids[0]);
    expect(playerOf(state, P1).discard).toHaveLength(3);
  });
});

describe("The Power of Protection (48019), reprint of 01079: its resource counts double for a Protection card", () => {
  const withPower = (seat: Seat, card: string) => {
    const { state, ids, fill } = stage(heroGame([seat]), [card, "48019"], 3);
    return { state, card: ids[0]!, power: ids[1]!, filler: fill[0]! };
  };
  it("Northstar (Protection, cost 3) is paid by it and 1 other card: 2 + 1", () => {
    const { state, card, power, filler } = withPower(NC(), "48013");
    const { state: after } = driveEventsPicking(DEPS, state, firstLegal, play(P1, card, [power, filler]));
    expect(playerOf(after, P1).playArea).toContain(card);
    expect(playerOf(after, P1).discard).toEqual(expect.arrayContaining([power, filler]));
  });
  it("Gambit (basic, cost 3) is not: it and 1 other card pay 2 and are refused, 2 other cards make 3", () => {
    const { state, card, power, filler } = withPower(NC(), "48021");
    expect(accepted(state, play(P1, card, [power, filler]))).toBe(false);
    const another = playerOf(state, P1).hand.find((h) => ![card, power, filler].includes(h) && iconsOf(state, h) > 0)!;
    expect(accepted(state, play(P1, card, [power, filler, another]))).toBe(true);
  });
});

describe("Moira MacTaggert (48022), reprint of 38018: draw 1 when a MUTANT alter-ego changes into hero form", () => {
  it("Kurt Wagner (MUTANT) plays her for 2; changing to hero form offers the Response: the hand grows by 1 and she is exhausted", () => {
    const { state: s } = stage(setupGame(), ["48022"]);
    const played = playStaged(s, "48022", 2);
    const handBefore = playerOf(played.state, P1).hand.length;
    const probe = spy(picker(accept(MOIRA)));
    const { state } = driveEventsPicking(DEPS, played.state, probe.pick, { type: "changeForm", playerId: P1 });
    expect(offered(probe.seen, MOIRA)).toBe(true);
    expect(playerOf(state, P1).identity.form).toBe("hero");
    expect(playerOf(state, P1).hand).toHaveLength(handBefore + 1);
    expect(inst(state, played.id).exhausted).toBe(true);
  });
  it("declined: no card is drawn and she stays ready", () => {
    const { state: s } = stage(setupGame(), ["48022"]);
    const played = playStaged(s, "48022", 2);
    const handBefore = playerOf(played.state, P1).hand.length;
    const { state } = driveEventsPicking(DEPS, played.state, firstLegal, { type: "changeForm", playerId: P1 });
    expect(playerOf(state, P1).hand).toHaveLength(handBefore);
    expect(inst(state, played.id).exhausted).toBe(false);
  });
  it("Play only if your identity is MUTANT: refused in hero form (X-MEN), and refused for Black Panther", () => {
    const hero = moveToHand(stage(heroGame(), ["48022"]).state, P1, "48022");
    expect(accepted(hero.state, play(P1, hero.ids[0]!, payWithFirst(hero.state, 2, hero.ids[0]!)))).toBe(false);
    const bp = moveToHand(stage(setupGame([BP("48022")]), ["48022"]).state, P1, "48022");
    expect(accepted(bp.state, play(P1, bp.ids[0]!, payWithFirst(bp.state, 2, bp.ids[0]!)))).toBe(false);
  });
});

function payWithFirst(s: GameState, n: number, except: InstanceId): InstanceId[] {
  return playerOf(s, P1)
    .hand.filter((h) => h !== except && iconsOf(s, h) > 0)
    .slice(0, n);
}

describe("Astonishing X-Men (48020): a player side scheme with 5 threat", () => {
  const SM_TRAP = "41016"; // Lay the Trap (`psylocke`): another player side scheme, to meet the limit
  const scheme = (seat: Seat = NC(), legal = true) => {
    const base = stage(heroGame([seat], MODULAR, 1, legal), ["48020"]).state;
    const played = playStaged(base, "48020", 1);
    return { state: played.state, id: played.id, before: base };
  };

  it("cost 1: it enters play in the villain area with 5 threat (not per hero), the hand is 2 smaller", () => {
    const { state, id, before } = scheme();
    expect(state.villainArea).toContain(id);
    expect(inst(state, id).threat).toBe(5);
    expect(playerOf(state, P1).hand).toHaveLength(playerOf(before, P1).hand.length - 2);
  });
  it("two players: still 5 threat", () => {
    const base = stage(heroGame([NC(), CORE()]), ["48020"]).state;
    const { state, id } = playStaged(base, "48020", 1);
    expect(inst(state, id).threat).toBe(5);
  });
  it("Response: Nightcrawler (X-MEN) defends Rhino and takes no damage: 1 threat is removed from it (5 to 4)", () => {
    const { state: s, id } = scheme();
    const { state, seen } = villainPhase(
      s,
      [HARD_BOOST_0, BREAKIN],
      picker(defend(identityOf(s)), accept(XMEN_RESPONSE)),
    );
    expect(offered(seen, XMEN_RESPONSE)).toBe(true);
    expect(inst(state, identityOf(state)).damage).toBe(0);
    expect(inst(state, id).threat).toBe(4);
  });
  it("declined: the threat stays 5", () => {
    const { state: s, id } = scheme();
    const { state } = villainPhase(s, [HARD_BOOST_0, BREAKIN], picker(defend(identityOf(s))));
    expect(inst(state, id).threat).toBe(5);
  });
  it("the defender took damage (a 2-icon boost makes Rhino 4 against DEF 3): not offered, threat stays 5", () => {
    const { state: s, id } = scheme();
    const { state, seen } = villainPhase(
      s,
      [BREAKIN, CROWD_CONTROL],
      picker(defend(identityOf(s)), accept(XMEN_RESPONSE)),
    );
    expect(offered(seen, XMEN_RESPONSE)).toBe(false);
    expect(inst(state, identityOf(state)).damage).toBe(1);
    expect(inst(state, id).threat).toBe(5);
  });
  it("a defender who is not an X-MEN character (Black Panther, who takes no damage) does not trigger it", () => {
    const { state: s, id } = scheme(BP("48020"));
    const { state, seen } = villainPhase(
      s,
      [HARD_BOOST_0, BREAKIN],
      picker(defend(identityOf(s)), accept(XMEN_RESPONSE)),
    );
    expect(offered(seen, XMEN_RESPONSE)).toBe(false);
    expect(inst(state, identityOf(state)).damage).toBe(0);
    expect(inst(state, id).threat).toBe(5);
  });
  it("When Defeated: thwarted to 0, it goes to the victory display and every enemy in play is stunned and confused", () => {
    const { state: s0, id } = scheme();
    const merc = engage(s0, MERCENARY);
    const lowered = patchInstance(merc.state, id, { threat: 2 });
    const { state } = driveEventsPicking(DEPS, lowered, firstLegal, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(lowered),
      schemeInstanceId: id,
    });
    expect(state.victoryDisplay).toContain(id);
    expect(playerOf(state, P1).discard).not.toContain(id);
    for (const enemy of [state.activeVillainId!, merc.id]) {
      expect(inst(state, enemy).statuses).toMatchObject({ stunned: 1, confused: 1 });
    }
  });
  it("one thwart that leaves threat does not trigger it: 5 minus 2 is 3 and no enemy is stunned", () => {
    const { state: s, id } = scheme();
    const { state } = driveEventsPicking(DEPS, s, firstLegal, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(s),
      schemeInstanceId: id,
    });
    expect(inst(state, id).threat).toBe(3);
    expect(inst(state, state.activeVillainId!).statuses).toMatchObject({ stunned: 0, confused: 0 });
  });
  it("the player side scheme limit (1 with 1 or 2 players): playing it beside Lay the Trap discards one of the two, undefeated", () => {
    const base = stage(heroGame([NC(SM_TRAP)], MODULAR, 1, false), [SM_TRAP, "48020"]).state;
    const trap = playStaged(base, SM_TRAP, 1, { except: moveToHand(base, P1, "48020").ids });
    const withBoth = moveToHand(trap.state, P1, "48020");
    const x = withBoth.ids[0]!;
    const pay1 = playerOf(withBoth.state, P1).hand.find((h) => h !== x && iconsOf(withBoth.state, h) > 0)!;
    const asked = spy(picker(take(trap.id)));
    const { state } = driveEventsPicking(DEPS, withBoth.state, asked.pick, play(P1, x, [pay1]));
    expect(asked.seen.some((p) => p.options.includes(trap.id) && p.options.includes(x))).toBe(true);
    expect(state.villainArea).toContain(x);
    expect(state.villainArea).not.toContain(trap.id);
    expect(inst(state, x).threat).toBe(5);
    expect(state.victoryDisplay).not.toContain(trap.id);
    expect(playerOf(state, P1).discard).toContain(trap.id);
  });
});

describe("Combine Forces (48031) and Gunboat Diplomacy (48032): Alliance, exhaust an X-FORCE and an X-MEN character", () => {
  const SIRYN = "42012"; // Protection ally, X-FORCE, THW 2
  /** Nightcrawler (X-MEN) in hero form with Siryn (X-FORCE) in play, the two events in hand, and a minion or two engaged. */
  function alliance(minions: readonly string[] = [MERCENARY]) {
    const base = stage(
      heroGame([NC("42012", "48031", "48032")], MODULAR, 1, false),
      [SIRYN, "48031", "48032"],
      5,
    ).state;
    const reserved = moveToHand(base, P1, "48031", "48032").ids;
    const siryn = playStaged(base, SIRYN, 4, { except: reserved });
    let state = siryn.state;
    const engaged: InstanceId[] = [];
    for (const code of minions) {
      const e = engage(state, code);
      state = e.state;
      engaged.push(e.id);
    }
    const [combine, gunboat] = reserved as [InstanceId, InstanceId];
    return { state, siryn: siryn.id, nc: identityOf(state), engaged, combine, gunboat };
  }
  const costFor = (a: { siryn: InstanceId; nc: InstanceId }) => ({ xforce: [a.siryn], xmen: [a.nc] });
  const payer = (s: GameState, except: readonly InstanceId[]): InstanceId =>
    playerOf(s, P1).hand.find((h) => !except.includes(h) && iconsOf(s, h) > 0)!;

  it("Siryn is an X-FORCE ally in play and Nightcrawler an X-MEN hero; Siryn's THW is 2", () => {
    const a = alliance();
    expect(playerOf(a.state, P1).playArea).toContain(a.siryn);
    expect(profile(a.state, a.siryn).thw).toBe(2);
    expect(profile(a.state, a.nc).thw).toBe(2);
  });

  describe("Combine Forces", () => {
    it("exhausts both and defeats a non-ELITE minion: Hydra Mercenary is defeated, cost 1 is paid", () => {
      const a = alliance();
      const handBefore = playerOf(a.state, P1).hand.length;
      const { state } = driveEventsPicking(
        DEPS,
        a.state,
        picker(take(a.engaged[0]!)),
        play(P1, a.combine, [payer(a.state, [a.combine, a.gunboat])], { costChoices: costFor(a) }),
      );
      expect(encounterDiscard(state)).toContain(MERCENARY);
      expect(playerOf(state, P1).playArea).not.toContain(a.engaged[0]);
      expect(inst(state, a.siryn).exhausted).toBe(true);
      expect(inst(state, a.nc).exhausted).toBe(true);
      expect(playerOf(state, P1).hand).toHaveLength(handBefore - 2);
      expect(playerOf(state, P1).discard).toContain(a.combine);
    });
    it("an ELITE minion (Sandman) is not a choice: only Hydra Mercenary is offered, and Sandman is untouched", () => {
      const a = alliance([SANDMAN, MERCENARY]);
      const probe = spy(picker(take(a.engaged[1]!)));
      const { state } = driveEventsPicking(
        DEPS,
        a.state,
        probe.pick,
        play(P1, a.combine, [payer(a.state, [a.combine, a.gunboat])], { costChoices: costFor(a) }),
      );
      const ask = probe.seen.find((p) => p.kind === "chooseTarget")!;
      expect(ask.options).toEqual([a.engaged[1]]);
      expect(playerOf(state, P1).playArea).toContain(a.engaged[0]);
      expect(inst(state, a.engaged[0]!).damage).toBe(0);
    });
    it("with only an ELITE minion in play there is no valid target, so it cannot be played", () => {
      const a = alliance([SANDMAN]);
      expect(
        accepted(a.state, play(P1, a.combine, [payer(a.state, [a.combine, a.gunboat])], { costChoices: costFor(a) })),
      ).toBe(false);
    });
    it("without an X-FORCE character (Siryn exhausted) it cannot be played, and nothing is exhausted", () => {
      const a = alliance();
      const tired = patchInstance(a.state, a.siryn, { exhausted: true });
      expect(
        accepted(tired, play(P1, a.combine, [payer(tired, [a.combine, a.gunboat])], { costChoices: costFor(a) })),
      ).toBe(false);
    });
    it("one character cannot pay both halves: naming Nightcrawler for the X-FORCE slot is refused", () => {
      const a = alliance();
      expect(
        accepted(
          a.state,
          play(P1, a.combine, [payer(a.state, [a.combine, a.gunboat])], {
            costChoices: { xforce: [a.nc], xmen: [a.nc] },
          }),
        ),
      ).toBe(false);
    });
  });

  describe("Gunboat Diplomacy", () => {
    /** A Breakin' & Takin' side scheme with 3 threat, Rhino, and the engaged minion (Melter: no guard). */
    function ready(minion = MELTER) {
      const a = alliance([minion]);
      const side = encounterCardInVillainArea(a.state, BREAKIN, 3);
      return { ...a, state: side.state, side: side.id, main: side.state.mainScheme.instanceId };
    }
    it("X is 2 + 2 = 4: it removes 3 threat from the side scheme and 1 from the main scheme, and deals 3 to Rhino and 1 to the minion", () => {
      const a0 = ready();
      const a = { ...a0, state: patchInstance(a0.state, a0.main, { threat: 3 }) };
      const mainBefore = inst(a.state, a.main).threat;
      const rhino = a.state.activeVillainId!;
      const { state } = driveEventsPicking(
        DEPS,
        a.state,
        picker(
          divideAs({
            threat: { [a.side]: 3, [a.main]: 1 },
            damage: { [rhino]: 3, [a.engaged[0]!]: 1 },
          }),
        ),
        play(P1, a.gunboat, [payer(a.state, [a.combine, a.gunboat])], { costChoices: costFor(a) }),
      );
      expect(state.villainArea).not.toContain(a.side);
      expect(mainBefore).toBe(3);
      expect(inst(state, a.main).threat).toBe(2);
      expect(inst(state, rhino).damage).toBe(3);
      expect(inst(state, a.engaged[0]!).damage).toBe(1);
      expect(inst(state, a.siryn).exhausted).toBe(true);
      expect(inst(state, a.nc).exhausted).toBe(true);
    });
    // Owner rulings Q48 to Q50 (docs/phase7-wave8.md §4.1): the division of damage is the ability's one attack, on each
    // enemy given a share, and guard is read for each (RRG 1.8 "Guard", p. 21).
    it("its damage is one attack by Nightcrawler on each enemy given a share", () => {
      const a = ready();
      const rhino = a.state.activeVillainId!;
      const { events } = driveEventsPicking(
        DEPS,
        a.state,
        picker(divideAs({ threat: { [a.side]: 3, [a.main]: 1 }, damage: { [rhino]: 3, [a.engaged[0]!]: 1 } })),
        play(P1, a.gunboat, [payer(a.state, [a.combine, a.gunboat])], { costChoices: costFor(a) }),
      );
      const attacks = events.flatMap((e) =>
        e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "attack" ? [e.event] : [],
      );
      expect(attacks).toHaveLength(1);
      expect(attacks[0]).toMatchObject({ attackerInstanceId: a.nc, labeled: true });
      expect([...attacks[0]!.attacked!].sort()).toEqual([rhino, a.engaged[0]!].sort());
      const shares = events.flatMap((e) =>
        e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "dealDamage" ? [e.event] : [],
      );
      expect(shares.map((d) => d.fromAttack)).toEqual([true, true]);
    });
    it("a guard minion engaged with Nightcrawler: Rhino is not offered a share, and all 4 go to the minion", () => {
      const a0 = ready(MERCENARY);
      const a = { ...a0, state: patchInstance(a0.state, a0.main, { threat: 3 }) };
      const rhino = a.state.activeVillainId!;
      const probe = spy(picker(divideAs({ threat: { [a.side]: 3, [a.main]: 1 } })));
      const { state } = driveEventsPicking(
        DEPS,
        a.state,
        probe.pick,
        play(P1, a.gunboat, [payer(a.state, [a.combine, a.gunboat])], { costChoices: costFor(a) }),
      );
      // Two divisions are asked about: threat among the schemes; the damage has one candidate, so it is not asked.
      expect(probe.seen.filter((p) => p.kind === "divide")).toHaveLength(1);
      expect(inst(state, rhino).damage).toBe(0);
      expect(inPlay(state, MERCENARY)).toEqual([]);
    });
    /** Played with Nightcrawler carrying a status card: the whole labeled ability is cancelled (RRG 1.8 p. 26). */
    function withStatus(status: "confused" | "stunned") {
      const a = ready();
      const marked = patchInstance(a.state, a.nc, {
        statuses: { stunned: status === "stunned" ? 1 : 0, confused: status === "confused" ? 1 : 0, tough: 0 },
      });
      const rhino = marked.activeVillainId!;
      const { state } = driveEventsPicking(
        DEPS,
        marked,
        picker(
          divideAs({
            threat: { [a.side]: 3 },
            damage: { [rhino]: 4 },
          }),
        ),
        play(P1, a.gunboat, [payer(marked, [a.combine, a.gunboat])], { costChoices: costFor(a) }),
      );
      return { state, a, rhino };
    }
    it("it is an attack and a thwart in one: a confused Nightcrawler loses the confused card and all of it, damage included", () => {
      const { state, a, rhino } = withStatus("confused");
      expect(inst(state, a.nc).statuses.confused).toBe(0);
      expect(inst(state, a.side).threat).toBe(3);
      expect(inst(state, rhino).damage).toBe(0);
      expect(playerOf(state, P1).discard).toContain(a.gunboat);
    });
    it("a stunned Nightcrawler loses the stunned card and all of it, thwart included", () => {
      const { state, a, rhino } = withStatus("stunned");
      expect(inst(state, a.nc).statuses.stunned).toBe(0);
      expect(inst(state, a.side).threat).toBe(3);
      expect(inst(state, rhino).damage).toBe(0);
      expect(playerOf(state, P1).discard).toContain(a.gunboat);
    });
    it("without an X-MEN character ready it cannot be played", () => {
      const a = ready();
      const tired = patchInstance(a.state, a.nc, { exhausted: true });
      expect(
        accepted(tired, play(P1, a.gunboat, [payer(tired, [a.combine, a.gunboat])], { costChoices: costFor(a) })),
      ).toBe(false);
    });
  });
});

/**
 * Rogue (48012): the cost deals 1 damage to another friendly character she picks, any player's (docs/phase7-wave8.md
 * §3.74, tests 1 and 6 to 10). The lasting trait grant and stat bonus read that character's base THW and ATK live, a
 * star or X defined by text included (ruling January 17, 2026, Ruling 1).
 */
describe("Rogue (48012): deal 1 damage to another friendly character to take its traits and base THW and ATK", () => {
  const ROGUE_DEPS: EngineDeps = DEPS;
  const ROGUE = "48012.rogue-action";

  /** Rogue (THW 2, ATK 2, 3 hit points) and Gambit holding a 2-icon card (THW 2, ATK 2), in play beside Nightcrawler. */
  function table() {
    const base = stackEncounterDeck(
      stage(heroGame(), ["48012", "48021"], 8).state,
      ADVANCE,
      BREAKIN,
      HARD_TO_KEEP_DOWN,
    );
    const reserved = moveToHand(base, P1, "48012", "48021").ids;
    const gambitPlayed = driveEventsPicking(
      ROGUE_DEPS,
      base,
      picker(accept(GAMBIT_RESPONSE), (st) => {
        const c = st.pendingChoice;
        const hit =
          c?.prompt.kind === "chooseCards" ? c.options.find((o) => o.label === "Breakin' & Takin'") : undefined;
        return hit ? [hit.optionId] : undefined;
      }),
      play(P1, reserved[1]!, payers(base, 3, reserved)),
    ).state;
    const rogueId = reserved[0]!;
    const rogue = driveEventsPicking(
      ROGUE_DEPS,
      gambitPlayed,
      firstLegal,
      play(P1, rogueId, payers(gambitPlayed, 4, reserved)),
    );
    return { state: rogue.state, rogue: rogueId, gambit: reserved[1]!, nc: identityOf(base) };
  }
  const payers = (s: GameState, n: number, except: readonly InstanceId[]): InstanceId[] =>
    playerOf(s, P1)
      .hand.filter((h) => !except.includes(h) && iconsOf(s, h) > 0)
      .slice(0, n);
  const rogueOn = (rogue: InstanceId, friend: InstanceId) => use(P1, rogue, ROGUE, [], { friend: [friend] });
  const useRogue = (s: GameState, rogue: InstanceId, friend: InstanceId) =>
    driveEventsPicking(ROGUE_DEPS, s, firstLegal, rogueOn(rogue, friend));

  it("the damage is the cost: a chosen deal-damage cost of 1 on another identity or ally, once per round", () => {
    const definition = NCRAWLER_ASPECT_BASIC[ROGUE]!;
    expect(definition.cost?.dealDamage).toMatchObject({ amount: 1, choose: { slot: "friend" } });
    expect(definition.limit).toMatchObject({ count: 1, period: "round" });
  });
  it("test 1 of §3.74 (Gambit, 2-icon card): Rogue is THW 2 ATK 2 before, Gambit THW 2 ATK 2 with 3 hit points", () => {
    const { state, rogue, gambit } = table();
    expect(profile(state, rogue, ROGUE_DEPS)).toMatchObject({ thw: 2, atk: 2, maxHp: 3 });
    expect(profile(state, gambit, ROGUE_DEPS)).toMatchObject({ thw: 2, atk: 2, maxHp: 3 });
  });
  it("test 6: dealing 1 damage to Gambit leaves him 2 hit points; Rogue is THW 4, ATK 4 and has the THIEF and X-MEN traits", () => {
    const { state: s, rogue, gambit } = table();
    expect(traitsOf(s, rogue, ROGUE_DEPS).map(String)).not.toContain("THIEF");
    const { state } = useRogue(s, rogue, gambit);
    expect(inst(state, gambit).damage).toBe(1);
    expect(profile(state, rogue, ROGUE_DEPS)).toMatchObject({ thw: 4, atk: 4 });
    expect(traitsOf(state, rogue, ROGUE_DEPS).map(String)).toEqual(expect.arrayContaining(["THIEF", "X-MEN"]));
  });
  it("test 7 (no upgrade): Nightcrawler's base THW 2 and ATK 1 give Rogue THW 4 and ATK 3", () => {
    const { state: s, rogue, nc } = table();
    const { state } = useRogue(s, rogue, nc);
    expect(inst(state, nc).damage).toBe(1);
    expect(profile(state, rogue, ROGUE_DEPS)).toMatchObject({ thw: 4, atk: 3 });
  });
  it("test 8: a tough status card on the target is discarded instead of the damage, and she copies anyway", () => {
    const { state: s, rogue, nc } = table();
    const tough = patchInstance(s, nc, { statuses: { stunned: 0, confused: 0, tough: 1 } });
    const { state } = useRogue(tough, rogue, nc);
    expect(inst(state, nc).statuses.tough).toBe(0);
    expect(inst(state, nc).damage).toBe(0);
    expect(profile(state, rogue, ROGUE_DEPS)).toMatchObject({ thw: 4, atk: 3 });
  });
  it("test 9 (Q43 = A): the target is Gambit with 1 hit point left: he is defeated, she has none of his traits or powers", () => {
    const { state: s, rogue, gambit } = table();
    const dying = patchInstance(s, gambit, { damage: 2 });
    const { state } = useRogue(dying, rogue, gambit);
    expect(playerOf(state, P1).playArea).not.toContain(gambit);
    expect(profile(state, rogue, ROGUE_DEPS)).toMatchObject({ thw: 2, atk: 2 });
    expect(traitsOf(state, rogue, ROGUE_DEPS).map(String)).not.toContain("THIEF");
  });
  it("test 10: next round the bonus is gone and the Action is offered again; this round it is once only", () => {
    const { state: s, rogue, nc } = table();
    const { state: used } = useRogue(s, rogue, nc);
    expect(accepted(used, rogueOn(rogue, nc), ROGUE_DEPS)).toBe(false);
    const { state: next } = villainPhase2(used);
    expect(profile(next, rogue, ROGUE_DEPS)).toMatchObject({ thw: 2, atk: 2 });
    expect(accepted(next, rogueOn(rogue, nc), ROGUE_DEPS)).toBe(true);
  });
  it("'another friendly character': not herself, not an enemy; with two friends the command must name one", () => {
    const { state: s, rogue, gambit } = table();
    expect(accepted(s, rogueOn(rogue, rogue), ROGUE_DEPS)).toBe(false);
    expect(accepted(s, rogueOn(rogue, s.activeVillainId!), ROGUE_DEPS)).toBe(false);
    expect(accepted(s, use(P1, rogue, ROGUE), ROGUE_DEPS)).toBe(false);
    expect(accepted(s, rogueOn(rogue, gambit), ROGUE_DEPS)).toBe(true);
  });
  it("the damage is dealt before the copy: the cost's 1 damage comes first in the log, from Rogue", () => {
    const { state: s, rogue, gambit } = table();
    const { events } = useRogue(s, rogue, gambit);
    const hit = events.findIndex(
      (e) => e.type === "damageDealt" && e.targetInstanceId === gambit && e.sourceInstanceId === rogue,
    );
    const copied = events.findIndex((e) => e.type === "lastingEffectAdded");
    expect(hit).toBeGreaterThan(-1);
    expect(copied).toBeGreaterThan(hit);
  });
  const villainPhase2 = (s: GameState) => {
    let state = runWith(ROGUE_DEPS, stackEncounterDeck(s, CROWD_CONTROL, MERCENARY), endTurn(P1));
    state = settle(state, picker(defend(identityOf(state))), undefined, ROGUE_DEPS);
    return { state };
  };
});
