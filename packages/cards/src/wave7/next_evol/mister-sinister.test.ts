import { trait } from "@mc/content";
import {
  activeVillain,
  applyCommand,
  createGame,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { constant, gainsTrait, leavingPlayLoses, query, rule } from "../../dsl/index.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  settle,
  stackEncounterDeck,
} from "../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, withForm } from "../../testing/staging.js";
import { engageMinion, handWith } from "../../wave6/mut_gen/project-wideawake-testing.js";
import { WAVE7_ABILITIES, wave7Scenario } from "../index.js";
import { MISTER_SINISTER } from "./mister-sinister.js";

vi.setConfig({ testTimeout: 120_000 });

const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const CAPTAIN_MARVEL = { starterDeckId: "core-captain-marvel-leadership" } as const;
const ONE = [SPIDER_MAN] as const;
const TWO = [SPIDER_MAN, CAPTAIN_MARVEL] as const;
type Seats = readonly (typeof SPIDER_MAN | typeof CAPTAIN_MARVEL)[];

/**
 * The traits the three SUPERPOWER attachments grant (Flight, Super Strength, Telepathy are other modules, still empty
 * at the time of writing): restated here as test doubles so the set's treacheries can read them.
 */
const ATTACHED_VILLAIN = query("villain", { hostOfSelf: true });
const GRANT_TRAITS = {
  "40151.flight-constant": constant(gainsTrait(trait("AERIAL"), ATTACHED_VILLAIN)),
  "40155.super-strength-constant": constant(gainsTrait(trait("BRUTE"), ATTACHED_VILLAIN)),
  "40159.telepathy-constant": constant(gainsTrait(trait("PSIONIC"), ATTACHED_VILLAIN)),
};
/** Hope Summers (40130) is another module's card: her control and her loss, restated as the test double Sinister Ends needs. */
const HOPE = {
  "40130.hope-summers-constant": constant(
    rule({ kind: "controlledByFirstPlayer", target: { self: true } }),
    leavingPlayLoses({ self: true }),
  ),
};
const DEPS: EngineDeps = { abilities: { ...WAVE7_ABILITIES, ...GRANT_TRAITS, ...HOPE } };

/** Standard-set boost cards that print no boost icon and no Boost ability. */
const BLANK_BOOSTS = ["01186", "01187", "01186", "01187", "01186", "01187"] as const;

type StageName = "Taking Off" | "Bulking Up" | "Focusing In";
/** Each stage 2B's attachment and encounter set (docs/phase7-wave7.md §2.7). */
const STAGE_SET = {
  "Taking Off": { attachment: "Flight", set: "flight", code: "40151" },
  "Bulking Up": { attachment: "Super Strength", set: "super_strength", code: "40155" },
  "Focusing In": { attachment: "Telepathy", set: "telepathy", code: "40159" },
} as const;

interface Opts {
  readonly players?: Seats;
  readonly expert?: boolean;
  /** The stage 2 that comes up first: the first seed that draws it. */
  readonly first?: StageName;
  readonly seed?: number;
}

const found = new Map<string, number>();
/** Mister Sinister past setup. */
function game(opts: Opts = {}): GameState {
  const key = `${opts.expert ?? false}/${opts.first ?? ""}`;
  const tries = opts.seed
    ? [opts.seed]
    : found.has(key)
      ? [found.get(key)!]
      : Array.from({ length: 99 }, (_, i) => i + 1);
  for (const seed of tries) {
    const config = wave7Scenario("mister-sinister", {
      players: opts.players ?? ONE,
      seed,
      difficulty: opts.expert ? "expert" : "standard",
    });
    const created = createGame(config, DEPS);
    if (!created.ok) throw new Error(created.error.message);
    const state = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
    if (opts.first && stageName(state) !== opts.first) continue;
    found.set(key, seed);
    return state;
  }
  throw new Error(`no seed starts Mister Sinister at ${opts.first}`);
}

const nameOf = (s: GameState, id: InstanceId) => s.cardPool[s.instances[id]!.cardId]!.name;
const cardOf = (s: GameState, id: InstanceId) => s.instances[id]!.cardId as string;
const mainOf = (s: GameState) => s.mainScheme.instanceId;
const villainId = (s: GameState) => activeVillain(s).instanceId;
const piles = (s: GameState) => Object.values(s.encounterDecks)[0]!;
const threat = (s: GameState, id: InstanceId) => inst(s, id).threat;
const stageName = (s: GameState): string | undefined => {
  const card = s.cardPool[s.instances[mainOf(s)]!.cardId] as { stages: readonly { name?: string }[] };
  return card.stages[s.mainScheme.stageIndex]?.name;
};
const attachmentNames = (s: GameState) => inst(s, villainId(s)).attachments.map((id) => nameOf(s, id));
const inSet = (s: GameState, id: InstanceId, set: string) =>
  ((s.cardPool[s.instances[id]!.cardId] as { encounterSetIds?: readonly string[] }).encounterSetIds ?? []).includes(
    set,
  );
const events = <T extends GameEvent["type"]>(run: readonly GameEvent[], type: T) =>
  run.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
/** Threat the card placed on the main scheme, from the log. */
const placedBy = (log: readonly GameEvent[], source: InstanceId) =>
  events(log, "threatPlaced")
    .filter((e) => e.sourceInstanceId === source)
    .reduce((n, e) => n + e.amount, 0);

interface Plan {
  readonly choose?: string;
  readonly pick?: readonly string[];
  readonly defender?: InstanceId;
}
interface Run {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  readonly prompts: readonly { readonly kind: string; readonly player: PlayerId; readonly labels: readonly string[] }[];
}
function drive(state: GameState, plan: Plan, ...commands: Parameters<typeof driveEventsPicking>[3][]): Run {
  const prompts: { kind: string; player: PlayerId; labels: readonly string[] }[] = [];
  const picks = [...(plan.pick ?? [])];
  const pick = (s: GameState): readonly string[] => {
    const choice = s.pendingChoice!;
    prompts.push({ kind: choice.prompt.kind, player: choice.playerId, labels: choice.options.map((o) => o.label) });
    switch (choice.prompt.kind) {
      case "chooseOption": {
        const hit = choice.options.find((o) => (plan.choose ? o.label.startsWith(plan.choose) : true));
        return [(hit ?? choice.options[0]!).optionId];
      }
      case "declareDefender":
        return [plan.defender && choice.options.some((o) => o.optionId === plan.defender) ? plan.defender : "decline"];
      case "chooseTriggers":
        return [];
      default: {
        const name = picks[0];
        const hit = name ? choice.options.find((o) => o.label === name) : undefined;
        if (hit) {
          picks.shift();
          return [hit.optionId];
        }
        return firstLegal(s);
      }
    }
  };
  const { state: after, events: log } = driveEventsPicking(DEPS, state, pick, ...commands);
  return { state: after, events: log, prompts };
}
/** Every player ends their turn (in hero form unless `alterEgo`); blank boost cards first, then `reveals` for the deal. */
function round(
  state: GameState,
  opts: { boosts?: number; reveals?: readonly string[]; alterEgo?: boolean; plan?: Plan } = {},
): Run {
  const stacked = stackEncounterDeck(
    state,
    ...BLANK_BOOSTS.slice(0, opts.boosts ?? state.players.length),
    ...(opts.reveals ?? []),
  );
  const order =
    state.step.phase === "player" && state.step.kind === "turn"
      ? [state.step.activePlayerId, ...state.step.remainingPlayerIds]
      : state.players.map((p) => p.playerId);
  const formed = state.players.reduce(
    (s, p) => withForm(s, opts.alterEgo ? "alterEgo" : { heroForm: 0 }, p.playerId),
    stacked,
  );
  return drive(formed, opts.plan ?? {}, ...order.map((id) => endTurn(id)));
}

/** Cards of an encounter set wherever they are: [in the encounter deck, set aside, attached to the villain]. */
const setCounts = (s: GameState, set: string) => {
  const attached = attachmentNames(s).length === 0 ? [] : inst(s, villainId(s)).attachments;
  return {
    deck: piles(s).deck.filter((id) => inSet(s, id, set)).length,
    discard: piles(s).discard.filter((id) => inSet(s, id, set)).length,
    aside: s.encounterSetAside.filter((id) => inSet(s, id, set)).length,
    attached: attached.filter((id) => inSet(s, id, set)).length,
  };
};
/** Every card of the three sets, by set: Flight 5 (High Ground twice), Super Strength 5, Telepathy 5 (an obligation twice). */
const SET_SIZE = { flight: 5, super_strength: 5, telepathy: 5 } as const;

/** Surgery: the villain's attachments become exactly these printed ids (from the set-aside area, the deck or the discard pile). */
function withAttachments(state: GameState, ...codes: readonly string[]): GameState {
  const villain = villainId(state);
  const dropped = inst(state, villain).attachments;
  let s: GameState = {
    ...state,
    encounterSetAside: [...state.encounterSetAside, ...dropped],
    instances: {
      ...state.instances,
      [villain]: { ...inst(state, villain), attachments: [] },
      ...Object.fromEntries(dropped.map((id) => [id, { ...inst(state, id), attachedTo: null }])),
    },
  };
  for (const code of codes) s = withAttachment(s, code);
  return s;
}
/** Surgery: one more card (by printed id) attached faceup to the villain, from the set-aside area, the deck or the discard pile. */
function withAttachment(state: GameState, code: string): GameState {
  const villain = villainId(state);
  let s = state;
  {
    const id = [...s.encounterSetAside, ...piles(s).deck, ...piles(s).discard].find((i) => cardOf(s, i) === code)!;
    const deckId = Object.keys(s.encounterDecks)[0]!;
    const pile = piles(s);
    s = {
      ...s,
      encounterSetAside: s.encounterSetAside.filter((i) => i !== id),
      encounterDecks: {
        ...s.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      },
      instances: {
        ...s.instances,
        [id]: { ...inst(s, id), faceup: true, attachedTo: villain },
        [villain]: { ...inst(s, villain), attachments: [...inst(s, villain).attachments, id] },
      },
    };
  }
  return s;
}

describe("registry", () => {
  it("registers every ref of the set", () => {
    expect(Object.keys(MISTER_SINISTER).sort()).toEqual(
      [
        "40136.mister-sinister-forced-response",
        "40137.when-revealed",
        "40137.mister-sinister-forced-response",
        "40138.when-revealed",
        "40138.mister-sinister-forced-response",
        "40139a.setup",
        "40139b.when-revealed",
        "40140b.when-revealed",
        "40140b.when-completed",
        "40141b.when-revealed",
        "40141b.when-completed",
        "40142b.when-revealed",
        "40142b.when-completed",
        "40143a.when-revealed",
        "40143b.sinister-ends-forced-interrupt",
        "40144.sinister-disguise-forced-interrupt",
        "40145.sinister-soldier-constant",
        "40145.boost",
        "40146.teleported-away-constant",
        "40146.teleported-away-forced-interrupt",
        "40147.when-revealed",
        "40148.when-revealed",
        "40148.boost",
        "40149.when-revealed",
        "40149.boost",
        "40150.when-revealed-alter-ego",
        "40150.when-revealed-hero",
        "40150.boost",
      ].sort(),
    );
  });
});

describe("Sinister Intent 1A and 1B (40139a setup, 40139b.when-revealed)", () => {
  it("standard, 1 player: stage 1 villain, one random stage 2 removed, the other two in a random order, stage 3 last", () => {
    const firsts = new Set<string | undefined>();
    const removed = new Set<number>();
    for (let seed = 1; seed <= 24; seed++) {
      const s = game({ seed });
      const order = s.mainScheme.stageOrder!;
      const spent = (s as unknown as { spentMainSchemeStages: readonly number[] }).spentMainSchemeStages;
      expect(order, `seed ${seed}`).toHaveLength(4);
      expect([order[0], order[3]], `seed ${seed}`).toEqual([0, 4]);
      expect(spent, `seed ${seed}`).toHaveLength(1);
      expect([...order.slice(1, 3), ...spent].sort(), `seed ${seed}`).toEqual([1, 2, 3]);
      // The shown stage 2 is the first of the order; the villain is stage I; threat is the stage's 1 per player.
      expect(s.mainScheme.stageIndex).toBe(order[1]);
      expect(activeVillain(s).stageIndex).toBe(0);
      expect(threat(s, mainOf(s))).toBe(1);
      expect(s.outcome).toBeNull();
      firsts.add(stageName(s));
      removed.add(spent[0]!);
    }
    expect(firsts).toEqual(new Set(["Taking Off", "Bulking Up", "Focusing In"]));
    expect(removed).toEqual(new Set([1, 2, 3]));
  });

  it.each(Object.entries(STAGE_SET) as [StageName, (typeof STAGE_SET)[StageName]][])(
    "%s (stage 2B When Revealed): attaches %s to Mister Sinister and shuffles the rest of the set into the encounter deck",
    (name, { attachment, set }) => {
      const s = game({ first: name });
      expect(stageName(s)).toBe(name);
      expect(attachmentNames(s)).toEqual([attachment]);
      expect(inst(s, inst(s, villainId(s)).attachments[0]!).faceup).toBe(true);
      expect(setCounts(s, set)).toEqual({ deck: SET_SIZE[set] - 1, discard: 0, aside: 0, attached: 1 });
      // The other two sets are untouched, whole, in the set-aside area.
      for (const other of Object.keys(SET_SIZE).filter((o) => o !== set) as (keyof typeof SET_SIZE)[])
        expect(setCounts(s, other), other).toEqual({ deck: 0, discard: 0, aside: SET_SIZE[other], attached: 0 });
    },
  );

  it("the villain card itself only gets the attachment: no other card attached, nothing revealed from the set", () => {
    const s = game({ first: "Bulking Up" });
    expect(inst(s, villainId(s)).attachments).toHaveLength(1);
    expect(s.removedFromGame).toEqual([]);
  });

  it("Hope Summers is in play, put there by her setup keyword (1A's second sentence)", () => {
    const s = game();
    const hope = s.players[0]!.playArea.find((id) => nameOf(s, id) === "Hope Summers");
    expect(hope).toBeDefined();
    expect(piles(s).deck.map((id) => nameOf(s, id))).not.toContain("Hope Summers");
  });

  it("2 players: the stage 2 starts with 1 threat per player; one stage 2 is removed all the same", () => {
    const s = game({ players: TWO });
    expect(threat(s, mainOf(s))).toBe(2);
    expect(s.mainScheme.stageOrder).toHaveLength(4);
    expect(attachmentNames(s)).toHaveLength(1);
  });

  it("expert: starts on Mister Sinister II, and 1B resolves before his When Revealed, so he counts one attachment (2[per_hero] threat)", () => {
    const s = game({ expert: true });
    expect(activeVillain(s).stageIndex).toBe(1);
    expect(attachmentNames(s)).toHaveLength(1);
    // 1 per player starting threat on the stage 2, plus 2 per player because he has fewer than 2 attachments.
    expect(threat(s, mainOf(s))).toBe(3);
    const two = game({ expert: true, players: TWO });
    expect(threat(two, mainOf(two))).toBe(6);
  });
});

/** The heroes' round in hero form with the main scheme at its target: the villain phase's acceleration completes the stage. */
const complete = (s: GameState): Run => round(patchInstance(s, mainOf(s), { threat: 5 * s.players.length }));
const advances = (log: readonly GameEvent[]) => events(log, "mainSchemeAdvanced").map((e) => e.stageIndex);

describe("stage 2B When Completed: the other stage 2A, then stage 3A (40140b-40142b.when-completed)", () => {
  it("completing the first stage 2 advances to the other stage 2A, which attaches its own set; the third set stays aside", () => {
    const s = game({ first: "Taking Off" });
    const [, , second] = s.mainScheme.stageOrder!;
    const run = complete(s);
    expect(advances(run.events)[0]).toBe(second);
    // The default walk advanced once: not to stage 3 and not twice.
    expect(advances(run.events)).toHaveLength(1);
    expect(run.state.mainScheme.stageIndex).toBe(second);
    const other = stageName(run.state) as StageName;
    expect(other).not.toBe("Taking Off");
    expect(attachmentNames(run.state).sort()).toEqual(["Flight", STAGE_SET[other].attachment].sort());
    const third = (Object.keys(STAGE_SET) as StageName[]).find((n) => n !== "Taking Off" && n !== other)!;
    expect(setCounts(run.state, STAGE_SET[third].set).aside).toBe(SET_SIZE[STAGE_SET[third].set]);
    expect(run.state.outcome).toBeNull();
  });

  it("completing the second stage 2 advances to stage 3A (Sinister Ends); no third attachment", () => {
    const s = game({ first: "Bulking Up" });
    const first = complete(s);
    expect(advances(first.events)).toHaveLength(1);
    const second = complete(first.state);
    expect(advances(second.events)[0]).toBe(4);
    expect(stageName(second.state)).toBe("Sinister Ends");
    expect(attachmentNames(second.state)).toHaveLength(2);
    // A 2 [per_hero] threat stage 3 is reached with none of the 7[per_hero] it needs.
    expect(events(second.events, "mainSchemeCompleted").map((e) => e.stageIndex)).toContain(
      first.state.mainScheme.stageIndex,
    );
  });
});

/** The revealed card's instance, by printed id. */
const revealed = (log: readonly GameEvent[], code: string): InstanceId =>
  events(log, "encounterCardRevealed").find((e) => e.cardId === code)!.instanceId;
const hopeOf = (s: GameState) => s.players.flatMap((p) => p.playArea).find((id) => nameOf(s, id) === "Hope Summers")!;
/** Surgery: Mister Sinister's stage (0 = I, 1 = II, 2 = III). */
const atVillainStage = (s: GameState, stageIndex: number): GameState => ({
  ...s,
  villains: s.villains.map((v) => (v.instanceId === villainId(s) ? { ...v, stageIndex } : v)),
});
/** Surgery: the main scheme on stage 3A/3B (Sinister Ends), with no threat on it. */
const atSinisterEnds = (s: GameState): GameState => ({
  ...s,
  mainScheme: { ...s.mainScheme, stageIndex: 4 },
  instances: { ...s.instances, [mainOf(s)]: { ...inst(s, mainOf(s)), threat: 0 } },
});
const FLIGHT = "40151";
const SUPER_STRENGTH = "40155";
const TELEPATHY = "40159";
const FILLER = "40145"; // Sinister Soldier: a harmless card to be dealt after the one under test

/** Surgery: no threat on the main scheme, so the villain phase's acceleration completes nothing (it would reshuffle the stacked deck). */
const calm = (s: GameState): GameState => patchInstance(s, mainOf(s), { threat: 0 });

describe("Mister Sinister I-III Forced Response: after a status card is placed on him, place 1 / 2 / 3 threat on the main scheme", () => {
  const molecular = (s: GameState, opts: { boost?: boolean; players?: number } = {}) =>
    opts.boost ? round(s, { boosts: 0, reveals: ["40148", FILLER] }) : round(s, { reveals: ["40148"] });

  it.each([
    [0, 1, "I (40136), standard"],
    [1, 2, "II (40137), expert"],
    [2, 3, "III (40138), expert"],
  ])(
    "stage index %i places %i threat for a tough status card from Molecular Control's When Revealed (%s)",
    (stage, n) => {
      const base = withAttachments(calm(atVillainStage(game({ expert: stage > 0 }), stage)));
      const run = molecular(base);
      expect(inst(run.state, villainId(base)).statuses.tough).toBe(1);
      expect(placedBy(run.events, villainId(base))).toBe(n);
    },
  );

  it("Molecular Control's Boost gives the tough status card too, so the response is heard the same", () => {
    const base = withAttachments(game());
    const run = molecular(base, { boost: true });
    expect(inst(run.state, villainId(base)).statuses.tough).toBe(1);
    expect(placedBy(run.events, villainId(base))).toBe(1);
  });

  it("2 players: one status card is one response (1 threat), not one per player", () => {
    const base = withAttachments(game({ players: TWO }));
    const run = round(base, { reveals: ["40148", FILLER] });
    expect(inst(run.state, villainId(base)).statuses.tough).toBe(1);
    expect(placedBy(run.events, villainId(base))).toBe(1);
  });

  it("a status card he cannot hold (he already has a tough card) places nothing and answers nothing", () => {
    const base = withAttachments(game());
    const toughened = patchInstance(base, villainId(base), {
      statuses: { ...inst(base, villainId(base)).statuses, tough: 1 },
    });
    const run = round(toughened, { reveals: ["40148"] });
    expect(inst(run.state, villainId(base)).statuses.tough).toBe(1);
    expect(placedBy(run.events, villainId(base))).toBe(0);
  });
});

describe("Mister Sinister II and III When Revealed (40137, 40138): per-player threat by SUPERPOWER attachments", () => {
  /** The villain defeated at `stageIndex` so the next stage is revealed with `codes` attached (a basic attack, damage patched in). */
  const advanceVillain = (base: GameState, codes: readonly string[]) => {
    const s = withAttachments(base, ...codes);
    const target = villainId(s);
    const identity = identityOf(s, P1);
    const armed = patchInstance(patchInstance(withForm(s, { heroForm: 0 }, P1), target, { damage: 999 }), identity, {
      exhausted: false,
      damage: 0,
    });
    return drive(
      armed,
      {},
      { type: "basicAttack", playerId: P1, attackerInstanceId: identity, targetInstanceId: target },
    );
  };

  it.each([
    [0, [], 2, "standard I -> II with no attachment: 2 per player"],
    [0, [FLIGHT], 2, "one attachment: 2 per player"],
    [0, [FLIGHT, SUPER_STRENGTH], 1, "two attachments: 1 per player"],
    [0, [FLIGHT, SUPER_STRENGTH, TELEPATHY], 1, "three attachments: 1 per player"],
  ])("II revealed from stage %i with %j: %i threat per player (%s)", (stage, codes, perHero) => {
    const base = game();
    const run = advanceVillain(atVillainStage(base, stage), codes);
    expect(activeVillain(run.state).stageIndex).toBe(1);
    expect(run.state.mainScheme.stageIndex).toBe(base.mainScheme.stageIndex);
    // Placed by the villain card's own When Revealed, and by nothing else here.
    expect(placedBy(run.events, villainId(base))).toBe(perHero);
  });

  it.each([
    [[], 3],
    [[FLIGHT], 3],
    [[FLIGHT, TELEPATHY], 2],
  ])("III revealed with %j: %i threat per player", (codes, perHero) => {
    const base = game({ expert: true });
    const run = advanceVillain(base, codes);
    expect(activeVillain(run.state).stageIndex).toBe(2);
    expect(placedBy(run.events, villainId(base))).toBe(perHero);
  });

  it("2 players scale it: II with two attachments places 1 per player = 2", () => {
    const base = game({ players: TWO });
    const run = advanceVillain(base, [FLIGHT, SUPER_STRENGTH]);
    expect(placedBy(run.events, villainId(base))).toBe(2);
    const fewer = advanceVillain(base, [FLIGHT]);
    expect(placedBy(fewer.events, villainId(base))).toBe(4);
  });
});

describe("Sinister Ends 3A and 3B (40143a, 40143b)", () => {
  it("3A When Revealed: each player is dealt 1 facedown encounter card (1 player, then 2)", () => {
    for (const players of [ONE, TWO] as const) {
      const base = game({ players });
      const first = complete(base);
      const second = complete(first.state);
      expect(stageName(second.state)).toBe("Sinister Ends");
      const dealt = events(second.events, "cardMoved").filter((e) => e.to.kind === "dealtEncounter");
      // One card per player, from 3A (the deal step reveals its own cards without that zone).
      expect(dealt).toHaveLength(players.length);
    }
  });

  it("3B: when Mister Sinister attacks, he attacks Hope Summers instead (1 player)", () => {
    const base = atSinisterEnds(withAttachments(game()));
    const run = round(base, { reveals: [FILLER] });
    const hope = hopeOf(base);
    expect(events(run.events, "attackRetargeted")).toEqual([
      expect.objectContaining({ enemyInstanceId: villainId(base), targetInstanceId: hope, playerId: P1 }),
    ]);
    const attack = events(run.events, "attackResolved").find((e) => e.enemyInstanceId === villainId(base))!;
    expect(attack.targetInstanceId).toBe(hope);
    // ATK 2 printed for stage III? no: the printed ATK of the stage the villain shows, nothing else attached.
    expect(inst(run.state, hope).damage).toBe(attack.damageDealt);
    expect(inst(run.state, identityOf(base, P1)).damage).toBe(0);
  });

  it("3B: other characters may defend the redirected attack (the attacked player's hero here)", () => {
    const base = atSinisterEnds(withAttachments(game()));
    const hero = identityOf(base, P1);
    const run = round(base, { reveals: [FILLER], plan: { defender: hero } });
    expect(events(run.events, "defenderDeclared").map((e) => e.defenderInstanceId)).toEqual([hero]);
    expect(inst(run.state, hopeOf(base)).damage).toBe(0);
  });

  it("3B: with 2 players each of his two activations goes to Hope Summers, whoever it was against (Q16 = A)", () => {
    const base = atSinisterEnds(withAttachments(game({ players: TWO })));
    const run = round(base, { reveals: [FILLER, FILLER] });
    const targets = events(run.events, "attackResolved")
      .filter((e) => e.enemyInstanceId === villainId(base))
      .map((e) => e.targetInstanceId);
    expect(targets).toEqual([hopeOf(base), hopeOf(base)]);
    expect(inst(run.state, identityOf(base, P1)).damage).toBe(0);
    expect(inst(run.state, identityOf(base, P2)).damage).toBe(0);
  });

  it("alter-ego players are schemed against as printed (nothing to redirect)", () => {
    const base = atSinisterEnds(withAttachments(game()));
    const run = round(base, { alterEgo: true, reveals: [FILLER] });
    expect(events(run.events, "attackRetargeted")).toEqual([]);
    expect(events(run.events, "schemeResolved").filter((e) => e.enemyInstanceId === villainId(base))).toHaveLength(1);
  });

  it("completing stage 3 loses the game (7[per_hero] threat)", () => {
    const base = atSinisterEnds(withAttachments(game()));
    const lost = round(patchInstance(base, mainOf(base), { threat: 7 }));
    expect(lost.state.outcome).toMatchObject({ result: "loss", reason: "mainSchemeCompleted" });
  });
});

const SPEND = "Spend [mental][mental] resources";
const REDIRECT = "Do not spend resources";
const attackVillain = (s: GameState, player: PlayerId = P1) =>
  ({
    type: "basicAttack",
    playerId: player,
    attackerInstanceId: identityOf(s, player),
    targetInstanceId: villainId(s),
  }) as const;
const withHand = (s: GameState, player: PlayerId, hand: readonly InstanceId[]): GameState => ({
  ...s,
  players: s.players.map((p) => (p.playerId === player ? { ...p, hand } : p)),
});
const heroForm = (s: GameState, player: PlayerId = P1) => withForm(s, { heroForm: 0 }, player);

describe("Sinister Disguise (40144): 40144.sinister-disguise-forced-interrupt", () => {
  const disguised = (players: Seats = ONE) => withAttachment(withAttachments(game({ players })), "40144");
  const discarded = (s: GameState) => !attachmentNames(s).includes("Sinister Disguise");

  it("spending [mental][mental]: the damage lands on Mister Sinister, and the card is discarded", () => {
    const { state } = handWith(disguised(), P1, "mental", 2);
    const base = heroForm(state);
    const before = inst(base, villainId(base)).damage;
    const run = drive(base, { choose: SPEND }, attackVillain(base));
    expect(run.prompts.find((p) => p.kind === "chooseOption")!.labels).toEqual([
      SPEND,
      expect.stringContaining(REDIRECT),
    ]);
    expect(inst(run.state, villainId(base)).damage).toBeGreaterThan(before);
    expect(inst(run.state, hopeOf(base)).damage).toBe(0);
    expect(discarded(run.state)).toBe(true);
  });

  it("not spending: the damage goes to the friendly character with the fewest remaining hit points (Hope Summers, 3), and the card is discarded all the same", () => {
    const { state } = handWith(disguised(), P1, "mental", 2);
    const base = heroForm(state);
    const run = drive(base, { choose: REDIRECT }, attackVillain(base));
    const dealt = events(run.events, "damageDealt").find((e) => e.targetInstanceId === hopeOf(base))!;
    expect(dealt.amount).toBeGreaterThan(0);
    // Still the player's damage: the hero is the source.
    expect(dealt.sourceInstanceId).toBe(identityOf(base, P1));
    expect(inst(run.state, hopeOf(base)).damage).toBe(dealt.amount);
    expect(inst(run.state, villainId(base)).damage).toBe(0);
    expect(discarded(run.state)).toBe(true);
  });

  it("with no [mental][mental] to spend the spend option is not offered (Q51): the damage is redirected without a question", () => {
    const base = heroForm(withHand(disguised(), P1, []));
    const run = drive(base, {}, attackVillain(base));
    expect(run.prompts.some((p) => p.kind === "chooseOption")).toBe(false);
    expect(inst(run.state, villainId(base)).damage).toBe(0);
    expect(inst(run.state, hopeOf(base)).damage).toBeGreaterThan(0);
    expect(discarded(run.state)).toBe(true);
  });

  it("the lowest is read when the damage is dealt: a hero with fewer remaining hit points than Hope takes it", () => {
    const base = heroForm(withHand(disguised(), P1, []));
    const hero = identityOf(base, P1);
    const hurt = patchInstance(base, hero, { damage: 9 });
    const run = drive(hurt, {}, attackVillain(hurt));
    expect(inst(run.state, hopeOf(base)).damage).toBe(0);
    expect(inst(run.state, hero).damage).toBeGreaterThan(9);
  });

  it("a tie for the fewest remaining hit points is the first player's choice (RRG 1.8 p. 19): Hope and the hero both have 3", () => {
    const base = heroForm(withHand(disguised(), P1, []));
    const hero = identityOf(base, P1);
    const tied = patchInstance(base, hero, { damage: 7 });
    const run = drive(tied, { pick: ["Hope Summers"] }, attackVillain(tied));
    const prompt = run.prompts.find((p) => p.kind === "chooseTarget")!;
    expect(prompt.player).toBe(P1);
    expect(prompt.labels).toHaveLength(2);
    expect(inst(run.state, hopeOf(base)).damage).toBeGreaterThan(0);
    expect(inst(run.state, hero).damage).toBe(7);
  });

  it("2 players: the player who deals the damage decides and pays (the second player's attack)", () => {
    const { state } = handWith(disguised(TWO), P2, "mental", 2);
    const base = heroForm(heroForm(withHand(state, P1, []), P1), P2);
    const run = drive(base, { choose: SPEND }, endTurn(P1), attackVillain(base, P2));
    const prompt = run.prompts.find((p) => p.kind === "chooseOption")!;
    expect(prompt.player).toBe(P2);
    expect(inst(run.state, villainId(base)).damage).toBeGreaterThan(0);
    expect(discarded(run.state)).toBe(true);
  });
});

describe("Sinister Soldier (40145): 40145.sinister-soldier-constant, 40145.boost", () => {
  it.each([
    [[], 1],
    [[FLIGHT], 2],
    [[FLIGHT, SUPER_STRENGTH], 3],
    [[FLIGHT, SUPER_STRENGTH, TELEPATHY], 4],
  ])("with attachments %j his ATK and SCH are both %i (1 printed + 1 per SUPERPOWER attachment)", (codes, expected) => {
    const { state: engaged, id } = engageMinion(withAttachments(game(), ...codes), FILLER, P1);
    const hero = round(engaged, { boosts: 2 });
    const attack = events(hero.events, "attackResolved").find((e) => e.enemyInstanceId === id)!;
    expect(attack.baseAtk).toBe(expected);
    // Stage 3 (7[per_hero] to go) so that no stage 2 completes mid-round and attaches a card of its own.
    const ego = round(calm(atSinisterEnds(engaged)), { boosts: 2, alterEgo: true });
    const scheme = events(ego.events, "schemeResolved").find((e) => e.enemyInstanceId === id)!;
    expect(scheme.baseSch).toBe(expected);
  });

  it("Boost: Mister Sinister gets +1 ATK per SUPERPOWER attachment for this attack (2 attachments: +2)", () => {
    const base = withAttachments(game(), FLIGHT, SUPER_STRENGTH);
    const plain = round(base);
    const boosted = round(base, { boosts: 0, reveals: [FILLER, FILLER] });
    const own = (run: Run) => events(run.events, "attackResolved").find((e) => e.enemyInstanceId === villainId(base))!;
    expect(own(boosted).damageDealt - own(plain).damageDealt).toBe(2);
  });

  it("Boost: and +1 SCH per attachment for a scheme (3 attachments: +3 threat)", () => {
    const base = calm(atSinisterEnds(withAttachments(game(), FLIGHT, SUPER_STRENGTH, TELEPATHY)));
    const plain = round(base, { alterEgo: true });
    const boosted = round(base, { alterEgo: true, boosts: 0, reveals: [FILLER, FILLER] });
    expect(placedBy(boosted.events, villainId(base)) - placedBy(plain.events, villainId(base))).toBe(3);
  });

  it("Boost: no effect when it is a minion that activates (the bonus is Mister Sinister's)", () => {
    const { state, id } = engageMinion(withAttachments(game(), FLIGHT, SUPER_STRENGTH), FILLER, P1);
    // The villain's activation draws a blank boost card, the minion's draws the other Soldier, then the player is dealt a blank.
    const run = drive(heroForm(stackEncounterDeck(state, "01186", FILLER, "01187")), {}, endTurn(P1));
    const minion = events(run.events, "attackResolved").find((e) => e.enemyInstanceId === id)!;
    // 1 printed + 2 attachments for his own stat, and the Soldier boost added nothing to the attack.
    expect(minion.baseAtk).toBe(3);
    expect(minion.damageDealt).toBe(3);
  });
});

describe("Teleported Away (40146): 40146.teleported-away-constant, -forced-interrupt", () => {
  const away = (s: GameState) => encounterCardInVillainArea(s, "40146", 3);

  it("Mister Sinister cannot take damage: a basic attack deals him none", () => {
    const base = heroForm(withAttachments(game()));
    const { state } = away(base);
    // He is not a legal target for the attack at all.
    const result = applyCommand(state, attackVillain(state), DEPS);
    expect(result).toMatchObject({ ok: false, error: { code: "no_valid_target" } });
  });

  it("revealed, it enters with 3 threat plus Hinder 1 per player (4 with 1 player, 5 with 2)", () => {
    for (const [players, expected] of [
      [ONE, 4],
      [TWO, 5],
    ] as const) {
      const base = withAttachments(game({ players }));
      const run = round(calm(base), { reveals: ["40146", FILLER].slice(0, 1) });
      const id = revealed(run.events, "40146");
      expect(inst(run.state, id).threat).toBe(expected);
    }
  });

  it("when he would attack, he schemes instead: no attack, one scheme (1 player, hero form)", () => {
    const base = heroForm(withAttachments(game()));
    const { state } = away(base);
    const run = round(state);
    expect(events(run.events, "attackResolved").filter((e) => e.enemyInstanceId === villainId(base))).toEqual([]);
    const schemes = events(run.events, "schemeResolved").filter((e) => e.enemyInstanceId === villainId(base));
    expect(schemes).toHaveLength(1);
    // SCH 2 printed, a blank boost card.
    expect(schemes[0]!.baseSch).toBe(2);
    expect(placedBy(run.events, villainId(base))).toBe(2);
  });

  it("2 players: both of his attacks become schemes", () => {
    const base = withAttachments(game({ players: TWO }));
    const { state } = away(base);
    const run = round(state);
    expect(events(run.events, "attackResolved").filter((e) => e.enemyInstanceId === villainId(base))).toEqual([]);
    expect(events(run.events, "schemeResolved").filter((e) => e.enemyInstanceId === villainId(base))).toHaveLength(2);
  });

  it("alter-ego players are schemed against as printed (nothing replaced)", () => {
    const base = withAttachments(game());
    const { state } = away(base);
    const run = round(state, { alterEgo: true });
    expect(events(run.events, "schemeResolved").filter((e) => e.enemyInstanceId === villainId(base))).toHaveLength(1);
  });

  it("with Sinister Ends in play too, the attack no longer happens: nothing reaches Hope Summers", () => {
    const base = atSinisterEnds(withAttachments(game()));
    const { state } = away(base);
    const run = round(state);
    expect(events(run.events, "attackResolved").filter((e) => e.enemyInstanceId === villainId(base))).toEqual([]);
    expect(events(run.events, "schemeResolved").filter((e) => e.enemyInstanceId === villainId(base))).toHaveLength(1);
    expect(inst(run.state, hopeOf(base)).damage).toBe(0);
  });
});

/** What a revealed card did to `target`: its damage and exhaust events, and the threat it placed. */
const damageTo = (log: readonly GameEvent[], source: InstanceId, target: InstanceId) =>
  events(log, "damageDealt")
    .filter((e) => e.sourceInstanceId === source && e.targetInstanceId === target)
    .reduce((n, e) => n + e.amount, 0);

describe("Genetic Mastery (40147): 40147.when-revealed", () => {
  const COMBOS: readonly [string, readonly string[], { indirect: number; exhaust: boolean; threat: number }][] = [
    ["no trait", [], { indirect: 0, exhaust: false, threat: 0 }],
    ["AERIAL (Flight)", [FLIGHT], { indirect: 2, exhaust: false, threat: 0 }],
    ["BRUTE (Super Strength)", [SUPER_STRENGTH], { indirect: 0, exhaust: true, threat: 0 }],
    ["PSIONIC (Telepathy)", [TELEPATHY], { indirect: 0, exhaust: false, threat: 2 }],
    ["AERIAL and PSIONIC", [FLIGHT, TELEPATHY], { indirect: 2, exhaust: false, threat: 2 }],
    ["all three", [FLIGHT, SUPER_STRENGTH, TELEPATHY], { indirect: 2, exhaust: true, threat: 2 }],
  ];
  it.each(COMBOS)("%s: each trait he has applies", (_name, codes, expected) => {
    // Stage 2 with no threat on it: a hero's round has no scheme, so nothing completes; stage 3 would send his attack to Hope.
    const base = calm(withAttachments(game(), ...codes));
    const hero = identityOf(base, P1);
    const run = round(base, { reveals: ["40147"] });
    const card = revealed(run.events, "40147");
    expect(damageTo(run.events, card, hero)).toBe(expected.indirect);
    expect(events(run.events, "cardExhausted").filter((e) => e.instanceId === hero)).toHaveLength(
      expected.exhaust ? 1 : 0,
    );
    expect(placedBy(run.events, card)).toBe(expected.threat);
  });

  it("2 players: the player who revealed it is the one hit (indirect damage, exhaust), not the other", () => {
    const base = calm(withAttachments(game({ players: TWO }), FLIGHT, SUPER_STRENGTH));
    const run = round(base, { reveals: ["40147", FILLER] });
    const card = revealed(run.events, "40147");
    expect(damageTo(run.events, card, identityOf(base, P1))).toBe(2);
    expect(damageTo(run.events, card, identityOf(base, P2))).toBe(0);
    expect(events(run.events, "cardExhausted").filter((e) => e.instanceId === identityOf(base, P1))).toHaveLength(1);
    expect(events(run.events, "cardExhausted").filter((e) => e.instanceId === identityOf(base, P2))).toHaveLength(0);
  });
});

describe("Molecular Control (40148): 40148.when-revealed, 40148.boost", () => {
  it("BRUTE: he heals 4 damage as well as taking the tough status card", () => {
    const base = withAttachments(game(), SUPER_STRENGTH);
    const hurt = patchInstance(base, villainId(base), { damage: 6 });
    const run = round(hurt, { reveals: ["40148"] });
    expect(inst(run.state, villainId(base)).damage).toBe(2);
    expect(inst(run.state, villainId(base)).statuses.tough).toBe(1);
  });

  it("heals no more than he has taken (3 damage: all 3)", () => {
    const base = withAttachments(game(), SUPER_STRENGTH);
    const hurt = patchInstance(base, villainId(base), { damage: 3 });
    expect(inst(round(hurt, { reveals: ["40148"] }).state, villainId(base)).damage).toBe(0);
  });

  it.each([
    ["Flight (AERIAL)", FLIGHT],
    ["Telepathy (PSIONIC)", TELEPATHY],
  ])("without the BRUTE trait (%s) he heals nothing", (_name, code) => {
    const base = withAttachments(game(), code);
    const hurt = patchInstance(base, villainId(base), { damage: 6 });
    const run = round(hurt, { reveals: ["40148"] });
    expect(inst(run.state, villainId(base)).damage).toBe(6);
    expect(inst(run.state, villainId(base)).statuses.tough).toBe(1);
  });

  it("the Boost gives the tough status card but never heals, even with BRUTE", () => {
    const base = withAttachments(game(), SUPER_STRENGTH);
    const hurt = patchInstance(base, villainId(base), { damage: 6 });
    const run = round(hurt, { boosts: 0, reveals: ["40148", FILLER] });
    expect(inst(run.state, villainId(base)).statuses.tough).toBe(1);
    expect(inst(run.state, villainId(base)).damage).toBe(6);
  });
});

describe("Sinister Schemes (40149): 40149.when-revealed, 40149.boost", () => {
  // Stage 3's 7[per_hero] target keeps the main scheme from completing mid-round. A blank boost card follows the card
  // for the scheme it makes.
  const reveal = (codes: readonly string[], opts: { alterEgo?: boolean } = {}) => {
    const base = calm(atSinisterEnds(withAttachments(game({ players: TWO }), ...codes)));
    return { base, run: round(base, { reveals: ["40149", "01187", FILLER], ...opts }) };
  };

  it("he schemes (a second scheme beside his own activation); PSIONIC: you are confused", () => {
    const { base, run } = reveal([TELEPATHY], { alterEgo: true });
    // Two players: his two activations, then the one 40149 makes for the player it was dealt to.
    expect(events(run.events, "schemeResolved").filter((e) => e.enemyInstanceId === villainId(base))).toHaveLength(3);
    expect(inst(run.state, identityOf(base, P1)).statuses.confused).toBe(1);
    expect(inst(run.state, identityOf(base, P2)).statuses.confused).toBe(0);
  });

  it.each([
    ["no trait", []],
    ["AERIAL", [FLIGHT]],
    ["BRUTE", [SUPER_STRENGTH]],
  ])("without PSIONIC (%s) you are not confused, but he still schemes", (_name, codes) => {
    const { base, run } = reveal(codes, { alterEgo: true });
    expect(events(run.events, "schemeResolved").filter((e) => e.enemyInstanceId === villainId(base))).toHaveLength(3);
    expect(inst(run.state, identityOf(base, P1)).statuses.confused).toBe(0);
  });

  it("the Boost: you are confused, whatever traits he has", () => {
    const base = calm(atSinisterEnds(withAttachments(game(), FLIGHT)));
    const run = round(base, { alterEgo: true, boosts: 0, reveals: ["40149", FILLER] });
    expect(inst(run.state, identityOf(base, P1)).statuses.confused).toBe(1);
  });
});

describe("Sinister Strike (40150): 40150.when-revealed-alter-ego, -hero, 40150.boost", () => {
  it("alter-ego: it gains surge, so the next card is revealed too", () => {
    const base = calm(atSinisterEnds(withAttachments(game())));
    const run = round(base, { alterEgo: true, reveals: ["40150", FILLER] });
    expect(events(run.events, "surgeTriggered")).toHaveLength(1);
    expect(events(run.events, "encounterCardRevealed").map((e) => e.cardId)).toContain(FILLER);
    // Not an attack on an alter-ego: only his scheme activation happened.
    expect(events(run.events, "attackResolved")).toEqual([]);
  });

  it("hero, AERIAL: he attacks you (beside his own activation) and you are stunned", () => {
    const base = withAttachments(game(), FLIGHT);
    const run = round(base, { reveals: ["40150", "01187"] });
    expect(events(run.events, "attackResolved").filter((e) => e.enemyInstanceId === villainId(base))).toHaveLength(2);
    expect(inst(run.state, identityOf(base, P1)).statuses.stunned).toBe(1);
  });

  it.each([
    ["no trait", []],
    ["BRUTE", [SUPER_STRENGTH]],
    ["PSIONIC", [TELEPATHY]],
  ])("hero, without AERIAL (%s): he attacks you and you are not stunned", (_name, codes) => {
    const base = withAttachments(game(), ...codes);
    const run = round(base, { reveals: ["40150", "01187"] });
    expect(events(run.events, "attackResolved").filter((e) => e.enemyInstanceId === villainId(base))).toHaveLength(2);
    expect(inst(run.state, identityOf(base, P1)).statuses.stunned).toBe(0);
  });

  it("the Boost: you are stunned, whatever traits he has", () => {
    const base = withAttachments(game(), SUPER_STRENGTH);
    const run = round(base, { boosts: 0, reveals: ["40150", FILLER] });
    expect(inst(run.state, identityOf(base, P1)).statuses.stunned).toBe(1);
  });
});
