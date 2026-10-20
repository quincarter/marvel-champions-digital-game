import type { GameEvent, GameState, InstanceId } from "@mc/engine";
import { activeEncounterDeck, hasKeyword } from "@mc/engine";
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
} from "../../testing/harness.js";
import { defeatWithAttack, driveEventsPicking, encounterCardInVillainArea, withForm } from "../../testing/staging.js";
import { engageMinion } from "../../wave9/falcon/testing.js";
import { CAPTAIN_MARVEL, SPIDER_MAN } from "../../wave9/testing.js";
import { WAVE11_CARDS } from "../cards.js";
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
const CARDS = [KRAHLLAK, MARK, PULL, HELLBRIDE, ELDERS, VEIL, SUBMIT];
const REFS = [
  "65057.krahllak-interrupt",
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
  it("registers every printed ref of the seven cards; nothing is skipped", () => {
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
