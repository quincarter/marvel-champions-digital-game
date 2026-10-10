import {
  activeEncounterDeckId,
  applyCommand,
  characterProfile,
  handSize,
  maxHitPoints,
  traitsOf,
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
  stackEncounterDeck,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, stageNemesisCardForReveal } from "../../../testing/staging.js";
import { SILK_DEPS, engageMinion, silkGame, silkHeroGame } from "../testing.js";
import { SILK_OBLIGATION_NEMESIS_SKIPPED } from "./obligation-nemesis.js";

/**
 * Whole-game test for Silk's printed precon (`silk-protection`, cards 52002-52027 and the identity) against Core's
 * Rhino (standard, solo), docs/phase7-wave9.md section 8.4 ("Silk starter deck e2e, with Morlun's set dealt in").
 * Nine rounds played through the engine's real commands, one decision at a time, ending with Rhino stage I defeated.
 * Deterministic by seed (1). The dependencies are `SILK_DEPS`: every earlier script plus this pack's modules.
 *
 * Seeding is limited to what the other starter-deck games use: `moveToHand` (the cards a round needs, and spare cards
 * to pay with, pulled from the deck or discard pile), `stackEncounterDeck` (the order the villain phase draws in) and
 * `stageNemesisCardForReveal` (the set-aside nemesis cards, dealt in a real villain phase). The one extra surgery is
 * `tuckSetAside`: Hunting the Spider-Bride is staged already tucked in the game (it was written before the card's When
 * Revealed was scripted); a reveal of it through a real villain phase is the separate game at the end of this file.
 *
 * Rules the game leans on (RRG 1.8 = mc_rulesreference_v18_compressed.md; page numbers as the modules cite them):
 * - "Tuck" (p. 45): faceup, not in play; a card that leaves play discards the cards tucked under it. Silk's 4-card cap
 *   makes the player choose which 4 stay.
 * - "Cost" (p. 13): Cindy Moon's action, Organic Webbing and Albert's tuck-free half are costs paid before the effect.
 * - "Replacement Effect" (p. 37): Silk Sense Overload's tuck redirect; Eidetic Memory's "reveal ... instead".
 * - "'Swap'" (p. 42): Eidetic Memory changes no count of tucked cards.
 * - "Overkill" (p. 31): the excess over a minion's hit points goes to the villain.
 * - "Guard" (p. 21): an engaged guard minion forbids attacking the villain (it also blocks the Hero Response (attack)
 *   "Stop Hitting Yourself" while Hydra Mercenary is engaged; see the last describe).
 * - "Stunned" (p. 41): a stunned villain's activation only discards the stun card (no boost card is dealt).
 * - "Player Phase" / "End of Player Phase" (pp. 21, 34): discard down, draw up, then ready; so a hero who defends in the
 *   villain phase starts the next player phase exhausted (Organic Webbing readies her).
 * - Rulings: December 17, 2025 Ruling 2 (Stop Hitting Yourself reads the DEF it has, Not Today! included);
 *   April 30, 2026 Ruling 3 (a flipping environment is not "revealed" for Eidetic Memory; not exercised).
 * - Owner decision Q7 = A (provisional, docs/phase7-wave9.md): a discard a player card (cost, effect or the cap) causes
 *   deals the Spider-Bride's 2 damage; an encounter card's discard (Morlun's When Defeated) does not.
 *
 * Not covered here (kit tests in this folder and aspect-basic.test.ts cover them): the other aspect cards (Spider-Byte,
 * Dr. Sinclair, Ready for a Fight, Spider-Man, Across the Spider-Verse, Investigative Journalism), Silk Sense on a
 * side scheme, Outwit/Spider Claws against a card of another set, every error path, multiplayer.
 */

vi.setConfig({ testTimeout: 240_000 });

const DEPS = SILK_DEPS;

interface Plan {
  /** Optional triggers to take, by id suffix; each entry is taken once, every other optional trigger is declined. */
  readonly take?: readonly string[];
  /** Option labels (prefix match), consumed in order at successive option prompts. */
  readonly labels?: readonly string[];
  /** Instance ids to pick, in order, at successive target prompts. */
  readonly targets?: readonly string[];
  /** Instance ids to pick together at a card-choice prompt (every one of them that is offered). */
  readonly many?: readonly string[];
  /** At a card choice offering any of these, pick every other offered card (the cap's "which 4 stay"). */
  readonly drop?: readonly string[];
  /** Put cards back in the opposite of the order offered (Madame Web's "any order"). */
  readonly reverse?: boolean;
  /** Whether Silk declares herself the defender. */
  readonly defend?: boolean;
  /** Card codes to pay a played card's cost with when asked (a response played in the villain phase). */
  readonly pay?: readonly string[];
  /** Card codes to discard first when the hand is over its size at the end of the player phase. */
  readonly discard?: readonly string[];
}
const planner = (plan: Plan): Picker => {
  const labels = [...(plan.labels ?? [])];
  const targets = [...(plan.targets ?? [])];
  const take = [...(plan.take ?? [])];
  return (s) => {
    const choice = s.pendingChoice!;
    const offered = choice.options.map((o) => o.optionId as string);
    const prompt = choice.prompt;
    switch (prompt.kind) {
      case "chooseTriggers": {
        const at = take.findIndex((t) => offered.some((o) => o.endsWith(t)));
        if (at < 0) return [];
        const hit = offered.find((o) => o.endsWith(take[at]!))!;
        take.splice(at, 1);
        return [hit];
      }
      case "orderCards":
        return plan.reverse ? [...offered].reverse() : offered;
      case "declareDefender":
        return plan.defend && offered.includes(identityOf(s)) ? [identityOf(s)] : ["decline"];
      case "payForCard": {
        const pool = choice.options.filter((o) => {
          const id = (o.optionId as string).replace(/^hand:/, "") as InstanceId;
          return (o.optionId as string).startsWith("hand:") && id !== prompt.instanceId && plan.pay?.includes(code(id));
        });
        const iconsOfOption = (o: (typeof pool)[number]) =>
          iconsOf((o.optionId as string).replace(/^hand:/, "") as InstanceId);
        const search = (from: number, left: number): string[] | null => {
          if (left === 0) return [];
          for (let i = from; i < pool.length; i++) {
            const n = iconsOfOption(pool[i]!);
            if (n > left) continue;
            const rest = search(i + 1, left - n);
            if (rest) return [pool[i]!.optionId as string, ...rest];
          }
          return null;
        };
        const found = search(0, prompt.cost);
        if (!found) throw new Error(`cannot pay ${prompt.cost} with ${plan.pay}`);
        return found;
      }
      case "payForAbility": {
        const want = [...(plan.pay ?? [])];
        const picked: string[] = [];
        for (const o of choice.options) {
          const c = code((o.optionId as string).replace(/^hand:/, "") as InstanceId);
          const at = want.indexOf(c);
          if (at >= 0) {
            want.splice(at, 1);
            picked.push(o.optionId as string);
          }
        }
        return picked;
      }
      case "discardDownToHandSize": {
        const want = plan.discard ?? [];
        const hit = choice.options.filter((o) => want.includes(code(o.optionId as InstanceId)));
        return hit.length >= choice.minSelections
          ? hit.slice(0, choice.minSelections).map((o) => o.optionId as string)
          : firstLegal(s);
      }
      default: {
        if (plan.drop && prompt.kind === "chooseCards" && plan.drop.some((d) => offered.includes(d)))
          return offered.filter((o) => !plan.drop!.includes(o)).slice(0, choice.maxSelections);
        if (plan.many && prompt.kind === "chooseCards") return plan.many.filter((m) => offered.includes(m));
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
const code = (id: InstanceId): string => inst(state, id).cardId as string;
const handCodes = (): string[] => playerOf(state, P1).hand.map(code);
const silk = (): InstanceId => identityOf(state);
const tucked = (): InstanceId[] => [...inst(state, silk()).tucked];
const tuckedCodes = (): string[] => tucked().map(code);

const iconsOf = (id: InstanceId): number => {
  const data = state.cardPool[inst(state, id).cardId] as { resourceIcons?: object; producesIcons?: object };
  return Object.values(data.resourceIcons ?? data.producesIcons ?? {}).reduce((a, b) => a + (b as number), 0);
};
/** Hand cards (none named in `keep`) whose icons add up to exactly `cost`: the payment for a play. */
const fodder = (cost: number, keep: readonly string[] = []): InstanceId[] => {
  const pool = playerOf(state, P1).hand.filter((id) => !keep.includes(code(id)) && iconsOf(id) > 0);
  const search = (from: number, left: number): InstanceId[] | null => {
    if (left === 0) return [];
    for (let i = from; i < pool.length; i++) {
      const n = iconsOf(pool[i]!);
      if (n > left) continue;
      const rest = search(i + 1, left - n);
      if (rest) return [pool[i]!, ...rest];
    }
    return null;
  };
  const found = search(0, cost);
  if (!found) throw new Error(`cannot pay ${cost} from ${handCodes()} keeping ${keep}`);
  return found;
};
const give = (...codes: string[]) => {
  state = moveToHand(state, P1, ...codes).state;
};
const handOf = (c: string): InstanceId => playerOf(state, P1).hand.find((i) => code(i) === c)!;

const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const inPlayOf = (c: string): InstanceId => {
  const p = playerOf(state, P1);
  const all = [...p.playArea, ...inst(state, silk()).attachments, ...state.villainArea];
  return all.find((i) => code(i) === c)!;
};
const encPiles = () => state.encounterDecks[activeEncounterDeckId(state)]!;
const villain = (): InstanceId => state.activeVillainId!;
const mainScheme = (): InstanceId => state.mainScheme.instanceId;

/** Codes of the hand cards the current round still means to play: `fodder` never pays with them. */
let keep: string[] = [];
/** The two cards tucked under Silk Sense Overload before it leaves play. */
let underOverload: InstanceId[] = [];
let overload: InstanceId;
let morlunId: InstanceId;
let encounterTotal = 0;
let instanceTotal = 0;
let albert: InstanceId;
let scoop: InstanceId;
let jameson: InstanceId;
const SENSE = "52001a.silk-sense";
const CINDY = "52001b.cindy-moon-action";
const ALBERT = "52006.albert-moon-action";
const SCOOP_ACTION = "52005.get-the-scoop-action";
const SHIELD_REF = "52018.energy-shield-interrupt";
const CLAWS_REF = "52011.spider-claws-interrupt";
const REFLEXES_REF = "52012.spider-reflexes-interrupt";
const STOP_REF = "52016.stop-hitting-yourself-response";
const changeFormCmd = (): Command => ({ type: "changeForm", playerId: P1 });
const basicAttack = (target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: silk(),
  targetInstanceId: target,
});
const basicThwart = (scheme: InstanceId): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: silk(),
  schemeInstanceId: scheme,
});
const inPlayArea = (c: string): InstanceId | undefined => playerOf(state, P1).playArea.find((i) => code(i) === c);
const mainThreat = (): number => inst(state, mainScheme()).threat;
const silkDamage = (): number => inst(state, silk()).damage;
const rhinoDamage = (): number => inst(state, villain()).damage;

describe("Silk (Protection) precon against Rhino (standard, solo), seed 1", () => {
  it("setup: 40-card precon, Cindy Moon in alter-ego form with a hand of 6, hand size 6, 10 hit points", () => {
    state = silkGame({ seed: 1 });
    const p = playerOf(state, P1);
    expect(p.identity.form).toBe("alterEgo");
    expect(p.hand).toHaveLength(6);
    expect(p.deck).toHaveLength(34);
    expect(p.discard).toHaveLength(0);
    expect(handCodes().sort()).toEqual(["52008", "52007", "52017", "52009", "52027", "52016"].sort());
    expect(handSize(state, P1, DEPS)).toBe(6);
    expect(maxHitPoints(state, silk(), DEPS)).toBe(10);
    expect(tucked()).toEqual([]);
    // The nemesis set is set aside (Morlun, The Great Hunt, three Hunting the Spider-Bride); the obligation is shuffled
    // into the encounter deck.
    expect(p.setAside.map(code).sort()).toEqual(["52029", "52030", "52031", "52031", "52031"]);
    expect(encPiles().deck.map(code)).toContain("52028");
    expect(maxHitPoints(state, villain(), DEPS)).toBe(14);
    expect(mainThreat()).toBe(0);
    expect(state.round).toBe(1);
    expect(state.pendingChoice).toBeNull();
    // Nothing of the nemesis set is left unscripted. The Spider-Bride is still staged tucked below.
    expect(Object.keys(SILK_OBLIGATION_NEMESIS_SKIPPED)).toEqual([]);
    encounterTotal = Object.keys(state.instances).filter((id) => inst(state, id as InstanceId).ownerId !== P1).length;
    instanceTotal = Object.keys(state.instances).length;
  });

  it("round 1: Albert Moon (2) enters; his action tucks the top card of the encounter deck under Cindy Moon", () => {
    keep = ["52006", "52005", "52007", "52008", "52009", "52016"];
    give("52006", "52005");
    const entered = act({}, play(P1, handOf("52006"), fodder(2, keep)));
    expect(ofType(entered, "cardPlayed")).toMatchObject([{ resourcesPaid: 2 }]);
    albert = inPlayOf("52006");
    state = stackEncounterDeck(state, "01101");
    const deckBefore = encPiles().deck.length;
    const used = act({ labels: ["Tuck"] }, use(P1, albert, ALBERT));
    expect(inst(state, albert).exhausted).toBe(true);
    expect(tuckedCodes()).toEqual(["01101"]);
    expect(encPiles().deck).toHaveLength(deckBefore - 1);
    expect(ofType(used, "cardMoved").filter((e) => e.to.kind === "tucked")).toHaveLength(1);
    // RRG "Tuck" (p. 45): tucked faceup, not in play.
    expect(inst(state, tucked()[0]!).faceup).toBe(true);
  });

  it("round 1: Cindy Moon's action discards the tucked card and draws 2, once per round", () => {
    const merc = tucked()[0]!;
    const hand = playerOf(state, P1).hand.length;
    const deck = playerOf(state, P1).deck.length;
    const used = act({}, use(P1, silk(), CINDY, [], { discarded: [merc] }));
    expect(tucked()).toEqual([]);
    expect(encPiles().discard).toContain(merc);
    expect(ofType(used, "cardMoved").filter((e) => e.from.kind === "tucked")).toMatchObject([
      { instanceId: merc, to: { kind: "encounterDiscard" } },
    ]);
    expect(playerOf(state, P1).hand).toHaveLength(hand + 2);
    expect(playerOf(state, P1).deck).toHaveLength(deck - 2);
    expect(inst(state, silk()).exhausted).toBe(false);
  });

  it("round 1: Get the Scoop (0) enters with 4 threat; its Alter-Ego Action exhausts Cindy and removes 2", () => {
    act({}, play(P1, handOf("52005"), []));
    scoop = inPlayOf("52005");
    expect(state.villainArea).toContain(scoop);
    expect(inst(state, scoop).threat).toBe(4);
    act({}, use(P1, scoop, SCOOP_ACTION));
    expect(inst(state, scoop).threat).toBe(2);
    expect(inst(state, silk()).exhausted).toBe(true);
  });

  it("round 1 villain phase: Rhino schemes at the alter ego (1 threat + acceleration 1); a Hydra Mercenary is dealt and engages", () => {
    state = stackEncounterDeck(state, "01186", "01101");
    const handBefore = playerOf(state, P1).hand.length;
    const events = act({ discard: ["52017"] }, endTurn());
    expect(ofType(events, "schemeResolved")).toMatchObject([{ baseSch: 1, boostIcons: 0, threatPlaced: 1 }]);
    expect(ofType(events, "encounterCardRevealed")).toMatchObject([{ cardId: "01101", playerId: P1 }]);
    expect(mainThreat()).toBe(2);
    expect(state.round).toBe(2);
    expect(handBefore).toBeGreaterThan(6);
    // RRG "End of Player Phase" (p. 21): discard down to hand size 6.
    expect(ofType(events, "cardDiscardedFromHand")).toHaveLength(handBefore - 6);
    expect(playerOf(state, P1).hand).toHaveLength(6);
    expect(inPlayArea("01101")).toBeDefined();
    expect(inst(state, inPlayArea("01101")!).engagedWith).toBe(P1);
  });

  it("round 2, hero form: Silk (hand size 5); Energy Shield (0) attaches; Swinging Silk Kick deals 7 to Hydra Mercenary, no overkill", () => {
    act({}, changeFormCmd());
    expect(playerOf(state, P1).identity.form).toBe("hero");
    expect(handSize(state, P1, DEPS)).toBe(5);
    keep = ["52003", "52018", "52004", "52016", "52020"];
    give("52018", "52019", "52019", "52019", "52015", "52015", "52020");
    act({}, play(P1, handOf("52018"), [], { attachToInstanceId: silk() }));
    expect(inst(state, silk()).attachments.map(code)).toContain("52018");

    const mercB = inPlayArea("01101")!;
    const kicked = act({ targets: [mercB], take: [SENSE] }, play(P1, handOf("52003"), fodder(3, keep)));
    expect(ofType(kicked, "cardPlayed")).toMatchObject([{ resourcesPaid: 3 }]);
    // Nothing is tucked, so nothing to discard: 7 damage on 3 hit points; with no overkill Rhino takes none.
    expect(ofType(kicked, "damageDealt")).toMatchObject([{ targetInstanceId: mercB, amount: 7 }]);
    expect(rhinoDamage()).toBe(0);
    expect(ofType(kicked, "characterDefeated")).toMatchObject([{ instanceId: mercB }]);
    // Silk Sense: after she defeats a minion, tuck it from the encounter discard pile.
    expect(tucked()).toEqual([mercB]);
    expect(encPiles().discard).not.toContain(mercB);
  });

  it("round 2 villain phase: Energy Shield prevents 1 of Rhino's 3 (ATK 2 + 1 boost icon); Shocker's When Revealed deals 1", () => {
    state = stackEncounterDeck(state, "01101", "01103");
    const spent = handOf("52020");
    const events = act({ take: [SHIELD_REF], pay: ["52020"], discard: ["52019", "52015"] }, endTurn());
    expect(ofType(events, "damagePrevented")).toMatchObject([{ targetInstanceId: silk(), amount: 1 }]);
    expect(playerOf(state, P1).discard).toContain(spent);
    expect(ofType(events, "damageDealt").map((e) => [e.targetInstanceId, e.amount])).toEqual([
      [silk(), 2],
      [silk(), 1],
    ]);
    expect(silkDamage()).toBe(3);
    expect(mainThreat()).toBe(3);
    expect(inst(state, inPlayArea("01103")!).engagedWith).toBe(P1);
    expect(state.round).toBe(3);
  });
});

describe("rounds 3 and 4", () => {
  it("round 3, alter-ego form: Get the Scoop's last 2 threat defeat it; the player looks at the top 2 cards and tucks 1", () => {
    keep = ["52007"];
    act({}, changeFormCmd());
    expect(playerOf(state, P1).identity.form).toBe("alterEgo");
    state = stackEncounterDeck(state, "01104", "01107");
    const [hard, breakin] = encPiles().deck.slice(0, 2) as [InstanceId, InstanceId];
    const events = act({ many: [breakin] }, use(P1, scoop, SCOOP_ACTION));
    expect(ofType(events, "schemeDefeated")).toMatchObject([{ instanceId: scoop }]);
    expect(state.villainArea).not.toContain(scoop);
    expect(playerOf(state, P1).discard).toContain(scoop);
    // The chosen card went under Cindy Moon; the other stays on top of the encounter deck.
    expect(tucked()[1]).toBe(breakin);
    expect(tuckedCodes()).toEqual(["01101", "01107"]);
    expect(encPiles().deck[0]).toBe(hard);
  });

  it("round 3: J. Jonah Jameson (3) searches the deck and discard pile and puts Get the Scoop back into play with 4 threat", () => {
    give("52019", "52019", "52019", "52007");
    const entered = act({}, play(P1, handOf("52007"), fodder(3, keep)));
    expect(ofType(entered, "cardPlayed")).toMatchObject([{ resourcesPaid: 3 }]);
    jameson = inPlayOf("52007");
    const searched = act({ many: [scoop] }, use(P1, jameson, "52007.j-jonah-jameson-action"));
    // RRG "Search" (p. 39): the deck is shuffled afterward; the Scoop was in the discard pile.
    expect(ofType(searched, "deckShuffled")).toHaveLength(1);
    expect(state.villainArea).toContain(scoop);
    expect(playerOf(state, P1).discard).not.toContain(scoop);
    expect(inst(state, scoop).threat).toBe(4);
    expect(inst(state, jameson).exhausted).toBe(true);
  });

  it("round 3: Albert Moon heals 1 damage for each of the 2 tucked cards (3 damage to 1)", () => {
    expect(silkDamage()).toBe(3);
    act({ labels: ["Heal"] }, use(P1, albert, ALBERT));
    expect(silkDamage()).toBe(1);
    expect(tucked()).toHaveLength(2);
  });

  it("round 3: Cindy Moon's action discards the Hydra Mercenary (draw 2); a second use this round is refused", () => {
    const merc = tucked()[0]!;
    const hand = playerOf(state, P1).hand.length;
    act({}, use(P1, silk(), CINDY, [], { discarded: [merc] }));
    expect(playerOf(state, P1).hand).toHaveLength(hand + 2);
    expect(tuckedCodes()).toEqual(["01107"]);
    expect(encPiles().discard).toContain(merc);
    const again = applyCommand(state, use(P1, silk(), CINDY, [], { discarded: [tucked()[0]!] }), DEPS);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error.code).toBe("limit_reached");
  });

  it("round 3 villain phase: Rhino and Shocker scheme at the alter ego; a second Hydra Mercenary is dealt", () => {
    state = stackEncounterDeck(state, "01186", "01101");
    const events = act({ discard: ["52019"] }, endTurn());
    expect(ofType(events, "schemeResolved")).toMatchObject([
      { baseSch: 1, boostIcons: 0, threatPlaced: 1 },
      { baseSch: 1, boostIcons: 0, threatPlaced: 1 },
    ]);
    // 3 + acceleration 1 + Rhino 1 + Shocker 1.
    expect(mainThreat()).toBe(6);
    expect(inst(state, inPlayArea("01101")!).engagedWith).toBe(P1);
    expect(state.round).toBe(4);
  });

  it("round 4, hero form: Spider Claws and Spider Reflexes (2 each) attach; Claws adds +1 ATK for the Rhino-set card tucked and Shocker falls", () => {
    act({}, changeFormCmd());
    keep = ["52011", "52012", "52004", "52016", "52020", "52018"];
    give("52011", "52012", "52004", "52016", "52019", "52019", "52019", "52015", "52015", "52020", "52020", "52018");
    act({}, play(P1, handOf("52011"), fodder(2, keep), { attachToInstanceId: silk() }));
    act({}, play(P1, handOf("52012"), fodder(2, keep), { attachToInstanceId: silk() }));
    expect(inst(state, silk()).attachments.map(code).sort()).toEqual(["52011", "52012", "52018"]);
    const shocker = inPlayArea("01103")!;
    const events = act({ targets: [shocker], take: [CLAWS_REF, SENSE] }, basicAttack(shocker));
    // ATK 2 + 1 (Breakin' & Takin' is a Rhino-set card, like Shocker): 3 damage on 3 hit points. Without Claws it lives.
    expect(ofType(events, "damageDealt")).toMatchObject([{ targetInstanceId: shocker, amount: 3 }]);
    expect(ofType(events, "characterDefeated")).toMatchObject([{ instanceId: shocker }]);
    expect(tuckedCodes()).toEqual(["01107", "01103"]);
    expect(inst(state, inPlayOf("52011")).exhausted).toBe(true);
  });

  it("round 4: Wallcrawl (1) removes 2, then discards the tucked Breakin' & Takin' to remove 3 more (6 to 1)", () => {
    const breakin = tucked()[0]!;
    expect(mainThreat()).toBe(6);
    const events = act(
      { targets: [mainScheme(), mainScheme()], many: [breakin] },
      play(P1, handOf("52004"), fodder(1, keep)),
    );
    expect(ofType(events, "threatRemoved").map((e) => e.amount)).toEqual([2, 3]);
    expect(mainThreat()).toBe(1);
    expect(tuckedCodes()).toEqual(["01103"]);
    expect(encPiles().discard).toContain(breakin);
  });

  it("round 4 villain phase: Reflexes adds +1 DEF (Shocker tucked), so Rhino's 4 deals none; Stop Hitting Yourself is not offered with a guard minion engaged", () => {
    state = stackEncounterDeck(state, "01102", "01186", "01186");
    const offeredRefs: string[] = [];
    const inner = planner({
      defend: true,
      take: [REFLEXES_REF, STOP_REF, SENSE],
      pay: ["52019", "52015"],
      discard: ["52019", "52015", "52020"],
    });
    const spying: Picker = (s) => {
      offeredRefs.push(...s.pendingChoice!.options.map((o) => o.optionId as string));
      return inner(s);
    };
    const r = driveEventsPicking(DEPS, state, spying, endTurn());
    state = r.state;
    const events = r.events;
    // Rhino: ATK 2 + 2 boost icons (Sandman) against DEF 3 + 1: no damage to Silk from Rhino.
    expect(ofType(events, "damageDealt").map((e) => [e.targetInstanceId, e.amount])).toEqual([[silk(), 1]]);
    // RRG "Guard" (p. 21): Hydra Mercenary is engaged, so the attack response cannot target Rhino.
    expect(offeredRefs.some((o) => o.endsWith(STOP_REF))).toBe(false);
    expect(rhinoDamage()).toBe(0);
    // After the attack Reflexes tucked the top card of the encounter discard pile: Sandman, the boost card.
    expect(tuckedCodes()).toEqual(["01103", "01102", "01186"]);
    expect(inst(state, inPlayOf("52012")).exhausted).toBe(true);
    expect(mainThreat()).toBe(3);
    expect(silkDamage()).toBe(2);
    expect(inst(state, silk()).exhausted).toBe(true);
    expect(state.round).toBe(5);
  });
});

describe("round 5", () => {
  const WEBBING_ACTION = "52009.organic-webbing-action";
  const OUTWIT_REF = "52010.outwit-interrupt";
  const EIDETIC_REF = "52008.eidetic-memory-interrupt";
  const aerial = (): boolean => traitsOf(state, silk(), DEPS).map(String).includes("AERIAL");
  let shockerTucked: InstanceId;
  let advanceTucked: InstanceId;

  it("round 5, still hero form and exhausted from defending: Eidetic Memory (1), Organic Webbing (2) and Outwit (2) attach", () => {
    expect(playerOf(state, P1).identity.form).toBe("hero");
    expect(inst(state, silk()).exhausted).toBe(true);
    keep = ["52008", "52009", "52010", "52002", "52003", "52016"];
    give("52008", "52009", "52010", "52002", "52002", "52019", "52019", "52019", "52015", "52020");
    for (const [c, cost] of [
      ["52008", 1],
      ["52009", 2],
      ["52010", 2],
    ] as const) {
      const events = act({}, play(P1, handOf(c), fodder(cost, keep), { attachToInstanceId: silk() }));
      expect(ofType(events, "cardPlayed")).toMatchObject([{ resourcesPaid: cost }]);
    }
    expect(inst(state, silk()).attachments.map(code).sort()).toEqual(
      ["52008", "52009", "52010", "52011", "52012", "52018"].sort(),
    );
    // Organic Webbing: Silk gets +1 THW (hero form), so her basic thwart is 2.
    expect(characterProfile(state, silk(), DEPS)!.thw).toBe(2);
    shockerTucked = tucked().find((i) => code(i) === "01103")!;
    advanceTucked = tucked().find((i) => code(i) === "01186")!;
  });

  it("round 5: Smooth as Silk (0) on Rhino discards Advance (Standard set) and tucks the first Rhino-set card, Stampede", () => {
    state = stackEncounterDeck(state, "01186", "01106");
    const [advance, stampede] = encPiles().deck.slice(0, 2) as [InstanceId, InstanceId];
    const events = act({ targets: [villain()] }, play(P1, handOf("52002"), []));
    expect(ofType(events, "cardPlayed")).toMatchObject([{ resourcesPaid: 0 }]);
    expect(encPiles().discard).toContain(advance);
    expect(tucked()).toHaveLength(4);
    expect(tucked()[3]).toBe(stampede);
    expect(encPiles().discard).not.toContain(stampede);
  });

  it("round 5: a second Smooth as Silk on Hydra Mercenary tucks a fifth card; the cap makes the player choose which 4 stay (Advance goes)", () => {
    state = stackEncounterDeck(state, "01187", "01107");
    const merc = inPlayArea("01101")!;
    const before = tucked();
    expect(before).toHaveLength(4);
    const prompts: string[] = [];
    const inner = planner({ targets: [merc], drop: [advanceTucked] });
    const r = driveEventsPicking(
      DEPS,
      state,
      (st) => {
        const c = st.pendingChoice!;
        if (c.prompt.kind === "chooseCards")
          prompts.push(`${c.prompt.slot}:${c.minSelections}-${c.maxSelections}:${c.options.length}`);
        return inner(st);
      },
      play(P1, handOf("52002"), []),
    );
    state = r.state;
    // RRG "Tuck" (p. 45) and the identity's printed cap: "more than 4 ... discard all but 4". The player is asked once,
    // 4 of the 5 to keep.
    expect(prompts).toEqual(["kept:4-4:5"]);
    expect(tucked()).toHaveLength(4);
    expect(tucked()).not.toContain(advanceTucked);
    expect(encPiles().discard).toContain(advanceTucked);
    expect(tuckedCodes().sort()).toEqual(["01102", "01103", "01106", "01107"]);
    expect(state.pendingChoice).toBeNull();
  });

  it("round 5: Organic Webbing's action (exhaust it, discard Breakin' & Takin' from under Silk) readies Silk and gives her Aerial until the end of the round", () => {
    const breakin = tucked().find((i) => code(i) === "01107")!;
    expect(aerial()).toBe(false);
    expect(applyCommand(state, basicThwart(mainScheme()), DEPS).ok).toBe(false); // exhausted: no basic thwart yet
    act({}, use(P1, inPlayOf("52009"), WEBBING_ACTION, [], { discarded: [breakin] }));
    expect(inst(state, silk()).exhausted).toBe(false);
    expect(inst(state, inPlayOf("52009")).exhausted).toBe(true);
    expect(aerial()).toBe(true);
    expect(encPiles().discard).toContain(breakin);
    expect(tuckedCodes().sort()).toEqual(["01102", "01103", "01106"]);
  });

  it("round 5: Outwit reads the 3 tucked Rhino-set cards at the thwart: THW 1 + 1 (Webbing) + 3 = 5 against the main scheme's 3", () => {
    expect(mainThreat()).toBe(3);
    const events = act({ take: [OUTWIT_REF] }, basicThwart(mainScheme()));
    const removal = events.filter(
      (e) => e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "removeThreat",
    );
    expect(removal).toMatchObject([{ event: { amount: 5 } }]);
    const resolved = events.filter(
      (e) => e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "thwart",
    );
    expect(resolved).toMatchObject([{ event: { basic: true, results: { extraThreat: 3 } } }]);
    expect(ofType(events, "threatRemoved")).toMatchObject([{ schemeInstanceId: mainScheme(), amount: 3 }]);
    expect(mainThreat()).toBe(0);
    expect(inst(state, inPlayOf("52010")).exhausted).toBe(true);
    expect(inst(state, silk()).exhausted).toBe(true);
  });

  it("round 5 villain phase: Reflexes defends Rhino and tucks the boost card; Eidetic Memory swaps the revealed I'm Tough! with the tucked Shocker", () => {
    state = stackEncounterDeck(state, "01186", "01105");
    const boost = encPiles().deck[0]!;
    const toughCard = encPiles().deck[1]!;
    const events = act(
      { defend: true, take: [REFLEXES_REF, EIDETIC_REF], many: [shockerTucked], discard: ["52019", "52015"] },
      endTurn(),
    );
    // Rhino's attack (ATK 2, boost 0) against DEF 3 + 3 (Reflexes): none. Hydra Mercenary (ATK 1) hits the exhausted Silk.
    expect(ofType(events, "damageDealt").map((e) => [e.targetInstanceId, e.amount])).toEqual([
      [silk(), 1],
      [silk(), 1],
    ]);
    // Reflexes: after the attack the boost card (top of the encounter discard pile) is tucked under Silk.
    expect(tucked()).toContain(boost);
    // The treachery is tucked unresolved (Rhino gets no tough status); Shocker took its place and was revealed in full.
    expect(code(toughCard)).toBe("01105");
    expect(tucked().includes(toughCard)).toBe(true);
    expect(tucked().includes(shockerTucked)).toBe(false);
    expect(inst(state, villain()).statuses.tough).toBe(0);
    expect(ofType(events, "revealReplaced")).toMatchObject([
      { instanceId: toughCard, withInstanceIds: [shockerTucked] },
    ]);
    expect(ofType(events, "encounterCardRevealed").map((e) => e.cardId)).toEqual(["01105", "01103"]);
    expect(playerOf(state, P1).playArea).toContain(shockerTucked);
    expect(inst(state, shockerTucked).engagedWith).toBe(P1);
    expect(inst(state, inPlayOf("52008")).exhausted).toBe(true);
    // Swap (RRG p. 42): the swap changed no count, and Silk Sense (resolving a treachery) was never offered.
    expect(tuckedCodes().sort()).toEqual(["01102", "01105", "01106", "01186"]);
    expect(silkDamage()).toBe(4);
    expect(mainThreat()).toBe(1);
    expect(inst(state, silk()).exhausted).toBe(true);
    expect(state.round).toBe(6);
  });
});

describe("round 6", () => {
  const NOT_TODAY_REF = "52015.not-today-interrupt";
  const STUN_GUN = "52020.stun-gun-action";
  let sandman: InstanceId;
  let mercB: InstanceId;
  let rhinoBefore = 0;

  it("round 6 (Silk exhausted from defending; her events and attachments need no ready identity): Stun Gun (2) enters with 2 charge counters", () => {
    expect(inst(state, silk()).exhausted).toBe(true);
    keep = ["52003", "52004", "52020", "52015", "52022", "52023"];
    give("52003", "52004", "52020", "52015", "52019", "52019", "52019", "52025", "52026", "52022", "52023");
    const events = act({}, play(P1, handOf("52020"), fodder(2, keep), { attachToInstanceId: silk() }));
    expect(ofType(events, "cardPlayed")).toMatchObject([{ resourcesPaid: 2 }]);
    expect(inst(state, inPlayOf("52020")).counters).toEqual({ charge: 2 });
    sandman = tucked().find((i) => code(i) === "01102")!;
    mercB = inPlayArea("01101")!;
  });

  it("round 6: Swinging Silk Kick discarding the tucked Sandman deals 9 to Hydra Mercenary (3 hit points) with overkill: 6 spill onto Rhino", () => {
    rhinoBefore = rhinoDamage();
    // Silk Sense is a "may": it is offered after the kill and declined here, so the board keeps 3 tucked cards.
    const offeredSense: boolean[] = [];
    const inner = planner({ targets: [mercB], many: [sandman] });
    const r = driveEventsPicking(
      DEPS,
      state,
      (st) => {
        offeredSense.push(st.pendingChoice!.options.some((o) => (o.optionId as string).endsWith(SENSE)));
        return inner(st);
      },
      play(P1, handOf("52003"), fodder(3, keep)),
    );
    state = r.state;
    const events = [...r.events];
    expect(ofType(events, "damageDealt").map((e) => [e.targetInstanceId, e.amount])).toEqual([
      [mercB, 9],
      [villain(), 6],
    ]);
    expect(rhinoDamage()).toBe(rhinoBefore + 6);
    expect(encPiles().discard).toContain(sandman);
    expect(tucked()).not.toContain(sandman);
    expect(offeredSense).toContain(true);
    expect(encPiles().discard).toContain(mercB);
    expect(tucked().map(code).sort()).toEqual(["01105", "01106", "01186"]);
  });

  it("round 6: Wallcrawl (1) declining the extra discard removes only its 2 (the Scoop, 4 to 2); the tucked cards stay", () => {
    const before = tucked();
    const events = act({ targets: [scoop, mainScheme()], many: [] }, play(P1, handOf("52004"), fodder(1, keep)));
    expect(ofType(events, "threatRemoved")).toMatchObject([{ schemeInstanceId: scoop, amount: 2 }]);
    expect(inst(state, scoop).threat).toBe(2);
    expect(tucked()).toEqual(before);
  });

  it("round 6: Stun Gun, removing both counters, stuns Rhino; the last counter discards the gun (RRG Uses, p. 46)", () => {
    const gun = inPlayOf("52020");
    act({}, use(P1, gun, STUN_GUN, [], undefined, { counters: 2 }));
    expect(inst(state, villain()).statuses.stunned).toBe(1);
    expect(inPlayOf("52020")).toBeUndefined();
    expect(playerOf(state, P1).discard).toContain(gun);
  });

  it("round 6 villain phase: the stunned Rhino loses its stun instead of attacking; Not Today! (+2 DEF) stops Shocker and removes 2 threat; Overload is dealt", () => {
    // A stunned villain is dealt no boost card (it does not attack), so the obligation is the next card: the one dealt.
    state = stackEncounterDeck(state, "52028");
    const shockerId = inPlayArea("01103")!;
    expect(mainThreat()).toBe(1);
    const events = act(
      {
        defend: true,
        take: [NOT_TODAY_REF],
        pay: ["52022"],
        targets: [mainScheme()],
        discard: ["52019", "52025", "52026", "52023"],
      },
      endTurn(),
    );
    // RRG "Stunned" (p. 41): Rhino's activation only discards the stun card.
    expect(ofType(events, "statusRemoved")).toMatchObject([{ instanceId: villain(), status: "stunned" }]);
    expect(ofType(events, "boostCardDealt")).toEqual([]);
    expect(ofType(events, "damageDealt")).toEqual([]);
    expect(rhinoDamage()).toBe(6);
    // Shocker (ATK 2) against DEF 3 + 2: no damage, so Not Today! removes 2 threat from a scheme (the main scheme, 1 + acceleration 1).
    expect(ofType(events, "enemyActivated").map((e) => e.enemyInstanceId)).toEqual([villain(), shockerId]);
    expect(ofType(events, "threatRemoved")).toMatchObject([{ schemeInstanceId: mainScheme(), amount: 2 }]);
    expect(mainThreat()).toBe(0);
    expect(silkDamage()).toBe(4);
    // The obligation is dealt to the Cindy Moon player and stays in her play area.
    expect(ofType(events, "encounterCardRevealed")).toMatchObject([{ cardId: "52028", playerId: P1 }]);
    expect(inPlayArea("52028")).toBeDefined();
    expect(state.round).toBe(7);
  });
});

/** Staging surgery: a set-aside copy of `code` of Silk's, tucked faceup under her identity as an earlier reveal would have left it. */
function tuckSetAside(code_: string): InstanceId {
  const id = playerOf(state, P1).setAside.find((i) => code(i) === code_);
  if (!id) throw new Error(`no set-aside ${code_}`);
  const host = silk();
  state = {
    ...state,
    players: state.players.map((p) => (p.playerId === P1 ? { ...p, setAside: p.setAside.filter((i) => i !== id) } : p)),
    stateChecks: {
      ...state.stateChecks,
      [`${host}:52001a.silk-constant`]: false,
      [`${host}:52001b.cindy-moon-constant`]: false,
    },
  };
  state = patchInstance(state, id, { faceup: true });
  state = patchInstance(state, host, { tucked: [...inst(state, host).tucked, id] });
  return id;
}

describe("round 7", () => {
  const JAMESON_THWART = "52007.j-jonah-jameson-action-2";
  let bride: InstanceId;

  it("round 7, alter-ego form: J. Jonah Jameson removes the Scoop's last 2 threat; its tuck is a player card's, so it goes under Silk Sense Overload", () => {
    act({}, changeFormCmd());
    expect(playerOf(state, P1).identity.form).toBe("alterEgo");
    overload = inPlayArea("52028")!;
    expect(inst(state, overload).tucked).toEqual([]);
    state = stackEncounterDeck(state, "01104", "01101");
    const [hard, merc] = encPiles().deck.slice(0, 2) as [InstanceId, InstanceId];
    const events = act({ targets: [scoop], many: [merc] }, use(P1, inPlayOf("52007"), JAMESON_THWART));
    expect(ofType(events, "schemeDefeated")).toMatchObject([{ instanceId: scoop }]);
    // "Tuck it under here instead": under the obligation, none under Silk (RRG 1.8 "Replacement Effect", p. 37).
    expect(inst(state, overload).tucked).toEqual([merc]);
    expect(tuckedCodes().sort()).toEqual(["01105", "01106", "01186"]);
    expect(encPiles().deck[0]).toBe(hard);
    expect(inPlayArea("52028")).toBe(overload);
    underOverload = [merc];
  });

  it("round 7: Albert Moon's tuck is redirected too; with exactly 2 cards under it the obligation offers a discard, and the player keeps it", () => {
    state = stackEncounterDeck(state, "01188");
    const top = encPiles().deck[0]!;
    const labels: string[] = [];
    const inner = planner({ labels: ["Tuck", "Keep"] });
    const r = driveEventsPicking(
      DEPS,
      state,
      (st) => {
        if (st.pendingChoice!.prompt.kind === "chooseOption")
          labels.push(...st.pendingChoice!.options.map((o) => o.label));
        return inner(st);
      },
      use(P1, albert, ALBERT),
    );
    state = r.state;
    expect(inst(state, overload).tucked).toEqual([...underOverload, top]);
    expect(labels).toContain("Discard Silk Sense Overload");
    expect(labels).toContain("Keep Silk Sense Overload");
    expect(inPlayArea("52028")).toBe(overload);
    expect(tucked()).toHaveLength(3);
    underOverload = [...underOverload, top];
  });

  it("round 7: a Hunting the Spider-Bride tucked under Silk is discarded as the cost of Cindy Moon's action: 2 damage to the identity (owner decision Q7 = A)", () => {
    bride = tuckSetAside("52031");
    expect(tucked()).toHaveLength(4);
    expect(silkDamage()).toBe(4);
    const hand = playerOf(state, P1).hand.length;
    const events = act({}, use(P1, silk(), CINDY, [], { discarded: [bride] }));
    expect(encPiles().discard).toContain(bride);
    expect(ofType(events, "damageDealt")).toMatchObject([{ targetInstanceId: silk(), amount: 2 }]);
    expect(silkDamage()).toBe(6);
    expect(playerOf(state, P1).hand).toHaveLength(hand + 2);
    expect(tuckedCodes().sort()).toEqual(["01105", "01106", "01186"]);
  });

  it("round 7 villain phase: Morlun is dealt and engages Cindy Moon; his ATK and SCH count the 3 encounter cards tucked under her, not those under the obligation", () => {
    state = stageNemesisCardForReveal(state, "52029", P1, 1);
    const events = act({}, endTurn());
    const morlun = inPlayArea("52029")!;
    expect(ofType(events, "encounterCardRevealed")).toMatchObject([{ cardId: "52029", playerId: P1 }]);
    expect(inst(state, morlun).engagedWith).toBe(P1);
    const profile = characterProfile(state, morlun, DEPS)!;
    expect([profile.atk, profile.sch, profile.maxHp]).toEqual([4, 4, 5]);
    // Rhino and Shocker scheme at the alter ego (1 each) and the acceleration icon adds 1.
    expect(mainThreat()).toBe(3);
    expect(state.round).toBe(8);
  });
});

describe("round 8", () => {
  const WEB_REF = "52021.madame-web-response";
  const NOT_TODAY_REF = "52015.not-today-interrupt";
  const SCARLET_REF = "52013.scarlet-spider-interrupt";
  let scarlet: InstanceId;
  let morlun: InstanceId;
  let brideTwo: InstanceId;

  it("round 8, hero form: Scarlet Spider (3) enters; Madame Web (3) looks at the top 3 cards (Silk, Scarlet Spider and herself are Web-Warriors), discards 1 and reorders the rest", () => {
    act({}, changeFormCmd());
    expect(playerOf(state, P1).identity.form).toBe("hero");
    expect(silkDamage()).toBe(6);
    expect(inst(state, silk()).exhausted).toBe(false);
    keep = ["52013", "52021", "52003", "52015", "52016", "52022", "52023"];
    give(
      "52013",
      "52021",
      "52003",
      "52015",
      "52016",
      "52019",
      "52019",
      "52019",
      "52022",
      "52023",
      "52024",
      "52014",
      "52025",
      "52026",
      "52027",
    );
    const entered = act({}, play(P1, handOf("52013"), fodder(3, keep)));
    scarlet = inPlayOf("52013");
    expect(ofType(entered, "cardPlayed")).toMatchObject([{ resourcesPaid: 3 }]);

    state = stackEncounterDeck(state, "01186", "01189", "01190");
    const [first, second, third] = encPiles().deck.slice(0, 3) as [InstanceId, InstanceId, InstanceId];
    const looked: number[] = [];
    const inner = planner({ take: [WEB_REF], many: [second], reverse: true });
    const r = driveEventsPicking(
      DEPS,
      state,
      (st) => {
        if (st.pendingChoice!.prompt.kind === "chooseCards") looked.push(st.pendingChoice!.options.length);
        return inner(st);
      },
      play(P1, handOf("52021"), fodder(3, keep)),
    );
    state = r.state;
    expect(looked).toEqual([3]);
    expect(encPiles().discard).toContain(second);
    expect(encPiles().deck.slice(0, 2)).toEqual([third, first]);
  });

  it("round 8: Swinging Silk Kick declining the Bride's discard deals 7 to Morlun (5 hit points); his When Defeated discards the Bride with no damage (owner decision Q7)", () => {
    overload = inPlayArea("52028")!;
    morlun = inPlayArea("52029")!;
    morlunId = morlun;
    expect(inst(state, overload).tucked).toHaveLength(2);
    brideTwo = tuckSetAside("52031");
    expect(tucked()).toHaveLength(4);
    const events = act({ targets: [morlun], many: [], take: [SENSE] }, play(P1, handOf("52003"), fodder(3, keep)));
    expect(ofType(events, "damageDealt").map((e) => [e.targetInstanceId, e.amount])).toEqual([[morlun, 7]]);
    expect(ofType(events, "characterDefeated")).toMatchObject([{ instanceId: morlun }]);
    // An encounter card's discard, not a player card's: no damage, and the Bride is gone from under Silk.
    expect(encPiles().discard).toContain(brideTwo);
    expect(tuckedCodes().sort()).toEqual(["01105", "01106", "01186"]);
    expect(silkDamage()).toBe(6);
  });

  it("round 8: Silk Sense tucks Morlun under the obligation as the third card, so Overload is removed from game and the cards under it are discarded", () => {
    // 52028 held 2 (the Scoop's tuck, Albert's); Morlun's tuck made 3: no choice, "remove it from the game instead".
    expect(state.removedFromGame).toContain(overload);
    expect(inPlayArea("52028")).toBeUndefined();
    expect(encPiles().discard).toContain(morlun);
    expect(underOverload).toHaveLength(2);
    for (const id of underOverload) expect(encPiles().discard).toContain(id);
    expect(tucked()).toHaveLength(3);
    expect(state.pendingChoice).toBeNull();
  });

  it("round 8 villain phase: Silk defends Rhino with Reflexes and Not Today! (DEF 3 + 2 + 2 = 7), takes no damage, and Stop Hitting Yourself deals 7 to Rhino", () => {
    // Rhino's boost card, then The Great Hunt dealt to Silk.
    state = stageNemesisCardForReveal(state, "52030", P1, 1);
    const events = act(
      {
        defend: true,
        take: [REFLEXES_REF, NOT_TODAY_REF, STOP_REF, SCARLET_REF],
        pay: ["52022", "52023", "52027"],
        targets: [mainScheme()],
        discard: ["52019", "52025", "52026", "52027"],
      },
      endTurn(),
    );
    const rhinoHits = ofType(events, "damageDealt").filter((e) => e.targetInstanceId === villain());
    // Not Today! (cost 1) and Stop Hitting Yourself (cost 2) were both played from the hand during the villain phase.
    expect(ofType(events, "cardPlayed")).toMatchObject([
      { cardId: "52015", resourcesPaid: 1 },
      { cardId: "52016", resourcesPaid: 2 },
    ]);
    // Rhino: ATK 2 against DEF 3 + 2 (Reflexes, Rhino-set cards I'm Tough! and Stampede) + 2 (Not Today!): no damage.
    // The response deals damage equal to that DEF for that attack: 7.
    expect(rhinoHits).toMatchObject([{ amount: 7 }]);
    expect(rhinoDamage()).toBe(13);
    // Shocker then attacks the exhausted Silk (ATK 2): Scarlet Spider takes the damage instead of Silk.
    const scarletHit = ofType(events, "damageDealt").filter((e) => e.targetInstanceId === scarlet);
    expect(scarletHit).toMatchObject([{ amount: 2 }]);
    expect(inst(state, scarlet).damage).toBe(2);
    expect(silkDamage()).toBe(6);
    // Not Today! removed 2 threat from the main scheme (3 to 1), then the acceleration icon added 1.
    expect(mainThreat()).toBe(2);
    // Reflexes tucked the boost card (Advance, discarded after the attack): Silk holds 4 cards again.
    expect(tuckedCodes().sort()).toEqual(["01105", "01106", "01186", "01186"]);
    // The Great Hunt: 2 threat + 1 for each card tucked under each identity (4).
    const hunt = state.villainArea.find((i) => code(i) === "52030")!;
    expect(ofType(events, "encounterCardRevealed")).toMatchObject([{ cardId: "52030", playerId: P1 }]);
    expect(inst(state, hunt).threat).toBe(6);
    expect(state.round).toBe(9);
  });
});

describe("round 9: Rhino stage I is defeated", () => {
  it("round 9 (Silk still exhausted from defending): Organic Webbing discards the tucked Stampede to ready her", () => {
    expect(inst(state, silk()).exhausted).toBe(true);
    expect(applyCommand(state, basicAttack(villain()), DEPS).ok).toBe(false);
    const stampede = tucked().find((i) => code(i) === "01106")!;
    act({}, use(P1, inPlayOf("52009"), "52009.organic-webbing-action", [], { discarded: [stampede] }));
    expect(inst(state, silk()).exhausted).toBe(false);
    expect(encPiles().discard).toContain(stampede);
    expect(tuckedCodes().sort()).toEqual(["01105", "01186", "01186"]);
  });

  it("round 9: Spider Claws adds +1 ATK for the one Rhino-set card left tucked: ATK 3 takes Rhino from 13 to 16 damage and defeats stage I", () => {
    expect(rhinoDamage()).toBe(13);
    const villainBefore = villain();
    const events = act({ take: [CLAWS_REF] }, basicAttack(villain()));
    expect(ofType(events, "damageDealt")).toMatchObject([{ targetInstanceId: villainBefore, amount: 3 }]);
    expect(ofType(events, "villainStageAdvanced")).toMatchObject([{ stageIndex: 1 }]);
    expect(rhinoDamage()).toBe(0);
    expect(state.outcome).toBeNull();
  });

  it("invariants: no pending choice, no card in two zones, her 40 cards all accounted for, every encounter card accounted for", () => {
    expect(state.pendingChoice).toBeNull();
    const zones = new Map<string, string[]>();
    const put = (id: InstanceId, zone: string) => zones.set(id, [...(zones.get(id) ?? []), zone]);
    for (const p of state.players) {
      put(p.identity.instanceId, "identity");
      for (const [name, list] of Object.entries({
        hand: p.hand,
        deck: p.deck,
        discard: p.discard,
        playArea: p.playArea,
        setAside: p.setAside,
      }))
        for (const id of list) put(id, `${p.playerId}.${name}`);
    }
    for (const [id, i] of Object.entries(state.instances)) {
      for (const a of i.attachments) put(a, `attached to ${id}`);
      for (const t of i.tucked) put(t, `tucked under ${id}`);
      for (const b of i.boostCards) put(b, `boost on ${id}`);
    }
    for (const id of state.villainArea) put(id, "villainArea");
    for (const id of state.villains.map((v) => v.instanceId)) put(id, "villain");
    put(state.mainScheme.instanceId, "mainScheme");
    for (const [deckId, pile] of Object.entries(state.encounterDecks)) {
      for (const id of pile.deck) put(id, `${deckId}.deck`);
      for (const id of pile.discard) put(id, `${deckId}.discard`);
    }
    for (const id of state.encounterSetAside) put(id, "encounterSetAside");
    for (const id of state.victoryDisplay) put(id, "victoryDisplay");
    for (const id of state.removedFromGame) put(id, "removedFromGame");
    // Every instance of the game sits in exactly one zone.
    expect([...zones].filter(([, z]) => z.length > 1)).toEqual([]);
    expect(Object.keys(state.instances).filter((id) => !zones.has(id))).toEqual([]);

    // Her 40 cards: hand + deck + discard + in play (attached ones included) = 40, all hers.
    const p = playerOf(state, P1);
    const attached = Object.values(state.instances).flatMap((i) => i.attachments);
    const mine = [...p.hand, ...p.deck, ...p.discard, ...p.playArea, ...attached].filter(
      (id) => inst(state, id).ownerId === P1,
    );
    expect(new Set(mine).size).toBe(mine.length);
    expect(mine).toHaveLength(40);
    // None of her cards ended up tucked, removed from the game or set aside.
    expect(state.removedFromGame.filter((id) => inst(state, id).ownerId === P1)).toEqual([]);

    // Every encounter card is accounted for: none created, none lost (tucked ones included), and the obligation left
    // the game. Nothing of hers is tucked anywhere.
    const encounter = Object.keys(state.instances).filter((id) => inst(state, id as InstanceId).ownerId !== P1);
    expect(encounter).toHaveLength(encounterTotal);
    expect(Object.keys(state.instances)).toHaveLength(instanceTotal);
    expect(zones.get(overload)).toEqual(["removedFromGame"]);
    // The nemesis set: Morlun and two Spider-Brides are discarded, The Great Hunt is in play, one Bride is still set aside.
    expect(p.setAside.map(code)).toEqual(["52031"]);
    expect(zones.get(morlunId)).toEqual([expect.stringContaining(".discard")]);
    for (const id of tucked()) expect(zones.get(id)).toEqual([`tucked under ${silk()}`]);
  });
});

describe("Stop Hitting Yourself while a guard minion is engaged", () => {
  // The engine does not offer the Hero Response (attack) while Hydra Mercenary (Guard) is engaged, which is what RRG 1.8
  // "Guard" (p. 21: "cannot use cards they control to attack a villain") and the April 30, 2026 Ruling 2 (a Guard minion
  // forbids an attack effect against the villain) give. The comment on 52016 in aspect-basic.ts says "guard does not
  // apply"; that comment is the stale half, not the engine. Pinned so a change to either is noticed.
  const offeredStop = (withGuard: boolean): boolean => {
    let s = silkHeroGame({ seed: 1 });
    if (withGuard) s = engageMinion(s, "01101").state;
    state = s;
    give("52016", "52019", "52019", "52023");
    state = stackEncounterDeck(state, "01186", "01186");
    const seen: string[] = [];
    const inner = planner({
      defend: true,
      take: [STOP_REF],
      pay: ["52019", "52023"],
      discard: ["52017", "52007", "52008", "52009"],
    });
    const r = driveEventsPicking(
      DEPS,
      state,
      (st) => {
        seen.push(...st.pendingChoice!.options.map((o) => o.optionId as string));
        return inner(st);
      },
      endTurn(),
    );
    state = r.state;
    return seen.some((o) => o.endsWith(STOP_REF));
  };
  it("is offered after Rhino's defended attack when no minion is engaged", () => {
    expect(offeredStop(false)).toBe(true);
  });
  it("is not offered while Hydra Mercenary is engaged", () => {
    expect(offeredStop(true)).toBe(false);
  });
});

describe("Hunting the Spider-Bride (52031) revealed in a real villain phase (a game of its own, seed 1)", () => {
  it("dealt to Cindy Moon from the nemesis set with nothing tucked: it tucks itself under her identity and surges", () => {
    const start = silkGame();
    const staged = stageNemesisCardForReveal(start, "52031", P1, 1);
    const decline: Picker = (s) => (s.pendingChoice!.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s));
    const { state, events } = driveEventsPicking(SILK_DEPS, staged, decline, endTurn(P1));
    const tucked = inst(state, identityOf(state)).tucked;
    expect(tucked).toHaveLength(1);
    expect(inst(state, tucked[0]!).cardId).toBe("52031");
    expect(events.filter((e) => e.type === "surgeTriggered").map((e) => e.instanceId)).toEqual(tucked);
  });
});
