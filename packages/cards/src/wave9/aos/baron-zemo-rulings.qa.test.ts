/**
 * Rules QA for the Baron Zemo scenario of the Agents of S.H.I.E.L.D. box (Baron Zemo 50165a/b and 50166a/b, Zemo's
 * Manipulations / The Accusation / Fighting Zemo 50167a/b to 50169a/b, the encounter cards 50170 to 50177, the evidence
 * 50185 to 50193 as hidden cards) and how it uses the S.H.I.E.L.D. Executive Board: the interactions the module tests
 * (`baron-zemo.test.ts`, `baron-zemo-encounter.test.ts`) do not assert, each tied to an RRG 1.8 entry
 * (`docs/rules/mc_rulesreference_v18_compressed.pdf`), an FFG ruling by its date heading (docs/rulings/marvel-champions-rulings-post-rrg-1-7.md),
 * the box rulebook (MC50) or an owner answer (docs/phase7-wave9.md section 4.1). A `FINDING` comment marks a case where
 * the game and its source disagree: the expected behavior is an `it.fails`, with a passing companion that pins today's
 * behavior. Findings are tabled in docs/phase7-wave9-qa.md. Reluctant Foe 50171 and Battle of Wits 50175 are not
 * scripted yet and are not tested here.
 */
import { AOS_EVIDENCE_COMBINATIONS, type CardId, type EvidenceCombination } from "@mc/content";
import {
  activeEncounterDeckId,
  applyCommand,
  createGame,
  evidenceRowId,
  hasKeyword,
  hiddenPileViews,
  maxHitPoints,
  openEvidenceRows,
  preview,
  remainingHitPoints,
  sealHiddenPiles,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { mergeRegistries } from "../../dsl/index.js";
import {
  P1,
  P2,
  applyOk,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  moveToHand,
  patchInstance,
  play,
  playerOf,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, playFromHand, withDamage } from "../../testing/staging.js";
import { inPlayCard } from "../testing.js";
import { WAVE8_ABILITIES } from "../../wave8/index.js";
import { attachToHost, engageMinion } from "../../wave6/mut_gen/project-wideawake-testing.js";
import { wave9Scenario } from "../setup.js";
import {
  BLANK,
  CAPTAIN_MARVEL,
  IRON_MAN,
  SHE_HULK,
  SPIDER_MAN,
  codeOf,
  heroAttacks,
  heroForm,
  picking,
  piles,
  stunWith,
  types,
} from "../testing.js";
import { BARON_ZEMO } from "./baron-zemo.js";
import { EXECUTIVE_BOARD } from "./executive-board.js";

vi.setConfig({ testTimeout: 300_000 });

const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE8_ABILITIES, BARON_ZEMO, EXECUTIVE_BOARD) };

// Core cards
const HAYMAKER = "01087"; // Hero Action (attack): 3 damage to an enemy, cost 2
const RELENTLESS_ASSAULT = "01053"; // Hero Action (attack): 5 damage to a minion; paid with a physical resource, overkill
const BLACK_CAT = "01002"; // an ally, cost 2
const AUNT_MAY = "01006"; // a support, cost 1
const INTERROGATION_ROOM = "01063"; // a support, cost 1
const UNDERMINE_SUPPORT = "50174";
const DIVIDED_LOYALTIES = "50173";
// Wave 9 cards
const MEDICAL = "50181a";
const SURVEILLANCE = "50182a";
const TACTICAL = "50183a";
const MEMBERS = [MEDICAL, SURVEILLANCE, TACTICAL];
const SWORD = "50170";
const AGENT = "50172";
const MIGHT_MAKES_RIGHT = "50176";
const GRID = AOS_EVIDENCE_COMBINATIONS;
const GUESSES = ["means", "motive", "opportunity"] as const;
const SEATS = [SPIDER_MAN, IRON_MAN, CAPTAIN_MARVEL, SHE_HULK] as const;

// ---------------------------------------------------------------------------------------------------------------------
// Staging
// ---------------------------------------------------------------------------------------------------------------------

interface Plan {
  /** The first player takes 1B's Response (a plan that never does only ends the player phase). */
  readonly take?: boolean;
  /** Answer the offer to place 2 counters for evidence: yes (default: no). */
  readonly gain?: boolean;
  /** Answer the offer to advance to stage 2A: yes (default: no). */
  readonly advance?: boolean;
  /** The row accused. */
  readonly accuse?: EvidenceCombination;
  /** An option label prefix to answer a chooseOption with (Zemo's Unmasked interrupt: "Give" or "Place"). */
  readonly option?: string;
  /** A card to pick whenever a chooseTarget offers it. */
  readonly target?: InstanceId;
  /** Hand cards to pay with at each payment prompt, in order (a prompt past the list pays nothing). */
  readonly pays?: readonly number[];
  /** A defender to declare. */
  readonly defender?: InstanceId;
}

interface Asked {
  readonly kind: string;
  readonly playerId: PlayerId;
  readonly labels: readonly string[];
}

const mkPicker = (plan: Plan): Picker => {
  const pays = [...(plan.pays ?? [])];
  return (s) => {
    const choice = s.pendingChoice!;
    switch (choice.prompt.kind) {
      case "chooseTriggers": {
        const hit = plan.take
          ? choice.options.find((o) => (o.optionId as string).includes("zemos-manipulations"))
          : undefined;
        return hit ? [hit.optionId] : [];
      }
      case "chooseOption": {
        const pick = (label: (l: string) => boolean) => choice.options.find((o) => label(o.label))!.optionId;
        if (choice.options.some((o) => o.label.includes("to gain 2 evidence cards")))
          return [pick((l) => (plan.gain ? l.includes("to gain 2 evidence cards") : l.startsWith("Do not")))];
        if (choice.options.some((o) => o.label.startsWith("Advance to stage 2A")))
          return [pick((l) => (plan.advance ? l.startsWith("Advance to stage 2A") : l.startsWith("Do not")))];
        const wanted = plan.option ? choice.options.find((o) => o.label.startsWith(plan.option!)) : undefined;
        return wanted ? [wanted.optionId] : firstLegal(s);
      }
      case "accuse": {
        const row = plan.accuse ?? GRID[0]!;
        const hit = choice.options.find((o) => (o.optionId as string) === evidenceRowId(row));
        if (!hit) throw new Error("the accused row is not offered");
        return [hit.optionId];
      }
      case "chooseTarget": {
        const hit = plan.target
          ? choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === plan.target)
          : undefined;
        return hit ? [hit.optionId] : firstLegal(s);
      }
      case "declareDefender": {
        const hit = plan.defender
          ? choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === plan.defender)
          : undefined;
        return hit ? [hit.optionId] : ["decline"];
      }
      case "spendResources":
      case "payForAbility":
        return choice.options
          .map((o) => o.optionId as string)
          .filter((id) => id.startsWith("hand:"))
          .slice(0, pays.shift() ?? 0);
      default:
        return firstLegal(s);
    }
  };
};

interface Sim {
  state: GameState;
  events: GameEvent[];
  asked: Asked[];
}

/** Zemo's own interrupt of the Unmasked face is the pending choice. */
const atZemoInterrupt = (s: GameState): boolean =>
  s.pendingChoice?.prompt.kind === "chooseOption" &&
  s.pendingChoice.options.some((o) => o.label.startsWith("Give Baron Zemo an additional boost card"));
const atAccusation = (s: GameState): boolean => s.pendingChoice?.prompt.kind === "accuse";

const take = (sim: Sim, result: { readonly state: GameState; readonly events: readonly GameEvent[] }): void => {
  sim.state = result.state;
  sim.events.push(...result.events);
};

/** Answers pending choices by `plan` until none is left, the game ends, or `until` says so. */
function resolveAll(sim: Sim, plan: Plan, until: (s: GameState) => boolean = () => false): void {
  const pick = mkPicker(plan);
  for (let guard = 0; sim.state.pendingChoice && !sim.state.outcome && !until(sim.state); guard++) {
    if (guard > 300) throw new Error(`choices did not settle (stuck on ${sim.state.pendingChoice.prompt.kind})`);
    const choice = sim.state.pendingChoice;
    sim.asked.push({ kind: choice.prompt.kind, playerId: choice.playerId, labels: choice.options.map((o) => o.label) });
    take(
      sim,
      applyOk(
        sim.state,
        {
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: pick(sim.state),
        },
        DEPS,
      ),
    );
  }
}

/** Runs `commands`, then answers by `plan` until nothing is asked (or `until`). */
function drive(sim: Sim, plan: Plan, commands: readonly Command[], until?: (s: GameState) => boolean): void {
  for (const command of commands) take(sim, applyOk(sim.state, command, DEPS));
  resolveAll(sim, plan, until);
}
/** Every player ends their turn, in seat order. */
const endPlayerPhase = (sim: Sim, plan: Plan, until?: (s: GameState) => boolean): void =>
  drive(
    sim,
    plan,
    sim.state.players.map((p) => endTurn(p.playerId)),
    until,
  );

interface OpenOptions {
  readonly players?: number;
  /** The seats, when the default (Spider-Man, Iron Man, Captain Marvel, She-Hulk) will not do. */
  readonly seats?: readonly (typeof SEATS)[number][];
  readonly difficulty?: "standard" | "expert";
  readonly seed?: number;
  /** Every identity in hero form (default), or in alter-ego form. */
  readonly hero?: boolean;
  /**
   * The encounter deck, top first. The default reveals nothing that makes Zemo activate: two S.H.I.E.L.D. Agents (a
   * minion attacks the hero, not Zemo), Undermine Support (a side scheme) and the Sword for 3A to find.
   */
  readonly deck?: readonly string[];
  /** The encounter discard pile (cards a later round stacks on top of the deck). */
  readonly discard?: readonly string[];
}

/** The encounter deck exactly `deck` (top first) and its discard pile exactly `discard`, everything else dropped. */
function cutDeck(state: GameState, deck: readonly string[], discard: readonly string[]): GameState {
  const pile = piles(state);
  const all = [...pile.deck, ...pile.discard];
  const used: InstanceId[] = [];
  const find = (code: string): InstanceId => {
    const id = all.find((i) => codeOf(state, i) === code && !used.includes(i));
    if (!id) throw new Error(`no ${code} in the encounter deck or discard`);
    used.push(id);
    return id;
  };
  const top = deck.map(find);
  const rest = discard.map(find);
  return {
    ...state,
    encounterDecks: { ...state.encounterDecks, [activeEncounterDeckId(state)]: { deck: top, discard: rest } },
  };
}

/** The real scenario past setup (its events kept), the encounter deck cut to `deck`. */
function open(opts: OpenOptions = {}): Sim {
  const created = createGame(
    wave9Scenario("baron-zemo", {
      players: opts.seats ?? SEATS.slice(0, opts.players ?? 1),
      seed: opts.seed ?? 1,
      difficulty: opts.difficulty ?? "standard",
    }),
    DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  const sim: Sim = { state: created.state, events: [...created.events], asked: [] };
  for (let guard = 0; sim.state.pendingChoice && sim.state.step.phase !== "player"; guard++) {
    if (guard > 300) throw new Error("setup did not settle");
    const choice = sim.state.pendingChoice;
    take(
      sim,
      applyOk(
        sim.state,
        {
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: firstLegal(sim.state),
        },
        DEPS,
      ),
    );
  }
  let state = cutDeck(sim.state, opts.deck ?? [AGENT, UNDERMINE_SUPPORT, SWORD], opts.discard ?? []);
  if (opts.hero !== false) state = heroForm(state, ...state.players.map((p) => p.playerId));
  sim.state = state;
  return sim;
}

const villainOf = (s: GameState): InstanceId => s.villains[0]!.instanceId;
/** A Board Member card: the environment in the villain area, or its attachment face once flipped. */
const memberOf = (s: GameState, code: string): InstanceId => {
  const aid = `${code.slice(0, -1)}b`;
  const found = (Object.keys(s.instances) as InstanceId[]).find((i) => {
    const c = codeOf(s, i);
    return (c === code && s.villainArea.includes(i)) || (c === aid && s.instances[i]!.attachedTo !== null);
  });
  if (!found) throw new Error(`no ${code} in play`);
  return found;
};
const secrets = (s: GameState, code: string): number => inst(s, memberOf(s, code)).counters["secret"] ?? 0;
const isAttachment = (s: GameState, code: string): boolean => codeOf(s, memberOf(s, code)) === `${code.slice(0, -1)}b`;
const withSecrets = (s: GameState, counts: Readonly<Record<string, number>>): GameState => {
  let current = s;
  for (const [code, n] of Object.entries(counts))
    current = patchInstance(current, memberOf(current, code), { counters: n > 0 ? { secret: n } : {} });
  return current;
};
const environmentsTotal = (s: GameState): number =>
  MEMBERS.filter((c) => !isAttachment(s, c)).reduce((sum, c) => sum + secrets(s, c), 0);
const aimOf = (s: GameState): readonly CardId[] => s.hiddenPiles?.["aim"] ?? [];
const shieldOf = (s: GameState): readonly CardId[] => s.hiddenPiles?.["shield"] ?? [];
/** The row the A.I.M. pile makes: the mole's. */
const moleRow = (s: GameState): EvidenceCombination => {
  const aim = new Set(aimOf(s).map((c) => c as string));
  return GRID.find((row) => GUESSES.every((g) => aim.has(row[g] as string)))!;
};
const differing = (row: EvidenceCombination, mole: EvidenceCombination) =>
  [...GUESSES, "boardMember" as const].filter((f) => row[f] !== mole[f]);
/** A row that differs from the mole's in exactly the fields named. */
const rowDiffering = (mole: EvidenceCombination, ...fields: readonly string[]): EvidenceCombination =>
  GRID.find((row) => {
    const d = differing(row, mole);
    return d.length === fields.length && fields.every((f) => d.includes(f as (typeof d)[number]));
  })!;
const stage = (s: GameState): number => s.mainScheme.stageIndex + 1;
/** Every secret counter on the Board Member cards (either face). */
const secretsTotal = (s: GameState): number => MEMBERS.reduce((sum, c) => sum + secrets(s, c), 0);
const threatPlacedAfterStage3 = (sim: Sim): number => {
  const start = sim.events.findIndex((e) => e.type === "mainSchemeAdvanced" && e.stageIndex === 2);
  expect(start).toBeGreaterThanOrEqual(0);
  const main = sim.state.mainScheme.instanceId;
  const stop = sim.events.findIndex((e, i) => i > start && e.type === "stepChanged");
  return sim.events
    .slice(start, stop < 0 ? undefined : stop)
    .filter((e): e is Extract<GameEvent, { type: "threatPlaced" }> => e.type === "threatPlaced")
    .filter((e) => e.schemeInstanceId === main)
    .reduce((sum, e) => sum + e.amount, 0);
};
const withStatus = (s: GameState, id: InstanceId, status: "stunned" | "confused" | "tough", n = 1): GameState =>
  patchInstance(s, id, { statuses: { ...inst(s, id).statuses, [status]: n } });
const giveOffered = (sim: Sim): number =>
  sim.asked.filter((a) => a.labels.some((l) => l.startsWith("Give Baron Zemo an additional boost card"))).length;
const attacksByZemo = (sim: Sim): number =>
  types(sim.events, "attackResolved").filter((a) => a.enemyInstanceId === villainOf(sim.state)).length;

/** Through the Response, the accusation of `accuse` (the mole's row when none), and 3A / 3B, to Zemo's interrupt. */
function toStage3(sim: Sim, plan: Plan = {}): void {
  endPlayerPhase(sim, { take: true, advance: true, accuse: moleRow(sim.state), ...plan }, atZemoInterrupt);
}

// ---------------------------------------------------------------------------------------------------------------------
// Hidden information
// ---------------------------------------------------------------------------------------------------------------------

describe("the A.I.M. pile is unreadable until the accusation (MC50 p. 5 'without looking at them', p. 19; docs/phase7-wave9.md 3.29)", () => {
  it("the opening log, the sealed state and the hidden-pile view name no card of either pile", () => {
    const sim = open({ players: 2 });
    const aim = aimOf(sim.state);
    const shield = shieldOf(sim.state);
    expect(aim).toHaveLength(3);
    expect(shield).toHaveLength(6);
    const log = JSON.stringify(sim.events);
    for (const card of [...aim, ...shield]) expect(log).not.toContain(`"${card}"`);
    expect(types(sim.events, "hiddenPilesDealt")).toHaveLength(1);
    const sealed = sealHiddenPiles(sim.state);
    expect("hiddenPiles" in sealed).toBe(false);
    // The card pool is the open definitions of every card; everything else in a client's copy of the state.
    const { cardPool: _pool, ...rest } = sealed;
    const text = JSON.stringify(rest);
    for (const card of [...aim, ...shield]) expect(text).not.toContain(`"${card}"`);
    expect([...hiddenPileViews(sim.state)].sort((a, b) => a.pile.localeCompare(b.pile))).toEqual([
      { pile: "aim", size: 3 },
      { pile: "shield", size: 6 },
    ]);
  });

  it("with evidence gained, the accusation prompt crosses out the gained cards only, the log names no A.I.M. card, and the mole's row is still open", () => {
    const sim = open();
    const aim = aimOf(sim.state);
    const row = moleRow(sim.state);
    sim.state = withSecrets(sim.state, { [SURVEILLANCE]: 0 });
    endPlayerPhase(sim, { take: true, gain: true, advance: true }, atAccusation);
    const prompt = sim.state.pendingChoice!.prompt;
    expect(prompt.kind).toBe("accuse");
    if (prompt.kind !== "accuse") return;
    const gained = sim.state.revealedPileCards?.["shield"] ?? [];
    expect(gained).toHaveLength(2);
    expect([...prompt.crossedOut].sort()).toEqual([...gained].sort());
    for (const card of aim) expect(prompt.crossedOut).not.toContain(card);
    // Nothing of the A.I.M. pile is faceup, recorded or logged yet.
    expect(sim.state.revealedPileCards?.["aim"]).toBeUndefined();
    expect(sim.state.accusation).toBeUndefined();
    // The events that carry evidence ids name the gained cards only (the prompt's grid is the open campaign-log grid).
    const named = [
      ...types(sim.events, "hiddenPileCardsGained").flatMap((e) => e.cardIds),
      ...types(sim.events, "hiddenPileRevealed").flatMap((e) => e.cardIds),
    ];
    expect([...named].sort()).toEqual([...gained].sort());
    expect(types(sim.events, "moleIdentified")).toEqual([]);
    // The gained cards never include one of the A.I.M. pile, so the mole's own row is never crossed out.
    expect(openEvidenceRows(sim.state, GRID).map(evidenceRowId)).toContain(evidenceRowId(row));
  });

  it.each([1, 2, 3])("a gain never turns up a card of the A.I.M. pile (seed %i)", (seed) => {
    const sim = open({ seed });
    sim.state = withSecrets(sim.state, { [SURVEILLANCE]: 0 });
    endPlayerPhase(sim, { take: true, gain: true });
    const gained = sim.state.revealedPileCards?.["shield"] ?? [];
    expect(gained).toHaveLength(2);
    for (const card of gained) expect(aimOf(sim.state)).not.toContain(card);
    expect(types(sim.events, "hiddenPileCardsGained")).toHaveLength(1);
  });

  it("the A.I.M. pile turns faceup only after the accusation is made, in that order in the log", () => {
    const sim = open();
    endPlayerPhase(sim, { take: true, advance: true, accuse: moleRow(sim.state) }, atZemoInterrupt);
    const kinds = sim.events.map((e) => e.type);
    const made = kinds.indexOf("accusationMade");
    const revealed = kinds.indexOf("hiddenPileRevealed");
    const identified = kinds.indexOf("moleIdentified");
    expect(made).toBeGreaterThanOrEqual(0);
    expect(revealed).toBeGreaterThan(made);
    expect(identified).toBeGreaterThan(revealed);
  });

  it("the preview of answering the accusation stops before the A.I.M. pile turns faceup: it names none of its cards and no outcome", () => {
    // `preview` is what a client shows before a command is committed; the answer to the accuse prompt is the command
    // that turns the pile faceup (50168b step 1), so everything from there on is hidden information.
    const sim = open();
    const aim = new Set(aimOf(sim.state).map((c) => c as string));
    const mole = moleRow(sim.state);
    // A guess that shares no evidence card with the A.I.M. pile, so the player's own row cannot name one.
    const guess = GRID.find((row) => GUESSES.every((g) => !aim.has(row[g] as string)))!;
    expect(guess).toBeDefined();
    endPlayerPhase(sim, { take: true, advance: true }, atAccusation);
    const choice = sim.state.pendingChoice!;
    const shown = preview(
      sim.state,
      {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: [evidenceRowId(guess)],
      },
      DEPS,
    );
    expect(shown.stop).toMatchObject({ kind: "hiddenInformation" });
    expect(shown.outcome).toBeNull();
    const text = JSON.stringify(shown);
    for (const card of aim) expect(text).not.toContain(`"${card}"`);
    expect(mole).toBeDefined();
  });

  it("with all six evidence cards of the S.H.I.E.L.D. pile gained only the mole's row is left: nobody is asked to accuse, and the accusation is correct (MC50 p. 18, elimination)", () => {
    const sim = open();
    const shield = shieldOf(sim.state);
    sim.state = {
      ...sim.state,
      hiddenPiles: { ...sim.state.hiddenPiles!, shield: [] },
      revealedPileCards: { shield },
    };
    expect(openEvidenceRows(sim.state, GRID)).toEqual([moleRow(sim.state)]);
    endPlayerPhase(sim, { take: true, advance: true }, atZemoInterrupt);
    expect(sim.asked.some((a) => a.kind === "accuse")).toBe(false);
    expect(sim.state.accusation?.wrong).toEqual([]);
    expect(stage(sim.state)).toBe(3);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// The accusation with two to four players
// ---------------------------------------------------------------------------------------------------------------------

describe("who decides in Zemo's Manipulations and The Accusation (RRG 1.8 'First Player' p. 19; MC50 p. 19)", () => {
  // RRG "First Player": when an encounter card requires a choice "but does not specify which player should act, the
  // first player does so"; the card gives the Response to "the first player" and the accusation to "the players". The
  // token is the first player's, so with it on the second player the second player is asked everything.
  it.each([
    ["the first player (p1)", P1, P2],
    ["the first player when the token is on the second player (p2)", P2, P1],
  ])("%s takes the Response, advances, and makes the accusation", (_label, first, other) => {
    const sim = open({ players: 2 });
    sim.state = { ...sim.state, firstPlayerId: first };
    endPlayerPhase(sim, { take: true, advance: true, accuse: moleRow(sim.state) }, atZemoInterrupt);
    const answered = (kind: string) => sim.asked.filter((a) => a.kind === kind).map((a) => a.playerId);
    expect(answered("chooseTriggers")).toContain(first);
    expect(answered("chooseTriggers")).not.toContain(other);
    expect(answered("accuse")).toEqual([first]);
    expect(types(sim.events, "accusationMade").map((e) => e.playerId)).toEqual([first]);
    const advance = sim.asked.filter((a) => a.labels.some((l) => l.startsWith("Advance to stage 2A")));
    expect(advance.map((a) => a.playerId)).toEqual([first]);
  });

  it("the Response is offered after the last player ends their turn, not after the first, and before any villain activation", () => {
    // MC50 p. 18 / card 50167b: "After the player phase ends". One player's end of turn does not end the phase.
    const sim = open({ players: 2 });
    drive(sim, {}, [endTurn(P1)]);
    expect(sim.state.pendingChoice).toBeNull();
    expect(sim.state.step.phase).toBe("player");
    drive(sim, {}, [endTurn(P2)], (s) => s.pendingChoice?.prompt.kind === "chooseTriggers");
    expect(sim.state.pendingChoice?.prompt.kind).toBe("chooseTriggers");
    expect(types(sim.events, "attackResolved")).toEqual([]);
    expect(types(sim.events, "encounterCardRevealed")).toEqual([]);
  });

  it("a gain and the advance are two offers of one use: the cards gained first are crossed out in the accusation that follows", () => {
    const sim = open();
    sim.state = withSecrets(sim.state, { [SURVEILLANCE]: 0 });
    endPlayerPhase(sim, { take: true, gain: true, advance: true }, atAccusation);
    const offered = sim.state.pendingChoice!.options.length;
    expect(offered).toBe(openEvidenceRows(sim.state, GRID).length);
    expect(offered).toBeLessThan(GRID.length);
  });
});

describe("per-player values at four players (card 50167a, 50169a/b; MC50 p. 19)", () => {
  it("1[per_hero]: a correct accusation puts 4 x 2 threat on Fighting Zemo, and the Unmasked face has 18 x 4 hit points", () => {
    const sim = open({ players: 4 });
    expect(mainThreat(sim.state)).toBe(8);
    toStage3(sim);
    expect(stage(sim.state)).toBe(3);
    expect(sim.state.accusation?.wrong).toEqual([]);
    expect(threatPlacedAfterStage3(sim)).toBe(8);
    expect(maxHitPoints(sim.state, villainOf(sim.state), DEPS)).toBe(72);
    // Zemo activates once per player: the interrupt is offered to the player he activates against, the first in order.
    expect(sim.state.pendingChoice?.playerId).toBe(P1);
  });
});

describe("Zemo's Unmasked interrupt is the activated player's (cards 50165b / 50166b: 'activates against you')", () => {
  it("two players: Zemo activates once per player in player order and the interrupt is asked of each in turn", () => {
    const sim = open({ players: 2 });
    endPlayerPhase(sim, { take: true, advance: true, accuse: moleRow(sim.state) });
    const asked = sim.asked
      .filter((a) => a.labels.some((l) => l.startsWith("Give Baron Zemo an additional boost card")))
      .map((a) => a.playerId);
    expect(asked).toEqual([P1, P2]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Wrong guesses
// ---------------------------------------------------------------------------------------------------------------------

/** The first seed whose mole leaves a wrong accusation of the Surveillance Officer with at most 3 wrong guesses. */
function surveillanceAccused() {
  for (let seed = 1; seed <= 12; seed++) {
    const sim = open({ seed });
    const mole = moleRow(sim.state);
    const accusedRow = GRID.filter((r) => r.boardMember === SURVEILLANCE && differing(r, mole).includes("boardMember"))
      .filter((r) => differing(r, mole).length <= 3)
      .sort((x, y) => differing(x, mole).length - differing(y, mole).length)[0];
    if (accusedRow) return { sim, accusedRow, mole };
  }
  throw new Error("no seed leaves the Surveillance Officer to accuse wrongly");
}

describe("wrong guesses against the flip threshold (MC50 p. 19; 50168b steps 2 and 3; Board Members 50181a to 50183a)", () => {
  // Setup puts 2 secret counters on each environment (50167a) and each flips at 4 (3 in expert mode), and "if all of the
  // board members join Baron Zemo, the players lose" (MC50 p. 19). So from the opening count, two wrong guesses already
  // lose a standard game and a single wrong guess loses an expert one.
  it("standard: two wrong guesses from the opening 2 each put every member at 4: all three flip and the players lose", () => {
    const sim = open();
    const mole = moleRow(sim.state);
    endPlayerPhase(sim, { take: true, advance: true, accuse: rowDiffering(mole, "means", "motive") }, atZemoInterrupt);
    expect(sim.state.accusation?.wrong).toEqual(["means", "motive"]);
    expect(MEMBERS.every((c) => isAttachment(sim.state, c))).toBe(true);
    expect(sim.state.outcome?.result).toBe("loss");
  });

  it("expert: one wrong guess puts every member at 3, the expert threshold: all three flip and the players lose", () => {
    const sim = open({ difficulty: "expert" });
    const mole = moleRow(sim.state);
    // A row that differs from the mole in exactly one guess (not every mole has one for each field).
    const row = GRID.find((r) => differing(r, mole).length === 1)!;
    endPlayerPhase(sim, { take: true, advance: true, accuse: row }, atZemoInterrupt);
    expect(sim.state.accusation?.wrong).toHaveLength(1);
    expect(MEMBERS.every((c) => isAttachment(sim.state, c))).toBe(true);
    expect(sim.state.outcome?.result).toBe("loss");
  });

  it("expert: a correct accusation loses nothing and the Unmasked face is the steady 50166b", () => {
    const sim = open({ difficulty: "expert" });
    const moleCode = moleRow(sim.state).boardMember as string;
    toStage3(sim);
    expect(sim.state.outcome).toBeNull();
    expect(MEMBERS.filter((c) => isAttachment(sim.state, c))).toEqual([moleCode]);
    expect(hasKeyword(sim.state, villainOf(sim.state), "steady", DEPS)).toBe(true);
  });

  it("the accused is a wrong member that had already joined Zemo: its attachment takes the wrong-guess counters and the 3 more, and the mole (still an environment) flips at 3B keeping its counters", () => {
    // The Surveillance Officer's Aid is the accused: it also answers each placing with 2 threat on the main scheme.
    const { sim, accusedRow, mole } = surveillanceAccused();
    const wrong = differing(accusedRow, mole).length;
    const moleCode = mole.boardMember as string;
    const third = MEMBERS.find((c) => c !== SURVEILLANCE && c !== moleCode)!;
    sim.state = withSecrets(sim.state, { [SURVEILLANCE]: 4, [moleCode]: 0, [third]: 0 });
    endPlayerPhase(sim, { take: true, advance: true, accuse: accusedRow }, atZemoInterrupt);
    expect(sim.state.accusation?.wrong).toHaveLength(wrong);
    // 4 + one per wrong guess + 3 (the accused is wrong) on the attachment; one per wrong guess on the mole and the
    // third member; 3B flips the mole (still an environment) with its counters.
    expect(isAttachment(sim.state, SURVEILLANCE)).toBe(true);
    expect(secrets(sim.state, SURVEILLANCE)).toBe(4 + wrong + 3);
    expect(isAttachment(sim.state, moleCode)).toBe(true);
    expect(secrets(sim.state, moleCode)).toBe(wrong);
    expect(secrets(sim.state, third)).toBe(wrong);
    expect(isAttachment(sim.state, third)).toBe(false);
    // 1[per_hero] for each secret counter on each Board Member attachment.
    expect(threatPlacedAfterStage3(sim)).toBe(4 + wrong + 3 + wrong);
  });

  it("threat the Surveillance Aid places on The Accusation (a stage with no threat meter) neither completes it nor carries to Fighting Zemo; the scheme then ends the game by its own count", () => {
    // 50182b: "After a secret counter is placed here, place 2 threat on the main scheme" (twice in step 2 and 3: two
    // placings). RRG 'Advance' discards the old stage's threat; stage 2's dashed target is not a completion. What the
    // joined Aid and the mole put on stage 3 is 11 for one hero, and the villain phase's acceleration (2) makes 13 against
    // a target of 12: the game is lost by the stage-3 count alone.
    const { sim, accusedRow, mole } = surveillanceAccused();
    const moleCode = mole.boardMember as string;
    const third = MEMBERS.find((c) => c !== SURVEILLANCE && c !== moleCode)!;
    sim.state = withSecrets(sim.state, { [SURVEILLANCE]: 4, [moleCode]: 0, [third]: 0 });
    endPlayerPhase(sim, { take: true, advance: true, accuse: accusedRow }, atZemoInterrupt);
    const stage2Placed = sim.events
      .slice(
        sim.events.findIndex((e) => e.type === "moleIdentified"),
        sim.events.findIndex((e) => e.type === "mainSchemeAdvanced" && e.stageIndex === 2),
      )
      .filter((e) => e.type === "threatPlaced");
    expect(stage2Placed.length).toBeGreaterThan(0);
    expect(types(sim.events, "mainSchemeCompleted").map((e) => e.stageIndex)).toEqual([2]);
    expect(sim.state.outcome).toEqual({ result: "loss", reason: "mainSchemeCompleted" });
    expect(inst(sim.state, sim.state.mainScheme.instanceId).threat).toBe(threatPlacedAfterStage3(sim) + 2);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Zemo's defeat reset
// ---------------------------------------------------------------------------------------------------------------------

describe("Baron Zemo's reset instead of defeat (cards 50165a / 50166a; MC50 p. 4 and the p. 22 FAQ)", () => {
  const total = secretsTotal;

  it("the damage past his hit points is not kept: Haymaker (3) at 1 hit point left resets him to 12 whole, and he is not 'defeated' for other cards (MC50 p. 22 FAQ)", () => {
    // FAQ: "Am I considered to have defeated one of these villains if I reduce their hit points to 0? No, the forced
    // effects on these villains replace the defeating of the villain, so the villain has not been defeated".
    const sim = open();
    const zemo = villainOf(sim.state);
    sim.state = withDamage(sim.state, zemo, 11);
    const played = playFromHand(DEPS, sim.state, HAYMAKER, 2, picking(zemo));
    expect(inst(played.state, zemo).damage).toBe(0);
    expect(remainingHitPoints(played.state, zemo, DEPS)).toBe(12);
    expect(played.state.villains[0]!.defeated).toBe(false);
    expect(total(played.state)).toBe(3);
  });

  it("a tough status card prevents the damage: no reset, no counters removed, the card is spent (RRG 1.8 'Tough' p. 44)", () => {
    const sim = open();
    const zemo = villainOf(sim.state);
    const staged = withStatus(withDamage(sim.state, zemo, 11), zemo, "tough");
    const hit = heroAttacks(DEPS, staged, zemo);
    expect(inst(hit.state, zemo).statuses.tough).toBe(0);
    expect(inst(hit.state, zemo).damage).toBe(11);
    expect(total(hit.state)).toBe(6);
  });

  it("overkill from a minion's defeat is damage to Zemo too: it resets him (RRG 1.8 'Overkill' p. 31; MC50 p. 22 M.O.D.O.K. FAQ, the same order)", () => {
    // Relentless Assault paid with physical resources gains overkill: the Agent (3 hit points) at 1 left takes 5, the
    // 4 excess goes to the villain at 11 damage, so he would be defeated: the reset replaces it. The Agent's own
    // Forced Interrupt (when it is defeated) puts 1 counter on the fewest environment.
    const sim = open({ seats: [IRON_MAN] });
    const zemo = villainOf(sim.state);
    const agent = engageMinion(sim.state, AGENT, P1);
    let state = withDamage(agent.state, zemo, 11);
    state = withDamage(state, agent.id, 2);
    const owner = playerOf(state, P1);
    const printsPhysical = (id: InstanceId) =>
      ((state.cardPool[state.instances[id]!.cardId] as { resourceIcons?: { physical?: number } }).resourceIcons
        ?.physical ?? 0) > 0;
    const paying = [...owner.hand, ...owner.deck]
      .filter(printsPhysical)
      .slice(0, 2)
      .map((id) => codeOf(state, id));
    expect(paying).toHaveLength(2);
    const given = moveToHand(state, P1, RELENTLESS_ASSAULT, ...paying);
    const [event, ...pay] = given.ids as InstanceId[];
    const before = total(given.state);
    const cast = driveEventsPicking(DEPS, given.state, picking(agent.id), play(P1, event!, pay));
    expect(piles(cast.state).discard).toContain(agent.id);
    expect(inst(cast.state, zemo).damage).toBe(0);
    expect(cast.state.villains[0]!.defeated).toBe(false);
    expect(cast.state.outcome).toBeNull();
    // The Agent's defeat interrupt (+1) and the reset's removal (-3).
    expect(total(cast.state)).toBe(before + 1 - 3);
  });

  it("the Unmasked face has no reset: lethal damage defeats him and the players win (MC50 p. 19, 'If the players defeat this version of Baron Zemo, they win')", () => {
    const sim = open();
    toStage3(sim, {});
    resolveAll(sim, {});
    const zemo = villainOf(sim.state);
    expect(sim.state.villains[0]!.side).toBe("B");
    const hit = heroAttacks(DEPS, withDamage(sim.state, zemo, (maxHitPoints(sim.state, zemo, DEPS) ?? 1) - 1), zemo);
    expect(hit.state.outcome?.result).toBe("win");
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Stun, confuse and steady on both faces
// ---------------------------------------------------------------------------------------------------------------------

describe("status cards and the Unmasked Forced Interrupt (RRG 1.8 'Stun' p. 41, 'Confuse' p. 13, 'Steady' p. 41, 'Flip' p. 20; MC50 p. 22 FAQ)", () => {
  // "When Baron Zemo activates against you": a stunned villain that would attack removes the stun instead and "is not
  // considered to have attacked", so it did not activate (RRG "Activation" p. 6); MC50 p. 22 FAQ: "Status cards take
  // priority over all other effects, so the villain will remove the stunned status instead of activating".
  it("standard: a stun placed on the masked face survives the flip to the Unmasked face (same card type, RRG 'Flip'), cancels his first attack, and no interrupt is offered", () => {
    const sim = open();
    const zemo = villainOf(sim.state);
    sim.state = withStatus(sim.state, zemo, "stunned");
    endPlayerPhase(sim, { take: true, advance: true, accuse: moleRow(sim.state) });
    expect(sim.state.villains[0]!.side).toBe("B");
    expect(inst(sim.state, zemo).statuses.stunned).toBe(0);
    expect(attacksByZemo(sim)).toBe(0);
    expect(giveOffered(sim)).toBe(0);
  });

  it("control: the same game unstunned attacks, and the interrupt is offered once (the one activation)", () => {
    const sim = open();
    endPlayerPhase(sim, { take: true, advance: true, accuse: moleRow(sim.state) });
    expect(attacksByZemo(sim)).toBe(1);
    expect(giveOffered(sim)).toBe(1);
  });

  it("expert: one stunned card on the steady Unmasked face is not a stun (RRG 'Steady'): he attacks, the interrupt is offered, and the card stays", () => {
    const sim = open({ difficulty: "expert" });
    const zemo = villainOf(sim.state);
    sim.state = withStatus(sim.state, zemo, "stunned");
    endPlayerPhase(sim, { take: true, advance: true, accuse: moleRow(sim.state) });
    expect(hasKeyword(sim.state, zemo, "steady", DEPS)).toBe(true);
    expect(attacksByZemo(sim)).toBe(1);
    expect(giveOffered(sim)).toBe(1);
    expect(inst(sim.state, zemo).statuses.stunned).toBe(1);
  });

  it("expert: two stunned cards stun the steady Unmasked face: both go at once, he does not attack and no interrupt is offered", () => {
    const sim = open({ difficulty: "expert" });
    const zemo = villainOf(sim.state);
    endPlayerPhase(sim, { take: true, advance: true, accuse: moleRow(sim.state) });
    expect(giveOffered(sim)).toBe(1);
    const round2 = { ...sim, asked: [] as Asked[], events: [] as GameEvent[] };
    round2.state = withStatus(sim.state, zemo, "stunned", 2);
    drive(round2, {}, [endTurn(P1)]);
    expect(inst(round2.state, zemo).statuses.stunned).toBe(0);
    expect(attacksByZemo(round2)).toBe(0);
    expect(giveOffered(round2)).toBe(0);
  });

  it("alter-ego: a confused Zemo's scheme is replaced by discarding the card, so he did not activate and no interrupt is offered; unconfused, the same scheme offers it", () => {
    // RRG 'Confuse' p. 13: "If a confused villain or minion would scheme, discard the confused status card instead."
    const confusedSim = open({ hero: false });
    const zemo = villainOf(confusedSim.state);
    confusedSim.state = withStatus(confusedSim.state, zemo, "confused");
    endPlayerPhase(confusedSim, { take: true, advance: true, accuse: moleRow(confusedSim.state) });
    expect(inst(confusedSim.state, zemo).statuses.confused).toBe(0);
    expect(giveOffered(confusedSim)).toBe(0);
    const control = open({ hero: false });
    endPlayerPhase(control, { take: true, advance: true, accuse: moleRow(control.state) });
    expect(giveOffered(control)).toBe(1);
  });

  it("hero form: a confused Zemo still attacks (confused cancels a scheme or thwart only), the interrupt is offered, and the card stays", () => {
    const sim = open();
    const zemo = villainOf(sim.state);
    sim.state = withStatus(sim.state, zemo, "confused");
    endPlayerPhase(sim, { take: true, advance: true, accuse: moleRow(sim.state) });
    expect(attacksByZemo(sim)).toBe(1);
    expect(giveOffered(sim)).toBe(1);
    expect(inst(sim.state, zemo).statuses.confused).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// The Unmasked interrupt on card-made activations
// ---------------------------------------------------------------------------------------------------------------------

describe("Zemo's Unmasked interrupt on an activation a card makes (RRG 1.8 'Activation' p. 6; owner ruling docs/phase7-wave5.md 4.1 Q67)", () => {
  // "Some card abilities can also cause enemies to attack or scheme. These are also considered activations." Might Makes
  // Right (hero) makes Zemo attack the player who revealed it: a second activation against that player in the round.
  it("Might Makes Right (hero) after the accusation: the interrupt is offered for the villain phase's activation and again for the card's", () => {
    const sim = open({ discard: [BLANK, BLANK, MIGHT_MAKES_RIGHT] });
    toStage3(sim);
    resolveAll(sim, {});
    expect(giveOffered(sim)).toBe(1);
    const round2 = { ...sim, asked: [] as Asked[], events: [] as GameEvent[] };
    // The hero is healed: Zemo's two attacks (5 each) must not end the game before the second.
    round2.state = patchInstance(
      stackEncounterDeck(sim.state, BLANK, MIGHT_MAKES_RIGHT, BLANK),
      identityOf(sim.state),
      {
        damage: 0,
      },
    );
    // The counters go on an environment: a joined Aid answers a placing (the Tactical Aid's 2 damage would end this game).
    const environment = MEMBERS.find((c) => !isAttachment(sim.state, c))!;
    drive(round2, { target: memberOf(sim.state, environment) }, [endTurn(P1)]);
    expect(attacksByZemo(round2)).toBe(2);
    expect(giveOffered(round2)).toBe(2);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Unmasked interrupt: where the counters go
// ---------------------------------------------------------------------------------------------------------------------

describe("Zemo's Unmasked interrupt places counters on a joined Aid (50165b / 50166b with 50182b; RRG 1.8 'Forced Response' p. 18)", () => {
  /** The first seed whose mole is the Surveillance Officer, so the mole's attachment answers a placing with 2 threat. */
  function surveillanceMole(difficulty: "standard" | "expert") {
    for (let seed = 1; seed <= 16; seed++) {
      const sim = open({ seed, difficulty });
      if (moleRow(sim.state).boardMember === SURVEILLANCE) return sim;
    }
    throw new Error("no seed makes the Surveillance Officer the mole");
  }
  /** Zemo's interrupt answered with the option `prefix` aimed at the Surveillance Aid; the threat the main scheme gains. */
  function placeOnAid(sim: Sim, prefix: string): { threat: number; counters: number } {
    toStage3(sim);
    const aid = memberOf(sim.state, SURVEILLANCE);
    expect(isAttachment(sim.state, SURVEILLANCE)).toBe(true);
    const main = sim.state.mainScheme.instanceId;
    const before = { threat: inst(sim.state, main).threat, counters: secrets(sim.state, SURVEILLANCE) };
    const pick = mkPicker({ option: prefix, target: aid });
    for (let n = 0; n < 2; n++) {
      const choice = sim.state.pendingChoice!;
      take(
        sim,
        applyOk(
          sim.state,
          {
            type: "resolveChoice",
            playerId: choice.playerId,
            choiceId: choice.choiceId,
            selectedOptionIds: pick(sim.state),
          },
          DEPS,
        ),
      );
    }
    // The Aid's Forced Response resolves after the placing; stop at the attack's defender prompt.
    resolveAll(sim, {}, (st) => st.pendingChoice?.prompt.kind === "declareDefender");
    return {
      threat: inst(sim.state, main).threat - before.threat,
      counters: secrets(sim.state, SURVEILLANCE) - before.counters,
    };
  }

  it("standard 50165b: 1 secret counter on the mole's Surveillance Aid is one placing: 2 threat on Fighting Zemo", () => {
    const gained = placeOnAid(surveillanceMole("standard"), "Place 1");
    expect(gained).toEqual({ threat: 2, counters: 1 });
  });

  it("expert 50166b: 2 secret counters are one placing, so the Aid answers once (2 threat, not 4)", () => {
    const gained = placeOnAid(surveillanceMole("expert"), "Place 2");
    expect(gained).toEqual({ threat: 2, counters: 2 });
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Fewest secret counters: environments only
// ---------------------------------------------------------------------------------------------------------------------

describe("'the Board Member environment with the fewest secret counters' once the mole has joined Zemo (50172; Sword 50170 and Might Makes Right 50176 share the pattern)", () => {
  it("the mole's attachment, though it holds the fewest, is not an environment: the Agent's counter goes on one of the other two", () => {
    const sim = open({ deck: [AGENT, AGENT, SWORD] });
    const moleCode = moleRow(sim.state).boardMember as string;
    const [first, second] = MEMBERS.filter((c) => c !== moleCode) as [string, string];
    sim.state = withSecrets(sim.state, { [moleCode]: 0, [first]: 2, [second]: 2 });
    // Zemo's own interrupt (step 2) puts its counter on `first`; the revealed Agent then activates (quickstrike).
    toStage3(sim);
    resolveAll(sim, { target: memberOf(sim.state, first) });
    expect(isAttachment(sim.state, moleCode)).toBe(true);
    expect(secrets(sim.state, moleCode)).toBe(0);
    expect(secrets(sim.state, first)).toBe(3);
    expect(secrets(sim.state, second)).toBe(3);
    expect(environmentsTotal(sim.state)).toBe(6);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Keywords and status cards on the encounter cards
// ---------------------------------------------------------------------------------------------------------------------

describe("S.H.I.E.L.D. Agent 50172: Vulnerable (RRG 1.8 'Vulnerable' p. 48)", () => {
  it("stunned, the Agent is discarded without being defeated: its When-defeated interrupt does not put a counter on a Board Member", () => {
    const sim = open();
    const agent = engageMinion(sim.state, AGENT, P1);
    const before = secretsTotal(agent.state);
    const stunned = stunWith(DEPS, agent.state, agent.id);
    expect(piles(stunned.state).discard).toContain(agent.id);
    expect(types(stunned.events, "characterDefeated").map((e) => e.instanceId)).not.toContain(agent.id);
    expect(secretsTotal(stunned.state)).toBe(before);
  });
});

describe("Hinder on the side schemes (RRG 1.8 'Hinder X' p. 22; cards 50173 and 50174)", () => {
  it("each enters play with its 3 starting threat plus 1[per_hero] from Hinder: 5 at two players", () => {
    const sim = open({ players: 2, deck: [AGENT, AGENT, DIVIDED_LOYALTIES, UNDERMINE_SUPPORT] });
    drive(
      sim,
      {},
      sim.state.players.map((p) => endTurn(p.playerId)),
    );
    const loyalties = inPlayCard(sim.state, DIVIDED_LOYALTIES);
    const undermine = inPlayCard(sim.state, UNDERMINE_SUPPORT);
    expect(loyalties).toBeDefined();
    expect(undermine).toBeDefined();
    expect(inst(sim.state, loyalties!).threat).toBe(5);
    expect(inst(sim.state, undermine!).threat).toBe(5);
  });
});

describe("Undermine Support 50174 (RRG 1.8 'Ready' p. 36)", () => {
  /** An exhausted Aunt May, an exhausted Interrogation Room and an exhausted Black Cat, with the side scheme in play. */
  function table() {
    const sim = open();
    const may = playFromHand(DEPS, sim.state, AUNT_MAY, 1);
    const room = playFromHand(DEPS, may.state, INTERROGATION_ROOM, 1);
    const cat = playFromHand(DEPS, room.state, BLACK_CAT, 2);
    let state = encounterCardInVillainArea(cat.state, UNDERMINE_SUPPORT, 3).state;
    for (const id of [may.id, room.id, cat.id]) state = patchInstance(state, id, { exhausted: true });
    sim.state = state;
    return { sim, supports: [may.id, room.id], ally: cat.id };
  }
  const payments = (sim: Sim) => sim.asked.filter((a) => a.kind === "spendResources" || a.kind === "payForAbility");

  it("the cost is per support: with one resource spent only one of two supports readies, and the ally readies for free", () => {
    const { sim, supports, ally } = table();
    endPlayerPhase(sim, { pays: [1, 0] });
    expect(payments(sim)).toHaveLength(2);
    expect(supports.filter((id) => !inst(sim.state, id).exhausted)).toHaveLength(1);
    expect(inst(sim.state, ally).exhausted).toBe(false);
  });

  it("each cost is its own decision: paying for both readies both", () => {
    const { sim, supports } = table();
    endPlayerPhase(sim, { pays: [1, 1] });
    expect(supports.every((id) => !inst(sim.state, id).exhausted)).toBe(true);
  });
});

describe("Divided Loyalties 50173 on an ally with a status card (RRG 1.8 'Stun' p. 41, 'Confuse' p. 13)", () => {
  // RRG 'Stun': "If a stunned identity or ally attempts to attack ... discard the stunned card instead. Costs
  // associated with the attack attempt, including exhausting the character, must still be paid." 'Confuse' says the same
  // of a thwart. The additional resource is such a cost.
  function loyal() {
    const sim = open({ discard: [DIVIDED_LOYALTIES] });
    const cat = playFromHand(DEPS, sim.state, BLACK_CAT, 2);
    const scheme = encounterCardInVillainArea(cat.state, DIVIDED_LOYALTIES, 3);
    return { state: scheme.state, cat: cat.id, scheme: scheme.id, zemo: villainOf(sim.state) };
  }
  const attack = (state: GameState, cat: InstanceId, zemo: InstanceId, pay: boolean) =>
    applyCommand(
      state,
      {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: cat,
        targetInstanceId: zemo,
        ...(pay ? { payment: [{ fromHand: playerOf(state, P1).hand[0]! }] } : {}),
      },
      DEPS,
    );

  it("a stunned ally's attack still costs the resource: the stun is discarded, the ally exhausts, nothing is damaged", () => {
    const { state, cat, zemo } = loyal();
    const stunned = withStatus(state, cat, "stunned");
    const result = attack(stunned, cat, zemo, true);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(playerOf(result.state, P1).hand).toHaveLength(playerOf(stunned, P1).hand.length - 1);
    expect(inst(result.state, cat).statuses.stunned).toBe(0);
    expect(inst(result.state, cat).exhausted).toBe(true);
    expect(inst(result.state, zemo).damage).toBe(0);
  });

  it("unpaid, the stunned ally's attack is refused and the stun stays", () => {
    const { state, cat, zemo } = loyal();
    const stunned = withStatus(state, cat, "stunned");
    const result = attack(stunned, cat, zemo, false);
    expect(result.ok).toBe(false);
    expect(inst(stunned, cat).statuses.stunned).toBe(1);
  });

  it("a confused ally's thwart still costs the resource: the confusion is discarded, the ally exhausts, no threat is removed", () => {
    const { state, cat, scheme } = loyal();
    const confused = withStatus(state, cat, "confused");
    const result = applyCommand(
      confused,
      {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: cat,
        schemeInstanceId: scheme,
        payment: [{ fromHand: playerOf(confused, P1).hand[0]! }],
      },
      DEPS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(playerOf(result.state, P1).hand).toHaveLength(playerOf(confused, P1).hand.length - 1);
    expect(inst(result.state, cat).statuses.confused).toBe(0);
    expect(inst(result.state, cat).exhausted).toBe(true);
    expect(inst(result.state, scheme).threat).toBe(3);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Fighting Zemo's find, the Response with a short pile
// ---------------------------------------------------------------------------------------------------------------------

describe("3A 'Find Baron Zemo's Sword and attach it to him' (RRG 1.8 'Find' p. 19)", () => {
  const swordsOnZemo = (s: GameState) => s.instances[villainOf(s)]!.attachments.filter((a) => codeOf(s, a) === SWORD);

  it("from the encounter discard pile: the Sword discarded earlier is found and attached", () => {
    const sim = open({ deck: [AGENT, UNDERMINE_SUPPORT], discard: [SWORD] });
    toStage3(sim);
    expect(swordsOnZemo(sim.state)).toHaveLength(1);
  });

  it("already attached to Zemo (revealed in an earlier round): it stays attached once, and is not duplicated or discarded", () => {
    const sim = open({ deck: [AGENT, UNDERMINE_SUPPORT, SWORD] });
    const sword = piles(sim.state).deck.find((i) => codeOf(sim.state, i) === SWORD)!;
    const zemo = villainOf(sim.state);
    sim.state = {
      ...sim.state,
      encounterDecks: {
        ...sim.state.encounterDecks,
        [activeEncounterDeckId(sim.state)]: {
          deck: piles(sim.state).deck.filter((i) => i !== sword),
          discard: [],
        },
      },
      instances: {
        ...sim.state.instances,
        [sword]: { ...sim.state.instances[sword]!, attachedTo: zemo, faceup: true, controllerId: null },
        [zemo]: { ...sim.state.instances[zemo]!, attachments: [sword] },
      },
    };
    toStage3(sim);
    expect(swordsOnZemo(sim.state)).toEqual([sword]);
    expect(piles(sim.state).discard).not.toContain(sword);
  });
});

describe("Zemo's Manipulations 1B with a short S.H.I.E.L.D. pile (owner Q30 = A decides the empty pile only; docs/phase7-wave9.md 3.29)", () => {
  it("one card left: the 2 counters are placed and the one card is gained (as many as are left)", () => {
    const sim = open();
    const [kept, ...rest] = shieldOf(sim.state);
    sim.state = {
      ...sim.state,
      hiddenPiles: { ...sim.state.hiddenPiles!, shield: [kept!] },
      revealedPileCards: { shield: rest },
    };
    sim.state = withSecrets(sim.state, { [SURVEILLANCE]: 0 });
    endPlayerPhase(sim, { take: true, gain: true });
    expect(secrets(sim.state, SURVEILLANCE)).toBe(2);
    expect(shieldOf(sim.state)).toEqual([]);
    expect(sim.state.revealedPileCards?.["shield"]).toHaveLength(6);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// The Ends Justify the Means: options that cannot be chosen
// ---------------------------------------------------------------------------------------------------------------------

describe("The Ends Justify the Means 50177 when an option has no target (RRG 1.8 'Choose (Option)' p. 12, 'Target' p. 42)", () => {
  // "When an encounter card requires a player to choose an option, they cannot choose an option that requires one or
  // more targets if there are no valid targets for that option." A minion, an ally or a support is a target (RRG
  // 'Target' lists "a minion", "an ally", "a card"), and an ability that requires one "can only be initiated if it has at
  // least one valid target".
  //
  // FINDING (Zemo 1): both options are always offered. The defeat option with no minion in play can be chosen (it only
  // makes Zemo scheme), and the discard option with no ally or support can be chosen and pays nothing: the card then does
  // nothing at all, no defeat and no scheme. Script fix, one line each: `option(..., { when: exists(query("minion")) }, ...)`
  // and `{ when: exists(query(["ally", "support"], { controller: "you" })) }` (the DSL has `when:` on an option).
  const atEnds = (s: GameState): boolean =>
    s.pendingChoice?.prompt.kind === "chooseOption" &&
    s.pendingChoice.options.some(
      (o) => o.label.startsWith("Baron Zemo defeats") || o.label.startsWith("Discard an ally"),
    );
  const offered = (sim: Sim): string[] => sim.state.pendingChoice?.options.map((o) => o.label) ?? [];
  const noMinion = () => {
    const sim = open({ deck: [UNDERMINE_SUPPORT, "50177", AGENT] });
    sim.state = playFromHand(DEPS, sim.state, BLACK_CAT, 2).state;
    drive(sim, {}, [endTurn(P1)], atEnds);
    return sim;
  };
  const noAlly = () => {
    const sim = open({ deck: [UNDERMINE_SUPPORT, "50177", AGENT] });
    sim.state = engageMinion(sim.state, AGENT, P1).state;
    drive(sim, {}, [endTurn(P1)], atEnds);
    return sim;
  };

  it("no minion in play: the defeat option is not offered (the ally can be discarded instead)", () => {
    expect(offered(noMinion()).some((l) => l.startsWith("Baron Zemo defeats"))).toBe(false);
  });

  it("no ally or support you control: the discard option is not offered (the minion can be defeated instead)", () => {
    expect(offered(noAlly()).some((l) => l.startsWith("Discard an ally"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Baron Zemo's Sword: a Hero Action with no secret counter to remove
// ---------------------------------------------------------------------------------------------------------------------

describe("Baron Zemo's Sword 50170 Hero Action when no Board Member environment holds a secret counter (RRG 1.8 'Target' p. 42, 'Cost' p. 13)", () => {
  // "remove 1 secret counter from a Board Member environment and discard this card": the environment is a target, and
  // an ability that requires a target "can only be initiated if it has at least one valid target ... if any part of that
  // ability can affect that target" - an environment with no secret counter cannot have one removed. So with all three
  // at 0 the action cannot be initiated and its three resources are not spent.
  //
  // FINDING (Zemo 2): see the two tests.
  function table() {
    const sim = open({ deck: [AGENT, SWORD] });
    const sworded = attachToHost(sim.state, SWORD, villainOf(sim.state));
    let state = withSecrets(sworded.state, { [MEDICAL]: 0, [SURVEILLANCE]: 0, [TACTICAL]: 0 });
    state = {
      ...state,
      players: state.players.map((p) => ({ ...p, deck: [...p.deck, ...p.hand], hand: [] })),
    };
    const given = moveToHand(state, P1, "01002", "01006", "01007");
    sim.state = given.state;
    return { sim, sword: sworded.id, hand: given.ids };
  }
  const tryAction = (sim: Sim, sword: InstanceId) => {
    const result = applyCommand(sim.state, use(P1, sword, "50170.baron-zemos-sword-action"), DEPS);
    if (!result.ok) return { used: false, spent: 0, discarded: false };
    take(sim, result);
    resolveAll(sim, { option: "Spend three [energy]", pays: [3] });
    return {
      used: true,
      spent: 3 - playerOf(sim.state, P1).hand.length,
      discarded: piles(sim.state).discard.includes(sword),
    };
  };

  it("cannot be initiated: nothing is spent and the Sword stays on Zemo", () => {
    const { sim, sword } = table();
    const outcome = tryAction(sim, sword);
    expect(outcome.spent).toBe(0);
    expect(outcome.discarded).toBe(false);
  });
});

describe("Baron Zemo's reset removes counters from environments only (cards 50165a / 50166a: 'from among Board Member environments')", () => {
  it("a Board Member that has already joined Zemo keeps its counters: only the 1 left on the environments is removed", () => {
    const sim = open();
    const zemo = villainOf(sim.state);
    sim.state = withSecrets(sim.state, { [MEDICAL]: 4, [SURVEILLANCE]: 1, [TACTICAL]: 0 });
    // A state check turns the 4-counter Medical Officer into its attachment on the next command.
    const played = playFromHand(DEPS, withDamage(sim.state, zemo, 11), HAYMAKER, 2, picking(zemo));
    expect(isAttachment(played.state, MEDICAL)).toBe(true);
    expect(secrets(played.state, MEDICAL)).toBe(4);
    expect(secrets(played.state, SURVEILLANCE)).toBe(0);
    expect(remainingHitPoints(played.state, zemo, DEPS)).toBe(12);
  });
});
