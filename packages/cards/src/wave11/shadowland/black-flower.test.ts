import type { GameEvent, GameState, InstanceId } from "@mc/engine";
import { activeEncounterDeck } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../ability-refs.js";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  runWith,
  settle,
  stackEncounterDeck,
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
  byId,
  byLabel,
  ccOf,
  corruption,
  idsOf,
  recording,
  shadowGame,
  withCorruption,
} from "./corruption.testing.js";
import { SHADOWLAND_BLACK_FLOWER as REGISTRY, SHADOWLAND_BLACK_FLOWER_SKIPPED as SKIPPED } from "./black-flower.js";

vi.setConfig({ testTimeout: 180_000 });

const AKA = "65073";
const TONGUE = "65074";
const RITUAL = "65075";
const ROOTS = "65076";
const MALEDICTION = "65077";
const INVASIVE = "65078";
const CARDS = [AKA, TONGUE, RITUAL, ROOTS, MALEDICTION, INVASIVE];
const REFS = [
  "65073.aka-interrupt",
  "65073.boost",
  "65074.when-defeated",
  "65074.boost",
  "65075.when-revealed",
  "65076.when-defeated",
  "65076.boost",
  "65077.when-revealed-alter-ego",
  "65077.when-revealed-hero",
  "65078.when-revealed",
  "65078.boost",
];

const data = (code: string) => (WAVE11_CARDS as readonly any[]).find((c) => (c.id as string) === code)!;
const damage = (s: GameState, p = P1): number => inst(s, identityOf(s, p)).damage;
const alterEgoGame = (opts: Parameters<typeof shadowGame>[0] = {}) => shadowGame(opts);
const heroGame = (opts: Parameters<typeof shadowGame>[0] = {}) => withForm(shadowGame(opts), { heroForm: 0 });
const twoHeroes = (opts: Parameters<typeof shadowGame>[0] = {}) =>
  withForm(heroGame({ seats: [SPIDER_MAN, CAPTAIN_MARVEL], ...opts }), { heroForm: 0 }, P2);
const handSize = (s: GameState, p = P1): number => s.players.find((x) => x.playerId === p)!.hand.length;
const threatOf = (s: GameState, code: string): number => inst(s, idsOf(s, code)[0]!).threat;
const mainThreat = (s: GameState): number => inst(s, s.mainScheme.instanceId).threat;
const place = /^Place 1 corruption counter/;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

/** One villain phase from `state` (P1 ends the turn), the top of the encounter deck stacked as `cards`. */
function villainPhase(state: GameState, cards: readonly string[], pick = firstLegal) {
  return driveEventsPicking(DEPS, stackEncounterDeck(state, ...cards), pick, endTurn(P1));
}

/** Test surgery: the Creeping Corruption is already on its OVERPOWERING face (72B). */
const overpowering = (s: GameState, p = P1): GameState => patchInstance(s, ccOf(s, p), { flipped: true });

const basicThwartAt = (s: GameState, scheme: InstanceId, player = P1): GameState =>
  settle(
    runWith(DEPS, s, {
      type: "basicThwart",
      playerId: player,
      thwarterInstanceId: identityOf(s, player),
      schemeInstanceId: scheme,
    }),
    firstLegal,
    undefined,
    DEPS,
  );

describe("registry", () => {
  it("registers every printed ref of the six cards; nothing is skipped", () => {
    const printed = CARDS.flatMap((c) => abilityRefIds(data(c))).sort();
    expect(printed).toEqual([...REFS].sort());
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS].sort());
    expect(Object.keys(SKIPPED)).toEqual([]);
  });
  it.each(REFS)("%s validates", (ref) => {
    expect(validateDefinition(REGISTRY[ref]!), ref).toEqual([]);
  });
});

describe("Aka 65073", () => {
  const accept = byId("65073.aka-interrupt");
  const fill = [ADVANCE, ADVANCE, FILLER_A, FILLER_B];
  const attacksBy = (events: readonly GameEvent[]) =>
    ofType(events, "attackResolved").filter((e) => (e.enemyInstanceId as string) === "aka");
  const start = (opts: Parameters<typeof shadowGame>[0] = {}) => engageMinion(heroGame(opts), AKA, "aka");

  it("interrupt: placing a counter cancels the attack; declining takes it", () => {
    const taken = villainPhase(start(), fill, accept);
    expect(corruption(taken.state)).toBe(1);
    expect(attacksBy(taken.events)).toEqual([]);
    const declined = villainPhase(start(), fill);
    expect(corruption(declined.state)).toBe(0);
    expect(attacksBy(declined.events).map((e) => e.damageDealt)).toEqual([3]);
  });

  it("interrupt: when Aka attacks P2 the counter lands on P2's Creeping Corruption", () => {
    const s = engageMinion(twoHeroes(), AKA, "aka", P2);
    const run = driveEventsPicking(
      DEPS,
      stackEncounterDeck(s, ADVANCE, ADVANCE, FILLER_A, FILLER_B),
      (st) => (st.pendingChoice!.prompt.kind === "declareDefender" ? ["decline"] : accept(st)),
      endTurn(P1),
      endTurn(P2),
    );
    expect(corruption(run.state, P2)).toBe(1);
    expect(corruption(run.state, P1)).toBe(0);
    expect(attacksBy(run.events)).toEqual([]);
  });

  it("interrupt: it is not offered to a player with no Creeping Corruption", () => {
    const log: Parameters<typeof recording>[1] = [];
    const run = villainPhase(start({ corruption: false }), fill, recording(accept, log));
    expect(log.flatMap((l) => l.ids).some((id) => id.includes("65073"))).toBe(false);
    expect(attacksBy(run.events).map((e) => e.damageDealt)).toEqual([3]);
  });

  it("boost: place a counter, or discard 1 random card from your hand", () => {
    const hero = () => heroGame({ encounter: [AKA] });
    const placed = villainPhase(hero(), [AKA, FILLER_A], byLabel(place));
    const discarded = villainPhase(hero(), [AKA, FILLER_A], byLabel(/^Discard 1 random/));
    expect(corruption(placed.state)).toBe(1);
    expect(corruption(discarded.state)).toBe(0);
    expect(handSize(placed.state) - handSize(discarded.state)).toBe(1);
  });
});

describe("Tongue of the Beast 65074", () => {
  it("when defeated: the defeating player places 2 counters on their Creeping Corruption", () => {
    const after = defeatWithAttack(DEPS, engageMinion(heroGame(), TONGUE, "tb"), "tb" as InstanceId, P1);
    expect(corruption(after)).toBe(2);
  });

  it("when defeated: a teammate who defeats it places them on their own", () => {
    const s1 = engageMinion(twoHeroes(), TONGUE, "tb", P1);
    const p2Turn = settle(runWith(DEPS, s1, endTurn(P1)), firstLegal, undefined, DEPS);
    const after = defeatWithAttack(DEPS, p2Turn, "tb" as InstanceId, P2);
    expect(corruption(after, P2)).toBe(2);
    expect(corruption(after, P1)).toBe(0);
  });

  it("when defeated: with no Creeping Corruption it is simply defeated", () => {
    const s = engageMinion(heroGame({ corruption: false }), TONGUE, "tb");
    const after = defeatWithAttack(DEPS, s, "tb" as InstanceId, P1);
    expect(activeEncounterDeck(after).discard).toContain("tb" as InstanceId);
  });

  it("boost: place a counter, or this card gains three boost icons (3 more damage)", () => {
    const hero = () => heroGame({ encounter: [TONGUE] });
    const placed = villainPhase(hero(), [TONGUE, FILLER_A], byLabel(place));
    const gained = villainPhase(hero(), [TONGUE, FILLER_A], byLabel(/gains 3 boost icons/));
    expect(corruption(placed.state)).toBe(1);
    expect(corruption(gained.state)).toBe(0);
    expect(damage(gained.state) - damage(placed.state)).toBe(3);
  });
});

describe("Binding Ritual 65075", () => {
  it("when revealed: place a counter on your Creeping Corruption, or 3 threat here", () => {
    const counter = villainPhase(alterEgoGame({ encounter: [RITUAL] }), [ADVANCE, RITUAL], byLabel(place));
    expect(corruption(counter.state)).toBe(1);
    const base = threatOf(counter.state, RITUAL);
    const threat = villainPhase(alterEgoGame({ encounter: [RITUAL] }), [ADVANCE, RITUAL], byLabel(/^Place 3 threat/));
    expect(corruption(threat.state)).toBe(0);
    expect(threatOf(threat.state, RITUAL) - base).toBe(3);
  });

  it("when revealed: each player chooses for themselves", () => {
    const start = alterEgoGame({ seats: [SPIDER_MAN, CAPTAIN_MARVEL], encounter: [RITUAL] });
    const run = driveEventsPicking(
      DEPS,
      stackEncounterDeck(start, ADVANCE, ASSAULT, FILLER_A, RITUAL),
      (s) => {
        const c = s.pendingChoice!;
        if (c.prompt.kind === "declareDefender") return ["decline"];
        return byLabel(c.playerId === P1 ? place : /^Place 3 threat/)(s);
      },
      endTurn(P1),
      endTurn(P2),
    );
    expect(corruption(run.state, P1)).toBe(1);
    expect(corruption(run.state, P2)).toBe(0);
    expect(threatOf(run.state, RITUAL)).toBe(2 + 3);
  });

  it("when revealed: a player with no Creeping Corruption can only place the threat, unasked", () => {
    const log: Parameters<typeof recording>[1] = [];
    const run = villainPhase(
      alterEgoGame({ corruption: false, encounter: [RITUAL] }),
      [ADVANCE, RITUAL],
      recording(firstLegal, log),
    );
    expect(log.some((l) => l.kind === "chooseOption")).toBe(false);
    expect(threatOf(run.state, RITUAL)).toBe(1 + 3);
  });
});

describe("Roots of a Black Flower 65076", () => {
  it("when defeated: the defeating player places 2 counters on their Creeping Corruption", () => {
    const { state, id } = encounterCardInVillainArea(heroGame({ encounter: [ROOTS] }), ROOTS, 1);
    expect(corruption(basicThwartAt(state, id))).toBe(2);
  });

  it("when defeated: a teammate who defeats it places them on their own", () => {
    const { state, id } = encounterCardInVillainArea(twoHeroes({ encounter: [ROOTS] }), ROOTS, 1);
    const p2Turn = settle(runWith(DEPS, state, endTurn(P1)), firstLegal, undefined, DEPS);
    const after = basicThwartAt(p2Turn, id, P2);
    expect(corruption(after, P2)).toBe(2);
    expect(corruption(after, P1)).toBe(0);
  });

  it("boost: place a counter, or 4 threat on the main scheme", () => {
    const hero = () => heroGame({ encounter: [ROOTS] });
    const placed = villainPhase(hero(), [ROOTS, FILLER_A], byLabel(place));
    const threat = villainPhase(hero(), [ROOTS, FILLER_A], byLabel(/^Place 4 threat/));
    expect(corruption(placed.state)).toBe(1);
    expect(corruption(threat.state)).toBe(0);
    expect(mainThreat(threat.state) - mainThreat(placed.state)).toBe(4);
  });
});

describe("Malediction 65077", () => {
  const cards = [ASSAULT, MALEDICTION];
  const game = (opts: Parameters<typeof shadowGame>[0] = {}) => alterEgoGame({ encounter: [MALEDICTION], ...opts });

  it("when revealed (alter-ego): you may place 2 counters", () => {
    expect(corruption(villainPhase(game(), cards, byLabel(/^Place 2/)).state)).toBe(2);
  });

  it("when revealed (alter-ego): if you do not, the villain schemes with +2 SCH", () => {
    const placed = villainPhase(game(), cards, byLabel(/^Place 2/));
    const declined = villainPhase(game(), cards, byLabel(/^Do not/));
    expect(corruption(declined.state)).toBe(0);
    expect(mainThreat(declined.state) - mainThreat(placed.state)).toBe(5);
  });

  it("when revealed (alter-ego): with no Creeping Corruption the villain schemes without a choice", () => {
    const log: Parameters<typeof recording>[1] = [];
    const run = villainPhase(game({ corruption: false }), cards, recording(firstLegal, log));
    const control = villainPhase(game({ corruption: false }), [ASSAULT, FILLER_A]);
    expect(log.some((l) => l.kind === "chooseOption")).toBe(false);
    expect(mainThreat(run.state) - mainThreat(control.state)).toBe(3);
  });

  it("when revealed (hero): without Overpowering the villain attacks you", () => {
    const start = withCorruption(heroGame({ encounter: [MALEDICTION] }), 1);
    const run = villainPhase(start, [ADVANCE, MALEDICTION]);
    const control = villainPhase(start, [ADVANCE, FILLER_A]);
    expect(damage(run.state) - damage(control.state)).toBe(4);
  });

  it("when revealed (hero): with Overpowering the villain schemes with +1 SCH instead", () => {
    const start = overpowering(heroGame({ encounter: [MALEDICTION] }));
    const run = villainPhase(start, [ADVANCE, MALEDICTION]);
    const control = villainPhase(start, [ADVANCE, FILLER_A]);
    expect(damage(run.state)).toBe(damage(control.state));
    expect(mainThreat(run.state) - mainThreat(control.state)).toBe(4);
  });
});

describe("Invasive Thoughts 65078", () => {
  const game = (opts: Parameters<typeof shadowGame>[0] = {}) => alterEgoGame({ encounter: [INVASIVE], ...opts });

  it("when revealed: places a counter; without Overpowering you take 1 damage, not threat", () => {
    const run = villainPhase(game(), [ADVANCE, INVASIVE]);
    const control = villainPhase(game(), [ADVANCE, FILLER_A]);
    expect(corruption(run.state)).toBe(1);
    expect(damage(run.state) - damage(control.state)).toBe(1);
    expect(mainThreat(run.state)).toBe(mainThreat(control.state));
  });

  it("when revealed: with Overpowering, 1 threat on the main scheme and no damage", () => {
    const start = overpowering(game());
    const run = villainPhase(start, [ADVANCE, INVASIVE]);
    const control = villainPhase(start, [ADVANCE, FILLER_A]);
    expect(corruption(run.state)).toBe(1);
    expect(damage(run.state)).toBe(damage(control.state));
    expect(mainThreat(run.state) - mainThreat(control.state)).toBe(1);
  });

  it("when revealed: with no Creeping Corruption, no counter, and the otherwise branch (1 damage)", () => {
    const start = game({ corruption: false });
    const run = villainPhase(start, [ADVANCE, INVASIVE]);
    const control = villainPhase(start, [ADVANCE, FILLER_A]);
    expect(damage(run.state) - damage(control.state)).toBe(1);
  });

  it("when revealed: a 5th counter flips Creeping Corruption to 72B before the trait is read (1 threat, no damage)", () => {
    const start = withCorruption(game(), 4);
    const run = villainPhase(start, [ADVANCE, INVASIVE]);
    const control = villainPhase(start, [ADVANCE, FILLER_A]);
    expect(inst(run.state, ccOf(run.state)).flipped).toBe(true);
    expect(corruption(run.state)).toBe(0);
    expect(damage(run.state)).toBe(damage(control.state));
    expect(mainThreat(run.state) - mainThreat(control.state)).toBe(1);
  });

  it("boost: place a counter, or take 4 indirect damage", () => {
    const hero = () => heroGame({ encounter: [INVASIVE] });
    const placed = villainPhase(hero(), [INVASIVE, FILLER_A], byLabel(place));
    const indirect = villainPhase(hero(), [INVASIVE, FILLER_A], byLabel(/^Take 4 indirect/));
    expect(corruption(placed.state)).toBe(1);
    expect(corruption(indirect.state)).toBe(0);
    expect(damage(indirect.state) - damage(placed.state)).toBe(4);
  });
});
