import {
  cardsInPlay,
  activeEncounterDeck,
  encounterTopFaceup,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
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
import { driveEventsPicking, stackSetAside, withDamage } from "../../../testing/staging.js";
import { FALCON_DEPS, falconGame } from "../testing.js";

vi.setConfig({ testTimeout: 240_000 });

/**
 * Whole-game test for Falcon's printed precon (`falcon-leadership`, cards 53001 to 53028 and 53029 to 53033) against
 * Core's Rhino (standard, solo), docs/phase7-wave9.md section 8.4 ("Falcon starter deck e2e"). Played through the
 * engine's real commands, one decision at a time. Only the deck order and the encounter deck are seeded
 * (`moveToHand` for the cards a round needs, `stackEncounterDeck` and `stageNemesisCardForReveal` for the villain
 * phase); every play, ability and attack is a command the engine validates. Deterministic by seed (1). Dependencies are
 * `FALCON_DEPS` (every earlier script plus the pack's own modules).
 *
 * Known gaps this game avoids (recorded elsewhere): Aerial Recon's action (53009, not scripted), Talon Line (53012, not
 * offered in a real game), Redwing's "while ready" stand-in for the exhaust cost, Captain America's Shield (53034),
 * the Techno module and Strength in Diversity (53019).
 *
 * Rules the game leans on (RRG 1.8 = mc_rulesreference_v18_compressed.md):
 * - Search (p. 39): the deck is shuffled afterward. Response (p. 37): an optional response resolves after its trigger.
 * - Cost (p. 13): a card's printed cost is paid by resource icons; a wild counts as any type.
 * - Villain phase (Appendix II, pp. 51-52): step 1 threat, step 2 the villain then minions activate, step 4 reveal; a
 *   minion that engages during the reveal with Quickstrike attacks at once.
 * - End of player phase: discard, draw up to hand size, ready all cards.
 */
interface Plan {
  /** Instance ids (or option ids) to answer target prompts with, in order; the first offered when none matches. */
  readonly targets?: readonly string[];
  /** Label starts for chooseOption prompts, in order. */
  readonly labels?: readonly string[];
  /** Trigger-id suffixes to take when offered; every other optional trigger is declined. */
  readonly take?: readonly string[];
  /** The card code a search (chooseCards) picks. */
  readonly search?: string;
  /** One entry per declareDefender prompt: a card instance id or "decline"; "decline" when the queue is empty. */
  readonly defenders?: readonly string[];
  /** Up, Up, and Away's look: swap the two cards (otherwise keep them). */
  readonly swap?: boolean;
  /** Records each prompt kind and its labels, in order. */
  readonly seen?: { kind: string; labels: readonly string[] }[];
}

let state: GameState;
let beforeVillain2: GameState;
let afterVillain2: GameState;
const planner = (plan: Plan): Picker => {
  const targets = [...(plan.targets ?? [])];
  const labels = [...(plan.labels ?? [])];
  const defenders = [...(plan.defenders ?? [])];
  return (s) => {
    const choice = s.pendingChoice!;
    const offered = choice.options.map((o) => o.optionId as string);
    plan.seen?.push({ kind: choice.prompt.kind, labels: choice.options.map((o) => o.label) });
    switch (choice.prompt.kind) {
      case "chooseTriggers": {
        const hit = offered.find((o) => plan.take?.some((t) => o.endsWith(t)));
        return hit ? [hit] : [];
      }
      case "declareDefender": {
        const want = defenders.shift() ?? "decline";
        return offered.includes(want) ? [want] : ["decline"];
      }
      case "chooseCards": {
        const hit = plan.search
          ? choice.options.find((o) => (s.instances[o.optionId as InstanceId]?.cardId as string) === plan.search)
          : undefined;
        return hit ? [hit.optionId] : firstLegal(s);
      }
      case "chooseTarget": {
        const want = targets[0];
        if (want && offered.includes(want)) return [targets.shift()!];
        return firstLegal(s);
      }
      case "chooseOption": {
        const want = labels[0];
        const hit = want ? choice.options.find((o) => o.label.startsWith(want)) : undefined;
        if (hit) {
          labels.shift();
          return [hit.optionId];
        }
        return firstLegal(s);
      }
      case "rearrange":
        return plan.swap ? [...offered].reverse() : offered;
      default:
        return firstLegal(s);
    }
  };
};
const act = (plan: Plan, ...commands: readonly Command[]): GameEvent[] => {
  const r = driveEventsPicking(FALCON_DEPS, state, planner(plan), ...commands);
  state = r.state;
  return [...r.events];
};
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const code = (id: InstanceId): string => inst(state, id).cardId as string;
const handOf = (c: string): InstanceId[] => playerOf(state, P1).hand.filter((i) => code(i) === c);
const handCodes = (): string[] => playerOf(state, P1).hand.map(code);
const discardCodes = (): string[] => playerOf(state, P1).discard.map(code);
const inPlayOf = (c: string): InstanceId | undefined => cardsInPlay(state).find((i) => code(i) === c);
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
const me = (): InstanceId => identityOf(state);
const changeForm = (): Command => ({ type: "changeForm", playerId: P1 });
const playFrom = (c: string, pay: readonly InstanceId[], extra: Parameters<typeof play>[3] = {}): Command =>
  play(P1, handOf(c)[0]!, pay, extra);
const basicAttack = (by: InstanceId, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: by,
  targetInstanceId: target,
});
/** Cards drawn after the card `c` was played in `events` (the end-of-turn draw comes before it). */
const drawnAfterPlay = (events: readonly GameEvent[], c: string): number => {
  const at = events.findIndex((e) => e.type === "cardPlayed" && code(e.instanceId) === c);
  return events.slice(at).filter((e) => e.type === "cardDrawn").length;
};
const encounterDiscard = () => activeEncounterDeck(state).discard;
const hitsOn = (events: readonly GameEvent[]) =>
  ofType(events, "damageDealt").map((e) => [code(e.targetInstanceId), e.amount] as const);

const BIRDS = "53001b.birds-of-a-feather";
const EAGLE = "53001a.eagle-eyed";
const PROTECTOR = "53029.harlems-protector-action";
const KITCHEN = "53007.soup-kitchen-action";
const REDWING = "53002.redwing-action";
const FLOCK = "53006.falcons-flock-resource";
const FIRE = "53011.draw-their-fire-response";
const WEAVE = "53013.vibranium-microweave-interrupt";
const AWARE = "53010.battlefield-awareness-interrupt";
const EVAC = "53008.aerial-evacuation-interrupt";
const RECON = "53009.aerial-recon-interrupt";
const AWAY = "53005.up-up-and-away-response";
/** Core Rhino-deck cards with known boost areas: 01104 Hard to Keep Down none, 01188 Caught Off Guard one, 01100 Enhanced Ivory Horn two. */
const ZERO = "01104";
const ONE = "01188";
const TWO = "01100";
/** One-icon cards from the deck, given to the hand to pay costs with; each is worth 1 resource. */
const FODDER = [
  "53024",
  "53024",
  "53024",
  "53021",
  "53021",
  "53021",
  "53022",
  "53023",
  "53014",
  "53015",
  "53016",
  "53018",
  "53019",
  "53019",
  "53020",
];
let fodderUsed = 0;
const fodder = (n: number): InstanceId[] => {
  const codes = FODDER.slice(fodderUsed, fodderUsed + n);
  fodderUsed += n;
  const given = moveToHand(state, P1, ...codes);
  state = given.state;
  return [...given.ids];
};

describe("Falcon (Leadership) precon against Rhino (standard, solo), seed 1", () => {
  it("setup: 40-card deck, hand of 6 in alter-ego form, nemesis set aside, Rhino 14 hit points", () => {
    state = falconGame({ seed: 1 });
    const p = playerOf(state, P1);
    expect(p.identity.form).toBe("alterEgo");
    expect(p.hand).toHaveLength(6);
    expect(p.deck).toHaveLength(34);
    expect(handCodes().sort()).toEqual(["53008", "53009", "53010", "53019", "53020", "53028"]);
    expect(p.setAside.map(code).sort()).toEqual(["53030", "53031", "53032", "53032", "53033"]);
    expect(mainThreat()).toBe(0);
    expect(state.round).toBe(1);
    expect(state.pendingChoice).toBeNull();
  });

  it("round 1, alter ego: Birds of a Feather discards a card and searches Redwing into hand, shuffling; once per round", () => {
    const strength = handOf("53019")[0]!;
    const events = act({ search: "53002" }, use(P1, me(), BIRDS, [], { discard: [strength] }));
    expect(ofType(events, "deckShuffled")).toHaveLength(1);
    expect(discardCodes()).toEqual(["53019"]);
    expect(handCodes()).toContain("53002");
    expect(playerOf(state, P1).deck.map(code)).not.toContain("53002");
    // Limit once per round: the identity ability is no longer legal.
    expect(() => act({}, use(P1, me(), BIRDS, [], { discard: [handOf("53020")[0]!] }))).toThrow();
  });

  it("round 1: Soup Kitchen heals Sam Wilson by his REC (3) and makes the next ally free: Redwing is played for 0", () => {
    give("53007", "53026");
    state = withDamage(state, me(), 5);
    act({}, playFrom("53007", [handOf("53026")[0]!]));
    const kitchen = inPlayOf("53007")!;
    const events = act({}, use(P1, kitchen, KITCHEN));
    // Both exhausts are the cost; REC 3 heals 3 of the 5 damage.
    expect(inst(state, kitchen).exhausted).toBe(true);
    expect(inst(state, me()).exhausted).toBe(true);
    expect(damageOn(me())).toBe(2);
    expect(ofType(events, "lastingEffectAdded")).toHaveLength(1);
    const played = act({}, playFrom("53002", []));
    expect(ofType(played, "cardPlayed")).toMatchObject([{ resourcesPaid: 0 }]);
    const redwing = inPlayOf("53002")!;
    expect(inst(state, redwing).exhausted).toBe(false);
    expect(playerOf(state, P1).playArea).toContain(redwing);
  });

  it("round 1 villain phase: Rhino schemes 1; the obligation Harlem's Protector enters play with 3 emergency counters", () => {
    stack(ZERO, "53029");
    const events = act({}, endTurn());
    expect(ofType(events, "schemeResolved")[0]).toMatchObject({ baseSch: 1, threatPlaced: 1 });
    expect(ofType(events, "encounterCardRevealed")).toMatchObject([{ cardId: "53029", playerId: P1 }]);
    const protector = inPlayOf("53029")!;
    expect(inst(state, protector).counters).toEqual({ emergency: 3 });
    // Acceleration 1 + Rhino's scheme 1.
    expect(mainThreat()).toBe(2);
    expect(state.round).toBe(2);
    expect(state.pendingChoice).toBeNull();
  });

  it("round 2, alter ego: Harlem's Protector's action spends a resource to remove an emergency counter; The Power of Flight pays Hugin & Munin alone", () => {
    const protector = inPlayOf("53029")!;
    act({}, use(P1, protector, PROTECTOR, [{ fromHand: handOf("53020")[0]! }]));
    expect(inst(state, protector).counters).toEqual({ emergency: 2 });
    expect(discardCodes()).toContain("53020");
    // Aerial, cost 2: The Power of Flight counts double for an Aerial card.
    give("53017");
    const events = act({}, playFrom("53017", [handOf("53028")[0]!]));
    expect(ofType(events, "cardPlayed")).toMatchObject([{ resourcesPaid: 2 }]);
    expect(inPlayOf("53017")).toBeDefined();
  });

  it("round 2, hero: Falcon's constant shows the encounter deck's top card faceup during the player phase", () => {
    expect(encounterTopFaceup(state, FALCON_DEPS)).toBe(false);
    act({}, changeForm());
    expect(playerOf(state, P1).identity.form).toBe("hero");
    expect(encounterTopFaceup(state, FALCON_DEPS)).toBe(true);
  });

  it("round 2: Draw Their Fire (Aerial) is played; Eagle-Eyed answers by discarding the top card of the encounter deck", () => {
    give("53011");
    stack(ONE);
    const discardBefore = encounterDiscard().length;
    const events = act({ take: [EAGLE] }, playFrom("53011", fodder(1), { attachToInstanceId: me() }));
    expect(ofType(events, "cardPlayed")).toMatchObject([{ resourcesPaid: 1 }]);
    expect(inst(state, inPlayOf("53011")!).attachedTo).toBe(me());
    // Eagle-Eyed: the top card is discarded as an effect.
    expect(encounterDiscard()).toHaveLength(discardBefore + 1);
    expect(encounterDiscard().map((i) => code(i))).toContain(ONE);
  });

  it("round 2: Battlefield Awareness, Vibranium Microweave and Aerial Evacuation attach to Falcon", () => {
    give("53013");
    const aware = act({}, playFrom("53010", fodder(2), { attachToInstanceId: me() }));
    expect(ofType(aware, "cardPlayed")).toMatchObject([{ resourcesPaid: 2 }]);
    act({}, playFrom("53013", fodder(2), { attachToInstanceId: me() }));
    act({}, playFrom("53008", fodder(1), { attachToInstanceId: me() }));
    expect(inst(state, me()).attachments.map(code).sort()).toEqual(["53008", "53010", "53011", "53013"]);
  });

  it("round 2: Battlefield Awareness on a basic attack discards the top card (2 icons) for +2: 2 + 2 = 4 to Rhino", () => {
    stack(TWO);
    const aware = inPlayOf("53010")!;
    const events = act({ take: [AWARE] }, basicAttack(me(), villain()));
    expect(hitsOn(events)).toEqual([["01094", 4]]);
    expect(inst(state, aware).exhausted).toBe(true);
    expect(encounterDiscard().map((i) => code(i))).toContain(TWO);
    expect(damageOn(villain())).toBe(4);
    expect(inst(state, me()).exhausted).toBe(true);
  });

  it("round 2: Redwing's action discards the top card (2 icons), deals 2 damage to Rhino and returns him to hand", () => {
    stack(TWO);
    const redwing = inPlayOf("53002")!;
    const events = act({ labels: ["Deal"] }, use(P1, redwing, REDWING));
    expect(hitsOn(events)).toEqual([["01094", 2]]);
    expect(damageOn(villain())).toBe(6);
    expect(playerOf(state, P1).hand).toContain(redwing);
    expect(playerOf(state, P1).playArea).not.toContain(redwing);
    expect(encounterDiscard().map((i) => code(i))).toContain(TWO);
  });

  it("round 2: Falcon's Flock pays 1 of Redwing's cost (one bird counter); Eagle-Eyed answers Redwing's second entry", () => {
    give("53006");
    act({}, playFrom("53006", fodder(2)));
    const flock = inPlayOf("53006")!;
    expect(inst(state, flock).counters).toEqual({ bird: 5 });
    const discardBefore = encounterDiscard().length;
    const events = act(
      { take: [EAGLE] },
      play(P1, handOf("53002")[0]!, fodder(1), { abilities: [resourceAbility(flock, FLOCK)] }),
    );
    expect(ofType(events, "cardPlayed")).toMatchObject([{ resourcesPaid: 2 }]);
    expect(inst(state, flock).counters).toEqual({ bird: 4 });
    expect(inPlayOf("53002")).toBeDefined();
    expect(encounterDiscard().length).toBe(discardBefore + 1);
  });

  it("round 2: Bird of Prey discards a 1-icon top card for 4 + 1 = 5 damage to Rhino", () => {
    give("53003");
    stack(ONE);
    const events = act({ labels: ["Discard"], targets: [villain()] }, playFrom("53003", fodder(2)));
    expect(hitsOn(events)).toEqual([["01094", 5]]);
    expect(damageOn(villain())).toBe(11);
  });

  it("round 2 villain phase: Draw Their Fire lets Falcon defend without exhausting; Up, Up, and Away draws the boost card's icons; Vibranium Microweave prevents 1", () => {
    give("53005");
    // Two encounter cards are dealt in the villain phase (Harlem's Protector 53029's hazard icon): Hard to Keep Down (Rhino heals
    // 4) and "I'm Tough!" (a tough status). Neither schemes or attacks, so the main scheme's threat stays low.
    stack(TWO, "01104", "01105");
    beforeVillain2 = state;
    const fire = inPlayOf("53011")!;
    const events = act({ take: [FIRE, AWAY, WEAVE], defenders: [me()] }, endTurn());
    // After the villain phase begins: Draw Their Fire is discarded, and the defender is declared without exhausting.
    expect(playerOf(state, P1).discard).toContain(fire);
    expect(ofType(events, "defenderDeclared")).toMatchObject([{ defenderInstanceId: me(), withoutExhausting: true }]);
    expect(ofType(events, "cardExhausted").filter((e) => e.instanceId === me())).toHaveLength(0);
    expect(ofType(events, "cardPlayed").map((e) => code(e.instanceId))).toEqual(["53005"]);
    // Up, Up, and Away: Enhanced Ivory Horn (boost card, 2 printed icons) draws 2 cards.
    expect(drawnAfterPlay(events, "53005")).toBe(2);
    // Rhino's attack is 2 + 2 boost icons = 4; DEF 2 + 1 (Microweave) reduces it by 3 (RRG p. 51), so 1 would land;
    // Microweave prevents it and deals 1 damage to Rhino.
    expect(ofType(events, "attackResolved")[0]).toMatchObject({ baseAtk: 2, boostIcons: 2, defenseReduction: 3 });
    expect(ofType(events, "damagePrevented")).toMatchObject([{ targetInstanceId: me(), amount: 1 }]);
    // Still the 2 damage left on Sam Wilson in round 1: nothing new landed.
    expect(damageOn(me())).toBe(2);
    expect(ofType(events, "damageDealt").filter((e) => e.targetInstanceId === villain())).toMatchObject([
      { amount: 1 },
    ]);
    expect(inst(state, inPlayOf("53013")!).exhausted).toBe(true);
    // Step 4: Rhino had 12 damage; Hard to Keep Down heals 4, "I'm Tough!" gives him a tough status.
    expect(ofType(events, "encounterCardRevealed").map((e) => e.cardId)).toEqual(["01104", "01105"]);
    expect(damageOn(villain())).toBe(8);
    expect(inst(state, villain()).statuses.tough).toBe(1);
    afterVillain2 = state;
    expect(state.round).toBe(3);
    expect(state.pendingChoice).toBeNull();
  });

  // NEW BUG (53005 Up, Up, and Away): swapping makes the swapped-in card the boost card (the draw reads its icons), but
  // the engine never flips it, so Rhino's attack counts boostIcons 0 and no boostCardFlipped is logged. Expected: the
  // new boost card (Enhanced Ivory Horn, 2 icons) flips and the attack is 2 + 2.
  it.fails("round 2 villain phase, swap variant: the swapped-in boost card is flipped and counts in the attack", () => {
    state = beforeVillain2;
    try {
      stack("01104", TWO);
      const events = act({ take: [AWAY], swap: true, defenders: [me()] }, endTurn());
      expect(drawnAfterPlay(events, "53005")).toBe(2);
      expect(ofType(events, "boostCardFlipped")[0]).toMatchObject({ boostIcons: 2 });
      expect(ofType(events, "attackResolved")[0]).toMatchObject({ baseAtk: 2, boostIcons: 2 });
    } finally {
      state = afterVillain2;
    }
  });

  it("round 3: Bird's-Eye View discards a 2-icon top card to remove 3 + 2 = 5 threat (all there is) from the main scheme", () => {
    give("53004");
    stack(TWO);
    const before = mainThreat();
    expect(before).toBeGreaterThan(0);
    const events = act({ labels: ["Discard"], targets: [mainScheme()] }, playFrom("53004", fodder(2)));
    expect(ofType(events, "threatRemoved")).toMatchObject([
      { schemeInstanceId: mainScheme(), amount: Math.min(5, before) },
    ]);
    expect(mainThreat()).toBe(Math.max(0, before - 5));
    expect(encounterDiscard().map((i) => code(i))).toContain(TWO);
  });

  it("round 3: Aerial Recon is attached (its action is a known gap, so a recon counter is seeded by surgery)", () => {
    give("53009");
    act({}, playFrom("53009", fodder(1), { attachToInstanceId: me() }));
    const recon = inPlayOf("53009")!;
    expect(inst(state, recon).attachedTo).toBe(me());
    state = patchInstance(state, recon, { counters: { recon: 1 } });
  });

  it("round 3 villain phase: Hugin & Munin defends; Aerial Evacuation prevents all damage and Falcon changes to alter ego; Aerial Recon replaces one encounter card", () => {
    const hugin = inPlayOf("53017")!;
    const evac = inPlayOf("53008")!;
    const recon = inPlayOf("53009")!;
    stack(ONE, "01104");
    const events = act({ take: [EVAC, RECON], defenders: [hugin] }, endTurn());
    expect(ofType(events, "defenderDeclared")).toMatchObject([{ defenderInstanceId: hugin }]);
    expect(ofType(events, "damagePrevented")).toMatchObject([{ targetInstanceId: hugin, amount: 3 }]);
    expect(damageOn(hugin)).toBe(0);
    expect(playerOf(state, P1).discard).toContain(evac);
    expect(playerOf(state, P1).identity.form).toBe("alterEgo");
    // Aerial Recon: the first deal is replaced (counter spent); the card stays on the deck and is dealt by the
    // hazard's second deal, so one encounter card is revealed instead of two.
    expect(inst(state, recon).counters.recon ?? 0).toBe(0);
    expect(ofType(events, "encounterCardRevealed").map((e) => e.cardId)).toEqual(["01104"]);
    expect(state.round).toBe(4);
    expect(state.pendingChoice).toBeNull();
  });

  it("round 4, alter ego: Harlem's Protector's action removes another emergency counter", () => {
    const protector = inPlayOf("53029")!;
    act({}, use(P1, protector, PROTECTOR, [{ fromHand: fodder(1)[0]! }]));
    expect(inst(state, protector).counters).toEqual({ emergency: 1 });
  });

  it("round 4 villain phase: the nemesis minion Viper engages and quickstrikes; Vibranium Microweave answers Rhino's undefended attack", () => {
    act({}, changeForm());
    state = stackSetAside(state, "53030");
    stack(ONE, "01104");
    const weave = inPlayOf("53013")!;
    expect(inst(state, weave).exhausted).toBe(false);
    const discardBefore = encounterDiscard().length;
    const events = act({ take: [WEAVE] }, endTurn());
    const viper = cardsInPlay(state).find((i) => code(i) === "53030")!;
    expect(inst(state, viper).engagedWith).toBe(P1);
    // Rhino's attack (ATK 2 + 1 boost icon, undefended): Microweave prevents 1 and deals 1 to Rhino, which his tough
    // status (from "I'm Tough!" in round 2) absorbs, discarding it.
    expect(ofType(events, "damagePrevented")).toMatchObject([
      { targetInstanceId: me(), amount: 1, reason: "effect" },
      { targetInstanceId: villain(), amount: 1, reason: "tough" },
    ]);
    expect(inst(state, villain()).statuses.tough).toBe(0);
    expect(inst(state, weave).exhausted).toBe(true);
    // Viper's Quickstrike attack on engaging, then her Forced Response after she activates discards the top 5.
    expect(ofType(events, "attackResolved").map((e) => code(e.enemyInstanceId))).toContain("53030");
    expect(encounterDiscard().length).toBeGreaterThanOrEqual(discardBefore + 5);
    expect(state.round).toBe(5);
    expect(state.pendingChoice).toBeNull();
  });

  it("invariants: no pending choice, no card in two zones, hand + deck + discard + in play = 40 of Falcon's cards", () => {
    const p = playerOf(state, P1);
    expect(state.pendingChoice).toBeNull();
    const attachedToMine = [p.identity.instanceId, ...p.playArea].flatMap((i) => inst(state, i).attachments);
    const inPlayMine = [...new Set([...p.playArea, ...attachedToMine])].filter((i) => inst(state, i).ownerId === P1);
    const zones = [...p.hand, ...p.deck, ...p.discard, ...inPlayMine];
    expect(new Set(zones).size).toBe(zones.length);
    expect(zones).toHaveLength(40);
    for (const id of zones) expect(inst(state, id).ownerId).toBe(P1);
    expect(p.setAside.filter((i) => zones.includes(i))).toEqual([]);
  });
});
