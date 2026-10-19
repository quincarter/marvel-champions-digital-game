import {
  activeAbilityRefs,
  activeEncounterDeck,
  activeEncounterDeckId,
  applyCommand,
  cardsInPlay,
  createGame,
  traitsOf,
  type Command,
  type GameEvent,
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
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../../testing/harness.js";
import {
  defeatWithAttack,
  driveEventsPicking,
  encounterCardInVillainArea,
  playFromHand,
  withForm,
} from "../../../testing/staging.js";
import { engageMinion } from "../../../wave6/mut_gen/project-wideawake-testing.js";
import { WAVE11_CARDS } from "../../cards.js";
import { WAVE11_DEPS } from "../../index.js";
import { wave11Scenario } from "../../setup.js";
import {
  FNE_SCENARIOS_THE_RAFT_BREAKOUT as REGISTRY,
  FNE_SCENARIOS_THE_RAFT_BREAKOUT_SKIPPED as SKIPPED,
} from "./the-raft-breakout.js";

vi.setConfig({ testTimeout: 180_000 });

const MAIN = "60142a";
const KEY = "60143";
const ABSORBING = "60144";
const ZEMO = "60145";
const DRANG = "60146";
const MYSTERIO = "60147";
const PROXIMA = "60148";
const RHINO = "60149";
const IMPRISONED = "60150";
const TRUCK = "60131";
/** Maggia Enforcers: a minion with no Boost ability, no boost icon and no Elite trait. */
const ENFORCERS = "60092";
/** Pedestrians: a treachery with no Boost, no boost icon; its When Revealed does nothing with no speed counter. */
const PEDESTRIANS = "60133";
/** Burning Rubber: a second filler treachery, likewise a no-op with no speed counter on the main scheme. */
const RUBBER = "60132";
/** Coup de Grâce (`cw` 56016): "Defeat a non-Elite minion with an upgrade attached. Ignore any 'When Defeated' ...". */
const COUP = "56016";
/** A Core player upgrade, attached to a minion by surgery for Coup de Grâce's target. */
const UPGRADE = "01081";
/** The When Defeated each minion gains from 60142b: on no card's own refs. */
const GRANTED = "60142b.granted-when-defeated";
/** Core treacheries with no boost icon and no boost ability: blank boost cards. */
const BLANKS = ["01187", "01186", "01187", "01186"];
const REFS = [
  "60142a.setup",
  "60142b.the-raft-breakout-constant",
  "60143.master-key-forced-response",
  "60144.absorbing-man-forced-interrupt",
  "60145.baron-zemo-constant",
  "60145.when-revealed",
  "60146.drang-forced-response",
  "60147.mysterio-forced-response",
  "60148.proxima-midnight-forced-interrupt",
  "60149.rhino-constant",
  "60149.boost",
  "60150.obligation",
  "60150.imprisoned-action",
  "60150.boost",
];

const data = (code: string) => (WAVE11_CARDS as readonly any[]).find((c) => (c.id as string) === code)!;
const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const hero = (s: GameState, p: PlayerId = P1): InstanceId => identityOf(s, p);
const mainId = (s: GameState): InstanceId => s.mainScheme.instanceId;
const mainThreat = (s: GameState): number => inst(s, mainId(s)).threat;
const withThreat = (s: GameState, n: number): GameState => patchInstance(s, mainId(s), { threat: n });
const inPlay = (s: GameState, id: InstanceId): boolean => cardsInPlay(s).includes(id);
const pile = (s: GameState) => activeEncounterDeck(s);
const typeOf = (s: GameState, id: InstanceId): string | undefined => (s.cardPool[inst(s, id).cardId] as any)?.type;
const bareStatuses = { stunned: 0, confused: 0, tough: 0 };

function newGame(
  opts: {
    players?: number;
    seed?: number;
    difficulty?: "standard" | "expert";
    villainSetId?: string;
    /** Take every minion out of play first, so a villain phase activates the villain and the staged minion only. */
    solo?: boolean;
    form?: "hero" | "alterEgo";
  } = {},
): GameState {
  const { players = 1, seed = 1, difficulty = "standard", villainSetId = "hammerhead", solo = false } = opts;
  const form = opts.form ?? "hero";
  const seats = [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }];
  const base = wave11Scenario("the-raft-breakout", {
    villainSetId,
    players: seats.slice(0, players),
    seed,
    difficulty,
  } as never);
  // Cards of sets the game does not use: filler for dealt cards and boost cards.
  const extra = [ENFORCERS, PEDESTRIANS, RUBBER, TRUCK];
  const config = { ...base, encounterDeck: [...(base.encounterDeck ?? []), ...extra.map((c) => c as never)] };
  const created = createGame(config as never, WAVE11_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  let s = settle(created.state, firstLegal, (st) => st.step.phase === "player", WAVE11_DEPS);
  for (let n = 0; n < players; n++) {
    const p = n === 0 ? P1 : P2;
    s = withForm(s, form === "hero" ? { heroForm: 0 } : "alterEgo", p);
  }
  return solo ? withoutMinions(s) : s;
}

/** Surgery: every minion in a play area goes to the encounter discard pile, unengaged. */
function withoutMinions(s: GameState): GameState {
  let out = s;
  const moved: InstanceId[] = [];
  for (const p of s.players) {
    const minions = p.playArea.filter((i) => typeOf(s, i) === "minion");
    moved.push(...minions);
    out = {
      ...out,
      players: out.players.map((q) =>
        q.playerId === p.playerId ? { ...q, playArea: q.playArea.filter((i) => !minions.includes(i)) } : q,
      ),
    };
    for (const m of minions) out = patchInstance(out, m, { engagedWith: null });
  }
  const here = pile(out);
  return {
    ...out,
    encounterDecks: {
      ...out.encounterDecks,
      [activeEncounterDeckId(out)]: { deck: here.deck, discard: [...here.discard, ...moved] },
    },
  };
}

const declines: Picker = (s) => (s.pendingChoice!.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s));

/**
 * `stack` on top of the encounter deck, then every player ends their turn (the villain phase). `ids` are the stacked
 * copies, in order. No hand is above the hand size afterwards, so nobody draws and a deck keeps its top card.
 */
function villainPhase(state: GameState, stack: readonly string[], pick: Picker = declines) {
  const stacked = stackEncounterDeck(state, ...stack);
  const ids = pile(stacked).deck.slice(0, stack.length);
  const turns = state.players.map((p) => endTurn(p.playerId));
  const run = driveEventsPicking(WAVE11_DEPS, stacked, pick, ...turns);
  return { ...run, ids, before: stacked };
}
const revealedIds = (events: readonly GameEvent[]): InstanceId[] =>
  events.flatMap((e: any) => (e.type === "encounterCardRevealed" ? [e.instanceId as InstanceId] : []));
const revealedBy = (events: readonly GameEvent[], id: InstanceId): PlayerId | undefined =>
  (events.find((e: any) => e.type === "encounterCardRevealed" && e.instanceId === id) as any)?.playerId;
const resolvedAttack = (events: readonly GameEvent[], enemy: InstanceId) =>
  events.find((e: any) => e.type === "attackResolved" && e.enemyInstanceId === enemy) as any;
/** The events of `enemy`'s first activation: up to the next activation or the first dealt card revealed. */
const afterActivation = (events: readonly GameEvent[], enemy: InstanceId): readonly GameEvent[] => {
  const at = events.findIndex((e: any) => e.type === "enemyActivated" && e.enemyInstanceId === enemy);
  expect(at, "the enemy activated").toBeGreaterThanOrEqual(0);
  const rest = events.slice(at + 1);
  const end = rest.findIndex((e: any) => e.type === "enemyActivated" || e.type === "encounterCardRevealed");
  return events.slice(at, end < 0 ? undefined : at + 1 + end);
};
const activations = (events: readonly GameEvent[], enemy: InstanceId) =>
  events.filter((e: any) => e.type === "enemyActivated" && e.enemyInstanceId === enemy) as any[];

/** `count` allies from `player`'s deck put into play under them. */
function alliesInPlay(state: GameState, player: PlayerId, count: number) {
  const allies = playerOf(state, player)
    .deck.filter((i) => typeOf(state, i) === "ally")
    .slice(0, count);
  expect(allies).toHaveLength(count);
  let staged: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player
        ? { ...p, deck: p.deck.filter((i) => !allies.includes(i)), playArea: [...p.playArea, ...allies] }
        : p,
    ),
  };
  for (const id of allies) staged = patchInstance(staged, id, { faceup: true, controllerId: player });
  return { state: staged, allies };
}

describe("registry", () => {
  it("registers every printed ref of the nine cards; nothing is skipped", () => {
    const printed = [MAIN, KEY, ABSORBING, ZEMO, DRANG, MYSTERIO, PROXIMA, RHINO, IMPRISONED].flatMap((c) =>
      abilityRefIds(data(c)),
    );
    expect([...printed].sort()).toEqual([...REFS].sort());
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS, GRANTED].sort());
    expect(Object.keys(SKIPPED)).toEqual([]);
  });
  it.each([...REFS, GRANTED])("%s validates", (ref) => {
    expect(validateDefinition(REGISTRY[ref]!), ref).toEqual([]);
  });
});

describe("The Raft Breakout 60142a setup", () => {
  it.each([1, 2])(
    "60142a.setup: Master Key is on the villain, out of the deck, and each of %s player(s) has revealed a Prisoner minion",
    (players) => {
      const s = newGame({ players });
      expect(inst(s, villainOf(s)).attachments.map((i) => codeOf(s, i))).toEqual([KEY]);
      expect(pile(s).deck.map((i) => codeOf(s, i))).not.toContain(KEY);
      const prisoners = cardsInPlay(s).filter(
        (i) => typeOf(s, i) === "minion" && traitsOf(s, i, WAVE11_DEPS).map(String).includes("PRISONER"),
      );
      expect(prisoners).toHaveLength(players);
      expect(prisoners.map((i) => inst(s, i).engagedWith).sort()).toEqual([P1, P2].slice(0, players));
    },
  );

  it("60142a.setup: each player discards until a Prisoner minion, which they reveal: none is left in the discard pile", () => {
    for (const seed of [1, 2, 3]) {
      const s = newGame({ players: 2, seed });
      const discarded = pile(s).discard.filter(
        (i) => typeOf(s, i) === "minion" && traitsOf(s, i, WAVE11_DEPS).map(String).includes("PRISONER"),
      );
      expect(discarded, `seed ${seed}`).toEqual([]);
    }
  });

  it("the main scheme starts with 2 threat per hero", () => {
    expect(mainThreat(newGame({ players: 1 }))).toBe(2);
    expect(mainThreat(newGame({ players: 2 }))).toBe(4);
  });
});

describe("The Raft Breakout 60142b: each minion gains a When Defeated", () => {
  function defeated(code: string, opts: { threat?: number; crisis?: boolean; hero?: PlayerId } = {}) {
    const base = newGame({ solo: true });
    const placed = engageMinion(withThreat(base, opts.threat ?? 8), code, P1);
    const staged = patchInstance(placed.state, placed.id, { statuses: bareStatuses });
    const withCrisis = opts.crisis ? encounterCardInVillainArea(staged, TRUCK).state : staged;
    return { before: withCrisis, after: defeatWithAttack(WAVE11_DEPS, withCrisis, placed.id), id: placed.id };
  }

  it("60142b.the-raft-breakout-constant: a defeated minion removes 1 threat from the main scheme", () => {
    const { before, after, id } = defeated(ENFORCERS);
    expect(traitsOf(before, id, WAVE11_DEPS).map(String)).not.toContain("ELITE");
    expect(mainThreat(after)).toBe(7);
    expect(pile(after).discard).toContain(id);
  });

  it("60142b.the-raft-breakout-constant: 2 threat instead if the minion has the Elite trait", () => {
    const { before, after, id } = defeated(ABSORBING);
    expect(traitsOf(before, id, WAVE11_DEPS).map(String)).toContain("ELITE");
    expect(mainThreat(after)).toBe(6);
  });

  it("60142b.the-raft-breakout-constant: it removes no more threat than there is", () => {
    expect(mainThreat(defeated(ABSORBING, { threat: 1 }).after)).toBe(0);
  });

  it("60142b.the-raft-breakout-constant: a crisis icon in play does not stop the removal (encounter card ability, RRG 1.8 p. 14)", () => {
    const { before, after } = defeated(ABSORBING, { crisis: true });
    expect(cardsInPlay(before).some((i) => codeOf(before, i) === TRUCK)).toBe(true);
    expect(mainThreat(after)).toBe(6);
  });

  it("60142b.the-raft-breakout-constant: a minion that is not defeated (the villain hit instead) removes nothing", () => {
    const base = newGame({ solo: true });
    const placed = engageMinion(withThreat(base, 8), ENFORCERS, P1);
    expect(mainThreat(placed.state)).toBe(8);
  });

  it("60142b.the-raft-breakout-constant: the minion has the gained When Defeated among its live abilities, not printed on it", () => {
    const base = newGame({ solo: true });
    const placed = engageMinion(base, ENFORCERS, P1);
    expect(abilityRefIds(data(ENFORCERS))).not.toContain(GRANTED);
    expect(activeAbilityRefs(placed.state, placed.id, WAVE11_DEPS).map((r) => r.id as string)).toContain(GRANTED);
  });

  it("60142b.the-raft-breakout-constant: a defeat that ignores When Defeated abilities (Coup de Grâce 56016) removes nothing", () => {
    // RRG 1.8 "'Gains'" (p. 21): the card functions as if it possesses the gained ability, so "ignore any 'When
    // Defeated' abilities on that minion" reaches it as it would a printed one.
    const base = newGame({ solo: true });
    const placed = engageMinion(withThreat(base, 8), ENFORCERS, P1);
    const deck = playerOf(placed.state, P1).deck;
    const [coupId, upgradeId] = deck as [InstanceId, InstanceId];
    let s = patchInstance(placed.state, coupId, { cardId: COUP as never });
    s = patchInstance(s, upgradeId, {
      cardId: UPGRADE as never,
      attachedTo: placed.id,
      controllerId: P1,
      faceup: true,
    });
    s = {
      ...s,
      players: s.players.map((p) => (p.playerId === P1 ? { ...p, deck: p.deck.filter((i) => i !== upgradeId) } : p)),
    };
    s = patchInstance(s, placed.id, {
      attachments: [...inst(s, placed.id).attachments, upgradeId],
      statuses: bareStatuses,
    });
    const played = playFromHand(WAVE11_DEPS, s, COUP, 2);
    expect(playerOf(played.state, P1).discard).toContain(played.id);
    expect(inPlay(played.state, placed.id)).toBe(false);
    expect(pile(played.state).discard).toContain(placed.id);
    expect(mainThreat(played.state)).toBe(8);
  });
});

describe("Master Key 60143", () => {
  const BOOST_MINION_PHASE = (s: GameState, boosts: readonly string[], pick: Picker = declines) =>
    villainPhase(s, [...boosts, PEDESTRIANS], pick);

  it("60143.master-key-forced-response: a minion boost card of the villain's scheme is dealt to the player and revealed, not discarded", () => {
    const s = newGame({ solo: true, form: "alterEgo" });
    const run = BOOST_MINION_PHASE(s, [ENFORCERS]);
    const [minion] = run.ids as [InstanceId];
    expect(activations(run.events, villainOf(s))[0].activation).toBe("scheme");
    expect(revealedIds(run.events)).toContain(minion);
    expect(inPlay(run.state, minion)).toBe(true);
    expect(inst(run.state, minion).engagedWith).toBe(P1);
    expect(pile(run.state).discard).not.toContain(minion);
  });

  it("60143.master-key-forced-response: without the Master Key the same boost card is discarded (the control)", () => {
    const s = newGame({ solo: true, form: "alterEgo" });
    const keyless = patchInstance(s, villainOf(s), { attachments: [] });
    const run = BOOST_MINION_PHASE(keyless, [ENFORCERS]);
    const [minion] = run.ids as [InstanceId];
    expect(revealedIds(run.events)).not.toContain(minion);
    expect(inPlay(run.state, minion)).toBe(false);
    expect(pile(run.state).discard).toContain(minion);
  });

  it("60143.master-key-forced-response: boost effects resolve as normal first: Rhino's Boost gives the villain a tough status card, then Rhino is dealt", () => {
    const s = newGame({ solo: true, form: "alterEgo" });
    const bare = patchInstance(s, villainOf(s), { statuses: bareStatuses });
    const run = BOOST_MINION_PHASE(bare, [RHINO]);
    const [rhino] = run.ids as [InstanceId];
    expect(inst(run.state, villainOf(run.state)).statuses.tough).toBe(1);
    expect(inPlay(run.state, rhino)).toBe(true);
    expect(inst(run.state, rhino).engagedWith).toBe(P1);
  });

  it("60143.master-key-forced-response: a villain attack's minion boost card is discarded (only schemes)", () => {
    const s = newGame({ solo: true, form: "hero" });
    const run = BOOST_MINION_PHASE(s, [ENFORCERS]);
    const [minion] = run.ids as [InstanceId];
    expect(activations(run.events, villainOf(s))[0].activation).toBe("attack");
    expect(revealedIds(run.events)).not.toContain(minion);
    expect(pile(run.state).discard).toContain(minion);
  });

  it("60143.master-key-forced-response: a boost card that is not a minion is discarded", () => {
    const s = newGame({ solo: true, form: "alterEgo" });
    const run = BOOST_MINION_PHASE(s, [BLANKS[0]!]);
    const [card] = run.ids as [InstanceId];
    expect(revealedIds(run.events)).not.toContain(card);
    expect(pile(run.state).discard).toContain(card);
  });

  it("60143.master-key-forced-response: a minion's own scheme with a minion boost card is discarded (the villain's activation only)", () => {
    const base = newGame({ solo: true, form: "alterEgo" });
    const placed = engageMinion(base, ABSORBING, P1);
    const run = villainPhase(placed.state, [BLANKS[0]!, ENFORCERS, PEDESTRIANS]);
    const minion = run.ids[1]!;
    expect(activations(run.events, placed.id)[0].activation).toBe("scheme");
    expect(revealedIds(run.events)).not.toContain(minion);
    expect(pile(run.state).discard).toContain(minion);
  });

  it("60143.master-key-forced-response: with two players, the minion is dealt to the player the villain schemed against", () => {
    const s = newGame({ players: 2, solo: true, form: "alterEgo" });
    // Villain vs P1 (a blank), villain vs P2 (the minion), then one dealt card each.
    const run = villainPhase(s, [BLANKS[0]!, ENFORCERS, PEDESTRIANS, RUBBER]);
    const minion = run.ids[1]!;
    const villainActivations = activations(run.events, villainOf(s));
    expect(villainActivations.map((a) => a.playerId)).toEqual([P1, P2]);
    expect(revealedBy(run.events, minion)).toBe(P2);
    expect(inst(run.state, minion).engagedWith).toBe(P2);
  });
});

describe("Mysterio 60147", () => {
  const phase = (opts: { form: "hero" | "alterEgo"; players?: number; owner?: PlayerId }, boost: string) => {
    const base = newGame({ solo: true, form: opts.form, players: opts.players ?? 1 });
    const placed = engageMinion(base, MYSTERIO, opts.owner ?? P1);
    const villainBoosts = (opts.players ?? 1) as number;
    const fillers = (boost === PEDESTRIANS ? [RUBBER, BLANKS[3]!] : [PEDESTRIANS, RUBBER]).slice(0, villainBoosts);
    const stack = [...BLANKS.slice(0, villainBoosts), boost, ...fillers];
    const run = villainPhase(placed.state, stack);
    return { ...run, mysterio: placed.id, card: run.ids[villainBoosts]! };
  };

  it("60147.mysterio-forced-response: a treachery boost card of his attack on you is dealt to you and revealed", () => {
    const run = phase({ form: "hero" }, PEDESTRIANS);
    expect(activations(run.events, run.mysterio)[0].activation).toBe("attack");
    expect(revealedBy(run.events, run.card)).toBe(P1);
  });

  it("60147.mysterio-forced-response: the same card is only discarded when Mysterio does not attack (a scheme against an alter-ego)", () => {
    const run = phase({ form: "alterEgo" }, PEDESTRIANS);
    expect(activations(run.events, run.mysterio)[0].activation).toBe("scheme");
    expect(revealedIds(run.events)).not.toContain(run.card);
    expect(pile(run.state).discard).toContain(run.card);
  });

  it("60147.mysterio-forced-response: a minion boost card of his attack is discarded (treacheries only)", () => {
    const run = phase({ form: "hero" }, ENFORCERS);
    expect(revealedIds(run.events)).not.toContain(run.card);
    expect(inPlay(run.state, run.card)).toBe(false);
    expect(pile(run.state).discard).toContain(run.card);
  });

  it("60147.mysterio-forced-response: only his own activation: the villain's treachery boost card is discarded (the control)", () => {
    const base = newGame({ solo: true, form: "hero" });
    const placed = engageMinion(base, MYSTERIO, P1);
    const run = villainPhase(placed.state, [PEDESTRIANS, BLANKS[0]!, RUBBER]);
    const villainBoost = run.ids[0]!;
    expect(revealedIds(run.events)).not.toContain(villainBoost);
    expect(pile(run.state).discard).toContain(villainBoost);
  });

  it("60147.mysterio-forced-response: with two players, when the other player's hero defends, it is dealt to the defender", () => {
    // The defender becomes the attack's target and its player the target player (RRG 1.8 "Defend, Defense", p. 15,
    // worded for an ally; the engine's `setDefender` applies it to a hero too), so Mysterio "attacks you" for P1.
    const base = newGame({ solo: true, form: "hero", players: 2 });
    const placed = engageMinion(base, MYSTERIO, P2);
    const stack = [BLANKS[0]!, BLANKS[1]!, PEDESTRIANS, RUBBER, BLANKS[3]!];
    const run = villainPhase(placed.state, stack, (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind === "declareDefender" && choice.prompt.attack.enemyInstanceId === placed.id) {
        const defender = choice.options.find((o) => o.optionId === hero(s, P1));
        if (defender) return [defender.optionId];
      }
      return declines(s);
    });
    const card = run.ids[2]!;
    expect(activations(run.events, placed.id)[0].playerId).toBe(P2);
    expect(revealedBy(run.events, card)).toBe(P1);
  });

  it("60147.mysterio-forced-response: with two players, it is dealt to the player Mysterio attacked", () => {
    const run = phase({ form: "hero", players: 2, owner: P2 }, PEDESTRIANS);
    expect(activations(run.events, run.mysterio)[0].playerId).toBe(P2);
    expect(revealedBy(run.events, run.card)).toBe(P2);
  });
});

describe("Absorbing Man 60144", () => {
  type Type = "physical" | "mental" | "energy" | "wild";
  const iconTypes = (s: GameState, id: InstanceId): Type[] => {
    const icons = ((s.cardPool[inst(s, id).cardId] as any)?.resourceIcons ?? {}) as Partial<Record<Type, number>>;
    return (["physical", "mental", "energy", "wild"] as const).filter((t) => (icons[t] ?? 0) > 0);
  };
  /** `n` cards of `owner`'s deck, each printing only `type`, none in `taken`. */
  const cardsOf = (s: GameState, owner: PlayerId, type: Type, n: number, taken: readonly InstanceId[] = []) => {
    const found = playerOf(s, owner)
      .deck.filter((i) => !taken.includes(i) && iconTypes(s, i).length === 1 && iconTypes(s, i)[0] === type)
      .slice(0, n);
    expect(found, `${n} ${type} card(s) in the deck`).toHaveLength(n);
    return found;
  };

  /** Absorbing Man engaged with `owner`, `pre` cards already tucked under him, `top` on top of `owner`'s deck. */
  function staged(pre: readonly Type[], top: Type, owner: PlayerId = P1, players = 1) {
    const base = newGame({ solo: true, players });
    let placed = engageMinion(base, ABSORBING, owner);
    // No Core hero deck holds a card that prints only wild: the last cards of the deck are retagged as Hellcat (01020).
    const wilds = [...pre, top].filter((t) => t === "wild").length;
    if (wilds > 0) {
      for (const id of playerOf(placed.state, owner).deck.slice(-wilds))
        placed = { ...placed, state: patchInstance(placed.state, id, { cardId: "01020" as never }) };
    }
    const taken: InstanceId[] = [];
    const tuckedIds: InstanceId[] = [];
    for (const type of pre) {
      const [id] = cardsOf(placed.state, owner, type, 1, taken);
      taken.push(id!);
      tuckedIds.push(id!);
    }
    const [topId] = cardsOf(placed.state, owner, top, 1, taken);
    let s: GameState = {
      ...placed.state,
      players: placed.state.players.map((p) =>
        p.playerId === owner
          ? { ...p, deck: [topId!, ...p.deck.filter((i) => i !== topId && !tuckedIds.includes(i))] }
          : p,
      ),
    };
    s = patchInstance(s, placed.id, { tucked: tuckedIds });
    return { state: s, am: placed.id, topId: topId!, tuckedIds };
  }
  const run = (s: ReturnType<typeof staged>, players = 1) => villainPhase(s.state, BLANKS.slice(0, players + 1));
  const expectedBonus = (s: GameState, ids: readonly InstanceId[]) => new Set(ids.flatMap((i) => iconTypes(s, i))).size;

  it("60144.absorbing-man-forced-interrupt: tucks the top card of your deck under him and gets +1 ATK for its resource type", () => {
    const s = staged([], "energy");
    const done = run(s);
    expect(inst(done.state, s.am).tucked).toEqual([s.topId]);
    expect(playerOf(done.state, P1).deck).not.toContain(s.topId);
    // The bonus is part of the attack's ATK: 1 printed, +1 for the one type.
    expect(resolvedAttack(done.events, s.am).baseAtk).toBe(2);
    expect(resolvedAttack(done.events, s.am).damageDealt).toBe(2);
  });

  it("60144.absorbing-man-forced-interrupt: +1 ATK for each different resource type under him, the new card counted", () => {
    const s = staged(["energy", "mental"], "physical");
    const done = run(s);
    expect(inst(done.state, s.am).tucked).toEqual([...s.tuckedIds, s.topId]);
    expect(expectedBonus(done.before, [...s.tuckedIds, s.topId])).toBe(3);
    expect(resolvedAttack(done.events, s.am).damageDealt).toBe(1 + 3);
  });

  it("60144.absorbing-man-forced-interrupt: the same type twice counts once", () => {
    const s = staged(["energy", "energy"], "energy");
    const done = run(s);
    expect(inst(done.state, s.am).tucked).toHaveLength(3);
    expect(resolvedAttack(done.events, s.am).damageDealt).toBe(1 + 1);
  });

  it("60144.absorbing-man-forced-interrupt: a wild resource is a type of its own", () => {
    const s = staged(["energy"], "wild");
    const done = run(s);
    expect(resolvedAttack(done.events, s.am).damageDealt).toBe(1 + 2);
  });

  it("60144.absorbing-man-forced-interrupt: with two players it tucks from the deck of the player he attacks", () => {
    const s = staged([], "mental", P2, 2);
    const p1Deck = playerOf(s.state, P1).deck;
    const done = run(s, 2);
    expect(inst(done.state, s.am).tucked).toEqual([s.topId]);
    expect(playerOf(done.state, P1).deck).toEqual(p1Deck);
  });
});

describe("Baron Zemo 60145", () => {
  /** Zemo dealt to the last player in a villain phase; `pick` answers the ally choice. */
  function reveal(state: GameState, pick: Picker, stack?: readonly string[]) {
    const players = state.players.length;
    const cards = stack ?? [...BLANKS.slice(0, players), ...(players === 2 ? [PEDESTRIANS] : []), ZEMO];
    return villainPhase(state, cards, pick);
  }
  const choosing =
    (wanted: InstanceId, seen: { prompts: { player: PlayerId; options: string[] }[] }): Picker =>
    (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind !== "declareDefender" && choice.options.some((o) => o.optionId === wanted)) {
        seen.prompts.push({ player: choice.playerId, options: choice.options.map((o) => o.optionId) });
        return [wanted];
      }
      return declines(s);
    };

  it("60145.when-revealed: 1 threat on the chosen ally without threat, which engages its controller", () => {
    const base = alliesInPlay(newGame({ solo: true }), P1, 2);
    const [first, second] = base.allies as [InstanceId, InstanceId];
    const seen = { prompts: [] as { player: PlayerId; options: string[] }[] };
    const run = reveal(base.state, choosing(second, seen));
    expect(inst(run.state, second).threat).toBe(1);
    expect(inst(run.state, second).treatedAs).toMatchObject({ kind: "minion", source: run.ids[run.ids.length - 1] });
    expect(inst(run.state, second).engagedWith).toBe(P1);
    expect(inst(run.state, first).threat).toBe(0);
    expect(inst(run.state, first).treatedAs ?? null).toBeNull();
    expect(seen.prompts).toHaveLength(1);
  });

  it("60145.when-revealed: only an ally without threat on it can be chosen", () => {
    const base = alliesInPlay(newGame({ solo: true }), P1, 2);
    const [first, second] = base.allies as [InstanceId, InstanceId];
    const loaded = patchInstance(base.state, first, { threat: 1 });
    const seen = { prompts: [] as { player: PlayerId; options: string[] }[] };
    const run = reveal(loaded, choosing(second, seen));
    expect(seen.prompts).toEqual([{ player: P1, options: [second] }].map((p) => expect.objectContaining(p)));
    expect(inst(run.state, first).threat).toBe(1);
    expect(inst(run.state, second).threat).toBe(1);
  });

  it("60145.when-revealed: with two players the first player chooses, and the ally engages its own controller", () => {
    const mine = alliesInPlay(newGame({ players: 2, solo: true }), P1, 1);
    const theirs = alliesInPlay(mine.state, P2, 1);
    const target = theirs.allies[0]!;
    const seen = { prompts: [] as { player: PlayerId; options: string[] }[] };
    // P1 is dealt the first card, P2 (the revealer) is dealt Zemo.
    const run = reveal(theirs.state, choosing(target, seen));
    expect(seen.prompts).toHaveLength(1);
    expect(seen.prompts[0]!.player).toBe(P1);
    expect(seen.prompts[0]!.options.sort()).toEqual([mine.allies[0]!, target].sort());
    expect(revealedBy(run.events, run.ids[run.ids.length - 1]!)).toBe(P2);
    expect(inst(run.state, target).threat).toBe(1);
    expect(inst(run.state, target).engagedWith).toBe(P2);
    expect(inst(run.state, mine.allies[0]!).threat).toBe(0);
  });

  it("60145.when-revealed: with no ally in play nothing is placed and the minion is still revealed", () => {
    const base = newGame({ solo: true });
    const run = reveal(base, declines);
    const zemo = run.ids[run.ids.length - 1]!;
    expect(inPlay(run.state, zemo)).toBe(true);
  });

  it("60145.baron-zemo-constant: an ally with threat on it is a Deceived minion while Zemo is in play, and an ally again when he leaves", () => {
    const base = alliesInPlay(newGame({ solo: true }), P1, 1);
    const ally = base.allies[0]!;
    const run = reveal(base.state, (s) =>
      s.pendingChoice!.prompt.kind !== "declareDefender" && s.pendingChoice!.options.some((o) => o.optionId === ally)
        ? [ally]
        : declines(s),
    );
    const zemo = run.ids[run.ids.length - 1]!;
    expect(traitsOf(run.state, ally, WAVE11_DEPS).map(String)).toContain("DECEIVED");
    expect(inst(run.state, ally).engagedWith).toBe(P1);
    const ready = patchInstance(run.state, hero(run.state), { statuses: bareStatuses, exhausted: false });
    const left = defeatWithAttack(WAVE11_DEPS, ready, zemo);
    expect(inPlay(left, zemo)).toBe(false);
    expect(traitsOf(left, ally, WAVE11_DEPS).map(String)).not.toContain("DECEIVED");
    expect(inst(left, ally).treatedAs ?? null).toBeNull();
    expect(inst(left, ally).engagedWith).toBeNull();
    expect(inst(left, ally).controllerId).toBe(P1);
    expect(inst(left, ally).threat).toBe(1);
  });
});

describe("The Raft Breakout 60142b with Baron Zemo 60145: an ally treated as a Deceived minion", () => {
  /** Zemo revealed: P1's one ally gets his threat and is a Deceived minion. */
  function deceived() {
    const base = alliesInPlay(newGame({ solo: true }), P1, 1);
    const ally = base.allies[0]!;
    const run = villainPhase(base.state, [BLANKS[0]!, ZEMO], (s) =>
      s.pendingChoice!.prompt.kind !== "declareDefender" && s.pendingChoice!.options.some((o) => o.optionId === ally)
        ? [ally]
        : declines(s),
    );
    return { run, ally };
  }

  it("60142b.the-raft-breakout-constant: the ally's text box is blank, it still gains the When Defeated and removes 1 threat when defeated", () => {
    // Zemo treats the ally as a minion "with a blank text box"; a blank text box takes away printed text, and a gained
    // ability is "not considered to be printed on the card" (RRG 1.8 "'Gains'", p. 21), so the ally, now a minion,
    // still gains it. (The rulebook has no "Blank" glossary entry in 1.8; the blank reading is the card's own words.)
    const { run, ally } = deceived();
    expect(traitsOf(run.state, ally, WAVE11_DEPS).map(String)).toContain("DECEIVED");
    // The ally prints abilities of its own; none is live while it is a Deceived minion, the gained one is.
    expect(abilityRefIds(data(codeOf(run.state, ally))).length).toBeGreaterThan(0);
    const live = activeAbilityRefs(run.state, ally, WAVE11_DEPS).map((r) => r.id as string);
    expect(live).toEqual([GRANTED]);
    const ready = withThreat(
      patchInstance(run.state, hero(run.state), { statuses: bareStatuses, exhausted: false }),
      8,
    );
    const after = defeatWithAttack(WAVE11_DEPS, ready, ally);
    expect(inPlay(after, ally)).toBe(false);
    expect(mainThreat(after)).toBe(7);
  });

  it("60142b.the-raft-breakout-constant: a crisis icon stops it on the ally, a player card (owner Q209 open, built A)", () => {
    // RRG 1.8 "Crisis Icon" (p. 14): "threat cannot be removed from the main scheme by player cards"; the gained
    // ability is on the ally ("'Gains'", p. 21), so its removal is a player card's. An encounter minion's is not
    // stopped (the crisis test above).
    const { run, ally } = deceived();
    const ready = withThreat(
      patchInstance(run.state, hero(run.state), { statuses: bareStatuses, exhausted: false }),
      8,
    );
    const crisis = encounterCardInVillainArea(ready, TRUCK).state;
    const after = defeatWithAttack(WAVE11_DEPS, crisis, ally);
    expect(inPlay(after, ally)).toBe(false);
    expect(mainThreat(after)).toBe(8);
  });
});

describe("Drang 60146", () => {
  /** The `damageDealt` amounts after the barrage counter was placed. */
  const indirect = (events: readonly GameEvent[]) => {
    const at = events.findIndex((e: any) => e.type === "counterAdded");
    expect(at, "a barrage counter was placed").toBeGreaterThanOrEqual(0);
    return events.slice(at).flatMap((e: any) => (e.type === "damageDealt" ? [e] : [])) as any[];
  };

  it("60146.drang-forced-response: after he attacks you, a barrage counter on him and 1 indirect damage for it", () => {
    const base = newGame({ solo: true });
    const placed = engageMinion(base, DRANG, P1);
    const run = villainPhase(placed.state, BLANKS.slice(0, 2));
    expect(inst(run.state, placed.id).counters.barrage).toBe(1);
    const hits = indirect(afterActivation(run.events, placed.id));
    expect(hits.map((h) => h.amount)).toEqual([1]);
    expect(hits[0].targetInstanceId).toBe(hero(run.state));
  });

  it("60146.drang-forced-response: 1 indirect damage for each barrage counter on him, the new one counted", () => {
    const base = newGame({ solo: true });
    const placed = engageMinion(base, DRANG, P1);
    const loaded = patchInstance(placed.state, placed.id, { counters: { barrage: 2 } });
    const run = villainPhase(loaded, BLANKS.slice(0, 2));
    expect(inst(run.state, placed.id).counters.barrage).toBe(3);
    expect(indirect(afterActivation(run.events, placed.id)).map((h) => h.amount)).toEqual([3]);
  });

  it("60146.drang-forced-response: with two players, the player he attacked takes it", () => {
    const base = newGame({ players: 2, solo: true });
    const placed = engageMinion(base, DRANG, P2);
    const run = villainPhase(placed.state, BLANKS.slice(0, 3));
    const hits = indirect(afterActivation(run.events, placed.id));
    expect(hits.map((h) => h.targetInstanceId)).toEqual([hero(run.state, P2)]);
    expect(hits[0].amount).toBe(1);
  });
});

describe("Proxima Midnight 60148", () => {
  const phase = (text: string, opts: { players?: number; owner?: PlayerId } = {}) => {
    const players = opts.players ?? 1;
    const base = newGame({ solo: true, players });
    const placed = engageMinion(base, PROXIMA, opts.owner ?? P1);
    const seen: PlayerId[] = [];
    const pick: Picker = (s) => {
      const hit = s.pendingChoice!.options.find((o) => o.label.includes(text));
      if (hit) {
        seen.push(s.pendingChoice!.playerId);
        return [hit.optionId];
      }
      return declines(s);
    };
    const run = villainPhase(placed.state, BLANKS.slice(0, players + 1), pick);
    return { ...run, proxima: placed.id, seen };
  };

  it("60148.proxima-midnight-forced-interrupt: choosing the threat places 1 threat on the main scheme, and her attack has its printed ATK", () => {
    const threat = phase("Place 1 threat");
    const atk = phase("+2 ATK");
    expect(resolvedAttack(threat.events, threat.proxima).damageDealt).toBe(2);
    expect(mainThreat(threat.state) - mainThreat(atk.state)).toBe(1);
  });

  it("60148.proxima-midnight-forced-interrupt: choosing the ATK gives +2 ATK for this attack", () => {
    const atk = phase("+2 ATK");
    expect(resolvedAttack(atk.events, atk.proxima).damageDealt).toBe(4);
  });

  it("60148.proxima-midnight-forced-interrupt: the player she attacks makes the choice", () => {
    const run = phase("+2 ATK", { players: 2, owner: P2 });
    expect(run.seen).toEqual([P2]);
  });
});

describe("Rhino 60149", () => {
  it("60149.boost: as a boost card it gives the activating enemy a tough status card (not the villain)", () => {
    const base = newGame({ solo: true });
    const placed = engageMinion(base, ABSORBING, P1);
    const bare = patchInstance(
      patchInstance(placed.state, placed.id, { statuses: bareStatuses }),
      villainOf(placed.state),
      {
        statuses: bareStatuses,
      },
    );
    const run = villainPhase(bare, [BLANKS[0]!, RHINO]);
    expect(inst(run.state, placed.id).statuses.tough).toBe(1);
    expect(inst(run.state, villainOf(run.state)).statuses.tough).toBe(0);
  });

  it("60149.rhino-constant: his attacks gain overkill: damage past a defending ally goes to the hero", () => {
    const base = alliesInPlay(newGame({ solo: true }), P1, 1);
    const ally = base.allies[0]!;
    const placed = engageMinion(base.state, RHINO, P1);
    const hp = (s: GameState) => (s.cardPool[inst(s, ally).cardId] as any).hp as number;
    // The ally has 1 hit point left: Rhino's 3 ATK leaves 2 past it.
    const hurt = patchInstance(placed.state, ally, { damage: hp(placed.state) - 1, exhausted: false });
    let defenders = 0;
    const pick: Picker = (s) => {
      if (s.pendingChoice!.prompt.kind !== "declareDefender") return firstLegal(s);
      defenders += 1;
      return defenders === 2 && s.pendingChoice!.options.some((o) => o.optionId === ally) ? [ally] : ["decline"];
    };
    const run = villainPhase(hurt, BLANKS.slice(0, 2), pick);
    const after = afterActivation(run.events, placed.id);
    expect(resolvedAttack(run.events, placed.id).damageDealt).toBe(3);
    expect(pile(run.state).discard.length).toBeGreaterThan(0);
    expect(playerOf(run.state, P1).discard).toContain(ally);
    const toHero = after.flatMap((e: any) =>
      e.type === "damageDealt" && e.targetInstanceId === hero(run.state) ? [e.amount as number] : [],
    );
    expect(toHero).toEqual([2]);
  });

  it("60149.rhino-constant: an attack without overkill stops at the defending ally (the control)", () => {
    const base = alliesInPlay(newGame({ solo: true }), P1, 1);
    const ally = base.allies[0]!;
    const placed = engageMinion(base.state, DRANG, P1);
    const hp = (s: GameState) => (s.cardPool[inst(s, ally).cardId] as any).hp as number;
    const hurt = patchInstance(placed.state, ally, { damage: hp(placed.state) - 1, exhausted: false });
    let defenders = 0;
    const pick: Picker = (s) => {
      if (s.pendingChoice!.prompt.kind !== "declareDefender") return firstLegal(s);
      defenders += 1;
      return defenders === 2 && s.pendingChoice!.options.some((o) => o.optionId === ally) ? [ally] : ["decline"];
    };
    const run = villainPhase(patchInstance(hurt, placed.id, { counters: {} }), BLANKS.slice(0, 2), pick);
    const toHero = afterActivation(run.events, placed.id).flatMap((e: any) =>
      e.type === "damageDealt" && e.targetInstanceId === hero(run.state) ? [e.amount as number] : [],
    );
    // Drang's 1 ATK is all absorbed by the ally; only his own indirect damage (1) reaches the hero.
    expect(toHero).toEqual([1]);
  });
});

describe("Imprisoned 60150", () => {
  /** Imprisoned revealed to `owner` as a dealt encounter card in a villain phase, then the heroes ready and free. */
  function imprisoned(players = 1, owner: PlayerId = P1) {
    const base = newGame({ players, solo: true });
    const dealt = players === 2 && owner === P2 ? [PEDESTRIANS, IMPRISONED] : [IMPRISONED];
    const run = villainPhase(base, [...BLANKS.slice(0, players), ...dealt]);
    const id = run.ids[players]!;
    let s = run.state;
    for (const p of s.players) {
      s = patchInstance(s, identityOf(s, p.playerId), { statuses: bareStatuses, exhausted: false, damage: 0 });
      s = withForm(s, { heroForm: 0 }, p.playerId);
    }
    return { state: s, id, events: run.events };
  }
  const attack = (s: GameState, p: PlayerId = P1): Command => ({
    type: "basicAttack",
    playerId: p,
    attackerInstanceId: hero(s, p),
    targetInstanceId: villainOf(s),
  });
  const thwart = (s: GameState, p: PlayerId = P1): Command => ({
    type: "basicThwart",
    playerId: p,
    thwarterInstanceId: hero(s, p),
    schemeInstanceId: mainId(s),
  });
  const toAlterEgo = (p: PlayerId = P1): Command => ({ type: "changeForm", playerId: p });
  const ACTION = "60150.imprisoned-action";

  it("60150.obligation: with it in front of you, you cannot attack, thwart or change to alter-ego form", () => {
    const { state: s, id } = imprisoned();
    expect(playerOf(s, P1).playArea).toContain(id);
    expect(applyCommand(s, attack(s), WAVE11_DEPS).ok, "attack").toBe(false);
    expect(applyCommand(s, thwart(withThreat(s, 3)), WAVE11_DEPS).ok, "thwart").toBe(false);
    expect(applyCommand(s, toAlterEgo(), WAVE11_DEPS).ok, "change form").toBe(false);
  });

  it("60150.obligation: once it is gone the same hero attacks, thwarts and changes form (the control)", () => {
    const { state: s, id } = imprisoned();
    const freed = {
      ...s,
      players: s.players.map((p) => ({ ...p, playArea: p.playArea.filter((i) => i !== id) })),
    } as GameState;
    expect(applyCommand(freed, attack(freed), WAVE11_DEPS).ok, "attack").toBe(true);
    expect(applyCommand(freed, thwart(withThreat(freed, 3)), WAVE11_DEPS).ok, "thwart").toBe(true);
    expect(applyCommand(freed, toAlterEgo(), WAVE11_DEPS).ok, "change form").toBe(true);
  });

  it("60150.obligation: the other player is not held: only the holder cannot", () => {
    const { state: s } = imprisoned(2, P1);
    expect(applyCommand(s, attack(s, P1), WAVE11_DEPS).ok).toBe(false);
    expect(applyCommand(s, attack(s, P2), WAVE11_DEPS).ok).toBe(true);
    expect(applyCommand(s, toAlterEgo(P2), WAVE11_DEPS).ok).toBe(true);
  });

  it("60150.obligation: the holder's allies still thwart and attack (every 'you' is the holder's identity, RRG 1.8 p. 49)", () => {
    const { state: held } = imprisoned();
    const staged = alliesInPlay(held, P1, 1);
    const ally = staged.allies[0]!;
    const s = withThreat(patchInstance(staged.state, ally, { statuses: bareStatuses, exhausted: false }), 3);
    expect(applyCommand(s, thwart(s), WAVE11_DEPS).ok, "the hero is held").toBe(false);
    const allyThwart: Command = {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: ally,
      schemeInstanceId: mainId(s),
    };
    const allyAttack: Command = {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: ally,
      targetInstanceId: villainOf(s),
    };
    expect(applyCommand(s, allyThwart, WAVE11_DEPS).ok, "ally thwart").toBe(true);
    expect(applyCommand(s, allyAttack, WAVE11_DEPS).ok, "ally attack").toBe(true);
  });

  it("60150.obligation: a holder in alter-ego form can still change to hero form", () => {
    const { state: s } = imprisoned();
    const ego = withForm(s, "alterEgo", P1);
    expect(applyCommand(ego, toAlterEgo(), WAVE11_DEPS).ok).toBe(true);
  });

  it("60150.imprisoned-action: spend 3 resources of any type to discard it", () => {
    const { state: s, id } = imprisoned();
    const pay = playerOf(s, P1).hand.slice(0, 3);
    const run = driveEventsPicking(
      WAVE11_DEPS,
      s,
      firstLegal,
      use(
        P1,
        id,
        ACTION,
        pay.map((fromHand) => ({ fromHand })),
        undefined,
        { branch: 0 },
      ),
    );
    expect(playerOf(run.state, P1).playArea).not.toContain(id);
    expect(pile(run.state).discard).toContain(id);
    expect(applyCommand(run.state, attack(run.state), WAVE11_DEPS).ok).toBe(true);
  });

  it("60150.imprisoned-action: 2 resources are not enough", () => {
    const { state: s, id } = imprisoned();
    const pay = playerOf(s, P1).hand.slice(0, 2);
    const result = applyCommand(
      s,
      use(
        P1,
        id,
        ACTION,
        pay.map((fromHand) => ({ fromHand })),
        undefined,
        { branch: 0 },
      ),
      WAVE11_DEPS,
    );
    expect(result.ok).toBe(false);
  });

  it("60150.imprisoned-action: or exhaust characters you control with a total THW of 3 or more", () => {
    const base = imprisoned();
    const withAllies = alliesInPlay(base.state, P1, 2);
    const thw = (id: InstanceId): number => {
      const card = withAllies.state.cardPool[inst(withAllies.state, id).cardId] as any;
      return typeof card.thw === "number" ? card.thw : 0;
    };
    const identityThw = (withAllies.state.cardPool[inst(withAllies.state, hero(withAllies.state)).cardId] as any).hero
      .thw as number;
    const readied = withAllies.allies.reduce((s, a) => patchInstance(s, a, { exhausted: false }), withAllies.state);
    const paying = [hero(readied), ...withAllies.allies];
    const total = identityThw + withAllies.allies.reduce((n, a) => n + thw(a), 0);
    expect(total, "the staged characters carry enough THW").toBeGreaterThanOrEqual(3);
    const run = driveEventsPicking(
      WAVE11_DEPS,
      readied,
      firstLegal,
      use(P1, base.id, ACTION, [], { exhausted: paying }, { branch: 1 }),
    );
    for (const id of paying) expect(inst(run.state, id).exhausted).toBe(true);
    expect(pile(run.state).discard).toContain(base.id);
  });

  it("60150.imprisoned-action: characters with a total THW under 3 cannot pay", () => {
    const base = imprisoned();
    const identityThw = (base.state.cardPool[inst(base.state, hero(base.state)).cardId] as any).hero.thw as number;
    expect(identityThw, "the hero alone carries less than 3 THW").toBeLessThan(3);
    const result = applyCommand(
      base.state,
      use(P1, base.id, ACTION, [], { exhausted: [hero(base.state)] }, { branch: 1 }),
      WAVE11_DEPS,
    );
    expect(result.ok).toBe(false);
    expect(playerOf(base.state, P1).playArea).toContain(base.id);
  });

  it("60150.boost: as a boost card it is revealed to the defending player and stays in front of them", () => {
    const base = newGame({ solo: true });
    const run = villainPhase(base, [IMPRISONED, PEDESTRIANS]);
    const id = run.ids[0]!;
    expect(activations(run.events, villainOf(base))[0].activation).toBe("attack");
    expect(revealedBy(run.events, id)).toBe(P1);
    expect(playerOf(run.state, P1).playArea).toContain(id);
    expect(pile(run.state).discard).not.toContain(id);
  });

  it("60150.boost: with two players it goes to the player the activation was against", () => {
    const base = newGame({ players: 2, solo: true });
    const run = villainPhase(base, [BLANKS[0]!, IMPRISONED, PEDESTRIANS, RUBBER]);
    const id = run.ids[1]!;
    expect(playerOf(run.state, P2).playArea).toContain(id);
    expect(playerOf(run.state, P1).playArea).not.toContain(id);
  });
});
