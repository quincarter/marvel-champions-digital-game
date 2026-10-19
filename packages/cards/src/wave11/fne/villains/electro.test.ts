import { PLAYABLE_CARDS, cardId } from "@mc/content";
import {
  activeEncounterDeck,
  characterProfile,
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
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  putOnTopOfDeck,
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
  withForm,
} from "../../../testing/staging.js";
import { engageMinion, stagedInPlay } from "../../../wave9/falcon/testing.js";
import { WAVE11_CARDS } from "../../cards.js";
import { WAVE11_DEPS } from "../../index.js";
import { FNE_VILLAINS_ELECTRO as REGISTRY, FNE_VILLAINS_ELECTRO_SKIPPED as SKIPPED } from "./electro.js";

vi.setConfig({ testTimeout: 180_000 });

/**
 * The Electro villain set (60076-60078 Electro, 60079 Electric Charge, 60080 Drained of Power, 60081 Whiplash,
 * 60082 Charging Up, 60083 Chain Lightning, 60084 Energy Overload, 60085 Shocking Revelation),
 * docs/phase7-wave11-scenarios.md section S6. Each game is Core's Spider-Man (Justice) against Electro (stage chosen per
 * test) with the Electro set added to the Core encounter deck; Advance (01186) and Assault (01187) print no boost icon and
 * no boost ability, so they are the blank fillers. With `players: 2` a second hero (Captain Marvel, Leadership) joins.
 */
const ELECTRO = "60076";
const CHARGE = "60079";
const DRAINED = "60080";
const WHIPLASH = "60081";
const CHARGING_UP = "60082";
const CHAIN = "60083";
const OVERLOAD = "60084";
const REVELATION = "60085";
const ADVANCE = "01186";
const ASSAULT = "01187";
const BLACK_CAT = "01002";
const REFS = [
  "60076.when-revealed",
  "60076.electro-forced-response",
  "60077.when-revealed",
  "60077.electro-forced-response",
  "60078.when-revealed",
  "60078.electro-forced-response",
  "60079.electric-charge-forced-interrupt",
  "60079.electric-charge-action",
  "60080.when-revealed",
  "60080.drained-of-power-forced-interrupt",
  "60081.whiplash-forced-interrupt",
  "60082.when-defeated",
  "60083.when-revealed",
  "60084.when-revealed",
  "60085.when-revealed",
];

const data = (code: string) => (WAVE11_CARDS as readonly any[]).find((c) => (c.id as string) === code)!;
const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const hero = (s: GameState, p: PlayerId = P1): InstanceId => identityOf(s, p);
const damageOf = (s: GameState, id: InstanceId = hero(s)): number => inst(s, id).damage;
const idOf = (s: GameState, code: string): InstanceId =>
  (Object.keys(s.instances) as InstanceId[]).find((i) => codeOf(s, i) === code)!;
const chargeOf = (s: GameState): InstanceId => idOf(s, CHARGE);
const charges = (s: GameState): number => inst(s, chargeOf(s)).counters["charge"] ?? 0;
const encounterDiscard = (s: GameState): string[] => activeEncounterDeck(s).discard.map((i) => codeOf(s, i));
const profile = (s: GameState, id: InstanceId) => characterProfile(s, id, WAVE11_DEPS)!;
/** The villain defeated by a real attack from a ready hero: it flips to its next stage. */
const flip = (s: GameState): GameState =>
  defeatWithAttack(WAVE11_DEPS, patchInstance(s, hero(s), { exhausted: false }), villainOf(s));
const withCharges = (s: GameState, n: number): GameState =>
  patchInstance(s, chargeOf(s), { counters: { ...inst(s, chargeOf(s)).counters, charge: n } });
const stageOf = (s: GameState): number => s.villains.find((v) => v.instanceId === villainOf(s))!.stageIndex;

/** Core Spider-Man (hero form), plus Captain Marvel with `players: 2`, against Electro at `stage` (1 to 3). */
function newGame(stage = 1, players = 1): GameState {
  const seats = [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }];
  const base = coreScenario("rhino", {
    players: seats.slice(0, players),
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: PLAYABLE_CARDS,
  } as never);
  const created = createGame(
    {
      ...base,
      villainCardId: cardId(ELECTRO),
      villainSide: "A",
      villainStartStageIndex: stage - 1,
      villainLastStageIndex: 2,
      encounterDeck: [...base.encounterDeck, ...encounterCardsOf(["electro"], PLAYABLE_CARDS)],
    },
    WAVE11_DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
  return withForm(settled, { heroForm: 0 });
}

const declines: Picker = (s) => (s.pendingChoice!.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s));
const BOOSTS = [ADVANCE, ASSAULT, ADVANCE, ASSAULT];
/** P1 ends the turn: the villain phase runs on an encounter deck stacked with `boosts` blank boost cards, then `dealt`. */
function villainPhase(
  state: GameState,
  boosts: number,
  dealt: readonly string[] = [WHIPLASH],
  pick: Picker = declines,
) {
  const stack = [...BOOSTS.slice(0, boosts), ...dealt];
  return driveEventsPicking(WAVE11_DEPS, stackEncounterDeck(state, ...stack), pick, endTurn(P1));
}
/** The pending choice's options whose label matches. */
const labelled = (s: GameState, re: RegExp): string[] =>
  s.pendingChoice!.options.filter((o) => re.test(String((o as any).label ?? ""))).map((o) => o.optionId as string);
/** A picker taking the first option whose label matches `re` at a `chooseOne`-style prompt; otherwise `fallback`. */
const byLabel =
  (re: RegExp, fallback: Picker = declines): Picker =>
  (s) => {
    const hit = labelled(s, re);
    return hit.length > 0 ? [hit[0]!] : fallback(s);
  };

/** Black Cat (01002) in P1's play area as an ally. */
function allyInPlay(state: GameState) {
  const placed = stagedInPlay(state, BLACK_CAT);
  return {
    id: placed.id,
    state: patchInstance(placed.state, placed.id, { home: { kind: "playArea", playerId: P1 } } as never),
  };
}
/** The hand cards of `player` that show exactly one printed resource icon of `type` and nothing else. */
const icons = (code: string) => (PLAYABLE_CARDS.find((c) => c.id === cardId(code)) as any).resourceIcons ?? {};
function onlyOf(state: GameState, type: string, player: PlayerId = P1): string[] {
  const p = playerOf(state, player);
  return [...p.hand, ...p.deck]
    .map((i) => codeOf(state, i))
    .filter((c) => {
      const found = icons(c);
      return (found[type] ?? 0) === 1 && Object.entries(found).every(([k, n]) => k === type || !n);
    });
}
/** P1's hand replaced with exactly these cards. */
function handOf(state: GameState, ...codes: string[]): { state: GameState; ids: readonly InstanceId[] } {
  const emptied = {
    ...state,
    players: state.players.map((p) => (p.playerId === P1 ? { ...p, hand: [], discard: [...p.discard, ...p.hand] } : p)),
  };
  return moveToHand(emptied, P1, ...codes);
}

describe("registry", () => {
  it("registers every printed ref of the eight cards; nothing is skipped", () => {
    const printed = [ELECTRO, CHARGE, DRAINED, WHIPLASH, CHARGING_UP, CHAIN, OVERLOAD, REVELATION]
      .flatMap((c) => abilityRefIds(data(c)))
      .sort();
    expect(printed).toEqual([...REFS].sort());
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS].sort());
    expect(Object.keys(SKIPPED)).toEqual([]);
  });
  it.each([...REFS])("%s validates", (ref) => {
    expect(validateDefinition(REGISTRY[ref]!), ref).toEqual([]);
  });
  it("carries the printed timing", () => {
    expect(REGISTRY["60076.when-revealed"]!.trigger).toMatchObject({ kind: "whenRevealed" });
    expect(REGISTRY["60078.electro-forced-response"]!.trigger).toMatchObject({ kind: "response", forced: true });
    expect(REGISTRY["60079.electric-charge-forced-interrupt"]!.trigger).toMatchObject({
      kind: "interrupt",
      forced: true,
    });
    expect(REGISTRY["60079.electric-charge-action"]!.trigger).toMatchObject({ kind: "action" });
    expect(REGISTRY["60080.drained-of-power-forced-interrupt"]!.trigger).toMatchObject({
      kind: "interrupt",
      forced: true,
    });
    expect(REGISTRY["60081.whiplash-forced-interrupt"]!.trigger).toMatchObject({ kind: "interrupt", forced: true });
    expect(REGISTRY["60082.when-defeated"]!.trigger).toMatchObject({ kind: "whenDefeated" });
  });
});

describe("Electro 60076 / 60077 / 60078", () => {
  it("60076.when-revealed: finds Electric Charge, attaches it to Electro and puts 2 per hero charge counters on it", () => {
    const one = newGame(1);
    expect(codeOf(one, villainOf(one))).toBe(ELECTRO);
    expect(inst(one, chargeOf(one)).attachedTo).toBe(villainOf(one));
    expect(charges(one)).toBe(2);
    expect(charges(newGame(1, 2))).toBe(4);
  });

  it("60077.when-revealed: starting at stage II does the same", () => {
    const s = newGame(2);
    expect(inst(s, chargeOf(s)).attachedTo).toBe(villainOf(s));
    expect(charges(s)).toBe(2);
  });

  it("60077.when-revealed: flipping to stage II keeps the attached card and adds 2 per hero more", () => {
    const one = newGame(1);
    const charge = chargeOf(one);
    const flipped = flip(one);
    expect(stageOf(flipped)).toBe(1);
    expect(idOf(flipped, CHARGE)).toBe(charge);
    expect(inst(flipped, charge).attachedTo).toBe(villainOf(flipped));
    expect(charges(flipped)).toBe(4);
  });

  it("60078.when-revealed: flipping to stage III adds 3 per hero (2 heroes: 6)", () => {
    const two = newGame(2, 2);
    expect(charges(two)).toBe(4);
    const flipped = flip(two);
    expect(stageOf(flipped)).toBe(2);
    expect(charges(flipped)).toBe(4 + 6);
  });

  const scheme = (s: GameState) => villainPhase(withForm(s, "alterEgo"), 0);
  it("60076.electro-forced-response: after he schemes, 1 charge counter", () => {
    const s = newGame(1);
    expect(charges(scheme(s).state)).toBe(charges(s) + 1);
  });
  it("60077.electro-forced-response: stage II, 1 charge counter", () => {
    const s = newGame(2);
    expect(charges(scheme(s).state)).toBe(charges(s) + 1);
  });
  it("60078.electro-forced-response: stage III, 2 charge counters", () => {
    const one = newGame(1);
    const flipped = flip(flip(one));
    expect(stageOf(flipped)).toBe(2);
    expect(charges(scheme(flipped).state)).toBe(charges(flipped) + 2);
  });
});

describe("Electric Charge 60079", () => {
  it("is Permanent data", () => {
    expect(data(CHARGE).keywords).toContainEqual({ name: "permanent" });
  });

  const flips = (r: { state: GameState; events: readonly GameEvent[] }) =>
    ofType(r.events, "boostCardFlipped").filter((e) => codeOf(r.state, (e as any).enemyInstanceId) === ELECTRO).length;

  it("60079.electric-charge-forced-interrupt: when Electro attacks, a counter comes off and he gets another boost card", () => {
    const s = newGame(1);
    const run = villainPhase(s, 2);
    expect(charges(run.state)).toBe(charges(s) - 1);
    expect(flips(run)).toBe(2);
  });

  it("60079.electric-charge-forced-interrupt: with no counter to remove it does not trigger", () => {
    const s = withCharges(newGame(1), 0);
    const run = villainPhase(s, 1);
    expect(charges(run.state)).toBe(0);
    expect(flips(run)).toBe(1);
  });

  it("60079.electric-charge-forced-interrupt: the attack gains overkill (damage past a defending ally falls on the hero)", () => {
    const placed = allyInPlay(newGame(2));
    const ally = placed.id;
    const staged = patchInstance(placed.state, ally, { damage: 1 });
    const remaining = profile(staged, ally).maxHp - 1;
    const defends: Picker = (s) =>
      s.pendingChoice!.prompt.kind === "declareDefender" ? [ally as string] : firstLegal(s);
    const run = villainPhase(staged, 2, [WHIPLASH], defends);
    const atk = profile(staged, villainOf(staged)).atk;
    expect(atk).toBeGreaterThan(remaining);
    expect(damageOf(run.state)).toBe(atk - remaining);
    // Without a counter the same attack is not overkill: the hero takes nothing.
    const dry = villainPhase(withCharges(staged, 0), 1, [WHIPLASH], defends);
    expect(damageOf(dry.state)).toBe(0);
  });

  it("60079.electric-charge-action: spending an energy resource removes a counter", () => {
    const s = newGame(1);
    const [energy] = onlyOf(s, "energy");
    expect(energy).toBeDefined();
    const given = handOf(s, energy!);
    const run = driveEventsPicking(
      WAVE11_DEPS,
      given.state,
      firstLegal,
      use(P1, chargeOf(s), "60079.electric-charge-action", [{ fromHand: given.ids[0]! }], undefined, { branch: 0 }),
    );
    expect(charges(run.state)).toBe(charges(s) - 1);
  });

  it("60079.electric-charge-action: or spending 2 resources of any type", () => {
    const s = newGame(1);
    const [a, b] = [onlyOf(s, "mental")[0]!, onlyOf(s, "physical")[0]!];
    const given = handOf(s, a, b);
    const run = driveEventsPicking(
      WAVE11_DEPS,
      given.state,
      firstLegal,
      use(
        P1,
        chargeOf(s),
        "60079.electric-charge-action",
        given.ids.map((fromHand) => ({ fromHand })),
        undefined,
        { branch: 1 },
      ),
    );
    expect(charges(run.state)).toBe(charges(s) - 1);
  });
});

const villainStunned = (s: GameState): GameState =>
  patchInstance(s, villainOf(s), { statuses: { ...inst(s, villainOf(s)).statuses, stunned: 1 } });
/**
 * The hero phase over for everyone, then the villain phase on `dealt`, one card per player in order. The villain is
 * stunned, so his first activation only discards the stun (no attack, no boost card). He activates once per player: with
 * two heroes the second activation is a scheme against P2 (still in alter-ego form), which draws a boost card, so a
 * blank one (Advance) is stacked ahead of `dealt`; his Forced Response then places a charge counter.
 */
function quietPhase(state: GameState, dealt: readonly string[], pick: Picker = declines) {
  const two = state.players.length > 1;
  return driveEventsPicking(
    WAVE11_DEPS,
    stackEncounterDeck(villainStunned(state), ...(two ? [ADVANCE] : []), ...dealt),
    pick,
    ...(two && state.firstPlayerId === P2
      ? [endTurn(P2), endTurn(P1)]
      : two
        ? [endTurn(P1), endTurn(P2)]
        : [endTurn(P1)]),
  );
}
/** P1's hand emptied into the discard pile, `codes` put on top of the deck in order: the end-of-turn draw takes them. */
function rigDeck(state: GameState, codes: readonly string[]): GameState {
  const emptied = {
    ...state,
    players: state.players.map((p) => (p.playerId === P1 ? { ...p, hand: [], discard: [...p.discard, ...p.hand] } : p)),
  };
  return putOnTopOfDeck(emptied, P1, ...codes).state;
}
/** Test surgery: the card at `index` of P1's deck becomes Spider-Woman (01011), whose only printed resource is [wild]. */
const wildAt = (state: GameState, index: number): GameState =>
  patchInstance(state, playerOf(state, P1).deck[index]!, { cardId: cardId("01011") });
const NO_ENERGY = ["01004", "01003", "01009", "01005", "01061", "01086"];
const handCodes = (s: GameState, p: PlayerId = P1) =>
  playerOf(s, p)
    .hand.map((i) => codeOf(s, i))
    .sort();

/** A second round on top of `quietPhase`: the end of P1's turn is where cards ready (RRG 1.8 "Ready", p. 36). */
function nextRound(state: GameState, pick: Picker) {
  return quietPhase(state, [WHIPLASH], pick);
}

describe("Drained of Power 60080", () => {
  it("is Uses (3 drain counters) data", () => {
    expect(data(DRAINED).keywords).toContainEqual({ name: "uses", count: 3, counterType: "drain" });
  });

  const withUpgrade = (s: GameState) => stagedInPlay(s, "01008", { attach: true });
  /** The copy in play: the set has two. */
  const drainedOf = (s: GameState) =>
    (Object.keys(s.instances) as InstanceId[]).find((i) => codeOf(s, i) === DRAINED && inst(s, i).attachedTo !== null)!;
  const drain = (s: GameState) => inst(s, drainedOf(s)).counters["drain"] ?? 0;
  /** Round one reveals Drained of Power on P1 (the upgrade ends it exhausted); `rig` is the hand it is paid from. */
  function revealed(rig: readonly string[] = NO_ENERGY, players = 1) {
    const up = withUpgrade(newGame(1, players));
    const round = quietPhase(rigDeck(up.state, rig), [DRAINED, WHIPLASH]);
    return { up: up.id, state: round.state, events: round.events };
  }

  it("60080.when-revealed: attaches to your identity and exhausts each upgrade you control", () => {
    const r = revealed();
    expect(inst(r.state, drainedOf(r.state)).attachedTo).toBe(hero(r.state));
    expect(drain(r.state)).toBe(3);
    expect(ofType(r.events, "cardExhausted").map((e) => e.instanceId)).toContain(r.up);
    expect(inst(r.state, r.up).exhausted).toBe(true);
  });

  it("60080.drained-of-power-forced-interrupt: not spending leaves the upgrade exhausted", () => {
    const r = revealed();
    const next = nextRound(r.state, byLabel(/Do not spend/));
    expect(inst(next.state, r.up).exhausted).toBe(true);
    expect(drain(next.state)).toBe(3);
  });

  it("60080.drained-of-power-forced-interrupt: spending an energy resource readies the upgrade and removes a drain counter", () => {
    const r = revealed(["01007", ...NO_ENERGY.slice(0, 5)]);
    const next = nextRound(r.state, byLabel(/Spend an energy/));
    expect(inst(next.state, r.up).exhausted).toBe(false);
    expect(drain(next.state)).toBe(2);
    expect(handCodes(next.state)).not.toContain("01007");
  });

  it("60080.drained-of-power-forced-interrupt: or 2 resources of any type", () => {
    const r = revealed();
    const next = nextRound(r.state, byLabel(/2 resources/));
    expect(inst(next.state, r.up).exhausted).toBe(false);
    expect(drain(next.state)).toBe(2);
    expect(playerOf(next.state, P1).hand.length).toBe(playerOf(r.state, P1).hand.length - 2);
  });

  it("60080.drained-of-power-forced-interrupt: the last drain counter discards it", () => {
    const r = revealed(["01007", ...NO_ENERGY.slice(0, 5)]);
    const last = patchInstance(r.state, drainedOf(r.state), { counters: { drain: 1 } });
    const next = nextRound(last, byLabel(/Spend an energy/));
    expect(encounterDiscard(next.state)).toContain(DRAINED);
    expect(inst(next.state, r.up).exhausted).toBe(false);
  });

  it("60080.when-revealed: in a two-player game it is attached to the revealing player; the other player's upgrades are untouched", () => {
    // Round one: P1 is dealt Whiplash, P2 Drained of Power. P1's upgrade is theirs and stays ready.
    const up = withUpgrade(newGame(1, 2));
    const run = quietPhase(up.state, [WHIPLASH, DRAINED]);
    expect(inst(run.state, drainedOf(run.state)).attachedTo).toBe(hero(run.state, P2));
    expect(inst(run.state, up.id).exhausted).toBe(false);
    expect(ofType(run.events, "cardExhausted").map((e) => e.instanceId)).not.toContain(up.id);
  });

  it("60080.drained-of-power-forced-interrupt: on P2's own upgrade, P2 is asked: not spending leaves it exhausted, 2 resources readies it", () => {
    const base = newGame(1, 2);
    const p2 = playerOf(base, P2);
    const upId = p2.hand[0]!;
    const host = hero(base, P2);
    const staged0 = patchInstance(base, upId, {
      cardId: cardId("01008"),
      faceup: true,
      controllerId: P2,
      attachedTo: host,
    });
    const staged = patchInstance(
      {
        ...staged0,
        players: staged0.players.map((p) => (p.playerId === P2 ? { ...p, hand: p.hand.filter((i) => i !== upId) } : p)),
      },
      host,
      { attachments: [...inst(staged0, host).attachments, upId] },
    );
    const round1 = quietPhase(staged, [WHIPLASH, DRAINED]);
    expect(inst(round1.state, drainedOf(round1.state)).attachedTo).toBe(host);
    expect(inst(round1.state, upId).exhausted).toBe(true);
    const refused = quietPhase(round1.state, [CHARGING_UP, CHARGING_UP], byLabel(/Do not spend/));
    expect(inst(refused.state, upId).exhausted).toBe(true);
    expect(drain(refused.state)).toBe(3);
    const handBefore = playerOf(round1.state, P2).hand.length;
    const paid = quietPhase(round1.state, [CHARGING_UP, CHARGING_UP], byLabel(/2 resources/));
    expect(inst(paid.state, upId).exhausted).toBe(false);
    expect(drain(paid.state)).toBe(2);
    expect(playerOf(paid.state, P2).hand.length).toBe(handBefore - 2);
  });

  it("60080.drained-of-power-forced-interrupt: in a two-player game P1's upgrades ready freely while P2 carries it", () => {
    const up = withUpgrade(newGame(1, 2));
    const round1 = quietPhase(up.state, [WHIPLASH, DRAINED]);
    const tired = patchInstance(round1.state, up.id, { exhausted: true });
    const next = quietPhase(tired, [CHARGING_UP, CHARGING_UP]);
    expect(inst(next.state, up.id).exhausted).toBe(false);
    expect(drain(next.state)).toBe(3);
  });
});

describe("Whiplash 60081", () => {
  const whipAttacked = (state: GameState, attacker: InstanceId = hero(state)) => {
    const staged = engageMinion(stackEncounterDeck(state, CHARGING_UP), WHIPLASH, "whip");
    return driveEventsPicking(WAVE11_DEPS, staged, declines, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: attacker,
      targetInstanceId: "whip" as InstanceId,
    } as never);
  };

  it("60081.whiplash-forced-interrupt: when attacked, remove a charge counter, discard the top encounter card, 1 damage to the attacker per boost icon", () => {
    const s = newGame(1);
    const run = whipAttacked(s);
    expect(charges(run.state)).toBe(charges(s) - 1);
    // Charging Up prints 3 boost icons.
    expect(encounterDiscard(run.state)).toContain(CHARGING_UP);
    expect(damageOf(run.state)).toBe(3);
  });

  it("60081.whiplash-forced-interrupt: an attacking ally is the attacker that takes the damage", () => {
    const placed = allyInPlay(newGame(1));
    const run = whipAttacked(placed.state, placed.id);
    expect(damageOf(run.state)).toBe(0);
    // Black Cat has 2 hit points: 3 damage defeats her.
    expect(playerOf(run.state, P1).playArea).not.toContain(placed.id);
  });

  it("60081.whiplash-forced-interrupt: with no charge counter to remove it does not trigger", () => {
    const s = withCharges(newGame(1), 0);
    const run = whipAttacked(s);
    expect(charges(run.state)).toBe(0);
    expect(encounterDiscard(run.state)).not.toContain(CHARGING_UP);
    expect(damageOf(run.state)).toBe(0);
  });
});

describe("Charging Up 60082", () => {
  const defeatIt = (state: GameState) => {
    const placed = encounterCardInVillainArea(state, CHARGING_UP, 1);
    const run = driveEventsPicking(WAVE11_DEPS, placed.state, declines, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: hero(state),
      schemeInstanceId: placed.id,
    } as never);
    return { run, id: placed.id };
  };

  it("60082.when-defeated: 3 charge counters on Electric Charge", () => {
    const s = newGame(1);
    const { run, id } = defeatIt(s);
    expect(encounterDiscard(run.state)).toContain(CHARGING_UP);
    expect(run.state.villainArea).not.toContain(id);
    expect(charges(run.state)).toBe(charges(s) + 3);
  });

  it("60082.when-defeated: three, not three per hero, in a two-player game", () => {
    const s = newGame(1, 2);
    expect(charges(defeatIt(s).run.state)).toBe(charges(s) + 3);
  });
});

describe("Chain Lightning 60083", () => {
  const exhaustedBy = (events: readonly GameEvent[], state: GameState) =>
    ofType(events, "cardExhausted")
      .filter((e) => e.sourceInstanceId !== undefined && codeOf(state, e.sourceInstanceId) === CHAIN)
      .map((e) => e.instanceId);

  it("60083.when-revealed: a character may be exhausted, leaving the counters alone", () => {
    const s = newGame(1);
    const run = quietPhase(s, [CHAIN], byLabel(/Exhaust that/));
    expect(exhaustedBy(run.events, run.state)).toEqual([hero(s)]);
    expect(damageOf(run.state)).toBe(0);
    expect(charges(run.state)).toBe(charges(s));
  });

  it("60083.when-revealed: or take 3 damage while Electric Charge holds a counter, removing one", () => {
    const s = newGame(1);
    const run = quietPhase(s, [CHAIN], byLabel(/Deal damage/));
    expect(damageOf(run.state)).toBe(3);
    expect(charges(run.state)).toBe(charges(s) - 1);
  });

  it("60083.when-revealed: 1 damage with no counter on Electric Charge", () => {
    const s = withCharges(newGame(1), 0);
    const run = quietPhase(s, [CHAIN], byLabel(/Deal damage/));
    expect(damageOf(run.state)).toBe(1);
    expect(charges(run.state)).toBe(0);
  });

  it("60083.when-revealed: each character you control is a separate choice, read after the earlier counter came off", () => {
    const placed = allyInPlay(withCharges(newGame(1), 1));
    const run = quietPhase(placed.state, [CHAIN], byLabel(/Deal damage/));
    expect(charges(run.state)).toBe(0);
    // One character took 3 (the counter was there), the other 1 (it had gone). Black Cat has 2 hit points.
    const allyIn = playerOf(run.state, P1).playArea.includes(placed.id);
    const heroDamage = damageOf(run.state);
    expect((heroDamage === 3 && allyIn && damageOf(run.state, placed.id) === 1) || (heroDamage === 1 && !allyIn)).toBe(
      true,
    );
  });

  it("60083.when-revealed: only your characters: the other player's hero is untouched", () => {
    const s = newGame(1, 2);
    const run = quietPhase(s, [CHAIN, CHARGING_UP], byLabel(/Deal damage/));
    // His scheme against P2 placed a counter first, so P1's hero takes 3 and the counter comes off.
    expect(damageOf(run.state)).toBe(3);
    expect(charges(run.state)).toBe(charges(s));
    expect(damageOf(run.state, hero(run.state, P2))).toBe(0);
    expect(exhaustedBy(run.events, run.state)).toEqual([]);
  });
});

describe("Energy Overload 60084", () => {
  const WITH_ENERGY = ["01007", "01063", "01004", "01003", "01005"];
  const rigged = (codes: readonly string[], players = 1) => rigDeck(newGame(1, players), codes);
  /** Answers the nth Energy Overload choice (0-based) with the label it maps to. */
  const choosing = (...labels: RegExp[]): Picker => {
    let n = 0;
    return (s) => {
      const isChoice = labelled(s, /Discard that card|Stun a character/).length > 0;
      if (!isChoice) return declines(s);
      return labelled(s, labels[n++] ?? /Discard that card/).slice(0, 1);
    };
  };

  it("60084.when-revealed: with no card with a printed energy resource in hand, it gains surge", () => {
    const run = quietPhase(rigged(NO_ENERGY), [OVERLOAD, WHIPLASH]);
    expect(inst(run.state, idOf(run.state, WHIPLASH)).engagedWith).toBe(P1);
    expect(handCodes(run.state)).toHaveLength(5);
  });

  it("60084.when-revealed: a card whose only printed resource is [wild] is not an [energy] card: it still surges", () => {
    const run = quietPhase(wildAt(rigged(NO_ENERGY), 0), [OVERLOAD, WHIPLASH]);
    expect(handCodes(run.state)).toContain("01011");
    expect(inst(run.state, idOf(run.state, WHIPLASH)).engagedWith).toBe(P1);
  });

  it("60084.when-revealed: otherwise each such card is discarded (and it does not surge)", () => {
    const run = quietPhase(
      rigged(WITH_ENERGY),
      [OVERLOAD, WHIPLASH],
      choosing(/Discard that card/, /Discard that card/),
    );
    expect(handCodes(run.state)).toEqual(["01003", "01004", "01005"]);
    expect(inst(run.state, idOf(run.state, WHIPLASH)).engagedWith).toBeNull();
  });

  it("60084.when-revealed: or a character you control is stunned instead, that card kept (the other discarded)", () => {
    const s = rigged(WITH_ENERGY);
    const run = quietPhase(s, [OVERLOAD, WHIPLASH], choosing(/Stun a character/, /Discard that card/));
    expect(inst(run.state, hero(s)).statuses.stunned).toBe(1);
    const kept = handCodes(run.state).filter((c) => c === "01007" || c === "01063");
    expect(kept).toHaveLength(1);
    expect(handCodes(run.state)).toHaveLength(4);
  });

  it("60084.when-revealed: your hand only: the other player keeps theirs", () => {
    const s = rigged(WITH_ENERGY, 2);
    const before = handCodes(s, P2);
    const run = quietPhase(s, [OVERLOAD, CHARGING_UP], choosing(/Discard that card/, /Discard that card/));
    expect(handCodes(run.state, P2)).toEqual(before);
    expect(handCodes(run.state)).toEqual(["01003", "01004", "01005"]);
  });
});

describe("Shocking Revelation 60085", () => {
  /** P1's hand size in hero form: the end-of-turn draw takes this many cards before the milled ones. */
  const HAND = 5;
  const FILLER = NO_ENERGY.slice(0, HAND);
  const setup = (top: readonly string[], opts: { support?: boolean; players?: number } = {}) => {
    const s = newGame(1, opts.players ?? 1);
    const withSupport = opts.support ? stagedInPlay(s, "01006").state : s;
    return rigDeck(withSupport, [...FILLER, ...top]);
  };
  const discardCodes = (s: GameState): string[] => playerOf(s, P1).discard.map((i) => codeOf(s, i));
  const milled = (before: GameState, after: GameState) =>
    playerOf(after, P1)
      .discard.filter((i) => !playerOf(before, P1).discard.includes(i))
      .map((i) => codeOf(after, i));

  it("60085.when-revealed: discards 1 card from your deck per card you control (just your identity: 1)", () => {
    const s = setup(["01004", "01003"]);
    const run = quietPhase(s, [REVELATION]);
    expect(milled(s, run.state)).toContain("01004");
    expect(discardCodes(run.state)).not.toContain("01003");
  });

  it("60085.when-revealed: a milled card whose only printed resource is [wild] gives no choice", () => {
    const s = wildAt(setup(["01007", "01004"], { support: true }), HAND);
    let asked = 0;
    const run = quietPhase(s, [REVELATION], (st) => {
      if (labelled(st, /indirect damage/).length > 0) asked++;
      return declines(st);
    });
    expect(discardCodes(run.state)).toContain("01011");
    expect(asked).toBe(0);
    expect(damageOf(run.state)).toBe(0);
  });

  it("60085.when-revealed: encounter cards in your area (an engaged minion, Drained of Power on you) are not cards you control", () => {
    const s0 = setup(["01004", "01003", "01005"]);
    const dId = [...activeEncounterDeck(s0).deck].find((i) => codeOf(s0, i) === DRAINED)!;
    const host = hero(s0);
    const withDrained = patchInstance(patchInstance(s0, dId, { faceup: true, attachedTo: host }), host, {
      attachments: [...inst(s0, host).attachments, dId],
    });
    const s = engageMinion(withDrained, WHIPLASH, "whip");
    const run = quietPhase(s, [REVELATION]);
    // Only the identity counts: one card milled, not three.
    expect(milled(s, run.state)).toEqual(["01004"]);
  });

  it("60085.when-revealed: a support counts too (identity and Aunt May: 2 cards)", () => {
    const s = setup(["01004", "01003", "01005"], { support: true });
    const run = quietPhase(s, [REVELATION]);
    expect(milled(s, run.state)).toEqual(expect.arrayContaining(["01003", "01004"]));
    expect(discardCodes(run.state)).not.toContain("01005");
  });

  it("60085.when-revealed: each discarded card with a printed energy resource: take 1 indirect damage", () => {
    const s = setup(["01007", "01004"], { support: true });
    const run = quietPhase(s, [REVELATION], byLabel(/indirect damage/));
    expect(damageOf(run.state)).toBe(1);
    expect(charges(run.state)).toBe(charges(s));
  });

  it("60085.when-revealed: or place 1 charge counter on Electric Charge", () => {
    const s = setup(["01007", "01004"], { support: true });
    const run = quietPhase(s, [REVELATION], byLabel(/charge counter/));
    expect(charges(run.state)).toBe(charges(s) + 1);
    expect(damageOf(run.state)).toBe(0);
  });

  it("60085.when-revealed: a choice for each energy card, and none for the others", () => {
    const s = setup(["01007", "01063"], { support: true });
    let asked = 0;
    const pick: Picker = (st) => {
      if (labelled(st, /indirect damage/).length === 0) return declines(st);
      return labelled(st, asked++ === 0 ? /indirect damage/ : /charge counter/).slice(0, 1);
    };
    const run = quietPhase(s, [REVELATION], pick);
    expect(asked).toBe(2);
    expect(damageOf(run.state)).toBe(1);
    expect(charges(run.state)).toBe(charges(s) + 1);
    asked = 0;
    const none = quietPhase(setup(["01004", "01003"], { support: true }), [REVELATION], pick);
    expect(asked).toBe(0);
    expect(charges(none.state)).toBe(charges(s));
  });

  it("60085.when-revealed: your deck only, and your identity takes the damage", () => {
    const s = setup(["01007", "01004"], { players: 2 });
    const p2deck = playerOf(s, P2).deck.length;
    const run = quietPhase(s, [REVELATION, CHARGING_UP], byLabel(/indirect damage/));
    expect(playerOf(run.state, P2).deck.length).toBe(p2deck);
    expect(damageOf(run.state)).toBe(1);
    expect(damageOf(run.state, hero(run.state, P2))).toBe(0);
  });
});
