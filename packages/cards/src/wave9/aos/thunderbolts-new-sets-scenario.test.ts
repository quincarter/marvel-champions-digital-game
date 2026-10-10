import {
  applyCommand,
  maxHitPoints,
  createGame,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameSetupConfig,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { mergeRegistries } from "../../dsl/index.js";
import {
  P1,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  playerOf,
  settle,
  stackEncounterDeck,
  use,
} from "../../testing/harness.js";
import { WAVE8_ABILITIES } from "../../wave8/index.js";
import { EXTREME_RISK } from "../bp/extreme-risk.js";
import { GROWING_STRONG } from "../silk/growing-strong.js";
import { wave9Scenario } from "../setup.js";
import { SPIDER_MAN, codeOf, inPlayCard, piles } from "../testing.js";
import { GRAVITATIONAL_PULL } from "./gravitational-pull.js";
import { HARD_SOUND } from "./hard-sound.js";
import { PALE_LITTLE_SPIDER } from "./pale-little-spider.js";
import { POWER_OF_THE_ATOM } from "./power-of-the-atom.js";
import { SUPERSONIC } from "./supersonic.js";
import { THE_LEAPER } from "./the-leaper.js";
import { THUNDERBOLTS } from "./thunderbolts.js";

vi.setConfig({ testTimeout: 300_000 });

const DEPS: EngineDeps = {
  abilities: mergeRegistries(
    WAVE8_ABILITIES,
    THUNDERBOLTS,
    GRAVITATIONAL_PULL,
    HARD_SOUND,
    PALE_LITTLE_SPIDER,
    POWER_OF_THE_ATOM,
    SUPERSONIC,
    THE_LEAPER,
    EXTREME_RISK,
    GROWING_STRONG,
  ),
};

interface Sim {
  state: GameState;
  events: GameEvent[];
}
interface Asked {
  readonly kind: string;
  readonly labels: readonly string[];
}
interface Plan {
  /** A `chooseOption` is answered by the first option whose label starts with one of these, in order of use. */
  readonly options?: readonly string[];
  /** A `chooseTarget` over cards is answered by the first of these codes that is offered. */
  readonly targets?: readonly string[];
}

function act(sim: Sim, plan: Plan, ...commands: readonly Command[]): { events: GameEvent[]; asked: Asked[] } {
  const events: GameEvent[] = [];
  const asked: Asked[] = [];
  const options = [...(plan.options ?? [])];
  const settleAll = () => {
    for (let guard = 0; sim.state.pendingChoice && !sim.state.outcome; guard++) {
      if (guard > 200) throw new Error("choices did not settle");
      const s = sim.state;
      const choice = s.pendingChoice!;
      asked.push({ kind: choice.prompt.kind, labels: choice.options.map((o) => o.label) });
      let selected: readonly string[];
      switch (choice.prompt.kind) {
        case "declareDefender":
          selected = ["decline"];
          break;
        case "chooseOption": {
          const at = options.findIndex((want) => choice.options.some((o) => o.label.startsWith(want)));
          if (at >= 0) {
            const want = options.splice(at, 1)[0]!;
            selected = [choice.options.find((o) => o.label.startsWith(want))!.optionId];
          } else selected = firstLegal(s);
          break;
        }
        case "chooseMinionToActivate":
        case "chooseTarget": {
          const hit = choice.options.find((o) => (plan.targets ?? []).includes(codeOf(s, o.optionId as InstanceId)));
          selected = hit ? [hit.optionId] : firstLegal(s);
          break;
        }
        default:
          selected = firstLegal(s);
      }
      step({
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: selected,
      });
    }
  };
  const step = (command: Command) => {
    const r = applyCommand(sim.state, command, DEPS);
    if (!r.ok) throw new Error(`${command.type} rejected: ${r.error.code}: ${r.error.message}`);
    sim.state = r.state;
    events.push(...r.events);
  };
  settleAll();
  for (const command of commands) {
    step(command);
    settleAll();
  }
  sim.events.push(...events);
  return { events, asked };
}

const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

function open(
  seed: number,
  players: readonly (typeof SPIDER_MAN)[] = [SPIDER_MAN],
): { sim: Sim; config: GameSetupConfig } {
  const config = wave9Scenario("thunderbolts", { players, seed });
  const created = createGame(config, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return {
    sim: { state: settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS), events: [] },
    config,
  };
}

const BLANK = "01186"; // Core treachery, 0 boost icons, no Boost ability
const ONE_ICON = "01188"; // Core treachery, 1 boost icon
const TWO_ICON = "01190"; // Core treachery, 2 boost icons
const FILLER = "01187";

const CITIZEN_V = "50129a";
const JUSTICE = "50131a";
const BLACK_WIDOW = "50148";
const MACH_IV = "50156";
const JOYSTICK = "51039";
const TRUNCHEON = "51040";
const KEEPS = "51041";
const EXTREME_RISK_CARD = "51042";
const ATLAS = "52035";
const GROW_INVULNERABLE = "52036";
const GROWING_STRONG_CARD = "52037";
const TITANIC = "52038";

const changeForm = (p: PlayerId = P1): Command => ({ type: "changeForm", playerId: p });
const recover = (): Command => ({ type: "basicRecover", playerId: P1 });
const stack = (sim: Sim, ...codes: string[]) => {
  sim.state = stackEncounterDeck(sim.state, ...codes);
};
const idOf = (sim: Sim, code: string): InstanceId =>
  (Object.keys(sim.state.instances) as InstanceId[]).find((i) => codeOf(sim.state, i) === code)!;
const damageOf = (sim: Sim, id: InstanceId): number => inst(sim.state, id).damage;
const me = (sim: Sim): InstanceId => identityOf(sim.state);
const environment = (sim: Sim): InstanceId => inPlayCard(sim.state, JUSTICE)!;
const heldBy = (sim: Sim): InstanceId | undefined => inst(sim.state, environment(sim)).attachments[0];
const engagedWith = (sim: Sim, id: InstanceId): PlayerId | null => inst(sim.state, id).engagedWith;
const deckCodes = (sim: Sim): Record<string, number> => {
  const count: Record<string, number> = {};
  for (const id of piles(sim.state).deck) count[codeOf(sim.state, id)] = (count[codeOf(sim.state, id)] ?? 0) + 1;
  return count;
};
const hpOf = (sim: Sim, id: InstanceId): number => maxHitPoints(sim.state, id, DEPS) ?? 0;
const boostsDealt = (events: readonly GameEvent[], sim: Sim, code: string) =>
  ofType(events, "boostCardDealt").filter((e) => codeOf(sim.state, e.enemyInstanceId) === code);
const attacksBy = (events: readonly GameEvent[], sim: Sim, code: string) =>
  ofType(events, "attackResolved").filter((e) => codeOf(sim.state, e.enemyInstanceId) === code);
const schemesBy = (events: readonly GameEvent[], sim: Sim, code: string) =>
  ofType(events, "schemeResolved").filter((e) => codeOf(sim.state, e.enemyInstanceId) === code);

/** The no-card-in-two-zones and nothing-pending closing check of both games. */
function expectInvariants(sim: Sim) {
  const s = sim.state;
  expect(s.pendingChoice).toBeNull();
  const seen = new Map<string, string[]>();
  const add = (id: string, label: string) => seen.set(id, [...(seen.get(id) ?? []), label]);
  for (const p of s.players) {
    for (const zone of ["hand", "deck", "discard", "playArea", "setAside"] as const)
      for (const id of p[zone]) add(id, `${p.playerId}.${zone}`);
  }
  for (const [deckId, pile] of Object.entries(s.encounterDecks)) {
    for (const id of pile.deck) add(id, `enc.${deckId}.deck`);
    for (const id of pile.discard) add(id, `enc.${deckId}.discard`);
  }
  for (const id of s.victoryDisplay) add(id, "victory");
  for (const id of s.removedFromGame) add(id, "removed");
  expect([...seen].filter(([, labels]) => labels.length > 1)).toEqual([]);
  for (const [id, instance] of Object.entries(s.instances))
    if (instance.attachedTo !== null) expect(s.instances[instance.attachedTo]?.attachments).toContain(id);
}

/**
 * Whole-game tests of the Thunderbolts scenario (MC50 p. 15) whose seeded modular pool draws one of the four new
 * hero-pack sets (docs/phase7-wave9.md section 8.4 item 53): no `setAsideModularSetIds` is pinned, so the draw is the
 * scenario builder's own (`chooseModularSets` on the game's seed). Seed 7 at one player draws Extreme Risk
 * (Black Panther (Shuri)) with Pale Little Spider; seed 6 draws Growing Strong (Silk) with Supersonic. Techno (Falcon)
 * and Whiteout (Winter Soldier) are not scripted yet, so no seed drawing either is played: see the todos. Only the
 * encounter deck's order (`stackEncounterDeck`) and the cards a turn needs in hand (`moveToHand`) are seeded; every
 * play, attack, recover and end of turn is a command the engine validates, one decision at a time.
 */
describe("Thunderbolts scenario with Extreme Risk: solo (Spider-Man), standard, seed 7", () => {
  const { sim, config } = open(7);
  let round1: { events: GameEvent[]; asked: Asked[] };
  let round2: { events: GameEvent[]; asked: Asked[] };
  let round3: { events: GameEvent[]; asked: Asked[] };
  let truncheon: InstanceId;

  it("setup: the seeded draw is Extreme Risk and Pale Little Spider; Black Widow is engaged, Joystick held, neither is in the deck", () => {
    expect((config.setAsideModularSets ?? []).map((m) => m.encounterSetId)).toEqual([
      "extreme_risk",
      "pale_little_spider",
    ]);
    expect(codeOf(sim.state, sim.state.villains[0]!.instanceId)).toBe(CITIZEN_V);
    expect(inPlayCard(sim.state, BLACK_WIDOW)).toBeDefined();
    expect(engagedWith(sim, idOf(sim, BLACK_WIDOW))).toBe(P1);
    expect(heldBy(sim)).toBe(idOf(sim, JOYSTICK));
    expect(inst(sim.state, idOf(sim, JOYSTICK))).toMatchObject({ engagedWith: null, faceup: true });
    const deck = deckCodes(sim);
    expect(deck[JOYSTICK]).toBeUndefined();
    expect(deck[BLACK_WIDOW]).toBeUndefined();
    // The other cards of the set: two Energy Truncheons, Playing for Keeps and two Extreme Risks.
    expect([deck[TRUNCHEON], deck[KEEPS], deck[EXTREME_RISK_CARD]]).toEqual([2, 1, 2]);
    expect(sim.state.encounterSetAside).toEqual([]);
  });

  it("round 1 villain phase: Extreme Risk finds Joystick (held, so in play), she engages Spider-Man and attacks him: ATK 1 + 1 icon = 2; no surge", () => {
    act(sim, {}, changeForm());
    stack(sim, BLANK, EXTREME_RISK_CARD, ONE_ICON);
    round1 = act(sim, { targets: [BLACK_WIDOW] }, endTurn());
    const events = round1.events;
    // Black Widow is a Thunderbolt minion engaged with him: Citizen V gives up his attack, she attacks for 1.
    expect(ofType(events, "enemyActivated").map((e) => codeOf(sim.state, e.enemyInstanceId))).toEqual([
      CITIZEN_V,
      BLACK_WIDOW,
    ]);
    expect(ofType(events, "encounterCardRevealed").map((e) => codeOf(sim.state, e.instanceId))).toEqual([
      EXTREME_RISK_CARD,
      JOYSTICK,
    ]);
    expect(ofType(events, "revealedInPlay")).toMatchObject([{ cardId: JOYSTICK, engaged: true }]);
    expect(attacksBy(events, sim, JOYSTICK)).toMatchObject([{ baseAtk: 1, boostIcons: 1, damageDealt: 2 }]);
    expect(damageOf(sim, me(sim))).toBe(1 + 2);
    expect(engagedWith(sim, idOf(sim, JOYSTICK))).toBe(P1);
    // Extreme Risk ends in the encounter discard pile; its activation happened, so it did not surge.
    expect(piles(sim.state).discard.map((i) => codeOf(sim.state, i))).toContain(EXTREME_RISK_CARD);
  });

  // 51039 prints "Forced Interrupt: When Joystick activates against you ..."; Extreme Risk's "Joystick activates against you"
  // is such an activation (owner ruling Q67, docs/phase7-wave5.md section 4.1), but no choice is offered.
  it.fails("Joystick's Forced Interrupt (51039) is offered when Extreme Risk makes her activate against Spider-Man", () => {
    expect(
      round1.asked.some((a) => a.kind === "chooseOption" && a.labels[0]?.startsWith("Give her 1 additional")),
    ).toBe(true);
  });

  it("round 1 end: Thunderbolt Backup holds Black Widow (the tie is the first player's choice) and Joystick stays engaged", () => {
    expect(round1.asked.filter((a) => a.kind === "chooseTarget")).toHaveLength(1);
    expect(heldBy(sim)).toBe(idOf(sim, BLACK_WIDOW));
    expect(engagedWith(sim, idOf(sim, JOYSTICK))).toBe(P1);
    expect(sim.state.round).toBe(2);
  });

  it("round 2: Spider-Man flips to alter-ego form and recovers 3", () => {
    const events = act(sim, {}, changeForm(), recover()).events;
    expect(ofType(events, "damageHealed")).toMatchObject([{ targetInstanceId: me(sim), amount: 3 }]);
    expect(damageOf(sim, me(sim))).toBe(0);
  });

  it("round 2 villain phase: Joystick's Forced Interrupt in a villain-phase activation gives her 1 additional boost card and Spider-Man draws 1 (2 boost cards, SCH 1 + 0 + 1); Energy Truncheon attaches to her", () => {
    // Boost cards in order: the interrupt's (0 icons), her own (1 icon); then the card dealt to Spider-Man.
    stack(sim, BLANK, ONE_ICON, TRUNCHEON);
    round2 = act(sim, { options: ["Give her 1 additional"], targets: [BLACK_WIDOW] }, endTurn());
    const events = round2.events;
    expect(
      round2.asked.some((a) => a.kind === "chooseOption" && a.labels[0]?.startsWith("Give her 1 additional")),
    ).toBe(true);
    // Black Widow is held (she does not activate), so only Citizen V (who gives up his scheme) and Joystick activate.
    expect(ofType(events, "enemyActivated").map((e) => codeOf(sim.state, e.enemyInstanceId))).toEqual([
      CITIZEN_V,
      JOYSTICK,
    ]);
    expect(boostsDealt(events, sim, JOYSTICK)).toHaveLength(2);
    expect(schemesBy(events, sim, JOYSTICK)).toMatchObject([{ baseSch: 1, boostIcons: 1, threatPlaced: 2 }]);
    expect(ofType(events, "cardDrawn").length).toBeGreaterThanOrEqual(1);
    // Energy Truncheon: "Attach to Joystick" (she is in play).
    truncheon = inPlayCard(sim.state, TRUNCHEON)!;
    expect(inst(sim.state, truncheon).attachedTo).toBe(idOf(sim, JOYSTICK));
    // The round-end swap was a tie (both undamaged): Black Widow, chosen, stays held; Joystick stays engaged.
    expect(heldBy(sim)).toBe(idOf(sim, BLACK_WIDOW));
    expect(engagedWith(sim, idOf(sim, JOYSTICK))).toBe(P1);
    expect(sim.state.round).toBe(3);
  });

  it("round 3: in hero form the Truncheon's Hero Action makes Joystick attack Spider-Man (its +1 ATK from the data, piercing), then discards it and draws 1", () => {
    act(sim, {}, changeForm());
    stack(sim, ONE_ICON);
    const handBefore = playerOf(sim.state, P1).hand.length;
    const events = act(sim, {}, use(P1, truncheon, "51040.energy-truncheon-action")).events;
    // Energy Truncheon prints +1 ATK in its data: Joystick 1 + 1, with one boost icon.
    expect(attacksBy(events, sim, JOYSTICK)).toMatchObject([{ baseAtk: 2, boostIcons: 1, damageDealt: 3 }]);
    expect(inPlayCard(sim.state, TRUNCHEON)).toBeUndefined();
    expect(piles(sim.state).discard).toContain(truncheon);
    expect(ofType(events, "cardDrawn")).toHaveLength(1);
    expect(playerOf(sim.state, P1).hand).toHaveLength(handBefore + 1);
    expect(damageOf(sim, me(sim))).toBe(3);
  });

  it("round 3 villain phase: Playing for Keeps is dealt and enters play with 3 threat (3 per player)", () => {
    // Joystick attacks (Citizen V gives up): her interrupt's boost card, her own, then the card dealt to Spider-Man.
    stack(sim, BLANK, "01189", KEEPS);
    round3 = act(sim, { options: ["Give her 1 additional"], targets: [BLACK_WIDOW] }, endTurn());
    const keeps = inPlayCard(sim.state, KEEPS)!;
    expect(keeps).toBeDefined();
    expect(inst(sim.state, keeps).threat).toBe(3);
    expect(ofType(round3.events, "encounterCardRevealed").map((e) => codeOf(sim.state, e.instanceId))).toEqual([KEEPS]);
    expect(boostsDealt(round3.events, sim, JOYSTICK)).toHaveLength(2);
    expect(attacksBy(round3.events, sim, JOYSTICK)).toMatchObject([{ baseAtk: 1 }]);
    expect(sim.state.round).toBe(4);
  });

  it("round 4: Spider-Man's hand size is 1 higher and each activation gets 1 extra boost card on top of Joystick's own (3 boost cards)", () => {
    // Alter-ego form: Joystick schemes. Boost cards: Keeps' interrupt, hers, her own: 3. Hand size 6 + 1 = 7 at the end of the turn.
    act(sim, {}, changeForm(), recover());
    stack(sim, BLANK, FILLER, "01189", TWO_ICON);
    const events = act(sim, { options: ["Give her 1 additional"], targets: [BLACK_WIDOW] }, endTurn()).events;
    expect(boostsDealt(events, sim, JOYSTICK)).toHaveLength(3);
    expect(playerOf(sim.state, P1).hand).toHaveLength(7);
  });

  it("invariants: nothing pending, no card in two zones, Spider-Man alive, Joystick and Black Widow still in play", () => {
    expectInvariants(sim);
    expect(sim.state.outcome).toBeNull();
    expect(inPlayCard(sim.state, JOYSTICK)).toBeDefined();
    expect(inPlayCard(sim.state, BLACK_WIDOW)).toBeDefined();
  });
});

describe("Thunderbolts scenario with Growing Strong: solo (Spider-Man), standard, seed 6", () => {
  const { sim, config } = open(6);
  let round1: { events: GameEvent[]; asked: Asked[] };
  let round2: { events: GameEvent[]; asked: Asked[] };
  let round3: { events: GameEvent[]; asked: Asked[] };
  let atlasHp = 0;

  const atlas = () => idOf(sim, ATLAS);
  const growth = () => inst(sim.state, atlas()).counters["growth"] ?? 0;

  it("setup: the seeded draw is Growing Strong and Supersonic; MACH-IV is engaged, Atlas held with no growth counter", () => {
    expect((config.setAsideModularSets ?? []).map((m) => m.encounterSetId)).toEqual(["growing_strong", "supersonic"]);
    expect(engagedWith(sim, idOf(sim, MACH_IV))).toBe(P1);
    expect(heldBy(sim)).toBe(atlas());
    expect(growth()).toBe(0);
    atlasHp = hpOf(sim, atlas());
    const deck = deckCodes(sim);
    expect(deck[ATLAS]).toBeUndefined();
    expect([deck[GROW_INVULNERABLE], deck[GROWING_STRONG_CARD], deck[TITANIC]]).toEqual([1, 2, 2]);
  });

  it("round 1 villain phase: Growing Strong finds Atlas (held, so in play), engages Spider-Man and he attacks: ATK 3 + 1 icon = 4", () => {
    act(sim, {}, changeForm());
    stack(sim, BLANK, GROWING_STRONG_CARD, ONE_ICON);
    round1 = act(sim, { targets: [MACH_IV] }, endTurn());
    const events = round1.events;
    expect(attacksBy(events, sim, MACH_IV)).toMatchObject([{ baseAtk: 2, boostIcons: 0, damageDealt: 2 }]);
    expect(ofType(events, "revealedInPlay")).toMatchObject([{ cardId: ATLAS, engaged: true }]);
    expect(attacksBy(events, sim, ATLAS)).toMatchObject([{ baseAtk: 3, boostIcons: 1, damageDealt: 4 }]);
    expect(damageOf(sim, me(sim))).toBe(6);
    expect(engagedWith(sim, atlas())).toBe(P1);
  });

  it("round 1 end: MACH-IV is held (tie), and after the villain phase Atlas gets a growth counter: +2 hit points", () => {
    expect(heldBy(sim)).toBe(idOf(sim, MACH_IV));
    expect(ofType(round1.events, "counterAdded")).toMatchObject([{ counterType: "growth", amount: 1 }]);
    expect(growth()).toBe(1);
    expect(hpOf(sim, atlas())).toBe(atlasHp + 2);
  });

  it("round 2: Spider-Man flips to alter-ego form and recovers 3", () => {
    const events = act(sim, {}, changeForm(), recover()).events;
    expect(ofType(events, "damageHealed")).toMatchObject([{ targetInstanceId: me(sim), amount: 3 }]);
    expect(damageOf(sim, me(sim))).toBe(3);
  });

  it("round 2 villain phase: Titanic Proportions deals 1 indirect damage (1 growth counter), surges, and Grow Invulnerable enters with 5 + 1 threat", () => {
    stack(sim, FILLER, TITANIC, GROW_INVULNERABLE, "01189");
    round2 = act(sim, {}, endTurn());
    const events = round2.events;
    expect(schemesBy(events, sim, ATLAS)).toMatchObject([{ baseSch: 0, boostIcons: 0, threatPlaced: 0 }]);
    expect(ofType(events, "encounterCardRevealed").map((e) => codeOf(sim.state, e.instanceId))).toEqual([
      TITANIC,
      GROW_INVULNERABLE,
    ]);
    expect(ofType(events, "damageDealt").filter((e) => e.targetInstanceId === me(sim))).toMatchObject([{ amount: 1 }]);
    const scheme = inPlayCard(sim.state, GROW_INVULNERABLE)!;
    // Printed starting threat 5, then "1 additional threat for each growth counter on Atlas" (1).
    expect(inst(sim.state, scheme).threat).toBe(6);
  });

  it("round 2 end: Atlas is held in MACH-IV's place and grows again: 2 counters, +4 hit points", () => {
    expect(heldBy(sim)).toBe(atlas());
    expect(engagedWith(sim, idOf(sim, MACH_IV))).toBe(P1);
    expect(growth()).toBe(2);
    expect(hpOf(sim, atlas())).toBe(atlasHp + 4);
  });

  it("round 3 villain phase: Titanic Proportions as a boost card gives Atlas a counter; Growing Strong re-engages him and its boost gives him a tough card", () => {
    act(sim, {}, recover());
    stack(sim, TITANIC, GROWING_STRONG_CARD, GROWING_STRONG_CARD, TWO_ICON, "01189");
    round3 = act(sim, { targets: [MACH_IV] }, endTurn());
    const events = round3.events;
    // MACH-IV's activation: Titanic Proportions' boost, 1 growth counter on Atlas (held, in play).
    expect(boostsDealt(events, sim, MACH_IV).map((e) => codeOf(sim.state, e.instanceId))).toEqual([TITANIC]);
    expect(ofType(events, "counterAdded").map((e) => [codeOf(sim.state, e.instanceId), e.counterType])).toEqual([
      [ATLAS, "growth"],
      [ATLAS, "growth"],
    ]);
    // Growing Strong (revealed): Atlas engages and schemes with Growing Strong's own boost card: a tough status.
    expect(ofType(events, "statusGiven")).toMatchObject([{ instanceId: atlas(), status: "tough" }]);
    expect(engagedWith(sim, atlas())).toBe(P1);
    expect(growth()).toBe(4); // 2, +1 (Titanic boost), +1 (after the villain phase)
    expect(hpOf(sim, atlas())).toBe(atlasHp + 8);
  });

  it("invariants: nothing pending, no card in two zones, Spider-Man alive", () => {
    expectInvariants(sim);
    expect(sim.state.outcome).toBeNull();
  });
});

describe("Thunderbolts scenario with the other new sets", () => {
  it.todo(
    "a seed drawing Techno (Falcon, 53038 to 53042): its minion joins the Thunderbolts pool and its cards come up (waits on the Techno script, spec 8.1 item 51)",
  );
  it.todo(
    "a seed drawing Whiteout (Winter Soldier, 54034 to 54037): its minion joins the Thunderbolts pool and its cards come up (waits on the Whiteout script, spec 8.1 item 59)",
  );
});
