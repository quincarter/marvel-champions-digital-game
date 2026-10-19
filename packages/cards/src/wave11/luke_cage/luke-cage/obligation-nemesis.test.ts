import { cardId } from "@mc/content";
import {
  activeEncounterDeck,
  activeEncounterDeckId,
  createGame,
  sessionApply,
  startSession,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  playerOf,
  settle,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../../testing/staging.js";
import { engageMinion, stagedInPlay } from "../../../wave9/falcon/testing.js";
import { WAVE11_CARDS } from "../../cards.js";
import { WAVE11_DEPS } from "../../index.js";
import {
  LUKE_CAGE_LUKE_CAGE_OBLIGATION_NEMESIS as REGISTRY,
  LUKE_CAGE_LUKE_CAGE_OBLIGATION_NEMESIS_SKIPPED as SKIPPED,
} from "./obligation-nemesis.js";

vi.setConfig({ testTimeout: 180_000 });

/**
 * Wave 11 `luke_cage/luke-cage/obligation-nemesis` (docs/phase7-wave11-hero-packs.md H8.4, H3.2, H3.3, H3.21): Internal
 * Injury 62028, Cottonmouth 62029, Venomous Whispers 62030, Augmented Jaws 62031, Asp 62032 and Sidewinder 62033, from
 * a hand-built Luke Cage deck against Core's Rhino (ATK 2, SCH 1; Luke Cage has 10 hit points). Cards the encounter deck
 * deals are stacked on top of it; every other encounter card is turned into Advance (a treachery with no boost icon),
 * so a boost or a dealt card adds nothing.
 */
const INJURY_F = "62028.internal-injury-forced-response";
const INJURY_R = "62028.internal-injury-response";
const COTTONMOUTH_F = "62029.cottonmouth-forced-response";
const COTTONMOUTH_B = "62029.boost";
const WHISPERS_C = "62030.venomous-whispers-constant";
const WHISPERS_D = "62030.when-defeated";
const WHISPERS_B = "62030.boost";
const JAWS_I = "62031.augmented-jaws-forced-interrupt";
const JAWS_A = "62031.augmented-jaws-action";
const ASP_F = "62032.asp-forced-response";
const ASP_B = "62032.boost";
const SIDEWINDER_I = "62033.sidewinder-forced-interrupt";
const OBLIGATION = "62028.obligation";
const POWER_MAN = "62011";
const BRACER = "62010";
const GENIUS = "62026";
const SHOCKER = "01103"; // Core minion: ATK 2, 3 hit points, not a Serpent Society minion
const ADVANCE = "01186";
const STAMPEDE = "01106"; // a treachery whose boost is two icons and no star
const FILLER = "01091";

const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const idOf = (s: GameState, code: string): InstanceId =>
  (Object.keys(s.instances) as InstanceId[]).find((i) => codeOf(s, i) === code)!;
const damageOf = (s: GameState, id: InstanceId = identityOf(s)): number => inst(s, id).damage;
const toughOf = (s: GameState, id: InstanceId = identityOf(s)): number => inst(s, id).statuses.tough;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const encounterDiscardCodes = (s: GameState): string[] => activeEncounterDeck(s).discard.map((i) => codeOf(s, i));

function lukeGame(form: "hero" | "alterEgo" = "hero"): GameState {
  const base = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: WAVE11_CARDS,
  } as never);
  const deck = [POWER_MAN, BRACER, GENIUS, "62002", ...Array(40).fill(FILLER)].slice(0, 40);
  const created = createGame(
    {
      ...base,
      requireLegalDecks: false,
      players: [{ identityCardId: cardId("62001a"), aspects: ["leadership"], deck: deck.map((c) => cardId(c)) }],
    },
    WAVE11_DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  const opened = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
  return form === "hero" ? withForm(opened, { heroForm: 0 }) : opened;
}
const stunnedVillain = (s: GameState): GameState =>
  patchInstance(s, villainOf(s), { statuses: { ...inst(s, villainOf(s)).statuses, stunned: 1 } });
const withTough = (s: GameState, n: number): GameState =>
  patchInstance(s, identityOf(s), { statuses: { ...inst(s, identityOf(s)).statuses, tough: n } });

/**
 * The given cards (a nemesis-set card from P1's set-aside cards, else from the encounter deck or discard pile) on top
 * of the encounter deck in order, and the next 15 cards turned into Advance.
 */
function onTop(state: GameState, ...codes: readonly string[]): GameState {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const taken: InstanceId[] = [];
  for (const code of codes) {
    const wanted = (i: InstanceId) => codeOf(state, i) === code && !taken.includes(i);
    const id = playerOf(state, P1).setAside.find(wanted) ?? pile.deck.find(wanted) ?? pile.discard.find(wanted);
    if (!id) throw new Error(`no ${code}`);
    taken.push(id);
  }
  const rest = pile.deck.filter((i) => !taken.includes(i));
  const placed: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1 ? { ...p, setAside: p.setAside.filter((i) => !taken.includes(i)) } : p,
    ),
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { deck: [...taken, ...rest], discard: pile.discard.filter((i) => !taken.includes(i)) },
    },
  };
  return rest.slice(0, 15).reduce((acc, i) => patchInstance(acc, i, { cardId: cardId(ADVANCE) }), placed);
}
/** A set-aside nemesis minion `code` put engaged with P1, faceup, by surgery under its own instance id. */
function engaged(state: GameState, code: string): { state: GameState; id: InstanceId } {
  const id = playerOf(state, P1).setAside.find((i) => codeOf(state, i) === code)!;
  const left: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1 ? { ...p, setAside: p.setAside.filter((i) => i !== id), playArea: [...p.playArea, id] } : p,
    ),
  };
  return { id, state: patchInstance(left, id, { faceup: true, controllerId: null, engagedWith: P1 }) };
}
/** A set-aside card `code` faceup in the villain area (a side scheme), holding `threat`. */
function sideScheme(state: GameState, code: string, threat: number): { state: GameState; id: InstanceId } {
  const id = playerOf(state, P1).setAside.find((i) => codeOf(state, i) === code)!;
  const left: GameState = {
    ...state,
    players: state.players.map((p) => (p.playerId === P1 ? { ...p, setAside: p.setAside.filter((i) => i !== id) } : p)),
    villainArea: [...state.villainArea, id],
  };
  return { id, state: patchInstance(left, id, { faceup: true, threat, controllerId: null }) };
}
/** Internal Injury in P1's play area, faceup, as if drawn earlier. */
function injury(state: GameState): GameState {
  const placed = engageMinion(state, "62028", "injury");
  return patchInstance(placed, "injury" as InstanceId, { engagedWith: null });
}
/** Augmented Jaws (set aside) attached to the villain. */
function jawsOnVillain(state: GameState): { state: GameState; id: InstanceId } {
  const jaws = playerOf(state, P1).setAside.find((i) => codeOf(state, i) === "62031")!;
  const left: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1 ? { ...p, setAside: p.setAside.filter((i) => i !== jaws) } : p,
    ),
  };
  const attached = patchInstance(left, jaws, { faceup: true, controllerId: null, attachedTo: villainOf(left) });
  return { id: jaws, state: patchInstance(attached, villainOf(attached), { attachments: [jaws] }) };
}

const declines: Picker = (s) => (s.pendingChoice!.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s));
/** Takes an offered response or interrupt of `card` (an option naming it), declines every defense, else the first answer. */
const accepting =
  (card: InstanceId): Picker =>
  (s) => {
    const hit = s.pendingChoice?.options.find(
      (o) => (o.ref.kind === "card" || o.ref.kind === "ability") && o.ref.instanceId === card,
    );
    return hit ? [hit.optionId] : declines(s);
  };
const refused = (state: GameState, command: Command): boolean =>
  !sessionApply(startSession(state), command, WAVE11_DEPS).ok;
const basicAttack = (state: GameState, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: identityOf(state),
  targetInstanceId: target,
});

describe("wave 11 luke_cage/luke-cage/obligation-nemesis registry", () => {
  it("registers only valid definitions, with the printed timing, and skips nothing", () => {
    for (const id of Object.keys(REGISTRY)) expect(validateDefinition(REGISTRY[id]!), id).toEqual([]);
    expect(SKIPPED).toEqual({});
    expect(Object.keys(REGISTRY).sort()).toEqual(
      [
        OBLIGATION,
        INJURY_F,
        INJURY_R,
        COTTONMOUTH_F,
        COTTONMOUTH_B,
        WHISPERS_C,
        WHISPERS_D,
        WHISPERS_B,
        JAWS_I,
        JAWS_A,
        ASP_F,
        ASP_B,
        SIDEWINDER_I,
      ].sort(),
    );
    expect(REGISTRY[INJURY_F]!.trigger).toMatchObject({ kind: "response", forced: true });
    expect(REGISTRY[INJURY_R]!.trigger).toMatchObject({ kind: "response", forced: false, form: "alterEgo" });
    expect(REGISTRY[COTTONMOUTH_F]!.trigger).toMatchObject({ kind: "response", forced: true });
    expect(REGISTRY[COTTONMOUTH_F]!.limit).toEqual({ count: 1, period: "phase" });
    expect(REGISTRY[WHISPERS_C]!.trigger).toMatchObject({ kind: "constant" });
    expect(REGISTRY[WHISPERS_D]!.trigger).toMatchObject({ kind: "whenDefeated" });
    for (const id of [COTTONMOUTH_B, WHISPERS_B, ASP_B])
      expect(REGISTRY[id]!.trigger, id).toMatchObject({ kind: "boost" });
    expect(REGISTRY[JAWS_I]!.trigger).toMatchObject({ kind: "interrupt", forced: true });
    expect(REGISTRY[JAWS_A]!.trigger).toMatchObject({ kind: "action", form: "hero" });
    expect(REGISTRY[ASP_F]!.trigger).toMatchObject({ kind: "response", forced: true });
    expect(REGISTRY[SIDEWINDER_I]!.trigger).toMatchObject({ kind: "interrupt", forced: true });
  });
});

describe(`${INJURY_F}: after the player phase ends, take 3 unpreventable damage (ignoring tough)`, () => {
  const run = (state: GameState, pick: Picker = declines) =>
    driveEventsPicking(WAVE11_DEPS, onTop(stunnedVillain(injury(state))), pick, endTurn(P1));

  it("deals 3 to Luke Cage, flagged unpreventable, and leaves both tough cards", () => {
    const { state, events } = run(withTough(lukeGame(), 2));
    expect(damageOf(state)).toBe(3);
    expect(toughOf(state)).toBe(2);
    expect(ofType(events, "damageDealt").map((e) => [e.amount, e.unpreventable])).toEqual([[3, true]]);
  });

  it("is not reduced by a ready Metal Bracer, which is not even offered (H3.3)", () => {
    const withBracer = stagedInPlay(withTough(lukeGame(), 2), BRACER, { attach: true });
    let offered = false;
    const watching: Picker = (s) => {
      if (
        (s.pendingChoice?.options ?? []).some(
          (o) => (o.ref.kind === "card" || o.ref.kind === "ability") && o.ref.instanceId === withBracer.id,
        )
      )
        offered = true;
      return declines(s);
    };
    const { state } = run(withBracer.state, watching);
    expect(offered).toBe(false);
    expect(damageOf(state)).toBe(3);
    expect(toughOf(state)).toBe(2);
    expect(inst(state, withBracer.id).exhausted).toBe(false);
  });

  it("defeats Luke Cage at 3 remaining hit points", () => {
    const base = lukeGame();
    const { state } = run(patchInstance(base, identityOf(base), { damage: 7 }));
    expect(state.outcome).toEqual({ result: "loss", reason: "allPlayersDefeated" });
  });
});

describe(`${INJURY_R}: Alter-Ego Response, after you recover, remove Internal Injury from the game`, () => {
  const recovering = () => {
    const base = lukeGame("alterEgo");
    return patchInstance(injury(base), identityOf(base), { damage: 4 });
  };
  const recover: Command = { type: "basicRecover", playerId: P1 };

  it("removes it from the game when the response is taken", () => {
    const { state } = driveEventsPicking(WAVE11_DEPS, recovering(), accepting("injury" as InstanceId), recover);
    expect(state.removedFromGame).toContain("injury");
    expect(playerOf(state, P1).playArea).not.toContain("injury");
  });

  it("stays in play when the response is declined", () => {
    const { state } = driveEventsPicking(WAVE11_DEPS, recovering(), declines, recover);
    expect(state.removedFromGame).not.toContain("injury");
    expect(playerOf(state, P1).playArea).toContain("injury");
  });
});

describe(`${COTTONMOUTH_F}: after Cottonmouth attacks, he attacks the same character 2 additional times (once per phase)`, () => {
  it("attacks Luke Cage three times in all, 1 damage each, and the extra attacks do not chain", () => {
    const mouth = engaged(onTop(stunnedVillain(lukeGame())), "62029");
    const run = driveEventsPicking(WAVE11_DEPS, mouth.state, declines, endTurn(P1));
    const resolved = ofType(run.events, "attackResolved").filter((e) => e.enemyInstanceId === mouth.id);
    expect(resolved.map((e) => [e.targetInstanceId, e.damageDealt])).toEqual([
      [identityOf(run.state), 1],
      [identityOf(run.state), 1],
      [identityOf(run.state), 1],
    ]);
    expect(damageOf(run.state)).toBe(3);
  });
});

describe(`${COTTONMOUTH_F}: the extra attacks go to the character the first attack ended against`, () => {
  it("an ally who defended is attacked twice more and Luke Cage takes nothing", () => {
    const jessica = stagedInPlay(onTop(stunnedVillain(lukeGame())), "62002");
    const mouth = engaged(jessica.state, "62029");
    const defends: Picker = (s) =>
      s.pendingChoice!.prompt.kind !== "declareDefender"
        ? firstLegal(s)
        : s.pendingChoice!.options.some((o) => o.optionId === jessica.id)
          ? [jessica.id]
          : ["decline"];
    const run = driveEventsPicking(WAVE11_DEPS, mouth.state, defends, endTurn(P1));
    const resolved = ofType(run.events, "attackResolved").filter((e) => e.enemyInstanceId === mouth.id);
    expect(resolved.map((e) => e.targetInstanceId)).toEqual([jessica.id, jessica.id, jessica.id]);
    expect(damageOf(run.state)).toBe(0);
  });
});

describe(`${COTTONMOUTH_F}: the character is gone`, () => {
  it("an ally the first attack defeats is not attacked again, and Luke Cage takes nothing", () => {
    const jessica = stagedInPlay(onTop(stunnedVillain(lukeGame())), "62002");
    const hurt = patchInstance(jessica.state, jessica.id, { damage: 2 });
    const mouth = engaged(hurt, "62029");
    const defends: Picker = (s) =>
      s.pendingChoice!.prompt.kind !== "declareDefender"
        ? firstLegal(s)
        : s.pendingChoice!.options.some((o) => o.optionId === jessica.id)
          ? [jessica.id]
          : ["decline"];
    const run = driveEventsPicking(WAVE11_DEPS, mouth.state, defends, endTurn(P1));
    const resolved = ofType(run.events, "attackResolved").filter((e) => e.enemyInstanceId === mouth.id);
    expect(resolved.map((e) => e.targetInstanceId)).toEqual([jessica.id]);
    expect(playerOf(run.state, P1).playArea).not.toContain(jessica.id);
    expect(damageOf(run.state)).toBe(0);
  });
});

describe(`${COTTONMOUTH_B}: Boost, deal this card to the Luke Cage player as a facedown encounter card`, () => {
  it("Rhino's boost card Cottonmouth is dealt to Luke Cage and revealed: he ends engaged with him", () => {
    const run = driveEventsPicking(WAVE11_DEPS, onTop(lukeGame(), "62029"), declines, endTurn(P1));
    const mouth = idOf(run.state, "62029");
    expect(inst(run.state, mouth).engagedWith).toBe(P1);
    expect(playerOf(run.state, P1).playArea).toContain(mouth);
    // Rhino's attack: ATK 2 plus a boost card of no icons.
    expect(damageOf(run.state)).toBe(2);
  });
});

describe(`${COTTONMOUTH_B}: in a two-player game`, () => {
  it("is dealt to the Luke Cage player even when the other player is the one attacked", () => {
    const base = coreScenario("rhino", {
      players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-spider-man-justice" }],
      seed: 1,
      difficulty: "standard",
      modularSetIds: [],
      cardPool: WAVE11_CARDS,
    } as never);
    const lukeDeck = [POWER_MAN, ...Array(39).fill(FILLER)].map((c) => cardId(c));
    const created = createGame(
      {
        ...base,
        requireLegalDecks: false,
        players: [
          { identityCardId: cardId("62001a"), aspects: ["leadership"], deck: lukeDeck },
          { ...base.players[1]! },
        ],
      },
      WAVE11_DEPS,
    );
    if (!created.ok) throw new Error(created.error.message);
    const opened = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
    // Both are heroes. Rhino attacks Luke Cage first (the blank boost), then the second player (Cottonmouth boosts).
    const second = opened.players[1]!.playerId;
    const heroic = withForm(withForm(opened, { heroForm: 0 }), { heroForm: 0 }, second);
    const stacked = onTop(heroic, ADVANCE, "62029");
    const run = driveEventsPicking(WAVE11_DEPS, stacked, declines, endTurn(P1), endTurn(second));
    const mouth = idOf(run.state, "62029");
    expect(inst(run.state, mouth).engagedWith).toBe(P1);
    expect(playerOf(run.state, P1).playArea).toContain(mouth);
    expect(playerOf(run.state, second).playArea).not.toContain(mouth);
  });
});

describe(`${WHISPERS_C}: each Serpent Society minion cannot be attacked`, () => {
  it("refuses Luke Cage's attack on Cottonmouth while it is in play, and on no other minion", () => {
    const scheme = sideScheme(lukeGame(), "62030", 4);
    const mouth = engaged(scheme.state, "62029");
    const shocker = engageMinion(mouth.state, SHOCKER, "shock");
    expect(refused(shocker, basicAttack(shocker, mouth.id))).toBe(true);
    expect(refused(shocker, basicAttack(shocker, "shock" as InstanceId))).toBe(false);
  });

  it("control: without the side scheme Cottonmouth can be attacked", () => {
    const mouth = engaged(lukeGame(), "62029");
    expect(refused(mouth.state, basicAttack(mouth.state, mouth.id))).toBe(false);
  });
});

describe(`${WHISPERS_D}: the defeating player discards until a Serpent Society minion is discarded and reveals it`, () => {
  it("discards the cards above Asp, then reveals Asp engaged with Luke Cage", () => {
    const scheme = sideScheme(onTop(lukeGame(), ADVANCE, STAMPEDE, "62032"), "62030", 2);
    const thwart: Command = {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(scheme.state),
      schemeInstanceId: scheme.id,
    };
    const { state } = driveEventsPicking(WAVE11_DEPS, scheme.state, declines, thwart);
    const asp = idOf(state, "62032");
    expect(encounterDiscardCodes(state)).toEqual(expect.arrayContaining([ADVANCE, STAMPEDE]));
    expect(playerOf(state, P1).playArea).toContain(asp);
    expect(inst(state, asp).engagedWith).toBe(P1);
    expect(encounterDiscardCodes(state)).not.toContain("62032");
  });
});

describe(`${WHISPERS_B}: Boost, you are confused`, () => {
  it("confuses Luke Cage and adds the side scheme's 2 boost icons to Rhino's attack", () => {
    const run = driveEventsPicking(WAVE11_DEPS, onTop(lukeGame(), "62030"), declines, endTurn(P1));
    expect(inst(run.state, identityOf(run.state)).statuses.confused).toBe(1);
    expect(damageOf(run.state)).toBe(4);
  });
});

describe(`${JAWS_I}: when the attached enemy attacks a character, discard each tough status card from it`, () => {
  it("H3.2: four tough cards are discarded, 4 times 1 unpreventable damage follows, Power Man draws once, then the attack", () => {
    const power = stagedInPlay(withTough(lukeGame(), 4), POWER_MAN, { attach: true });
    const jaws = jawsOnVillain(power.state);
    const run = driveEventsPicking(WAVE11_DEPS, onTop(jaws.state), accepting(power.id), endTurn(P1));
    const kinds = run.events.map((e) => e.type);
    // One discard of four cards: a single log entry, four conditions for Luke Cage's Forced Response (engine reading: spec H3.2, wave 6 Q5).
    expect(ofType(run.events, "statusRemoved").map((e) => e.status)).toEqual(["tough"]);
    const unpreventable = ofType(run.events, "damageDealt").filter((e) => e.unpreventable);
    expect(unpreventable.map((e) => [e.amount, e.targetInstanceId])).toEqual(Array(4).fill([1, identityOf(run.state)]));
    expect(toughOf(run.state)).toBe(0);
    // Power Man (exhausts) answers one of the four discards: one card drawn in the villain phase.
    expect(ofType(run.events.slice(kinds.indexOf("statusRemoved")), "cardDrawn").length).toBe(1);
    expect(inst(run.state, power.id).exhausted).toBe(true);
    // Then the attack: Rhino's ATK 2 plus 1 from Augmented Jaws, with no tough card left to absorb it.
    expect(ofType(run.events, "attackResolved")[0]!.damageDealt).toBe(3);
    expect(kinds.lastIndexOf("statusRemoved")).toBeLessThan(kinds.indexOf("attackResolved"));
    expect(damageOf(run.state)).toBe(7);
  });

  it("control: without the attachment the same attack is absorbed by one tough card", () => {
    const power = stagedInPlay(withTough(lukeGame(), 4), POWER_MAN, { attach: true });
    const run = driveEventsPicking(WAVE11_DEPS, onTop(power.state), declines, endTurn(P1));
    expect(toughOf(run.state)).toBe(3);
    expect(damageOf(run.state)).toBe(1);
  });
});

describe(`${JAWS_A}: Hero Action, spend two mental resources to discard Augmented Jaws`, () => {
  it("discards it, paying with a Genius (two mental)", () => {
    const jaws = jawsOnVillain(lukeGame());
    const genius = moveToHand(jaws.state, P1, GENIUS);
    const { state } = driveEventsPicking(
      WAVE11_DEPS,
      genius.state,
      firstLegal,
      use(P1, jaws.id, JAWS_A, [{ fromHand: genius.ids[0]! }]),
    );
    expect(inst(state, villainOf(state)).attachments).toEqual([]);
    expect(activeEncounterDeck(state).discard).toContain(jaws.id);
  });
});

describe(`${ASP_F}: after Asp schemes against you, you are stunned`, () => {
  it("stuns Luke Cage in alter-ego form", () => {
    const asp = engaged(onTop(lukeGame("alterEgo")), "62032");
    const run = driveEventsPicking(WAVE11_DEPS, asp.state, declines, endTurn(P1));
    expect(inst(run.state, identityOf(run.state)).statuses.stunned).toBe(1);
  });
});

describe(`${ASP_B}: Boost, you are stunned`, () => {
  it("stuns Luke Cage and adds the 2 boost icons to Rhino's attack", () => {
    const run = driveEventsPicking(WAVE11_DEPS, onTop(lukeGame(), "62032"), declines, endTurn(P1));
    expect(inst(run.state, identityOf(run.state)).statuses.stunned).toBe(1);
    expect(damageOf(run.state)).toBe(4);
  });
});

describe(`${SIDEWINDER_I}: when Sidewinder is attacked, discard the top encounter card; a Boost ability deals him away`, () => {
  const attacked = (top: string) => {
    const wind = engaged(onTop(lukeGame(), top), "62033");
    const run = driveEventsPicking(WAVE11_DEPS, wind.state, declines, basicAttack(wind.state, wind.id));
    return { ...run, id: wind.id };
  };

  it("a discarded card with a Boost ability (Cottonmouth): Sidewinder is dealt to the attacker and the attack deals nothing", () => {
    const run = attacked("62029");
    expect(encounterDiscardCodes(run.state)).toEqual(["62029"]);
    expect(playerOf(run.state, P1).playArea).not.toContain(run.id);
    expect(inst(run.state, run.id).damage).toBe(0);
    expect(ofType(run.events, "damageDealt").filter((e) => e.targetInstanceId === run.id)).toEqual([]);
    expect(playerOf(run.state, P1).dealtEncounter).toContain(run.id);
  });

  it("a card with only boost icons (Stampede) has no Boost ability: Sidewinder stays and takes 2 damage", () => {
    const run = attacked(STAMPEDE);
    expect(encounterDiscardCodes(run.state)).toEqual([STAMPEDE]);
    expect(playerOf(run.state, P1).playArea).toContain(run.id);
    expect(inst(run.state, run.id).damage).toBe(2);
  });

  it("a card with no boost at all (Advance): Sidewinder stays and takes 2 damage", () => {
    const run = attacked(ADVANCE);
    expect(encounterDiscardCodes(run.state)).toEqual([ADVANCE]);
    expect(inst(run.state, run.id).damage).toBe(2);
  });
});
