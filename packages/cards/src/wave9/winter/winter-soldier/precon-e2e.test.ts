import {
  cardsInPlay,
  characterProfile,
  hasKeyword,
  maxHitPoints,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { mergeRegistries } from "../../../dsl/index.js";
import {
  P1,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  play,
  playerOf,
  resourceAbility,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, stageNemesisCardForReveal } from "../../../testing/staging.js";
import { WAVE8_ABILITIES } from "../../../wave8/index.js";
import { WINTER_ASPECT_BASIC } from "../aspect-basic.js";
import { engageMinion, stagedInPlay, wsGame, wsHeroGame } from "../testing.js";
import { WINTER_SOLDIER_EVENTS } from "./events.js";
import { WINTER_SOLDIER_IDENTITY } from "./identity.js";
import { WINTER_SOLDIER_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { WINTER_SOLDIER_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";

vi.setConfig({ testTimeout: 240_000 });

/**
 * Whole-game test for Winter Soldier's printed precon (`winter-aggression`, cards 54001 to 54026 and 54032/54033)
 * against Core's Rhino (standard, solo), docs/phase7-wave9.md section 8.4 ("Winter Soldier starter deck e2e"). Four
 * rounds played through the engine's real commands, one decision at a time, ending with Rhino's stage I defeated and
 * stage II attacking. Only the deck order and the encounter deck are seeded (`moveToHand` for the cards a round needs,
 * `stackEncounterDeck` and `stageNemesisCardForReveal` for the villain phase); every play, ability and attack is a
 * command the engine validates. Deterministic by seed (1). Dependencies are `WAVE8_ABILITIES`, the pack's aspect/basic
 * cards and Winter Soldier's own four modules only.
 *
 * Rules the game leans on (RRG 1.8 = mc_rulesreference_v18_compressed.md):
 * - Guard (p. 24): a guard minion stops the engaged player attacking the villain only, so the Sandman (no guard) can
 *   be attacked while the Hydra Mercenary stands.
 * - Overkill, Piercing, Ranged, Stun, Confuse, Toughness, Quickstrike, Steady (Keywords, pp. 29-41): see each step.
 * - Cost (p. 13): a wild counts as any type, so Cybernetic Arm paying for Electrical Discharge would stun.
 * - Response (p. 40): responses to one triggering condition resolve in any order, once the effect that caused it has
 *   finished, so Firepower's two defeating assignments are one attack, answered once after the whole event.
 * - Villain phase (Appendix II, pp. 51-52): step 1 threat, step 2 the villain then the minions activate (a stunned
 *   enemy loses its attack instead), step 4 reveal; a minion that engages during the reveal with Quickstrike attacks.
 * - End of player phase: discard, draw up to hand size, ready all cards, so an Arm exhausted in the villain phase
 *   stays tired through the next player phase.
 */
const DEPS: EngineDeps = {
  abilities: mergeRegistries(
    WAVE8_ABILITIES,
    WINTER_ASPECT_BASIC,
    WINTER_SOLDIER_IDENTITY,
    WINTER_SOLDIER_EVENTS,
    WINTER_SOLDIER_SUPPORT_UPGRADES_ALLIES,
    WINTER_SOLDIER_OBLIGATION_NEMESIS,
  ),
};

interface Plan {
  readonly take?: readonly string[];
  readonly labels?: readonly string[];
  readonly targets?: readonly string[];
  readonly many?: readonly string[];
  readonly defend?: boolean;
  /** Pays an optional card's cost: with Cybernetic Arm, or with this many hand cards (the first offered). */
  readonly pay?: "arm" | "cards";
  /** Enemy-attack interrupts to decline (by the attacking enemy's instance id); other attacks take `take`. */
  readonly declineAttackBy?: readonly string[];
}
const planner = (plan: Plan): Picker => {
  const labels = [...(plan.labels ?? [])];
  const targets = [...(plan.targets ?? [])];
  return (s) => {
    const choice = s.pendingChoice!;
    const offered = choice.options.map((o) => o.optionId as string);
    switch (choice.prompt.kind) {
      case "payForCard": {
        const arm = offered.find((o) => o.startsWith("ability:"));
        if (plan.pay === "arm" && arm) return [arm];
        return offered.filter((o) => o.startsWith("hand:")).slice(0, choice.prompt.cost);
      }
      case "chooseTriggers": {
        const ev = choice.prompt.event as { kind?: string; enemyInstanceId?: string };
        if (ev.kind === "enemyAttack" && plan.declineAttackBy?.includes(ev.enemyInstanceId ?? "")) return [];
        const hit = offered.find((o) => plan.take?.some((t) => o.endsWith(t)));
        return hit ? [hit] : [];
      }
      case "declareDefender":
        return plan.defend ? [identityOf(s)] : ["decline"];
      case "discardDownToHandSize":
        return firstLegal(s);
      default: {
        if (plan.many && choice.prompt.kind === "chooseCards") return plan.many.filter((m) => offered.includes(m));
        if (targets[0] && offered.includes(targets[0])) return [targets.shift()!];
        const want = labels[0];
        const hit = want ? choice.options.find((o) => o.label.startsWith(want)) : undefined;
        if (hit) {
          labels.shift();
          return [hit.optionId];
        }
        return firstLegal(s);
      }
    }
  };
};

let state: GameState;
const act = (plan: Plan, ...commands: readonly Command[]): GameEvent[] => {
  const r = driveEventsPicking(DEPS, state, planner(plan), ...commands);
  state = r.state;
  return [...r.events];
};
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const code = (id: InstanceId): string => inst(state, id).cardId as string;
const handOf = (c: string): InstanceId[] => playerOf(state, P1).hand.filter((i) => code(i) === c);
const handCodes = (): string[] => playerOf(state, P1).hand.map(code);
const discardCodes = (): string[] => playerOf(state, P1).discard.map(code);
const inPlayAll = (c: string): InstanceId[] => cardsInPlay(state).filter((i) => code(i) === c);
const inPlayOf = (c: string): InstanceId | undefined => inPlayAll(c)[0];
const give = (...codes: string[]) => {
  state = moveToHand(state, P1, ...codes).state;
};
const stack = (...codes: string[]) => {
  state = stackEncounterDeck(state, ...codes);
};
const villain = (): InstanceId => state.activeVillainId!;
const mainScheme = (): InstanceId => state.mainScheme.instanceId;
const mainThreat = (): number => inst(state, mainScheme()).threat;
const damageOn = (id: InstanceId): number => inst(state, id).damage;
const countersOf = (id: InstanceId) => inst(state, id).counters;
const me = (): InstanceId => identityOf(state);
const changeForm = (): Command => ({ type: "changeForm", playerId: P1 });
const playFrom = (c: string, pay: readonly InstanceId[], extra: Parameters<typeof play>[3] = {}): Command =>
  play(P1, handOf(c)[0]!, pay, extra);
const armPays = () => resourceAbility(inPlayOf("54002")!, "54002.cybernetic-arm-resource");
const basicAttack = (by: InstanceId, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: by,
  targetInstanceId: target,
});
const ENHANCED = "54001b.cybernetically-enhanced";
const SAFE_HOUSE = "54007.safe-house-30-action";
const MAN_ON_THE_WALL = "54019.man-on-the-wall-action";
const LETHAL = "lethal-protector";
const MASK = "winter-mask-response";

// Instances the later rounds refer back to.
let merc: InstanceId;
let sandman: InstanceId;
let hitSquad: InstanceId;
let crossbones: InstanceId;
let rhinoI: InstanceId;

const cardsOf = (events: readonly GameEvent[]) => ofType(events, "cardPlayed");
const hitsOn = (events: readonly GameEvent[]) =>
  ofType(events, "damageDealt").map((e) => [code(e.targetInstanceId), e.amount] as const);

describe("Winter Soldier (Aggression) precon against Rhino (standard, solo), seed 1", () => {
  it("setup: 40-card deck, hand of 6 in alter-ego form, nemesis set aside, Rhino 14 hit points", () => {
    state = wsGame({ seed: 1 });
    const p = playerOf(state, P1);
    expect(p.identity.form).toBe("alterEgo");
    expect(p.hand).toHaveLength(6);
    expect(p.deck).toHaveLength(34);
    expect(p.discard).toHaveLength(0);
    expect(handCodes().sort()).toEqual(["54007", "54008", "54008", "54015", "54016", "54026"]);
    expect(p.setAside.map(code).sort()).toEqual(["54028", "54029", "54030", "54031", "54031"]);
    expect(maxHitPoints(state, villain(), DEPS)).toBe(14);
    expect(maxHitPoints(state, me(), DEPS)).toBe(11);
    expect(mainThreat()).toBe(0);
    expect(state.round).toBe(1);
    expect(state.pendingChoice).toBeNull();
  });

  it("round 1, alter ego: Cybernetically Enhanced spends a Strength and searches Cybernetic Arm into play, shuffling", () => {
    const events = act({}, use(P1, me(), ENHANCED, [{ fromHand: handOf("54026")[0]! }]));
    // RRG "Search" (p. 39): the deck is shuffled afterward. The Arm enters play (not played: no cost) as an upgrade.
    expect(ofType(events, "deckShuffled")).toHaveLength(1);
    const arm = inPlayOf("54002")!;
    expect(inst(state, arm).attachedTo).toBe(me());
    expect(inst(state, arm).exhausted).toBe(false);
    expect(discardCodes()).toEqual(["54026"]);
    expect(playerOf(state, P1).hand).toHaveLength(5);
    expect(playerOf(state, P1).deck).toHaveLength(33);
    // A spent resource is the cost, so the action is not exhaust-limited: the identity stays ready.
    expect(inst(state, me()).exhausted).toBe(false);
  });

  it("round 1: Safe House #30 pulls a Hydra Mercenary (guard) engaged with Bucky from the encounter deck and draws 1", () => {
    const played = act({}, playFrom("54007", [handOf("54008")[0]!]));
    expect(cardsOf(played)).toMatchObject([{ resourcesPaid: 1 }]);
    const house = inPlayOf("54007")!;
    const encounterBefore = Object.values(state.encounterDecks)[0]!.deck.length;
    const events = act({ labels: ["Hydra Mercenary"] }, use(P1, house, SAFE_HOUSE));
    merc = cardsInPlay(state).find((i) => code(i) === "01101")!;
    expect(inst(state, merc).engagedWith).toBe(P1);
    expect(inst(state, house).exhausted).toBe(true);
    expect(ofType(events, "deckShuffled")).toHaveLength(1);
    expect(Object.values(state.encounterDecks)[0]!.deck).toHaveLength(encounterBefore - 1);
    // "Then, draw 1 card": 5 - 1 (paid) - 1 (Safe House) + 1.
    expect(ofType(events, "cardDrawn")).toHaveLength(1);
    expect(handCodes().sort()).toEqual(["54008", "54015", "54016", "54023"]);
  });

  it("round 1 villain phase: Rhino schemes 1; the obligation Red Room Programming discards the highest printed cost card for indirect damage", () => {
    stack("01104", "54027");
    const events = act({ labels: ["Discard the highest", "Silent Infiltration"] }, endTurn());
    // Step 2: Rhino schemes (SCH 1 + 0 boost icons), the Mercenary (SCH 0) adds nothing.
    expect(ofType(events, "schemeResolved")).toMatchObject([
      { baseSch: 1, boostIcons: 0, threatPlaced: 1 },
      { baseSch: 0, boostIcons: 0, threatPlaced: 0 },
    ]);
    // Step 4: the obligation is dealt and resolves; tied at printed cost 2 (Silent Infiltration, Winter Widow Soldier
    // Spy, Electrical Discharge drawn at end of turn), the player picks Silent Infiltration (cost 2) and Bucky takes 2.
    expect(ofType(events, "encounterCardRevealed")).toMatchObject([{ cardId: "54027", playerId: P1 }]);
    expect(discardCodes()).toContain("54008");
    expect(damageOn(me())).toBe(2);
    expect(inPlayOf("54027")).toBeUndefined();
    // Acceleration 1 + Rhino's scheme 1.
    expect(mainThreat()).toBe(2);
    expect(state.round).toBe(2);
    expect(state.pendingChoice).toBeNull();
  });

  it("round 2, hero: Winter Armor (+3 hit points, steady) and Winter Mask; Spoiling for a Fight brings in a Sandman", () => {
    act({}, changeForm());
    expect(playerOf(state, P1).identity.form).toBe("hero");
    give("54009", "54010", "54005", "54011", "54024", "54025", "54026", "54017", "54017", "54017");
    expect(hasKeyword(state, me(), "steady", DEPS)).toBe(false);
    const armor = act({}, playFrom("54009", [handOf("54026")[0]!]));
    // Strength produces 2 physical.
    expect(cardsOf(armor)).toMatchObject([{ resourcesPaid: 2 }]);
    expect(maxHitPoints(state, me(), DEPS)).toBe(14);
    expect(hasKeyword(state, me(), "steady", DEPS)).toBe(true);
    const mask = act({}, playFrom("54010", [handOf("54016")[0]!]));
    expect(cardsOf(mask)).toMatchObject([{ resourcesPaid: 1 }]);
    // The Sandman is the first minion off the encounter deck; it enters engaged with the Toughness keyword's tough status.
    stack("01102");
    act({}, playFrom("54016", []));
    sandman = cardsInPlay(state).find((i) => code(i) === "01102")!;
    expect(inst(state, sandman).engagedWith).toBe(P1);
    expect(inst(state, sandman).statuses.tough).toBe(1);
    expect(inst(state, me()).exhausted).toBe(false);
  });

  it("round 2: Metal Punch paid by Cybernetic Arm: 7 + 1 = 8 to the Mercenary (3 hit points), overkill spills 5 to Rhino; Lethal Protector and Winter Mask answer", () => {
    const events = act(
      { take: [LETHAL, MASK], targets: [merc] },
      playFrom("54005", [handOf("54015")[0]!, handOf("54017")[0]!], { abilities: [armPays()] }),
    );
    // Cost 3: the Arm's wild + One by One + Aggressive Stance.
    expect(cardsOf(events)).toMatchObject([{ resourcesPaid: 3 }]);
    // Overkill (RRG p. 33): the excess over the minion's 3 hit points is dealt to the villain. The Arm adds 1 to the
    // 7 (Cybernetic Arm text; Q53 ruling: to the event's own damage).
    expect(hitsOn(events)).toEqual([
      ["01101", 8],
      ["01094", 5],
    ]);
    expect(ofType(events, "characterDefeated")).toMatchObject([{ instanceId: merc }]);
    expect(damageOn(villain())).toBe(5);
    expect(inst(state, inPlayOf("54002")!).exhausted).toBe(true);
    // Lethal Protector: 2 threat off the main scheme (2 -> 0); Winter Mask: draw 1 (exhausting the Mask).
    expect(ofType(events, "threatRemoved")).toMatchObject([{ schemeInstanceId: mainScheme(), amount: 2 }]);
    expect(mainThreat()).toBe(0);
    expect(ofType(events, "cardDrawn")).toHaveLength(1);
    expect(inst(state, inPlayOf("54010")!).exhausted).toBe(true);
    rhinoI = villain();
  });

  it("round 2: Winter Rifle on a basic attack: 2 + 2 = 4, piercing discards the Sandman's tough first, so it is defeated; Silent Infiltration readies the hero and confuses Rhino", () => {
    const rifle = act({}, playFrom("54011", [handOf("54024")[0]!, handOf("54017")[0]!]));
    expect(cardsOf(rifle)).toMatchObject([{ resourcesPaid: 3 }]);
    give("54008");
    act({}, playFrom("54008", [handOf("54025")[0]!]));
    const events = act(
      { take: [LETHAL, "silent-infiltration-response", "winter-rifle-interrupt"], targets: [sandman] },
      basicAttack(me(), sandman),
    );
    // RRG "Piercing" (p. 32): the tough status is discarded before damage; the full 4 lands on the 4-hit-point Sandman.
    expect(ofType(events, "statusRemoved")).toMatchObject([
      { instanceId: sandman, status: "tough", reason: "piercing" },
    ]);
    expect(hitsOn(events)).toEqual([["01102", 4]]);
    expect(ofType(events, "characterDefeated")).toMatchObject([{ instanceId: sandman }]);
    expect(inst(state, inPlayOf("54011")!).exhausted).toBe(true);
    // Lethal Protector is answered with no threat left to remove (the main scheme is empty): no threat is removed.
    expect(ofType(events, "threatRemoved")).toHaveLength(0);
    // Silent Infiltration: the hero (exhausted by the attack) is readied and Rhino, the only enemy, is confused.
    expect(ofType(events, "cardReadied")).toMatchObject([{ instanceId: me() }]);
    expect(inst(state, me()).exhausted).toBe(false);
    expect(inst(state, villain()).statuses.confused).toBe(1);
    expect(inPlayOf("54008")).toBeUndefined();
  });

  it("round 2: Electrical Discharge paid with an energy resource deals 4 and stuns Rhino", () => {
    const events = act({ targets: [villain()] }, playFrom("54006", [handOf("54016")[0]!, handOf("54017")[0]!]));
    expect(cardsOf(events)).toMatchObject([{ resourcesPaid: 2, paid: { energy: 1, mental: 1 } }]);
    expect(hitsOn(events)).toEqual([["01094", 4]]);
    expect(damageOn(villain())).toBe(9);
    expect(inst(state, villain()).statuses.stunned).toBe(1);
  });

  it("round 2 villain phase: the stun cancels Rhino's attack; the nemesis side scheme Hydra Hit Squad enters with 3 threat", () => {
    state = stageNemesisCardForReveal(state, "54029", P1, 0);
    const events = act({}, endTurn());
    expect(ofType(events, "statusRemoved")).toMatchObject([
      { instanceId: rhinoI, status: "stunned", reason: "cancelledAttack" },
    ]);
    expect(ofType(events, "damageDealt")).toHaveLength(0);
    hitSquad =
      cardsInPlay(state).find((i) => code(i) === "54029") ??
      Object.values(state.instances).find((i) => (i.cardId as string) === "54029")!.instanceId;
    expect(inst(state, hitSquad).threat).toBe(3);
    // The Arm was readied at the end of the player phase, the hero keeps the 2 indirect damage.
    expect(inst(state, inPlayOf("54002")!).exhausted).toBe(false);
    expect(damageOn(me())).toBe(2);
    expect(inst(state, villain()).statuses).toMatchObject({ stunned: 0, confused: 1 });
    expect(damageOn(villain())).toBe(9);
    expect(state.round).toBe(3);
  });

  it("round 3: Aggressive Stance and Man on the Wall enter; Black Widow returns Metal Punch; Deathlok searches S.H.I.E.L.D. Sidearm onto himself", () => {
    give("54017", "54019", "54003", "54026", "54025", "54024", "54015", "54006");
    act({}, playFrom("54017", [handOf("54023")[0]!]));
    act({}, playFrom("54019", [handOf("54012")[0]!]));
    expect(inPlayOf("54017")).toBeDefined();
    expect(inPlayOf("54019")).toBeDefined();
    const handBefore = handCodes();
    const widow = act(
      { take: ["black-widow-response"], labels: ["Metal Punch"] },
      playFrom("54003", [handOf("54026")[0]!, handOf("54020")[0]!]),
    );
    expect(cardsOf(widow)).toMatchObject([{ resourcesPaid: 3 }]);
    // Response: an Attack event from the discard pile returns to hand.
    expect(handCodes()).toContain("54005");
    expect(discardCodes()).not.toContain("54005");
    expect(handBefore).not.toContain("54005");
    const deathlok = act(
      { take: ["deathlok-response"] },
      playFrom("54013", [handOf("54024")[0]!, handOf("54015")[0]!]),
    );
    expect(ofType(deathlok, "deckShuffled")).toHaveLength(1);
    const dl = inPlayOf("54013")!;
    const sidearms = inst(state, dl).attachments;
    expect(sidearms.map(code)).toEqual(["54020"]);
    expect(countersOf(sidearms[0]!)).toEqual({ ammo: 3 });
  });

  it("round 3: Electrical Discharge paid without an energy resource deals 4 and does not stun", () => {
    const events = act({ targets: [villain()] }, playFrom("54006", [handOf("54025")[0]!]));
    expect(cardsOf(events)).toMatchObject([{ resourcesPaid: 2, paid: { energy: 0, mental: 2 } }]);
    expect(hitsOn(events)).toEqual([["01094", 4]]);
    expect(damageOn(villain())).toBe(13);
    expect(inst(state, villain()).statuses.stunned).toBe(0);
  });

  it("round 3 villain phase: Rhino hits (Arm Block declined); Crossbones enters with Hit Squad's +1 ATK and +2 hit points, quickstrikes, and Arm Block paid by the Arm deals 4 and prevents it", () => {
    state = stageNemesisCardForReveal(state, "54028", P1, 0);
    stack("01104", "54028", "01105");
    const rhino = villain();
    const events = act(
      {
        take: ["54004.arm-block-constant", "aggressive-stance-response"],
        declineAttackBy: [rhino],
        pay: "arm",
        labels: ["Firepower"],
      },
      endTurn(),
    );
    crossbones = cardsInPlay(state).find((i) => code(i) === "54028")!;
    // Rhino's undefended ATK 2 went through (Arm Block declined for it).
    expect(ofType(events, "damageDealt").filter((e) => e.targetInstanceId === me())).toMatchObject([{ amount: 2 }]);
    expect(damageOn(me())).toBe(4);
    // Hydra Hit Squad: Crossbones is a Hydra minion, ATK 2 + 1 and 5 + 2 hit points.
    const profile = characterProfile(state, crossbones, DEPS)!;
    expect([profile.atk, profile.maxHp]).toEqual([3, 7]);
    expect(inst(state, crossbones).engagedWith).toBe(P1);
    // Quickstrike attack on engaging: Arm Block paid by the Arm (wild 1): 3 + 1 to Crossbones; all damage prevented.
    const block = cardsOf(events).filter((e) => code(e.instanceId) === "54004");
    expect(block).toMatchObject([{ resourcesPaid: 1, paid: { wild: 1 } }]);
    expect(ofType(events, "damageDealt").filter((e) => e.targetInstanceId === crossbones)).toMatchObject([
      { amount: 4 },
    ]);
    expect(ofType(events, "damagePrevented")).toMatchObject([{ targetInstanceId: me(), amount: 3, reason: "effect" }]);
    expect(damageOn(crossbones)).toBe(4);
    expect(inst(state, inPlayOf("54002")!).exhausted).toBe(true);
    // Aggressive Stance (after you engage a minion): discarded, an Attack event fetched from the deck.
    expect(inPlayOf("54017")).toBeUndefined();
    expect(state.round).toBe(4);
  });

  it("round 4: Man on the Wall takes 1 off Bambino (one minion engaged); Bambino enters with 3 ammo", () => {
    expect(handCodes().filter((c) => c === "54014")).toHaveLength(2);
    give("54024");
    const wall = act({}, use(P1, inPlayOf("54019")!, MAN_ON_THE_WALL));
    expect(ofType(wall, "lastingEffectAdded")).toMatchObject([{ effect: { kind: "costReduction", amount: 1 } }]);
    expect(inst(state, inPlayOf("54019")!).exhausted).toBe(true);
    const played = act({}, playFrom("54018", [handOf("54024")[0]!], { attachToInstanceId: me() }));
    // Printed cost 3, reduced by 1: Energy's 2 energy pay it.
    expect(cardsOf(played)).toMatchObject([{ resourcesPaid: 2, paid: { energy: 2 } }]);
    expect(countersOf(inPlayOf("54018")!)).toEqual({ ammo: 3 });
    // Rifle and Bambino are both restricted: two is the limit (RRG "Restricted", p. 41), nothing was discarded.
    expect(inst(state, me()).attachments.map(code).sort()).toEqual([
      "54002",
      "54009",
      "54010",
      "54011",
      "54018",
      "54019",
    ]);
  });

  it("round 4: Deathlok's basic attack triggers his S.H.I.E.L.D. Sidearm: 1 damage to Crossbones first, then ATK 1", () => {
    const dl = inPlayOf("54013")!;
    const sidearm = inst(state, dl).attachments[0]!;
    const events = act({ take: ["shield-sidearm-interrupt"], targets: [crossbones] }, basicAttack(dl, crossbones));
    const onCrossbones = ofType(events, "damageDealt").filter((e) => e.targetInstanceId === crossbones);
    expect(onCrossbones).toMatchObject([
      { amount: 1, sourceInstanceId: sidearm },
      { amount: 1, sourceInstanceId: dl },
    ]);
    expect(damageOn(crossbones)).toBe(6);
    // Exhaust and remove 1 ammo are both the cost.
    expect(inst(state, sidearm).exhausted).toBe(true);
    expect(countersOf(sidearm)).toEqual({ ammo: 2 });
    // Deathlok's own consequential damage for an attack.
    expect(damageOn(dl)).toBe(1);
  });

  it("round 4: Firepower exhausting Rifle and Bambino: one attack with two 3-damage ranged assignments defeats Crossbones and then Rhino (I); Lethal Protector answers once", () => {
    const rifle = inPlayOf("54011")!;
    const bambino = inPlayOf("54018")!;
    const events = act(
      { take: [LETHAL, MASK], targets: [crossbones, villain(), mainScheme()] },
      playFrom("54014", [handOf("54005")[0]!], { costChoices: { exhausted: [rifle, bambino] } as never }),
    );
    expect(cardsOf(events)).toMatchObject([{ resourcesPaid: 1 }]);
    expect(inst(state, rifle).exhausted).toBe(true);
    expect(inst(state, bambino).exhausted).toBe(true);
    expect(hitsOn(events)).toEqual([
      ["54028", 3],
      ["01094", 3],
    ]);
    // Crossbones: 6 + 3 >= 7. Rhino: 13 + 3 >= 14: stage I is defeated mid-event and stage II takes its place.
    expect(ofType(events, "characterDefeated")).toMatchObject([{ instanceId: crossbones }]);
    expect(ofType(events, "villainStageAdvanced")).toMatchObject([{ stageIndex: 1 }]);
    expect(damageOn(villain())).toBe(0);
    expect(maxHitPoints(state, villain(), DEPS)).toBe(15);
    // Firepower is ONE attack (docs/phase7-wave9.md section 4.1 row 21 = B): Lethal Protector is offered once for
    // the two defeats, so 2 threat comes off the main scheme and Hydra Hit Squad is untouched.
    expect(ofType(events, "threatRemoved")).toMatchObject([{ schemeInstanceId: mainScheme(), amount: 2 }]);
    expect(inst(state, hitSquad).threat).toBe(3);
    // Winter Mask (exhaust -> draw 1) was answered once only: it is tired after the first.
    expect(ofType(events, "cardDrawn")).toHaveLength(1);
    expect(inst(state, inPlayOf("54010")!).exhausted).toBe(true);
  });

  it("round 4: Bambino on the hero's basic attack at Rhino (II): ATK 2 + 3, one ammo spent", () => {
    const bambino = inPlayOf("54018")!;
    const events = act({ take: ["bambino-interrupt"], targets: [villain()] }, basicAttack(me(), villain()));
    expect(hitsOn(events).filter(([c]) => c === "01094")).toEqual([["01094", 5]]);
    expect(countersOf(bambino)).toEqual({ ammo: 2 });
    expect(damageOn(villain())).toBe(5);
  });

  it("round 4 villain phase: Rhino (II) attacks; Arm Block paid by cards deals 3 and does not prevent the attack", () => {
    give("54004");
    stack("01104", "01108", "01101");
    const events = act({ take: ["54004.arm-block-constant"], pay: "cards" }, endTurn());
    const block = cardsOf(events).filter((e) => code(e.instanceId) === "54004");
    // Not paid by the Arm: 3 damage only, and the stage II ATK 3 lands.
    expect(block).toMatchObject([{ resourcesPaid: 1 }]);
    expect(block[0]!.paid.wild).toBe(0);
    expect(ofType(events, "damageDealt").filter((e) => e.targetInstanceId === villain())).toMatchObject([
      { amount: 3 },
    ]);
    expect(ofType(events, "damagePrevented")).toHaveLength(0);
    expect(ofType(events, "damageDealt").filter((e) => e.targetInstanceId === me())).toMatchObject([{ amount: 3 }]);
    expect(damageOn(villain())).toBe(8);
    expect(damageOn(me())).toBe(7);
    expect(state.round).toBe(5);
    expect(state.outcome).toBeNull();
  });

  it("invariants: no pending choice, no card in two zones, hand + deck + discard + in play = 40 of his cards", () => {
    const p = playerOf(state, P1);
    expect(state.pendingChoice).toBeNull();
    const attachedToMine = [p.identity.instanceId, ...p.playArea].flatMap((i) => inst(state, i).attachments);
    const inPlayMine = [...new Set([...p.playArea, ...attachedToMine])].filter((i) => inst(state, i).ownerId === P1);
    const zones = [...p.hand, ...p.deck, ...p.discard, ...inPlayMine];
    expect(new Set(zones).size).toBe(zones.length);
    expect(zones).toHaveLength(40);
    for (const id of zones) expect(inst(state, id).ownerId).toBe(P1);
    // Never in an encounter zone or set aside as well.
    expect(p.setAside.filter((i) => zones.includes(i))).toEqual([]);
    expect(inPlayMine.map(code).sort()).toEqual([
      "54002",
      "54003",
      "54007",
      "54009",
      "54010",
      "54011",
      "54013",
      "54018",
      "54019",
      "54020",
    ]);
  });
});

describe("interactions the Rhino game cannot reach, staged by surgery on the same deck (hero form)", () => {
  it("Winter Rifle's ranged: M.O.D.O.K.'s retaliate 2 hits the hero after a plain basic attack, not after a Rifle one (RRG Ranged, p. 36)", () => {
    const base = engageMinion(stagedInPlay(wsHeroGame(), "54011", { attach: true }).state, "01184", "modok");
    const modok = "modok" as InstanceId;
    state = base;
    act({}, basicAttack(me(), modok));
    expect(damageOn(modok)).toBe(2);
    expect(damageOn(me())).toBe(2);
    state = base;
    act({ take: ["winter-rifle-interrupt"] }, basicAttack(me(), modok));
    expect(damageOn(modok)).toBe(4);
    expect(damageOn(me())).toBe(0);
  });

  it("Electrical Discharge paid by Cybernetic Arm: the wild counts as energy, so it deals 4 + 1 and stuns (RRG Cost, p. 13)", () => {
    state = stagedInPlay(wsHeroGame(), "54002", { attach: true }).state;
    give("54006");
    const events = act({ targets: [villain()] }, playFrom("54006", [handOf("54016")[0]!], { abilities: [armPays()] }));
    expect(cardsOf(events)).toMatchObject([{ resourcesPaid: 2, paid: { wild: 1 } }]);
    expect(hitsOn(events)).toEqual([["01094", 5]]);
    expect(inst(state, villain()).statuses.stunned).toBe(1);
  });

  it("Firepower with three Weapons against three 2-hit-point minions is one attack: Lethal Protector is offered once for the three defeats", () => {
    let s = wsHeroGame();
    for (const weapon of ["54020", "54011", "54018"]) s = stagedInPlay(s, weapon, { attach: true }).state;
    for (const slot of ["b1", "b2", "b3"]) s = engageMinion(s, "01110", slot);
    state = patchInstance(s, s.mainScheme.instanceId, { threat: 10 });
    const weapons = inst(state, me()).attachments.filter((i) => ["54020", "54011", "54018"].includes(code(i)));
    expect(weapons).toHaveLength(3);
    give("54014");
    const events = act(
      { take: [LETHAL], targets: ["b1", "b2", "b3"] },
      playFrom("54014", [handOf("54016")[0]!], { costChoices: { exhausted: weapons } as never }),
    );
    expect(ofType(events, "characterDefeated")).toHaveLength(3);
    expect(ofType(events, "threatRemoved")).toMatchObject([{ amount: 2 }]);
    expect(mainThreat()).toBe(8);
  });
});
