import { AOS_CARDS, cardId, type EventCard } from "@mc/content";
import { applyCommand, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  firstLegal,
  inst,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, withDamage } from "../../../testing/staging.js";
import { NICK_FURY_EVENTS, NICK_FURY_EVENTS_SKIPPED } from "./events.js";
import { FURY_EVENT_DEPS, engageMinion, furyDuoGame, furyGame, furyHeroGame, suitOf } from "./testing.js";
import { withForm } from "../../../testing/staging.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Nick Fury's events (50037 to 50039), docs/phase7-wave9.md sections 3.7, 3.8 and 4.1 Q4. Assault / Stealth (50035a/b)
 * is scripted by another module, so what is asserted here is the threat the suit holds and the face it shows. Core
 * minions stand in as enemies: Hydra Mercenary 01101 (guard, SCH 0, 3 hit points), Shocker 01103 (SCH 1, 3 hit
 * points), Sandman 01102 (SCH 2, 4 hit points). Rhino (stage I) has SCH 1.
 */
const FIRE = "50037.concentrated-fire-action";
const SURVEIL = "50038.covert-surveillance-action";
const SPRAY = "50039.spray-fire-action";
const MERCENARY = "01101";
const SANDMAN = "01102";
const SHOCKER = "01103";

const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const schemeOf = (s: GameState): InstanceId => s.mainScheme.instanceId;
const withScheme = (s: GameState, threat: number): GameState => patchInstance(s, schemeOf(s), { threat });
const schemeThreat = (s: GameState): number => inst(s, schemeOf(s)).threat;
const suitThreat = (s: GameState): number => inst(s, suitOf(s)!).threat;
const showsStealth = (s: GameState): boolean => inst(s, suitOf(s)!).flipped;
const withSuit = (s: GameState, patch: { threat?: number; flipped?: boolean }): GameState =>
  patchInstance(s, suitOf(s)!, patch);
const formChanges = (events: readonly GameEvent[]) => events.filter((e) => e.type === "additionalFormChanged");
const inPlay = (s: GameState, id: string): boolean =>
  Object.values(playerOf(s, P1).playArea).includes(id as InstanceId);
const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const discardCodes = (s: GameState): string[] => playerOf(s, P1).discard.map((id) => codeOf(s, id));

/** Plays the event `code` for `cost` (paid with other hand cards), answering each prompt with `pick`. */
function playEvent(state: GameState, code: string, cost: number, pick: Picker = firstLegal) {
  const given = moveToHand(state, P1, code);
  const event = given.ids[0]!;
  return driveEventsPicking(
    FURY_EVENT_DEPS,
    given.state,
    pick,
    play(P1, event, payWith(given.state, P1, cost, [event])),
  );
}

/** Answers a target prompt with `target` when offered, a "choose one" with the option whose label starts `label`. */
const choosing =
  (opts: { target?: string; label?: string; player?: string }): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    const hit = choice.options.find(
      (o) =>
        (opts.target !== undefined && o.optionId === opts.target) ||
        (opts.player !== undefined && o.optionId === opts.player) ||
        (opts.label !== undefined && o.label.startsWith(opts.label)),
    );
    return hit ? [hit.optionId] : firstLegal(s);
  };

/** Every prompt answered with `pick`, and each prompt's kind and labels recorded. */
function recording(pick: Picker): { readonly seen: string[][]; readonly picker: Picker } {
  const seen: string[][] = [];
  return {
    seen,
    picker: (s) => {
      seen.push([s.pendingChoice!.prompt.kind, ...s.pendingChoice!.options.map((o) => o.label)]);
      return pick(s);
    },
  };
}

const card = (code: string) => AOS_CARDS.find((c) => c.id === cardId(code)) as EventCard;

describe("Nick Fury events registry", () => {
  it("every ability validates as a Hero Action with its printed label; none is skipped", () => {
    expect(Object.keys(NICK_FURY_EVENTS).sort()).toEqual([FIRE, SURVEIL, SPRAY]);
    for (const ref of [FIRE, SURVEIL, SPRAY]) {
      expect(validateDefinition(NICK_FURY_EVENTS[ref]!), ref).toEqual([]);
      expect(NICK_FURY_EVENTS[ref]!.trigger, ref).toMatchObject({ kind: "action", form: "hero" });
    }
    expect(NICK_FURY_EVENTS[FIRE]!.label).toEqual(["attack"]);
    expect(NICK_FURY_EVENTS[SURVEIL]!.label).toEqual(["thwart"]);
    expect(NICK_FURY_EVENTS[SPRAY]!.label).toEqual(["attack"]);
    expect(NICK_FURY_EVENTS_SKIPPED).toEqual({});
  });
  it("the printed card data names exactly these refs, with costs 2, 1 and 3 and the printed traits", () => {
    for (const [code, ref, cost, trait] of [
      ["50037", FIRE, 2, "ATTACK"],
      ["50038", SURVEIL, 1, "THWART"],
      ["50039", SPRAY, 3, "ATTACK"],
    ] as const) {
      expect(card(code).abilities.map((a) => a.id as string)).toEqual([ref]);
      expect(card(code).cost).toBe(cost);
      expect(card(code).traits.map(String)).toContain(trait);
    }
  });
});

describe(`${FIRE} (Concentrated Fire 50037): deal 4 damage to an enemy, ranged; on a defeat choose`, () => {
  it("costs 2: two other cards are discarded, the event goes to the discard pile, and Rhino takes 4", () => {
    const s = furyHeroGame();
    const before = playerOf(s, P1).hand.length;
    const { state, events } = playEvent(s, "50037", 2);
    expect(inst(state, villainOf(state)).damage).toBe(4);
    expect(playerOf(state, P1).hand).toHaveLength(before - 2);
    expect(discardCodes(state)).toContain("50037");
    expect(events.filter((e) => e.type === "cardDiscardedFromHand")).toHaveLength(2);
  });
  it("is an attack that gains ranged (and Break Cover has already put the suit on Assault)", () => {
    const { events } = playEvent(furyHeroGame(), "50037", 2);
    const attacks = events.filter(
      (e) => e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "attack",
    );
    expect(attacks).toMatchObject([{ event: { amount: 4, basic: false, keywords: ["ranged"] } }]);
    expect(events.some((e) => e.type === "triggerEvent" && e.event.kind === "dealDamage" && e.event.ranged)).toBe(true);
  });
  it("an enemy that survives (Rhino, 4 of 14): no choice is offered and the suit is untouched", () => {
    const rec = recording(firstLegal);
    const { state } = playEvent(furyHeroGame(), "50037", 2, rec.picker);
    expect(rec.seen.map((p) => p[0])).toEqual(["chooseTarget"]);
    expect(suitThreat(state)).toBe(0);
    expect(showsStealth(state)).toBe(false);
  });
  it("defeating Shocker (printed SCH 1), the threat choice places 1 threat on the suit", () => {
    const s = engageMinion(furyHeroGame(), SHOCKER, "shocker");
    const rec = recording(choosing({ target: "shocker", label: "Place threat" }));
    const { state } = playEvent(s, "50037", 2, rec.picker);
    expect(rec.seen.find((p) => p[0] === "chooseOption")).toEqual([
      "chooseOption",
      "Place threat on your suit form upgrade",
      "Change to Stealth suit form",
    ]);
    expect(inPlay(state, "shocker")).toBe(false);
    expect(suitThreat(state)).toBe(1);
    expect(showsStealth(state)).toBe(false);
    expect(inst(state, villainOf(state)).damage).toBe(0);
  });
  it("defeating Sandman (printed SCH 2, 4 hit points) places 2 threat: exactly 4 damage defeats a 4-hit-point enemy", () => {
    const s = engageMinion(furyHeroGame(), SANDMAN, "sandman");
    const { state } = playEvent(s, "50037", 2, choosing({ target: "sandman", label: "Place threat" }));
    expect(inPlay(state, "sandman")).toBe(false);
    expect(suitThreat(state)).toBe(2);
  });
  it("the placed threat adds to what the suit already holds: 3 + 2 = 5 (Break Cover has put the suit on Assault)", () => {
    const s = withSuit(engageMinion(furyHeroGame(), SANDMAN, "sandman"), { threat: 3, flipped: true });
    const { state } = playEvent(s, "50037", 2, choosing({ target: "sandman", label: "Place threat" }));
    expect(suitThreat(state)).toBe(5);
    // Break Cover (Forced Interrupt: When you attack, change to Assault suit form) fires on this attack too.
    expect(showsStealth(state)).toBe(false);
  });
  it("defeating a SCH 0 enemy (Hydra Mercenary): placing threat places 0", () => {
    const s = engageMinion(furyHeroGame(), MERCENARY, "merc");
    const { state } = playEvent(s, "50037", 2, choosing({ target: "merc", label: "Place threat" }));
    expect(inPlay(state, "merc")).toBe(false);
    expect(suitThreat(state)).toBe(0);
  });
  it("the other bullet changes to Stealth suit form: the suit flips, the change is announced, no threat is placed", () => {
    const s = engageMinion(furyHeroGame(), SHOCKER, "shocker");
    const { state, events } = playEvent(s, "50037", 2, choosing({ target: "shocker", label: "Change to Stealth" }));
    expect(showsStealth(state)).toBe(true);
    expect(suitThreat(state)).toBe(0);
    expect(formChanges(events)).toMatchObject([{ formType: "suit", formName: "Stealth" }]);
  });
  it("changing to Stealth keeps the threat the suit holds", () => {
    const s = withSuit(engageMinion(furyHeroGame(), SHOCKER, "shocker"), { threat: 4 });
    const { state } = playEvent(s, "50037", 2, choosing({ target: "shocker", label: "Change to Stealth" }));
    expect(showsStealth(state)).toBe(true);
    expect(suitThreat(state)).toBe(4);
  });
  it("suit on Stealth when played: Break Cover changes it to Assault on the attack, and the bullet changes it back", () => {
    const s = withSuit(engageMinion(furyHeroGame(), SHOCKER, "shocker"), { flipped: true });
    const { state, events } = playEvent(s, "50037", 2, choosing({ target: "shocker", label: "Change to Stealth" }));
    expect(showsStealth(state)).toBe(true);
    expect(formChanges(events)).toMatchObject([
      { formType: "suit", formName: "Assault" },
      { formType: "suit", formName: "Stealth" },
    ]);
  });
  it("guard: with Hydra Mercenary engaged, only it can be chosen, and Rhino takes nothing", () => {
    const s = engageMinion(furyHeroGame(), MERCENARY, "merc");
    const rec = recording(firstLegal);
    const { state } = playEvent(s, "50037", 2, rec.picker);
    expect(rec.seen[0]).toEqual(["chooseTarget", "Hydra Mercenary"]);
    expect(inst(state, villainOf(state)).damage).toBe(0);
  });
  it("a choice is made only for a defeat: damage short of it (Rhino at 4 of 14) offers nothing, even next to a minion", () => {
    const s = engageMinion(furyHeroGame(), SHOCKER, "shocker");
    const { state } = playEvent(s, "50037", 2, choosing({ target: villainOf(s) }));
    expect(inst(state, villainOf(state)).damage).toBe(4);
    expect(inPlay(state, "shocker")).toBe(true);
    expect(suitThreat(state)).toBe(0);
  });
  it("defeating the villain counts too: Rhino near death, the choice places his printed SCH of 1", () => {
    const s = withDamage(furyHeroGame(), villainOf(furyHeroGame()), 10);
    const rec = recording(choosing({ label: "Place threat" }));
    const { state } = playEvent(s, "50037", 2, rec.picker);
    expect(rec.seen.some((p) => p[0] === "chooseOption")).toBe(true);
    // Rhino (I) is defeated and the stage advances; every Rhino stage prints SCH 1, so the count is 1 either way.
    expect(suitThreat(state)).toBe(1);
  });
  it("is a hero action: refused in alter-ego form, and nothing is paid", () => {
    const s = furyGame();
    const given = moveToHand(s, P1, "50037");
    const result = applyCommand(
      given.state,
      play(P1, given.ids[0]!, payWith(given.state, P1, 2, given.ids)),
      FURY_EVENT_DEPS,
    );
    expect(result.ok).toBe(false);
  });
});

describe(`${SURVEIL} (Covert Surveillance 50038): remove 2 threat from a scheme`, () => {
  it("costs 1. Assault showing, scheme at 5: it goes to 3, then Change to Stealth is offered (not a placement)", () => {
    const rec = recording(choosing({ label: "Change to Stealth" }));
    const { state, events } = playEvent(withScheme(furyHeroGame(), 5), "50038", 1, rec.picker);
    expect(schemeThreat(state)).toBe(3);
    expect(rec.seen.find((p) => p[0] === "chooseOption")).toEqual([
      "chooseOption",
      "Change to Stealth suit form",
      "Decline",
    ]);
    expect(showsStealth(state)).toBe(true);
    expect(suitThreat(state)).toBe(0);
    expect(formChanges(events)).toMatchObject([{ formType: "suit", formName: "Stealth" }]);
    expect(discardCodes(state)).toContain("50038");
  });
  it("Assault showing: the change may be declined, and the suit stays on Assault with no threat", () => {
    const { state, events } = playEvent(withScheme(furyHeroGame(), 5), "50038", 1, choosing({ label: "Decline" }));
    expect(schemeThreat(state)).toBe(3);
    expect(showsStealth(state)).toBe(false);
    expect(suitThreat(state)).toBe(0);
    expect(formChanges(events)).toEqual([]);
  });
  it("Assault showing: the removed threat is never placed, even with threat already on the suit", () => {
    const s = withSuit(withScheme(furyHeroGame(), 5), { threat: 1 });
    const { state } = playEvent(s, "50038", 1, choosing({ label: "Change to Stealth" }));
    expect(suitThreat(state)).toBe(1);
  });
  it("in Stealth, scheme at 5: it goes to 3 and placing puts that 2 threat on the suit", () => {
    const rec = recording(choosing({ label: "Place that threat" }));
    const { state } = playEvent(withSuit(withScheme(furyHeroGame(), 5), { flipped: true }), "50038", 1, rec.picker);
    expect(rec.seen.find((p) => p[0] === "chooseOption")).toEqual([
      "chooseOption",
      "Place that threat on your suit form upgrade",
      "Decline",
    ]);
    expect(schemeThreat(state)).toBe(3);
    expect(suitThreat(state)).toBe(2);
    expect(showsStealth(state)).toBe(true);
  });
  it("in Stealth the placement is a may: declined, the suit holds 0 and the scheme is still at 3", () => {
    const s = withSuit(withScheme(furyHeroGame(), 5), { flipped: true });
    const { state } = playEvent(s, "50038", 1, choosing({ label: "Decline" }));
    expect(schemeThreat(state)).toBe(3);
    expect(suitThreat(state)).toBe(0);
  });
  it("in Stealth, a scheme with 1 threat: 1 removed, 1 placed (that threat is what was removed)", () => {
    const s = withSuit(withScheme(furyHeroGame(), 1), { flipped: true });
    const { state } = playEvent(s, "50038", 1, choosing({ label: "Place that threat" }));
    expect(schemeThreat(state)).toBe(0);
    expect(suitThreat(state)).toBe(1);
  });
  it("in Stealth the placement adds to the suit's threat: 2 + 2 = 4", () => {
    const s = withSuit(withScheme(furyHeroGame(), 5), { flipped: true, threat: 2 });
    const { state } = playEvent(s, "50038", 1, choosing({ label: "Place that threat" }));
    expect(suitThreat(state)).toBe(4);
  });
  it("the suit's threat is not a scheme's: only the main scheme is offered as the target, never the suit", () => {
    const rec = recording(firstLegal);
    playEvent(withSuit(withScheme(furyHeroGame(), 5), { threat: 3 }), "50038", 1, rec.picker);
    expect(rec.seen[0]).toEqual(["chooseTarget", expect.any(String)]);
    expect(rec.seen[0]).toHaveLength(2);
  });
  it("it is a thwart by Fury but not a basic thwart: Gather Intel is not offered", () => {
    const rec = recording(choosing({ label: "Decline" }));
    const { state } = playEvent(withScheme(furyHeroGame(), 5), "50038", 1, rec.picker);
    expect(rec.seen.map((p) => p[0])).not.toContain("chooseTriggers");
    expect(suitThreat(state)).toBe(0);
  });
  it("is a hero action: refused in alter-ego form", () => {
    const s = furyGame();
    const given = moveToHand(s, P1, "50038");
    const result = applyCommand(
      given.state,
      play(P1, given.ids[0]!, payWith(given.state, P1, 1, given.ids)),
      FURY_EVENT_DEPS,
    );
    expect(result.ok).toBe(false);
  });
});

describe(`${SPRAY} (Spray Fire 50039): choose a player; 3 damage to the villain and each minion engaged with them`, () => {
  it("costs 3. Solo, with Shocker and Sandman engaged: Rhino 3, Shocker defeated (3 of 3), Sandman 3 of 4", () => {
    let s = engageMinion(furyHeroGame(), SHOCKER, "shocker");
    s = engageMinion(s, SANDMAN, "sandman");
    const before = playerOf(s, P1).hand.length;
    const { state, events } = playEvent(s, "50039", 3);
    expect(inst(state, villainOf(state)).damage).toBe(3);
    expect(inPlay(state, "shocker")).toBe(false);
    expect(inst(state, "sandman" as InstanceId).damage).toBe(3);
    expect(playerOf(state, P1).hand).toHaveLength(before - 3);
    expect(discardCodes(state)).toContain("50039");
    expect(events.filter((e) => e.type === "damageDealt").map((e) => (e as { amount: number }).amount)).toEqual([
      3, 3, 3,
    ]);
  });
  it("it is one ranged attack: one attack event, Break Cover once, and ranged damage to both targets", () => {
    const s = engageMinion(furyHeroGame(), SANDMAN, "sandman");
    const { events } = playEvent(s, "50039", 3);
    const attacks = events.filter(
      (e) => e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "attack",
    );
    expect(attacks).toHaveLength(1);
    expect(attacks[0]).toMatchObject({ event: { keywords: ["ranged"] } });
    expect(events.filter((e) => e.type === "abilityResolved" && e.abilityId === "50034a.break-cover")).toHaveLength(1);
    const ranged = events.filter(
      (e) => e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "dealDamage" && e.event.ranged,
    );
    expect(ranged).toHaveLength(2);
  });
  it("with no minion engaged only the villain takes 3", () => {
    const { state } = playEvent(furyHeroGame(), "50039", 3);
    expect(inst(state, villainOf(state)).damage).toBe(3);
  });
  it("no target is chosen, so no prompt follows the player choice; Hydra Mercenary (guard, 3 hit points) is defeated", () => {
    // Open question for the owner (reported with this module): whether guard should stop the villain from being a
    // target of a multi-target attack. The engine's guard check keeps Rhino undamaged here; that is not pinned.
    const s = engageMinion(furyHeroGame(), MERCENARY, "merc");
    const rec = recording(firstLegal);
    const { state } = playEvent(s, "50039", 3, rec.picker);
    expect(rec.seen.map((p) => p[0])).toEqual(["choosePlayer"]);
    expect(inPlay(state, "merc")).toBe(false);
  });
  it("two players: choosing P2 damages the villain and only the minions engaged with P2", () => {
    let s = furyDuoGame();
    s = withForm(s, { heroForm: 0 });
    s = engageMinion(s, SANDMAN, "mine", P1);
    s = engageMinion(s, SANDMAN, "theirs", P2);
    const rec = recording(choosing({ player: P2 }));
    const { state } = playEvent(s, "50039", 3, rec.picker);
    expect(rec.seen[0]![0]).toBe("choosePlayer");
    expect(inst(state, villainOf(state)).damage).toBe(3);
    expect(inst(state, "theirs" as InstanceId).damage).toBe(3);
    expect(inst(state, "mine" as InstanceId).damage).toBe(0);
  });
  it("two players: choosing yourself damages the villain and your minions, not theirs", () => {
    let s = withForm(furyDuoGame(), { heroForm: 0 });
    s = engageMinion(s, SANDMAN, "mine", P1);
    s = engageMinion(s, SANDMAN, "theirs", P2);
    const { state } = playEvent(s, "50039", 3, choosing({ player: P1 }));
    expect(inst(state, villainOf(state)).damage).toBe(3);
    expect(inst(state, "mine" as InstanceId).damage).toBe(3);
    expect(inst(state, "theirs" as InstanceId).damage).toBe(0);
  });
  it("is a hero action: refused in alter-ego form", () => {
    const s = furyGame();
    const given = moveToHand(s, P1, "50039");
    const result = applyCommand(
      given.state,
      play(P1, given.ids[0]!, payWith(given.state, P1, 3, given.ids)),
      FURY_EVENT_DEPS,
    );
    expect(result.ok).toBe(false);
  });
});
