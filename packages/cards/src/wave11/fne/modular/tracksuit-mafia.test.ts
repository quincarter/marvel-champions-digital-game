import { PLAYABLE_CARDS } from "@mc/content";
import {
  activeEncounterDeck,
  createGame,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { coreScenario, encounterCardsOf } from "../../../core/index.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  answer,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  payWith,
  play,
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, withForm } from "../../../testing/staging.js";
import { inPlayFromDeck } from "../../../wave7/next_evol/superpower-testing.js";
import { engageMinion } from "../../../wave6/mut_gen/project-wideawake-testing.js";
import { WAVE11_CARDS } from "../../cards.js";
import { WAVE11_DEPS } from "../../index.js";
import {
  FNE_MODULAR_TRACKSUIT_MAFIA as REGISTRY,
  FNE_MODULAR_TRACKSUIT_MAFIA_SKIPPED as SKIPPED,
} from "./tracksuit-mafia.js";

vi.setConfig({ testTimeout: 180_000 });

const IVAN = "60200";
const CLOWN = "60201";
const MAFIOSO = "60202";
const BRO = "60203";
const MAFIA = "60204";
const ADVANCE = "01186";
const SANDMAN = "01102";
const REFS = [
  "60200.when-revealed",
  "60200.ivan-banionis-forced-response",
  "60201.the-clown-forced-response",
  "60202.when-defeated",
  "60203.when-defeated",
  "60204.when-revealed",
  "60204.tracksuit-mafia-forced-response",
];
/** Core encounter cards with no boost icon and no boost ability: blank boost cards. */
const BLANKS = ["01187", "01187", "01104", "01104", "01105", "01105"];

const data = (code: string) => (WAVE11_CARDS as readonly any[]).find((c) => (c.id as string) === code)!;
const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const idsOf = (s: GameState, code: string): InstanceId[] =>
  (Object.keys(s.instances) as InstanceId[]).filter((i) => codeOf(s, i) === code);
const statuses = (s: GameState, id: InstanceId) => inst(s, id).statuses;
const stack = (s: GameState, boosts: number, ...dealt: readonly string[]): GameState =>
  stackEncounterDeck(s, ...BLANKS.slice(0, boosts), ...dealt);
const accel = (s: GameState, id: InstanceId): number => inst(s, id).counters.acceleration ?? 0;
const inEncounterDeck = (s: GameState, id: InstanceId): boolean => activeEncounterDeck(s).deck.includes(id);

/** Core Spider-Man (and Captain Marvel with `players: 2`) against Rhino, with the Tracksuit Mafia set added to the encounter deck. */
function newGame(players = 1, form: "hero" | "alterEgo" = "alterEgo"): GameState {
  const seats = [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }];
  const base = coreScenario("rhino", {
    players: seats.slice(0, players),
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: PLAYABLE_CARDS,
  } as never);
  const created = createGame(
    { ...base, encounterDeck: [...base.encounterDeck, ...encounterCardsOf(["tracksuit_mafia"], PLAYABLE_CARDS)] },
    WAVE11_DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  let s = settle(created.state, firstLegal, (st) => st.step.phase === "player", WAVE11_DEPS);
  for (let n = 0; n < players; n++) {
    s = withForm(s, form === "hero" ? { heroForm: 0 } : "alterEgo", n === 0 ? P1 : P2);
  }
  return s;
}

const declines: Picker = (s) => (s.pendingChoice!.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s));
/** Drives P1's end of turn (and P2's with two players) answering prompts with `pick`, recording the chooseCards prompts. */
function villainPhase(s: GameState, pick: Picker = declines, players = 1) {
  const prompts: { player: PlayerId; offered: string[] }[] = [];
  const picker: Picker = (st) => {
    const choice = st.pendingChoice!;
    if (choice.prompt.kind === "chooseCards")
      prompts.push({ player: choice.playerId, offered: choice.options.map((o) => o.optionId) });
    return pick(st);
  };
  const cmds = players === 1 ? [endTurn(P1)] : [endTurn(P1), endTurn(P2)];
  return { prompts, run: driveEventsPicking(WAVE11_DEPS, s, picker, ...cmds) };
}

describe("registry", () => {
  it("registers every printed ref of the five cards; nothing is skipped", () => {
    const printed = [IVAN, CLOWN, MAFIOSO, BRO, MAFIA].flatMap((c) => abilityRefIds(data(c))).sort();
    expect(printed).toEqual([...REFS].sort());
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS].sort());
    expect(Object.keys(SKIPPED)).toEqual([]);
  });
  it.each([...REFS])("%s validates", (ref) => {
    expect(validateDefinition(REGISTRY[ref]!), ref).toEqual([]);
  });
});

describe("Ivan Banionis 60200", () => {
  it("has Teamwork (Tracksuit) as data", () => {
    expect(data(IVAN).keywords).toContainEqual({ name: "teamwork", sharedTrait: "TRACKSUIT" });
  });

  it("60200.when-revealed: revealed, he enters play engaged with the revealing player with 1 acceleration token", () => {
    const { run } = villainPhase(stack(newGame(), 1, IVAN));
    const ivan = idsOf(run.state, IVAN)[0]!;
    expect(inst(run.state, ivan).engagedWith).toBe(P1);
    expect(accel(run.state, ivan)).toBe(1);
  });

  it("60200.when-revealed: revealed by the second player, the token is on him and he engages them", () => {
    const { run } = villainPhase(stack(newGame(2), 2, ADVANCE, IVAN), declines, 2);
    const ivan = idsOf(run.state, IVAN)[0]!;
    expect(inst(run.state, ivan).engagedWith).toBe(P2);
    expect(accel(run.state, ivan)).toBe(1);
  });

  it("60200.ivan-banionis-forced-response: after he schemes he gets another token; the main scheme gets none", () => {
    const m = engageMinion(newGame(), IVAN);
    const { run } = villainPhase(stack(m.state, 2, ADVANCE));
    expect(ofType(run.events, "schemeResolved").map((e) => e.enemyInstanceId)).toContain(m.id);
    expect(accel(run.state, m.id)).toBe(1);
    expect(run.state.mainScheme.accelerationTokens).toBe(0);
  });

  it("60200.ivan-banionis-forced-response: does not trigger when he attacks", () => {
    const m = engageMinion(newGame(1, "hero"), IVAN);
    const { run } = villainPhase(stack(m.state, 2, ADVANCE));
    expect(
      ofType(run.events, "enemyActivated").filter((e) => e.enemyInstanceId === m.id && e.activation === "attack"),
    ).toHaveLength(1);
    expect(accel(run.state, m.id)).toBe(0);
  });

  it("60200.ivan-banionis-forced-response: another Tracksuit minion's scheme does not trigger it", () => {
    const ivan = engageMinion(newGame(), IVAN);
    const bro = engageMinion(ivan.state, BRO);
    const { run } = villainPhase(stack(bro.state, 3, ADVANCE));
    expect(ofType(run.events, "schemeResolved").map((e) => e.enemyInstanceId)).toContain(bro.id);
    // Ivan schemed too, once: exactly one token, not two.
    expect(accel(run.state, ivan.id)).toBe(1);
  });
});

describe("The Clown 60201", () => {
  it("is villainous with Teamwork (Tracksuit) (data)", () => {
    expect(data(CLOWN).keywords).toContainEqual({ name: "villainous" });
    expect(data(CLOWN).keywords).toContainEqual({ name: "teamwork", sharedTrait: "TRACKSUIT" });
  });

  it("60201.the-clown-forced-response: after he schemes he is given 1 facedown boost card", () => {
    const m = engageMinion(newGame(), CLOWN);
    // Rhino's boost, the Clown's own scheme boost, then the card that becomes his facedown boost card.
    const { run } = villainPhase(stack(m.state, 2, SANDMAN, ADVANCE));
    expect(ofType(run.events, "schemeResolved").map((e) => e.enemyInstanceId)).toContain(m.id);
    const boosts = inst(run.state, m.id).boostCards;
    expect(boosts).toHaveLength(1);
    expect(codeOf(run.state, boosts[0]!)).toBe(SANDMAN);
    expect(inst(run.state, boosts[0]!).faceup).toBe(false);
  });

  it("60201.the-clown-forced-response: does not trigger when he attacks", () => {
    const m = engageMinion(newGame(1, "hero"), CLOWN);
    const { run } = villainPhase(stack(m.state, 2, SANDMAN, ADVANCE));
    expect(
      ofType(run.events, "enemyActivated").filter((e) => e.enemyInstanceId === m.id && e.activation === "attack"),
    ).toHaveLength(1);
    expect(inst(run.state, m.id).boostCards).toEqual([]);
  });
});

describe("Tracksuit Mafioso 60202 and Tracksuit Bro 60203", () => {
  it("have Teamwork (Tracksuit) and Vulnerable as data; the Mafioso has Retaliate 2", () => {
    for (const code of [MAFIOSO, BRO]) {
      expect(data(code).keywords).toContainEqual({ name: "teamwork", sharedTrait: "TRACKSUIT" });
      expect(data(code).keywords).toContainEqual({ name: "vulnerable" });
    }
    expect(data(MAFIOSO).keywords).toContainEqual({ name: "retaliate", value: 2 });
  });

  /** `code` engaged with `player`, one hit point left, and the Tracksuit Mafia side scheme in play (or not). */
  function dying(
    code: string,
    withMafia: boolean,
    players = 1,
    player: PlayerId = P1,
    patch: Partial<ReturnType<typeof inst>> = {},
  ) {
    const hp = data(code).hp as number;
    const m = engageMinion(newGame(players, "hero"), code, player);
    const damaged = {
      ...m.state,
      instances: { ...m.state.instances, [m.id]: { ...inst(m.state, m.id), damage: hp - 1, ...patch } },
    };
    const mafia = withMafia ? encounterCardInVillainArea(damaged, MAFIA, 3) : null;
    const state = mafia?.state ?? damaged;
    // The second player acts in their own turn, after the first player ends theirs.
    const turns = player === P1 ? [] : [endTurn(P1)];
    const run = driveEventsPicking(WAVE11_DEPS, state, declines, ...turns, {
      type: "basicAttack",
      playerId: player,
      attackerInstanceId: identityOf(state, player),
      targetInstanceId: m.id,
    });
    return { run, id: m.id, mafia: mafia?.id };
  }

  it("60202.when-defeated: with the side scheme in play, he is tucked under it, not discarded, and nothing is stunned", () => {
    const { run, id, mafia } = dying(MAFIOSO, true);
    expect(inst(run.state, mafia!).tucked).toEqual([id]);
    expect(activeEncounterDeck(run.state).discard).not.toContain(id);
    expect(playerOf(run.state, P1).playArea).not.toContain(id);
    expect(statuses(run.state, identityOf(run.state)).stunned).toBe(0);
    expect(statuses(run.state, identityOf(run.state)).confused).toBe(0);
  });

  it("60202.when-defeated: otherwise, the character that defeated him is stunned and confused; he is discarded", () => {
    const { run, id } = dying(MAFIOSO, false);
    expect(statuses(run.state, identityOf(run.state)).stunned).toBe(1);
    expect(statuses(run.state, identityOf(run.state)).confused).toBe(1);
    expect(activeEncounterDeck(run.state).discard).toContain(id);
  });

  it("60202.when-defeated: otherwise, only the second player's identity that defeated him is stunned and confused", () => {
    const { run } = dying(MAFIOSO, false, 2, P2);
    expect(statuses(run.state, identityOf(run.state, P2)).stunned).toBe(1);
    expect(statuses(run.state, identityOf(run.state, P2)).confused).toBe(1);
    expect(statuses(run.state, identityOf(run.state, P1)).stunned).toBe(0);
    expect(statuses(run.state, identityOf(run.state, P1)).confused).toBe(0);
  });

  it("60203.when-defeated: with the side scheme in play, he is tucked under it, not discarded or shuffled", () => {
    const { run, id, mafia } = dying(BRO, true);
    expect(inst(run.state, mafia!).tucked).toEqual([id]);
    expect(activeEncounterDeck(run.state).discard).not.toContain(id);
    expect(inEncounterDeck(run.state, id)).toBe(false);
  });

  it("60203.when-defeated: otherwise, he is shuffled into the encounter deck instead of its discard pile", () => {
    const { run, id } = dying(BRO, false);
    expect(inEncounterDeck(run.state, id)).toBe(true);
    expect(activeEncounterDeck(run.state).discard).not.toContain(id);
    expect(ofType(run.events, "deckShuffled").length).toBeGreaterThan(0);
    expect(statuses(run.state, identityOf(run.state)).stunned).toBe(0);
  });
});

describe("Tracksuit Mafia 60204", () => {
  it("has 3 threat per hero (data)", () => {
    expect(data(MAFIA).startingThreat).toEqual({ base: 0, perPlayer: 3 });
  });

  it("60204.when-revealed: discards until a Tracksuit minion is discarded and tucks that minion here", () => {
    // SANDMAN is not Tracksuit: discarded and passed over. BRO is the first Tracksuit minion; IVAN stays on the deck.
    const { run } = villainPhase(stack(newGame(), 1, MAFIA, SANDMAN, BRO, IVAN));
    const mafia = idsOf(run.state, MAFIA)[0]!;
    const tucked = inst(run.state, mafia).tucked;
    expect(tucked).toHaveLength(1);
    const bro = tucked[0]!;
    expect(codeOf(run.state, bro)).toBe(BRO);
    expect(playerOf(run.state, P1).playArea).not.toContain(bro);
    expect(activeEncounterDeck(run.state).discard).toContain(idsOf(run.state, SANDMAN)[0]);
    expect(activeEncounterDeck(run.state).discard).not.toContain(bro);
    expect(inEncounterDeck(run.state, idsOf(run.state, IVAN)[0]!)).toBe(true);
    // The tucked minion was discarded, not revealed: nothing came into play from it.
    expect(ofType(run.events, "encounterCardRevealed").some((e) => e.instanceId === bro)).toBe(false);
  });

  it("60204.tracksuit-mafia-forced-response: a Tracksuit minion revealed from the deck reveals 1 tucked minion, engaging that player", () => {
    const first = villainPhase(stack(newGame(), 1, MAFIA, BRO));
    const mafia = idsOf(first.run.state, MAFIA)[0]!;
    const [tucked] = inst(first.run.state, mafia).tucked;
    expect(tucked).toBeDefined();
    const { run } = villainPhase(stack(first.run.state, 1, IVAN));
    const ivan = idsOf(run.state, IVAN)[0]!;
    expect(inst(run.state, ivan).engagedWith).toBe(P1);
    expect(inst(run.state, mafia).tucked).toEqual([]);
    expect(inst(run.state, tucked!).engagedWith).toBe(P1);
    expect(playerOf(run.state, P1).playArea).toContain(tucked);
  });

  it("60204.tracksuit-mafia-forced-response: a non-Tracksuit reveal leaves the tucked minion where it is", () => {
    const first = villainPhase(stack(newGame(), 1, MAFIA, BRO));
    const mafia = idsOf(first.run.state, MAFIA)[0]!;
    const { run } = villainPhase(stack(first.run.state, 1, SANDMAN));
    expect(inst(run.state, mafia).tucked).toHaveLength(1);
  });

  it("60204.tracksuit-mafia-forced-response: the revealing player, not the first player, reveals it and is engaged with it", () => {
    // P1 reveals the scheme (tucking Mafioso); P2 reveals Ivan and so reveals the tucked Mafioso against P2.
    const { run } = villainPhase(stack(newGame(2), 2, MAFIA, MAFIOSO, IVAN), declines, 2);
    const mafia = idsOf(run.state, MAFIA)[0]!;
    const mafioso = idsOf(run.state, MAFIOSO)[0]!;
    const ivan = idsOf(run.state, IVAN)[0]!;
    expect(inst(run.state, ivan).engagedWith).toBe(P2);
    expect(inst(run.state, mafia).tucked).toEqual([]);
    expect(inst(run.state, mafioso).engagedWith).toBe(P2);
    expect(playerOf(run.state, P2).playArea).toContain(mafioso);
    expect(playerOf(run.state, P1).playArea).not.toContain(mafioso);
  });
});

const HIT = (player: PlayerId, attacker: InstanceId, target: InstanceId) =>
  ({ type: "basicAttack", playerId: player, attackerInstanceId: attacker, targetInstanceId: target }) as const;

describe("who defeated the Mafioso (RRG 1.8 'You, Your', p. 49)", () => {
  const BLACK_CAT = "01002";
  const KICK = "01005"; // Swinging Web Kick: Hero Action (attack), Deal 8 damage to an enemy.

  it("60202.when-defeated: an ally that defeats him is the character stunned and confused, not the identity", () => {
    const cat = inPlayFromDeck(newGame(1, "hero"), P1, BLACK_CAT);
    const m = engageMinion(cat.state, MAFIOSO);
    const damaged = {
      ...m.state,
      instances: { ...m.state.instances, [m.id]: { ...inst(m.state, m.id), damage: 6 } },
    };
    const run = driveEventsPicking(WAVE11_DEPS, damaged, declines, HIT(P1, cat.id, m.id));
    expect(activeEncounterDeck(run.state).discard).toContain(m.id);
    expect(statuses(run.state, cat.id).stunned).toBe(1);
    expect(statuses(run.state, cat.id).confused).toBe(1);
    expect(statuses(run.state, identityOf(run.state)).stunned).toBe(0);
    expect(statuses(run.state, identityOf(run.state)).confused).toBe(0);
  });

  it("60202.when-defeated: an event card that defeats him means the identity did: it is stunned and confused", () => {
    const m = engageMinion(newGame(1, "hero"), MAFIOSO);
    const given = moveToHand(m.state, P1, KICK);
    const kick = given.ids[0]!;
    const paid = runWith(WAVE11_DEPS, given.state, play(P1, kick, payWith(given.state, P1, 3, [kick])));
    // Rhino is an enemy too: the Mafioso is picked by id.
    expect(paid.pendingChoice!.options.map((o) => o.optionId)).toContain(m.id);
    const after = settle(answer(paid, [m.id], WAVE11_DEPS), firstLegal, undefined, WAVE11_DEPS);
    expect(activeEncounterDeck(after).discard).toContain(m.id);
    expect(statuses(after, identityOf(after)).stunned).toBe(1);
    expect(statuses(after, identityOf(after)).confused).toBe(1);
  });
});

describe("acceleration tokens on Ivan (RRG 1.8 'Acceleration Token', p. 5)", () => {
  /** The main scheme's threat after one villain phase, with Ivan holding `tokens`. */
  function threatAfter(tokens: number): number {
    const m = engageMinion(newGame(), IVAN);
    const held = {
      ...m.state,
      instances: { ...m.state.instances, [m.id]: { ...inst(m.state, m.id), counters: { acceleration: tokens } } },
    };
    const { run } = villainPhase(stack(held, 2, ADVANCE));
    return inst(run.state, run.state.mainScheme.instanceId).threat;
  }

  it("60200.when-revealed: a token on him adds 1 threat to the main scheme in step one of the villain phase", () => {
    expect(threatAfter(1) - threatAfter(0)).toBe(1);
    expect(threatAfter(3) - threatAfter(0)).toBe(3);
  });

  it("60200.ivan-banionis-forced-response: defeating him takes his tokens with him", () => {
    const m = engageMinion(newGame(1, "hero"), IVAN);
    const hurt = {
      ...m.state,
      instances: {
        ...m.state.instances,
        [m.id]: { ...inst(m.state, m.id), damage: 4, counters: { acceleration: 2 } },
      },
    };
    const run = driveEventsPicking(WAVE11_DEPS, hurt, declines, HIT(P1, identityOf(hurt), m.id));
    expect(activeEncounterDeck(run.state).discard).toContain(m.id);
    expect(inst(run.state, m.id).counters.acceleration ?? 0).toBe(0);
  });
});

describe("The Clown's held boost card (RRG 1.8 'Boost', p. 11)", () => {
  /** Round 1: the Clown schemes and is given Sandman as a facedown boost card. */
  function holding() {
    const m = engageMinion(newGame(), CLOWN);
    const { run } = villainPhase(stack(m.state, 2, SANDMAN, ADVANCE));
    const held = inst(run.state, m.id).boostCards[0]!;
    expect(codeOf(run.state, held)).toBe(SANDMAN);
    return { state: run.state, clown: m.id, held };
  }

  it("60201.the-clown-forced-response: his next activation flips the held card and the villainous one", () => {
    const { state, clown, held } = holding();
    const { run } = villainPhase(stackEncounterDeck(withForm(state, { heroForm: 0 }), "01104", "01104", "01105"));
    const flipped = ofType(run.events, "boostCardFlipped").filter((e) => e.enemyInstanceId === clown);
    expect(flipped.map((e) => e.instanceId)).toContain(held);
    expect(flipped).toHaveLength(2);
    expect(activeEncounterDeck(run.state).discard).toContain(held);
  });

  it("60201.the-clown-forced-response: if he is defeated holding it, the card is discarded", () => {
    const { state, clown, held } = holding();
    const hero = withForm(state, { heroForm: 0 });
    const hurt = { ...hero, instances: { ...hero.instances, [clown]: { ...inst(hero, clown), damage: 5 } } };
    const run = driveEventsPicking(WAVE11_DEPS, hurt, declines, HIT(P1, identityOf(hurt), clown));
    expect(playerOf(run.state, P1).playArea).not.toContain(clown);
    expect(activeEncounterDeck(run.state).discard).toContain(held);
  });
});

describe("two minions tucked under Tracksuit Mafia", () => {
  it("60204.tracksuit-mafia-forced-response: one Tracksuit reveal reveals exactly one tucked minion; it does not re-trigger", () => {
    const mafia = encounterCardInVillainArea(newGame(), MAFIA, 3);
    const bro = idsOf(mafia.state, BRO)[0]!;
    const mafioso = idsOf(mafia.state, MAFIOSO)[0]!;
    const piles = activeEncounterDeck(mafia.state);
    const key = Object.keys(mafia.state.encounterDecks).find((k) => mafia.state.encounterDecks[k]!.deck.includes(bro))!;
    const tucked = {
      ...mafia.state,
      encounterDecks: {
        ...mafia.state.encounterDecks,
        [key]: { deck: piles.deck.filter((i) => i !== bro && i !== mafioso), discard: piles.discard },
      },
      instances: {
        ...mafia.state.instances,
        [bro]: { ...inst(mafia.state, bro), faceup: true },
        [mafioso]: { ...inst(mafia.state, mafioso), faceup: true },
        [mafia.id]: { ...inst(mafia.state, mafia.id), tucked: [bro, mafioso] },
      },
    };
    const { run, prompts } = villainPhase(stack(tucked, 1, IVAN), (st) =>
      st.pendingChoice!.prompt.kind === "chooseCards" ? [mafioso] : declines(st),
    );
    expect(prompts).toHaveLength(1);
    expect(prompts[0]!.player).toBe(P1);
    expect([...prompts[0]!.offered].sort()).toEqual([bro, mafioso].sort());
    expect(inst(run.state, mafia.id).tucked).toEqual([bro]);
    expect(inst(run.state, mafioso).engagedWith).toBe(P1);
    expect(inst(run.state, bro).engagedWith ?? null).toBeNull();
  });
});
