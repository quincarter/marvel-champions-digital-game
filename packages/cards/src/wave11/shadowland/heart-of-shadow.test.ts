import { cardId } from "@mc/content";
import type { GameEvent, GameState, InstanceId } from "@mc/engine";
import { activeEncounterDeck, createGame, hasKeyword } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../ability-refs.js";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  P2,
  applyOk,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  runWith,
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../testing/harness.js";
import { defeatWithAttack, driveEventsPicking, encounterCardInVillainArea, withForm } from "../../testing/staging.js";
import { attachToHost, handWith } from "../../wave6/mut_gen/project-wideawake-testing.js";
import { engageMinion } from "../../wave9/falcon/testing.js";
import { CAPTAIN_MARVEL, SPIDER_MAN } from "../../wave9/testing.js";
import { WAVE11_CARDS } from "../cards.js";
import { wave11Scenario } from "../setup.js";
import {
  ADVANCE,
  ASSAULT,
  DEPS,
  FILLER_A,
  FILLER_B,
  KRAHLLAK,
  byId,
  byLabel,
  corruption,
  idsOf,
  recording,
  shadowGame,
  withCorruption,
} from "./corruption.testing.js";
import {
  SHADOWLAND_HEART_OF_SHADOW as REGISTRY,
  SHADOWLAND_HEART_OF_SHADOW_SKIPPED as SKIPPED,
} from "./heart-of-shadow.js";

vi.setConfig({ testTimeout: 180_000 });

const MARK = "65064";
const PULL = "65065";
const HELLBRIDE = "65067";
const ELDERS = "65069";
const VEIL = "65070";
const SUBMIT = "65071";
const INVITATION = "65060a";
const CARDS = [KRAHLLAK, INVITATION, "65062", "65063", MARK, PULL, "65066", HELLBRIDE, "65068", ELDERS, VEIL, SUBMIT];
const REFS = [
  "65057.krahllak-interrupt",
  "65058.krahllak-constant",
  "65058.krahllak-interrupt",
  "65059.krahllak-constant",
  "65059.krahllak-interrupt",
  "65060a.setup",
  "65060b.dark-invitation-forced-interrupt",
  "65060b.dark-invitation-forced-response",
  "65061a.when-revealed",
  "65061b.beast-be-praised-forced-response",
  "65062.dark-shroud-interrupt",
  "65063.fear-projection-constant",
  "65063.fear-projection-action",
  "65063.fear-projection-alter-ego-action",
  "65066.fist-action",
  "65068.retainer-constant",
  "65068.retainer-interrupt",
  "65064.when-revealed",
  "65064.mark-of-the-wicked-forced-response",
  "65065.when-revealed",
  "65065.pull-of-power-forced-response",
  "65067.when-defeated",
  "65067.hellbride-action",
  "65069.snakeroot-elders-constant",
  "65069.when-revealed",
  "65070.veil-of-nightmares-action",
  "65071.when-revealed",
  "65071.boost",
];

const data = (code: string) => (WAVE11_CARDS as readonly any[]).find((c) => (c.id as string) === code)!;
const damage = (s: GameState, p = P1): number => inst(s, identityOf(s, p)).damage;
const statuses = (s: GameState, p = P1) => inst(s, identityOf(s, p)).statuses;
const alterEgoGame = (opts: Parameters<typeof shadowGame>[0] = {}) => shadowGame(opts);
const heroGame = (opts: Parameters<typeof shadowGame>[0] = {}) => withForm(shadowGame(opts), { heroForm: 0 });
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const twoHeroes = (opts: Parameters<typeof shadowGame>[0] = {}) =>
  withForm(heroGame({ seats: [SPIDER_MAN, CAPTAIN_MARVEL], ...opts }), { heroForm: 0 }, P2);
const encounterDiscard = (s: GameState): InstanceId[] => [...activeEncounterDeck(s).discard];

/** One villain phase from `state` (P1 ends the turn), the top of the encounter deck stacked as `cards`. */
function villainPhase(state: GameState, cards: readonly string[], pick = firstLegal) {
  return driveEventsPicking(DEPS, stackEncounterDeck(state, ...cards), pick, endTurn(P1));
}
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const basicAttack = (s: GameState, player = P1, target: InstanceId = villainOf(s)): GameState =>
  settle(
    runWith(DEPS, s, {
      type: "basicAttack",
      playerId: player,
      attackerInstanceId: identityOf(s, player),
      targetInstanceId: target,
    }),
    firstLegal,
    undefined,
    DEPS,
  );
const basicThwart = (s: GameState, player = P1): GameState =>
  settle(
    runWith(DEPS, s, {
      type: "basicThwart",
      playerId: player,
      thwarterInstanceId: identityOf(s, player),
      schemeInstanceId: s.mainScheme.instanceId,
    }),
    firstLegal,
    undefined,
    DEPS,
  );

describe("registry", () => {
  it("registers every printed ref of the twelve cards; nothing is skipped", () => {
    const printed = CARDS.flatMap((c) => abilityRefIds(data(c))).sort();
    expect(printed).toEqual([...REFS].sort());
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS].sort());
    expect(Object.keys(SKIPPED)).toEqual([]);
  });
  it.each(REFS)("%s validates", (ref) => {
    expect(validateDefinition(REGISTRY[ref]!), ref).toEqual([]);
  });
});

describe("Krahllak 65057", () => {
  const accept = byId("65057.krahllak-interrupt");
  const krahllak = (opts: Parameters<typeof shadowGame>[0] = {}) => heroGame({ villain: KRAHLLAK, ...opts });

  it("interrupt: placing a counter gives -3 ATK for this attack (3 ATK -> 0 damage); declining takes the full 3", () => {
    const taken = villainPhase(krahllak(), [ADVANCE, FILLER_A], accept);
    expect(corruption(taken.state)).toBe(1);
    expect(damage(taken.state)).toBe(0);
    const declined = villainPhase(krahllak(), [ADVANCE, FILLER_A]);
    expect(corruption(declined.state)).toBe(0);
    expect(damage(declined.state)).toBe(3);
  });

  it("interrupt: it is not offered to a player with no Creeping Corruption", () => {
    const log: Parameters<typeof recording>[1] = [];
    const run = villainPhase(krahllak({ corruption: false }), [ADVANCE, FILLER_A], recording(accept, log));
    expect(log.flatMap((l) => l.ids).some((id) => id.includes("65057"))).toBe(false);
    expect(damage(run.state)).toBe(3);
  });

  it("interrupt: the attacked player decides before a teammate declares a defender (insert FAQ p. 18)", () => {
    const log: Parameters<typeof recording>[1] = [];
    // P1 uses the interrupt, then P1 names P2's Captain Marvel as the defender; the -3 ATK is on the attack she defends.
    const pick = recording((s) => {
      const c = s.pendingChoice!;
      if (c.prompt.kind === "declareDefender") {
        const cap = c.options.find((o) => o.label === "Captain Marvel");
        return c.playerId === P1 && cap ? [cap.optionId] : ["decline"];
      }
      return accept(s);
    }, log);
    const start = twoHeroes({ villain: KRAHLLAK });
    const run = driveEventsPicking(
      DEPS,
      stackEncounterDeck(start, ADVANCE, FILLER_A, FILLER_B),
      pick,
      endTurn(P1),
      endTurn(P2),
    );
    const interruptAt = log.findIndex((l) => l.kind === "chooseTriggers" && l.ids.some((id) => id.includes("65057")));
    const defenderAt = log.findIndex((l) => l.kind === "declareDefender");
    expect(interruptAt).toBeGreaterThanOrEqual(0);
    expect(interruptAt).toBeLessThan(defenderAt);
    expect(log[interruptAt]!.player).toBe(P1);
    const defended = ofType(run.events, "attackResolved")[0]!;
    expect(defended.targetInstanceId).toBe(identityOf(run.state, P2));
    expect(defended.baseAtk).toBe(0);
    expect(defended.damageDealt).toBe(0);
    // Control: no interrupt, Captain Marvel defending the same attack takes the 3.
    const control = driveEventsPicking(
      DEPS,
      stackEncounterDeck(start, ADVANCE, FILLER_A, FILLER_B),
      (s) => {
        const c = s.pendingChoice!;
        const cap = c.options.find((o) => o.label === "Captain Marvel");
        return c.prompt.kind === "declareDefender" && c.playerId === P1 && cap ? [cap.optionId] : firstLegal(s);
      },
      endTurn(P1),
      endTurn(P2),
    );
    const controlAttack = ofType(control.events, "attackResolved")[0]!;
    expect(controlAttack.targetInstanceId).toBe(identityOf(control.state, P2));
    expect(controlAttack.baseAtk).toBe(3);
    expect(controlAttack.damageDealt).toBeGreaterThan(0);
  });
});

describe("Mark of the Wicked 65064", () => {
  it("when revealed: attach it to your identity (no damage, no status, no counter change)", () => {
    const s = withCorruption(alterEgoGame({ encounter: [MARK] }), 2);
    const run = villainPhase(s, [ADVANCE, MARK], byLabel(/^Attach/));
    const mark = idsOf(run.state, MARK)[0]!;
    expect(inst(run.state, mark).attachedTo).toBe(identityOf(run.state));
    expect(damage(run.state)).toBe(0);
    expect(corruption(run.state)).toBe(2);
  });

  it("when revealed: if you do not, take 4 damage, stun, remove 1 counter and discard it", () => {
    const s = withCorruption(alterEgoGame({ encounter: [MARK] }), 2);
    const run = villainPhase(s, [ADVANCE, MARK], byLabel(/^Take 4/));
    const mark = idsOf(run.state, MARK)[0]!;
    expect(inst(run.state, mark).attachedTo).toBeNull();
    expect(damage(run.state)).toBe(4);
    expect(statuses(run.state).stunned).toBe(1);
    expect(corruption(run.state)).toBe(1);
    expect(encounterDiscard(run.state)).toContain(mark);
  });

  it("forced response: after the attached hero's basic attack its player places a counter; a basic thwart does not", () => {
    const attached = villainPhase(alterEgoGame({ encounter: [MARK] }), [ADVANCE, MARK], byLabel(/^Attach/)).state;
    const inHero = withForm(attached, { heroForm: 0 });
    expect(corruption(basicAttack(inHero))).toBe(1);
    expect(corruption(basicThwart(inHero))).toBe(0);
  });

  it("forced response: the counter goes on the attached hero's player's Creeping Corruption, not another player's", () => {
    // P1 is dealt a filler, P2 the Mark; P2's hero attacks on P2's turn.
    const start = alterEgoGame({ seats: [SPIDER_MAN, CAPTAIN_MARVEL], encounter: [MARK] });
    const attached = driveEventsPicking(
      DEPS,
      stackEncounterDeck(start, ADVANCE, ASSAULT, FILLER_A, MARK),
      (s) => (s.pendingChoice!.prompt.kind === "declareDefender" ? ["decline"] : byLabel(/^Attach/)(s)),
      endTurn(P1),
      endTurn(P2),
    );
    const mark = idsOf(attached.state, MARK)[0]!;
    expect(inst(attached.state, mark).attachedTo).toBe(identityOf(attached.state, P2));
    // Round 2 opens with P2 (the first player passes on); their hero attacks.
    const afterP1 = attached.state;
    expect(afterP1.step.phase).toBe("player");
    const attack = basicAttack(withForm(afterP1, { heroForm: 0 }, P2), P2);
    expect(corruption(attack, P2)).toBe(1);
    expect(corruption(attack, P1)).toBe(0);
  });
});

describe("Pull of Power 65065", () => {
  it("when revealed: attach it to your identity", () => {
    const run = villainPhase(
      withCorruption(alterEgoGame({ encounter: [PULL] }), 2),
      [ADVANCE, PULL],
      byLabel(/^Attach/),
    );
    const pull = idsOf(run.state, PULL)[0]!;
    expect(inst(run.state, pull).attachedTo).toBe(identityOf(run.state));
    expect(damage(run.state)).toBe(0);
    expect(corruption(run.state)).toBe(2);
  });

  it("when revealed: if you do not, take 4 damage, confuse, remove 1 counter and discard it", () => {
    const run = villainPhase(
      withCorruption(alterEgoGame({ encounter: [PULL] }), 2),
      [ADVANCE, PULL],
      byLabel(/^Take 4/),
    );
    expect(damage(run.state)).toBe(4);
    expect(statuses(run.state).confused).toBe(1);
    expect(statuses(run.state).stunned).toBe(0);
    expect(corruption(run.state)).toBe(1);
    expect(encounterDiscard(run.state)).toContain(idsOf(run.state, PULL)[0]!);
  });

  it("forced response: after the attached hero's basic thwart a counter is placed; a basic attack does not", () => {
    const attached = villainPhase(alterEgoGame({ encounter: [PULL] }), [ADVANCE, PULL], byLabel(/^Attach/)).state;
    const inHero = withForm(attached, { heroForm: 0 });
    expect(corruption(basicThwart(inHero))).toBe(1);
    expect(corruption(basicAttack(inHero))).toBe(0);
  });
});

describe("Hellbride 65067", () => {
  const hellbride = (s: GameState, player = P1) => engageMinion(s, HELLBRIDE, "hb", player);
  const hb = "hb" as InstanceId;

  it("when defeated: the defeating player places 2 counters and heals 6 from their identity", () => {
    const s = patchInstance(hellbride(heroGame()), identityOf(heroGame()), { damage: 8 });
    const after = defeatWithAttack(DEPS, s, hb, P1);
    expect(encounterDiscard(after)).toContain(hb);
    expect(corruption(after)).toBe(2);
    expect(damage(after)).toBe(2);
  });

  it('when defeated: with no Creeping Corruption to place the counters on, the "then" healing does not happen', () => {
    const g = heroGame({ corruption: false });
    const s = patchInstance(hellbride(g), identityOf(g), { damage: 8 });
    const after = defeatWithAttack(DEPS, s, hb, P1);
    expect(encounterDiscard(after)).toContain(hb);
    expect(damage(after)).toBe(8);
  });

  it("when defeated: a teammate who defeats her (not the engaged player) is the one who places and heals", () => {
    const s0 = twoHeroes();
    const s1 = patchInstance(patchInstance(hellbride(s0, P1), identityOf(s0, P1), { damage: 8 }), identityOf(s0, P2), {
      damage: 7,
    });
    // P1 ends the turn; it is P2's turn when P2 attacks her.
    const p2Turn = settle(runWith(DEPS, s1, endTurn(P1)), firstLegal, undefined, DEPS);
    expect(p2Turn.step.phase).toBe("player");
    const after = defeatWithAttack(DEPS, p2Turn, hb, P2);
    expect(corruption(after, P2)).toBe(2);
    expect(damage(after, P2)).toBe(1);
    expect(corruption(after, P1)).toBe(0);
    expect(damage(after, P1)).toBe(8);
  });

  it("hero action: with 2 or fewer remaining hit points, exhaust your hero to discard her and remove 1 counter", () => {
    const s = withCorruption(patchInstance(hellbride(heroGame()), "hb" as InstanceId, { damage: 5 }), 2);
    const after = settle(runWith(DEPS, s, use(P1, hb, "65067.hellbride-action")), firstLegal, undefined, DEPS);
    expect(inst(after, identityOf(after)).exhausted).toBe(true);
    expect(encounterDiscard(after)).toContain(hb);
    // Removed 1; not defeated, so no When Defeated (no 2 counters, no healing).
    expect(corruption(after)).toBe(1);
  });

  it("hero action: with 3 remaining hit points it cannot be used", () => {
    const s = withCorruption(patchInstance(hellbride(heroGame()), "hb" as InstanceId, { damage: 4 }), 2);
    expect(applyCommandOk(s, use(P1, hb, "65067.hellbride-action"))).toBe(false);
    const ready = patchInstance(s, hb, { damage: 5 });
    expect(applyCommandOk(ready, use(P1, hb, "65067.hellbride-action"))).toBe(true);
  });
});

/** Whether `command` is accepted (the state is not used). */
function applyCommandOk(state: GameState, command: Parameters<typeof applyOk>[1]): boolean {
  try {
    applyOk(state, command, DEPS);
    return true;
  } catch {
    return false;
  }
}

describe("Snakeroot Elders 65069", () => {
  const elders = (s: GameState) => engageMinion(s, ELDERS, "el");
  const el = "el" as InstanceId;
  const has = (s: GameState, k: "guard" | "patrol") => hasKeyword(s, el, k, DEPS);

  it("constant: guard and patrol only while a corruption counter is here", () => {
    const bare = elders(heroGame());
    expect(has(bare, "guard")).toBe(false);
    expect(has(bare, "patrol")).toBe(false);
    const marked = patchInstance(bare, el, { counters: { corruption: 1 } });
    expect(has(marked, "guard")).toBe(true);
    expect(has(marked, "patrol")).toBe(true);
  });

  it("when revealed: place a counter on your Creeping Corruption (none here)", () => {
    const run = villainPhase(
      alterEgoGame({ encounter: [ELDERS] }),
      [ADVANCE, ELDERS],
      byLabel(/on your Creeping Corruption/),
    );
    const id = idsOf(run.state, ELDERS)[0]!;
    expect(corruption(run.state)).toBe(1);
    expect(inst(run.state, id).counters["corruption"] ?? 0).toBe(0);
  });

  it("when revealed: if you do not, the counter goes on her", () => {
    const run = villainPhase(alterEgoGame({ encounter: [ELDERS] }), [ADVANCE, ELDERS], byLabel(/counter here/));
    const id = idsOf(run.state, ELDERS)[0]!;
    expect(corruption(run.state)).toBe(0);
    expect(inst(run.state, id).counters["corruption"]).toBe(1);
  });

  it("when revealed: with no Creeping Corruption the counter goes on her without a choice", () => {
    const log: Parameters<typeof recording>[1] = [];
    const run = villainPhase(
      alterEgoGame({ corruption: false, encounter: [ELDERS] }),
      [ADVANCE, ELDERS],
      recording(firstLegal, log),
    );
    expect(log.some((l) => l.kind === "chooseOption")).toBe(false);
    expect(inst(run.state, idsOf(run.state, ELDERS)[0]!).counters["corruption"]).toBe(1);
  });
});

describe("Veil of Nightmares 65070", () => {
  const ACTION = "65070.veil-of-nightmares-action";
  function veil(threat: number, opts: Parameters<typeof shadowGame>[0] = {}) {
    const placed = encounterCardInVillainArea(heroGame({ encounter: [VEIL], ...opts }), VEIL, threat);
    return placed;
  }

  it("hero action: places 1 counter and removes 5 threat from this scheme", () => {
    const { state, id } = veil(7);
    const after = settle(runWith(DEPS, state, use(P1, id, ACTION)), firstLegal, undefined, DEPS);
    expect(corruption(after)).toBe(1);
    expect(inst(after, id).threat).toBe(2);
  });

  it("hero action: removes only the threat there is", () => {
    const { state, id } = veil(3);
    expect(inst(settle(runWith(DEPS, state, use(P1, id, ACTION)), firstLegal, undefined, DEPS), id).threat).toBe(0);
  });

  it("hero action: it cannot be used without a Creeping Corruption to place the counter on", () => {
    const { state, id } = veil(7, { corruption: false });
    expect(applyCommandOk(state, use(P1, id, ACTION))).toBe(false);
    const withCc = veil(7);
    expect(applyCommandOk(withCc.state, use(P1, withCc.id, ACTION))).toBe(true);
  });
});

describe("Submit or Suffer 65071", () => {
  const krahllak = (opts: Parameters<typeof shadowGame>[0] = {}) =>
    alterEgoGame({ villain: KRAHLLAK, encounter: [SUBMIT], ...opts });
  const place = /^Place 1 corruption counter/;
  const remove = /^Remove 1 corruption counter/;

  it("when revealed: place a counter on your Creeping Corruption", () => {
    const run = villainPhase(withCorruption(krahllak(), 1), [ADVANCE, SUBMIT], byLabel(place));
    expect(corruption(run.state)).toBe(2);
    expect(damage(run.state)).toBe(0);
  });

  it("when revealed: or remove one, and Krahllak attacks you", () => {
    const run = villainPhase(withCorruption(krahllak(), 1), [ADVANCE, SUBMIT, ASSAULT], byLabel(remove));
    expect(corruption(run.state)).toBe(0);
    // Krahllak's 3 ATK, no boost icon: the only attack of a villain phase in which he schemed.
    expect(damage(run.state)).toBe(3);
    expect(ofType(run.events, "attackResolved").map((e) => e.enemyInstanceId)).toEqual([villainOf(run.state)]);
  });

  // Owner decision 2026-10-20 (A), reversing Q8: RRG 1.8 "Choose (Option)" (p. 12) bars an encounter card's option only
  // when it needs a target and has no valid one; the Creeping Corruption is the target, and it holds no counter.
  it("when revealed: with no counter to remove, the remove option is still offered and Krahllak attacks you", () => {
    const run = villainPhase(krahllak(), [ADVANCE, SUBMIT, ASSAULT], byLabel(remove));
    expect(corruption(run.state)).toBe(0);
    expect(damage(run.state)).toBe(3);
    expect(ofType(run.events, "attackResolved").map((e) => e.enemyInstanceId)).toEqual([villainOf(run.state)]);
  });

  it("when revealed: with no Creeping Corruption nothing is offered and nothing happens", () => {
    const log: Parameters<typeof recording>[1] = [];
    const run = villainPhase(krahllak({ corruption: false }), [ADVANCE, SUBMIT], recording(byLabel(remove), log));
    expect(log.some((l) => l.kind === "chooseOption")).toBe(false);
    expect(damage(run.state)).toBe(0);
  });

  it("boost: the stun option is not offered to an identity that is already stunned (RRG 1.8 p. 12, p. 42)", () => {
    const base = heroGame({ villain: KRAHLLAK, encounter: [SUBMIT] });
    const hero = patchInstance(base, identityOf(base), { statuses: { stunned: 1, confused: 0, tough: 0 } });
    const labels: string[] = [];
    const run = villainPhase(hero, [SUBMIT, FILLER_A], (s) => {
      if (s.pendingChoice?.prompt.kind === "chooseOption") labels.push(...s.pendingChoice.options.map((o) => o.label));
      return firstLegal(s);
    });
    expect(labels.some((l) => l.startsWith("Stun"))).toBe(false);
    // The one option left resolves on its own.
    expect(corruption(run.state)).toBe(1);
  });

  it("boost: the defending player places a counter, or has their identity stunned", () => {
    const hero = () => heroGame({ villain: KRAHLLAK, encounter: [SUBMIT] });
    const placed = villainPhase(hero(), [SUBMIT, FILLER_A], byLabel(place));
    expect(corruption(placed.state)).toBe(1);
    expect(statuses(placed.state).stunned).toBe(0);
    const stunned = villainPhase(hero(), [SUBMIT, FILLER_A], byLabel(/^Stun/));
    expect(corruption(stunned.state)).toBe(0);
    expect(statuses(stunned.state).stunned).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Krahllak II and III, Retainer, Fist, Dark Shroud, Fear Projection
// ---------------------------------------------------------------------------------------------------------------------

const FIST = "65066";
const RETAINER = "65068";
const SHROUD = "65062";
const FEAR = "65063";
const plainStatuses = { stunned: 0, confused: 0, tough: 0 };
const typeOf = (s: GameState, id: InstanceId): string => (s.cardPool[inst(s, id).cardId] as { type: string }).type;
const playerOf = (s: GameState, p = P1) => s.players.find((x) => x.playerId === p)!;

/** Krahllak on stage index `stage` (0 = I, 1 = II, 2 = III) of a Rhino-scheme game, the hero in hero form. */
function krahllakAt(stage: number, opts: Parameters<typeof shadowGame>[0] = {}): GameState {
  const base = heroGame({ villain: KRAHLLAK, ...opts });
  return { ...base, villains: base.villains.map((v) => ({ ...v, stageIndex: stage, lastStageIndex: 2 })) };
}
const damageToHero = (events: readonly GameEvent[], hero: InstanceId): number[] =>
  events.flatMap((e) => (e.type === "damageDealt" && e.targetInstanceId === hero ? [e.amount] : []));

/** `player`'s first deck ally put into play with 1 hit point left. */
function withWoundedAlly(state: GameState, player = P1): { state: GameState; ally: InstanceId } {
  const ally = playerOf(state, player).deck.find((i) => typeOf(state, i) === "ally")!;
  let staged: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player ? { ...p, deck: p.deck.filter((i) => i !== ally), playArea: [...p.playArea, ally] } : p,
    ),
  };
  staged = patchInstance(staged, ally, { faceup: true, controllerId: player, exhausted: false });
  const hp = (staged.cardPool[inst(staged, ally).cardId] as unknown as { hp: number }).hp;
  return { state: patchInstance(staged, ally, { damage: hp - 1 }), ally };
}
/** Declares `ally` as defender whenever it is offered (and for `only`, when given, that enemy's attack only). */
const defendWith =
  (ally: InstanceId, only?: InstanceId): Picker =>
  (s) => {
    const c = s.pendingChoice!;
    if (c.prompt.kind !== "declareDefender") return firstLegal(s);
    const forEnemy =
      only === undefined || (c.prompt as { attack: { enemyInstanceId: InstanceId } }).attack.enemyInstanceId === only;
    return forEnemy && c.options.some((o) => o.optionId === ally) ? [ally] : ["decline"];
  };

describe("Krahllak II and III 65058 / 65059", () => {
  it("II: his attacks gain overkill: the damage past a defending ally goes to the hero", () => {
    const staged = withWoundedAlly(krahllakAt(1));
    const run = villainPhase(staged.state, [ADVANCE, FILLER_A], defendWith(staged.ally));
    // 4 ATK against an ally with 1 hit point left: 3 past it.
    expect(ofType(run.events, "attackResolved")[0]!.damageDealt).toBe(4);
    expect(damageToHero(run.events, identityOf(run.state))).toEqual([3]);
  });

  it("I (control): without overkill the defending ally absorbs the whole attack", () => {
    const staged = withWoundedAlly(krahllakAt(0));
    const run = villainPhase(staged.state, [ADVANCE, FILLER_A], defendWith(staged.ally));
    expect(damageToHero(run.events, identityOf(run.state))).toEqual([]);
  });

  it("III: his attacks also gain piercing (a tough status card is discarded, the damage is dealt); II's do not", () => {
    const toughen = (s: GameState) => patchInstance(s, identityOf(s), { statuses: { ...plainStatuses, tough: 1 } });
    const iii = villainPhase(toughen(krahllakAt(2)), [ADVANCE, FILLER_A]);
    expect(statuses(iii.state).tough).toBe(0);
    expect(damage(iii.state)).toBe(4);
    const ii = villainPhase(toughen(krahllakAt(1)), [ADVANCE, FILLER_A]);
    expect(statuses(ii.state).tough).toBe(0);
    expect(damage(ii.state)).toBe(0);
  });

  it.each([1, 2])("stage index %s: the corruption interrupt gives -3 ATK once a counter is placed", (stage) => {
    const run = villainPhase(krahllakAt(stage), [ADVANCE, FILLER_A], byId("krahllak-interrupt"));
    expect(corruption(run.state)).toBe(1);
    // 4 ATK - 3.
    expect(damage(run.state)).toBe(1);
  });
});

describe("Retainer 65068", () => {
  const rt = "rt" as InstanceId;
  const retainer = (s: GameState) => engageMinion(s, RETAINER, "rt");
  const retainerHit = (events: readonly GameEvent[]) =>
    ofType(events, "attackResolved").find((e) => e.enemyInstanceId === rt)!;

  it("constant: its attacks gain overkill (a defending ally's 1 hit point leaves 3 of its 4 ATK for the hero)", () => {
    const staged = withWoundedAlly(heroGame());
    const run = villainPhase(retainer(staged.state), [ADVANCE, FILLER_A, FILLER_B], defendWith(staged.ally, rt));
    expect(retainerHit(run.events).baseAtk).toBe(4);
    expect(damageToHero(run.events, identityOf(run.state))).toContain(3);
  });

  it("interrupt: placing a counter gives -3 ATK for this attack; declining takes the full 4", () => {
    const placed = villainPhase(retainer(heroGame()), [ADVANCE, FILLER_A, FILLER_B], byId("65068.retainer-interrupt"));
    expect(retainerHit(placed.events).baseAtk).toBe(1);
    expect(corruption(placed.state)).toBe(1);
    const declined = villainPhase(retainer(heroGame()), [ADVANCE, FILLER_A, FILLER_B]);
    expect(retainerHit(declined.events).baseAtk).toBe(4);
    expect(corruption(declined.state)).toBe(0);
  });
});

describe("Fist 65066", () => {
  const ACTION = "65066.fist-action";
  const fi = "fi" as InstanceId;
  const fist = (s: GameState) => engageMinion(s, FIST, "fi");
  const useFist = (s: GameState) => settle(runWith(DEPS, s, use(P1, fi, ACTION)), firstLegal, undefined, DEPS);

  it("hero action: place 1 counter on your Creeping Corruption, then deal 4 damage to Fist", () => {
    const after = useFist(fist(heroGame()));
    expect(corruption(after)).toBe(1);
    expect(inst(after, fi).damage).toBe(4);
  });

  it("hero action: it cannot be used without a Creeping Corruption to place the counter on", () => {
    expect(applyCommandOk(fist(heroGame({ corruption: false })), use(P1, fi, ACTION))).toBe(false);
  });

  it("hero action: 4 damage does not defeat her 6 hit points; a second use does (Patrol and Retaliate 2 are data)", () => {
    const once = useFist(fist(heroGame()));
    expect(encounterDiscard(once)).not.toContain(fi);
    const twice = useFist(once);
    expect(corruption(twice)).toBe(2);
    expect(encounterDiscard(twice)).toContain(fi);
  });
});

describe("Fear Projection 65063", () => {
  const ref = (kind: string) => `65063.fear-projection-${kind}`;
  /** Fear Projection attached to Krahllak, the hero in the given form. */
  function attachedFear(form: "hero" | "alterEgo", opts: Parameters<typeof shadowGame>[0] = {}) {
    const game =
      form === "hero"
        ? heroGame({ villain: KRAHLLAK, encounter: [FEAR], ...opts })
        : alterEgoGame({ villain: KRAHLLAK, encounter: [FEAR], ...opts });
    return { ...attachToHost(game, FEAR, villainOf(game)), villain: villainOf(game) };
  }

  it("constant: Krahllak gains retaliate 1 while it is attached", () => {
    const { state, villain } = attachedFear("hero");
    expect(hasKeyword(state, villain, "retaliate", DEPS)).toBe(true);
    const bare = heroGame({ villain: KRAHLLAK });
    expect(hasKeyword(bare, villainOf(bare), "retaliate", DEPS)).toBe(false);
  });

  it("hero action: place 2 counters on your Creeping Corruption, then discard this card", () => {
    const { state, id } = attachedFear("hero");
    const after = settle(runWith(DEPS, state, use(P1, id, ref("action"))), firstLegal, undefined, DEPS);
    expect(corruption(after)).toBe(2);
    expect(encounterDiscard(after)).toContain(id);
  });

  it("hero action: it cannot be used without a Creeping Corruption, nor in alter-ego form", () => {
    const none = attachedFear("hero", { corruption: false });
    expect(applyCommandOk(none.state, use(P1, none.id, ref("action")))).toBe(false);
    const ego = attachedFear("alterEgo");
    expect(applyCommandOk(ego.state, use(P1, ego.id, ref("action")))).toBe(false);
  });

  it("alter-ego action: spend 3 [mental], discard this card and remove 1 counter", () => {
    const { state, id } = attachedFear("alterEgo");
    const { state: stocked, ids } = handWith(withCorruption(state, 2), P1, "mental", 3);
    const after = settle(
      runWith(
        DEPS,
        stocked,
        use(
          P1,
          id,
          ref("alter-ego-action"),
          ids.map((fromHand) => ({ fromHand })),
        ),
      ),
      firstLegal,
      undefined,
      DEPS,
    );
    expect(encounterDiscard(after)).toContain(id);
    expect(corruption(after)).toBe(1);
  });

  it("alter-ego action: three [mental] are required, and it is not usable in hero form", () => {
    const { state, id } = attachedFear("alterEgo");
    const { state: stocked, ids } = handWith(withCorruption(state, 2), P1, "mental", 2);
    expect(
      applyCommandOk(
        stocked,
        use(
          P1,
          id,
          ref("alter-ego-action"),
          ids.map((fromHand) => ({ fromHand })),
        ),
      ),
    ).toBe(false);
    const hero = attachedFear("hero");
    const { state: heroStocked, ids: heroIds } = handWith(hero.state, P1, "mental", 3);
    expect(
      applyCommandOk(
        heroStocked,
        use(
          P1,
          hero.id,
          ref("alter-ego-action"),
          heroIds.map((fromHand) => ({ fromHand })),
        ),
      ),
    ).toBe(false);
  });
});

describe("Dark Shroud 65062", () => {
  const REF = "65062.dark-shroud-interrupt";
  /** The hero's printed ATK set to `atk` (test surgery on the card pool: the attack then deals that much). */
  const withHeroAtk = (s: GameState, atk: number): GameState => {
    const id = inst(s, identityOf(s)).cardId;
    const card = s.cardPool[id] as unknown as { hero: object };
    return { ...s, cardPool: { ...s.cardPool, [id]: { ...card, hero: { ...card.hero, atk } } } } as GameState;
  };
  function shrouded(atk: number, opts: Parameters<typeof shadowGame>[0] = {}) {
    const game = withHeroAtk(heroGame({ villain: KRAHLLAK, encounter: [SHROUD], ...opts }), atk);
    return { ...attachToHost(game, SHROUD, villainOf(game)), villain: villainOf(game) };
  }
  const hit = (s: GameState, pick: Picker = firstLegal): GameState =>
    settle(
      runWith(DEPS, s, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identityOf(s),
        targetInstanceId: villainOf(s),
      }),
      pick,
      undefined,
      DEPS,
    );

  it("interrupt: an attack of 4 or more damage is prevented, a counter is placed and the card is discarded", () => {
    const { state, id, villain } = shrouded(4);
    const after = hit(state, byId(REF));
    expect(inst(after, villain).damage).toBe(0);
    expect(corruption(after)).toBe(1);
    expect(encounterDiscard(after)).toContain(id);
  });

  it("interrupt: it is optional: declined, the damage is dealt and the card stays", () => {
    const { state, id, villain } = shrouded(4);
    const after = hit(state);
    expect(inst(after, villain).damage).toBe(4);
    expect(corruption(after)).toBe(0);
    expect(inst(after, id).attachedTo).toBe(villain);
  });

  it("interrupt: an attack of 3 damage does not trigger it (the control)", () => {
    const { state, id, villain } = shrouded(3);
    const log: Parameters<typeof recording>[1] = [];
    const after = hit(state, recording(byId(REF), log));
    expect(log.flatMap((l) => l.ids).some((i) => i.includes("65062"))).toBe(false);
    expect(inst(after, villain).damage).toBe(3);
    expect(inst(after, id).attachedTo).toBe(villain);
  });
});

describe("Dark Shroud 65062: whose counter", () => {
  it("the counter goes on the Creeping Corruption of the player who dealt the damage", () => {
    const start = shadowGame({ seats: [SPIDER_MAN, CAPTAIN_MARVEL], villain: KRAHLLAK, encounter: [SHROUD] });
    const base = withForm(withForm(start, { heroForm: 0 }), { heroForm: 0 }, P2);
    const id = inst(base, identityOf(base, P2)).cardId;
    const card = base.cardPool[id] as unknown as { hero: object };
    const boosted = {
      ...base,
      cardPool: { ...base.cardPool, [id]: { ...card, hero: { ...card.hero, atk: 4 } } },
    } as GameState;
    const { state } = attachToHost(boosted, SHROUD, villainOf(boosted));
    // P1 ends the turn, so P2 attacks on P2's turn (the first player passes on after the villain phase is skipped here).
    const p2Turn = settle(runWith(DEPS, state, endTurn(P1)), firstLegal, undefined, DEPS);
    expect(p2Turn.step.phase).toBe("player");
    const after = settle(
      runWith(DEPS, p2Turn, {
        type: "basicAttack",
        playerId: P2,
        attackerInstanceId: identityOf(p2Turn, P2),
        targetInstanceId: villainOf(p2Turn),
      }),
      byId("65062.dark-shroud-interrupt"),
      undefined,
      DEPS,
    );
    expect(corruption(after, P2)).toBe(1);
    expect(corruption(after, P1)).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Dark Invitation (main scheme 65060a: 1A/1B, 2A/2B), built through the real Heart of Shadow scenario
// ---------------------------------------------------------------------------------------------------------------------

const CC_CARD = "65072a";
/**
 * The Heart of Shadow scenario (Krahllak I, Dark Invitation 1B, standard mode unless `expert`) past setup, built by
 * `wave11Scenario`: its 1A Setup attaches one Creeping Corruption to each identity. Blank cards are added to the encounter
 * deck for the stacked villain phases.
 */
function invitation(opts: { seats?: readonly { starterDeckId: string }[]; expert?: boolean } = {}): GameState {
  const seats = opts.seats ?? [SPIDER_MAN];
  const base = wave11Scenario("heart-of-shadow", {
    players: seats,
    seed: 1,
    difficulty: opts.expert ? "expert" : "standard",
    modularSetIds: ["ninja_swarm"],
  } as never);
  const created = createGame(
    {
      ...base,
      // Core Rhino attachments that touch no player.
      encounterDeck: [...base.encounterDeck, ...[FILLER_A, FILLER_B, FILLER_A, FILLER_B].map((c) => cardId(c))],
    },
    DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}
const mainScheme = (s: GameState): InstanceId => s.mainScheme.instanceId;
/** The main scheme's stage number (1 or 2) as the card shows it. */
const stageNumberOf = (s: GameState): number => s.mainScheme.stageIndex + 1;
const ccIn = (s: GameState, p = P1): InstanceId[] =>
  idsOf(s, CC_CARD).filter((i) => inst(s, i).controllerId === p && !s.encounterSetAside.includes(i));
const asideCc = (s: GameState): InstanceId[] =>
  s.encounterSetAside.filter((i) => (inst(s, i).cardId as string) === CC_CARD);
const both = [SPIDER_MAN, CAPTAIN_MARVEL];
/** Each player's own pick, by label pattern, for `chooseOption` prompts (others `firstLegal`). */
const choosing =
  (picks: Partial<Record<string, RegExp>>): Picker =>
  (s) => {
    const c = s.pendingChoice!;
    const want = picks[c.playerId];
    const hit = want && c.prompt.kind === "chooseOption" ? c.options.find((o) => want.test(o.label)) : undefined;
    return hit ? [hit.optionId] : firstLegal(s);
  };
/** Krahllak's Toughness status card removed, so one attack can defeat him. */
const untoughened = (s: GameState): GameState =>
  patchInstance(s, villainOf(s), { statuses: { ...inst(s, villainOf(s)).statuses, tough: 0 } });
const bothHeroes = (s: GameState): GameState => withForm(withForm(s, { heroForm: 0 }), { heroForm: 0 }, P2);

describe("Dark Invitation 1A (65060a.setup)", () => {
  it.each([1, 2])("each of %s player(s) has exactly one Creeping Corruption, and the rest are set aside", (n) => {
    const s = invitation({ seats: both.slice(0, n) });
    for (const p of [P1, P2].slice(0, n)) {
      expect(ccIn(s, p)).toHaveLength(1);
      expect(inst(s, ccIn(s, p)[0]!).attachedTo).toBe(identityOf(s, p));
    }
    expect(asideCc(s)).toHaveLength(4 - n);
    expect(stageNumberOf(s)).toBe(1);
  });
});

describe("Dark Invitation 1B interrupt (65060b.dark-invitation-forced-interrupt)", () => {
  // The facedown card the interrupt deals comes off the top first, then the boost card and one card per player.
  const FILLERS = [ADVANCE, FILLER_A, FILLER_B, FILLER_A];
  /** A villain phase in which step 1 completes stage 1B. */
  function completing(state: GameState, pick: Picker) {
    const staged = patchInstance(state, mainScheme(state), { threat: 999 });
    return driveEventsPicking(DEPS, stackEncounterDeck(staged, ...FILLERS), pick, endTurn(P1), endTurn(P2));
  }

  it("instead of completing: all threat is removed, the stage stays 1B, and each player chooses", () => {
    const run = completing(
      invitation({ seats: both }),
      choosing({ [P1]: /^Place 2 corruption/, [P2]: /^Take 3 damage/ }),
    );
    expect(stageNumberOf(run.state)).toBe(1);
    // All of the threat (the 999 staged plus step one's) is removed, and the stage is never completed.
    const removed = ofType(run.events, "threatRemoved").filter((e) => e.schemeInstanceId === mainScheme(run.state));
    expect(removed.some((e) => e.amount >= 999)).toBe(true);
    expect(ofType(run.events, "mainSchemeCompleted")).toHaveLength(0);
    expect(inst(run.state, mainScheme(run.state)).threat).toBeLessThan(999);
    // P1 placed 2 counters; P2 took 3 damage and was dealt a facedown card of their own.
    expect(corruption(run.state, P1)).toBe(2);
    expect(corruption(run.state, P2)).toBe(0);
    expect(damage(run.state, P1)).toBe(0);
    expect(damage(run.state, P2)).toBe(3);
    const ability = ofType(run.events, "encounterCardDealt").filter((e) => e.source === "ability");
    expect(ability.map((e) => e.playerId)).toEqual([P2]);
  });

  it("the other way round: P1 takes the damage and card, P2 places the counter", () => {
    const run = completing(
      invitation({ seats: both }),
      choosing({ [P1]: /^Take 3 damage/, [P2]: /^Place 2 corruption/ }),
    );
    expect(corruption(run.state, P2)).toBe(2);
    expect(corruption(run.state, P1)).toBe(0);
    expect(
      ofType(run.events, "encounterCardDealt")
        .filter((e) => e.source === "ability")
        .map((e) => e.playerId),
    ).toEqual([P1]);
  });

  it("a player with no Creeping Corruption is not offered the counter", () => {
    const s = invitation({ seats: both });
    const cc = ccIn(s, P2)[0]!;
    const identity = identityOf(s, P2);
    const noneForP2 = patchInstance(
      patchInstance(s, identity, { attachments: inst(s, identity).attachments.filter((i) => i !== cc) }),
      cc,
      { attachedTo: null, controllerId: null },
    );
    const log: Parameters<typeof recording>[1] = [];
    completing(noneForP2, recording(choosing({ [P1]: /^Place 2 corruption/ }), log));
    const optionsFor = (player: string) => log.filter((l) => l.kind === "chooseOption" && l.player === player);
    expect(optionsFor(P1).length).toBeGreaterThan(0);
    // P2 has the one option left (the damage), which resolves without a prompt.
    expect(optionsFor(P2)).toHaveLength(0);
  });
});

describe("Dark Invitation 1B response (65060b.dark-invitation-forced-response)", () => {
  const killKrahllak = (s: GameState) => defeatWithAttack(DEPS, untoughened(bothHeroes(s)), villainOf(s), P1);

  it("after Krahllak (I) is defeated the scheme advances to stage 2 and Krahllak (II) is revealed", () => {
    const start = invitation({ seats: both });
    const after = killKrahllak(start);
    expect(stageNumberOf(after)).toBe(2);
    expect(after.villains[0]!.stageIndex).toBe(1);
    expect(after.outcome?.result).toBeUndefined();
  });

  it("the scheme stays at stage 1 when something else is defeated", () => {
    const start = bothHeroes(invitation({ seats: both }));
    const engaged = engageMinion(start, HELLBRIDE, "hb");
    const after = defeatWithAttack(DEPS, engaged, "hb" as InstanceId, P1);
    expect(stageNumberOf(after)).toBe(1);
  });

  it("standard mode: defeating Krahllak (II), his last stage, wins the game", () => {
    const afterOne = killKrahllak(invitation({ seats: both }));
    const ready = patchInstance(afterOne, identityOf(afterOne), { exhausted: false });
    const afterTwo = defeatWithAttack(DEPS, untoughened(ready), villainOf(afterOne), P1);
    expect(afterTwo.outcome?.result).toBe("win");
  });
});

describe("Beast Be Praised 2A (65061a.when-revealed)", () => {
  const flip = (s: GameState, p = P1): GameState => patchInstance(s, ccIn(s, p)[0]!, { flipped: true });
  const reveal = (s: GameState) => defeatWithAttack(DEPS, untoughened(bothHeroes(s)), villainOf(s), P1);
  const handSize = (s: GameState, p = P1) => playerOf(s, p).hand.length;

  it("a player whose Creeping Corruption has the Overpowering trait discards 1 random card from their hand", () => {
    const start = invitation({ seats: both });
    const before = handSize(start, P1);
    const after = reveal(flip(start, P1));
    expect(handSize(after, P1)).toBe(before - 1);
    expect(playerOf(after, P1).discard.length).toBeGreaterThan(playerOf(start, P1).discard.length);
  });

  it("each other player discards a non-permanent card they control from play (their own choice)", () => {
    const start = invitation({ seats: both });
    const staged = withWoundedAlly(bothHeroes(start), P2);
    const handBefore = handSize(staged.state, P2);
    const after = defeatWithAttack(DEPS, untoughened(staged.state), villainOf(staged.state), P1);
    expect(playerOf(after, P2).discard).toContain(staged.ally);
    expect(handSize(after, P2)).toBe(handBefore);
    // P1 controls nothing but a permanent Creeping Corruption: nothing to discard, and it stays.
    expect(ccIn(after, P1)).toHaveLength(1);
  });

  it("the Overpowering player discards from hand, not from play", () => {
    const start = flip(invitation({ seats: both }), P2);
    const staged = withWoundedAlly(bothHeroes(start), P2);
    const after = defeatWithAttack(DEPS, untoughened(staged.state), villainOf(staged.state), P1);
    expect(playerOf(after, P2).playArea).toContain(staged.ally);
    expect(handSize(after, P2)).toBe(handSize(staged.state, P2) - 1);
  });

  it("standard mode deals no facedown encounter card; expert mode deals each player one", () => {
    const standard = invitation({ seats: both });
    const dealt = (s: GameState) => playerOf(s, P1).dealtEncounter.length + playerOf(s, P2).dealtEncounter.length;
    expect(dealt(reveal(standard))).toBe(0);
    const expert = invitation({ seats: both, expert: true });
    // Expert starts at Krahllak (II): his defeat advances to (III) and the scheme to 2A.
    const after = reveal(expert);
    expect(stageNumberOf(after)).toBe(2);
    expect(playerOf(after, P1).dealtEncounter).toHaveLength(1);
    expect(playerOf(after, P2).dealtEncounter).toHaveLength(1);
  });
});

describe("Beast Be Praised 2B (65061b.beast-be-praised-forced-response)", () => {
  /** The scheme at 2B (Krahllak I defeated), the heroes back in alter-ego form, and a villain phase's top cards. */
  function atTwo(seats: readonly { starterDeckId: string }[] = both): GameState {
    const start = invitation({ seats });
    const defeated = defeatWithAttack(DEPS, untoughened(bothHeroes(start)), villainOf(start), P1);
    // The reveal's When Revealed has resolved; clear the threat so the next numbers read plainly.
    return patchInstance(defeated, mainScheme(defeated), { threat: 0 });
  }
  const phase = (s: GameState, pick: Picker) =>
    driveEventsPicking(DEPS, stackEncounterDeck(s, ADVANCE, FILLER_A, FILLER_B), pick, endTurn(P1), endTurn(P2));

  it("after step one each player chooses: a counter on their Creeping Corruption, or 3 threat here", () => {
    const start = atTwo();
    const run = phase(start, choosing({ [P1]: /^Place 1 corruption/, [P2]: /^Place 3 threat/ }));
    expect(corruption(run.state, P1)).toBe(1);
    expect(corruption(run.state, P2)).toBe(0);
    // 3 threat from P2's choice, plus the villain phase's own threat (step one) and Krahllak's scheme.
    expect(inst(run.state, mainScheme(run.state)).threat).toBeGreaterThanOrEqual(3);
  });

  it("both choosing threat places 6 threat; both choosing counters places none", () => {
    const start = atTwo();
    const threats = phase(start, choosing({ [P1]: /^Place 3 threat/, [P2]: /^Place 3 threat/ }));
    const counters = phase(start, choosing({ [P1]: /^Place 1 corruption/, [P2]: /^Place 1 corruption/ }));
    const diff =
      inst(threats.state, mainScheme(threats.state)).threat - inst(counters.state, mainScheme(counters.state)).threat;
    expect(diff).toBe(6);
    expect(corruption(counters.state, P1)).toBe(1);
    expect(corruption(counters.state, P2)).toBe(1);
  });

  it("it is not heard at stage 1B", () => {
    const run = phase(invitation({ seats: both }), choosing({ [P1]: /^Place 3 threat/ }));
    expect(corruption(run.state, P1)).toBe(0);
  });

  it("if this stage is completed, the players lose the game", () => {
    const start = patchInstance(atTwo(), mainScheme(atTwo()), { threat: 999 });
    const run = phase(start, choosing({ [P1]: /^Place 1 corruption/, [P2]: /^Place 1 corruption/ }));
    expect(run.state.outcome?.result).toBe("loss");
  });
});
