import { BP_CARDS, CORE_CARDS } from "@mc/content";
import {
  applyCommand,
  cardsInPlay,
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
  play,
  playerOf,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, stageNemesisCardForReveal } from "../../../testing/staging.js";
import { WAVE8_ABILITIES } from "../../../wave8/index.js";
import { BP_ASPECT_BASIC } from "../aspect-basic.js";
import { bpGame } from "../testing.js";
import { BLACK_PANTHER_EVENTS } from "./events.js";
import { BLACK_PANTHER_IDENTITY } from "./identity.js";
import { BLACK_PANTHER_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { BLACK_PANTHER_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";

vi.setConfig({ testTimeout: 240_000 });

const DEPS: EngineDeps = {
  abilities: mergeRegistries(
    WAVE8_ABILITIES,
    BP_ASPECT_BASIC,
    BLACK_PANTHER_IDENTITY,
    BLACK_PANTHER_EVENTS,
    BLACK_PANTHER_SUPPORT_UPGRADES_ALLIES,
    BLACK_PANTHER_OBLIGATION_NEMESIS,
  ),
};

const INVENTOR = "51001b.inventor";
const RESPONSE = "51001a.black-panther-response";

interface Plan {
  /** Optional triggers to take, by id suffix; every other optional trigger is declined. */
  readonly take?: readonly string[];
  /** Card codes or instance ids, each consumed by the first target/card prompt that offers it. */
  readonly prefer?: readonly string[];
  /** Label prefixes, each consumed by the first option prompt that offers one. */
  readonly options?: readonly string[];
  /** For an `orderSpecials` prompt: the codes of the upgrades whose Specials resolve, first to last. */
  readonly order?: readonly string[];
  /** Hand cards (instance ids) that pay a resource prompt raised mid-ability (Inventor's reduced cost). */
  readonly spend?: readonly InstanceId[];
  /** Every option prompt not answered by `options` takes "Do not discard ...". */
  readonly keep?: boolean;
  /** The identity defends (otherwise no defender is declared). */
  readonly defend?: boolean;
}
const codeIn = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const planner = (plan: Plan): Picker => {
  const prefer = [...(plan.prefer ?? [])];
  const options = [...(plan.options ?? [])];
  return (s) => {
    const choice = s.pendingChoice!;
    const offered = choice.options.map((o) => o.optionId as string);
    switch (choice.prompt.kind) {
      case "chooseTriggers": {
        const hit = offered.find((o) => plan.take?.some((t) => o.endsWith(t)));
        return hit ? [hit] : [];
      }
      case "declareDefender":
        return plan.defend && offered.includes(identityOf(s)) ? [identityOf(s)] : ["decline"];
      case "chooseOption": {
        for (const [i, want] of options.entries()) {
          const hit = choice.options.find((o) => o.label.startsWith(want));
          if (hit) {
            options.splice(i, 1);
            return [hit.optionId];
          }
        }
        const keep = plan.keep ? choice.options.find((o) => o.label.startsWith("Do not discard")) : undefined;
        return keep ? [keep.optionId] : firstLegal(s);
      }
      case "spendResources":
        return (plan.spend ?? []).map((i) => `hand:${i}`).filter((o) => offered.includes(o));
      case "orderSpecials": {
        const rank = (o: string) => {
          const at = plan.order?.indexOf(codeIn(s, o.split(":")[0] as InstanceId)) ?? -1;
          return at < 0 ? 99 : at;
        };
        return [...offered].sort((a, b) => rank(a) - rank(b));
      }
      case "chooseTarget":
      case "chooseCards": {
        for (const [i, want] of prefer.entries()) {
          const hit = offered.find((o) => o === want || (s.instances[o as InstanceId]?.cardId as string) === want);
          if (hit) {
            prefer.splice(i, 1);
            return [hit];
          }
        }
        return firstLegal(s);
      }
      default:
        return firstLegal(s);
    }
  };
};

let state: GameState;
let ORIGINAL: ReadonlySet<InstanceId>;
let log: GameEvent[] = [];
/** Runs commands (answering each prompt by `plan`) and returns only the events they produced. */
const act = (plan: Plan, ...commands: readonly Command[]): GameEvent[] => {
  const r = driveEventsPicking(DEPS, state, planner(plan), ...commands);
  state = r.state;
  log = [...log, ...r.events];
  return [...r.events];
};
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

const code = (id: InstanceId): string => inst(state, id).cardId as string;
const nameOf = (c: string): string => [...BP_CARDS, ...CORE_CARDS].find((x) => (x.id as string) === c)!.name;
const handOf = (c: string): InstanceId[] => playerOf(state, P1).hand.filter((i) => code(i) === c);
const handCodes = (): string[] => playerOf(state, P1).hand.map(code);
const inPlayAll = (c: string): InstanceId[] => cardsInPlay(state).filter((i) => code(i) === c);
const inPlayOf = (c: string): InstanceId | undefined => inPlayAll(c)[0];
const mustPlay = (c: string): InstanceId => {
  const id = inPlayOf(c);
  if (!id) throw new Error(`${c} is not in play`);
  return id;
};
const give = (...codes: string[]): InstanceId[] => {
  const r = moveToHand(state, P1, ...codes);
  state = r.state;
  return [...r.ids];
};
const stack = (...codes: string[]) => {
  state = stackEncounterDeck(state, ...codes);
};
const villain = (): InstanceId => state.activeVillainId!;
const mainScheme = (): InstanceId => state.mainScheme.instanceId;
const mainThreat = (): number => inst(state, mainScheme()).threat;
const damageOn = (id: InstanceId): number => inst(state, id).damage;
const me = (): InstanceId => identityOf(state);
const deckSize = (): number => playerOf(state, P1).deck.length;

const thwartBy = (by: InstanceId, scheme: InstanceId = mainScheme()): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: by,
  schemeInstanceId: scheme,
});
const attackBy = (by: InstanceId, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: by,
  targetInstanceId: target,
});
const changeForm = (): Command => ({ type: "changeForm", playerId: P1 });
const ability = (id: InstanceId, ref: string): Command => use(P1, id, ref);
const playFrom = (c: string, pay: readonly InstanceId[], extra: Parameters<typeof play>[3] = {}): Command =>
  play(P1, handOf(c)[0]!, pay, extra);
const attachedToMe = () => ({ attachToInstanceId: me() });

/**
 * Whole-game test for Black Panther's (Shuri) printed precon (`bp-justice`, cards 51001-51038) against Core's Rhino
 * (standard, solo), docs/phase7-wave9.md section 8.4 ("Black Panther starter deck e2e"). Five rounds played through the
 * engine's real commands, one decision at a time, ending with Rhino's stage I defeated. Only the encounter deck is
 * seeded (`stackEncounterDeck`, `stageNemesisCardForReveal`), plus `moveToHand` for the cards a round needs; every play,
 * ability, thwart and attack is a command the engine validates. Deterministic by seed (1).
 *
 * Round by round: 1 alter ego (Inventor takes Vibranium Suit for 0, Queen Ramonda, Kimoyo Beads, Aja-Adanna; Klaw is
 * dealt), 2 hero (basic thwart + hero response, Panther Claws, Clawed Strike; Rhino and Klaw attack, Manipulated
 * M.U.S.I.C. brings in M.U.S.I.C.), 3 hero (Spider Bites, On the Prowl, Aja-Adanna, Wakanda Forever! over all four
 * Specials), 4 alter ego (T'Challa, The Elephant's Trunk, Inventor for Sonic Rifle at a paid cost; T'Challa's Shadow is
 * dealt), 5 hero (T'Challa's response, Shuri's response, Clawed Strike at +1 cost defeats Rhino I).
 *
 * Rules the game leans on (RRG 1.8 = mc_rulesreference_v18_compressed.md):
 * - Labeled Ability (p. 26): a "(thwart)" or "(attack)" ability is a thwart or attack made by the identity, so Specials
 *   and Hero Actions count for T'Challa's Shadow ("after you thwart, attack, or defend") and an ally's thwart does not
 *   (You, Your, p. 49).
 * - Hero Response is only active in hero form, so T'Challa's response is not offered in round 4 (alter ego).
 * - Exhaust / Defend (p. 14): a defender stays exhausted through her next turn, so round 3's attacks go undefended to
 *   keep Shuri's round 4 Inventor available. Search (p. 39): the deck is shuffled after Inventor's search.
 * - Main scheme "The Break-In!" has a threshold of 7 per player: rounds 3 and 4 thwart to stay clear of it.
 *
 * Not exercised here (covered by the kit tests in this folder): Queen Ramonda's heal, The Scream, the Special of
 * Spider Bites' and Panther Claws' other branches (stun / decline), Kimoyo Beads' confuse, Redemption in play (needs
 * Show of Empathy), and every aspect/basic card, which waits on a later engine task: those cards (Invisibility Gear,
 * Sonic Rifle, Sting Operation, Dora Milaje, The Raft, Manifold, Infiltration, Ayo, Aneka, Okoye, Heart of the Panther,
 * Show of Empathy, Build Support and the rest) are unscripted, none is a reprint with a script registered under its own
 * id, and here they are only ever payment (resources) or, for Sonic Rifle, an inert upgrade found by Inventor.
 */
describe("Black Panther (Shuri) precon against Rhino (standard, solo), seed 1", () => {
  it("setup: 40-card deck, hand of 6 in alter-ego form, Redemption set aside outside the 40, nemesis cards set aside", () => {
    state = bpGame();
    const p = playerOf(state, P1);
    expect(p.identity.form).toBe("alterEgo");
    // RRG "Setup": the hand is 6 (alter-ego hand size) from the 40-card deck.
    expect(p.hand).toHaveLength(6);
    expect(p.deck).toHaveLength(34);
    expect(p.discard).toHaveLength(0);
    ORIGINAL = new Set([...p.hand, ...p.deck]);
    expect(ORIGINAL.size).toBe(40);
    expect(handCodes().sort()).toEqual(["51008", "51009", "51010", "51018", "51019", "51030"]);
    // Redemption 51036 is linked (Show of Empathy) and is set aside in the encounter set-aside area, not in the 40.
    expect([...ORIGINAL].some((i) => code(i) === "51036")).toBe(false);
    expect(state.encounterSetAside.map(code)).toEqual(["51036"]);
    // The nemesis set (Klaw, both M.U.S.I.C. cards, two Screams) is set aside for the player.
    expect(p.setAside.map(code).sort()).toEqual(["51032", "51033", "51034", "51035", "51035"]);
    // The obligation is shuffled into the encounter deck, not into the player's deck.
    expect([...ORIGINAL].some((i) => code(i) === "51031")).toBe(false);
    expect(maxHitPoints(state, me(), DEPS)).toBe(11);
    expect(maxHitPoints(state, villain(), DEPS)).toBe(14);
    expect(mainThreat()).toBe(0);
    expect(state.round).toBe(1);
    expect(state.pendingChoice).toBeNull();
  });

  it("round 1, alter ego: Inventor is compulsory when an upgrade can be found, and Vibranium Suit comes in for 0", () => {
    const started = applyCommand(state, use(P1, me(), INVENTOR), DEPS);
    if (!started.ok) throw new Error(started.error.message);
    const prompt = started.state.pendingChoice!;
    expect(prompt.prompt).toMatchObject({ kind: "chooseCards", slot: "playFromHand" });
    // Owner decision Q15 = A: the search is not a "may": one card must be chosen.
    expect(prompt.minSelections).toBe(1);
    expect(prompt.maxSelections).toBe(1);
    // Black Panther or Tech upgrades in the deck only (Kimoyo Beads is in hand; no events, supports or allies).
    const offered = prompt.options.map((o) => nameOf(code(o.optionId as InstanceId))).sort();
    expect(offered).toEqual([
      "Invisibility Gear",
      "Invisibility Gear",
      "Panther Claws",
      "Sonic Rifle",
      "Sonic Rifle",
      "Sonic Rifle",
      "Spider Bites",
      "Vibranium Suit",
    ]);
    const events = act({ prefer: ["51013"] }, use(P1, me(), INVENTOR));
    expect(ofType(events, "cardExhausted")).toMatchObject([{ instanceId: me() }]);
    // Vibranium Suit costs 2, reduced by 2: no resources paid; it is played, so it attaches to the identity.
    expect(ofType(events, "cardPlayed")).toMatchObject([{ cardId: "51013", resourcesPaid: 0 }]);
    const suit = mustPlay("51013");
    expect(inst(state, suit).attachedTo).toBe(me());
    expect(ofType(events, "deckShuffled")).toHaveLength(1);
    expect(deckSize()).toBe(33);
    // "Limit once per round" and Shuri is exhausted.
    expect(applyCommand(state, use(P1, me(), INVENTOR), DEPS).ok).toBe(false);
  });

  it("round 1, alter ego: Queen Ramonda, Kimoyo Beads and Aja-Adanna enter play for their printed costs", () => {
    const [energy] = give("51027");
    const [gear] = handOf("51019");
    const [dora, raft] = [handOf("51030")[0]!, handOf("51018")[0]!];
    const ramonda = act({}, playFrom("51008", [gear!]));
    expect(ofType(ramonda, "cardPlayed")).toMatchObject([{ cardId: "51008", resourcesPaid: 1 }]);
    const beads = act({}, playFrom("51010", [dora, raft], attachedToMe()));
    expect(ofType(beads, "cardPlayed")).toMatchObject([{ cardId: "51010", resourcesPaid: 2 }]);
    expect(inst(state, mustPlay("51010")).attachedTo).toBe(me());
    const aja = act({}, playFrom("51009", [energy!]));
    // The Energy resource card prints 2 resources: paying a 1-cost card with it overpays by 1, which is legal.
    expect(ofType(aja, "cardPlayed")).toMatchObject([{ cardId: "51009", resourcesPaid: 2, paid: { energy: 2 } }]);
    expect(handCodes()).toEqual([]);
    expect(playerOf(state, P1).discard.map(code).sort()).toEqual(["51018", "51019", "51027", "51030"]);
  });

  it("round 1 villain phase: Rhino schemes at the alter ego (2 threat); Klaw, the nemesis minion, is dealt and engages Shuri", () => {
    // Rhino's boost is Hydra Mercenary (1 icon); the card dealt to Shuri is Klaw from her set-aside nemesis cards.
    state = stackEncounterDeck(stageNemesisCardForReveal(state, "51032", P1, 0), "01101");
    const events = act({}, endTurn());
    // RRG "Villain Phase" (Appendix II, p. 52): an alter-ego identity is schemed against.
    expect(ofType(events, "enemyActivated")).toMatchObject([{ enemyInstanceId: villain(), activation: "scheme" }]);
    expect(ofType(events, "schemeResolved")).toMatchObject([{ baseSch: 1, boostIcons: 1, threatPlaced: 2 }]);
    expect(state.round).toBe(2);
    expect(mainThreat()).toBe(3); // acceleration 1 + Rhino SCH 1 + 1 boost icon
    const klaw = mustPlay("51032");
    expect(inst(state, klaw).engagedWith).toBe(P1);
    expect(maxHitPoints(state, klaw, DEPS)).toBe(6);
    // The nemesis set left the set-aside area: one Klaw, the rest still set aside.
    expect(playerOf(state, P1).setAside.map(code).sort()).toEqual(["51033", "51034", "51035", "51035"]);
    // Alter-ego hand size 6: drew back up to 6 (the hand was empty).
    expect(playerOf(state, P1).hand).toHaveLength(6);
    expect(deckSize()).toBe(26); // 34 - Vibranium Suit (Inventor) - Energy (moved to hand) - 6 drawn
    expect(inst(state, me()).exhausted).toBe(false); // ready again
  });

  it("round 2, hero form: a basic thwart, then the hero response resolves Kimoyo Beads' Special (1 more threat)", () => {
    const flipped = act({}, changeForm());
    expect(ofType(flipped, "formChanged")).toMatchObject([{ to: "hero" }]);
    expect(handCodes().sort()).toEqual(["51002", "51005", "51006", "51019", "51020", "51021"]);
    const beads = mustPlay("51010");
    const events = act({ take: [RESPONSE], prefer: ["51010", mainScheme()], keep: true }, thwartBy(me()));
    // THW 2 of the main scheme's 3, then Kimoyo Beads' Special (thwart 1): the response is optional and was taken.
    expect(ofType(events, "threatRemoved").map((e) => [e.schemeInstanceId, e.amount])).toEqual([
      [mainScheme(), 2],
      [mainScheme(), 1],
    ]);
    expect(mainThreat()).toBe(0);
    expect(inPlayOf("51010")).toBe(beads); // not discarded
    expect(inst(state, me()).exhausted).toBe(true);
  });

  it("round 2: Panther Claws enters play, then Clawed Strike deals 4 and resolves Panther Claws' Special (2): 6 on Rhino", () => {
    const [claws, strike] = give("51011", "51003");
    const [vibranium, gear, sting] = [handOf("51006")[0]!, handOf("51019")[0]!, handOf("51021")[0]!];
    // Panther Claws costs 2: the Vibranium resource card prints 2 wild icons.
    const entered = act({}, play(P1, claws!, [vibranium], attachedToMe()));
    expect(ofType(entered, "cardPlayed")).toMatchObject([{ cardId: "51011", resourcesPaid: 2 }]);
    expect(inst(state, claws!).attachedTo).toBe(me());
    const events = act({ prefer: [villain(), "51011", villain()], keep: true }, play(P1, strike!, [gear, sting]));
    expect(ofType(events, "cardPlayed")).toMatchObject([{ cardId: "51003", resourcesPaid: 2 }]);
    expect(ofType(events, "damageDealt").map((e) => [e.targetInstanceId, e.amount])).toEqual([
      [villain(), 4],
      [villain(), 2],
    ]);
    expect(damageOn(villain())).toBe(6);
    expect(inPlayOf("51011")).toBe(claws); // kept: no discard
    expect(playerOf(state, P1).discard.map(code)).toContain("51003");
  });

  it("round 2 villain phase: Rhino and Klaw attack (Klaw's interrupt gives him a boost card); Manipulated M.U.S.I.C. brings in M.U.S.I.C.", () => {
    // Boosts: Hydra Mercenary (1 icon) for Rhino, Caught Off Guard (1 icon) for Klaw; dealt Manipulated M.U.S.I.C.
    state = stackEncounterDeck(stageNemesisCardForReveal(state, "51033", P1, 0), "01101", "01188");
    const klaw = mustPlay("51032");
    const events = act({}, endTurn());
    expect(ofType(events, "enemyActivated")).toMatchObject([
      { enemyInstanceId: villain(), activation: "attack" },
      { enemyInstanceId: klaw, activation: "attack" },
    ]);
    // Klaw is not villainous, so his one boost card is the one his Forced Interrupt gives him (51032).
    expect(ofType(events, "boostCardDealt").filter((e) => e.enemyInstanceId === klaw)).toHaveLength(1);
    const hits = ofType(events, "attackResolved");
    expect(hits.map((h) => [h.baseAtk, h.boostIcons, h.damageDealt])).toEqual([
      [2, 1, 3],
      [0, 1, 1],
    ]);
    expect(damageOn(me())).toBe(4);
    // Manipulated M.U.S.I.C. (5 threat) found M.U.S.I.C. (1 hit point) and put her into play engaged with Shuri.
    const side = mustPlay("51033");
    const music = mustPlay("51034");
    expect(inst(state, side).threat).toBe(5);
    expect(inst(state, music).engagedWith).toBe(P1);
    expect(maxHitPoints(state, music, DEPS)).toBe(1);
    expect(mainThreat()).toBe(1); // acceleration 1; neither attack adds threat
    expect(state.round).toBe(3);
    // Hero hand size 5: drew back up to 5.
    expect(playerOf(state, P1).hand).toHaveLength(5);
  });

  it("round 3: Spider Bites enters play; On the Prowl removes 3 from Manipulated M.U.S.I.C. and Kimoyo Beads' Special removes 1 more", () => {
    const [bites, prowl, genius, strength] = give("51012", "51004", "51028", "51029");
    const entered = act({}, play(P1, bites!, [genius!], attachedToMe()));
    expect(ofType(entered, "cardPlayed")).toMatchObject([{ cardId: "51012", resourcesPaid: 2 }]);
    expect(inst(state, bites!).attachedTo).toBe(me());
    const side = mustPlay("51033");
    const events = act({ prefer: [side, "51010", side], keep: true }, play(P1, prowl!, [strength!]));
    expect(ofType(events, "cardPlayed")).toMatchObject([{ cardId: "51004", resourcesPaid: 2 }]);
    expect(ofType(events, "threatRemoved").map((e) => [e.schemeInstanceId, e.amount])).toEqual([
      [side, 3],
      [side, 1],
    ]);
    expect(inst(state, side).threat).toBe(1);
    expect(mainThreat()).toBe(1);
  });

  it("round 3: Aja-Adanna shuffles Clawed Strike from the discard pile back into the deck", () => {
    const decksBefore = deckSize();
    const strikeInDiscard = playerOf(state, P1).discard.find((i) => code(i) === "51003")!;
    const events = act({ prefer: ["51003"] }, ability(mustPlay("51009"), "51009.aja-adanna-action"));
    expect(inst(state, mustPlay("51009")).exhausted).toBe(true);
    expect(ofType(events, "cardMoved").filter((e) => e.instanceId === strikeInDiscard)).toMatchObject([
      { from: { kind: "discard" }, to: { kind: "deck" } },
    ]);
    expect(deckSize()).toBe(decksBefore + 1);
    expect(playerOf(state, P1).deck).toContain(strikeInDiscard);
    expect(ofType(events, "deckShuffled")).toHaveLength(1);
  });

  it("round 3: Wakanda Forever! resolves all four Specials in the chosen order (Bites, Suit, Claws, Kimoyo)", () => {
    const rifle = handOf("51020")[0]!;
    const music = mustPlay("51034");
    const side = mustPlay("51033");
    const klaw = mustPlay("51032");
    expect(damageOn(villain())).toBe(6);
    expect(damageOn(me())).toBe(4);
    const events = act(
      { order: ["51012", "51013", "51011", "51010"], prefer: [villain(), klaw, mainScheme()], keep: true },
      playFrom("51005", [rifle]),
    );
    expect(ofType(events, "cardPlayed")).toMatchObject([{ cardId: "51005", resourcesPaid: 1 }]);
    // Spider Bites: 1 to the villain and 1 to each minion engaged with Shuri (Klaw and M.U.S.I.C.); M.U.S.I.C. has 1 hit point.
    // Vibranium Suit: 1 moved from Shuri to Rhino. Panther Claws: 2 to Klaw. Kimoyo Beads: 1 threat.
    expect(ofType(events, "damageDealt").map((e) => [e.targetInstanceId, e.amount])).toEqual([
      [villain(), 1],
      [klaw, 1],
      [music, 1],
      [villain(), 1],
      [klaw, 2],
    ]);
    expect(ofType(events, "damageHealed")).toMatchObject([{ targetInstanceId: me(), amount: 1 }]);
    expect(ofType(events, "characterDefeated")).toMatchObject([{ instanceId: music }]);
    expect(damageOn(villain())).toBe(8);
    expect(damageOn(klaw)).toBe(3);
    expect(damageOn(me())).toBe(3);
    // M.U.S.I.C.'s When Defeated moved the 1 threat left on Manipulated M.U.S.I.C. to the main scheme (1 -> 2); Kimoyo -> 1.
    expect(ofType(events, "threatPlaced")).toMatchObject([{ schemeInstanceId: mainScheme(), amount: 1 }]);
    expect(ofType(events, "threatRemoved").filter((e) => e.schemeInstanceId === mainScheme())).toMatchObject([
      { amount: 1 },
    ]);
    expect(mainThreat()).toBe(1);
    expect(inPlayOf("51033")).toBeUndefined();
    expect(inPlayOf("51034")).toBeUndefined();
    expect(side).toBeDefined();
    // All four upgrades stay (none was discarded) and all four resolved: nothing is left to resolve.
    expect(["51010", "51011", "51012", "51013"].map((c) => inst(state, mustPlay(c)).attachedTo)).toEqual(
      Array(4).fill(me()),
    );
    expect(state.pendingChoice).toBeNull();
  });

  it("round 3 villain phase: Rhino and Klaw hit the ready, undefended Shuri; Advance makes Rhino scheme", () => {
    // Boosts: Hard to Keep Down (0 icons) for Rhino, Caught Off Guard (1 icon) for Klaw; dealt Advance, boosted by a 0-icon card.
    stack("01104", "01188", "01186", "01104");
    const klaw = mustPlay("51032");
    // No defender is declared: a defending hero exhausts and stays exhausted through her next turn, which would cost
    // Shuri round 4's Inventor action (RRG "Defend, Defense", p. 14, and "Exhaust").
    const events = act({}, endTurn());
    const hits = ofType(events, "attackResolved");
    expect(hits.map((h) => [h.enemyInstanceId, h.baseAtk, h.boostIcons, h.defenseReduction, h.damageDealt])).toEqual([
      [villain(), 2, 0, 0, 2],
      [klaw, 0, 1, 0, 1],
    ]);
    expect(ofType(events, "boostCardDealt").filter((e) => e.enemyInstanceId === klaw)).toHaveLength(1);
    expect(damageOn(me())).toBe(6);
    // Advance: "The villain schemes": SCH 1 + 0 boost icons.
    expect(ofType(events, "schemeResolved")).toMatchObject([
      { enemyInstanceId: villain(), baseSch: 1, boostIcons: 0, threatPlaced: 1 },
    ]);
    expect(mainThreat()).toBe(3); // 1 + acceleration 1 + Advance 1
    expect(state.round).toBe(4);
    expect(playerOf(state, P1).hand).toHaveLength(5);
  });

  it("round 4, alter ego: T'Challa (4) enters and thwarts 2; his Hero Response is not offered in alter-ego form", () => {
    const flipped = act({}, changeForm());
    expect(ofType(flipped, "formChanged")).toMatchObject([{ to: "alterEgo" }]);
    expect(inst(state, me()).exhausted).toBe(false);
    give("51006", "51023", "51022");
    const [vibranium, manifold, infiltration] = [handOf("51006")[0]!, handOf("51014")[0]!, handOf("51015")[0]!];
    const entered = act({}, playFrom("51002", [vibranium, manifold, infiltration]));
    expect(ofType(entered, "cardPlayed")).toMatchObject([{ cardId: "51002", resourcesPaid: 4 }]);
    const tchalla = mustPlay("51002");
    expect(mainThreat()).toBe(3);
    // 51002 is a "Hero Response": it is only active while the player's identity is in hero form (RRG "Hero/Alter-Ego" qualifiers).
    const events = act(
      { take: ["51002.tchalla-response"], prefer: ["51010", mainScheme()], keep: true },
      thwartBy(tchalla),
    );
    expect(ofType(events, "threatRemoved").map((e) => e.amount)).toEqual([2]); // THW 2, and no Special followed
    expect(mainThreat()).toBe(1);
    // Consequential damage 1 after a thwart (RRG "Consequential Damage"); T'Challa has 3 hit points.
    expect(damageOn(tchalla)).toBe(1);
    expect(inst(state, tchalla).exhausted).toBe(true);
  });

  it("round 4: The Elephant's Trunk (2) exhausts itself and Queen Ramonda to draw 2 cards", () => {
    const [trunk] = give("51007");
    const [ayo, aneka] = [handOf("51023")[0]!, handOf("51022")[0]!];
    const entered = act({}, play(P1, trunk!, [ayo, aneka]));
    expect(ofType(entered, "cardPlayed")).toMatchObject([{ cardId: "51007", resourcesPaid: 2 }]);
    const ramonda = mustPlay("51008");
    const handBefore = playerOf(state, P1).hand.length;
    const deckBefore = deckSize();
    // "Exhaust The Elephant's Trunk and up to 2 other Wakanda allies and/or supports": T'Challa is exhausted already,
    // Aja-Adanna is an upgrade; Queen Ramonda is the one other pick.
    const events = act({}, use(P1, trunk!, "51007.the-elephants-trunk-action", [], { exhausted: [trunk!, ramonda] }));
    expect(ofType(events, "cardExhausted").map((e) => e.instanceId)).toEqual([trunk, ramonda]);
    expect(ofType(events, "cardDrawn")).toHaveLength(2);
    expect(playerOf(state, P1).hand).toHaveLength(handBefore + 2);
    expect(deckSize()).toBe(deckBefore - 2);
    expect(inst(state, trunk!).exhausted).toBe(true);
    expect(inst(state, ramonda).exhausted).toBe(true);
    // Aja-Adanna was exhausted by round 3's action? No: it readied at the end of the player phase.
  });

  it("round 4: Inventor again, now paying: Sonic Rifle (3) at 2 less costs 1 resource", () => {
    const [rifle] = handOf("51020");
    // The remaining cost is asked for when the upgrade is played, and paid from hand like any play.
    const events = act({ prefer: ["51020"], spend: [rifle!] }, use(P1, me(), INVENTOR));
    expect(ofType(events, "cardPlayed")).toMatchObject([{ cardId: "51020", resourcesPaid: 1 }]);
    const deckRifle = mustPlay("51020");
    expect(inst(state, deckRifle).attachedTo).toBe(me());
    expect(deckRifle).not.toBe(rifle);
    expect(inst(state, me()).exhausted).toBe(true);
    expect(playerOf(state, P1).discard).toContain(rifle);
  });

  it("round 4 villain phase: Rhino and Klaw scheme (Klaw's interrupt is for attacks only); T'Challa's Shadow is dealt to Shuri", () => {
    // Rhino's scheme boost is Hard to Keep Down (0 icons); dealt the obligation. Klaw is not villainous: no boost card.
    stack("01104", "51031");
    const klaw = mustPlay("51032");
    const events = act({}, endTurn());
    expect(ofType(events, "enemyActivated")).toMatchObject([
      { enemyInstanceId: villain(), activation: "scheme" },
      { enemyInstanceId: klaw, activation: "scheme" },
    ]);
    expect(
      ofType(events, "schemeResolved").map((e) => [e.enemyInstanceId, e.baseSch, e.boostIcons, e.threatPlaced]),
    ).toEqual([
      [villain(), 1, 0, 1],
      [klaw, 2, 0, 2],
    ]);
    expect(ofType(events, "boostCardDealt").filter((e) => e.enemyInstanceId === klaw)).toEqual([]);
    expect(mainThreat()).toBe(5); // 1 + acceleration 1 + Rhino 1 + Klaw 2
    // "Give to the Shuri player": the obligation is in her play area with its 4 doubt counters.
    const shadow = mustPlay("51031");
    expect(playerOf(state, P1).playArea).toContain(shadow);
    expect(inst(state, shadow).counters).toMatchObject({ doubt: 4 });
    expect(state.round).toBe(5);
    expect(playerOf(state, P1).hand).toHaveLength(6); // alter-ego hand size 6
  });

  it("round 5, hero form: T'Challa's Hero Response resolves Kimoyo Beads' Special; that (thwart) is Shuri's thwart, so Shadow loses a counter", () => {
    act({}, changeForm());
    const tchalla = mustPlay("51002");
    const shadow = mustPlay("51031");
    expect(inst(state, tchalla).exhausted).toBe(false);
    expect(mainThreat()).toBe(5);
    const events = act(
      { take: ["51002.tchalla-response"], prefer: ["51010", mainScheme()], keep: true },
      thwartBy(tchalla),
    );
    // THW 2, then Kimoyo Beads' Special (1): 5 -> 3 -> 2.
    expect(ofType(events, "threatRemoved").map((e) => e.amount)).toEqual([2, 1]);
    expect(mainThreat()).toBe(2);
    expect(damageOn(tchalla)).toBe(2); // 1 + 1 consequential
    // "After you thwart" is the identity thwarting, not an ally (RRG "You, Your", p. 49): T'Challa's own thwart removes
    // nothing. But Kimoyo Beads' "Special (thwart)" is a labeled ability, "considered to be a thwart made by that
    // player's identity" (RRG "Labeled Ability", p. 26), so Shadow's Forced Response fires once, for that.
    expect(ofType(events, "counterRemoved")).toMatchObject([{ instanceId: shadow, counterType: "doubt", amount: 1 }]);
    expect(inst(state, shadow).counters).toMatchObject({ doubt: 3 });
  });

  it("round 5: Shuri's basic attack and Black Panther response (Vibranium Suit on Klaw); Shadow loses a doubt counter", () => {
    const klaw = mustPlay("51032");
    expect(damageOn(villain())).toBe(8);
    expect(damageOn(me())).toBe(6);
    const events = act({ take: [RESPONSE], prefer: ["51013", klaw], keep: true }, attackBy(me(), villain()));
    expect(ofType(events, "damageDealt").map((e) => [e.targetInstanceId, e.amount])).toEqual([
      [villain(), 1], // ATK 1
      [klaw, 1], // Vibranium Suit: 1 moved from Shuri to Klaw
    ]);
    expect(ofType(events, "damageHealed")).toMatchObject([{ targetInstanceId: me(), amount: 1 }]);
    expect(damageOn(villain())).toBe(9);
    expect(damageOn(klaw)).toBe(4);
    expect(damageOn(me())).toBe(5);
    // Forced Response, "after you thwart, attack, or defend": once for the basic attack and once for the Special
    // (attack), a labeled ability that counts as an attack by Shuri (RRG "Labeled Ability", p. 26): 3 -> 1.
    expect(ofType(events, "counterRemoved")).toMatchObject([
      { counterType: "doubt", amount: 1 },
      { counterType: "doubt", amount: 1 },
    ]);
    expect(inst(state, mustPlay("51031")).counters).toMatchObject({ doubt: 1 });
  });

  it("round 5: with T'Challa's Shadow Clawed Strike costs 3; 4 damage then Panther Claws' Special (discard: 5 piercing) defeats Rhino (I)", () => {
    const hand = [handOf("51025")[0]!, handOf("51021")[0]!, handOf("51015")[0]!];
    const events = act(
      { prefer: [villain(), "51011", villain()], options: ["Discard Panther Claws"] },
      playFrom("51003", hand),
    );
    // Increase the resource cost of each card you play by 1 (2 -> 3).
    expect(ofType(events, "cardPlayed")).toMatchObject([{ cardId: "51003", resourcesPaid: 3 }]);
    const rhinoI = ofType(events, "damageDealt").map((e) => e.amount);
    expect(rhinoI).toEqual([4, 5]); // 9 + 4 = 13, then 13 + 5 = 18 of 14
    expect(ofType(events, "villainStageAdvanced")).toMatchObject([{ stageIndex: 1 }]);
    expect(inPlayOf("51011")).toBeUndefined(); // discarded for the Special
    // Clawed Strike is a "Hero Action (attack)": Shadow's last doubt counter goes (nothing is printed for 0).
    expect(ofType(events, "counterRemoved")).toMatchObject([{ counterType: "doubt", amount: 1 }]);
    expect(state.outcome).toBeNull();
    expect(damageOn(villain())).toBe(0);
    expect(state.pendingChoice).toBeNull();
  });

  it("invariants: no pending choice, no card in two zones, hand + deck + discard + in play = the 40 cards", () => {
    const p = playerOf(state, P1);
    expect(state.pendingChoice).toBeNull();
    const inPlay = cardsInPlay(state).filter((i) => ORIGINAL.has(i));
    const zones = [...p.hand, ...p.deck, ...p.discard, ...inPlay];
    expect(new Set(zones).size).toBe(zones.length);
    expect(zones).toHaveLength(40);
    expect(new Set(zones)).toEqual(ORIGINAL);
    // The obligation, Klaw and the other encounter cards are not the player's; Redemption never left the set-aside area.
    expect(zones.some((i) => ["51031", "51032", "51033", "51034", "51036"].includes(code(i)))).toBe(false);
    expect(state.encounterSetAside.map(code)).toEqual(["51036"]);
    // The Black Panther upgrades still in play are attached to Shuri.
    for (const c of ["51010", "51012", "51013", "51020"]) expect(inst(state, mustPlay(c)).attachedTo).toBe(me());
  });
});
